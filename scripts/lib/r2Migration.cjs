const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const sharp = require("sharp");
const { PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { readConfig } = require("./r2Preview.cjs");
const { publicPhotoMetadata } = require("./publicPhotoMetadata.cjs");
const { withManifestLock } = require("./photoManifestLock.cjs");

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const EXCLUDED = new Set(["JP", "CN", "ES", "AL"]);
const MIN_FULL_EDGE = 1200;
const CACHE_CONTROL = "public, max-age=31536000, immutable";
const sources = new WeakMap();
const digest = (body, algorithm = "sha256", encoding = "hex") => crypto.createHash(algorithm).update(body).digest(encoding);
const fail = (message) => Object.assign(new Error(message), { safeToDisplay: true });

function validateManifest(manifest) {
  if (manifest.version !== 1 || !Array.isArray(manifest.photos) || !manifest.decisions || typeof manifest.decisions !== "object" || Array.isArray(manifest.decisions)) {
    throw fail("選別結果の形式を確認してください。");
  }
  if (new Set(manifest.photos.map((photo) => photo.id)).size !== manifest.photos.length) throw fail("写真のIDが重複しています。");
}

function validatePhoto(photo) {
  if (!UUID.test(photo.id) || !/^[A-Z]{2}$/.test(photo.countryCode) || EXCLUDED.has(photo.countryCode)) throw fail("掲載対象のID・国を確認してください。");
}

function validateConfig(config) {
  let url;
  try { url = new URL(config.publicBase); } catch { throw fail("R2配信先の形式を確認してください。"); }
  if (config.bucket !== "ryoga-photos" || url.protocol !== "https:" || !url.hostname.endsWith(".workers.dev") || url.username || url.password || url.port || url.search || url.hash || url.pathname !== "/") {
    throw fail("ryoga-photos と HTTPS の workers.dev 配信先だけを使用します。");
  }
}

async function readManifest(filename) {
  const manifest = JSON.parse(await fs.readFile(filename, "utf8"));
  validateManifest(manifest);
  return manifest;
}

async function readAsset(assets, id, variant) {
  const filename = path.join(assets, `${id}${variant === "thumb" ? "-thumb" : ""}.webp`);
  let source;
  try { source = await fs.realpath(filename); }
  catch { throw fail("掲載対象の公開用WebPが不足しています。ローカル画像を生成してから再実行してください。"); }
  if (!source.startsWith(`${assets}${path.sep}`)) throw fail("公開画像フォルダの外は読み込めません。");
  const body = await fs.readFile(source);
  let metadata;
  try { metadata = await sharp(body).metadata(); }
  catch { throw fail("公開用WebPの読み込みに失敗しました。"); }
  if (metadata.format !== "webp" || metadata.exif || metadata.xmp || metadata.iptc || metadata.icc || metadata.pages > 1 || !metadata.width || !metadata.height) {
    throw fail("メタデータを除去した静止画WebPだけをアップロードできます。");
  }
  if (Math.max(metadata.width, metadata.height) > (variant === "thumb" ? 500 : 2400)) throw fail("公開画像のサイズ上限（拡大2400px・一覧500px）を超えています。");
  return { body, metadata };
}

// Only delivery fields participate in source-version checks. Concurrent changes to
// titles, dates, broad place labels, decisions for other photos, etc. are preserved.
function deliveryVersion(photo) {
  return JSON.stringify([photo.url, photo.thumbnail, photo.width, photo.height, photo.aspect, photo.countryCode]);
}

async function buildPlan(root, config, { allowPreview = false, readyOnly = false, pendingOnly = false } = {}) {
  validateConfig(config);
  const manifestPath = path.join(root, "app/contents/curated-photos.json");
  const manifest = await readManifest(manifestPath);
  const selected = manifest.photos.filter((photo) => manifest.decisions[photo.id] === "included");
  if (!selected.length) throw fail("「掲載に決定」した写真がありません。");
  const rootPath = await fs.realpath(root);
  const assets = await fs.realpath(path.join(root, "public/images/photos"));
  if (!assets.startsWith(`${rootPath}${path.sep}`)) throw fail("公開画像フォルダの外は読み込めません。");
  const photos = [];
  const objects = [];
  const qualityIssues = [];
  const deferredPhotos = [];
  const completedPhotos = [];
  const versions = new Map();
  for (const photo of selected) {
    validatePhoto(photo);
    versions.set(photo.id, deliveryVersion(photo));
    let fullMetadata;
    const photoObjects = [];
    const variants = {};
    for (const variant of ["full", "thumb"]) {
      const { body, metadata } = await readAsset(assets, photo.id, variant);
      const sha256 = digest(body);
      // Every byte change has a fresh URL, including an upgrade from a preview.
      const key = `photos/${photo.id}/${sha256}/${variant}.webp`;
      const object = { id: photo.id, variant, key, url: `${config.publicBase.replace(/\/$/, "")}/${key}`, sha256, bytes: body.length, contentMD5: digest(body, "md5", "base64") };
      photoObjects.push(object);
      variants[variant] = object;
      if (variant === "full") fullMetadata = metadata;
    }
    if (Math.max(fullMetadata.width, fullMetadata.height) < MIN_FULL_EDGE) {
      const issue = { id: photo.id, width: fullMetadata.width, height: fullMetadata.height };
      if (readyOnly) { deferredPhotos.push(issue); continue; }
      qualityIssues.push(issue);
    }
    const plannedPhoto = {
      id: photo.id, title: String(photo.title || "写真"), category: String(photo.category || photo.countryCode), countryCode: photo.countryCode,
      date: typeof photo.date === "string" ? photo.date : null, ...publicPhotoMetadata(photo),
      width: fullMetadata.width, height: fullMetadata.height, aspect: `${fullMetadata.width} / ${fullMetadata.height}`,
      url: variants.full.url, thumbnail: variants.thumb.url,
    };
    // A saved pair is a checkpoint: both public objects were verified before
    // these URLs were committed. Only skip when current local bytes AND delivery
    // dimensions still match that checkpoint. The default mode re-verifies all.
    if (pendingOnly && ["url", "thumbnail", "width", "height", "aspect"].every((key) => photo[key] === plannedPhoto[key])) {
      completedPhotos.push(photo.id);
      continue;
    }
    objects.push(...photoObjects);
    photos.push(plannedPhoto);
  }
  if (!photos.length && !completedPhotos.length) throw fail("移行できる1200px以上の拡大用画像がありません。原本を取得・再生成してから再実行してください。");
  const plan = { photos, objects, deferredPhotos, completedPhotos, totalBytes: objects.reduce((sum, object) => sum + object.bytes, 0), qualityIssues, allowPreview: Boolean(allowPreview) };
  // Private filesystem paths and manifest fields never appear in plan summaries.
  sources.set(plan, { root, manifestPath, assets, versions, bucket: config.bucket, publicBase: config.publicBase });
  return plan;
}

function currentPhoto(manifest, photo, source, expectedVersion) {
  const current = manifest.photos.find((entry) => entry.id === photo.id);
  if (!current || manifest.decisions[photo.id] !== "included") throw fail("対象の選別結果が変わったため停止しました。掲載対象を確認してください。");
  validatePhoto(current);
  if (deliveryVersion(current) !== expectedVersion) throw fail("対象画像の掲載情報が変わったため停止しました。再実行してください。");
  return current;
}

async function verifySource(source, photo, objects) {
  const result = [];
  for (const object of objects) {
    const asset = await readAsset(source.assets, photo.id, object.variant);
    if (digest(asset.body) !== object.sha256) throw fail("ローカル画像が計画時から変わったため停止しました。再実行してください。");
    result.push({ ...object, body: asset.body });
  }
  return result;
}

function safeFailure(error) {
  if (error.safeToDisplay) return error;
  const status = error.$metadata?.httpStatusCode;
  return fail(`R2移行を中断しました${Number.isInteger(status) ? `（HTTP ${status}）` : ""}。保存済みの写真は維持されています。接続・画像を確認して再実行してください。`);
}

async function transferObject(object, config, client, fetchImpl) {
  let reused = false;
  try {
    await client.send(new PutObjectCommand({
      Bucket: config.bucket, Key: object.key, Body: object.body, ContentType: "image/webp", ContentMD5: object.contentMD5,
      CacheControl: CACHE_CONTROL, StorageClass: "STANDARD", IfNoneMatch: "*",
    }));
  } catch (error) {
    if (error.$metadata?.httpStatusCode !== 412) throw error;
    const existing = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: object.key }));
    const body = Buffer.from(await existing.Body.transformToByteArray());
    if (digest(body) !== object.sha256) throw fail("R2の同名画像と内容が異なるため、上書きせず停止しました。");
    reused = true;
  }
  const response = await fetchImpl(object.url, { redirect: "error", signal: AbortSignal.timeout(30000), headers: { "Cache-Control": "no-cache" } });
  if (!response.ok || !/^image\/webp(?:;|$)/i.test(response.headers.get("content-type") || "")) throw fail(`画像配信の確認に失敗しました（HTTP ${response.status}）。`);
  if (digest(Buffer.from(await response.arrayBuffer())) !== object.sha256) throw fail("配信画像がアップロード元と一致しないため停止しました。");
  return reused;
}

