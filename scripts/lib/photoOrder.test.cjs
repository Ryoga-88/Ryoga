const test = require("node:test");
const assert = require("node:assert/strict");

const load = () => import("../../app/lib/photo-order.mjs");
const ids = (photos) => photos.map((photo) => photo.id);

test("photos with and without capture times sort oldest first without mutating photos or country order", async () => {
  const { sortPhotosByCaptureDate } = await load();
  const photos = Object.freeze([
    Object.freeze({ id: "apple-latest", category: "Georgia", date: "2025-03-01", capturedAt: "2025-03-01T09:00:00Z" }),
    Object.freeze({ id: "date-only-first", category: "Turkey", date: "2024-05-16" }),
    Object.freeze({ id: "apple-oldest", category: "Georgia", date: "2023-12-31", capturedAt: "2023-12-31T23:00:00Z" }),
    Object.freeze({ id: "date-only-second", category: "Turkey", date: "2024-05-16" }),
  ]);

  const sorted = sortPhotosByCaptureDate(photos);
  assert.deepEqual(ids(sorted), ["apple-oldest", "date-only-first", "date-only-second", "apple-latest"]);
  assert.deepEqual(ids(photos), ["apple-latest", "date-only-first", "apple-oldest", "date-only-second"]);
  assert.deepEqual([...new Set(photos.map((photo) => photo.category))], ["Georgia", "Turkey"]);
  assert.strictEqual(sorted[0], photos[2], "sorting preserves photo objects");
  assert.deepEqual(ids(sortPhotosByCaptureDate(photos.filter((photo) => photo.category === "Georgia"))), ["apple-oldest", "apple-latest"]);
});

test("local date takes priority even when UTC timestamps fall on another day", async () => {
  const { sortPhotosByCaptureDate } = await load();
  const photos = [
    { id: "later-local-day", date: "2024-06-02", capturedAt: "2024-06-01T20:00:00Z" },
    { id: "earlier-local-day", date: "2024-06-01", capturedAt: "2024-06-02T01:00:00Z" },
  ];
  assert.deepEqual(ids(sortPhotosByCaptureDate(photos)), ["earlier-local-day", "later-local-day"]);
});

test("same-day known times sort chronologically before stable unknown times", async () => {
  const { sortPhotosByCaptureDate } = await load();
  const photos = [
    { id: "unknown-first", date: "2024-05-16" },
    { id: "late", date: "2024-05-16", capturedAt: "2024-05-16T12:00:00Z" },
    { id: "invalid", date: "2024-05-16", capturedAt: "invalid" },
    { id: "early", date: "2024-05-16", capturedAt: "2024-05-16T09:00:00+02:00" },
    { id: "same-time", date: "2024-05-16", capturedAt: "2024-05-16T07:00:00Z" },
    { id: "unknown-last", date: "2024-05-16", capturedAt: null },
  ];
  const expected = ["early", "same-time", "late", "unknown-first", "invalid", "unknown-last"];
  assert.deepEqual(ids(sortPhotosByCaptureDate(photos)), expected);
  assert.deepEqual(ids(sortPhotosByCaptureDate(sortPhotosByCaptureDate(photos))), expected);
});

test("unknown and invalid dates remain last in source order without inferring dates", async () => {
  const { sortPhotosByCaptureDate } = await load();
  const photos = [
    { id: "missing", capturedAt: "2020-01-01T00:00:00Z" },
    { id: "impossible-day", date: "2024-02-30" },
    { id: "known", date: "2024-02-29" },
    { id: "wrong-format", date: "2024/01/01" },
    { id: "empty", date: "" },
  ];
  assert.deepEqual(ids(sortPhotosByCaptureDate(photos)), ["known", "missing", "impossible-day", "wrong-format", "empty"]);
});

test("date-only, timezone-less, and impossible captured times are treated as unknown", async () => {
  const { sortPhotosByCaptureDate } = await load();
  const photos = [
    { id: "date-only", date: "2024-03-01", capturedAt: "2024-03-01" },
    { id: "no-zone", date: "2024-03-01", capturedAt: "2024-03-01T01:00:00" },
    { id: "impossible-day", date: "2024-03-01", capturedAt: "2024-02-30T01:00:00Z" },
    { id: "known", date: "2024-03-01", capturedAt: "2024-03-01T09:00:00.100Z" },
    { id: "impossible-hour", date: "2024-03-01", capturedAt: "2024-03-01T25:00:00Z" },
  ];
  assert.deepEqual(ids(sortPhotosByCaptureDate(photos)), ["known", "date-only", "no-zone", "impossible-day", "impossible-hour"]);
});

test("interleaved unknown times cannot prevent ordering known times", async () => {
  const { sortPhotosByCaptureDate } = await load();
  const early = { id: "early", date: "2024-05-16", capturedAt: "2024-05-16T07:00:00Z" };
  const late = { id: "late", date: "2024-05-16", capturedAt: "2024-05-16T18:00:00Z" };
  const unknown = { id: "unknown", date: "2024-05-16" };
  for (const photos of [[early, late, unknown], [early, unknown, late], [late, early, unknown], [late, unknown, early], [unknown, early, late], [unknown, late, early]]) {
    assert.deepEqual(ids(sortPhotosByCaptureDate(photos)), ["early", "late", "unknown"]);
  }
});
