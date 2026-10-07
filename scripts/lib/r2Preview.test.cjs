const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const sharp = require("sharp");
const { readConfig, buildPlan, uploadPlan, savePreview } = require("./r2Preview.cjs");

const id = (number) => `00000000-0000-4000-8000-${number.toString(16).padStart(12, "0")}`;
const fakeEnv = {
  R2_ACCOUNT_ID: "0".repeat(32),
  R2_ACCESS_KEY_ID: "synthetic-access-key",
  R2_SECRET_ACCESS_KEY: "synthetic-secret",
  R2_BUCKET_NAME: "ryoga-photos",
  R2_PUBLIC_BASE_URL: "https://synthetic-photo-test.example.workers.dev",
};
const config = readConfig(fakeEnv);
const digest = (body, algorithm = "sha256", encoding = "hex") => crypto.createHash(algorithm).update(body).digest(encoding);

async function fixture(t, statuses = ["included", "included", "included"]) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ryoga-r2-preview-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const manifestPath = path.join(root, "app/contents/curated-photos.json");
  const assets = path.join(root, "public/images/photos");
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.mkdir(assets, { recursive: true });
  const manifest = {
    version: 1,
    decisions: {},
    photos: statuses.map((status, index) => ({
      id: id(index + 1), title: `Synthetic ${index + 1}`, category: "Thailand", countryCode: "TH", date: "2026-01-01",
      width: 999, height: 999, latitude: 13.123456, longitude: 100.654321,
      originalPath: "/synthetic-private-library/original.jpg", privateNote: "do not publish",
    })),
  };
  const full = await sharp({ create: { width: 32, height: 24, channels: 3, background: "#729abb" } }).webp().toBuffer();
  const thumb = await sharp(full).resize(16, 12).webp().toBuffer();
  for (let index = 0; index < statuses.length; index += 1) {
    if (statuses[index]) manifest.decisions[id(index + 1)] = statuses[index];
    await fs.writeFile(path.join(assets, `${id(index + 1)}.webp`), full);
    await fs.writeFile(path.join(assets, `${id(index + 1)}-thumb.webp`), thumb);
  }
  const writeManifest = () => fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await writeManifest();
  return { root, manifest, manifestPath, assets, full, thumb, writeManifest };
}

function successfulPublicFetch(plan, calls = []) {
  return async (url, options) => {
    calls.push({ url, options });
    const object = plan.objects.find((entry) => entry.url === url);
    assert.ok(object, "only a planned image may be fetched");
    return new Response(object.body, { headers: { "content-type": "image/webp" } });
  };
}

test("configuration is limited to the intended bucket and a credential-free Workers HTTPS origin", () => {
  assert.equal(config.bucket, "ryoga-photos");
  assert.equal(config.publicBase, fakeEnv.R2_PUBLIC_BASE_URL);
  assert.equal(readConfig({ ...fakeEnv, R2_PUBLIC_BASE_URL: `${fakeEnv.R2_PUBLIC_BASE_URL}/` }).publicBase, config.publicBase);
  for (const overrides of [
    { R2_BUCKET_NAME: "another-project" }, { R2_ACCOUNT_ID: "invalid" }, { R2_SECRET_ACCESS_KEY: "" },
    ...[
      "http://photos.example.workers.dev", "https://workers.dev.evil.test", "https://photos.example.test",
      "https://user:secret@photos.example.workers.dev", "https://photos.example.workers.dev:8443",
      "https://photos.example.workers.dev/photos", "https://photos.example.workers.dev/?secret=value",
      "https://photos.example.workers.dev/#fragment",
    ].map((R2_PUBLIC_BASE_URL) => ({ R2_PUBLIC_BASE_URL })),
  ]) assert.throws(() => readConfig({ ...fakeEnv, ...overrides }), { safeToDisplay: true });
});

test("a trial selects at most three included photos and exports only public image information", async (t) => {
  const f = await fixture(t, ["excluded", null, "included", "included", "included", "included"]);
  const plan = await buildPlan(f.root, config);
  assert.deepEqual(plan.photos.map((photo) => photo.id), [id(3), id(4), id(5)]);
  assert.equal(plan.objects.length, 6);
  assert.equal(plan.totalBytes, 3 * (f.full.length + f.thumb.length));
  const publicKeys = ["id", "title", "category", "date", "width", "height", "aspect", "url", "thumbnail"].sort();
  for (const photo of plan.photos) {
    assert.deepEqual(Object.keys(photo).sort(), publicKeys);
    assert.deepEqual([photo.width, photo.height, photo.aspect], [32, 24, "32 / 24"], "dimensions come from the image bytes");
    assert.ok(photo.url.startsWith(`${config.publicBase}/photos/`));
  }
  for (const object of plan.objects) {
    assert.equal(object.sha256, digest(object.body));
    assert.equal(object.contentMD5, digest(object.body, "md5", "base64"));
  }
  const oversized = { ...plan, photos: [...plan.photos, plan.photos[0]], objects: [...plan.objects, ...plan.objects.slice(0, 2)] };
  await assert.rejects(uploadPlan(oversized, config, { client: { send() { assert.fail("oversized trial must not send requests"); } } }), /3枚・6ファイル/);
});

