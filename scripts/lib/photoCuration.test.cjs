const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const sharp = require("sharp");
const { createStore, localAccessAllowed } = require("./photoCuration.cjs");
const { refreshHighResolutionPhotos } = require("./photoHighResolution.cjs");

const id = (number) => `00000000-0000-4000-8000-${number.toString(16).padStart(12, "0")}`;

async function fixture(t, overrides = [{}, {}, {}]) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ryoga-photo-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const library = path.join(root, "synthetic.photoslibrary");
  const catalogPath = path.join(root, ".local", "photos", "catalog.json");
  const manifestPath = path.join(root, "app", "contents", "curated-photos.json");
  const publishedDir = path.join(root, "public", "images", "photos");
  await fs.mkdir(library, { recursive: true });
  const png = path.join(library, "synthetic.png");
  const jpeg = path.join(library, "synthetic.jpg");
  await sharp({ create: { width: 640, height: 480, channels: 3, background: "#729abb" } }).png().toFile(png);
  await sharp(png).withMetadata({ orientation: 6 }).jpeg().toFile(jpeg);
  const photos = overrides.map((override, index) => ({
    id: id(index + 1), title: "タイ", category: "Thailand", countryCode: "TH",
    capturedAt: "2024-01-02T03:04:05Z", date: "2024-01-02", width: 640, height: 480,
    favorite: false, available: true, hasEdits: false,
    latitude: 13.123456, longitude: 100.654321, filename: "private-original.jpg",
    previewPath: png, originalPath: index % 2 ? jpeg : png, renderPath: null,
    ...override,
  }));
  const catalog = { version: 1, importedAt: "2026-01-01T00:00:00Z", sourceLibrary: library, photos };
  const writeCatalog = async () => {
    await fs.mkdir(path.dirname(catalogPath), { recursive: true });
    await fs.writeFile(catalogPath, JSON.stringify(catalog));
  };
  await writeCatalog();
  const store = createStore(root);
  const assetPaths = (photoId) => [path.join(publishedDir, `${photoId}.webp`), path.join(publishedDir, `${photoId}-thumb.webp`)];
  return { root, library, png, jpeg, photos, catalog, catalogPath, manifestPath, publishedDir, store, writeCatalog, assetPaths };
}

function allKeys(value) {
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => [key, ...allKeys(child)]);
}

test("local access requires opt-in development, a loopback host, and same-origin requests", () => {
  const env = { NODE_ENV: "development", PHOTO_CURATION: "1" };
  const allowed = (values = {}, options = {}) => localAccessAllowed(new Headers({ host: "localhost:3000", ...values }), { env, ...options });
  assert.equal(allowed(), true);
  for (const host of ["localhost", "127.0.0.1:3000", "[::1]:3000"]) assert.equal(allowed({ host }), true, host);
  for (const host of ["ryoga.io", "192.168.1.10:3000", "localhost.evil.test:3000", "evil.test:3000", "localhost:3000@evil.test", ""]) assert.equal(allowed({ host }), false, host);
  for (const otherEnv of [{}, { NODE_ENV: "development" }, { NODE_ENV: "production", PHOTO_CURATION: "1" }, { NODE_ENV: "test", PHOTO_CURATION: "1" }]) assert.equal(allowed({}, { env: otherEnv }), false);
  assert.equal(allowed({ "x-forwarded-host": "evil.test" }), false);
  assert.equal(allowed({ "x-forwarded-host": "localhost:3000" }), true);
  assert.equal(allowed({ "sec-fetch-site": "cross-site" }), false);
  assert.equal(allowed({ "sec-fetch-site": "same-site" }), false);
  assert.equal(allowed({ origin: "https://evil.test" }), false);
  assert.equal(allowed({ origin: "null" }), false);
  assert.equal(allowed({}, { mutation: true }), false);
  assert.equal(allowed({ origin: "http://localhost:3000", "sec-fetch-site": "same-origin" }, { mutation: true }), true);
  assert.equal(allowed({ origin: "http://localhost:3001" }, { mutation: true }), false);
  assert.equal(allowed({ origin: "http://127.0.0.1:3000" }, { mutation: true }), false);
});

