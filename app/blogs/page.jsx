import BlogList from "./BlogList";
import PageTitle from "app/components/page-title";
import { getAllPosts } from "app/lib/posts";
import { pageMetadata } from "app/lib/site";

// New note posts appear without a redeploy.
export const revalidate = 3600;

export const metadata = pageMetadata({
  title: "Blog",
  description: "花房亮雅のブログ。研究・開発・活動の記録と、noteに投稿した記事をまとめています。",
  path: "/blogs",
});

export default async function BlogListPage() {
  const posts = await getAllPosts();

  return (
    <div className="mx-auto max-w-page px-4 pt-10 sm:pt-14">
      <PageTitle title="Blog" lead="研究や開発、活動の記録。noteに書いた記事もここに並びます。" />
      <BlogList posts={posts} />
    </div>
  );
}
