"use client";

import { useEffect } from "react";
import PhotoSwipeLightbox from "photoswipe/lightbox";
import "photoswipe/style.css";
import "./lightbox.css";

export const THUMB_WIDTH = 500;
export const FULL_WIDTH = 2400;

export function photoUrls(post) {
  return { thumbnail: post.thumbnail || post.url, original: post.url };
}

export function aspectHeight(aspect, width) {
  const [w, h] = aspect.split(" / ").map(Number);
  return Math.round((width * h) / w);
}

export function photoCaption(post) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(post.date || "") ? post.date.replaceAll("-", "/") : "";
  const place = [...new Set([post.title, post.locationLabel].filter(Boolean))].join("・");
  return [place, date].filter(Boolean).join(" · ");
}

// Opens links inside `gallery` (a selector) in PhotoSwipe; `items` re-binds after the list changes.
export function usePhotoLightbox(gallery, items) {
  useEffect(() => {
    const lightbox = new PhotoSwipeLightbox({
      gallery,
      children: "a",
      pswpModule: () => import("photoswipe"),
      paddingFn: ({ x }) => ({ top: 56, bottom: x < 640 ? 80 : 64, left: 16, right: 16 }),
    });
    lightbox.on("uiRegister", () => {
      lightbox.pswp.ui.registerElement({
        name: "photo-caption",
        appendTo: "root",
        isButton: false,
        onInit: (element, pswp) => {
          element.setAttribute("aria-live", "polite");
          element.setAttribute("aria-atomic", "true");
          const updateCaption = () => {
            const caption = pswp.currSlide?.data.element?.dataset.photoCaption || "";
            element.textContent = caption;
            element.hidden = !caption;
          };
          pswp.on("change", updateCaption);
          updateCaption();
        },
      });
    });
    lightbox.init();
    return () => lightbox.destroy();
  }, [gallery, items]);
}
