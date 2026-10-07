const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const sharp = require("sharp");
const { highResolutionSource, refreshHighResolutionPhotos } = require("./photoHighResolution.cjs");
const { withManifestLock } = require("./photoManifestLock.cjs");

const id = "00000000-0000-4000-8000-000000000001";
const excluded = "00000000-0000-4000-8000-000000000002";

async function fixture(t, { width = 3200, height = 1800 } = {}) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "ryoga-photo-resolution-test-")));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const exportDirectory = path.join(root, ".local", "photos", "high-resolution");
  const publicDirectory = path.join(root, "public", "images", "photos");
  const manifestPath = path.join(root, "app", "contents", "curated-photos.json");
  await Promise.all([fs.mkdir(exportDirectory, { recursive: true }), fs.mkdir(publicDirectory, { recursive: true }), fs.mkdir(path.dirname(manifestPath), { recursive: true })]);
  const source = path.join(exportDirectory, `${id}.jpg`);
  await sharp({ create: { width, height, channels: 3, background: "#df2518" } }).withMetadata({ orientation: 6 }).jpeg().toFile(source);
  const low = await sharp({ create: { width: 552, height: 310, channels: 3, background: "#446699" } }).webp().toBuffer();
  const full = path.join(publicDirectory, `${id}.webp`);
  const thumbnail = path.join(publicDirectory, `${id}-thumb.webp`);
  await Promise.all([fs.writeFile(full, low), fs.writeFile(thumbnail, low)]);
  const data = {
    version: 1, updatedAt: "2026-01-02T03:04:05Z", extraManifestField: "preserved",
    decisions: { [id]: "included", [excluded]: "excluded" },
    photos: [{ id, url: `/images/photos/${id}.webp`, thumbnail: `/images/photos/${id}-thumb.webp`, width: 552, height: 310, aspect: "552 / 310", title: "タイ", category: "Thailand", countryCode: "TH", caption: "Keep this caption", date: "2024-01-01", capturedAt: "2024-01-01T01:02:03Z", locationLabel: "地域", favorite: "true" }],
  };
  const exports = { version: 1, photos: [{ id, status: "exported", fileName: `${id}.jpg`, width, height, modifiedAt: "2026-01-02T03:04:05Z" }] };
  const exportManifestPath = path.join(exportDirectory, "export-results.json");
  const saveManifest = () => fs.writeFile(manifestPath, JSON.stringify(data));
  const saveExports = () => fs.writeFile(exportManifestPath, JSON.stringify(exports));
  await Promise.all([saveManifest(), saveExports()]);
  return { root, data, exports, source, full, thumbnail, low, manifestPath, exportDirectory, exportManifestPath, saveManifest, saveExports };
}

test("export lookup validates UUID, status, actual image quality and source confinement", async (t) => {
  const f = await fixture(t);
  assert.equal(await highResolutionSource(f.root, id), f.source);
  assert.equal(await highResolutionSource(f.root, "../outside"), null);
  f.exports.photos[0].status = "failed"; await f.saveExports();
  assert.equal(await highResolutionSource(f.root, id), null);
  f.exports.photos[0].status = "exported";
  f.exports.photos[0].fileName = `../${id}.jpg`; await f.saveExports();
  assert.equal(await highResolutionSource(f.root, id), null);
  f.exports.photos[0].fileName = `${id}.jpg`; await f.saveExports();
  const outside = path.join(f.root, "outside.jpg");
  await fs.rename(f.source, outside);
  await fs.symlink(outside, f.source);
  assert.equal(await highResolutionSource(f.root, id), null);
  await fs.rm(f.source);
  await sharp({ create: { width: 640, height: 480, channels: 3, background: "red" } }).jpeg().toFile(f.source);
  assert.equal(await highResolutionSource(f.root, id), null, "manifest dimensions cannot authorize a tiny actual image");
  const result = await refreshHighResolutionPhotos(f.root, { write: true });
  assert.equal(result.pending, 1);
  assert.deepEqual(await fs.readFile(f.full), f.low);
});

