"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { geoContains, geoNaturalEarth1, geoPath } from "d3-geo";
import { select } from "d3-selection";
import "d3-transition";
import { zoom, zoomIdentity } from "d3-zoom";
import { feature, mesh } from "topojson-client";
import { TbFocusCentered, TbMinus, TbPlus } from "react-icons/tb";

// Land is projected once at this width and scaled to the container.
const REF_WIDTH = 1000;
const projection = geoNaturalEarth1().fitWidth(REF_WIDTH, { type: "Sphere" });
const REF_HEIGHT = geoPath(projection).bounds({ type: "Sphere" })[1][1];
const MAX_ZOOM = 400;
const MAX_FIT_ZOOM = 32;
const MAX_DODGE = 10;
const CONTROLS_WIDTH = 52;
const ANTARCTICA = "010";

// Natural Earth uses ISO numeric ids. Tiny countries must be listed; others are found by position.
const COUNTRY_IDS = {
  TR: "792", IN: "356", VN: "704", KH: "116", TH: "764", SG: "702", MY: "458",
  IT: "380", VA: "336", PH: "608", KR: "410", JP: "392", CN: "156", ES: "724",
  AL: "008", FR: "250", GB: "826", US: "840", TW: "158", HK: "344", MO: "446",
  MC: "492", SM: "674", LI: "438", AD: "020", MT: "470", LU: "442", BN: "096",
};

const tone = (value) => (value === "dim" ? "var(--map-dim)" : `rgb(var(--map-year-${value}))`);

function useWorld() {
  const [world, setWorld] = useState(null);
  useEffect(() => {
    let active = true;
    import("world-atlas/countries-50m.json").then(({ default: topology }) => {
      if (!active) return;
      const path = geoPath(projection).digits(2);
      const features = feature(topology, topology.objects.countries).features.filter((item) => item.id !== ANTARCTICA);
      setWorld({
        countries: features.map((item) => ({ id: item.id, feature: item, d: path(item) })),
        borders: path(mesh(topology, topology.objects.countries, (a, b) => a !== b)),
      });
    }).catch(() => active && setWorld({ countries: [], borders: "", failed: true }));
    return () => { active = false; };
  }, []);
  return world;
}

function textWidth(text) {
  let width = 0;
  for (const character of text) width += character.charCodeAt(0) > 0x2e7f ? 12.5 : 7.2;
  return width;
}

const overlaps = (a, b) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];

// Nearby places (Rome and the Vatican) are nudged apart so each stays visible and clickable.
function dodge(points) {
  for (let iteration = 0; iteration < 6; iteration += 1) {
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const a = points[i];
        const b = points[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let distance = Math.hypot(dx, dy);
        const minimum = a.r + b.r + 2;
        if (distance >= minimum) continue;
        if (distance < 0.01) [dx, dy, distance] = [Math.cos(i + j), Math.sin(i + j), 1];
        const push = (minimum - distance) / 2;
        a.x -= (dx / distance) * push;
        a.y -= (dy / distance) * push;
        b.x += (dx / distance) * push;
        b.y += (dy / distance) * push;
      }
    }
    for (const point of points) {
      const offset = Math.hypot(point.x - point.x0, point.y - point.y0);
      if (offset <= MAX_DODGE) continue;
      point.x = point.x0 + ((point.x - point.x0) / offset) * MAX_DODGE;
      point.y = point.y0 + ((point.y - point.y0) / offset) * MAX_DODGE;
    }
  }
  return points;
}

// Greedy placement: higher priority first, right of the mark, else left, else hidden.
// The current or selected place may cover other dots, never other labels.
function placeLabels(points, width, height) {
  const taken = points.map((point) => [point.x - point.r, point.y - point.r, point.r * 2, point.r * 2]);
  const labels = [];
  for (const point of points.filter((item) => item.label).sort((a, b) => b.labelPriority - a.labelPriority)) {
    const w = textWidth(point.label);
    const strong = point.current || point.selected;
    const options = [
      { anchor: "start", x: point.x + point.r + 5, box: [point.x + point.r + 3, point.y - 9, w + 4, 18] },
      { anchor: "end", x: point.x - point.r - 5, box: [point.x - point.r - w - 7, point.y - 9, w + 4, 18] },
    ];
    const fit = options.find(({ box }) => box[0] >= 4 && box[1] >= 4 && box[0] + box[2] <= width - 4 && box[1] + box[3] <= height - 4 &&
      !taken.some((other, index) => (index >= points.length || (!strong && points[index] !== point)) && overlaps(other, box)));
    if (!fit) continue;
    taken.push(fit.box);
    labels.push({ id: point.id, text: point.label, x: fit.x, y: point.y, anchor: fit.anchor, strong });
  }
  return labels;
}

