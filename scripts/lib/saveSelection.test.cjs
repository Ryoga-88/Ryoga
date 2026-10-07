const test = require("node:test");
const assert = require("node:assert/strict");

const load = () => import("../../app/photos/curate/saveSelection.mjs");
const ids = Array.from({ length: 125 }, (_, index) => `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`);

function success(batch, status) {
  return { ok: true, json: async () => ({ ok: true, statuses: Object.fromEntries(batch.map((id) => [id, status])), publishedCount: batch.length }) };
}

test("cross-page selections exceeding the API limit are saved in sequential batches", async () => {
  const { saveSelection } = await load();
  const requests = [];
  const saved = [];
  const progress = [];
  let awaitingAcknowledgement = false;
  const result = await saveSelection(ids, "included", {
    request: async (url, options) => {
      assert.equal(awaitingAcknowledgement, false, "each batch is applied before sending the next");
      awaitingAcknowledgement = true;
      assert.equal(url, "/api/photo-curation");
      assert.equal(options.method, "POST");
      assert.equal(options.headers["Content-Type"], "application/json");
      const body = JSON.parse(options.body);
      assert.equal(body.status, "included");
      requests.push(body.ids);
      return success(body.ids, body.status);
    },
    onSaved: async (response, batch) => {
      assert.ok(batch.every((id) => response.statuses[id] === "included"));
      await Promise.resolve();
      saved.push(...batch);
      awaitingAcknowledgement = false;
    },
    onProgress: (completed, total) => progress.push([completed, total]),
  });
  assert.deepEqual(requests.map((batch) => batch.length), [60, 60, 5]);
  assert.deepEqual(requests.flat(), ids);
  assert.deepEqual(saved, ids);
  assert.deepEqual(progress, [[0, 125], [60, 125], [120, 125]]);
  assert.deepEqual(result, { completedCount: 125 });
});

test("a later failed batch preserves its checks and all unsent checks", async () => {
  const { saveSelection } = await load();
  const selected = new Set(ids);
  let requests = 0;
  await assert.rejects(saveSelection(ids, "excluded", {
    request: async (_url, options) => {
      requests += 1;
      const body = JSON.parse(options.body);
      return requests === 1 ? success(body.ids, body.status) : { ok: false, json: async () => ({ error: "synthetic save failure" }) };
    },
    onSaved: (_response, batch) => batch.forEach((id) => selected.delete(id)),
  }), { message: "synthetic save failure", completedCount: 60 });
  assert.equal(requests, 2, "no later batches should be sent after failure");
  assert.deepEqual([...selected], ids.slice(60));
});

test("incomplete or conflicting acknowledgement never clears an unconfirmed batch", async (t) => {
  const { saveSelection } = await load();
  const batch = ids.slice(60, 120);
  for (const statuses of [undefined, [], {}, Object.fromEntries(batch.map((id) => [id, "excluded"])), Object.fromEntries(batch.slice(1).map((id) => [id, "included"]))]) {
    await t.test(JSON.stringify(statuses)?.slice(0, 70) || "missing statuses", async () => {
      let requests = 0;
      const acknowledged = [];
      await assert.rejects(saveSelection(ids, "included", {
        request: async (_url, options) => {
          requests += 1;
          const body = JSON.parse(options.body);
          return requests === 1 ? success(body.ids, body.status) : { ok: true, json: async () => ({ ok: true, statuses }) };
        },
        onSaved: (_response, savedBatch) => acknowledged.push(...savedBatch),
      }), { completedCount: 60 });
      assert.equal(requests, 2);
      assert.deepEqual(acknowledged, ids.slice(0, 60));
    });
  }
});

test("unreadable and failed network responses retain the whole selection", async (t) => {
  const { saveSelection } = await load();
  for (const [name, request] of [
    ["invalid JSON", async () => ({ ok: true, json: async () => { throw new SyntaxError("invalid JSON"); } })],
    ["network failure", async () => { throw new TypeError("Failed to fetch"); }],
    ["false success", async () => ({ ok: true, json: async () => ({ ok: false }) })],
  ]) {
    await t.test(name, async () => {
      let acknowledgements = 0;
      await assert.rejects(saveSelection(ids, "included", { request, onSaved: () => acknowledgements += 1 }), { completedCount: 0 });
      assert.equal(acknowledgements, 0);
    });
  }
});

test("an empty selection makes no requests", async () => {
  const { saveSelection } = await load();
  const result = await saveSelection([], "included", {
    request: () => assert.fail("unexpected save request"),
    onSaved: () => assert.fail("unexpected acknowledgement"),
    onProgress: () => assert.fail("unexpected progress"),
  });
  assert.deepEqual(result, { completedCount: 0 });
});
