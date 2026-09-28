"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TbMenu2, TbX } from "react-icons/tb";
import ThemeToggle from "app/components/theme-toggle";
import avatar from "public/images/eyecatch.jpg";

const NAV_ITEMS = [
  { href: "/projects", label: "Projects" },
  { href: "/photos", label: "Photos" },
  { href: "/blogs", label: "Blog" },
];

const linkClass =
  "rounded-full px-3 py-2 text-[0.95rem] tracking-wide text-muted transition-colors hover:bg-soft hover:text-ink aria-[current=page]:font-bold aria-[current=page]:text-ink";
const drawerLinkClass =
  "block rounded-xl px-3 py-3 text-lg tracking-wide text-muted transition-colors hover:bg-soft hover:text-ink aria-[current=page]:font-bold aria-[current=page]:text-ink";

export default function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const isCurrent = (href) => pathname === href || pathname.startsWith(`${href}/`);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    const closeOnEscape = (event) => event.key === "Escape" && close();
    // The drawer only exists below sm; widening the window closes it.
    const desktop = window.matchMedia("(min-width: 640px)");
    const root = document.documentElement;
    root.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    desktop.addEventListener("change", close);
    return () => {
      root.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
      desktop.removeEventListener("change", close);
    };
  }, [menuOpen]);

  const navLinks = (className, onNavigate) =>
    NAV_ITEMS.map(({ href, label }) => (
      <li key={href}>
        <Link
          href={href}
          aria-current={isCurrent(href) ? "page" : undefined}
          className={className}
          onClick={onNavigate}
        >
          {label}
        </Link>
      </li>
    ));

  return (
    <header className="sticky top-0 z-30">
      {/* The blur sits on its own layer: backdrop-filter on <header> itself
          would trap the fixed drawer below inside the header's box. */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-bg/90 backdrop-blur-md" />
      {/* Above the drawer, so the theme switch and close button stay usable. */}
      <div className="relative z-30 mx-auto flex h-16 max-w-page items-center justify-between gap-3 px-4">
        <Link href="/" className="flex items-center gap-2.5 rounded-lg py-1">
          <Image
            src={avatar}
            alt=""
            width={32}
            height={32}
            className="size-8 rounded-squircle object-cover"
          />
          <span className="font-bold tracking-wide">Ryoga Hanafusa</span>
        </Link>

        <div className="flex items-center gap-1">
          <nav aria-label="メイン" className="hidden sm:block">
            <ul className="flex items-center gap-0.5">{navLinks(linkClass)}</ul>
          </nav>
          <ThemeToggle className="px-1" />
          <button
            type="button"
            aria-label="メニュー"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            onClick={() => setMenuOpen((open) => !open)}
            className="inline-flex size-11 items-center justify-center rounded-full transition-colors hover:bg-soft sm:hidden"
          >
            {menuOpen ? <TbX size={22} aria-hidden="true" /> : <TbMenu2 size={22} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer: slides in from the left over a blurred page. */}
      <div
        aria-hidden="true"
        onClick={() => setMenuOpen(false)}
        className={`fixed inset-0 z-10 bg-bg/30 backdrop-blur-md transition-opacity duration-500 sm:hidden ${
          menuOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <nav
        id="mobile-nav"
        aria-label="メイン"
        inert={!menuOpen}
        className={`fixed inset-y-0 left-0 z-20 w-3/4 max-w-xs bg-bg/90 backdrop-blur-md transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] sm:hidden ${
          menuOpen ? "translate-x-0 shadow-xl" : "-translate-x-full"
        }`}
      >
        <ul className="flex flex-col gap-1 px-3 pt-20">
          {navLinks(drawerLinkClass, () => setMenuOpen(false))}
        </ul>
      </nav>
    </header>
  );
}
