"use client";

import FilterChips from "app/components/filter-chips";
import PostCard from "app/components/post-card";
import { useCategory } from "app/components/category";

export default function BlogList({ posts }) {
  const { selectedCategory, categories, categoryCounts, selectCategory, filteredPosts } = useCategory(posts, { urlParam: "category" });
  const labels = Object.fromEntries(posts.map((post) => [post.category, post.categoryLabel]));

  const options = [
    { value: "all", label: "すべて", count: posts.length },
    ...categories.map((category) => ({
      value: category,
      label: labels[category],
      count: categoryCounts[category],
    })),
  ];

  return (
    <>
      {categories.length > 1 && (
        <FilterChips label="カテゴリ" options={options} selected={selectedCategory} onSelect={selectCategory} />
      )}
      <div className="grid grid-cols-2 gap-x-4 gap-y-9 md:grid-cols-3 md:gap-x-6">
        {filteredPosts.map((post) => (
          <PostCard key={post.href} post={post} headingLevel="h2" />
        ))}
      </div>
    </>
  );
}
