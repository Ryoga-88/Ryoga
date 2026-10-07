const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const sharp = require("sharp");
const { buildPlan, uploadPlan, readConfig, CACHE_CONTROL } = require("./r2Migration.cjs");

const id = (number) => `00000000-0000-4000-8000-${number.toString(16).padStart(12, "0")}`;
const hash = (body) => crypto.createHash("sha256").update(body).digest("hex");
const config = readConfig({
  R2_ACCOUNT_ID: "0".repeat(32), R2_ACCESS_KEY_ID: "synthetic-key", R2_SECRET_ACCESS_KEY: "synthetic-secret",
  R2_BUCKET_NAME: "ryoga-photos", R2_PUBLIC_BASE_URL: "https://synthetic-migration-test.example.workers.dev",
});

async function fixture(t, statuses = ["included", "included", "included", "included", "included"]) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ryoga-r2-migration-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const manifestPath = path.join(root, "app/contents/curated-photos.json");
  const assets = path.join(root, "public/images/photos");
  const previewPath = path.join(root, ".local/photos/r2-preview.json");
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.mkdir(path.dirname(previewPath), { recursive: true });
  await fs.mkdir(assets, { recursive: true });
  await fs.writeFile(previewPath, "previous-three-photo-preview\n");
  const full = await sharp({ create: { width: 1200, height: 900, channels: 3, background: "#729abb" } }).webp().toBuffer();
  const thumb = await sharp(full).resize(500, 375).webp().toBuffer();
  const manifest = {
    version: 1, updatedAt: "2026-01-01T00:00:00Z", extraState: { keep: true }, decisions: {},
    photos: statuses.map((status, index) => ({
      id: id(index + 1), title: `Synthetic ${index + 1}`, countryCode: "TH", category: "Thailand", date: "2026-01-01",
      locationLabel: "Bangkok", capturedAt: "2026-01-01T03:04:05Z", favorite: "false",
      width: 999, height: 999, aspect: "999 / 999", url: `/images/photos/${id(index + 1)}.webp`, thumbnail: `/images/photos/${id(index + 1)}-thumb.webp`,
    })),
  };
  for (let index = 0; index < statuses.length; index += 1) {
    if (statuses[index]) manifest.decisions[id(index + 1)] = statuses[index];
    await fs.writeFile(path.join(assets, `${id(index + 1)}.webp`), full);
    await fs.writeFile(path.join(assets, `${id(index + 1)}-thumb.webp`), thumb);
  }
  const writeManifest = () => fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await writeManifest();
  return { root, assets, manifest, manifestPath, full, thumb, previewPath, writeManifest, readManifest: async () => JSON.parse(await fs.readFile(manifestPath, "utf8")) };
}

function fakeTransport() {
  const stored = new Map();
  const calls = [];
  const fetches = [];
  const client = {
    async send(command) {
      const { Key, Body } = command.input;
      calls.push(command);
      assert.equal(command.input.Bucket, "ryoga-photos");
      if (command.constructor.name === "PutObjectCommand") {
        assert.equal(command.input.IfNoneMatch, "*");
        assert.equal(command.input.CacheControl, CACHE_CONTROL);
        assert.equal(command.input.ContentType, "image/webp");
        assert.ok(!command.input.Metadata, "do not transmit source paths or GPS as object metadata");
        if (stored.has(Key)) throw Object.assign(new Error("Already exists"), { $metadata: { httpStatusCode: 412 } });
        stored.set(Key, Buffer.from(Body));
        return {};
      }
      assert.equal(command.constructor.name, "GetObjectCommand", "never delete objects");
      return { Body: { transformToByteArray: async () => stored.get(Key) } };
    },
  };
  const fetchImpl = async (url, options) => {
    fetches.push({ url, options });
    assert.equal(options.redirect, "error");
    assert.equal(options.headers["Cache-Control"], "no-cache");
    const key = new URL(url).pathname.slice(1);
    assert.ok(stored.has(key));
    return new Response(stored.get(key), { headers: { "content-type": "image/webp" } });
  };
  return { stored, calls, fetches, client, fetchImpl };
}

