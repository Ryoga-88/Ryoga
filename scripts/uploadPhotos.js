#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const PHOTOS_JS_PATH = path.join(
  __dirname,
  "..",
  "app",
  "contents",
  "photos.js"
);

function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    const p = path.join(__dirname, "..", name);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf-8").split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim();
    }
    return;
  }
  console.error(
    "Error: .env.local が見つかりません。GYAZO_ACCESS_TOKEN を設定してください。"
  );
  process.exit(1);
}

function printUsage() {
  console.log(`
Usage:
  node scripts/uploadPhotos.js <images-or-dir> --title <title> --category <category> [options]

Examples:
  node scripts/uploadPhotos.js ./my-photos --title "イタリア" --category "Italy" --date "2025-07-06" --append
  node scripts/uploadPhotos.js photo1.jpg photo2.jpg --title "トルコ" --category "Turkey" --date "2024-05-15"

Options:
  --title      写真のタイトル (必須)
  --category   カテゴリ名 (必須)
  --date       日付 YYYY-MM-DD (省略時: 今日の日付)
  --favorite   "true" or "false" (デフォルト: "true")
  --append     photos.js に直接追記する
`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    printUsage();
    process.exit(0);
  }

  const opts = {
    files: [],
    title: "",
    category: "",
    date: "",
    favorite: "true",
    append: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--title":
        opts.title = args[++i];
        break;
      case "--category":
        opts.category = args[++i];
        break;
      case "--date":
        opts.date = args[++i];
        break;
      case "--favorite":
        opts.favorite = args[++i];
        break;
      case "--append":
        opts.append = true;
        break;
      case "--help":
      case "-h":
        printUsage();
        process.exit(0);
      default:
        opts.files.push(args[i]);
    }
  }

  const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif)$/i;
  const expanded = [];
  for (const f of opts.files) {
    const resolved = path.resolve(f);
    if (!fs.existsSync(resolved)) {
      console.error(`Error: ${f} が見つかりません`);
      process.exit(1);
    }
    if (fs.statSync(resolved).isDirectory()) {
      const entries = fs
        .readdirSync(resolved)
        .filter((e) => IMAGE_EXT.test(e))
        .sort()
        .map((e) => path.join(resolved, e));
      expanded.push(...entries);
    } else {
      expanded.push(resolved);
    }
  }
  opts.files = expanded;

  if (opts.files.length === 0) {
    console.error("Error: アップロードする画像が見つかりません");
    process.exit(1);
  }
  if (!opts.title || !opts.category) {
    console.error("Error: --title と --category は必須です");
    printUsage();
    process.exit(1);
  }
  if (!opts.date) {
    opts.date = new Date().toISOString().split("T")[0];
    console.log(`日付未指定のため今日の日付を使用: ${opts.date}`);
  }

  return opts;
}

function getImageDimensions(filePath) {
  const output = execSync(`sips -g pixelWidth -g pixelHeight "${filePath}"`)
    .toString()
    .trim();
  const wMatch = output.match(/pixelWidth:\s*(\d+)/);
  const hMatch = output.match(/pixelHeight:\s*(\d+)/);
  if (!wMatch || !hMatch) {
    throw new Error(`画像サイズを取得できません: ${filePath}`);
  }
  return { width: parseInt(wMatch[1]), height: parseInt(hMatch[1]) };
}

function getAspectRatio(width, height) {
  const ratio = width / height;
  const candidates = [
    { r: 1 / 1, label: "1 / 1" },
    { r: 2 / 3, label: "2 / 3" },
    { r: 3 / 4, label: "3 / 4" },
    { r: 4 / 5, label: "4 / 5" },
    { r: 9 / 16, label: "9 / 16" },
    { r: 5 / 4, label: "5 / 4" },
    { r: 4 / 3, label: "4 / 3" },
    { r: 3 / 2, label: "3 / 2" },
    { r: 16 / 9, label: "16 / 9" },
  ];
  return candidates.reduce((best, c) =>
    Math.abs(ratio - c.r) < Math.abs(ratio - best.r) ? c : best
  ).label;
}

function uploadToGyazo(filePath, token) {
  const result = execSync(
    `curl -s -X POST https://upload.gyazo.com/api/upload ` +
      `-H "Authorization: Bearer ${token}" ` +
      `-F "imagedata=@${filePath}"`
  ).toString();

  try {
    return JSON.parse(result);
  } catch {
    console.error("Gyazo APIエラー:", result);
    process.exit(1);
  }
}

function appendToPhotosJs(entries) {
  let content = fs.readFileSync(PHOTOS_JS_PATH, "utf-8");
  const newEntries = entries
    .map(
      (e) =>
        `  {\n` +
        `    url: "${e.url}",\n` +
        `    aspect: "${e.aspect}",\n` +
        `    title: "${e.title}",\n` +
        `    category: "${e.category}",\n` +
        `    date: "${e.date}",\n` +
        `    favorite: "${e.favorite}",\n` +
        `  },`
    )
    .join("\n");
  content = content.replace(/\n\];\s*$/, `\n${newEntries}\n];\n`);
  fs.writeFileSync(PHOTOS_JS_PATH, content);
}

async function main() {
  loadEnv();

  const token = process.env.GYAZO_ACCESS_TOKEN;
  if (!token || token === "your_gyazo_access_token_here") {
    console.error(
      "Error: GYAZO_ACCESS_TOKEN が .env.local に設定されていません"
    );
    process.exit(1);
  }

  const opts = parseArgs();
  console.log(`\n${opts.files.length} 枚の画像をアップロードします...\n`);

  const entries = [];
  for (let i = 0; i < opts.files.length; i++) {
    const file = opts.files[i];
    const name = path.basename(file);
    process.stdout.write(`[${i + 1}/${opts.files.length}] ${name} ... `);

    const { width, height } = getImageDimensions(file);
    const aspect = getAspectRatio(width, height);
    const res = uploadToGyazo(file, token);
    const gyazoUrl = res.permalink_url.replace("http://", "https://");

    entries.push({
      url: gyazoUrl,
      aspect,
      title: opts.title,
      category: opts.category,
      date: opts.date,
      favorite: opts.favorite,
    });

    console.log(`done  ${aspect}  ${gyazoUrl}`);
  }

  console.log("\n--- 生成された JSON ---\n");
  for (const e of entries) {
    console.log(`  {`);
    console.log(`    url: "${e.url}",`);
    console.log(`    aspect: "${e.aspect}",`);
    console.log(`    title: "${e.title}",`);
    console.log(`    category: "${e.category}",`);
    console.log(`    date: "${e.date}",`);
    console.log(`    favorite: "${e.favorite}",`);
    console.log(`  },`);
  }

  if (opts.append) {
    appendToPhotosJs(entries);
    console.log(`\nphotos.js に ${entries.length} 件追記しました`);
  } else {
    console.log("\n--append オプションで photos.js に直接追記できます");
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
