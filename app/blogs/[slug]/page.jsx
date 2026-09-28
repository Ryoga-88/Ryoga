import Link from "next/link";
import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import { TbArrowLeft, TbArrowUpRight } from "react-icons/tb";
import BackLink from "app/components/back-link";
import JsonLd from "app/components/json-ld";
import { getLocalPost, getLocalPosts } from "app/lib/posts";
import { PERSON_ID, absoluteUrl, formatDate, pageMetadata } from "app/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return getLocalPosts().map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = getLocalPost(slug);
  if (!post) return {};
  return pageMetadata({
    title: post.title,
    description: post.description,
    path: post.href,
    keywords: post.keywords,
    openGraph: { type: "article", publishedTime: post.date, authors: [absoluteUrl("/")], tags: post.keywords },
  });
}

// The page already has an <h1>; headings inside the Markdown start at <h2>.
const markdownComponents = {
  h1: ({ node, ...props }) => <h2 {...props} />,
  a: ({ node, href, ...props }) =>
    href?.startsWith("http") ? <a href={href} target="_blank" rel="noopener noreferrer" {...props} /> : <a href={href} {...props} />,
};

export default async function BlogPostPage({ params }) {
  const { slug } = await params;
  const post = getLocalPost(slug);
  if (!post) notFound();

  return (
    <div className="mx-auto max-w-article px-4 pt-4 sm:pt-8">
      {/* -ml-2 lines the arrow up with the text edge below. */}
      <BackLink fallbackHref="/blogs" className="-ml-2" />
      <article className="mt-5 sm:mt-7">
        <p className="text-sm tracking-wide text-muted">
          <Link href="/blogs" className="hover:text-ink">
            Blog
          </Link>
          <span aria-hidden="true"> / </span>
          {post.categoryLabel}
        </p>
        <h1 className="mt-3 text-[1.6rem] font-bold leading-[1.6] tracking-wide sm:text-[1.85rem]">{post.title}</h1>
        <p className="mt-3 text-sm tracking-wide text-muted">
          <time dateTime={post.date}>{formatDate(post.date)}</time>に公開
        </p>
        {post.keywords.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="キーワード">
            {post.keywords.map((keyword) => (
              <li key={keyword} className="rounded-full bg-soft px-2.5 py-0.5 text-xs text-muted">
                {keyword}
              </li>
            ))}
          </ul>
        )}

        <div className="article-body mt-10">
          <Markdown components={markdownComponents}>{post.content}</Markdown>
        </div>

        {post.externalUrl && (
          <aside className="mt-14 rounded-card bg-tint p-5 sm:p-6">
            <p className="text-sm font-bold tracking-wide">元の記事</p>
            <p className="mt-1 text-sm text-muted">この記事の詳しい内容は {post.source} に掲載されています。</p>
            <a
              href={post.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-bold text-bg transition-opacity hover:opacity-85"
            >
              {post.source}で読む
              <TbArrowUpRight size={16} aria-hidden="true" />
              <span className="sr-only">（新しいタブで開きます）</span>
            </a>
          </aside>
        )}

        <Link href="/blogs" className="mt-14 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <TbArrowLeft size={16} aria-hidden="true" />
          記事一覧へ
        </Link>

        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.title,
            description: post.description,
            datePublished: post.date,
            inLanguage: "ja",
            url: post.url,
            mainEntityOfPage: post.url,
            author: { "@id": PERSON_ID },
            publisher: { "@id": PERSON_ID },
            keywords: post.keywords.join(", "),
            ...(post.externalUrl && { isBasedOn: post.externalUrl }),
          }}
        />
      </article>
    </div>
  );
}