test("pending-only resumes verified checkpoints and includes changed image bytes or dimensions", async (t) => {
  const f = await fixture(t, ["included", "included", "included"]);
  const transport = fakeTransport();
  await uploadPlan(await buildPlan(f.root, config), config, transport);
  const completed = await buildPlan(f.root, config, { pendingOnly: true });
  assert.equal(completed.photos.length, 0);
  assert.equal(completed.objects.length, 0);
  assert.equal(completed.totalBytes, 0);
  assert.deepEqual(completed.completedPhotos, [1, 2, 3].map(id));
  assert.deepEqual(await uploadPlan(completed, config, transport), { uploaded: 0, reused: 0, committed: 0 });
  const updated = await sharp({ create: { width: 1200, height: 900, channels: 3, background: "red" } }).webp().toBuffer();
  await fs.writeFile(path.join(f.assets, `${id(2)}.webp`), updated);
  const current = await f.readManifest();
  current.photos[2].width = 600;
  await fs.writeFile(f.manifestPath, JSON.stringify(current));
  const pending = await buildPlan(f.root, config, { pendingOnly: true });
  assert.deepEqual(pending.photos.map((photo) => photo.id), [2, 3].map(id));
  assert.deepEqual(pending.completedPhotos, [id(1)]);
  assert.equal(pending.objects.length, 4);
  assert.equal((await buildPlan(f.root, config)).photos.length, 3, "default still verifies every selected image");
});

test("dry planning selects every included manifest photo and reveals no private catalog fields", async (t) => {
  const f = await fixture(t, ["included", "excluded", null, "included", "included", "included", "included"]);
  Object.assign(f.manifest.photos[0], { latitude: 13.1234, originalPath: "/private/synthetic/original.jpg", privateNote: "secret-note" });
  await f.writeManifest();
  const original = await fs.readFile(f.manifestPath, "utf8");
  const plan = await buildPlan(f.root, config);
  assert.deepEqual(plan.photos.map((photo) => photo.id), [1, 4, 5, 6, 7].map(id));
  assert.equal(plan.objects.length, 10);
  assert.equal(plan.totalBytes, 5 * (f.full.length + f.thumb.length));
  assert.deepEqual(plan.qualityIssues, []);
  for (const object of plan.objects) {
    const body = object.variant === "full" ? f.full : f.thumb;
    assert.equal(object.sha256, hash(body));
    assert.equal(object.key, `photos/${object.id}/${hash(body)}/${object.variant}.webp`);
    assert.ok(!object.body);
  }
  for (const photo of plan.photos) assert.deepEqual([photo.width, photo.height, photo.aspect], [1200, 900, "1200 / 900"]);
  const summary = JSON.stringify(plan);
  for (const forbidden of ["latitude", "originalPath", "privateNote", f.root, "synthetic-secret"]) assert.ok(!summary.includes(forbidden));
  assert.equal(await fs.readFile(f.manifestPath, "utf8"), original);
  assert.equal(await fs.readFile(f.previewPath, "utf8"), "previous-three-photo-preview\n");
});