async function commitPhoto(source, photo, objects, expectedVersion) {
  await verifySource(source, photo, objects);
  // A fresh read occurs for EACH checkpoint. Never write the initial snapshot
  // back after an asynchronous upload. Keep the final read/rename synchronous
  // so this process cannot interleave its own checkpoint writers.
  const temporary = `${source.manifestPath}.${crypto.randomUUID()}.tmp`;
  try {
    const initialText = fsSync.readFileSync(source.manifestPath, "utf8");
    const current = JSON.parse(initialText);
    validateManifest(current);
    const entry = currentPhoto(current, photo, source, expectedVersion);
    Object.assign(entry, { url: photo.url, thumbnail: photo.thumbnail, width: photo.width, height: photo.height, aspect: photo.aspect });
    // Preserve even the existing updatedAt: this changes delivery, not decisions.
    fsSync.writeFileSync(temporary, `${JSON.stringify(current, null, 2)}\n`, { mode: 0o600 });
    if (fsSync.readFileSync(source.manifestPath, "utf8") !== initialText) throw fail("保存中に選別結果が変わったため停止しました。再実行してください。");
    fsSync.renameSync(temporary, source.manifestPath);
    source.versions.set(photo.id, deliveryVersion(entry));
  } finally { fsSync.rmSync(temporary, { force: true }); }
}

