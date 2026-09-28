import Image from "next/image";
import Link from "next/link";
import JsonLd from "app/components/json-ld";
import PostCard from "app/components/post-card";
import ProjectCard from "app/components/project-card";
import Skills from "app/components/skills";
import projects from "app/contents/projects/projects";
import { getAllPosts } from "app/lib/posts";
import { PERSON_ID, SITE, absoluteUrl, pageMetadata } from "app/lib/site";
import avatar from "public/images/eyecatch.jpg";

// New note posts appear without a redeploy.
export const revalidate = 3600;

export const metadata = pageMetadata({ path: "/" });

function Section({ id, title, more, children }) {
  return (
    <section aria-labelledby={id} className="mt-20">
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <h2 id={id} className="text-lg font-bold tracking-wider">
          {title}
        </h2>
        {more && (
          <Link href={more.href} className="text-sm text-muted transition-colors hover:text-ink">
            {more.label} →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export default async function Home() {
  const posts = (await getAllPosts()).slice(0, 6);

  return (
    <div className="mx-auto max-w-page px-4 pt-10 sm:pt-14">
      <section aria-labelledby="profile-name" className="flex flex-col gap-6 sm:flex-row sm:gap-8">
        <Image
          src={avatar}
          alt="花房 亮雅のプロフィール写真"
          width={112}
          height={112}
          preload
          className="size-24 shrink-0 rounded-squircle object-cover sm:size-28"
        />
        <div>
          <h1 id="profile-name" className="text-[1.6rem] font-bold tracking-wider">
            花房 亮雅
          </h1>
          <p className="mt-0.5 text-sm tracking-widest text-muted">Ryoga Hanafusa</p>
          <p className="mt-5 leading-[1.95] tracking-[0.03em]">{SITE.bio}</p>
          <ul className="mt-5 flex flex-wrap gap-2 text-sm">
            <li>
              <a href={SITE.sameAs[0]} rel="me noopener" className="inline-block rounded-full bg-soft px-3.5 py-1.5 transition-colors hover:bg-tint">
                note
              </a>
            </li>
            <li>
              <a href={SITE.sameAs[1]} rel="me noopener" className="inline-block rounded-full bg-soft px-3.5 py-1.5 transition-colors hover:bg-tint">
                X {SITE.twitter}
              </a>
            </li>
          </ul>
        </div>
      </section>

      {posts.length > 0 && (
        <Section id="blog" title="Blog" more={{ href: "/blogs", label: "すべての記事" }}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-9 md:grid-cols-3 md:gap-x-6">
            {posts.map((post) => (
              <PostCard key={post.href} post={post} />
            ))}
          </div>
        </Section>
      )}

      <Section id="projects" title="Projects" more={{ href: "/projects", label: "すべての制作物" }}>
        <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2">
          {projects.slice(0, 4).map((project) => (
            <ProjectCard key={project.title} project={project} />
          ))}
        </div>
      </Section>

      <Section id="skills" title="Skills">
        <Skills />
      </Section>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          url: absoluteUrl("/"),
          name: SITE.title,
          inLanguage: "ja",
          mainEntity: { "@id": PERSON_ID },
        }}
      />
    </div>
  );
}
