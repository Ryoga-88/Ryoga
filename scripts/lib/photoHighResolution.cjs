const fs = require("node:fs/promises");
const { constants } = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const sharp = require("sharp");
const { withManifestLock } = require("./photoManifestLock.cjs");

const run = promisify(execFile);
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const EXTENSION = /\.(?:jpe?g|hei[cf]|png|tiff?)$/i;
const MINIMUM_EDGE = 1200;
const hash = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");
const FAILURE_MESSAGES = {
  HEIC_CONVERSION: "HEIC画像の変換に失敗しました。macOSの画像変換権限・実行制限を確認してください。",
  IMAGE_CONVERSION: "高解像度画像の変換に失敗しました。取得した画像を確認してください。",
  PUBLICATION_WRITE: "高解像度写真の保存に失敗しました。元の掲載画像を保持して再試行してください。",
  PUBLIC_IMAGE_MISSING: "掲載対象のローカル公開画像が不足しています。画像を確認してください。",
  REFRESH_FAILED: "高解像度写真の更新に失敗しました。取得した画像と保存先を確認してください。",
};
const safeError = (reason = "PUBLICATION_WRITE") => Object.assign(new Error(FAILURE_MESSAGES[reason]), { safeToDisplay: true, reason });

async function json(filename) {
  return JSON.parse(await fs.readFile(filename, "utf8"));
}

// Resolve the project root once, then reject symlinks in every private/public
// descendant. Export records never authorize arbitrary filesystem paths.
async function confined(root, segments, { file = true } = {}) {
  const base = await fs.realpath(root);
  let current = base;
  for (const [index, segment] of segments.entries()) {
    if (!segment || segment === "." || segment === ".." || segment.includes("/") || segment.includes("\\")) return null;
    current = path.join(current, segment);
    const stat = await fs.lstat(current).catch(() => null);
    if (!stat || stat.isSymbolicLink()) return null;
    if (index < segments.length - 1 && !stat.isDirectory()) return null;
  }
  const stat = await fs.stat(current);
  if (file ? !stat.isFile() || !stat.size : !stat.isDirectory()) return null;
  return current;
}

async function readExport(root, id) {
  if (typeof id !== "string" || !UUID.test(id)) return null;
  const manifest = await confined(root, [".local", "photos", "high-resolution", "export-results.json"]);
  if (!manifest) return null;
  const data = await json(manifest);
  if (data.version !== 1 || !Array.isArray(data.photos)) return null;
  const records = data.photos.filter((photo) => photo && photo.id === id);
  if (records.length !== 1) return null;
  const record = records[0];
  if (record.status !== "exported" || typeof record.fileName !== "string"
      || path.basename(record.fileName) !== record.fileName || !EXTENSION.test(record.fileName)
      || record.fileName.slice(0, record.fileName.lastIndexOf(".")) !== id) return null;
  const source = await confined(root, [".local", "photos", "high-resolution", record.fileName]);
  if (!source) return null;
  return { source, stamp: JSON.stringify([record.status, record.fileName, record.width, record.height, record.modifiedAt]) };
}

async function dimensions(source) {
  try {
    const metadata = await sharp(source).metadata();
    return [metadata.width, metadata.height];
  } catch (error) {
    if (!/\.hei[cf]$/i.test(source)) throw error;
    const { stdout } = await run("/usr/bin/sips", ["-g", "pixelWidth", "-g", "pixelHeight", source], { timeout: 60000 });
    return [Number(stdout.match(/pixelWidth:\s+(\d+)/)?.[1]), Number(stdout.match(/pixelHeight:\s+(\d+)/)?.[1])];
  }
}

/** Return only a locally exported, confined, genuinely high-resolution source. */
async function highResolutionSource(root, id) {
  try {
    const exported = await readExport(root, id);
    if (!exported) return null;
    const size = await dimensions(exported.source);
    return size.every((value) => Number.isFinite(value) && value > 0) && Math.max(...size) >= MINIMUM_EDGE ? exported.source : null;
  } catch { return null; }
}

async function readRegular(filename) {
  const handle = await fs.open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    if (!(await handle.stat()).isFile()) throw safeError();
    return await handle.readFile();
  } finally { await handle.close(); }
}

async function privateDirectory(root, segments) {
  let current = await fs.realpath(root);
  for (const segment of segments) {
    if (!segment || segment === "." || segment === ".." || /[\\/]/.test(segment)) throw safeError();
    current = path.join(current, segment);
    await fs.mkdir(current, { mode: 0o700 }).catch((error) => { if (error.code !== "EEXIST") throw error; });
    const stat = await fs.lstat(current);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw safeError();
  }
  return current;
}

