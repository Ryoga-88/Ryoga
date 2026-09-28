"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { TbArrowBackUp } from "react-icons/tb";

// Becomes true once the visitor has moved between pages inside the site.
let navigatedInApp = false;

// Rendered once in the root layout, which never remounts.
export function NavigationTracker() {
  const pathname = usePathname();
  const firstPathname = useRef(pathname);
  useEffect(() => {
    if (pathname !== firstPathname.current) navigatedInApp = true;
  }, [pathname]);
  return null;
}

// Returns to the previous page (scroll position and filters intact). Visitors
// who landed here from search or an AI citation go to `fallbackHref` instead.
export default function BackLink({ fallbackHref, className = "" }) {
  const router = useRouter();

  function goBack(event) {
    const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
    if (modified || !navigatedInApp) return;
    event.preventDefault();
    router.back();
  }

  return (
    <Link
      href={fallbackHref}
      aria-label="戻る"
      title="戻る"
      onClick={goBack}
      className={`inline-flex size-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-soft hover:text-ink ${className}`}
    >
      <TbArrowBackUp size={22} aria-hidden="true" />
    </Link>
  );
}
