This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## 写真を選別する（このMac専用）

```bash
npm run photos:import
npm run photos:curate
```

[写真の選別画面](http://127.0.0.1:3000/photos/curate)で「掲載」「見送り」を選びます。
国・撮影日・選別状態で絞り込み、写真を開いて拡大できます。チェックした写真はページや絞り込みをまたいでまとめて選別できます。操作欄には全体の選択枚数と、現在のページに表示されていない選択枚数を表示します。

チェックは同じブラウザ・同じURLのローカルストレージに自動保存し、ページ・状態タブの切り替え、再読み込み、別ページへの移動やブラウザの再起動後も復元します。同じURLを開いた別のブラウザタブにも反映されます。`localhost` と `127.0.0.1`、ポートやブラウザが違う場合は別の保存先です。ブラウザのサイトデータを削除すると未確定のチェックは消えます。「掲載」「見送り」で確定した結果はファイルに保存するため残ります。

チェックだけでは掲載されません。青い「選んだ○枚を掲載に決定」などの操作は、表示されていない写真を含めて適用します。保存に成功した写真だけチェックを解除し、途中で失敗した場合は未保存分のチェックを残します。「チェックを全解除」はチェックだけを消し、掲載・見送りの確定状態は変更しません。

「チェック中」タブではチェックした写真、「掲載対象」タブでは掲載すると決めて保存した写真を確認できます。保存済みの写真には緑の「掲載対象・保存済み」ラベルが付きます。上部の「掲載対象の○枚を見る」を押すと国や検索条件に関係なく全対象を表示します。公開サイトに反映したかどうかは追跡していないため、公開済みを表すラベルではありません。掲載対象の一覧は「掲載プレビュー」で確認できます。

- 日本・中国・スペイン・アルバニア・国不明を除く、通常のライブラリ内の静止画が候補です。動画・非表示・削除済みの項目は取り込みません。
- Photosは `app/contents/curated-photos.json` の掲載対象だけを表示します。2026-10-08時点の選別済み603枚はR2へ移行済みです。新しい候補は未選別から開始します。
- R2移行後、ユーザーの依頼により旧Gyazo写真の一覧・画像URL参照をサイトから除去しました。旧データ `app/contents/photos.js`、旧アップローダー `scripts/uploadPhotos.js` と `upload:photos` コマンドは廃止しています。Gyazoサーバー上の画像は変更・削除していません。
- 「掲載」「見送り」で確定した選別結果は `app/contents/curated-photos.json` に自動保存し、このJSONをバージョン管理します。「掲載」ではWebPを大小2サイズ作り、Git対象外の `public/images/photos/` に保存します。写真の画像ファイルはローカルとCloudflare R2で保持し、GitHubには追加しません。ローカルの画像とJSONを残せば、選別画面を使わなくなっても掲載プレビューは維持されます。再取り込みで選別結果はリセットされません。
- 掲載状態はローカルの `/photos` に反映されます。新たに選別した写真は `/images/photos/` のローカルURLから始まります。下記のR2移行コマンドは掲載対象だけを送り、公開画像を照合した写真から掲載一覧をR2のURLに更新します。その掲載一覧をデプロイすると、Gitに画像を追加せず本番で表示できます。通常の選別ではR2へ送信しません。
- 未掲載候補・元ファイルのパス・撮影位置はGit対象外の `.local/photos/catalog.json` にだけ保持します。選んだ写真のUUIDで地図表示用データ（`app/contents/photo-map.json`）に照合します。このカタログは公開・配布しないでください。
- 通常の取り込み・選別はMac内の画像だけを読み取ります。編集済み画像→ローカル原本（未編集のみ）→プレビューの順で公開画像を作ります。原本がiCloudにしかない写真はプレビューの解像度になります。高解像度の取得は下記のPhotoKit復旧ヘルパーで明示的に行い、取得後に公開画像を更新します。
- 選別画面とAPIは `photos:curate` で起動した開発サーバーだけで有効です。127.0.0.1に限定して起動し、本番では404を返します。選別結果はブラウザのキャッシュを消しても残ります。

別の写真ライブラリを使う場合：

```bash
python3 scripts/importApplePhotos.py --library "/path/to/Photos Library.photoslibrary"
```

検証：`npm run test:photos`。実写真に触らず、一時画像で保存・掲載解除・アクセス制限を検証します。

### 公開時の見た目をMacで確認する

選別用サーバーに出る「選んだ写真を掲載しています」の案内や選別リンクは、本番では表示しません。公開時の見た目は次で確認できます。

```bash
npm run preview
```

ビルド完了後、[公開用のPhotosプレビュー](http://127.0.0.1:3002/photos)を開きます。本番用ビルドをローカルで起動するため、選別用の案内・操作は表示されず、選別画面・選別API・R2確認画面は404になります。このコマンドはデプロイしません。

プレビューは専用の `.next-preview` とポート3002を使うので、ポート3000の選別サーバーは起動したままで使えます。コードや掲載写真を変更した後は、プレビューを `Ctrl+C` で終了し、`npm run preview` を再実行して再ビルドしてください。

### 次の旅行から戻ったら

写真アプリに写真が同期されたら、もう一度 `npm run photos:import` を実行して選別画面を再読み込みします。過去の「掲載」「見送り」は残り、新しく取り込まれた写真が「未選別」に追加されます。国や撮影日で旅行ごとに絞り込めます。

新しい旅行先も、除外した国でなければ対象です。表示名が未登録の国は国コードで表示されます。国を特定できない写真は現在対象外です。

### 旅の地図

[Photosの「地図」](http://127.0.0.1:3000/photos/map)で、掲載した写真の撮影場所と巡った順番をたどれます。旅ごとの絞り込み、巡った順の再生、場所ごとの写真表示ができます。

- 「掲載」「見送り」を保存すると `app/contents/photo-map.json` も自動で更新されます。手動で作り直す場合は `npm run photos:map` を実行します。
- 公開されるのは場所の名前と、約5km単位に丸めた中心座標だけです。写真ごとの位置情報や住所は公開しません。
- 地名が読みにくいときは `scripts/lib/photoMap.cjs` の `PLACE_NAMES` に表示名を追加して `npm run photos:map` を実行します。
- 旅の色は直近3年を青（最新）・オレンジ・緑で塗り分け、それより前の年はグレーにまとめます。

写真が増えたとき：

1. いつもどおり取り込み・選別します。新しい旅（7日以上写真が空くと別の旅）や場所は自動で地図に加わります。
2. `npm run photos:map -- --check` で地図データが最新か確認します。古い場合は `npm run photos:map` を実行します。
3. 地図で新しい旅を確認し、`app/contents/curated-photos.json` と `app/contents/photo-map.json` を一緒にコミットします。
4. 新しい国がシンガポールやバチカンのような小さい国なら、`app/photos/map/WorldMap.jsx` の `COUNTRY_IDS` に国番号を追加します。

位置情報のない写真は地図に出ません（写真一覧には出ます）。詳しい仕組みと注意点は [AGENTS.md](AGENTS.md) の「旅の地図：写真が増えたとき」にあります。

### キーと取り消し

**選別を始めるのにAPIキーは不要です。** 取り込み・選別・保存・プレビューはMacだけで完結します。R2のキーが必要になるのは、後でR2へアップロードするときです。

選別は後から変更できます。「掲載」を取り消すには「見送り」か「未選別に戻す」を選びます。「見送り」から改めて「掲載」にすることもできます。写真アプリの原本は変更・削除しません。本番サイトでの掲載解除は、変更後のデプロイで反映されます。

今後のエージェント向けの運用方針と保存先は [AGENTS.md](AGENTS.md) に記載しています。

### 掲載対象をCloudflare R2へ移行する

`.env.local` に `R2_ACCOUNT_ID`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`、`R2_BUCKET_NAME=ryoga-photos`、`R2_PUBLIC_BASE_URL` を設定します。配信先は画像配信用WorkerのHTTPS `workers.dev` URLで、末尾に `/photos` は付けません。秘密値はGit・ログ・クライアントへ出さないでください。Workerの実装は `workers/photos/index.mjs` で、`PHOTOS` バインディングを専用バケット `ryoga-photos` に接続します。

```bash
npm run photos:r2:upload
npm run photos:r2:upload -- --upload
```

1行目は枚数・容量・画質の確認だけ、2行目が送信です。「掲載に決定」して保存した写真だけが対象です。未選別・見送りの候補、写真アプリの原本、非公開カタログは送りません。日本・中国・スペイン・アルバニアは対象外です。

WebPは拡大用が長辺最大2400px・品質86、一覧用が長辺最大500px・品質76です。小さい元画像の引き伸ばしは行わず、EXIF・GPS等のメタデータは除去します。拡大用が1200px未満の写真がある場合、通常の移行は送信前に停止します。原本待ちの写真を残して、準備できた写真から送る場合は次を使います。

```bash
npm run photos:r2:upload -- --upload --ready-only
```

延期した写真の選別結果と掲載情報は維持します。2026-10-08の移行では低解像度だった128枚を高解像度で再生成し、選別済み603枚すべての大小画像をR2へ送信・照合しました。以後の追加・更新分の件数はコマンドの結果で確認してください。`--allow-preview` は低解像度を明示的に許容するオプションで、通常は使いません。

各画像のR2キーは `photos/<UUID>/<SHA256・64桁>/full.webp` または `photos/<UUID>/<SHA256・64桁>/thumb.webp` です。画像の内容が変わるとURLも変わるため、高解像度への更新で以前の画像を上書きしません。キャッシュ期間は1年です。Workerはこの形式と従来の3枚確認用パスだけをGET/HEADで配信します。

同名のオブジェクトは条件付きPUTで上書きを防ぎ、内容が同じ場合だけ再利用します。大小両方をWorkerの公開URLから取得してWebP形式とSHA256を照合した後、その写真のURL・寸法だけを掲載一覧へ保存します。保存時は選別画面・画像更新と共有のロックを使い、最新の掲載結果を読み直します。UUID・選別結果・地名・撮影日時・他の写真の変更は引き継ぎます。

途中で失敗しても保存済みの写真は残ります。同じコマンドを再実行すると画像を再利用して続行できます。`npm run photos:r2:upload -- --upload --pending-only` では、画像の内容・配信URL・寸法が保存済みの情報と一致する写真を省略して、未保存・更新分だけを送ります。省略した写真の公開URLは再確認しません。`--pending-only` を付けずに `--upload` すると、移行済みを含めて全対象を再照合します。写真の画像ファイルは引き続きローカルとR2に保持し、Gitへは追加しません。公開サイトへの反映には、更新された掲載一覧のデプロイが必要です。R2上の画像を削除する処理はありません。

### iCloudの高解像度画像を復旧する

通常の `photos:import` はiCloudから画像をダウンロードしません。今回の移行ではユーザーの依頼により、PhotoKitの復旧ヘルパーで必要な高解像度画像を取得します。権限確認用のローカルアプリは `.local/photos/Ryoga Photo Export.app` です。写真ライブラリの編集・削除は行いません。

`npm run photos:recover:prepare -- --dry-run` で不足枚数を確認し、`npm run photos:recover:prepare` で取得対象とアプリを準備します（macOSとXcode Command Line Toolsが必要）。その後、Finderで `.local/photos/Ryoga Photo Export.app` を開き、macOSの写真アクセス確認に対応します。準備コマンドだけではダウンロードしません。進捗は `.local/photos/high-resolution/export.log` に保存され、途中終了しても取得済みの写真を再利用できます。写真アプリでの編集を保持した現在の画像を取得します。

取得した画像と結果の `export-results.json` はGit・本番配布対象外の `.local/photos/high-resolution/` に保存します。取得後は次のコマンドで、掲載対象の低解像度なローカル公開画像を更新できます。

```bash
npm run photos:refresh
npm run photos:refresh -- --write
npm run photos:r2:upload -- --upload
```

1行目は取得済み・取得待ちの確認、2行目が公開WebPの再生成、3行目がR2への移行です。`photos:refresh` 自体はダウンロード要求を出しません。未取得の写真は残し、更新前の画像と掲載一覧は非公開の `.local/photos/high-resolution-backups/` に保存します。取得途中で準備できた分だけ送る場合は、最後のコマンドに `--ready-only` を付けます。`.local` は候補・位置情報・復旧画像を含むため、掃除の対象にしないでください。

大量の変換・移行中は選別用サーバーを終了しておくと、画像保存ごとの再ビルドを避けられます。完了後に `npm run photos:curate` で起動し直します。制限環境内でHEIC変換に失敗する場合は、通常のMacのターミナルで `photos:refresh -- --write` を実行してください。

### Cloudflare R2で3枚だけ確認する

R2設定は上記の全体移行と共通です。

```bash
npm run photos:r2:preview
npm run photos:r2:preview -- --upload
npm run photos:curate
```

1行目は送信対象の確認だけ、2行目が実際の送信です。掲載対象から最大3枚（大小6ファイル）だけをR2にアップロードし、Cloudflareから取得した画像の内容を照合します。同名の画像は上書きせず、同じ内容なら再利用します。

[Cloudflareの3枚確認画面](http://127.0.0.1:3000/photos/r2-preview)で一覧と拡大表示を確認できます。この画面は最初に確認した最大3枚だけを読み込みます。全体移行で同じUUIDの画像が更新された場合は、最新の掲載一覧のR2 URL・寸法を使います。配信元が元の確認ファイルと一致し、UUID・画像パスが正しいことを検証します。既に選別サーバーが起動している場合は3行目を重ねて実行せず、そのままページを開いてください。

確認結果はGit対象外の `.local/photos/r2-preview.json` に保存されます。選別結果や既存の掲載一覧は変更しません。再実行は前回の確認写真を再利用し、全写真の移行や本番へのデプロイは行いません。R2上の画像を削除する処理はまだありません。

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
