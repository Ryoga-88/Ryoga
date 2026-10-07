#!/usr/bin/env node
// Preparation only: never launches an app, requests Photos permission, downloads
// an image, resets TCC, or changes the library, curation manifest, or export report.
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const sharp = require("sharp");

const run = promisify(execFile);
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const EXCLUDED_COUNTRIES = new Set(["JP", "CN", "ES", "AL"]);
const MINIMUM_EDGE = 1200;
const APP_NAME = "Ryoga Photo Export.app";
const executableName = "export-selected-photos";
const safeError = (message) => Object.assign(new Error(message), { safeToDisplay: true });

const INFO_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>io.ryoga.selected-photo-export</string>
<key>CFBundleName</key><string>Ryoga Photo Export</string>
<key>CFBundleDisplayName</key><string>Ryoga Photo Export</string>
<key>CFBundleExecutable</key><string>${executableName}</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>1.0</string>
<key>CFBundleVersion</key><string>1</string>
<key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
<key>LSMinimumSystemVersion</key><string>12.0</string>
<key>NSHighResolutionCapable</key><true/>
<key>NSPhotoLibraryUsageDescription</key>
<string>掲載に選んだ旅行写真だけを、写真アプリでの編集を保持した高解像度画像としてこのMacに保存します。必要な画像をiCloudから取得します。写真ライブラリの内容は変更しません。</string>
</dict></plist>\n`;
const ENTITLEMENTS = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>com.apple.security.personal-information.photos-library</key><true/>
</dict></plist>\n`;

async function confined(root, relative, { createDirectory = false } = {}) {
  let current = root;
  const segments = relative.split("/");
  for (const [index, segment] of segments.entries()) {
    if (!segment || segment === "." || segment === ".." || segment.includes("\\")) throw safeError("保存先を確認してください。");
    current = path.join(current, segment);
    if (createDirectory) await fs.mkdir(current, { mode: 0o700 }).catch((error) => { if (error.code !== "EEXIST") throw error; });
    const stat = await fs.lstat(current);
    if (stat.isSymbolicLink() || ((createDirectory || index < segments.length - 1) && !stat.isDirectory())) {
      throw safeError("保存先にシンボリックリンクや不正なフォルダーがあります。");
    }
  }
  return current;
}

async function readJSON(root, relative) {
  return JSON.parse(await fs.readFile(await confined(root, relative), "utf8"));
}

/** Inspect only included public WebPs, never original Photos library files. */
async function collectRecoveryIDs(root) {
  root = await fs.realpath(root);
  const [manifest, catalog] = await Promise.all([
    readJSON(root, "app/contents/curated-photos.json"),
    readJSON(root, ".local/photos/catalog.json"),
  ]);
  if (manifest.version !== 1 || !manifest.decisions || !Array.isArray(manifest.photos)
      || !Array.isArray(catalog.photos)) throw safeError("写真の候補・掲載データを読み直してください。");
  const eligible = new Set(catalog.photos.filter((photo) => photo && UUID.test(photo.id)
    && typeof photo.countryCode === "string" && photo.countryCode.length === 2
    && !EXCLUDED_COUNTRIES.has(photo.countryCode.toUpperCase())).map((photo) => photo.id));
  const ids = [];
  const seen = new Set();
  for (const photo of manifest.photos) {
    if (!photo || !UUID.test(photo.id) || seen.has(photo.id)) throw safeError("掲載写真のUUIDを確認してください。");
    seen.add(photo.id);
    if (manifest.decisions[photo.id] !== "included" || !eligible.has(photo.id)) continue;
    const source = await confined(root, `public/images/photos/${photo.id}.webp`);
    const metadata = await sharp(source).metadata();
    if (metadata.format !== "webp" || !Number.isFinite(metadata.width) || !Number.isFinite(metadata.height)
        || metadata.width <= 0 || metadata.height <= 0) throw safeError("掲載用WebPを確認してください。");
    if (Math.max(metadata.width, metadata.height) < MINIMUM_EDGE) ids.push(photo.id);
  }
  return ids;
}

async function assertExporterStopped() {
  const { stdout } = await run("/bin/ps", ["-ww", "-axo", "comm="], { maxBuffer: 4 * 1024 * 1024 });
  if (stdout.split("\n").some((line) => path.basename(line.trim()) === executableName)) {
    throw safeError("Ryoga Photo Export が実行中です。完了してから準備を再実行してください。");
  }
}

