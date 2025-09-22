"use client";

import React from "react";
import Image from "next/image";
import { useCategory } from "app/components/category";
import Link from "next/link";

export default function BlogList({ posts }) {
  const {
    selectedCategory,
    categories,
    categoryCounts,
    selectCategory,
    filteredPosts,
  } = useCategory(posts);

  return (
    <div
      className="container mx-auto px-2 py-6"
      style={{ position: "relative", zIndex: 10 }}
    >
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
            <span className="inline-flex items-center space-x-1">
              <CategoryTwemoji category={category} size={20} />
              <span>{category}</span>
              <span>({categoryCounts[category]})</span>
            </span>
          </button>
        ))}
      </div>
      <div>
        {filteredPosts.map((post) => (
          <PostLink key={post.slug} post={post}>
            <div className="bg-white dark:bg-black w-full border-b border-slate-300 px-6 py-4 flex justify-start items-center space-x-4 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-300 cursor-pointer">
              <div className="text-5xl p-4 bg-slate-100 dark:bg-white rounded-lg w-20 h-20 flex items-center justify-center">
                <CategoryTwemoji category={post.category} size={56} />
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
          </PostLink>
        ))}
      </div>
    </div>
  );
}

const categoryIcons = {
  note: {
    src: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f4dd.svg",
    alt: "ノートカテゴリ",
  },
  technology: {
    src: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f4bb.svg",
    alt: "テクノロジーカテゴリ",
  },
  research: {
    src: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f52c.svg",
    alt: "リサーチカテゴリ",
  },
  other: {
    src: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/2728.svg",
    alt: "その他カテゴリ",
  },
  default: {
    src: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f4d6.svg",
    alt: "ブログカテゴリ",
  },
};

function CategoryTwemoji({ category, size = 24 }) {
  const icon = categoryIcons[category] || categoryIcons.default;

  return (
    <Image
      src={icon.src}
      alt={icon.alt}
      width={size}
      height={size}
      className="inline-block"
      style={{ width: size, height: size }}
    />
  );
}

function PostLink({ post, children }) {
  if (post.externalUrl) {
    return (
      <a
        href={post.externalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={`/blogs/${post.slug}`} className="block">
      {children}
    </Link>
  );
}