test("export directory symlinks and duplicate records are rejected", async (t) => {
  const f = await fixture(t);
  f.exports.photos.push({ ...f.exports.photos[0] }); await f.saveExports();
  assert.equal(await highResolutionSource(f.root, id), null);
  f.exports.photos.pop(); await f.saveExports();
  const moved = path.join(f.root, "elsewhere");
  await fs.rename(f.exportDirectory, moved);
  await fs.symlink(moved, f.exportDirectory);
  assert.equal(await highResolutionSource(f.root, id), null);
});

test("dry run is unchanged; refresh preserves decisions/public fields and strips source metadata", async (t) => {
  const f = await fixture(t);
  const before = await fs.readFile(f.manifestPath);
  assert.ok((await sharp(f.source).metadata()).exif);
  const dry = await refreshHighResolutionPhotos(f.root);
  assert.deepEqual(dry, { inspected: 1, candidates: 1, ready: 1, upgraded: 0, pending: 0, skipped: 0, failed: 0 });
  assert.deepEqual(await fs.readFile(f.manifestPath), before);
  assert.deepEqual(await fs.readFile(f.full), f.low);
  let prepared = false;
  const result = await refreshHighResolutionPhotos(f.root, { write: true, onProgress: async ({ status }) => {
    if (status !== "prepared") return;
    prepared = true;
    await assert.rejects(fs.stat(path.join(f.root, ".local/photos/publication.lock")), { code: "ENOENT" });
    await withManifestLock(f.root, async () => {});
  } });
  assert.equal(prepared, true);
  assert.equal(result.upgraded, 1);
  assert.equal(result.failed, 0);
  const saved = JSON.parse(await fs.readFile(f.manifestPath, "utf8"));
  assert.deepEqual(saved, { ...f.data, photos: [{ ...f.data.photos[0], width: 1350, height: 2400, aspect: "1350 / 2400" }] });
  for (const filename of [f.full, f.thumbnail]) {
    const metadata = await sharp(filename).metadata();
    assert.equal(metadata.format, "webp");
    for (const key of ["exif", "xmp", "icc", "orientation"]) assert.equal(metadata[key], undefined, key);
  }
  const thumbnail = await sharp(f.thumbnail).metadata();
  assert.deepEqual([thumbnail.width, thumbnail.height], [281, 500]);
  assert.equal(JSON.stringify(saved).includes(f.root), false);
  const backupRoot = path.join(f.root, ".local/photos/high-resolution-backups");
  const [runId] = await fs.readdir(backupRoot);
  assert.deepEqual(await fs.readFile(path.join(backupRoot, runId, id, "full.webp")), f.low);
  assert.deepEqual(await fs.readFile(path.join(backupRoot, runId, id, "manifest.json")), before);
  const first = await fs.readFile(f.full);
  const again = await refreshHighResolutionPhotos(f.root, { write: true });
  assert.equal(again.candidates, 0);
  assert.equal(again.upgraded, 0);
  assert.deepEqual(await fs.readFile(f.full), first);
});

test("exported edited rendition is used without reading a catalog original, and never enlarged", async (t) => {
  const f = await fixture(t, { width: 1600, height: 900 });
  await fs.writeFile(path.join(f.root, ".local/photos/catalog.json"), JSON.stringify({ photos: [{ id, hasEdits: true, originalPath: "do-not-read-original" }] }));
  const result = await refreshHighResolutionPhotos(f.root, { write: true });
  assert.equal(result.upgraded, 1);
  const metadata = await sharp(f.full).metadata();
  assert.deepEqual([metadata.width, metadata.height], [900, 1600]);
  const stats = await sharp(f.full).stats();
  assert.ok(stats.channels[0].mean > stats.channels[2].mean * 3, "edited red export supplies the pixels");
});

