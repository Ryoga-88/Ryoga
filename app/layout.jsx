"use client";

import "./globals.css";
import Header from "./components/header";
import Footer from "./components/footer";
import React, { useState, useEffect } from "react";
import Head from "next/head";

import { metadata } from "./metadata";

export default function RootLayout({ children }) {
  const [isopen, setIsOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // クライアントサイドでのダークモード設定の保存
  useEffect(() => {
    // ローカルストレージから初期値を取得
    const savedMode = localStorage.getItem("darkMode");
    if (savedMode !== null) {
      setIsDarkMode(savedMode === "true");
      if (savedMode === "true") {
        document.documentElement.classList.add("dark");
      }
    } else {
      // ユーザーのシステム設定を確認
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      setIsDarkMode(prefersDark);
      if (prefersDark) {
        document.documentElement.classList.add("dark");
      }
    }
  }, []);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem("darkMode", newMode.toString());

    if (newMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  return (
    <html lang="ja" className={isDarkMode ? "dark" : ""}>
      <head>
        {/* 基本的なSEOメタタグ */}
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content={metadata.description} />
        <meta name="keywords" content={metadata.keywords} />
        <meta name="author" content={metadata.author} />

        {/* OGP（Open Graph Protocol）タグ */}
        <meta property="og:title" content={metadata.title} />
        <meta property="og:description" content={metadata.description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={metadata.url} />
        <meta property="og:image" content={metadata.image} />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={metadata.title} />
        <meta name="twitter:description" content={metadata.description} />
        <meta name="twitter:image" content={metadata.image} />

        {/* ファビコン */}
        <link rel="icon" href="/favicon.ico" />
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/apple-touch-icon.png"
        />

        {/* 外部リソース */}
        <link
          rel="stylesheet"
          type="text/css"
          href="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/devicon.min.css"
        />

        {/* 構造化データ (JSON-LD) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: metadata.title,
              description: metadata.description,
              url: metadata.url,
            }),
          }}
        />

        <title>{metadata.title}</title>
      </head>
      <body className="dark:bg-black min-h-screen">
        <Header
          isOpen={isopen}
          setIsOpen={setIsOpen}
          isDarkMode={isDarkMode}
          toggleDarkMode={toggleDarkMode}
        />
        <main
          className={`transition-all duration-300 ${isopen ? "blur-lg" : ""}`}
        >
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
