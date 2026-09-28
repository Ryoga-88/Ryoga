import Link from "next/link";
import { SITE } from "app/lib/site";

const linkClass = "underline-offset-4 transition-colors hover:text-ink hover:underline";

export default function Footer() {
  return (
    <footer className="mt-28 border-t border-line">
      <div className="mx-auto flex max-w-page flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          © 2024–{new Date().getFullYear()} {SITE.authorEn}
        </p>
        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          <li>
            <a href={SITE.sameAs[0]} rel="me noopener" className={linkClass}>
              note
            </a>
          </li>
          <li>
            <a href={SITE.sameAs[1]} rel="me noopener" className={linkClass}>
              X
            </a>
          </li>
          <li>
            <a href="/feed.xml" className={linkClass}>
              RSS
            </a>
          </li>
          <li>
            <Link href="/privacy" className={linkClass}>
              プライバシーポリシー
            </Link>
          </li>
        </ul>
      </div>
    </footer>
  );
}
