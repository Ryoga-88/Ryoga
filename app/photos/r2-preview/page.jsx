import { readFile } from "node:fs/promises";
import path from "node:path";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { localAccessAllowed } from "app/lib/photo-curation";
import { previewPhotos } from "../../../scripts/lib/r2PreviewPhotos.cjs";
import Library from "../Library";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Cloudflare R2の表示確認",
  robots: { index: false, follow: false },
};

export default async function R2PreviewPage() {
  if (!localAccessAllowed(await headers(), { navigation: true })) notFound();

  let photos;
  let message;
  try {
    const manifest = JSON.parse(await readFile(
      path.join(process.cwd(), ".local/photos/r2-preview.json"), "utf8",
    ));
    const curated = JSON.parse(await readFile(
      path.join(process.cwd(), "app/contents/curated-photos.json"), "utf8",
    ));
    photos = previewPhotos(manifest, curated);
    if (!photos.length) {
      photos = undefined;
      message = "確認用にアップロードした写真は、現在の掲載対象に含まれていません。掲載対象の写真でお試しアップロードを実行してください。";
    }
  } catch (error) {
    message = error.code === "ENOENT"
      ? "確認用の写真はまだありません。R2へのお試しアップロードを実行してから、このページを再読み込みしてください。"
      : "確認用の写真を読み込めませんでした。R2へのお試しアップロードの結果を確認してください。";
  }

  return (
    <div className="mx-auto max-w-page px-4 py-10 sm:py-14">
      <h1 className="text-2xl font-bold">Cloudflare R2の表示確認</h1>
      <p className="mt-3 text-sm text-muted">掲載対象から選んだ写真を、Cloudflareから読み込むローカル専用の確認画面です。</p>
      <nav aria-label="写真のページ" className="mt-4 flex flex-wrap gap-5 text-sm">
        <Link href="/photos/curate" className="font-bold text-accent underline underline-offset-4">写真の選別に戻る</Link>
        <Link href="/photos" className="font-bold text-accent underline underline-offset-4">掲載プレビューを見る</Link>
      </nav>
      {photos ? (
        <>
          <div className="my-6 rounded-xl border border-line bg-soft px-4 py-3 text-sm">
            <p className="font-bold">Cloudflareから配信：{photos.length}枚</p>
            <p className="mt-1 break-all">配信元：{new URL(photos[0].url).hostname}</p>
            <p className="mt-1 text-muted">写真をクリックすると、大きく表示できます。</p>
          </div>
          <Library posts={photos} />
        </>
      ) : <p role="status" className="mt-6 rounded-xl border border-line bg-soft px-4 py-4 text-sm">{message}</p>}
    </div>
  );
}
