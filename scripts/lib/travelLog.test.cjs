const test = require("node:test");
const assert = require("node:assert/strict");

const load = () => import("../../app/lib/travel-log.mjs");

const map = {
  version: 1,
  places: [
    { id: "tr-1", countryCode: "TR", name: "イスタンブール", lat: 41, lng: 29 },
    { id: "tr-2", countryCode: "TR", name: "カッパドキア", lat: 38.65, lng: 34.85 },
    { id: "in-1", countryCode: "IN", name: "デリー", lat: 28.65, lng: 77.2 },
    { id: "in-2", countryCode: "IN", name: "マトゥラー", lat: 27.55, lng: 77.75 },
    { id: "it-1", countryCode: "IT", name: "ローマ", lat: 41.9, lng: 12.5 },
    { id: "kr-1", countryCode: "KR", name: "ソウル", lat: 37.6, lng: 127 },
  ],
  photos: {},
};

let counter = 0;
function photos(placeId, date, count, extra = {}) {
  return Array.from({ length: count }, (_, index) => {
    counter += 1;
    const id = `photo-${counter}`;
    map.photos[id] = placeId;
    return { id, date, capturedAt: `${date}T0${index}:00:00Z`, favorite: "false", ...extra };
  });
}

const published = [
  ...photos("it-1", "2025-06-29", 4),
  ...photos("tr-1", "2024-05-16", 3),
  ...photos("tr-2", "2024-05-17", 3),
  ...photos("tr-1", "2024-05-19", 2),
  ...photos("in-1", "2024-05-21", 3),
  ...photos("in-2", "2024-05-22", 1),
  ...photos("in-1", "2024-05-28", 1),
  ...photos("it-1", "2025-07-06", 1),
];

test("trips split after a week without photos and visits keep their order", async () => {
  const { buildTravelLog } = await load();
  const { trips, years } = buildTravelLog(published, map);
  assert.deepEqual(trips.map((trip) => [trip.start, trip.end, trip.days, trip.photoCount]), [["2024-05-16", "2024-05-28", 13, 13], ["2025-06-29", "2025-07-06", 8, 5]]);
  assert.deepEqual(years, [2024, 2025]);
  assert.deepEqual(trips[0].countries, ["TR", "IN"]);
  assert.deepEqual(trips[0].visits.map((visit) => [visit.placeId, visit.number]), [
    ["tr-1", 1], ["tr-2", 2], ["tr-1", 1], ["in-1", 3], ["in-2", null], ["in-1", 3],
  ], "revisits reuse a number; waypoints have none");
  assert.deepEqual(trips[1].visits.map((visit) => [visit.placeId, visit.start, visit.end, visit.photoCount]), [["it-1", "2025-06-29", "2025-07-06", 5]]);
});

test("places summarise their visits and drop when nothing published is there", async () => {
  const { buildTravelLog } = await load();
  const { places } = buildTravelLog([...published, { id: "unmapped", date: "2024-05-20" }, ...photos("tr-1", "not-a-date", 1)], map);
  const byId = Object.fromEntries(places.map((place) => [place.id, place]));
  assert.equal(byId["kr-1"], undefined);
  assert.deepEqual(byId["tr-1"].visits, [{ start: "2024-05-16", end: "2024-05-16" }, { start: "2024-05-19", end: "2024-05-19" }]);
  assert.equal(byId["tr-1"].photoCount, 5);
  assert.equal(byId["in-2"].main, false);
  assert.deepEqual(byId["it-1"].years, [2025]);
});

test("each place carries a few photos, favourites first", async () => {
  const { buildTravelLog } = await load();
  const many = [...photos("kr-1", "2026-09-10", 9), ...photos("kr-1", "2026-09-11", 1, { favorite: "true" })];
  const { places } = buildTravelLog(many, map, { photosPerPlace: 4 });
  const ids = places[0].photos.map((photo) => photo.id);
  assert.equal(ids.length, 4);
  assert.ok(ids.includes(many.at(-1).id));
  assert.equal(new Set(ids).size, 4);
});

test("dates read naturally in Japanese", async () => {
  const { formatRange, tripTitle } = await load();
  assert.equal(formatRange("2024-05-16", "2024-06-18"), "2024/05/16 – 06/18");
  assert.equal(formatRange("2025-12-27", "2026-01-02"), "2025/12/27 – 2026/01/02");
  assert.equal(formatRange("2025-06-30", "2025-06-30"), "2025/06/30");
  assert.equal(tripTitle({ start: "2024-05-16", end: "2024-06-18" }), "2024年5月〜6月");
  assert.equal(tripTitle({ start: "2025-12-27", end: "2026-01-02" }), "2025年12月〜2026年1月");
  assert.equal(tripTitle({ start: "2024-11-13", end: "2024-11-19" }), "2024年11月");
});

test("the three latest years get their own colour and older years share one", async () => {
  const { yearTone, yearLegend } = await load();
  assert.deepEqual([2024, 2025, 2026].map((year) => yearTone([2024, 2025, 2026], year)), [2, 1, 0]);
  assert.deepEqual(yearLegend([2024, 2025, 2026]).map((item) => item.label), ["2024", "2025", "2026"]);
  const years = [2023, 2024, 2026, 2027, 2028];
  assert.deepEqual(years.map((year) => yearTone(years, year)), [3, 3, 2, 1, 0], "gaps between years do not matter");
  assert.deepEqual(yearLegend(years), [
    { label: "〜2024", tone: 3 }, { label: "2026", tone: 2 }, { label: "2027", tone: 1 }, { label: "2028", tone: 0 },
  ]);
});
