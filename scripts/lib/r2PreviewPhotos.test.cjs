const test = require("node:test");
const assert = require("node:assert/strict");
const { previewPhotos } = require("./r2PreviewPhotos.cjs");

const origin = "https://synthetic-r2.example.workers.dev";
const id = (number) => `00000000-0000-4000-8000-${number.toString(16).padStart(12, "0")}`;
const fullHash = "a".repeat(64);
const thumbHash = "b".repeat(64);
function fixtures() {
  const trial = {
    version: 1,
    photos: [1, 2, 3].map((number) => ({
      id: id(number), title: "Trial", category: "Thailand", date: "2026-01-01", width: 552, height: 414,
      url: `${origin}/photos/${id(number)}.webp`, thumbnail: `${origin}/photos/${id(number)}-thumb.webp`,
    })),
  };
  const curated = {
    version: 1, decisions: Object.fromEntries([1, 2, 3, 4].map((number) => [id(number), "included"])),
    photos: [1, 2, 3, 4].map((number) => ({
      id: id(number), title: "Published", category: "Thailand", countryCode: "TH", date: "2026-01-01", width: 2400, height: 1800,
      url: `${origin}/photos/${id(number)}/${fullHash}/full.webp`, thumbnail: `${origin}/photos/${id(number)}/${thumbHash}/thumb.webp`,
      locationLabel: "Bangkok", capturedAt: "2026-01-01T03:04:05Z", latitude: 13.1234, originalPath: "/private/synthetic/original.jpg",
    })),
  };
  return { trial, curated };
}

test("the same three trial IDs use latest verified-host delivery URLs, dimensions and safe metadata", () => {
  const { trial, curated } = fixtures();
  const original = structuredClone({ trial, curated });
  const photos = previewPhotos(trial, curated);
  assert.deepEqual(photos.map((photo) => photo.id), [1, 2, 3].map(id));
  for (let index = 0; index < photos.length; index += 1) {
    assert.equal(photos[index].url, curated.photos[index].url);
    assert.equal(photos[index].thumbnail, curated.photos[index].thumbnail);
    assert.deepEqual([photos[index].width, photos[index].height, photos[index].aspect], [2400, 1800, "2400 / 1800"]);
    assert.equal(photos[index].locationLabel, "Bangkok");
    assert.equal(photos[index].capturedAt, "2026-01-01T03:04:05Z");
    assert.equal(photos[index].countryCode, "TH");
    assert.ok(!("latitude" in photos[index]));
    assert.ok(!("originalPath" in photos[index]));
  }
  assert.deepEqual({ trial, curated }, original, "inputs stay unchanged");
});

test("legacy delivery and versioned trial URLs are supported", () => {
  const { trial, curated } = fixtures();
  curated.photos[0].url = trial.photos[0].url;
  curated.photos[0].thumbnail = trial.photos[0].thumbnail;
  trial.photos[1].url = curated.photos[1].url;
  trial.photos[1].thumbnail = curated.photos[1].thumbnail;
  const photos = previewPhotos(trial, curated);
  assert.equal(photos[0].url, trial.photos[0].url);
  assert.equal(photos[0].width, 2400);
  assert.equal(photos[1].url, curated.photos[1].url);
});

test("unsafe or incomplete current pairs retain both original trial URLs and dimensions", async (t) => {
  const invalidPairs = [
    { url: `https://different.example.workers.dev/photos/${id(1)}/${fullHash}/full.webp` },
    { thumbnail: `https://different.example.workers.dev/photos/${id(1)}/${thumbHash}/thumb.webp` },
    { url: `/images/photos/${id(1)}.webp` },
    { url: `${origin}/photos/${id(2)}/${fullHash}/full.webp` },
    { url: `${origin}/photos/${id(1)}/abcd/full.webp` },
    { url: `${origin}/photos/${id(1)}/${fullHash}/thumb.webp` },
    { url: `${origin}/photos/${id(1)}/${fullHash}/full.webp?private=true` },
    { url: `${origin}/photos/${id(1)}/${fullHash}/full.webp#fragment` },
    { url: `http://synthetic-r2.example.workers.dev/photos/${id(1)}/${fullHash}/full.webp` },
    { url: `https://user:secret@synthetic-r2.example.workers.dev/photos/${id(1)}/${fullHash}/full.webp` },
    { url: `${origin}/photos/${id(1)}/${fullHash}/fullXwebp` },
    { url: `${origin}/photos/${id(1)}/%61${fullHash.slice(1)}/full.webp` },
    { width: 0 }, { height: 1.5 }, { thumbnail: undefined },
  ];
  for (const [index, update] of invalidPairs.entries()) {
    await t.test(`invalid pair ${index + 1}`, () => {
      const { trial, curated } = fixtures();
      Object.assign(curated.photos[0], update);
      const [photo] = previewPhotos(trial, curated);
      assert.equal(photo.url, trial.photos[0].url);
      assert.equal(photo.thumbnail, trial.photos[0].thumbnail);
      assert.equal(photo.width, 552);
      assert.equal(photo.height, 414);
    });
  }
});

test("deselected or removed trial photos disappear without selecting other uploaded photos", () => {
  const { trial, curated } = fixtures();
  curated.decisions[id(1)] = "excluded";
  curated.photos = curated.photos.filter((photo) => photo.id !== id(2));
  assert.deepEqual(previewPhotos(trial, curated).map((photo) => photo.id), [id(3)]);
});

test("the private preview manifest must have consistent hosts, original UUID paths and at most three IDs", () => {
  for (const change of [
    (trial) => { trial.photos[1].url = trial.photos[1].url.replace(origin, "https://other.example.workers.dev"); },
    (trial) => { trial.photos[0].thumbnail = trial.photos[0].thumbnail.replace(origin, "https://other.example.workers.dev"); },
    (trial) => { trial.photos[0].url = trial.photos[0].url.replace(id(1), id(2)); },
    (trial) => { trial.photos[1] = trial.photos[0]; },
    (trial) => { trial.photos.push(trial.photos[0]); },
  ]) {
    const { trial, curated } = fixtures();
    change(trial);
    assert.throws(() => previewPhotos(trial, curated));
  }
});
