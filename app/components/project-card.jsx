import Image from "next/image";
import { formatDate } from "app/lib/site";

// headingLevel: "h2" on list pages, "h3" under a section heading.
export default function ProjectCard({ project, headingLevel: Heading = "h3", preload = false }) {
  return (
    <article>
      <a href={project.link} target="_blank" rel="noopener noreferrer" className="group block rounded-card">
        <div className="overflow-hidden rounded-card bg-tint">
          <Image
            src={project.image}
            alt=""
            placeholder="blur"
            preload={preload}
            sizes="(min-width: 640px) 400px, 100vw"
            className="aspect-[16/9] w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        </div>
        <Heading className="mt-3 text-[1.06rem] font-bold tracking-wide">
          {project.title}
          <span aria-hidden="true" className="ml-1 font-normal text-muted">
            ↗
          </span>
          <span className="sr-only">（新しいタブで開きます）</span>
        </Heading>
        <p className="mt-1 line-clamp-3 text-[0.95rem] leading-[1.85] text-muted">{project.description}</p>
        <p className="mt-2 text-[0.84rem] tracking-wide text-muted">
          <time dateTime={project.date}>{formatDate(project.date)}</time>
        </p>
      </a>
    </article>
  );
}
