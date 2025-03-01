/** @type {import('next').NextConfig} */
const nextConfig = {
  // 多言語対応設定（将来的な拡張用）
  i18n: {
    locales: ["ja", "en"],
    defaultLocale: "ja",
  },

  // 画像最適化設定
  images: {
    domains: ["cdn.jsdelivr.net"], // 外部画像ドメインの許可（devicon用）
    formats: ["image/webp"], // WebP形式の自動変換を有効化
    minimumCacheTTL: 60, // キャッシュ期間（秒）
  },

  // ヘッダー設定（キャッシュなど）
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, s-maxage=86400",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
        ],
      },
    ];
  },

  // 圧縮設定
  compress: true,

  // ビルド出力の最適化
  swcMinify: true,

  // 環境変数の公開設定
  env: {
    SITE_URL: "https://ryogaio.vercel.app/",
    SITE_NAME: "花房亮雅 | ポートフォリオ",
  },
};

export default nextConfig;
