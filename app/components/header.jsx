"use client";

import React, { useState, useEffect } from "react";
import Logo from "./logo";
import Nav from "./nav";
import { usePathname } from "next/navigation";
import blogs from "app/contents/blogs";

function Header({ isOpen, setIsOpen, isDarkMode, toggleDarkMode }) {
  const pathname = usePathname();
  const [blogsData, setBlogsData] = useState([]);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setBlogsData(blogs);
  }, [blogsData]);

  // スクロールイベントで透明度を変更する
  useEffect(() => {
    const handleScroll = () => {
      // 非推奨ではなく最新の scrollY を使用
      setScrolled(window.scrollY > 0);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const getBlogDetails = () => {
    if (pathname.startsWith("/blogs/")) {
      const slug = pathname.split("/blogs/")[1];
      const blog = blogs.find((blog) => blog.slug === slug);
      if (blog) {
        return { title: blog.title, date: blog.date };
      } else {
        return { title: slug, date: "" };
      }
    }

    switch (pathname) {
      case "/":
        return { title: "花房 亮雅 | Ryoga Hanafusa", date: "" };
      case "/projects":
        return { title: "プロジェクト一覧", date: "" };
      case "/photos":
        return { title: "写真ギャラリー", date: "" };
      case "/blogs":
        return { title: "ブログ", date: "" };
      case "/privacy":
        return { title: "プライバシーポリシー", date: "" };
      default:
        return { title: "Ryoga Hanafusa", date: "" };
    }
  };

  const { title, date } = getBlogDetails();

  return (
    <header className="relative py-6 bg-white dark:bg-black w-full ">
      <div
        className={`fixed top-0 left-0 w-full bg-white dark:bg-black border-b dark:border-b-white transition-opacity duration-300 z-50 ${
          scrolled ? "opacity-95" : "opacity-100"
        }
        }`}
      >
        <div className="container mx-auto px-4 md:px-8 lg:px-16">
          <div className="flex flex-wrap justify-between items-center">
            <Logo />
            <Nav
              isOpen={isOpen}
              setIsOpen={setIsOpen}
              isDarkMode={isDarkMode}
              toggleDarkMode={toggleDarkMode}
            />
          </div>
        </div>
      </div>

      <div className="pt-24">
        <div className="py-10 text-2xl font-bold text-center dark:text-white">
          {title}
          {date && <div className="text-sm text-gray-500">{date}</div>}
        </div>
      </div>
    </header>
  );
}

export default Header;