function arc(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  // Bend left of the direction of travel, so a return leg curves the other way.
  const bend = Math.min(length * 0.2, 80);
  const cx = (from.x + to.x) / 2 + (dy / (length || 1)) * bend;
  const cy = (from.y + to.y) / 2 - (dx / (length || 1)) * bend;
  return {
    d: `M${from.x.toFixed(1)},${from.y.toFixed(1)}Q${cx.toFixed(1)},${cy.toFixed(1)} ${to.x.toFixed(1)},${to.y.toFixed(1)}`,
    length,
    mid: { x: (from.x + 2 * cx + to.x) / 4, y: (from.y + 2 * cy + to.y) / 4 },
    angle: (Math.atan2(dy, dx) * 180) / Math.PI,
  };
}

export default function WorldMap({ marks, routes, visitedCountries, activeCountries, focus, onSelect, renderTooltip, children }) {
  const wrapperRef = useRef(null);
  const svgRef = useRef(null);
  const behaviorRef = useRef(null);
  const focusRef = useRef(focus);
  const fittedKey = useRef(null);
  const hintTimer = useRef(null);
  const world = useWorld();
  const [size, setSize] = useState(null);
  const [transform, setTransform] = useState(zoomIdentity);
  const [hovered, setHovered] = useState(null);
  const [hint, setHint] = useState(false);
  focusRef.current = focus;

  useLayoutEffect(() => {
    const element = wrapperRef.current;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((current) => (current && current.width === width && current.height === height ? current : { width, height }));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const base = useMemo(() => {
    if (!size) return null;
    const scale = size.width / REF_WIDTH;
    return { scale, dy: Math.max(0, (size.height - REF_HEIGHT * scale) / 2) };
  }, [size]);

  const toBase = useMemo(() => base && (([lng, lat]) => {
    const [x, y] = projection([lng, lat]);
    return [x * base.scale, y * base.scale + base.dy];
  }), [base]);

  function fit(ids, duration) {
    const behavior = behaviorRef.current;
    if (!behavior || !size) return;
    const points = marks.filter((mark) => ids.includes(mark.id)).map((mark) => toBase([mark.lng, mark.lat]));
    let target = zoomIdentity;
    if (points.length) {
      const xs = points.map(([x]) => x);
      const ys = points.map(([, y]) => y);
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      const span = size.width / 40; // keep the surroundings of a single city in view
      const width = size.width - CONTROLS_WIDTH; // places stay clear of the zoom buttons
      const k = Math.min(MAX_FIT_ZOOM, 0.76 / Math.max(Math.max(x1 - x0, span) / width, Math.max(y1 - y0, span) / size.height));
      target = zoomIdentity.translate(width / 2, size.height / 2).scale(Math.max(1, k)).translate(-(x0 + x1) / 2, -(y0 + y1) / 2);
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    select(svgRef.current).transition().duration(reduced ? 0 : duration).call(behavior.transform, target);
  }

  useEffect(() => {
    if (!size) return undefined;
    const svg = select(svgRef.current);
    const behavior = zoom()
      .scaleExtent([1, MAX_ZOOM])
      .extent([[0, 0], [size.width, size.height]])
      .translateExtent([[0, 0], [size.width, size.height]])
      .clickDistance(4)
      // Plain wheel scrolls the page; pinch (ctrlKey) or ⌘/Ctrl + wheel zooms.
      .filter((event) => (event.type === "wheel" ? event.ctrlKey || event.metaKey : !event.button))
      .on("zoom", (event) => setTransform(event.transform));
    svg.call(behavior);
    behaviorRef.current = behavior;
    fittedKey.current = null;
    return () => {
      svg.interrupt().on(".zoom", null);
      behaviorRef.current = null;
    };
  }, [size]);

  useEffect(() => {
    if (!behaviorRef.current) return;
    const first = fittedKey.current === null;
    if (!first && fittedKey.current === focus.key) return;
    fittedKey.current = focus.key;
    fit(focusRef.current.ids, first ? 0 : 750);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus.key, size]);

  useEffect(() => () => clearTimeout(hintTimer.current), []);

  const countryIds = useMemo(() => {
    if (!world) return new Map();
    const result = new Map();
    for (const mark of marks) {
      if (result.has(mark.countryCode)) continue;
      const id = COUNTRY_IDS[mark.countryCode] || world.countries.find((item) => geoContains(item.feature, [mark.lng, mark.lat]))?.id;
      if (id) result.set(mark.countryCode, id);
    }
    return result;
  }, [world, marks]);

  const visitedKey = [...visitedCountries].sort().join();
  const activeKey = [...activeCountries].sort().join();
  const land = useMemo(() => {
    if (!world) return null;
    const visited = new Set([...visitedCountries].map((code) => countryIds.get(code)));
    const active = new Set([...activeCountries].map((code) => countryIds.get(code)));
    return (
      <>
        {world.countries.map(({ id, d }, index) => (
          <path key={`${id}-${index}`} d={d} className={`map-country${active.has(id) ? " is-active" : visited.has(id) ? " is-visited" : ""}`} />
        ))}
        <path d={world.borders} className="map-borders" vectorEffect="non-scaling-stroke" />
      </>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, countryIds, visitedKey, activeKey]);

  const points = useMemo(() => {
    if (!toBase) return [];
    return dodge(marks.map((mark) => {
      const [x, y] = transform.apply(toBase([mark.lng, mark.lat]));
      return { ...mark, x, y, x0: x, y0: y };
    }));
  }, [marks, toBase, transform]);
  const byId = useMemo(() => new Map(points.map((point) => [point.id, point])), [points]);
  const labels = useMemo(() => (size ? placeLabels(points, size.width, size.height) : []), [points, size]);

  const zoomBy = (factor) => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    select(svgRef.current).transition().duration(reduced ? 0 : 300).call(behaviorRef.current.scaleBy, factor);
  };

  const showHint = (event) => {
    if (event.ctrlKey || event.metaKey) return;
    setHint(true);
    clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setHint(false), 1400);
  };

  const tooltipPoint = hovered && byId.get(hovered);
  const controlClass = "grid size-9 place-items-center rounded-full border border-line bg-bg/90 text-muted backdrop-blur transition-colors hover:text-ink";

  return (
    <div ref={wrapperRef} onWheel={showHint} className="relative aspect-[4/3] w-full overflow-hidden sm:aspect-[16/10]">
      {size && (
        <svg ref={svgRef} width={size.width} height={size.height} className="absolute inset-0 block cursor-grab active:cursor-grabbing" role="group" aria-label="旅の地図">
          <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
            <g transform={`translate(0,${base.dy}) scale(${base.scale})`} className={`map-land${land ? " is-ready" : ""}`}>
              {land}
            </g>
          </g>
          <g>
            {routes.map((route) => {
              const from = byId.get(route.from);
              const to = byId.get(route.to);
              if (!from || !to) return null;
              const shape = arc(from, to);
              const color = tone(route.tone);
              return (
                <g key={route.key}>
                  <path d={shape.d} pathLength={1} stroke={color} className={`map-route${route.isNew ? " is-new" : ""}`} />
                  {route.arrow && shape.length > 56 && (
                    <path
                      d="M-3.5,-4 L1.5,0 L-3.5,4"
                      transform={`translate(${shape.mid.x.toFixed(1)},${shape.mid.y.toFixed(1)}) rotate(${shape.angle.toFixed(1)})`}
                      fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                      className={route.isNew ? "map-arrow is-new" : "map-arrow"}
                    />
                  )}
                </g>
              );
            })}
          </g>
          <g>
            {points.map((point) => {
              const color = tone(point.tone);
              const focusRing = hovered === point.id || point.selected;
              return (
                <g
                  key={point.id}
                  role="button"
                  tabIndex={0}
                  aria-label={point.ariaLabel}
                  aria-pressed={point.selected}
                  className="map-place"
                  transform={`translate(${point.x.toFixed(1)},${point.y.toFixed(1)})`}
                  onClick={() => onSelect(point.id)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    onSelect(point.id);
                  }}
                  onPointerEnter={() => setHovered(point.id)}
                  onPointerLeave={() => setHovered((current) => (current === point.id ? null : current))}
                  onFocus={() => setHovered(point.id)}
                  onBlur={() => setHovered((current) => (current === point.id ? null : current))}
                >
                  <circle r={Math.max(12, point.r + 4)} fill="transparent" />
                  {point.current && <circle r={point.r + 3} stroke={color} className="map-pulse" />}
                  {focusRing && <circle r={point.r + 3.5} fill="none" stroke="rgb(var(--c-ink))" strokeWidth={1.5} />}
                  {point.variant === "ring" && <circle r={point.r} fill="rgb(var(--c-bg))" stroke={color} strokeWidth={1.5} />}
                  {point.variant === "dot" && <circle r={point.r} fill={color} stroke="rgb(var(--c-bg))" strokeWidth={2} />}
                  {point.variant === "badge" && (
                    // Station style: ink numbers on the surface stay legible on every year colour.
                    <>
                      <circle r={point.r} fill="rgb(var(--c-bg))" stroke={color} strokeWidth={2.5} />
                      <text textAnchor="middle" dominantBaseline="central" className="pointer-events-none fill-ink text-[10px] font-bold tabular-nums">
                        {point.number}
                      </text>
                    </>
                  )}
                </g>
              );
            })}
          </g>
          <g>
            {labels.map((label) => (
              <text key={label.id} x={label.x} y={label.y} textAnchor={label.anchor} dominantBaseline="central" className={`map-label${label.strong ? " font-bold" : ""}`}>
                {label.text}
              </text>
            ))}
          </g>
        </svg>
      )}

      {tooltipPoint && (
        <div
          role="tooltip"
          className={`pointer-events-none absolute z-10 w-max max-w-[16rem] -translate-x-1/2 rounded-xl border border-line bg-bg/95 px-3 py-2 text-xs leading-relaxed shadow-sm backdrop-blur ${tooltipPoint.y < 96 ? "" : "-translate-y-full"}`}
          style={{
            left: Math.min(Math.max(tooltipPoint.x, 96), size.width - 96),
            // Near the top edge the tooltip opens below the place instead.
            top: tooltipPoint.y < 96 ? tooltipPoint.y + tooltipPoint.r + 10 : tooltipPoint.y - tooltipPoint.r - 10,
          }}
        >
          {renderTooltip(tooltipPoint.id)}
        </div>
      )}

      <div className="absolute right-3 top-3 flex flex-col gap-1.5">
        <button type="button" className={controlClass} onClick={() => zoomBy(1.8)} aria-label="拡大">
          <TbPlus aria-hidden="true" className="size-4" />
        </button>
        <button type="button" className={controlClass} onClick={() => zoomBy(1 / 1.8)} aria-label="縮小">
          <TbMinus aria-hidden="true" className="size-4" />
        </button>
        <button type="button" className={controlClass} onClick={() => fit(focusRef.current.ids, 750)} aria-label="選択中の旅に合わせる">
          <TbFocusCentered aria-hidden="true" className="size-4" />
        </button>
      </div>

      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-1/2 mx-auto w-max -translate-y-1/2 rounded-full bg-ink/80 px-4 py-2 text-xs text-bg transition-opacity duration-300 ${hint ? "opacity-100" : "opacity-0"}`}
      >
        ⌘ / Ctrl を押しながらスクロールで拡大
      </div>

      {world?.failed && (
        <p className="absolute inset-x-0 bottom-3 text-center text-xs text-muted">地図を読み込めませんでした。</p>
      )}
      {children}
    </div>
  );
}
