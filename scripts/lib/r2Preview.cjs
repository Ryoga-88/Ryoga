const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const sharp = require("sharp");
const { PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { publicPhotoMetadata } = require("./publicPhotoMetadata.cjs");

const LIMIT = 3;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const hash = (body, algorithm = "sha256", encoding = "hex") => crypto.createHash(algorithm).update(body).digest(encoding);
const fail = (message) => Object.assign(new Error(message), { safeToDisplay: true });

function readConfig(env) {
  for (const key of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME", "R2_PUBLIC_BASE_URL"]) {
    if (!env[key]?.trim()) throw fail(`${key} が未設定です。`);
  }
  if (!/^[a-f0-9]{32}$/i.test(env.R2_ACCOUNT_ID)) throw fail("R2_ACCOUNT_ID の形式を確認してください。");
  if (env.R2_BUCKET_NAME !== "ryoga-photos") throw fail("この確認では ryoga-photos バケットだけを使用します。");
  let url;
  try { url = new URL(env.R2_PUBLIC_BASE_URL); } catch { throw fail("R2_PUBLIC_BASE_URL の形式を確認してください。"); }
  if (url.protocol !== "https:" || !url.hostname.endsWith(".workers.dev") || url.username || url.password || url.port || url.search || url.hash || url.pathname !== "/") {
    throw fail("R2_PUBLIC_BASE_URL はパス・認証情報を含まない https://…workers.dev にしてください。");
  }
  return {
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
    bucket: env.R2_BUCKET_NAME,
    publicBase: url.origin,
  };
}

async function readJson(filename, fallback) {
  try { return JSON.parse(await fs.readFile(filename, "utf8")); }
  catch (error) { if (error.code === "ENOENT" && fallback !== undefined) return fallback; throw error; }
}

async function buildPlan(root, config) {
  const manifestPath = path.join(root, "app/contents/curated-photos.json");
  const previewPath = path.join(root, ".local/photos/r2-preview.json");
  const manifest = await readJson(manifestPath);
  if (manifest.version !== 1 || !Array.isArray(manifest.photos) || !manifest.decisions) throw fail("選別結果の形式を確認してください。");
  const previous = await readJson(previewPath, null);
  const eligible = manifest.photos.filter((photo) => manifest.decisions[photo.id] === "included");
  let selected = eligible.slice(0, LIMIT);
  // Repeat the same trial instead of unintentionally uploading another set of photos.
  if (previous) {
    if (previous.version !== 1 || !Array.isArray(previous.photos) || !previous.photos.length || previous.photos.length > LIMIT) throw fail("前回のR2確認データの形式を確認してください。");
    selected = previous.photos.map((old) => eligible.find((photo) => photo.id === old.id));
    if (selected.some((photo) => !photo)) throw fail("前回の確認写真に掲載対象から外れた写真があります。確認対象を見直してください。");
  }
  if (!selected.length) throw fail("「掲載に決定」した写真がありません。");
  if (new Set(selected.map((photo) => photo.id)).size !== selected.length) throw fail("写真のIDが重複しています。");

  const assets = await fs.realpath(path.join(root, "public/images/photos"));
  const photos = [];
  const objects = [];
  for (const photo of selected) {
    if (!UUID.test(photo.id) || !photo.countryCode || ["JP", "CN", "ES", "AL"].includes(photo.countryCode)) throw fail("掲載対象のID・国を確認してください。");
    let fullMetadata;
    for (const suffix of ["", "-thumb"]) {
      const filename = `${photo.id}${suffix}.webp`;
      const source = await fs.realpath(path.join(assets, filename));
      if (!source.startsWith(`${assets}${path.sep}`)) throw fail("公開画像フォルダの外は読み込めません。");
      const body = await fs.readFile(source);
      const metadata = await sharp(body).metadata();
      if (metadata.format !== "webp" || metadata.exif || metadata.xmp || metadata.iptc) throw fail("メタデータを除去した公開用WebPだけをアップロードできます。");
      if (!suffix) fullMetadata = metadata;
      const key = `photos/${filename}`;
      objects.push({ id: photo.id, key, url: `${config.publicBase}/${key}`, body, sha256: hash(body), contentMD5: hash(body, "md5", "base64") });
    }
    // Only allow the broad place label and timestamp; never copy GPS, paths or credentials.
    photos.push({
      id: photo.id, title: String(photo.title || "写真"), category: String(photo.category || photo.countryCode),
      date: typeof photo.date === "string" ? photo.date : null,
      ...publicPhotoMetadata(photo),
      width: fullMetadata.width, height: fullMetadata.height, aspect: `${fullMetadata.width} / ${fullMetadata.height}`,
      url: `${config.publicBase}/photos/${photo.id}.webp`, thumbnail: `${config.publicBase}/photos/${photo.id}-thumb.webp`,
    });
  }
  return { photos, objects, previewPath, manifestPath, totalBytes: objects.reduce((total, object) => total + object.body.length, 0) };
}

async function ensureStillIncluded(plan) {
  const current = await readJson(plan.manifestPath);
  if (plan.photos.some((photo) => current.decisions?.[photo.id] !== "included" || !current.photos?.some((item) => item.id === photo.id))) {
    throw fail("確認対象の選別結果が変わったため停止しました。掲載対象を確認してください。");
  }
}

async function uploadPlan(plan, config, { client, fetchImpl = fetch, onProgress = () => {} }) {
  if (!plan.photos.length || plan.photos.length > LIMIT || plan.objects.length !== plan.photos.length * 2) throw fail("確認用アップロードは3枚・6ファイルまでです。");
  let uploaded = 0;
  let reused = 0;
  for (const object of plan.objects) {
    await ensureStillIncluded(plan);
    try {
      await client.send(new PutObjectCommand({
        Bucket: config.bucket, Key: object.key, Body: object.body, ContentType: "image/webp",
        ContentMD5: object.contentMD5, CacheControl: "public, max-age=3600",
        StorageClass: "STANDARD", IfNoneMatch: "*",
      }));
      uploaded += 1;
    } catch (error) {
      if (error.$metadata?.httpStatusCode !== 412) throw error;
      const existing = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: object.key }));
      const body = await existing.Body.transformToByteArray();
      if (hash(body) !== object.sha256) throw fail("R2に同名で内容の異なる画像があるため、上書きせず停止しました。");
      reused += 1;
    }
    const response = await fetchImpl(object.url, { redirect: "error", signal: AbortSignal.timeout(30000), headers: { "Cache-Control": "no-cache" } });
    if (!response.ok || !response.headers.get("content-type")?.toLowerCase().startsWith("image/webp")) {
      throw fail(`画像配信の確認に失敗しました（HTTP ${response.status}）。WorkerのR2バインディングを確認してください。`);
    }
    const remote = Buffer.from(await response.arrayBuffer());
    if (hash(remote) !== object.sha256) throw fail("配信画像がアップロード元と一致しないため停止しました。");
    onProgress(uploaded + reused, plan.objects.length);
  }
  await ensureStillIncluded(plan);
  return { uploaded, reused };
}

async function savePreview(plan) {
  await ensureStillIncluded(plan);
  await fs.mkdir(path.dirname(plan.previewPath), { recursive: true });
  const temporary = `${plan.previewPath}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, `${JSON.stringify({ version: 1, uploadedAt: new Date().toISOString(), photos: plan.photos }, null, 2)}\n`, { mode: 0o600 });
    await fs.rename(temporary, plan.previewPath);
  } finally { await fs.rm(temporary, { force: true }); }
}

module.exports = { readConfig, buildPlan, uploadPlan, savePreview, LIMIT };
