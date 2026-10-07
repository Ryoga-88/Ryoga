import test from "node:test";
import assert from "node:assert/strict";
import worker from "./index.mjs";

const id = "00000000-0000-4000-8000-000000000001";
const hash = "a".repeat(64);
const calls = [];
const object = () => ({ body: new Uint8Array([1, 2, 3]), httpEtag: '"synthetic-etag"', writeHttpMetadata(headers) { headers.set("Cache-Control", "public, max-age=31536000, immutable"); } });
const env = { PHOTOS: { async get(key) { calls.push(key); return object(); }, async head(key) { calls.push(key); return object(); } } };

test("legacy and versioned photo variants are served with R2 caching metadata", async () => {
  for (const key of [`${id}.webp`, `${id}-thumb.webp`, `${id}/${hash}/full.webp`, `${id}/${hash}/thumb.webp`]) {
    const response = await worker.fetch(new Request(`https://photos.example/photos/${key}`), env);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/webp");
    assert.equal(response.headers.get("cache-control"), "public, max-age=31536000, immutable");
    assert.equal(response.headers.get("etag"), '"synthetic-etag"');
    assert.equal(calls.at(-1), `photos/${key}`);
  }
});

test("unrecognized paths and mutation methods never access the bucket", async () => {
  const before = calls.length;
  for (const suffix of ["", "catalog.json", "photos/.env.local", `photos/${id}/${hash}/original.jpg`, `photos/${id}/wrong/full.webp`, `photos/${id}%2f${hash}%2ffull.webp`]) {
    assert.equal((await worker.fetch(new Request(`https://photos.example/${suffix}`), env)).status, 404);
  }
  assert.equal((await worker.fetch(new Request(`https://photos.example/photos/${id}.webp`, { method: "POST" }), env)).status, 405);
  assert.equal(calls.length, before);
});

test("HEAD has no body and missing objects stay 404", async () => {
  const response = await worker.fetch(new Request(`https://photos.example/photos/${id}.webp`, { method: "HEAD" }), env);
  assert.equal(await response.text(), "");
  assert.equal((await worker.fetch(new Request(`https://photos.example/photos/${id}.webp`), { PHOTOS: { get: async () => null } })).status, 404);
});