async function atomicPrivateJSON(filename, value) {
  const temporary = `${filename}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    await fs.rename(temporary, filename);
  } finally {
    await fs.rm(temporary, { force: true });
  }
}

async function preparePhotoRecovery(root, { dryRun = false } = {}) {
  root = await fs.realpath(root);
  const ids = await collectRecoveryIDs(root);
  if (dryRun) return { count: ids.length, prepared: false };
  if (process.platform !== "darwin") throw safeError("写真の取得アプリの準備にはmacOSが必要です。");
  await assertExporterStopped();
  const local = await confined(root, ".local/photos", { createDirectory: true });
  const outputDirectory = await confined(root, ".local/photos/high-resolution", { createDirectory: true });
  await fs.chmod(outputDirectory, 0o700);
  const requestPath = path.join(local, "high-resolution-request.json");
  if (!ids.length) {
    // Empty the old request so accidentally opening the old app cannot repeat it.
    await atomicPrivateJSON(requestPath, { version: 1, ids, outputDirectory });
    return { count: 0, prepared: false };
  }
  const moduleCache = await confined(root, ".local/photos/swift-module-cache", { createDirectory: true });
  await fs.chmod(moduleCache, 0o700);
  const source = await confined(root, "scripts/exportSelectedPhotos.swift");
  const stage = await fs.mkdtemp(path.join(local, ".prepare-photo-recovery-"));
  const app = path.join(stage, APP_NAME);
  const destination = path.join(local, APP_NAME);
  let previous;
  try {
    const macOS = path.join(app, "Contents", "MacOS");
    await fs.mkdir(macOS, { recursive: true, mode: 0o700 });
    const infoPath = path.join(app, "Contents", "Info.plist");
    const entitlementPath = path.join(stage, "PhotoExport.entitlements");
    await fs.writeFile(infoPath, INFO_PLIST, { mode: 0o600 });
    await fs.writeFile(entitlementPath, ENTITLEMENTS, { mode: 0o600 });
    await run("/usr/bin/xcrun", ["swiftc", "-module-cache-path", moduleCache, source,
      "-o", path.join(macOS, executableName), "-Xlinker", "-sectcreate", "-Xlinker", "__TEXT",
      "-Xlinker", "__info_plist", "-Xlinker", infoPath], { timeout: 300000, maxBuffer: 4 * 1024 * 1024 });
    await run("/usr/bin/codesign", ["--force", "--sign", "-", "--options", "runtime", "--entitlements", entitlementPath, app], { timeout: 60000 });
    await run("/usr/bin/codesign", ["--verify", "--strict", app], { timeout: 60000 });
    await assertExporterStopped();
    const existing = await fs.lstat(destination).catch((error) => { if (error.code !== "ENOENT") throw error; return null; });
    if (existing) {
      if (existing.isSymbolicLink() || !existing.isDirectory()) throw safeError("取得アプリの保存先を確認してください。");
      previous = path.join(stage, "previous.app");
      await fs.rename(destination, previous);
    }
    try { await fs.rename(app, destination); }
    catch (error) {
      if (previous) { await fs.rename(previous, destination); previous = undefined; }
      throw error;
    }
    await atomicPrivateJSON(requestPath, { version: 1, ids, outputDirectory });
    return { count: ids.length, prepared: true, appPath: destination };
  } finally {
    // This directory contains only this run's compiler inputs and generated app.
    // Existing image exports and export-results.json are never touched.
    await fs.rm(stage, { recursive: true, force: true });
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--dry-run") || args.length > 1) throw safeError("使い方: node scripts/preparePhotoRecovery.cjs [--dry-run]");
  process.umask(0o077);
  const result = await preparePhotoRecovery(path.resolve(__dirname, ".."), { dryRun: args.includes("--dry-run") });
  console.log(`高解像度の取得対象: ${result.count}枚（掲載対象の拡大用画像${MINIMUM_EDGE}px未満）`);
  if (result.prepared) {
    console.log(`取得アプリ: ${result.appPath}`);
    console.log("Finderで Ryoga Photo Export.app を開き、macOSの写真アクセス確認に対応してください。");
    console.log("進捗: .local/photos/high-resolution/export.log");
  } else if (args.includes("--dry-run")) console.log("確認のみ。リクエスト・アプリは変更していません。");
  else console.log("取得が必要な写真はありません。");
}

if (require.main === module) main().catch((error) => {
  console.error(error.safeToDisplay ? error.message : "写真取得の準備に失敗しました。候補・掲載画像とXcode Command Line Toolsを確認してください。");
  process.exitCode = 1;
});

module.exports = { collectRecoveryIDs, preparePhotoRecovery };
