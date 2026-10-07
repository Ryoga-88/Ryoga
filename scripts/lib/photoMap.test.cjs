const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { buildPhotoMap, writePhotoMap, checkPhotoMap, MAP_PATH } = require("./photoMap.cjs");

const id = (number) => `00000000-0000-4000-8000-${number.toString(16).padStart(12, "0")}`;
let counter = 0;

// One catalog entry plus its published counterpart. Coordinates are offsets in degrees.
function shot({ country = "TH", title = "タイ", lat, lng, label, at, publish = true }) {
  counter += 1;
  const photoId = id(counter);
  return {
    catalog: { id: photoId, countryCode: country, title, latitude: lat, longitude: lng, locationLabel: label, capturedAt: at, filename: "IMG_0001.HEIC", originalPath: "/Users/private/original.heic" },
    published: publish ? { id: photoId, countryCode: country, title, category: "Thailand", date: at.slice(0, 10), capturedAt: at } : null,
  };
}

function build(shots) {
  return buildPhotoMap(shots.map((item) => item.catalog), shots.map((item) => item.published).filter(Boolean));
}

const bangkok = (n, at, label = "バンコク・เขตพระนคร") => Array.from({ length: n }, (_, index) =>
  shot({ lat: 13.7563 + index * 0.01, lng: 100.5018 - index * 0.01, label: index % 2 ? "バンコク・เขตบางรัก" : label, at: `${at}T0${index}:00:00Z` }));

test("only rounded place centres and photo assignments are published", () => {
  const shots = [...bangkok(4, "2024-06-08"), shot({ lat: 18.7883, lng: 98.9853, label: "チェンマイ・チエンマイ", at: "2024-06-10T01:00:00Z" })];
  const map = build(shots);
  assert.deepEqual(Object.keys(map), ["version", "places", "photos"]);
  for (const place of map.places) {
    assert.deepEqual(Object.keys(place), ["id", "countryCode", "name", "lat", "lng"]);
    for (const value of [place.lat, place.lng]) assert.ok(Math.abs(value / 0.05 - Math.round(value / 0.05)) < 1e-9, `${value} is on the 0.05° grid`);
  }
  const json = JSON.stringify(map);
  for (const secret of ["13.7563", "100.5018", "98.9853", "IMG_0001", "private", "เขต"]) assert.ok(!json.includes(secret), secret);
  assert.equal(Object.keys(map.photos).length, shots.length);
});

test("unpublished, unlocated and undated photos stay off the map", () => {
  const shots = [
    ...bangkok(3, "2024-06-08"),
    shot({ lat: 18.79, lng: 98.98, label: "チェンマイ", at: "2024-06-10T01:00:00Z", publish: false }),
    shot({ lat: null, lng: null, label: "チェンマイ", at: "2024-06-10T02:00:00Z" }),
    shot({ lat: 0, lng: 0, label: null, at: "2024-06-10T03:00:00Z" }),
  ];
  const map = build(shots);
  assert.deepEqual(map.places.map((place) => place.name), ["バンコク"]);
  assert.equal(Object.keys(map.photos).length, 3);
});

test("stays become places; revisits and nearby airports join the main place", () => {
  const shots = [
    shot({ lat: 13.69, lng: 100.75, label: "サムットプラカーン", at: "2024-06-08T00:00:00Z" }), // airport, about 28 km out
    ...bangkok(4, "2024-06-08"),
    shot({ lat: 14.3532, lng: 100.5689, label: "アユタヤ", at: "2024-06-09T01:00:00Z" }),
    shot({ lat: 14.3600, lng: 100.5700, label: "アユタヤ", at: "2024-06-09T02:00:00Z" }),
    shot({ lat: 14.3500, lng: 100.5600, label: "アユタヤ", at: "2024-06-09T03:00:00Z" }),
    ...bangkok(3, "2024-06-10"),
  ];
  const map = build(shots);
  assert.deepEqual(map.places.map((place) => [place.id, place.name]), [["th-1", "バンコク"], ["th-2", "アユタヤ"]]);
  assert.equal(map.photos[shots[0].catalog.id], "th-1");
  assert.equal(Object.values(map.photos).filter((place) => place === "th-1").length, 8);
  const bangkokPlace = map.places[0];
  assert.ok(Math.abs(bangkokPlace.lng - 100.5) < 0.06, "the airport does not pull the city centre");
});

