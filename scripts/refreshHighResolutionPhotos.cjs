#!/usr/bin/env node
const path = require("node:path");
const { refreshHighResolutionPhotos } = require("./lib/photoHighResolution.cjs");

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--write")) {
    console.error("使い方: node scripts/refreshHighResolutionPhotos.cjs [--write]");
    process.exitCode = 1;
    return;
  }
  const write = args.includes("--write");
  const reportedFailures = new Set();
  let upgraded = 0;
  let lastProgressAt = Date.now();
  const result = await refreshHighResolutionPhotos(path.resolve(__dirname, ".."), {
    write,
    onProgress: ({ status, reason, message }) => {
      if (status === "upgraded") {
        upgraded++;
        if (upgraded % 10 === 0 || Date.now() - lastProgressAt >= 20000) {
          console.log(`高解像度画像を${upgraded}枚保存しました。`);
          lastProgressAt = Date.now();
        }
      }
      if (status === "failed" && message && !reportedFailures.has(reason)) {
        reportedFailures.add(reason);
        console.error(message);
      }
    },
  });
  console.log(`${write ? "保存" : "確認のみ"}: 掲載 ${result.inspected}枚、低解像度 ${result.candidates}枚、取得済み ${result.ready}枚、更新 ${result.upgraded}枚、取得待ち ${result.pending}枚、変更により保留 ${result.skipped}枚、失敗 ${result.failed}枚`);
  if (result.failed) process.exitCode = 1;
}

if (require.main === module) main().catch(() => {
  console.error("高解像度写真を処理できませんでした。画像と掲載データを確認して再試行してください。");
  process.exitCode = 1;
});
