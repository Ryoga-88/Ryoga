"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useCategory } from "app/components/category";

export default function BlogList({ posts }) {
  const {
    selectedCategory,
    categories,
    categoryCounts,
    selectCategory,
    filteredPosts,
  } = useCategory(posts);

  return (
    <div className="container mx-auto px-2 py-6">
      <div className="overflow-x-auto whitespace-nowrap space-x-8 flex justify-start md:justify-center items-center px-2 py-2 text-neutral-400 dark:text-white">
        <button
          onClick={() => selectCategory("all")}
          className={`hover:text-neutral-500 ${
            selectedCategory === "all" ? "underline" : ""
          }`}
        >
          すべて ({posts.length})
        </button>
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => selectCategory(category)}
            className={`hover:text-neutral-500 ${
              selectedCategory === category ? "underline" : ""
            }`}
          >
            {categoryEmojis[category] || "📚"} {category} (
            {categoryCounts[category]})
          </button>
        ))}
      </div>
      <div>
        {filteredPosts.map((post) => (
          <Link href={`/blogs/${post.slug}`} key={post.slug} className="block">
            <div className="w-full border-b border-slate-300 px-6 py-4 flex justify-start items-center space-x-4 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-300 cursor-pointer dark:bg-black">
              <div className="text-5xl p-4 bg-slate-100 dark:bg-slate-500 rounded-lg w-20 h-20 flex items-center justify-center">
                {categoryEmojis[post.category] || "📄"}
              </div>
              {/* 記載 */}
              <div className="my-2 dark:text-white">
                <h3>{post.date}</h3>
                <div className="flex flex-wrap w-full justify-start space-x-1 py-1">
                  {post.keywords.map((keyword, idx) => (
                    <div
                      key={idx}
                      className="inline-flex items-center rounded-md bg-gray-50 dark:bg-slate-600 px-2 py-1 text-xs font-medium text-gray-600 dark:text-white ring-1 ring-inset ring-gray-500/10"
                    >
                      {keyword}
                    </div>
                  ))}
                </div>
                <div className="text-md font-semibold">{post.title}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

const categoryEmojis = {
  note: "📄",
  test: "💡",
  mock: "🔍",
};
