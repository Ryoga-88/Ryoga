"use client";

import { useMemo } from "react";
import FilterChips from "app/components/filter-chips";
import CountryFlag from "app/components/country-flag";
import { useCategory } from "app/components/category";
import { sortPhotosByCaptureDate } from "app/lib/photo-order.mjs";
import { FULL_WIDTH, THUMB_WIDTH, aspectHeight, photoCaption, photoUrls, usePhotoLightbox } from "./photo-lightbox";

const EAGER_COUNT = 8;

export default function Library({ posts }) {
  const { selectedCategory, categories, categoryCounts, selectCategory, filteredPosts } = useCategory(posts, { urlParam: "country" });
  const orderedPosts = useMemo(() => sortPhotosByCaptureDate(filteredPosts), [filteredPosts]);
  const labels = Object.fromEntries(posts.map((post) => [post.category, post.title]));
  const countryCodes = Object.fromEntries(posts.filter((post) => post.countryCode).map((post) => [post.category, post.countryCode]));

  usePhotoLightbox("#photo-gallery", orderedPosts);

  const options = [
    { value: "all", label: "すべて", count: posts.length },
    ...categories.map((category) => ({
      value: category,
      label: labels[category],
      count: categoryCounts[category],
      icon: <CountryFlag countryCode={countryCodes[category]} category={category} />,
    })),
  ];

  return (
    <>
      <FilterChips label="国" options={options} selected={selectedCategory} onSelect={selectCategory} />
      <div id="photo-gallery" className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4">
        {orderedPosts.map((post, index) => {
          const { thumbnail, original } = photoUrls(post);
          return (
            <a
              key={`${index}-${post.url}`}
              href={original}
              data-pswp-width={post.width || FULL_WIDTH}
              data-pswp-height={post.height || aspectHeight(post.aspect, FULL_WIDTH)}
              data-photo-caption={photoCaption(post)}
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