async function render(root, source, bytes) {
  let input = bytes;
  let temporary;
  try {
    if (/\.hei[cf]$/i.test(source)) {
      const base = await privateDirectory(root, [".local", "photos", "high-resolution"]);
      temporary = await fs.mkdtemp(path.join(base, ".conversion-"));
      const snapshot = path.join(temporary, `source${path.extname(source).toLowerCase()}`);
      const converted = path.join(temporary, "converted.jpg");
      await fs.writeFile(snapshot, bytes, { mode: 0o600, flag: "wx" });
      await run("/usr/bin/sips", ["-s", "format", "jpeg", snapshot, "--out", converted], { timeout: 60000 });
      // macOS sips can exit successfully while its sandboxed HEIC decoder
      // writes an incomplete JPEG. Validate the output before publication;
      // the WebP conversion below also forces a complete pixel decode.
      const convertedMetadata = await sharp(converted).metadata();
      if (convertedMetadata.format !== "jpeg" || !convertedMetadata.width || !convertedMetadata.height) throw safeError("HEIC_CONVERSION");
      input = converted;
    }
    // Sharp strips EXIF, GPS, ICC and other source metadata by default.
    const full = await sharp(input).rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 86 }).toBuffer({ resolveWithObject: true });
    if (Math.max(full.info.width, full.info.height) < MINIMUM_EDGE) return null;
    const thumbnail = await sharp(input).rotate().resize({ width: 500, height: 500, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 76 }).toBuffer();
    return { full: full.data, thumbnail, width: full.info.width, height: full.info.height };
  } catch {
    // Errors from sips/libvips can contain private paths and source metadata.
    throw safeError(/\.hei[cf]$/i.test(source) ? "HEIC_CONVERSION" : "IMAGE_CONVERSION");
  } finally {
    if (temporary) await fs.rm(temporary, { recursive: true, force: true });
  }
}

async function publication(root) {
  const filename = await confined(root, ["app", "contents", "curated-photos.json"]);
  if (!filename) throw safeError();
  const data = await json(filename);
  if (data.version !== 1 || !data.decisions || !Array.isArray(data.photos)) throw safeError();
  return { filename, data };
}

function localDelivery(photo) {
  return photo.url === `/images/photos/${photo.id}.webp` && photo.thumbnail === `/images/photos/${photo.id}-thumb.webp`;
}

function deliveryStamp(photo) {
  return JSON.stringify([photo.url, photo.thumbnail, photo.sourceVersion, photo.deliveryVersion]);
}

async function publicFiles(root, id) {
  const full = await confined(root, ["public", "images", "photos", `${id}.webp`]);
  const thumbnail = await confined(root, ["public", "images", "photos", `${id}-thumb.webp`]);
  return full && thumbnail ? { full, thumbnail } : null;
}

