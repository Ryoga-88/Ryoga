import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { notFound, redirect } from "next/navigation";

const postsDirectory = path.join(process.cwd(), "app", "contents", "blogs");

export async function generateStaticParams() {
  const filenames = fs.readdirSync(postsDirectory);
  return filenames
    .filter((filename) => filename.endsWith(".md"))
    .map((filename) => ({
      slug: filename.replace(/^\d{4}-\d{2}-\d{2}-(.+)\..*\.md$/, "$1"),
    }));
}

async function getPostData(slug) {
  try {
    const filenames = fs.readdirSync(postsDirectory);
    const matchedFile = filenames.find((file) => file.includes(slug));
    if (!matchedFile) {
      return null;
    }
    const fullPath = path.join(postsDirectory, matchedFile);
    const fileContents = fs.readFileSync(fullPath, "utf8");
    const { data } = matter(fileContents);
    const date = matchedFile.substring(0, 10);
    return {
      slug,
      date,
      ...data,
    };
  } catch (error) {
    console.error("Error reading post data:", error);
    return null;
  }
}

export default async function BlogPostPage({ params }) {
  const post = await getPostData(params.slug);
  if (!post) {
    notFound();
  }

  if (post.externalUrl) {
    redirect(post.externalUrl);
  }

  return redirect("/blogs");
}
