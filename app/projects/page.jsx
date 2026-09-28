import PageTitle from "app/components/page-title";
import ProjectCard from "app/components/project-card";
import projects from "app/contents/projects/projects";
import { pageMetadata } from "app/lib/site";

export const metadata = pageMetadata({
  title: "Projects",
  description: "花房亮雅がこれまでに制作したWebアプリ・Webサイトの一覧です。",
  path: "/projects",
});

export default function ProjectsPage() {
  return (
    <div className="mx-auto max-w-page px-4 pt-10 sm:pt-14">
      <PageTitle title="Projects" lead="これまでに作ってきたもの" />
      <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2">
        {projects.map((project, index) => (
          <ProjectCard key={project.title} project={project} headingLevel="h2" preload={index === 0} />
        ))}
      </div>
    </div>
  );
}