async function writeStaged(filename, bytes) {
  const temporary = `${filename}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, bytes, { mode: 0o600, flag: "wx" });
    return temporary;
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

async function commit(root, expected, generated, runId) {
  return withManifestLock(root, async () => {
    const latest = await publication(root);
    const photo = latest.data.photos.find((item) => item.id === expected.id);
    if (!photo || latest.data.decisions[expected.id] !== "included" || !localDelivery(photo)
        || deliveryStamp(photo) !== expected.delivery) return "skipped";
    const files = await publicFiles(root, expected.id);
    const exported = await readExport(root, expected.id);
    if (!files || !exported || exported.stamp !== expected.sourceStamp || exported.source !== expected.source) return "skipped";
    const [oldFull, oldThumbnail, source] = await Promise.all([readRegular(files.full), readRegular(files.thumbnail), readRegular(exported.source)]);
    if (hash(oldFull) !== expected.fullHash || hash(oldThumbnail) !== expected.thumbnailHash || hash(source) !== expected.sourceHash) return "skipped";

    const backup = await privateDirectory(root, [".local", "photos", "high-resolution-backups", runId, expected.id]);
    await fs.writeFile(path.join(backup, "full.webp"), oldFull, { mode: 0o600, flag: "wx" });
    await fs.writeFile(path.join(backup, "thumbnail.webp"), oldThumbnail, { mode: 0o600, flag: "wx" });
    // Retain an exact pre-commit manifest for recovery, exclusively in .local.
    await fs.writeFile(path.join(backup, "manifest.json"), await fs.readFile(latest.filename), { mode: 0o600, flag: "wx" });
    const next = { ...latest.data, photos: latest.data.photos.map((item) => item.id === expected.id
      ? { ...item, width: generated.width, height: generated.height, aspect: `${generated.width} / ${generated.height}` } : item) };
    const staged = [];
    let fullReplaced = false;
    let thumbnailReplaced = false;
    try {
      const fullStage = await writeStaged(files.full, generated.full); staged.push(fullStage);
      const thumbnailStage = await writeStaged(files.thumbnail, generated.thumbnail); staged.push(thumbnailStage);
      const manifestStage = await writeStaged(latest.filename, `${JSON.stringify(next, null, 2)}\n`); staged.push(manifestStage);
      await fs.rename(fullStage, files.full); fullReplaced = true;
      await fs.rename(thumbnailStage, files.thumbnail); thumbnailReplaced = true;
      await fs.rename(manifestStage, latest.filename);
      return "upgraded";
    } catch {
      // Manifest is committed last. Restore any images replaced before a failed
      // write, while the same shared lock still excludes curation and uploads.
      for (const [filename, bytes, changed] of [[files.full, oldFull, fullReplaced], [files.thumbnail, oldThumbnail, thumbnailReplaced]]) {
        if (!changed) continue;
        const rollback = await writeStaged(filename, bytes); staged.push(rollback);
        await fs.rename(rollback, filename);
      }
      throw safeError();
    } finally {
      await Promise.all(staged.map((filename) => fs.rm(filename, { force: true }).catch(() => {})));
    }
  });
}

/** Dry-run by default; upgrade one currently included low-resolution photo at a time. */
async function refreshHighResolutionPhotos(root = process.cwd(), { write = false, onProgress = () => {} } = {}) {
  const result = { inspected: 0, candidates: 0, ready: 0, upgraded: 0, pending: 0, skipped: 0, failed: 0 };
  const runId = crypto.randomUUID();
  async function recordFailure(id, error) {
    const reason = Object.hasOwn(FAILURE_MESSAGES, error?.reason) ? error.reason : "REFRESH_FAILED";
    result.failed++;
    result.failureReasons ||= {};
    result.failureReasons[reason] = (result.failureReasons[reason] || 0) + 1;
    await onProgress({ id, status: "failed", reason, message: FAILURE_MESSAGES[reason] });
  }
  let initial;
  try { initial = await publication(root); } catch { throw safeError(); }
  for (const photo of initial.data.photos) {
    if (!photo || !UUID.test(photo.id) || initial.data.decisions[photo.id] !== "included") continue;
    result.inspected++;
    try {
      const files = await publicFiles(root, photo.id);
      if (!files) { await recordFailure(photo.id, safeError("PUBLIC_IMAGE_MISSING")); continue; }
      const [oldFull, oldThumbnail] = await Promise.all([readRegular(files.full), readRegular(files.thumbnail)]);
      const metadata = await sharp(oldFull).metadata();
      if (Math.max(metadata.width, metadata.height) >= MINIMUM_EDGE) continue;
      result.candidates++;
      if (!localDelivery(photo)) { result.skipped++; await onProgress({ id: photo.id, status: "skipped" }); continue; }
      const source = await highResolutionSource(root, photo.id);
      const exported = source && await readExport(root, photo.id);
      if (!exported || exported.source !== source) { result.pending++; await onProgress({ id: photo.id, status: "pending" }); continue; }
      result.ready++;
      if (!write) { await onProgress({ id: photo.id, status: "ready" }); continue; }
      const bytes = await readRegular(source);
      const generated = await render(root, source, bytes);
      if (!generated) { result.ready--; result.pending++; await onProgress({ id: photo.id, status: "pending" }); continue; }
      const expected = { id: photo.id, source, sourceStamp: exported.stamp, sourceHash: hash(bytes), fullHash: hash(oldFull), thumbnailHash: hash(oldThumbnail), delivery: deliveryStamp(photo) };
      await onProgress({ id: photo.id, status: "prepared" });
      const status = await commit(root, expected, generated, runId);
      result[status]++;
      await onProgress({ id: photo.id, status });
    } catch (error) {
      await recordFailure(photo.id, error);
    }
  }
  return result;
}

module.exports = { highResolutionSource, refreshHighResolutionPhotos, MINIMUM_EDGE };