async function uploadPlan(plan, config, { client, fetchImpl = fetch, concurrency = 4, onProgress = () => {} } = {}) {
  const source = sources.get(plan);
  validateConfig(config);
  if (!source || source.bucket !== config.bucket || source.publicBase !== config.publicBase) throw fail("同じ配信先で作成した移行計画を使用してください。");
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) throw fail("同時処理数は1〜8にしてください。");
  if (!plan.allowPreview && plan.qualityIssues.length) throw fail(`拡大用画像が1200px未満の写真が${plan.qualityIssues.length}枚あります。原本を取得・再生成してから移行してください。`);
  if (!client?.send) throw fail("R2クライアントが未設定です。");
  const result = { uploaded: 0, reused: 0, committed: 0 };
  let cursor = 0;
  let failure;
  let commits = Promise.resolve();
  async function worker() {
    while (!failure && cursor < plan.photos.length) {
      const photo = plan.photos[cursor++];
      try {
        const expectedVersion = source.versions.get(photo.id);
        currentPhoto(await readManifest(source.manifestPath), photo, source, expectedVersion);
        const objects = plan.objects.filter((object) => object.id === photo.id);
        const assets = await verifySource(source, photo, objects);
        for (const object of assets) {
          if (failure) return;
          currentPhoto(await readManifest(source.manifestPath), photo, source, expectedVersion);
          const reused = await transferObject(object, config, client, fetchImpl);
          result[reused ? "reused" : "uploaded"] += 1;
        }
        if (failure) return;
        const checkpoint = commits.then(() => withManifestLock(source.root, () => commitPhoto(source, photo, objects, expectedVersion)));
        commits = checkpoint.catch(() => {});
        await checkpoint;
        result.committed += 1;
        onProgress({ ...result, totalPhotos: plan.photos.length, totalObjects: plan.objects.length });
      } catch (error) { failure ||= safeFailure(error); }
    }
  }
  // Await in-flight tasks before reporting failure: no writes continue after return.
  await Promise.all(Array.from({ length: Math.min(concurrency, plan.photos.length) }, worker));
  if (failure) { failure.progress = { ...result }; throw failure; }
  return result;
}

module.exports = { readConfig, buildPlan, uploadPlan, MIN_FULL_EDGE, CACHE_CONTROL };
