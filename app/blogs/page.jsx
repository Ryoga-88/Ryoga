import BlogList from "./BlogList";
import posts from "app/contents/blogs";

export default function BlogListPage() {
  posts.sort((a, b) => new Date(b.date) - new Date(a.date));

  return <BlogList posts={posts} />;
}
