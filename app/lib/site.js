// Single source of truth for the site's identity. Change `url` here when a
// custom domain is connected; canonical URLs, sitemap, feeds and JSON-LD follow.
export const SITE = {
  url: (process.env.NEXT_PUBLIC_SITE_URL || "https://ryoga-hanafusa.vercel.app").replace(/\/$/, ""),
  name: "Ryoga.io",
  author: "花房 亮雅",
  authorEn: "Ryoga Hanafusa",
  authorReading: "はなふさ りょうが",
  authorAliases: ["花房亮雅", "はなふさりょうが", "はなふさ りょうが", "Ryoga Hanafusa", "Hanafusa Ryoga", "HanafusaRyoga"],
  familyNames: ["花房", "はなふさ", "Hanafusa"],
  givenNames: ["亮雅", "りょうが", "Ryoga"],
  role: "プログラマー",
  title: "花房 亮雅 (Ryoga Hanafusa)",
  description:
    "花房亮雅（はなふさりょうが / Ryoga Hanafusa）のポートフォリオ。AI（人工知能）を使ったアプリやWebサービスを開発するプログラマー。大阪公立大学大学院で推薦システムを研究。株式会社Affectify社員。制作物・写真・ブログを掲載。",
  bio: "AI（人工知能）を使ったアプリやWebサービスを開発するプログラマーです．大阪公立大学大学院 知能情報学分野専攻．株式会社Affectify社員．第八期公益財団法人シマノ財団奨学生，2023年度・2024年度・2025年度・2026年度フジシール財団奨学生．現在はラフ集合理論に基づくクラスタリングベースの協調フィルタリングに関する研究に取り組んでいます．大学ではC言語，JavaScript，JavaやPythonなどを学びました．新しい技術や製品に触れたり学ぶことを愛しています．",
  keywords: [
    "花房亮雅",
    "はなふさりょうが",
    "Ryoga Hanafusa",
    "Hanafusa Ryoga",
    "大阪公立大学大学院",
    "知能情報学",
    "ラフ集合理論",
    "協調フィルタリング",
    "推薦システム",
    "Affectify",
    "シマノ財団奨学生",
    "フジシール財団奨学生",
  ],
  image: "/images/eyecatch.jpg",
  twitter: "@ryoga_8723",
  noteUser: "ryoga_hanafusa",
  // Profiles that belong to the same person; AI and search engines use these
  // to connect the accounts into one entity.
  sameAs: ["https://note.com/ryoga_hanafusa", "https://x.com/ryoga_8723"],
};

export const absoluteUrl = (path = "/") => `${SITE.url}${path === "/" ? "/" : path}`;

export const PERSON_ID = `${SITE.url}/#person`;

export function personJsonLd() {
  return {
    "@type": "Person",
    "@id": PERSON_ID,
    name: SITE.author,
    alternateName: SITE.authorAliases,
    // Surnames describe part of the name, rather than identifying a person alone.
    familyName: SITE.familyNames,
    givenName: SITE.givenNames,
    jobTitle: SITE.role,
    url: absoluteUrl("/"),
    image: absoluteUrl(SITE.image),
    description: SITE.bio,
    affiliation: { "@type": "CollegeOrUniversity", name: "大阪公立大学大学院 知能情報学分野" },
    worksFor: { "@type": "Organization", name: "株式会社Affectify" },
    award: [
      "第八期公益財団法人シマノ財団奨学生",
      "フジシール財団奨学生（2023年度・2024年度・2025年度・2026年度）",
    ],
    knowsAbout: [
      "人工知能（AI）",
      "生成AI",
      "AIエージェント開発",
      "Webアプリケーション開発",
      "ラフ集合理論",
      "クラスタリング",
      "協調フィルタリング",
      "推薦システム",
      "機械学習",
      "JavaScript",
      "TypeScript",
      "Python",
      "React",
      "Next.js",
      "Flutter",
    ],
    sameAs: SITE.sameAs,
  };
}

// Keep the author understandable even when a consumer reads an article's
// JSON-LD separately from the site-wide graph. The @id joins the two records.
export function authorJsonLd() {
  return {
    "@type": "Person",
    "@id": PERSON_ID,
    name: SITE.author,
    url: absoluteUrl("/"),
  };
}

export const FEED_ALTERNATES = {
  "application/rss+xml": [{ url: "/feed.xml", title: `${SITE.name} Blog` }],
};

// Child pages replace (not merge) the layout's alternates/openGraph/twitter
// objects, so every page builds the full set here. Canonical is per page only:
// inherited from the layout it would mark every page a duplicate of "/".
export function pageMetadata({ title, description = SITE.description, path, images, openGraph = {}, ...rest }) {
  const ogImages = images ?? [{ url: SITE.image, width: 1176, height: 1176, alt: SITE.author }];
  const shareTitle = title ?? SITE.title;
  return {
    ...(title && { title }),
    description,
    alternates: { canonical: path, types: FEED_ALTERNATES },
    openGraph: {
      type: "website",
      url: path,
      siteName: SITE.name,
      locale: "ja_JP",
      title: shareTitle,
      description,
      images: ogImages,
      ...openGraph,
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      creator: SITE.twitter,
      title: shareTitle,
      description,
      images: ogImages.map((image) => image.url),
    },
    ...rest,
  };
}

// "2025-11-02" -> "2025/11/2"
export function formatDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return `${year}/${month}/${day}`;
}