test("migration checkpoints delivery fields only, keeps decisions and metadata, and reuses immutable objects", async (t) => {
  const f = await fixture(t, ["included", "excluded", "included", "included", "included"]);
  const original = structuredClone(f.manifest);
  const plan = await buildPlan(f.root, config);
  const transport = fakeTransport();
  const progress = [];
  const result = await uploadPlan(plan, config, { ...transport, concurrency: 3, onProgress: (p) => progress.push(p) });
  assert.deepEqual(result, { uploaded: 8, reused: 0, committed: 4 });
  assert.equal(progress.length, 4);
  assert.equal(transport.fetches.length, 8);
  const after = await f.readManifest();
  assert.deepEqual(after.decisions, original.decisions);
  assert.equal(after.updatedAt, original.updatedAt);
  assert.deepEqual(after.extraState, original.extraState);
  assert.deepEqual(after.photos[1], original.photos[1]);
  for (const expected of plan.photos) {
    const before = original.photos.find((photo) => photo.id === expected.id);
    assert.deepEqual(after.photos.find((photo) => photo.id === expected.id), { ...before, url: expected.url, thumbnail: expected.thumbnail, width: 1200, height: 900, aspect: "1200 / 900" });
  }
  assert.equal(await fs.readFile(f.previewPath, "utf8"), "previous-three-photo-preview\n");
  const repeated = await buildPlan(f.root, config);
  assert.deepEqual(await uploadPlan(repeated, config, transport), { uploaded: 0, reused: 8, committed: 4 });
  assert.equal(transport.stored.size, 8);
});

test("quality shortfalls block sending unless explicitly allowed, and later upgrades use new URLs", async (t) => {
  const f = await fixture(t, ["included"]);
  const lowResolution = await sharp(f.full).resize(552, 414).webp().toBuffer();
  await fs.writeFile(path.join(f.assets, `${id(1)}.webp`), lowResolution);
  const plan = await buildPlan(f.root, config);
  assert.deepEqual(plan.qualityIssues, [{ id: id(1), width: 552, height: 414 }]);
  const transport = fakeTransport();
  await assert.rejects(uploadPlan(plan, config, transport), /1200px未満/);
  assert.equal(transport.calls.length, 0);
  const previewPlan = await buildPlan(f.root, config, { allowPreview: true });
  await uploadPlan(previewPlan, config, transport);
  await fs.writeFile(path.join(f.assets, `${id(1)}.webp`), f.full);
  const upgraded = await buildPlan(f.root, config);
  assert.notEqual(upgraded.photos[0].url, previewPlan.photos[0].url);
  assert.deepEqual(await uploadPlan(upgraded, config, transport), { uploaded: 1, reused: 1, committed: 1 });
  assert.equal(transport.stored.size, 3, "old image remains intact");
});

test("invalid files, metadata, escaped paths, IDs, countries, and destinations are rejected", async (t) => {
  for (const kind of ["metadata", "not-webp", "symlink", "id", "country", "unknown-country", "duplicate", "oversized-thumb", "bucket", "public-origin"]) {
    await t.test(kind, async (subtest) => {
      const f = await fixture(subtest, ["included"]);
      const filename = path.join(f.assets, `${id(1)}.webp`);
      let destination = config;
      if (kind === "metadata") await fs.writeFile(filename, await sharp(f.full).withMetadata().webp().toBuffer());
      if (kind === "not-webp") await fs.writeFile(filename, await sharp(f.full).jpeg().toBuffer());
      if (kind === "symlink") {
        await fs.writeFile(path.join(f.root, "outside.webp"), f.full);
        await fs.unlink(filename);
        await fs.symlink(path.join(f.root, "outside.webp"), filename);
      }
      if (kind === "id") { f.manifest.photos[0].id = "../../private"; f.manifest.decisions["../../private"] = "included"; }
      if (kind === "country") f.manifest.photos[0].countryCode = "JP";
      if (kind === "unknown-country") delete f.manifest.photos[0].countryCode;
      if (kind === "duplicate") f.manifest.photos.push(f.manifest.photos[0]);
      if (kind === "oversized-thumb") await fs.writeFile(path.join(f.assets, `${id(1)}-thumb.webp`), f.full);
      if (kind === "bucket") destination = { ...config, bucket: "different-project" };
      if (kind === "public-origin") destination = { ...config, publicBase: "https://example.workers.dev.attacker.test" };
      await f.writeManifest();
      await assert.rejects(buildPlan(f.root, destination), { safeToDisplay: true });
    });
  }
});

