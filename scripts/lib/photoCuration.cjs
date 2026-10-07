const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const sharp = require("sharp");
const { publicPhotoMetadata } = require("./publicPhotoMetadata.cjs");
const { writePhotoMap } = require("./photoMap.cjs");
const { withManifestLock } = require("./photoManifestLock.cjs");
const { highResolutionSource, MINIMUM_EDGE } = require("./photoHighResolution.cjs");

const run = promisify(execFile);
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const STATUSES = new Set(["included", "excluded", "unreviewed"]);
const EXCLUDED_COUNTRIES = new Set(["JP", "CN", "ES", "AL"]);

function highResolutionPending(photo) {
  return Boolean(photo && Number.isFinite(photo.width) && Number.isFinite(photo.height)
    && photo.width > 0 && photo.height > 0 && Math.max(photo.width, photo.height) < MINIMUM_EDGE);
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function localAccessAllowed(headers, { mutation = false, navigation = false, env = process.env } = {}) {
  if (env.NODE_ENV !== "development" || env.PHOTO_CURATION !== "1") return false;
  const host = headers.get("host") || "";
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host)) return false;
  const forwardedHost = headers.get("x-forwarded-host");
  if (forwardedHost && forwardedHost !== host) return false;
  const site = headers.get("sec-fetch-site");
  const topLevelNavigation = navigation && !mutation && headers.get("sec-fetch-mode") === "navigate" && headers.get("sec-fetch-dest") === "document";
  if (site && site !== "same-origin" && site !== "none" && !topLevelNavigation) return false;
  const origin = headers.get("origin");
  if (mutation && !origin) return false;
  if (origin && origin !== `http://${host}` && origin !== `https://${host}`) return false;
  return true;
}

