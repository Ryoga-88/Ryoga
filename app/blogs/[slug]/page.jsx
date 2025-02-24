import fs from "fs";
import path from "path";
import matter from "gray-matter";
import ReactMarkdown from "react-markdown";
import { notFound } from "next/navigation";

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
    const { data, content } = matter(fileContents);

    const date = matchedFile.substring(0, 10);

    return {
      slug,
      date,
      ...data,
      content,
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

  return (
    <article className="container mx-auto max-w-3xl py-36 text-lg px-10 dark:bg-white">
      <h1 className="text-4xl font-bold mb-4">{post.title}</h1>
      <p className="text-gray-600 mb-2">
        {post.date} - {post.category}
      </p>
      <p className="text-gray-600 mb-4">
        キーワード: {post.keywords.join(", ")}
      </p>
      <p className="text-gray-600 mb-4">説明: {post.description}</p>
      <hr className="my-4" />
      <div className="prose">
        <ReactMarkdown>{post.content}</ReactMarkdown>
      </div>
    </article>
  );
}
