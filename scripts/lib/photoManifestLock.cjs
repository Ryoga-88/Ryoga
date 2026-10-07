const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const NONCE = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

function absentOwner(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0 || pid > 2147483647) return false;
  try { process.kill(pid, 0); return false; }
  // EPERM and all ambiguous results retain the lock. A recycled, live PID also
  // retains it: a timeout is preferable to concurrent publication writes.
  catch (error) { return error.code === "ESRCH"; }
}

function recoverDeadOwner(filename) {
  let original;
  let owner;
  try {
    const stat = fsSync.lstatSync(filename);
    if (!stat.isFile() || stat.isSymbolicLink()) return false;
    original = fsSync.readFileSync(filename, "utf8");
    owner = JSON.parse(original);
  } catch (error) {
    if (error.code === "ENOENT") return true;
    return false;
  }
  if (!owner || typeof owner.nonce !== "string" || !NONCE.test(owner.nonce) || !absentOwner(owner.pid)) return false;

  // Only one retrier may reclaim this particular owner's token. Without this
  // claim, two processes could both inspect the dead PID and the second could
  // unlink a successor's newly acquired lock. Keep the claim/check/unlink block
  // synchronous. If a reclaimer itself is forcibly killed inside this tiny
  // section, retain its claim for manual inspection instead of guessing.
  const claim = `${filename}.recover-${owner.nonce}`;
  let handle;
  try { handle = fsSync.openSync(claim, "wx", 0o600); }
  catch (error) { if (error.code === "EEXIST") return false; throw error; }
  try {
    fsSync.writeFileSync(handle, JSON.stringify({ pid: process.pid, owner: owner.nonce }));
    if (fsSync.readFileSync(filename, "utf8") !== original || !absentOwner(owner.pid)) return false;
    fsSync.unlinkSync(filename);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return true;
    throw error;
  } finally {
    fsSync.closeSync(handle);
    fsSync.rmSync(claim, { force: true });
  }
}

// Shared by the local curator, image refreshes and the R2 uploader. Uploads and
// refreshes hold it only for commits; the existing curator holds it through its
// whole image-conversion batch. Other writers time out safely and can retry.
async function withManifestLock(root, operation, { timeoutMs = 30000 } = {}) {
  const filename = path.join(root, ".local/photos/publication.lock");
  await fs.mkdir(path.dirname(filename), { recursive: true });
  const token = JSON.stringify({ pid: process.pid, nonce: crypto.randomUUID() });
  const deadline = Date.now() + timeoutMs;
  const temporary = `${filename}.${crypto.randomUUID()}.tmp`;
  let acquired = false;
  try {
    // Publish a complete token atomically. A crash between exclusive open and
    // write must not leave an empty lock whose owner cannot be established.
    await fs.writeFile(temporary, token, { flag: "wx", mode: 0o600 });
    while (!acquired) {
      try { await fs.link(temporary, filename); acquired = true; }
      catch (error) {
        if (error.code !== "EEXIST") throw error;
        if (recoverDeadOwner(filename)) continue;
        if (Date.now() >= deadline) {
          throw Object.assign(new Error("写真の保存ロックを取得できませんでした。ほかの写真処理の終了後に再試行してください。処理が動いていない場合は、残ったロックの確認が必要です。"), { status: 409, safeToDisplay: true });
        }
        await new Promise((resolve) => setTimeout(resolve, Math.min(100, deadline - Date.now())));
      }
    }
    return await operation();
  } finally {
    try {
      if (acquired && fsSync.readFileSync(filename, "utf8") === token) fsSync.unlinkSync(filename);
    } catch (error) { if (error.code !== "ENOENT") throw error; }
    finally { await fs.rm(temporary, { force: true }); }
  }
}

module.exports = { withManifestLock };