test("public verification failures never update a photo with only one verified variant", async (t) => {
  for (const kind of ["hash", "type", "http"]) {
    await t.test(kind, async (subtest) => {
      const f = await fixture(subtest, ["included"]);
      const original = await fs.readFile(f.manifestPath, "utf8");
      const plan = await buildPlan(f.root, config);
      const transport = fakeTransport();
      const fetchImpl = async (url, options) => {
        if (!url.endsWith("/thumb.webp")) return transport.fetchImpl(url, options);
        if (kind === "hash") return new Response("different content", { headers: { "content-type": "image/webp" } });
        if (kind === "type") return new Response(f.thumb, { headers: { "content-type": "text/html" } });
        return new Response("unavailable", { status: 503 });
      };
      await assert.rejects(uploadPlan(plan, config, { ...transport, fetchImpl }), { safeToDisplay: true });
      assert.equal(await fs.readFile(f.manifestPath, "utf8"), original);
    });
  }
});

test("412 reuse verifies bytes and refuses any object with different contents", async (t) => {
  const f = await fixture(t, ["included"]);
  const plan = await buildPlan(f.root, config);
  const transport = fakeTransport();
  transport.stored.set(plan.objects[0].key, Buffer.from("collision"));
  await assert.rejects(uploadPlan(plan, config, transport), /上書きせず/);
  assert.deepEqual(await f.readManifest(), f.manifest);
  assert.equal(transport.stored.get(plan.objects[0].key).toString(), "collision");
  assert.equal(transport.fetches.length, 0);
});

test("completed checkpoints survive a later failure and a retry finishes all photos", async (t) => {
  const f = await fixture(t, ["included", "included", "included"]);
  const plan = await buildPlan(f.root, config);
  const transport = fakeTransport();
  const fetchImpl = async (url, options) => {
    if (url.includes(id(2)) && url.endsWith("/thumb.webp")) throw new Error("secret synthetic network error with credentials");
    return transport.fetchImpl(url, options);
  };
  await assert.rejects(uploadPlan(plan, config, { ...transport, fetchImpl, concurrency: 1 }), (error) => {
    assert.equal(error.progress.committed, 1);
    assert.ok(!error.message.includes("secret"));
    return true;
  });
  const partial = await f.readManifest();
  assert.equal(partial.photos[0].url, plan.photos[0].url);
  assert.equal(partial.photos[1].url, f.manifest.photos[1].url);
  assert.equal(partial.photos[2].url, f.manifest.photos[2].url);
  const retry = await buildPlan(f.root, config);
  assert.deepEqual(await uploadPlan(retry, config, { ...transport, concurrency: 1 }), { uploaded: 2, reused: 4, committed: 3 });
});

test("unrelated concurrent edits and metadata changes survive each fresh checkpoint", async (t) => {
  const f = await fixture(t, ["included", "excluded"]);
  const plan = await buildPlan(f.root, config);
  const transport = fakeTransport();
  const fetchImpl = async (url, options) => {
    const current = await f.readManifest();
    current.extraState.changedDuringUpload = true;
    current.decisions[id(99)] = "excluded";
    current.photos[0].locationLabel = "Updated place";
    current.photos[1].title = "Changed by user";
    await fs.writeFile(f.manifestPath, JSON.stringify(current));
    return transport.fetchImpl(url, options);
  };
  await uploadPlan(plan, config, { ...transport, fetchImpl });
  const current = await f.readManifest();
  assert.equal(current.extraState.changedDuringUpload, true);
  assert.equal(current.decisions[id(99)], "excluded");
  assert.equal(current.photos[0].locationLabel, "Updated place");
  assert.equal(current.photos[1].title, "Changed by user");
});

