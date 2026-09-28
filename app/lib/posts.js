// Server-only: reads the filesystem and fetches note at build/revalidate time.
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { SITE, absoluteUrl } from "app/lib/site";

const POSTS_DIR = path.join(process.cwd(), "app", "contents", "blogs");
const FILE_PATTERN = /^(\d{4}-\d{2}-\d{2})-(.+)\.ja\.md$/;
const NOTE_REVALIDATE_SECONDS = 3600;

const CATEGORY_LABELS = {
  note: "ノート",
  research: "研究",
  technology: "技術",
  other: "その他",
};

const SOURCE_NAMES = {
  "note.com": "note",
  "qiita.com": "Qiita",
  "zenn.dev": "Zenn",
  "ascii.jp": "ASCII STARTUP",
  "www.omu.ac.jp": "大阪公立大学",
};

function sourceName(url) {
  const host = new URL(url).hostname;
  return SOURCE_NAMES[host] ?? host.replace(/^www\./, "");
}

function plainText(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, "")
    .replace(/[*_`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text, length) {
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

function withCategory(post) {
  return { ...post, categoryLabel: CATEGORY_LABELS[post.category] ?? post.category };
}

function readLocalPost(filename, date, slug) {
  const { data, content } = matter(fs.readFileSync(path.join(POSTS_DIR, filename), "utf8"));
  // Drop a leading "# title" that only repeats the front matter title.
  const body = content.replace(/^\s*#\s+(.+)\n/, (line, heading) =>
    heading.trim() === data.title ? "" : line
  );
  const text = plainText(body);
  return withCategory({
    slug,
    date,
    title: data.title,
    category: data.category ?? "note",
    keywords: data.keywords ?? [],
    externalUrl: data.externalUrl ?? null,
    source: data.externalUrl ? sourceName(data.externalUrl) : null,
    image: data.image ?? null,
    content: body,
    excerpt: truncate(text, 140),
    description: truncate(text, 110),
    href: `/blogs/${slug}`,
    url: absoluteUrl(`/blogs/${slug}`),
    external: false,
  });
}

export function getLocalPosts() {
  return fs
    .readdirSync(POSTS_DIR)
    .map((filename) => filename.match(FILE_PATTERN))
    .filter(Boolean)
    .map(([filename, date, slug]) => readLocalPost(filename, date, slug))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getLocalPost(slug) {
  return getLocalPosts().find((post) => post.slug === slug) ?? null;
}

function smallEyecatch(url) {
  if (!url) return null;
  const image = new URL(url);
  // Shown at under 100px wide inside the card preview.
  image.searchParams.set("width", "240");
  return image.toString();
}

// note has no official API. This is the endpoint note's own web app uses; if
// it changes or fails, the blog keeps building from the local Markdown posts.
async function fetchNotePosts() {
  const posts = [];
  try {
    for (let page = 1; page <= 10; page++) {
      const response = await fetch(
        `https://note.com/api/v2/creators/${SITE.noteUser}/contents?kind=note&page=${page}`,
        {
          headers: { "User-Agent": `${SITE.name} (+${SITE.url})` },
          next: { revalidate: NOTE_REVALIDATE_SECONDS },
          signal: AbortSignal.timeout(8000),
        }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const { data } = await response.json();
      for (const note of data.contents) {
        if (note.status !== "published") continue;
        posts.push(
          withCategory({
            slug: note.key,
            date: note.publishAt.slice(0, 10),
            title: note.name,
            category: "note",
            keywords: (note.hashtags ?? []).map(({ hashtag }) => hashtag.name.replace(/^#/, "")),
            externalUrl: note.noteUrl,
            source: "note",
            image: smallEyecatch(note.eyecatch),
            excerpt: truncate((note.body ?? "").replace(/\s+/g, " ").trim(), 140),
            href: note.noteUrl,
            url: note.noteUrl,
            external: true,
          })
        );
      }
      if (data.isLastPage) break;
    }
  } catch (error) {
    console.warn(`[posts] note の記事を取得できませんでした: ${error.message}`);
  }
  return posts;
}

const normalizeUrl = (url) => url.replace(/\/$/, "");

// Local Markdown posts win over note posts with the same URL: they carry a
// summary written for this site, which is what makes the page worth citing.
export async function getAllPosts() {
  const notes = new Map((await fetchNotePosts()).map((note) => [normalizeUrl(note.url), note]));
  const local = getLocalPosts().map(({ content, ...post }) => {
    const key = post.externalUrl && normalizeUrl(post.externalUrl);
    const note = key && notes.get(key);
    if (!note) return post;
    notes.delete(key);
    return { ...post, image: post.image ?? note.image };
  });
  return [...local, ...notes.values()].sort((a, b) => b.date.localeCompare(a.date));
}
