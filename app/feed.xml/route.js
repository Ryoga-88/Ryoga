import { getAllPosts } from "app/lib/posts";
import { SITE, absoluteUrl } from "app/lib/site";

export const dynamic = "force-static";
export const revalidate = 3600;

const escapeXml = (value) =>
  value.replace(/[<>&'"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[char]);

export async function GET() {
  const posts = await getAllPosts();
  const items = posts
    .map(
      (post) => `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(post.url)}</link>
      <guid isPermaLink="true">${escapeXml(post.url)}</guid>
      <pubDate>${new Date(`${post.date}T00:00:00+09:00`).toUTCString()}</pubDate>
      <description>${escapeXml(post.excerpt)}</description>
${post.keywords.map((keyword) => `      <category>${escapeXml(keyword)}</category>`).join("\n")}
    </item>`
    )
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(`${SITE.name} Blog`)}</title>
    <link>${absoluteUrl("/blogs")}</link>
    <atom:link href="${absoluteUrl("/feed.xml")}" rel="self" type="application/rss+xml" />
    <description>${escapeXml(`${SITE.author}（${SITE.authorEn}）のブログ`)}</description>
    <language>ja</language>${items}
  </channel>
</rss>
`;

  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