test("planning rejects metadata-bearing files, symlink escapes, and unsafe or excluded photo identities", async (t) => {
  for (const kind of ["metadata", "symlink", "id", "country"]) {
    await t.test(kind, async (subtest) => {
      const f = await fixture(subtest, ["included"]);
      const filename = path.join(f.assets, `${id(1)}.webp`);
      if (kind === "metadata") {
        const body = await sharp(f.full).withMetadata({ orientation: 6 }).webp().toBuffer();
        assert.ok((await sharp(body).metadata()).exif);
        await fs.writeFile(filename, body);
      } else if (kind === "symlink") {
        const outside = path.join(f.root, "outside.webp");
        await fs.writeFile(outside, f.full);
        await fs.unlink(filename);
        await fs.symlink(outside, filename);
      } else {
        if (kind === "id") {
          f.manifest.photos[0].id = "../../private";
          f.manifest.decisions["../../private"] = "included";
        } else f.manifest.photos[0].countryCode = "JP";
        await f.writeManifest();
      }
      await assert.rejects(buildPlan(f.root, config), { safeToDisplay: true });
    });
  }
});

test("R2 metadata allows broad place labels and capture times but excludes addresses and malformed values", async (t) => {
  const f = await fixture(t);
  Object.assign(f.manifest.photos[0], { locationLabel: "京畿道", capturedAt: "2026-01-01T03:04:05Z", street: "private street", postalCode: "12345" });
  Object.assign(f.manifest.photos[1], { locationLabel: { street: "private street" }, capturedAt: "not a timestamp" });
  Object.assign(f.manifest.photos[2], { locationLabel: "address\nprivate", capturedAt: "/private/source/file.jpg" });
  await f.writeManifest();
  const plan = await buildPlan(f.root, config);
  assert.equal(plan.photos[0].locationLabel, "京畿道");
  assert.equal(plan.photos[0].capturedAt, "2026-01-01T03:04:05Z");
  for (const photo of plan.photos.slice(1)) {
    assert.equal(photo.locationLabel, undefined);
    assert.equal(photo.capturedAt, undefined);
  }
  for (const photo of plan.photos) {
    for (const key of ["street", "postalCode", "latitude", "longitude", "originalPath", "privateNote"]) assert.equal(key in photo, false, key);
  }
});

test("repeating a trial keeps the same UUIDs even after manifest reordering and refuses deselected trial photos", async (t) => {
  const f = await fixture(t, ["included", "included", "included", "included"]);
  const original = await buildPlan(f.root, config);
  await savePreview(original);
  f.manifest.photos.reverse();
  await f.writeManifest();
  const repeated = await buildPlan(f.root, config);
  assert.deepEqual(repeated.photos.map((photo) => photo.id), original.photos.map((photo) => photo.id));
  f.manifest.decisions[id(2)] = "excluded";
  await f.writeManifest();
  await assert.rejects(buildPlan(f.root, config), /掲載対象から外れた写真/);
});

test("upload sends exactly six conditional WebP writes and validates every public response", async (t) => {
  const f = await fixture(t);
  const plan = await buildPlan(f.root, config);
  const sent = [];
  const fetched = [];
  const progress = [];
  const result = await uploadPlan(plan, config, {
    client: { async send(command) { sent.push(command); return {}; } },
    fetchImpl: successfulPublicFetch(plan, fetched),
    onProgress: (done, total) => progress.push([done, total]),
  });
  assert.deepEqual(result, { uploaded: 6, reused: 0 });
  assert.equal(sent.length, 6);
  assert.equal(fetched.length, 6);
  assert.deepEqual(progress, [[1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 6]]);
  for (let index = 0; index < sent.length; index += 1) {
    const command = sent[index];
    const object = plan.objects[index];
    assert.equal(command.constructor.name, "PutObjectCommand");
    assert.deepEqual(command.input, {
      Bucket: "ryoga-photos", Key: object.key, Body: object.body, ContentType: "image/webp",
      ContentMD5: object.contentMD5, CacheControl: "public, max-age=3600", StorageClass: "STANDARD", IfNoneMatch: "*",
    });
    assert.equal(fetched[index].url, object.url);
    assert.equal(fetched[index].options.redirect, "error");
    assert.equal(fetched[index].options.headers["Cache-Control"], "no-cache");
  }
  await assert.rejects(fs.stat(plan.previewPath), { code: "ENOENT" }, "upload does not implicitly publish the preview");
});

