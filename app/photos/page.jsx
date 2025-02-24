import posts from "app/contents/photos";
import PhotoList from "./PhotoList";
import Library from "./Library";

export default function PhotoListPage() {
  return <Library posts={posts} />;
}