test("external links may navigate to the curator without relaxing API, image, iframe or mutation access", () => {
  const env = { NODE_ENV: "development", PHOTO_CURATION: "1" };
  const navigationHeaders = {
    host: "localhost:3000", "sec-fetch-site": "cross-site",
    "sec-fetch-mode": "navigate", "sec-fetch-dest": "document",
  };
  const allowed = (changes = {}, options = { navigation: true }) => localAccessAllowed(new Headers({ ...navigationHeaders, ...changes }), { env, ...options });
  assert.equal(allowed(), true, "a link from ChatGPT can open the page");
  assert.equal(allowed({}, {}), false, "API and image handlers do not opt into navigation");
  assert.equal(allowed({}, { navigation: true, mutation: true }), false);
  assert.equal(allowed({ origin: "http://localhost:3000" }, { navigation: true, mutation: true }), false);
  for (const destination of ["iframe", "image", "empty", ""]) assert.equal(allowed({ "sec-fetch-dest": destination }), false, destination);
  for (const mode of ["cors", "no-cors", "same-origin", ""]) assert.equal(allowed({ "sec-fetch-mode": mode }), false, mode);
  assert.equal(allowed({ origin: "https://evil.test" }), false);
  assert.equal(allowed({ host: "ryoga.io" }), false);
  assert.equal(allowed({}, { navigation: true, env: { NODE_ENV: "production", PHOTO_CURATION: "1" } }), false);
  assert.equal(allowed({}, { navigation: true, env: { NODE_ENV: "development" } }), false);
});

test("only eligible countries enter the client catalog, and private paths and coordinates stay private", async (t) => {
  const fixtureData = await fixture(t, [{}, { countryCode: "IT" }, { countryCode: "CN" }, { countryCode: "ES" }, { countryCode: "AL" }, { countryCode: "JP" }, { countryCode: null }, { id: "../private.jpg" }]);
  const data = await fixtureData.store.clientData();
  assert.deepEqual(data.photos.map((photo) => photo.id), [id(1), id(2)]);
  assert.equal(data.publishedCount, 0);
  assert.ok(data.photos.every((photo) => photo.status === "unreviewed"));
  const keys = new Set(allKeys(data));
  for (const key of ["sourceLibrary", "previewPath", "originalPath", "renderPath", "filename", "latitude", "longitude"]) assert.equal(keys.has(key), false, key);
  assert.equal(JSON.stringify(data).includes(fixtureData.root), false);
});

test("decisions and publication survive a new store and a catalog reimport", async (t) => {
  const f = await fixture(t);
  await f.store.decide([id(1)], "included");
  await f.store.decide([id(2)], "excluded");
  f.catalog.importedAt = "2026-02-01T00:00:00Z";
  f.catalog.photos.push({ ...f.photos[0], id: id(4), date: "2025-01-01" });
  await f.writeCatalog();
  const reopened = createStore(f.root);
  const data = await reopened.clientData();
  assert.equal(data.publishedCount, 1);
  assert.deepEqual(data.photos.map((photo) => [photo.id, photo.status]), [[id(1), "included"], [id(2), "excluded"], [id(3), "unreviewed"], [id(4), "unreviewed"]]);
  const saved = await reopened.state();
  assert.deepEqual(saved.photos.map((photo) => photo.id), [id(1)]);
  assert.equal(JSON.stringify(saved).includes(f.library), false);
  for (const key of ["latitude", "longitude", "filename", "previewPath", "originalPath"]) assert.equal(allKeys(saved).includes(key), false);
  for (const filename of f.assetPaths(id(1))) assert.ok((await fs.stat(filename)).size > 0);
});

test("previews and published copies are resized WebP with metadata removed and orientation applied", async (t) => {
  const f = await fixture(t);
  assert.ok((await sharp(f.jpeg).metadata()).exif);
  const preview = await sharp(await f.store.preview(id(1), "thumb")).metadata();
  assert.equal(preview.format, "webp");
  assert.deepEqual([preview.width, preview.height], [500, 375]);
  await f.store.decide([id(2)], "included");
  const published = await sharp(f.assetPaths(id(2))[0]).metadata();
  assert.equal(published.format, "webp");
  assert.deepEqual([published.width, published.height], [480, 640]);
  assert.equal(published.exif, undefined);
  assert.equal(published.icc, undefined);
  assert.equal(published.orientation, undefined);
  const thumbnail = await sharp(f.assetPaths(id(2))[1]).metadata();
  assert.deepEqual([thumbnail.width, thumbnail.height], [375, 500]);
});

test("publication retains broad places and capture times without copying private location fields", async (t) => {
  const f = await fixture(t, [{ locationLabel: "京畿道", street: "private street", postalCode: "private code" }]);
  await f.store.decide([id(1)], "included");
  const saved = await f.store.state();
  assert.equal(saved.photos[0].locationLabel, "京畿道");
  assert.equal(saved.photos[0].capturedAt, "2024-01-02T03:04:05Z");
  assert.equal((await f.store.clientData()).photos[0].locationLabel, "京畿道");
  for (const key of ["street", "postalCode", "latitude", "longitude", "filename", "originalPath"]) {
    assert.equal(allKeys(saved).includes(key), false, key);
  }
});

