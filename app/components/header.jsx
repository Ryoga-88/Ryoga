"use client";

import React, { useState, useEffect } from "react";
import Logo from "./logo";
import Nav from "./nav";
import { usePathname } from "next/navigation";
import blogs from "app/contents/blogs";

function Header({ isOpen, setIsOpen, isDarkMode, toggleDarkMode }) {
  const pathname = usePathname();

  const [blogsData, setBlogsData] = useState([]);

  useEffect(() => {
    setBlogsData(blogs);
  }, [blogsData]);

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
        return { title: "Ryoga Hanafusa", date: "" };
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
    <header className="py-6 bg-white dark:bg-black w-full border-b dark:border-b-white">
      <div className="container mx-auto px-4 md:px-8 lg:px-16 w-full">
        <div className="flex flex-wrap justify-between items-center w-full">
          <Logo />
          <Nav
            isOpen={isOpen}
            setIsOpen={setIsOpen}
            isDarkMode={isDarkMode}
            toggleDarkMode={toggleDarkMode}
          />
        </div>
      </div>
      <div className="py-10 text-2xl font-bold text-center dark:text-white">
        {title}
        {date && <div className="text-sm text-gray-500">{date}</div>}
      </div>
    </header>
  );
}

export default Header;
