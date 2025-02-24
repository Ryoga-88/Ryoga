import { useState, useMemo } from "react";

export const useCategory = (posts) => {
  const [selectedCategory, setSelectedCategory] = useState("all");

  const categoryCounts = useMemo(() => {
    return posts.reduce((acc, post) => {
      acc[post.category] = (acc[post.category] || 0) + 1;
      return acc;
    }, {});
  }, [posts]);

  const categories = useMemo(() => {
    return Array.from(new Set(posts.map((post) => post.category)));
  }, [posts]);

  const selectCategory = (category) => {
    setSelectedCategory(category);
  };

  const filteredPosts = useMemo(() => {
    if (selectedCategory === "all") {
      return posts;
    }
    return posts.filter((post) => post.category === selectedCategory);
  }, [posts, selectedCategory]);

  return {
    selectedCategory,
    categories,
    categoryCounts,
    selectCategory,
    filteredPosts,
  };
};