test("deselection, delivery changes, and source-byte changes prevent a stale commit", async (t) => {
  for (const kind of ["deselection", "delivery", "source"]) {
    await t.test(kind, async (subtest) => {
      const f = await fixture(subtest, ["included"]);
      const plan = await buildPlan(f.root, config);
      const transport = fakeTransport();
      const fetchImpl = async (url, options) => {
        const response = await transport.fetchImpl(url, options);
        if (url.endsWith("/thumb.webp")) {
          if (kind === "source") await fs.writeFile(path.join(f.assets, `${id(1)}.webp`), await sharp(f.full).flop().webp({ quality: 21 }).toBuffer());
          else {
            const current = await f.readManifest();
            if (kind === "deselection") { current.decisions[id(1)] = "excluded"; current.photos = []; }
            if (kind === "delivery") current.photos[0].url = "/images/photos/updated.webp";
            await fs.writeFile(f.manifestPath, JSON.stringify(current));
          }
        }
        return response;
      };
      await assert.rejects(uploadPlan(plan, config, { ...transport, fetchImpl }), { safeToDisplay: true });
      const current = await f.readManifest();
      if (kind === "deselection") assert.equal(current.photos.length, 0);
      if (kind === "delivery") assert.equal(current.photos[0].url, "/images/photos/updated.webp");
      if (kind === "source") assert.equal(current.photos[0].url, f.manifest.photos[0].url);
    });
  }
});

test("bounded parallelism waits for all in-flight work before returning", async (t) => {
  const f = await fixture(t);
  const plan = await buildPlan(f.root, config);
  const transport = fakeTransport();
  let active = 0;
  let maximum = 0;
  const client = {
    async send(command) {
      active += 1;
      maximum = Math.max(maximum, active);
      try { await new Promise((resolve) => setTimeout(resolve, 5)); return await transport.client.send(command); }
      finally { active -= 1; }
    },
  };
  await uploadPlan(plan, config, { ...transport, client, concurrency: 2 });
  assert.ok(maximum > 1);
  assert.ok(maximum <= 2);
  assert.equal(active, 0);
});

test("ready-only migration defers low-resolution photos without changing their manifest entries", async (t) => {
  const f = await fixture(t, ["included", "included", "included"]);
  const lowResolution = await sharp(f.full).resize(552, 414).webp().toBuffer();
  await fs.writeFile(path.join(f.assets, `${id(2)}.webp`), lowResolution);
  const plan = await buildPlan(f.root, config, { readyOnly: true });
  assert.deepEqual(plan.photos.map((photo) => photo.id), [id(1), id(3)]);
  assert.equal(plan.objects.length, 4);
  assert.equal(plan.totalBytes, 2 * (f.full.length + f.thumb.length));
  assert.deepEqual(plan.qualityIssues, []);
  assert.deepEqual(plan.deferredPhotos, [{ id: id(2), width: 552, height: 414 }]);
  const transport = fakeTransport();
  assert.deepEqual(await uploadPlan(plan, config, transport), { uploaded: 4, reused: 0, committed: 2 });
  const after = await f.readManifest();
  assert.deepEqual(after.photos[1], f.manifest.photos[1]);
  assert.deepEqual(after.decisions, f.manifest.decisions);
  assert.ok(![...transport.stored.keys()].some((key) => key.includes(id(2))));
  await fs.writeFile(path.join(f.assets, `${id(2)}.webp`), f.full);
  const all = await buildPlan(f.root, config);
  assert.equal(all.photos.length, 3);
  assert.deepEqual(await uploadPlan(all, config, transport), { uploaded: 2, reused: 4, committed: 3 });
});

test("ready-only migration fails clearly when no images meet the quality threshold", async (t) => {
  const f = await fixture(t, ["included"]);
  await fs.writeFile(path.join(f.assets, `${id(1)}.webp`), await sharp(f.full).resize(552, 414).webp().toBuffer());
  await assert.rejects(buildPlan(f.root, config, { readyOnly: true }), /移行できる1200px以上/);
});
