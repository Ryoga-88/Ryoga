import Link from "next/link";
import { formatDate } from "app/lib/site";

// headingLevel: "h2" on list pages, "h3" under a section heading.
export default function PostCard({ post, headingLevel: Heading = "h3" }) {
  const content = (
    <>
      {/* Decorative miniature of the page; the real title follows below. */}
      <div
        aria-hidden="true"
        className="flex aspect-[16/10] items-center justify-center overflow-hidden rounded-card bg-tint transition-colors duration-300 group-hover:bg-tint-strong"
      >
        <div className="post-paper">
          <div className="post-paper__inner">
            <p className="post-paper__title">{post.title}</p>
            {post.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.image} alt="" loading="lazy" decoding="async" className="post-paper__image" />
            )}
            <p>{post.excerpt}</p>
          </div>
        </div>
      </div>
      <Heading className="mt-3 line-clamp-2 text-[0.98rem] font-medium leading-[1.7] tracking-wide sm:text-[1.06rem]">
        {post.title}
      </Heading>
      <p className="mt-1 text-[0.84rem] tracking-wide text-muted">
        <time dateTime={post.date}>{formatDate(post.date)}</time>に公開
        {post.external && (
          <>
            <span aria-hidden="true"> · {post.source} ↗</span>
            <span className="sr-only">（{post.source}、新しいタブで開きます）</span>
          </>
        )}
      </p>
    </>
  );

  return (
    <article>
      {post.external ? (
        <a href={post.href} target="_blank" rel="noopener noreferrer" className="group block rounded-card">
          {content}
        </a>
      ) : (
        <Link href={post.href} className="group block rounded-card">
          {content}
        </Link>
      )}
    </article>
  );
}
