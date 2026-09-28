"use client";

import { useEffect } from "react";
import PhotoSwipeLightbox from "photoswipe/lightbox";
import "photoswipe/style.css";
import FilterChips from "app/components/filter-chips";
import { useCategory } from "app/components/category";

const THUMB_WIDTH = 500;
const FULL_WIDTH = 3000;
const EAGER_COUNT = 8;

// Every photo URL is built here, so moving off Gyazo only touches this function.
function photoUrls(post) {
  return {
    thumbnail: `${post.url}/thumb/${THUMB_WIDTH}`,
    original: `${post.url}/thumb/${FULL_WIDTH}`,
  };
}

function aspectHeight(aspect, width) {
  const [w, h] = aspect.split(" / ").map(Number);
  return Math.round((width * h) / w);
}

export default function Library({ posts }) {
  const { selectedCategory, categories, categoryCounts, selectCategory, filteredPosts } = useCategory(posts);
  const labels = Object.fromEntries(posts.map((post) => [post.category, post.title]));

  useEffect(() => {
    const lightbox = new PhotoSwipeLightbox({
      gallery: "#photo-gallery",
      children: "a",
      pswpModule: () => import("photoswipe"),
    });
    lightbox.init();
    return () => lightbox.destroy();
  }, [filteredPosts]);

  const options = [
    { value: "all", label: "すべて", count: posts.length },
    ...categories.map((category) => ({
      value: category,
      label: labels[category],
      count: categoryCounts[category],
      icon: (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/images/${category}-flag.svg`} alt="" width={16} height={16} className="size-4 rounded-sm object-cover" />
      ),
    })),
  ];

  return (
    <>
      <FilterChips label="国" options={options} selected={selectedCategory} onSelect={selectCategory} />
      <div id="photo-gallery" className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4">
        {filteredPosts.map((post, index) => {
          const { thumbnail, original } = photoUrls(post);
          return (
            <a
              key={`${index}-${post.url}`}
              href={original}
              data-pswp-width={FULL_WIDTH}
              data-pswp-height={aspectHeight(post.aspect, FULL_WIDTH)}
              target="_blank"
              rel="noreferrer"
              className="block aspect-square overflow-hidden rounded-md bg-soft"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumbnail}
                alt={`${post.title}で撮影した写真`}
                width={THUMB_WIDTH}
                height={aspectHeight(post.aspect, THUMB_WIDTH)}
                loading={index < EAGER_COUNT ? "eager" : "lazy"}
                decoding="async"
                className="size-full object-cover transition-transform duration-500 hover:scale-[1.03]"
              />
            </a>
          );
        })}
      </div>
    </>
  );
}
