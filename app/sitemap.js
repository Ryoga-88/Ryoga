import { getLocalPosts } from "app/lib/posts";
import { absoluteUrl } from "app/lib/site";

const PAGES = ["/", "/projects", "/blogs", "/photos", "/photos/map", "/privacy"];

// Only URLs on this domain; note posts are indexed under note.com.
export default function sitemap() {
  return [
    ...PAGES.map((path) => ({ url: absoluteUrl(path) })),
    ...getLocalPosts().map((post) => ({ url: post.url, lastModified: post.date })),
  ];
}