test("existing identical objects are reused while different objects stop without overwrite or deletion", async (t) => {
  const f = await fixture(t, ["included"]);
  const plan = await buildPlan(f.root, config);
  for (const identical of [true, false]) {
    const sent = [];
    const fetched = [];
    const client = {
      async send(command) {
        sent.push(command);
        if (command.constructor.name === "PutObjectCommand") {
          assert.equal(command.input.IfNoneMatch, "*");
          throw Object.assign(new Error("synthetic already exists"), { $metadata: { httpStatusCode: 412 } });
        }
        assert.equal(command.constructor.name, "GetObjectCommand", "only a conditional write followed by a read is allowed");
        const object = plan.objects.find((entry) => entry.key === command.input.Key);
        return { Body: { async transformToByteArray() { return identical ? object.body : Buffer.from("different bytes"); } } };
      },
    };
    const attempt = uploadPlan(plan, config, { client, fetchImpl: successfulPublicFetch(plan, fetched) });
    if (identical) {
      assert.deepEqual(await attempt, { uploaded: 0, reused: 2 });
      assert.equal(sent.length, 4);
      assert.equal(fetched.length, 2);
    } else {
      await assert.rejects(attempt, /上書きせず停止/);
      assert.equal(sent.length, 2);
      assert.equal(fetched.length, 0);
    }
  }
});

test("a bad public response prevents preview replacement even after a successful object upload", async (t) => {
  const f = await fixture(t, ["included"]);
  const plan = await buildPlan(f.root, config);
  await savePreview(plan);
  const previousPreview = await fs.readFile(plan.previewPath);
  for (const response of [
    () => new Response("not found", { status: 404 }),
    () => new Response(f.full, { headers: { "content-type": "text/html" } }),
    () => new Response("wrong image", { headers: { "content-type": "image/webp" } }),
    () => { throw new Error("synthetic network failure"); },
  ]) {
    let writes = 0;
    await assert.rejects(async () => {
      await uploadPlan(plan, config, {
        client: { async send() { writes += 1; return {}; } },
        fetchImpl: async () => response(),
      });
      await savePreview(plan);
    });
    assert.equal(writes, 1, "stop before attempting another object");
    assert.deepEqual(await fs.readFile(plan.previewPath), previousPreview);
  }
});

test("selection changes abort before uploads, after final verification, and before saving a preview", async (t) => {
  for (const when of ["before upload", "during last response", "before save"]) {
    await t.test(when, async (subtest) => {
      const f = await fixture(subtest, ["included"]);
      const plan = await buildPlan(f.root, config);
      const deselect = async () => { f.manifest.decisions[id(1)] = "excluded"; await f.writeManifest(); };
      const fetched = [];
      const publicFetch = successfulPublicFetch(plan, fetched);
      let writes = 0;
      if (when === "before upload" || when === "before save") await deselect();
      if (when === "before save") {
        await assert.rejects(savePreview(plan), /選別結果が変わった/);
      } else {
        await assert.rejects(uploadPlan(plan, config, {
          client: { async send() { writes += 1; return {}; } },
          fetchImpl: async (...args) => {
            const response = await publicFetch(...args);
            if (fetched.length === plan.objects.length) await deselect();
            return response;
          },
        }), /選別結果が変わった/);
        assert.equal(writes, when === "before upload" ? 0 : 2);
      }
      await assert.rejects(fs.stat(plan.previewPath), { code: "ENOENT" });
    });
  }
});

test("saving a preview writes only the local preview and leaves curated decisions and public files untouched", async (t) => {
  const f = await fixture(t);
  const manifestBefore = await fs.readFile(f.manifestPath);
  const plan = await buildPlan(f.root, config);
  await savePreview(plan);
  assert.deepEqual(await fs.readFile(f.manifestPath), manifestBefore);
  for (const object of plan.objects) {
    assert.deepEqual(await fs.readFile(path.join(f.assets, path.basename(object.key))), object.body);
  }
  assert.equal(plan.previewPath, path.join(f.root, ".local/photos/r2-preview.json"));
  assert.equal((await fs.stat(plan.previewPath)).mode & 0o777, 0o600);
  const preview = JSON.parse(await fs.readFile(plan.previewPath, "utf8"));
  assert.equal(preview.version, 1);
  assert.ok(Number.isFinite(Date.parse(preview.uploadedAt)));
  assert.deepEqual(preview.photos, plan.photos);
  const serialized = JSON.stringify(preview);
  for (const privateValue of ["latitude", "longitude", "originalPath", "privateNote", f.root, fakeEnv.R2_SECRET_ACCESS_KEY]) {
    assert.equal(serialized.includes(privateValue), false, privateValue);
  }
  assert.deepEqual(await fs.readdir(path.dirname(plan.previewPath)), ["r2-preview.json"], "no temporary files remain");
});
