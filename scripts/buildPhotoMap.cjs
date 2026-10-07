#!/usr/bin/env node
// Rebuilds app/contents/photo-map.json from the private catalog and the published list.
// Curation saves do this automatically; run it after editing place names in photoMap.cjs,
// or after a script adds or removes published photos. `--check` only reports staleness.
const fs = require("node:fs/promises");
const path = require("node:path");
const { writePhotoMap, checkPhotoMap, MAP_PATH } = require("./lib/photoMap.cjs");

const root = path.resolve(__dirname, "..");

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--check")) throw new Error("使い方: npm run photos:map [-- --check]");
  const catalog = JSON.parse(await fs.readFile(path.join(root, ".local/photos/catalog.json"), "utf8"));
  const manifest = JSON.parse(await fs.readFile(path.join(root, "app/contents/curated-photos.json"), "utf8"));
  if (!Array.isArray(catalog.photos) || manifest.version !== 1 || !Array.isArray(manifest.photos)) {
    throw new Error("写真カタログまたは掲載一覧の形式を確認してください。");
  }
  if (args.includes("--check")) {
    const result = await checkPhotoMap(root, catalog.photos, manifest.photos);
    if (result.current) console.log(`${MAP_PATH} は最新です。`);
    else {
      console.log(`${MAP_PATH} が掲載一覧と一致しません（地図にない掲載写真: ${result.unmapped}枚）。npm run photos:map で作り直してください。`);
      process.exitCode = 1;
    }
    if (result.unlocated) console.log(`位置情報がない${result.unlocated}枚は地図に表示されません。`);
    return;
  }
  const map = await writePhotoMap(root, catalog.photos, manifest.photos);
  const mapped = Object.keys(map.photos).length;
  console.log(`${MAP_PATH}: ${map.places.length}か所、掲載写真${manifest.photos.length}枚中${mapped}枚を地図に配置しました。`);
  if (mapped < manifest.photos.length) console.log(`位置情報がない${manifest.photos.length - mapped}枚は地図に表示されません。`);
}

main().catch((error) => {
  // Do not print private paths or coordinates from the catalog.
  console.error(error.code === "ENOENT" ? "写真カタログがありません。先に npm run photos:import を実行してください。" : error.message);
  process.exitCode = 1;
});
