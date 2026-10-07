const test = require("node:test");
const assert = require("node:assert/strict");

const load = () => import("../../app/photos/curate/selectionStorage.mjs");
const ids = [
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
  "00000000-0000-4000-8000-000000000003",
];
const validIds = new Set(ids);

function storageFor(backing = new Map()) {
  return {
    getItem: (key) => backing.get(key) ?? null,
    setItem: (key, value) => backing.set(key, String(value)),
  };
}

test("checked photos survive remounts and new storage instances", async () => {
  const { SELECTION_KEY, readSelection, updateSelection } = await load();
  const backing = new Map([["unrelated-setting", "keep"]]);
  const first = storageFor(backing);
  assert.deepEqual([...readSelection(first, validIds)], []);
  const selected = updateSelection(first, validIds, (current) => {
    current.add(ids[0]);
    current.add(ids[2]);
  });
  assert.deepEqual([...selected], [ids[0], ids[2]]);
  assert.deepEqual(JSON.parse(backing.get(SELECTION_KEY)), [ids[0], ids[2]]);
  assert.deepEqual([...readSelection(storageFor(backing), validIds)], [ids[0], ids[2]]);
  assert.equal(backing.get("unrelated-setting"), "keep");
});

test("unknown photos, duplicate IDs, and non-string values are pruned", async () => {
  const { SELECTION_KEY, readSelection, updateSelection } = await load();
  const storage = storageFor();
  storage.setItem(SELECTION_KEY, JSON.stringify([ids[0], ids[0], "missing-photo", null, 123, {}, [ids[1]], ids[2]]));
  assert.deepEqual([...readSelection(storage, validIds)], [ids[0], ids[2]]);

  const selected = updateSelection(storage, validIds, (current) => new Set([...current, ids[1], "missing-photo", null]));
  assert.deepEqual([...selected], [ids[0], ids[2], ids[1]]);
  assert.deepEqual(JSON.parse(storage.getItem(SELECTION_KEY)), [ids[0], ids[2], ids[1]]);
  assert.deepEqual([...readSelection(storage, new Set([ids[1]]))], [ids[1]], "a refreshed catalog excludes removed photos");
});

test("a stale tab applies its edit to the latest checks from another tab", async () => {
  const { readSelection, updateSelection } = await load();
  const backing = new Map();
  const firstTab = storageFor(backing);
  const secondTab = storageFor(backing);
  const staleSelection = readSelection(secondTab, validIds);

  updateSelection(firstTab, validIds, (current) => current.add(ids[0]));
  assert.equal(staleSelection.size, 0);
  updateSelection(secondTab, validIds, (current) => current.add(ids[1]));
  assert.deepEqual([...readSelection(firstTab, validIds)], [ids[0], ids[1]]);

  updateSelection(firstTab, validIds, (current) => {
    current.delete(ids[0]);
  });
  updateSelection(secondTab, validIds, (current) => current.add(ids[2]));
  assert.deepEqual([...readSelection(firstTab, validIds)], [ids[1], ids[2]], "removed checks are not resurrected by a stale tab");
});

test("explicit clear persists an empty selection", async () => {
  const { SELECTION_KEY, readSelection, updateSelection } = await load();
  const storage = storageFor();
  updateSelection(storage, validIds, () => new Set(ids));
  const cleared = updateSelection(storage, validIds, (current) => current.clear());
  assert.equal(cleared.size, 0);
  assert.equal(storage.getItem(SELECTION_KEY), "[]");
  assert.equal(readSelection(storage, validIds).size, 0);
});

test("malformed JSON and invalid stored shapes recover without blocking new checks", async (t) => {
  const { SELECTION_KEY, readSelection, updateSelection } = await load();
  for (const stored of ["{", "null", "{}", '"a-photo-id"', "true", "123"]) {
    await t.test(stored, () => {
      const storage = storageFor(new Map([[SELECTION_KEY, stored]]));
      assert.equal(readSelection(storage, validIds).size, 0);
      updateSelection(storage, validIds, (current) => current.add(ids[0]));
      assert.deepEqual([...readSelection(storage, validIds)], [ids[0]]);
    });
  }
});

test("unavailable storage errors propagate and never pretend a write succeeded", async () => {
  const { SELECTION_KEY, readSelection, updateSelection } = await load();
  const readError = new Error("Storage access denied");
  const inaccessible = { getItem: () => { throw readError; }, setItem: () => assert.fail("unexpected write") };
  assert.throws(() => readSelection(inaccessible, validIds), (error) => error === readError);
  assert.throws(() => updateSelection(inaccessible, validIds, () => assert.fail("unexpected updater")), (error) => error === readError);

  const storage = storageFor(new Map([[SELECTION_KEY, JSON.stringify([ids[0]])]]));
  const writeError = new Error("Quota exceeded");
  const fullStorage = { ...storage, setItem: () => { throw writeError; } };
  const inMemorySelection = readSelection(storage, validIds);
  assert.throws(() => updateSelection(fullStorage, validIds, (current) => current.add(ids[1])), (error) => error === writeError);
  assert.deepEqual([...readSelection(storage, validIds)], [ids[0]], "the prior durable selection is retained");
  assert.deepEqual([...inMemorySelection], [ids[0]], "a previously read Set remains independent");
});
