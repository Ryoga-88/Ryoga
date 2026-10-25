import Link from "next/link";
import { geoContains, geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import topology from "world-atlas/countries-110m.json";
import { yearLegend, yearTone } from "app/lib/travel-log.mjs";
import "app/maps/travel-map.css";

const WIDTH = 960;
const HEIGHT = 420;
const PADDING = 58;
const countries = feature(topology, topology.objects.countries).features.filter((country) => country.id !== "010");
const color = (tone) => `rgb(var(--map-year-${tone}))`;

function previewProjection(places) {
  // Centre the smallest longitude interval, including journeys across the date line.
  const longitudes = places.map(({ lng }) => (lng + 360) % 360).sort((a, b) => a - b);
  let largestGap = -1;
  let intervalStart = longitudes[0];
  for (let index = 0; index < longitudes.length; index += 1) {
    const next = longitudes[(index + 1) % longitudes.length];
    const gap = next + (index === longitudes.length - 1 ? 360 : 0) - longitudes[index];
    if (gap > largestGap) {
      largestGap = gap;
      intervalStart = next;
    }
  }
  const centre = intervalStart + (360 - largestGap) / 2;
  const projection = geoNaturalEarth1().rotate([-centre, 0]).fitWidth(WIDTH, { type: "Sphere" });
  const points = places.map(({ lng, lat }) => projection([lng, lat]));
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  // Keep some geographical context even when only one city has been published.
  const scale = Math.min(4, (WIDTH - PADDING * 2) / Math.max(1, x1 - x0), (HEIGHT - PADDING * 2) / Math.max(1, y1 - y0));
  const [tx, ty] = projection.translate();
  return projection
    .scale(projection.scale() * scale)
    .translate([WIDTH / 2 + (tx - (x0 + x1) / 2) * scale, HEIGHT / 2 + (ty - (y0 + y1) / 2) * scale])
    .clipExtent([[0, 0], [WIDTH, HEIGHT]]);
}

export default function TravelMapPreview({ places, trips, years }) {
  if (!places.length) return null;

  const projection = previewProjection(places);
  const path = geoPath(projection).digits(1);
  const placeById = new Map(places.map((place) => [place.id, place]));
  const countryCount = new Set(places.map(({ countryCode }) => countryCode)).size;
  const label = `${countryCount}か国・${places.length}か所を巡った旅の地図を見る`;
  const routes = trips.flatMap((trip) => trip.visits.flatMap((visit, index) => {
    const from = placeById.get(trip.visits[index - 1]?.placeId);
    const to = placeById.get(visit.placeId);
    if (!from || !to || from.id === to.id) return [];
    return [{
      key: `${trip.id}-${index}`,
      tone: yearTone(years, trip.year),
      d: path({ type: "LineString", coordinates: [[from.lng, from.lat], [to.lng, to.lat]] }),
    }];
  }));

  return (
    <Link href="/maps" aria-label={label} className="travel-map group block overflow-hidden rounded-card border border-line bg-soft">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true" focusable="false" className="block h-auto w-full">
        {countries.map((country) => {
          const d = path(country);
          if (!d) return null;
          const visited = places.some(({ lng, lat }) => geoContains(country, [lng, lat]));
          return <path key={country.id} d={d} className={`map-country${visited ? " is-visited" : ""}`} stroke="rgb(var(--c-soft))" strokeWidth="0.8" strokeLinejoin="round" />;
        })}
        {routes.map(({ key, d, tone }) => (
          <path key={key} d={d} fill="none" stroke={color(tone)} strokeWidth="1.8" strokeLinecap="round" opacity="0.55" />
        ))}
        {places.map((place) => {
          const [cx, cy] = projection([place.lng, place.lat]);
          return <circle key={place.id} cx={cx.toFixed(1)} cy={cy.toFixed(1)} r={place.main ? 5 : 3} fill={color(yearTone(years, place.years.at(-1)))} stroke="rgb(var(--c-bg))" strokeWidth="1.3" />;
        })}
      </svg>
      <div aria-hidden="true" className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line bg-bg px-4 py-3 text-xs text-muted sm:px-5">
        <span>{countryCount}か国 · {places.length}か所</span>
        <span className="flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
          {yearLegend(years).map(({ label: year, tone }) => (
            <span key={year} className="inline-flex items-center gap-1.5">
              <span className="h-[3px] w-3 rounded-full" style={{ background: color(tone) }} />
              {year}
            </span>
          ))}
        </span>
      </div>
    </Link>
  );
}
