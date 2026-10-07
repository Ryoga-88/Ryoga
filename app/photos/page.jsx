import curated from "app/contents/curated-photos.json";
import Link from "next/link";
import PageTitle from "app/components/page-title";
import { pageMetadata } from "app/lib/site";
import Library from "./Library";
import PhotoViewTabs from "./view-tabs";

export const metadata = pageMetadata({
  title: "Photos",
  description:
    "花房亮雅が旅先で撮影した写真。トルコ、インド、ベトナム、カンボジア、タイ、シンガポール、マレーシア、イタリア。",
  path: "/photos",
});

export default function PhotoListPage() {
  return (
    <div className="mx-auto max-w-page px-4 pt-10 sm:pt-14">
      <PageTitle title="Photos" lead="旅先で撮った写真" />
      <PhotoViewTabs current="photos" />
      {process.env.NODE_ENV === "development" && process.env.PHOTO_CURATION === "1" && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-line bg-soft px-4 py-3 text-sm">
          <span>選んだ写真を掲載しています</span>
          <div className="flex flex-wrap gap-4">
            <Link href="/photos/r2-preview" className="font-bold text-accent underline underline-offset-4">R2の3枚を確認</Link>
            <Link href="/photos/curate" className="font-bold text-accent underline underline-offset-4">写真を選ぶ</Link>
          </div>
        </div>
      )}
      <Library posts={curated.photos} />
    </div>
  );
}
