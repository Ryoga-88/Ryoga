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

  // カスタムコンポーネントの定義
  const components = {
    // 見出し要素
    h1: ({ node, ...props }) => (
      <h1 className="text-3xl font-bold mt-8 mb-4 dark:text-white" {...props} />
    ),
    h2: ({ node, ...props }) => (
      <h2 className="text-2xl font-bold mt-6 mb-3 dark:text-white" {...props} />
    ),
    h3: ({ node, ...props }) => (
      <h3 className="text-xl font-bold mt-5 mb-2 dark:text-white" {...props} />
    ),

    // 段落と文字装飾
    p: ({ node, ...props }) => (
      <p className="my-4 dark:text-slate-300" {...props} />
    ),
    strong: ({ node, ...props }) => (
      <strong className="font-bold dark:text-white" {...props} />
    ),
    em: ({ node, ...props }) => (
      <em className="italic dark:text-slate-200" {...props} />
    ),

    // リスト
    ul: ({ node, ...props }) => (
      <ul className="list-disc pl-8 my-4 dark:text-slate-300" {...props} />
    ),
    ol: ({ node, ...props }) => (
      <ol className="list-decimal pl-8 my-4 dark:text-slate-300" {...props} />
    ),
    li: ({ node, ...props }) => (
      <li className="mb-1 dark:text-slate-300" {...props} />
    ),

    // リンクとコード
    a: ({ node, ...props }) => (
      <a
        className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        {...props}
      />
    ),
    code: ({ node, inline, ...props }) =>
      inline ? (
        <code
          className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded dark:text-slate-300"
          {...props}
        />
      ) : (
        <code
          className="block bg-gray-100 dark:bg-gray-800 p-4 rounded my-4 overflow-auto dark:text-slate-300"
          {...props}
        />
      ),

    // 引用とコードブロック
    blockquote: ({ node, ...props }) => (
      <blockquote
        className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 py-1 my-4 italic dark:text-slate-400"
        {...props}
      />
    ),
    pre: ({ node, ...props }) => (
      <pre
        className="bg-gray-100 dark:bg-gray-800 p-4 rounded my-4 overflow-auto dark:text-slate-300"
        {...props}
      />
    ),

    // 表
    table: ({ node, ...props }) => (
      <table
        className="min-w-full my-6 border-collapse dark:text-slate-300"
        {...props}
      />
    ),
    thead: ({ node, ...props }) => (
      <thead className="bg-gray-100 dark:bg-gray-700" {...props} />
    ),
    th: ({ node, ...props }) => (
      <th
        className="py-2 px-4 border dark:border-gray-600 dark:text-white font-semibold"
        {...props}
      />
    ),
    tbody: ({ node, ...props }) => <tbody {...props} />,
    tr: ({ node, ...props }) => (
      <tr className="border-b dark:border-gray-700" {...props} />
    ),
    td: ({ node, ...props }) => (
      <td className="py-2 px-4 border dark:border-gray-600" {...props} />
    ),

    // 区切り線
    hr: ({ node, ...props }) => (
      <hr className="my-8 border-gray-300 dark:border-gray-700" {...props} />
    ),
  };

  return (
    <article className="container mx-auto max-w-3xl py-36 text-lg px-10 dark:bg-black">
      <h1 className="text-4xl font-bold mb-4 dark:text-white">{post.title}</h1>
      <p className="text-gray-600 dark:text-slate-400 mb-2">
        {post.date} - {post.category}
      </p>
      <p className="text-gray-600 dark:text-slate-400 mb-4">
        キーワード: {post.keywords.join(", ")}
      </p>
      <p className="text-gray-600 dark:text-slate-400 mb-4">
        説明: {post.description}
      </p>
      <hr className="my-4 dark:border-gray-700" />
      <div className="prose prose-lg max-w-none dark:prose-invert">
        <ReactMarkdown components={components}>{post.content}</ReactMarkdown>
      </div>
    </article>
  );
}