test("quality status follows saved publication dimensions and clears when excluded or reset", async (t) => {
  const f = await fixture(t, [{ width: 4032, height: 3024 }]);
  assert.equal((await f.store.clientData()).photos[0].highResolutionPending, false);
  const included = await f.store.decide([id(1)], "included");
  assert.deepEqual(included.highResolutionPending, { [id(1)]: true });
  assert.equal((await f.store.clientData()).photos[0].highResolutionPending, true, "large catalog dimensions do not hide a tiny saved image");
  const excluded = await f.store.decide([id(1)], "excluded");
  assert.deepEqual(excluded.highResolutionPending, { [id(1)]: false });
  assert.equal((await f.store.clientData()).photos[0].highResolutionPending, false);
  const reset = await f.store.decide([id(1)], "unreviewed");
  assert.deepEqual(reset.highResolutionPending, { [id(1)]: false });
});

test("refresh clears the quality badge, and re-inclusion preserves the recovered edited rendition", async (t) => {
  const f = await fixture(t, [{ hasEdits: true }]);
  f.catalog.photos[0].renderPath = f.png;
  await f.writeCatalog();
  await f.store.decide([id(1)], "included");
  assert.equal((await f.store.clientData()).photos[0].highResolutionPending, true);
  const exportDirectory = path.join(f.root, ".local/photos/high-resolution");
  await fs.mkdir(exportDirectory, { recursive: true });
  const fileName = `${id(1)}.jpg`;
  await sharp({ create: { width: 3200, height: 1800, channels: 3, background: "#e32010" } })
    .withMetadata({ orientation: 6 }).jpeg().toFile(path.join(exportDirectory, fileName));
  await fs.writeFile(path.join(exportDirectory, "export-results.json"), JSON.stringify({
    version: 1, photos: [{ id: id(1), status: "exported", fileName, width: 3200, height: 1800, modifiedAt: "2026-01-01T00:00:00Z" }],
  }));
  assert.equal((await refreshHighResolutionPhotos(f.root, { write: true })).upgraded, 1);
  assert.equal((await f.store.clientData()).photos[0].highResolutionPending, false);
  await f.store.decide([id(1)], "excluded");
  const reopened = createStore(f.root);
  const saved = await reopened.decide([id(1)], "included");
  assert.deepEqual(saved.highResolutionPending, { [id(1)]: false });
  const full = await sharp(f.assetPaths(id(1))[0]).metadata();
  assert.deepEqual([full.width, full.height], [1350, 2400]);
  assert.equal(full.exif, undefined);
  assert.equal(full.orientation, undefined);
  const stats = await sharp(f.assetPaths(id(1))[0]).stats();
  assert.ok(stats.channels[0].mean > stats.channels[2].mean * 3, "recovered edited red pixels take precedence over the old blue render");
  const serialized = JSON.stringify(await reopened.state());
  for (const privateValue of [exportDirectory, "fileName", "modifiedAt"]) assert.equal(serialized.includes(privateValue), false);
});

test("excluding and resetting a published photo remove both public copies", async (t) => {
  const f = await fixture(t);
  for (const status of ["excluded", "unreviewed"]) {
    await f.store.decide([id(1)], "included");
    await f.store.decide([id(1)], status);
    const saved = await f.store.state();
    assert.deepEqual(saved.photos, []);
    assert.equal(saved.decisions[id(1)], status === "unreviewed" ? undefined : status);
    for (const filename of f.assetPaths(id(1))) await assert.rejects(fs.stat(filename), { code: "ENOENT" });
    assert.equal((await createStore(f.root).clientData()).photos[0].status, status);
  }
});

test("invalid IDs, unknown IDs, invalid status, oversized batches and invalid preview sizes are rejected", async (t) => {
  const f = await fixture(t);
  for (const ids of [null, [], ["../../private"], [null], [id(99)], Array(121).fill(id(1))]) await assert.rejects(f.store.decide(ids, "included"), { status: 400 });
  await assert.rejects(f.store.decide([id(1)], "published"), { status: 400 });
  await assert.rejects(f.store.preview("../../private", "thumb"), { status: 404 });
  await assert.rejects(f.store.preview(id(99), "thumb"), { status: 404 });
  await assert.rejects(f.store.preview(id(1), "original"), { status: 400 });
  assert.deepEqual(await f.store.state(), { version: 1, decisions: {}, photos: [] });
  await assert.rejects(fs.stat(f.publishedDir), { code: "ENOENT" });
});

