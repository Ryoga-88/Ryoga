import { useLayoutEffect, useMemo, useState } from "react";

// urlParam keeps the selection in the query string, so the browser's back
// button returns to the same filter. It is read after hydration rather than
// with useSearchParams, which would drop the list from the static HTML.
export const useCategory = (posts, { urlParam } = {}) => {
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

  useLayoutEffect(() => {
    if (!urlParam) return;
    const value = new URLSearchParams(window.location.search).get(urlParam);
    if (categories.includes(value)) setSelectedCategory(value);
  }, [urlParam, categories]);

  const selectCategory = (category) => {
    setSelectedCategory(category);
    if (!urlParam) return;
    const url = new URL(window.location.href);
    if (category === "all") url.searchParams.delete(urlParam);
    else url.searchParams.set(urlParam, category);
    window.history.replaceState(null, "", url);
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
