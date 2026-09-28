import posts from "app/contents/photos";
import PageTitle from "app/components/page-title";
import { pageMetadata } from "app/lib/site";
import Library from "./Library";

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
      <Library posts={posts} />
    </div>
  );
}