test("source paths and symlinks cannot escape the configured library", async (t) => {
  const f = await fixture(t);
  const outside = path.join(f.root, "outside.png");
  const symlink = path.join(f.library, "escape.png");
  await fs.copyFile(f.png, outside);
  await fs.symlink(outside, symlink);
  f.catalog.photos[0].previewPath = outside;
  f.catalog.photos[0].originalPath = outside;
  f.catalog.photos[1].previewPath = symlink;
  f.catalog.photos[1].originalPath = symlink;
  await f.writeCatalog();
  const reopened = createStore(f.root);
  for (const photoId of [id(1), id(2)]) {
    await assert.rejects(reopened.preview(photoId, "thumb"), { status: 403 });
    await assert.rejects(reopened.decide([photoId], "included"), { status: 403 });
  }
  assert.deepEqual((await reopened.state()).photos, []);
});

test("concurrent decisions on the shared store are serialized without lost updates", async (t) => {
  const f = await fixture(t);
  await Promise.all([f.store.decide([id(1)], "included"), f.store.decide([id(2)], "included"), f.store.decide([id(3)], "excluded")]);
  const saved = await f.store.state();
  assert.deepEqual(saved.decisions, { [id(1)]: "included", [id(2)]: "included", [id(3)]: "excluded" });
  assert.deepEqual(saved.photos.map((photo) => photo.id), [id(1), id(2)]);
  await Promise.all([f.store.decide([id(1)], "excluded"), f.store.decide([id(1)], "included")]);
  assert.equal((await f.store.state()).decisions[id(1)], "included");
  for (const filename of f.assetPaths(id(1))) assert.ok((await fs.stat(filename)).size > 0);
});

test("photos without a capture date can be published alongside dated photos", async (t) => {
  const f = await fixture(t, [{ capturedAt: null, date: null }, { date: "2025-03-04" }, { date: "2024-01-02" }]);
  await f.store.decide([id(1), id(2), id(3)], "included");
  const saved = await f.store.state();
  assert.deepEqual(saved.photos.map((photo) => photo.id), [id(2), id(3), id(1)]);
  assert.ok((await f.store.clientData()).photos.every((photo) => photo.status === "included"));
});

test("a failed image in a batch rolls back new copies and keeps the previous manifest byte-for-byte", async (t) => {
  const f = await fixture(t);
  await f.store.decide([id(3)], "included");
  const before = await fs.readFile(f.manifestPath, "utf8");
  const broken = path.join(f.library, "broken.png");
  await fs.writeFile(broken, "not an image");
  f.catalog.photos[1].originalPath = broken;
  await f.writeCatalog();
  const reopened = createStore(f.root);
  await assert.rejects(reopened.decide([id(1), id(2)], "included"));
  assert.equal(await fs.readFile(f.manifestPath, "utf8"), before);
  for (const filename of f.assetPaths(id(1))) await assert.rejects(fs.stat(filename), { code: "ENOENT" });
  for (const filename of f.assetPaths(id(3))) assert.ok((await fs.stat(filename)).size > 0);
  await reopened.decide([id(1)], "excluded");
  assert.equal((await reopened.state()).decisions[id(1)], "excluded", "the queue recovers after failure");
});

test("a failed atomic manifest commit removes staged copies and keeps existing decisions", async (t) => {
  const f = await fixture(t);
  await f.store.decide([id(3)], "included");
  const before = await fs.readFile(f.manifestPath, "utf8");
  const rename = fs.rename;
  const mock = t.mock.method(fs, "rename", async (source, target) => {
    if (target === f.manifestPath) throw Object.assign(new Error("synthetic disk failure"), { code: "EIO" });
    return rename(source, target);
  });
  await assert.rejects(f.store.decide([id(1)], "included"), { code: "EIO" });
  mock.mock.restore();
  assert.equal(await fs.readFile(f.manifestPath, "utf8"), before);
  for (const filename of f.assetPaths(id(1))) await assert.rejects(fs.stat(filename), { code: "ENOENT" });
  for (const filename of f.assetPaths(id(3))) assert.ok((await fs.stat(filename)).size > 0);
  assert.deepEqual((await fs.readdir(path.dirname(f.manifestPath))).sort(), ["curated-photos.json", "photo-map.json"]);
});
