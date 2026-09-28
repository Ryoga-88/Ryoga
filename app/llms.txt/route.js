import projects from "app/contents/projects/projects";
import { getAllPosts } from "app/lib/posts";
import { SITE, absoluteUrl } from "app/lib/site";

export const dynamic = "force-static";
export const revalidate = 3600;

// /llms.txt (https://llmstxt.org): a plain summary for AI assistants that
// answer questions about this person and cite the pages below.
export async function GET() {
  const posts = await getAllPosts();
  const lines = [
    `# ${SITE.title}`,
    "",
    `> ${SITE.description}`,
    "",
    SITE.bio,
    "",
    "## Profile",
    "",
    `- 名前: ${SITE.author}（はなふさ りょうが / ${SITE.authorEn}）`,
    "- 所属: 大阪公立大学大学院 知能情報学分野専攻、株式会社Affectify",
    "- 研究: ラフ集合理論に基づくクラスタリングベースの協調フィルタリング",
    ...SITE.sameAs.map((url) => `- ${url}`),
    "",
    "## Blog",
    "",
    ...posts.map((post) => `- [${post.title}](${post.url}) (${post.date}): ${post.excerpt}`),
    "",
    "## Projects",
    "",
    ...projects.map((project) => `- [${project.title}](${project.link}) (${project.date}): ${project.description}`),
    "",
    "## Pages",
    "",
    `- [Profile](${absoluteUrl("/")})`,
    `- [Projects](${absoluteUrl("/projects")})`,
    `- [Blog](${absoluteUrl("/blogs")})`,
    `- [Photos](${absoluteUrl("/photos")})`,
    "",
  ];

  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
