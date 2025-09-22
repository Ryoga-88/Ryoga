import posts from "app/contents/photos";
import Library from "./Library";

export default function PhotoListPage() {
  return <Library posts={posts} />;
}
