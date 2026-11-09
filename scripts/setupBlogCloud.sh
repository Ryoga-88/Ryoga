#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

node <<'NODE'
const fs = require('node:fs');
const preferred = fs.readFileSync('.nvmrc', 'utf8').trim();
const requiredMajor = preferred.split('.')[0];
if (process.versions.node.split('.')[0] !== requiredMajor) {
  console.error(`Node.js ${preferred} を選んでから再実行してください（現在: ${process.versions.node}）。`);
  process.exit(1);
}
console.log(`Node.js ${process.versions.node} / 推奨 ${preferred}`);
NODE

npm ci --no-audit --no-fund

cat <<'TEXT'
ブログ作成環境の依存関係をインストールしました。
  執筆ルール: .agents/skills/ryoga-blog-writing/SKILL.md
  プレビュー: npm run blog:dev （ポート3000）
  検証: npm run lint && npm run blog:build
  保存・クラウド設定: docs/blog-cloud.md
TEXT
