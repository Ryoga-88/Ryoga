import Link from "next/link";
import { TbMap2, TbPhoto } from "react-icons/tb";

const VIEWS = [
  { key: "photos", href: "/photos", label: "写真", Icon: TbPhoto },
  { key: "map", href: "/photos/map", label: "地図", Icon: TbMap2 },
];

export default function PhotoViewTabs({ current }) {
  return (
    <nav aria-label="写真の表示方法" className="-mt-4 mb-8 inline-flex rounded-full border border-line p-1">
      {VIEWS.map(({ key, href, label, Icon }) => (
        <Link
          key={key}
          href={href}
          aria-current={current === key ? "page" : undefined}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm tracking-wide text-muted transition-colors hover:text-ink aria-[current=page]:bg-ink aria-[current=page]:text-bg"
        >
          <Icon aria-hidden="true" className="size-4" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
