"use client";

import { TbMoon, TbSun } from "react-icons/tb";
import { useTheme } from "app/components/theme-provider";

export default function ThemeToggle({ className = "" }) {
  const { theme, ready, toggleTheme } = useTheme();
  const dark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-label="ダークモード"
      aria-checked={dark}
      title={dark ? "ライトモードに切り替える" : "ダークモードに切り替える"}
      disabled={!ready}
      onClick={toggleTheme}
      className={`theme-toggle inline-flex h-11 shrink-0 items-center justify-center rounded-full disabled:cursor-wait ${className}`}
    >
      {/* Position comes from html[data-theme], so it is right before hydration. */}
      <span className="theme-toggle__track" aria-hidden="true">
        <span className="theme-toggle__thumb" />
        <TbSun className="theme-toggle__sun" size={15} />
        <TbMoon className="theme-toggle__moon" size={15} />
      </span>
    </button>
  );
}
