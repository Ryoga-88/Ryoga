#!/usr/bin/env node
const path = require("node:path");
const { loadEnvConfig } = require("@next/env");
const { S3Client } = require("@aws-sdk/client-s3");
const { readConfig, buildPlan, uploadPlan } = require("./lib/r2Migration.cjs");

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => !["--upload", "--allow-preview", "--ready-only", "--pending-only"].includes(arg))) throw Object.assign(new Error("使い方: node scripts/migrateR2Photos.cjs [--upload] [--allow-preview] [--ready-only] [--pending-only]"), { safeToDisplay: true });
  const root = path.resolve(__dirname, "..");
  loadEnvConfig(root, true, { info() {}, error() {} });
  const config = readConfig(process.env);
  const plan = await buildPlan(root, config, { allowPreview: args.includes("--allow-preview"), readyOnly: args.includes("--ready-only"), pendingOnly: args.includes("--pending-only") });
  console.log(`移行対象: ${plan.photos.length}枚 / ${plan.objects.length}ファイル / ${(plan.totalBytes / 1024 / 1024).toFixed(2)} MiB`);
  if (plan.deferredPhotos.length) console.log(`原本待ちで延期: ${plan.deferredPhotos.length}枚（選別結果・掲載情報は維持）`);
  if (plan.completedPhotos.length) console.log(`検証・保存済みの同一画像: ${plan.completedPhotos.length}枚（今回の再送信・再検証は省略）`);
  console.log(`画質確認: 拡大用画像1200px未満 ${plan.qualityIssues.length}枚`);
  if (!args.includes("--upload")) {
    console.log("送信・掲載一覧の変更はしていません。--upload を付けると掲載対象の全画像を移行します。");
    if (plan.qualityIssues.length) console.log("画質不足の画像は原本を取得・再生成してください。--allow-preview は低解像度を明示的に許容する場合だけ使用します。");
    return;
  }
  const client = new S3Client({
    region: "auto", endpoint: config.endpoint, credentials: config.credentials, forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED",
    maxAttempts: 3, requestHandler: { connectionTimeout: 10000, requestTimeout: 30000 },
  });
  try {
    let lastProgressAt = Date.now();
    const result = await uploadPlan(plan, config, {
      client, onProgress: ({ committed, totalPhotos, uploaded, reused }) => {
        if (committed % 25 === 0 || committed === totalPhotos || Date.now() - lastProgressAt >= 20000) {
          console.log(`配信照合・掲載URL保存: ${committed}/${totalPhotos}枚（新規${uploaded}・再利用${reused}ファイル）`);
          lastProgressAt = Date.now();
        }
      },
    });
    console.log(`完了: ${result.committed}枚、新規${result.uploaded}ファイル、同一画像の再利用${result.reused}ファイル。`);
  } finally { client.destroy(); }
}

main().catch((error) => {
  const status = error.$metadata?.httpStatusCode;
  console.error(error.safeToDisplay ? error.message : `R2移行に失敗しました${Number.isInteger(status) ? `（HTTP ${status}）` : ""}。設定・接続・公開用画像を確認してください。`);
  if (error.progress) console.error(`保存済み: ${error.progress.committed}枚。再実行すると同一画像を再利用して続行できます。`);
  process.exitCode = 1;
});