for (const change of ["selection", "delivery", "public-bytes", "source-version", "source-bytes"]) {
  test(`commit rechecks ${change} under the shared lock and keeps intervening changes`, async (t) => {
    const f = await fixture(t);
    const replacement = await sharp({ create: { width: 640, height: 360, channels: 3, background: "green" } }).webp().toBuffer();
    const result = await refreshHighResolutionPhotos(f.root, { write: true, onProgress: async ({ status }) => {
      if (status !== "prepared") return;
      await withManifestLock(f.root, async () => {
        if (change === "selection") { f.data.decisions[id] = "excluded"; f.data.photos = []; await f.saveManifest(); }
        if (change === "delivery") { f.data.photos[0].url = "https://example.test/new-version.webp"; await f.saveManifest(); }
        if (change === "public-bytes") await fs.writeFile(f.full, replacement);
        if (change === "source-version") { f.exports.photos[0].modifiedAt = "2026-01-03T00:00:00Z"; await f.saveExports(); }
        if (change === "source-bytes") await fs.writeFile(f.source, replacement);
      });
    } });
    assert.equal(result.upgraded, 0);
    assert.equal(result.skipped, 1);
    assert.equal(result.failed, 0);
    assert.deepEqual(JSON.parse(await fs.readFile(f.manifestPath, "utf8")), f.data);
    assert.deepEqual(await fs.readFile(f.full), change === "public-bytes" ? replacement : f.low);
    assert.deepEqual(await fs.readFile(f.thumbnail), f.low);
  });
}

test("manifest write failure rolls back both public images and retains private backups", async (t) => {
  const f = await fixture(t);
  const before = await fs.readFile(f.manifestPath);
  const originalRename = fs.rename.bind(fs);
  t.mock.method(fs, "rename", async (source, destination) => {
    if (destination === f.manifestPath) throw Object.assign(new Error("synthetic write failure"), { code: "EIO" });
    return originalRename(source, destination);
  });
  const result = await refreshHighResolutionPhotos(f.root, { write: true });
  assert.equal(result.failed, 1);
  assert.equal(result.upgraded, 0);
  assert.deepEqual(await fs.readFile(f.manifestPath), before);
  assert.deepEqual(await fs.readFile(f.full), f.low);
  assert.deepEqual(await fs.readFile(f.thumbnail), f.low);
  await assert.rejects(fs.stat(path.join(f.root, ".local/photos/publication.lock")), { code: "ENOENT" });
  assert.deepEqual((await fs.readdir(path.dirname(f.full))).sort(), [`${id}-thumb.webp`, `${id}.webp`].sort());
});

test("a successful sips exit with a corrupt JPEG reports a safe HEIC diagnostic and preserves publication", async (t) => {
  const f = await fixture(t);
  const heic = path.join(f.exportDirectory, `${id}.heic`);
  await fs.rename(f.source, heic);
  f.exports.photos[0].fileName = `${id}.heic`;
  await f.saveExports();
  const before = await fs.readFile(f.manifestPath);
  const childProcess = require("node:child_process");
  let conversions = 0;
  // Simulate the macOS failure: sips reports exit 0, but writes only JPEG
  // markers instead of decoded pixels. Existing .jpg tests missed this path.
  const originalExecFile = childProcess.execFile;
  childProcess.execFile = (command, args, options, callback) => {
    assert.equal(command, "/usr/bin/sips");
    conversions++;
    const output = args[args.indexOf("--out") + 1];
    fs.writeFile(output, Buffer.from([0xff, 0xd8, 0xff, 0xd9])).then(() => callback(null, "", ""), callback);
  };
  t.after(() => { childProcess.execFile = originalExecFile; });
  const modulePath = require.resolve("./photoHighResolution.cjs");
  delete require.cache[modulePath];
  const fresh = require("./photoHighResolution.cjs");
  t.after(() => { delete require.cache[modulePath]; });
  const events = [];
  const result = await fresh.refreshHighResolutionPhotos(f.root, { write: true, onProgress: (event) => events.push(event) });
  assert.equal(conversions, 1);
  assert.equal(result.upgraded, 0);
  assert.equal(result.failed, 1);
  assert.deepEqual(result.failureReasons, { HEIC_CONVERSION: 1 });
  const failure = events.find((event) => event.status === "failed");
  assert.equal(failure.reason, "HEIC_CONVERSION");
  assert.match(failure.message, /HEIC画像の変換/);
  assert.ok(!failure.message.includes(f.root));
  assert.ok(!failure.message.includes(heic));
  assert.deepEqual(await fs.readFile(f.manifestPath), before);
  assert.deepEqual(await fs.readFile(f.full), f.low);
  assert.deepEqual(await fs.readFile(f.thumbnail), f.low);
  assert.deepEqual((await fs.readdir(f.exportDirectory)).sort(), ["export-results.json", `${id}.heic`].sort(), "temporary conversions are removed");
});