async function readJson(filename, fallback) {
  try {
    return JSON.parse(await fs.readFile(filename, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT" && fallback !== undefined) return fallback;
    throw error;
  }
}

async function atomicJson(filename, value) {
  await fs.mkdir(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
    await fs.rename(temporary, filename);
  } finally {
    await fs.rm(temporary, { force: true });
  }
}

function createStore(root = process.cwd()) {
  const localDir = path.join(root, ".local", "photos");
  const catalogPath = path.join(localDir, "catalog.json");
  const manifestPath = path.join(root, "app", "contents", "curated-photos.json");
  const publishedDir = path.join(root, "public", "images", "photos");
  let catalogCache;
  let catalogStamp;
  let queue = Promise.resolve();
  const previews = new Map();
  let imageQueue = Promise.resolve();

  async function catalog() {
    const stat = await fs.stat(catalogPath).catch(() => {
      throw httpError(503, "写真の取り込みが必要です。npm run photos:import を実行してください。");
    });
    const stamp = `${stat.mtimeMs}:${stat.size}`;
    if (stamp !== catalogStamp) {
      const data = await readJson(catalogPath);
      // Recheck eligibility here so a stale import cannot reintroduce excluded countries.
      data.photos = data.photos.filter((photo) => UUID.test(photo.id) && photo.countryCode && !EXCLUDED_COUNTRIES.has(photo.countryCode));
      catalogCache = data;
      catalogStamp = stamp;
    }
    return catalogCache;
  }

  async function state() {
    const data = await readJson(manifestPath, { version: 1, decisions: {}, photos: [] });
    if (data.version !== 1 || !data.decisions || !Array.isArray(data.photos)) {
      throw httpError(500, "掲載データを読み込めませんでした。");
    }
    return data;
  }

  async function photoById(id) {
    if (!UUID.test(id)) throw httpError(404, "写真が見つかりません。");
    const data = await catalog();
    const photo = data.photos.find((item) => item.id === id);
    if (!photo) throw httpError(404, "写真が見つかりません。");
    return { photo, data };
  }

  async function safeSource(filename, library) {
    if (!filename) throw httpError(422, "この写真はMac内に画像がありません。");
    const [source, base] = await Promise.all([fs.realpath(filename), fs.realpath(library)]);
    if (!source.startsWith(`${base}${path.sep}`)) throw httpError(403, "写真の保存場所が正しくありません。");
    return source;
  }

  async function imageBuffer(photo, data, size, forPublication = false) {
    let filename = photo.previewPath;
    if (forPublication) filename = photo.renderPath || (photo.hasEdits ? photo.previewPath : photo.originalPath || photo.previewPath);
    // PhotoKit exports the current edited rendition. Its separate validator
    // confines private exports and checks actual resolution before reuse.
    const recovered = forPublication ? await highResolutionSource(root, photo.id) : null;
    const source = recovered || await safeSource(filename, data.sourceLibrary);
    let input = source;
    let converted;
    try {
      if (/\.hei[cf]$/i.test(source)) {
        await fs.mkdir(localDir, { recursive: true });
        converted = path.join(localDir, `${crypto.randomUUID()}.jpg`);
        await run("/usr/bin/sips", ["-s", "format", "jpeg", source, "--out", converted], { timeout: 60000 });
        input = converted;
      }
      return await sharp(input).rotate().resize({
        width: size === "thumb" ? 500 : 2400,
        height: size === "thumb" ? 500 : 2400,
        fit: "inside", withoutEnlargement: true,
      }).webp({ quality: size === "thumb" ? 76 : 86 }).toBuffer({ resolveWithObject: true });
    } finally {
      if (converted) await fs.rm(converted, { force: true });
    }
  }

  async function preview(id, size) {
    if (size !== "thumb" && size !== "preview") throw httpError(400, "画像サイズが正しくありません。");
    const { photo, data } = await photoById(id);
    const source = await safeSource(photo.previewPath, data.sourceLibrary);
    const stat = await fs.stat(source);
    const fingerprint = crypto.createHash("sha256").update(`${source}:${stat.mtimeMs}:${stat.size}`).digest("hex").slice(0, 12);
    const key = `${id}-${fingerprint}-${size}`;
    const cachePath = path.join(localDir, "cache", `${key}.webp`);
    try { return await fs.readFile(cachePath); } catch (error) { if (error.code !== "ENOENT") throw error; }
    if (!previews.has(key)) {
      // Bound work: the browser may request an entire page of thumbnails at once.
      const task = imageQueue.then(async () => {
        const result = await imageBuffer(photo, data, size);
        await fs.mkdir(path.dirname(cachePath), { recursive: true });
        await fs.writeFile(cachePath, result.data);
        return result.data;
      });
      imageQueue = task.catch(() => {});
      previews.set(key, task);
      task.finally(() => previews.delete(key)).catch(() => {});
    }
    return previews.get(key);
  }

  async function clientData() {
    const [data, saved] = await Promise.all([catalog(), state()]);
    const published = new Map(saved.photos.map((photo) => [photo.id, photo]));
    return {
      importedAt: data.importedAt,
      publishedCount: saved.photos.length,
      photos: data.photos.map((photo) => ({
        id: photo.id, title: photo.title, category: photo.category, countryCode: photo.countryCode,
        capturedAt: photo.capturedAt, date: photo.date, width: photo.width, height: photo.height,
        ...publicPhotoMetadata(photo),
        favorite: photo.favorite, available: photo.available, hasOriginal: Boolean(photo.originalPath),
        status: saved.decisions[photo.id] || "unreviewed",
        highResolutionPending: saved.decisions[photo.id] === "included" && highResolutionPending(published.get(photo.id)),
        thumbnailUrl: `/api/photo-curation/image/${photo.id}?size=thumb`,
        previewUrl: `/api/photo-curation/image/${photo.id}?size=preview`,
      })),
    };
  }

  async function applyDecision(ids, status) {
    if (!Array.isArray(ids) || !ids.length || ids.length > 120 || ids.some((id) => typeof id !== "string" || !UUID.test(id)) || !STATUSES.has(status)) {
      throw httpError(400, "写真と掲載状態を確認してください。一度に選べるのは120枚までです。");
    }
    const data = await catalog();
    const uniqueIds = [...new Set(ids)];
    const candidates = new Map(data.photos.map((photo) => [photo.id, photo]));
    if (uniqueIds.some((id) => !candidates.has(id))) throw httpError(400, "候補にない写真が含まれています。");
    const current = await state();
    const published = new Map(current.photos.map((photo) => [photo.id, photo]));
    const created = [];
    try {
      if (status === "included") {
        await fs.mkdir(publishedDir, { recursive: true });
        for (const id of uniqueIds) {
          if (published.has(id)) continue;
          const photo = candidates.get(id);
          const full = await imageBuffer(photo, data, "preview", true);
          const thumb = await sharp(full.data).resize({ width: 500, height: 500, fit: "inside", withoutEnlargement: true }).webp({ quality: 76 }).toBuffer();
          const fullPath = path.join(publishedDir, `${id}.webp`);
          const thumbPath = path.join(publishedDir, `${id}-thumb.webp`);
          // Assets are written before the manifest; /photos never points at incomplete files.
          created.push(fullPath, thumbPath);
          await fs.writeFile(fullPath, full.data);
          await fs.writeFile(thumbPath, thumb);
          published.set(id, {
            id, url: `/images/photos/${id}.webp`, thumbnail: `/images/photos/${id}-thumb.webp`,
            width: full.info.width, height: full.info.height,
            aspect: `${full.info.width} / ${full.info.height}`, title: photo.title,
            category: photo.category, countryCode: photo.countryCode, date: photo.date,
            ...publicPhotoMetadata(photo),
            favorite: String(Boolean(photo.favorite)),
          });
        }
      }
      const decisions = { ...current.decisions };
      for (const id of uniqueIds) {
        if (status === "unreviewed") delete decisions[id];
        else decisions[id] = status;
        if (status !== "included") published.delete(id);
      }
      const next = { version: 1, updatedAt: new Date().toISOString(), decisions, photos: [...published.values()].sort((a, b) => (b.date || "").localeCompare(a.date || "") || a.id.localeCompare(b.id)) };
      // One durable commit contains both decisions and the published list.
      await atomicJson(manifestPath, next);
      if (status !== "included") {
        for (const id of uniqueIds) {
          await Promise.all([`${id}.webp`, `${id}-thumb.webp`].map((name) => fs.rm(path.join(publishedDir, name), { force: true }).catch(() => {})));
        }
      }
      // Derived from the committed list, so a failure here never undoes the decision;
      // `npm run photos:map` rebuilds it.
      const mapUpdated = await writePhotoMap(root, data.photos, next.photos).then(() => true, () => false);
      return {
        ok: true, statuses: Object.fromEntries(uniqueIds.map((id) => [id, status])),
        highResolutionPending: Object.fromEntries(uniqueIds.map((id) => [id, status === "included" && highResolutionPending(published.get(id))])),
        selectedCount: next.photos.length, mapUpdated,
      };
    } catch (error) {
      await Promise.all(created.map((filename) => fs.rm(filename, { force: true }).catch(() => {})));
      throw error;
    }
  }

  function decide(ids, status) {
    const operation = queue.then(() => withManifestLock(root, () => applyDecision(ids, status)));
    queue = operation.catch(() => {});
    return operation;
  }

  return { clientData, preview, decide, state, catalog };
}

module.exports = { createStore, localAccessAllowed, UUID };
