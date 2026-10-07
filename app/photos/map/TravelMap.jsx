"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TbArrowRight, TbPlayerPauseFilled, TbPlayerPlayFilled, TbX } from "react-icons/tb";
import FilterChips from "app/components/filter-chips";
import CountryFlag from "app/components/country-flag";
import { formatRange, tripTitle, yearLegend, yearTone as toneForYear } from "app/lib/travel-log.mjs";
import { FULL_WIDTH, THUMB_WIDTH, aspectHeight, photoCaption, usePhotoLightbox } from "../photo-lightbox";
import WorldMap from "./WorldMap";
import "./travel-map.css";

const STEP_MS = 1100;
// A new trip moves the camera first, so its first stop stays on screen longer.
const NEW_TRIP_MS = 1800;

function Swatch({ tone }) {
  return <span aria-hidden="true" className="h-[3px] w-4 shrink-0 rounded-full" style={{ background: `rgb(var(--map-year-${tone}))` }} />;
}

export default function TravelMap({ places, trips, years, countryNames, countryCategories }) {
  const placeById = useMemo(() => new Map(places.map((place) => [place.id, place])), [places]);
  const [tripId, setTripId] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [step, setStep] = useState(null); // null: every route drawn
  const [playing, setPlaying] = useState(false);

  const selectedTrip = trips.find((trip) => trip.id === tripId) || null;
  const scope = useMemo(() => (selectedTrip ? [selectedTrip] : trips), [selectedTrip, trips]);
  const stops = useMemo(() => scope.flatMap((trip) => trip.visits.map((visit, index) => ({ ...visit, trip, index }))), [scope]);
  const lastStep = stops.length - 1;
  const current = step === null ? null : stops[Math.min(step, lastStep)];
  const selectedPlace = selectedId ? placeById.get(selectedId) : null;
  const yearTone = (year) => toneForYear(years, year);
  const countryName = (code) => countryNames[code] || code;

  useEffect(() => {
    if (!playing || step === null) return undefined;
    if (step >= lastStep) {
      setPlaying(false);
      return undefined;
    }
    const timer = setTimeout(() => setStep(step + 1), stops[step].index === 0 && !selectedTrip ? NEW_TRIP_MS : STEP_MS);
    return () => clearTimeout(timer);
  }, [playing, step, lastStep, stops, selectedTrip]);

  usePhotoLightbox("#place-gallery", selectedPlace);

  const selectTrip = (value) => {
    setTripId(value);
    setStep(null);
    setPlaying(false);
    setSelectedId(null);
  };

  const togglePlay = () => {
    if (playing) return setPlaying(false);
    if (step === null || step >= lastStep) setStep(0);
    setPlaying(true);
  };

  const goTo = (index) => {
    setPlaying(false);
    setStep(index);
  };

  const showStop = (index) => {
    goTo(index);
    setSelectedId(stops[index].placeId);
  };

  const view = useMemo(() => {
    const reachedUntil = step === null ? lastStep : step;
    const reached = new Set(stops.slice(0, reachedUntil + 1).map((stop) => stop.placeId));
    const inScope = new Set(stops.map((stop) => stop.placeId));
    const numbers = new Map();
    if (selectedTrip) for (const visit of selectedTrip.visits) if (visit.number && !numbers.has(visit.placeId)) numbers.set(visit.placeId, visit.number);

    const marks = places.map((place) => {
      const active = inScope.has(place.id);
      const isCurrent = current?.placeId === place.id;
      const future = active && !reached.has(place.id);
      const placeTone = selectedTrip ? yearTone(selectedTrip.year) : yearTone(place.years.at(-1));
      let mark;
      if (!active) mark = { variant: "dot", r: 3, tone: "dim" };
      else if (future) mark = { variant: "ring", r: 3, tone: "dim" };
      else if (!place.main) mark = { variant: "ring", r: 3.5, tone: placeTone };
      else if (selectedTrip) mark = { variant: "badge", r: 9, tone: placeTone, number: numbers.get(place.id) };
      else mark = { variant: "dot", r: Math.min(9, 4 + Math.sqrt(place.photoCount) * 0.45), tone: placeTone };
      return {
        ...mark,
        id: place.id,
        lng: place.lng,
        lat: place.lat,
        countryCode: place.countryCode,
        current: isCurrent,
        selected: selectedId === place.id,
        label: active && !future && (place.main || isCurrent) ? place.name : null,
        labelPriority: (isCurrent ? 2000 : 0) + (selectedId === place.id ? 1000 : 0) + place.photoCount,
        ariaLabel: `${place.name}（${countryName(place.countryCode)}）・${place.visits.map((visit) => formatRange(visit.start, visit.end)).join("、")}・${place.photoCount}枚`,
        order: (active ? 1 : 0) + (isCurrent || selectedId === place.id ? 2 : 0),
      };
    }).sort((a, b) => a.order - b.order);

    const routes = [];
    let position = 0;
    for (const trip of trips) {
      const active = scope.includes(trip);
      trip.visits.forEach((visit, index) => {
        const stepIndex = active ? position + index : -1;
        if (index === 0 || (active && step !== null && stepIndex > step)) return;
        routes.push({
          key: `${trip.id}-${index}`,
          from: trip.visits[index - 1].placeId,
          to: visit.placeId,
          tone: active ? yearTone(trip.year) : "dim",
          isNew: active && step !== null && stepIndex === step,
          arrow: active && (selectedTrip !== null || step !== null),
          active,
        });
      });
      if (active) position += trip.visits.length;
    }
    routes.sort((a, b) => Number(a.active) - Number(b.active));
    return { marks, routes };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, trips, scope, stops, step, lastStep, current, selectedTrip, selectedId]);

  const focusTrip = selectedTrip || (current ? current.trip : null);
  const focus = useMemo(() => (focusTrip
    ? { key: focusTrip.id, ids: [...new Set(focusTrip.visits.map((visit) => visit.placeId))] }
    : { key: "all", ids: places.map((place) => place.id) }), [focusTrip, places]);

  const visitedCountries = useMemo(() => new Set(places.map((place) => place.countryCode)), [places]);
  const activeCountries = useMemo(() => new Set(focusTrip ? focusTrip.countries : []), [focusTrip]);

  const totalPhotos = trips.reduce((sum, trip) => sum + trip.photoCount, 0);
  const options = [
    { value: "all", label: "すべての旅", count: totalPhotos },
    ...trips.map((trip) => ({ value: trip.id, label: tripTitle(trip), count: trip.photoCount, icon: <Swatch tone={yearTone(trip.year)} /> })),
  ];

  const stats = [
    { value: visitedCountries.size, unit: "か国" },
    { value: places.length, unit: "か所" },
    { value: trips.length, unit: "回の旅" },
    { value: totalPhotos, unit: "枚" },
  ];

  const routeSummary = (trip) => trip.visits
    .map((visit) => placeById.get(visit.placeId))
    .filter((place) => place.main)
    .map((place) => place.name)
    .filter((name, index, list) => name !== list[index - 1])
    .join(" → ");

  const readout = current
    ? `${step + 1} / ${stops.length}・${formatRange(current.start, current.end)}・${placeById.get(current.placeId).name}（${countryName(placeById.get(current.placeId).countryCode)}）`
    : `${formatRange(stops[0].start, stops.at(-1).end)}・再生すると巡った順にたどります`;

  return (
    <section aria-label="旅の地図" className="travel-map pb-4">
      <ul className="mb-6 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
        {stats.map(({ value, unit }) => (
          <li key={unit}>
            <span className="mr-0.5 text-xl font-bold tabular-nums text-ink">{value.toLocaleString("ja-JP")}</span>
            {unit}
          </li>
        ))}
      </ul>

      <FilterChips label="旅" options={options} selected={tripId} onSelect={selectTrip} />

      <div className="overflow-hidden rounded-card border border-line bg-bg">
        <WorldMap
          marks={view.marks}
          routes={view.routes}
          visitedCountries={visitedCountries}
          activeCountries={activeCountries}
          focus={focus}
          onSelect={(id) => setSelectedId((value) => (value === id ? null : id))}
          renderTooltip={(id) => {
            const place = placeById.get(id);
            return (
              <>
                <span className="flex items-center gap-1.5 font-bold text-ink">
                  <CountryFlag countryCode={place.countryCode} />
                  {place.name}
                </span>
                <span className="block text-muted">{place.visits.map((visit) => formatRange(visit.start, visit.end)).join("、")}</span>
                <span className="block text-muted">{place.photoCount}枚{place.main ? "" : "・経由地"}</span>
              </>
            );
          }}
        >
          <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-3 rounded-full bg-bg/85 px-3 py-1.5 text-[11px] tabular-nums text-muted backdrop-blur">
            {yearLegend(years).map(({ label, tone }) => (
              <span key={label} className="inline-flex items-center gap-1.5">
                <Swatch tone={tone} />
                {label}
              </span>
            ))}
          </div>
        </WorldMap>

        <div className="flex items-center gap-3 border-t border-line px-3 py-3 sm:px-4">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? "一時停止" : "巡った順に再生"}
            className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-bg transition-opacity hover:opacity-80"
          >
            {playing ? <TbPlayerPauseFilled aria-hidden="true" className="size-4" /> : <TbPlayerPlayFilled aria-hidden="true" className="size-4" />}
          </button>
          <div className="min-w-0 flex-1">
            <input
              type="range"
              min={0}
              max={lastStep}
              value={step ?? lastStep}
              onChange={(event) => goTo(Number(event.target.value))}
              aria-label="巡った順番"
              aria-valuetext={readout}
              className="block w-full accent-accent"
            />
            <p className="mt-1 truncate text-xs tabular-nums text-muted" aria-live={playing ? "off" : "polite"}>{readout}</p>
          </div>
        </div>

        {selectedPlace && (
          <div className="border-t border-line px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 font-bold">
                  <CountryFlag countryCode={selectedPlace.countryCode} />
                  {selectedPlace.name}
                </h2>
                <p className="mt-0.5 text-xs tabular-nums text-muted">
                  {countryName(selectedPlace.countryCode)}・{selectedPlace.photoCount}枚・
                  {selectedPlace.visits.map((visit) => formatRange(visit.start, visit.end)).join("、")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="閉じる"
                className="grid size-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-soft hover:text-ink"
              >
                <TbX aria-hidden="true" className="size-4" />
              </button>
            </div>
            <div id="place-gallery" className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
              {selectedPlace.photos.map((photo) => (
                <a
                  key={photo.id}
                  href={photo.url}
                  data-pswp-width={photo.width || FULL_WIDTH}
                  data-pswp-height={photo.height || aspectHeight(photo.aspect, FULL_WIDTH)}
                  data-photo-caption={photoCaption(photo)}
                  target="_blank"
                  rel="noreferrer"
                  className="block aspect-square overflow-hidden rounded-md bg-soft"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.thumbnail}
                    alt={`${selectedPlace.name}で撮影した写真`}
                    width={THUMB_WIDTH}
                    height={aspectHeight(photo.aspect, THUMB_WIDTH)}
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover transition-transform duration-500 hover:scale-[1.03]"
                  />
                </a>
              ))}
            </div>
            {countryCategories[selectedPlace.countryCode] && (
              <Link
                href={`/photos?country=${encodeURIComponent(countryCategories[selectedPlace.countryCode])}`}
                className="mt-3 inline-flex items-center gap-1 text-sm text-accent underline-offset-4 hover:underline"
              >
                {countryName(selectedPlace.countryCode)}の写真をすべて見る
                <TbArrowRight aria-hidden="true" className="size-4" />
              </Link>
            )}
          </div>
        )}
      </div>

      <div className="mt-10">
        {selectedTrip ? (
          <>
            <h2 className="mb-1 font-bold tracking-wide">{tripTitle(selectedTrip)}の順路</h2>
            <p className="mb-4 text-xs tabular-nums text-muted">
              {formatRange(selectedTrip.start, selectedTrip.end)}・{selectedTrip.days}日・{selectedTrip.photoCount}枚
            </p>
            <ol className="relative before:absolute before:bottom-5 before:left-[1.45rem] before:top-5 before:w-px before:bg-line">
              {selectedTrip.visits.map((visit, index) => {
                const place = placeById.get(visit.placeId);
                return (
                  <li key={`${visit.placeId}-${index}`}>
                    <button
                      type="button"
                      onClick={() => showStop(index)}
                      aria-current={step === index ? "step" : undefined}
                      className="relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-soft aria-[current=step]:bg-soft"
                    >
                      <span className="grid w-5 shrink-0 place-items-center">
                        {visit.number ? (
                          <span
                            className="grid size-5 place-items-center rounded-full border-2 bg-bg text-[10px] font-bold tabular-nums"
                            style={{ borderColor: `rgb(var(--map-year-${yearTone(selectedTrip.year)}))` }}
                          >
                            {visit.number}
                          </span>
                        ) : (
                          <span className="size-2 rounded-full border-[1.5px] border-muted bg-bg" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={visit.number ? "font-bold" : "text-sm text-muted"}>{place.name}</span>
                        <span className="ml-2 inline-flex items-center gap-1 align-middle text-xs text-muted">
                          <CountryFlag countryCode={place.countryCode} />
                          {countryName(place.countryCode)}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted">{formatRange(visit.start, visit.end)}</span>
                      <span className="hidden w-10 shrink-0 text-right text-xs tabular-nums text-muted sm:block">{visit.photoCount}枚</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </>
        ) : (
          <>
            <h2 className="mb-4 font-bold tracking-wide">旅の記録</h2>
            <ol className="space-y-1">
              {[...trips].reverse().map((trip) => (
                <li key={trip.id}>
                  <button
                    type="button"
                    onClick={() => selectTrip(trip.id)}
                    className="block w-full rounded-xl px-3 py-3 text-left transition-colors hover:bg-soft"
                  >
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Swatch tone={yearTone(trip.year)} />
                      <span className="font-bold">{tripTitle(trip)}</span>
                      <span className="text-xs tabular-nums text-muted">
                        {formatRange(trip.start, trip.end)}・{trip.days}日・{trip.photoCount}枚
                      </span>
                      <span className="flex items-center gap-1">
                        {trip.countries.map((code) => <CountryFlag key={code} countryCode={code} />)}
                      </span>
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-muted">{routeSummary(trip)}</span>
                  </button>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </section>
  );
}
