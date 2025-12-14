/** @type {import('next').NextConfig} */
const nextConfig = {
  // 画像最適化設定
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.jsdelivr.net",
        port: "",
        pathname: "/**",
      },
    ],
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

  // ビルド出力の最適化（Next.js 13以降はデフォルトで有効）

  // 環境変数の公開設定
  env: {
    SITE_URL: "https://ryogaio.vercel.app/",
    SITE_NAME: "花房亮雅 | ポートフォリオ",
  },
};

export default nextConfig;