test("places are named from labels, preferring the region when districts vary", () => {
  const shots = [
    ...bangkok(4, "2024-06-08"),
    ...["2025-06-29", "2025-06-30", "2025-07-01"].map((day) => shot({ country: "IT", title: "イタリア", lat: 41.9, lng: 12.5, label: "ラツィオ・ローマ", at: `${day}T08:00:00Z` })),
    ...[1, 2, 3].map((hour) => shot({ country: "VA", title: "バチカン", lat: 41.9022, lng: 12.4539, label: null, at: `2025-06-30T0${hour}:00:00Z` })),
    ...[1, 2, 3].map((hour) => shot({ country: "IN", title: "インド", lat: 27.17, lng: 78.04, label: "ウッタルプラデーシュ・Agra", at: `2024-05-22T0${hour}:00:00Z` })),
  ];
  const names = Object.fromEntries(build(shots).places.map((place) => [place.countryCode, place.name]));
  assert.deepEqual(names, { IN: "アーグラ", TH: "バンコク", IT: "ローマ", VA: "バチカン" }, "Vatican stays separate from Rome");
});

test("a second place with the same name becomes the outskirts", () => {
  const shots = [
    ...[1, 2, 3, 4].map((hour) => shot({ lat: 18.79, lng: 98.98, label: "チェンマイ・チエンマイ", at: `2024-11-16T0${hour}:00:00Z` })),
    ...[1, 2, 3].map((hour) => shot({ lat: 18.77, lng: 99.30, label: "チェンマイ・อ.แม่ออน", at: `2024-11-17T0${hour}:00:00Z` })),
  ];
  assert.deepEqual(build(shots).places.map((place) => place.name), ["チェンマイ", "チェンマイ近郊"]);
});

test("output is deterministic and written atomically", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ryoga-photo-map-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const shots = bangkok(3, "2024-06-08");
  const catalog = shots.map((item) => item.catalog);
  const published = shots.map((item) => item.published);
  await writePhotoMap(root, catalog, published);
  const first = await fs.readFile(path.join(root, MAP_PATH), "utf8");
  await writePhotoMap(root, [...catalog].reverse(), [...published].reverse());
  assert.equal(await fs.readFile(path.join(root, MAP_PATH), "utf8"), first);
  assert.deepEqual(await fs.readdir(path.dirname(path.join(root, MAP_PATH))), ["photo-map.json"]);
});

test("the check reports a map that misses newly published photos", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ryoga-photo-map-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const shots = bangkok(3, "2024-06-08");
  const later = [...shots, shot({ lat: 18.79, lng: 98.98, label: "チェンマイ", at: "2024-06-10T01:00:00Z" }), shot({ lat: null, lng: null, label: null, at: "2024-06-10T02:00:00Z" })];
  const catalog = later.map((item) => item.catalog);
  assert.deepEqual(await checkPhotoMap(root, catalog, shots.map((item) => item.published)), { current: false, unmapped: 3, unlocated: 0 }, "no map yet");
  await writePhotoMap(root, catalog, shots.map((item) => item.published));
  assert.equal((await checkPhotoMap(root, catalog, shots.map((item) => item.published))).current, true);
  const published = later.map((item) => item.published);
  assert.deepEqual(await checkPhotoMap(root, catalog, published), { current: false, unmapped: 2, unlocated: 1 });
  await writePhotoMap(root, catalog, published);
  assert.deepEqual(await checkPhotoMap(root, catalog, published), { current: true, unmapped: 1, unlocated: 1 }, "photos without GPS stay off the map");
  const renamed = published.map((photo) => ({ ...photo, url: `https://r2.example/${photo.id}.webp` }));
  assert.equal((await checkPhotoMap(root, catalog, renamed)).current, true, "a new image URL needs no rebuild");
});
