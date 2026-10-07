const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const { withManifestLock } = require("./photoManifestLock.cjs");

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "ryoga-photo-lock-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const filename = path.join(root, ".local/photos/publication.lock");
  await fs.mkdir(path.dirname(filename), { recursive: true });
  return { root, filename };
}

async function killedOwner(t, root) {
  const child = spawn(process.execPath, ["-e", `
    const { withManifestLock } = require(process.argv[1]);
    withManifestLock(process.argv[2], async () => {
      process.send("locked");
      await new Promise(() => setInterval(() => {}, 1000));
    }).catch(() => process.exit(1));
  `, require.resolve("./photoManifestLock.cjs"), root], { stdio: ["ignore", "ignore", "ignore", "ipc"] });
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL"); });
  const message = once(child, "message");
  await message;
  const exited = once(child, "exit");
  child.kill("SIGKILL");
  await exited;
  return child.pid;
}

test("a forcibly terminated owner leaves a recoverable lock and a retry succeeds", async (t) => {
  const f = await fixture(t);
  const pid = await killedOwner(t, f.root);
  const old = JSON.parse(await fs.readFile(f.filename, "utf8"));
  assert.equal(old.pid, pid);
  let called = false;
  await withManifestLock(f.root, async () => {
    called = true;
    const current = JSON.parse(await fs.readFile(f.filename, "utf8"));
    assert.equal(current.pid, process.pid);
    assert.notEqual(current.nonce, old.nonce);
  }, { timeoutMs: 1000 });
  assert.equal(called, true);
  await assert.rejects(fs.stat(f.filename), { code: "ENOENT" });
});

test("a live owner is never reclaimed and a timed-out contender never runs", async (t) => {
  const f = await fixture(t);
  await withManifestLock(f.root, async () => {
    const original = await fs.readFile(f.filename, "utf8");
    let called = false;
    await assert.rejects(withManifestLock(f.root, async () => { called = true; }, { timeoutMs: 20 }), { status: 409, safeToDisplay: true });
    assert.equal(called, false);
    assert.equal(await fs.readFile(f.filename, "utf8"), original);
  });
  await withManifestLock(f.root, async () => {});
});

test("malformed owner records and permission-denied probes are retained", async (t) => {
  const f = await fixture(t);
  for (const token of ["", "{", "{}", JSON.stringify({ pid: -1, nonce: crypto.randomUUID() }), JSON.stringify({ pid: process.pid, nonce: "invalid" })]) {
    await fs.writeFile(f.filename, token);
    await assert.rejects(withManifestLock(f.root, async () => assert.fail("must not run"), { timeoutMs: 0 }), { status: 409 });
    assert.equal(await fs.readFile(f.filename, "utf8"), token);
  }
  const token = JSON.stringify({ pid: 123456, nonce: crypto.randomUUID() });
  await fs.writeFile(f.filename, token);
  t.mock.method(process, "kill", () => { throw Object.assign(new Error("permission denied"), { code: "EPERM" }); });
  await assert.rejects(withManifestLock(f.root, async () => assert.fail("must not run"), { timeoutMs: 0 }), { status: 409 });
  assert.equal(await fs.readFile(f.filename, "utf8"), token);
});

test("concurrent processes reclaiming one dead owner still enter one at a time", async (t) => {
  const f = await fixture(t);
  await killedOwner(t, f.root);
  const log = path.join(f.root, "critical-sections.jsonl");
  const children = Array.from({ length: 6 }, () => spawn(process.execPath, ["-e", `
    const fs = require("node:fs/promises");
    const { withManifestLock } = require(process.argv[1]);
    withManifestLock(process.argv[2], async () => {
      await fs.appendFile(process.argv[3], JSON.stringify(["start", process.pid]) + "\\n");
      await new Promise(resolve => setTimeout(resolve, 20));
      await fs.appendFile(process.argv[3], JSON.stringify(["end", process.pid]) + "\\n");
    }, { timeoutMs: 5000 }).catch(() => process.exitCode = 1);
  `, require.resolve("./photoManifestLock.cjs"), f.root, log], { stdio: "ignore" }));
  const exits = await Promise.all(children.map((child) => once(child, "exit")));
  assert.ok(exits.every(([code]) => code === 0));
  const rows = (await fs.readFile(log, "utf8")).trim().split("\n").map(JSON.parse);
  assert.equal(rows.length, 12);
  for (let index = 0; index < rows.length; index += 2) {
    assert.equal(rows[index][0], "start");
    assert.deepEqual(rows[index + 1], ["end", rows[index][1]]);
  }
  await assert.rejects(fs.stat(f.filename), { code: "ENOENT" });
});

test("operation failure releases its own lock without swallowing the failure", async (t) => {
  const f = await fixture(t);
  await assert.rejects(withManifestLock(f.root, async () => { throw new Error("synthetic operation failure"); }), /synthetic operation failure/);
  await assert.rejects(fs.stat(f.filename), { code: "ENOENT" });
  await withManifestLock(f.root, async () => {});
});
