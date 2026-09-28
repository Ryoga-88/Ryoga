import PageTitle from "app/components/page-title";
import { pageMetadata } from "app/lib/site";

export const metadata = pageMetadata({
  title: "プライバシーポリシー",
  description: "Ryoga.io のプライバシーポリシーです。",
  path: "/privacy",
});

export default function Privacy() {
  return (
    <div className="mx-auto max-w-article px-4 pt-10 sm:pt-14">
      <PageTitle title="プライバシーポリシー" />
      <div className="article-body">
        <p>
          このウェブサイトでは、Googleによるアクセス解析ツール「Googleアナリティクス」を使用しており、Googleアナリティクスはデータ収集のためにCookieを使用しています。データは匿名で収集されており、個人を特定するものではありません。この機能はお使いのブラウザの設定でCookieを無効にすることで拒否することができます。これらの規約に関しての詳細は
          <a href="https://policies.google.com/?hl=ja">Googleポリシーと規約ページ</a>
          をご覧ください。
        </p>
      </div>
    </div>
  );
}
