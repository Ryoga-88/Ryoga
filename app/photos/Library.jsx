"use client";

import React, { useEffect, useMemo } from "react";
import PhotoSwipeLightbox from "photoswipe/lightbox";
import "photoswipe/style.css";
import { useCategory } from "app/components/category";

export default function Library({ posts }) {
  const {
    selectedCategory,
    categories,
    categoryCounts,
    selectCategory,
    filteredPosts,
  } = useCategory(posts);

  const images = useMemo(() => {
    return posts
      .filter(
        (post) =>
          selectedCategory === "all" || post.category === selectedCategory
      )
      .map((post) => {
        const [aspectWidth, aspectHeight] = post.aspect
          .split(" / ")
          .map(Number);
        const width = 3000;
        const height = (width * aspectHeight) / aspectWidth;

        return {
          original: `${post.url}/thumb/3000`,
          thumbnail: `${post.url}/thumb/500`,
          description: post.title,
          width,
          height,
        };
      });
  }, [filteredPosts, selectedCategory]);

  useEffect(() => {
    let lightbox = new PhotoSwipeLightbox({
      gallery: "#photo-gallery",
      children: "a",
      pswpModule: () => import("photoswipe"),
    });
    lightbox.init();

    return () => {
      lightbox.destroy();
      lightbox = null;
    };
  }, [images]);

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
            {categoryEmojis[category] || "📚"} {category} (
            {categoryCounts[category]})
          </button>
        ))}
      </div>
      <div
        id="photo-gallery"
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
      >
        {images.map((image, index) => (
          <a
            href={image.original}
            data-pswp-width={image.width}
            data-pswp-height={image.height}
            key={index}
            target="_blank"
            rel="noreferrer"
            className="aspect-square block overflow-hidden"
          >
            <img
              src={image.thumbnail}
              alt={image.description}
              className="object-cover w-full h-full cursor-pointer"
            />
          </a>
        ))}
      </div>
    </div>
  );
}

const categoryEmojis = {
  Turkey: (
    <img
      src="/images/Turkey-flag.svg"
      alt="Turkey Flag"
      className="inline-block w-4 h-4 mr-1"
    />
  ),
  India: (
    <img
      src="/images/India-flag.svg"
      alt="India Flag"
      className="inline-block w-4 h-4 mr-1"
    />
  ),
  Vietnam: (
    <img
      src="/images/Vietnam-flag.svg"
      alt="Vietnam Flag"
      className="inline-block w-4 h-4 mr-1"
    />
  ),
  Cambodia: (
    <img
      src="/images/Cambodia-flag.svg"
      alt="Cambodia Flag"
      className="inline-block w-4 h-4 mr-1"
    />
  ),
  Thailand: (
    <img
      src="/images/Thailand-flag.svg"
      alt="Thailand Flag"
      className="inline-block w-4 h-4 mr-1"
    />
  ),
  Singapore: (
    <img
      src="/images/Singapore-flag.svg"
      alt="Singapore Flag"
      className="inline-block w-4 h-4 mr-1"
    />
  ),
  Malaysia: (
    <img
      src="/images/Malaysia-flag.svg"
      alt="Malaysia Flag"
      className="inline-block w-4 h-4 mr-1"
    />
  ),
};
