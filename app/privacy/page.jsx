export default function Privacy() {
  return (
    <div
      className="container mx-auto max-w-3xl my-36 text-lg px-10"
      style={{ position: "relative", zIndex: 10 }}
    >
      <div className="w-full md:justify-start">
        このウェブサイトでは、Googleによるアクセス解析ツール「Googleアナリティクス」を使用しており、Googleアナリティクスはデータ収集のためにCookieを使用しています。データは匿名で収集されており、個人を特定するものではありません。この機能はお使いのブラウザの設定でCookieを無効にすることで拒否することができます。これらの規約に関しての詳細は
        <a
          href="https://policies.google.com/?hl=ja"
          className="text-neutral-400 underline"
        >
          Googleポリシーと規約ページ
        </a>
        をご覧ください。
      </div>
    </div>
  );
}
