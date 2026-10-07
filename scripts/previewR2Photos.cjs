#!/usr/bin/env node
const path = require("node:path");
const { loadEnvConfig } = require("@next/env");
const { S3Client } = require("@aws-sdk/client-s3");
const { readConfig, buildPlan, uploadPlan, savePreview } = require("./lib/r2Preview.cjs");

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--upload")) throw Object.assign(new Error("使い方: npm run photos:r2:preview [-- --upload]（最大3枚）"), { safeToDisplay: true });
  const root = path.resolve(__dirname, "..");
  loadEnvConfig(root, true, { info() {}, error() {} });
  const config = readConfig(process.env);
  const plan = await buildPlan(root, config);
  console.log(`確認対象: ${plan.photos.length}枚 / ${plan.objects.length}ファイル / ${(plan.totalBytes / 1024 / 1024).toFixed(2)} MiB`);
  console.log(`配信先: ${config.publicBase}`);
  if (!args.includes("--upload")) {
    console.log("送信はしていません。--upload を付けると、この3枚以内だけをアップロードします。");
    return;
  }
  const client = new S3Client({
    region: "auto", endpoint: config.endpoint, credentials: config.credentials, forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED",
    maxAttempts: 2, requestHandler: { connectionTimeout: 10000, requestTimeout: 30000 },
  });
  try {
    const result = await uploadPlan(plan, config, { client, onProgress: (done, total) => console.log(`Cloudflareからの画像取得・内容照合: ${done}/${total}`) });
    await savePreview(plan);
    console.log(`完了: 新規${result.uploaded}ファイル、既存の同一画像${result.reused}ファイル。`);
    console.log("ローカル確認: http://127.0.0.1:3000/photos/r2-preview");
  } finally { client.destroy(); }
}

main().catch((error) => {
  // SDK/network errors can contain request details. Never dump secrets or headers.
  const status = error.$metadata?.httpStatusCode;
  console.error(error.safeToDisplay ? error.message : `R2の確認処理が失敗しました${Number.isInteger(status) ? `（HTTP ${status}）` : ""}。設定・接続・公開用画像を確認してください。`);
  process.exitCode = 1;
});
