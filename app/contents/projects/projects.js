// Static imports let next/image serve resized AVIF/WebP with immutable caching.
import nebulaAi from "./images/nebula-ai.webp";
import classNotebook from "./images/class-notebook.webp";
import hisLab from "./images/his-lab.webp";
import portalMind from "./images/portal-mind.webp";
import taskGrid from "./images/taskgrid.webp";
import ryogaIo from "./images/ryoga-io.webp";

const projects = [
  {
    image: nebulaAi,
    title: "NebulaAI",
    description:
      "洗練されたデザインのAIチャットです。gpt-4-turbo,gpt-4,gpt-4o-mini-ttsを使用しており、言語生成と音声合成機能も搭載しています。",
    date: "2025-04-10",
    link: "https://ai-nebula.vercel.app/",
  },
  {
    image: classNotebook,
    title: "ClassNotebook",
    description:
      "一緒に考えれば、もっと解ける。Class Notebook は、学生同士が課題を共有し協力して解決することで、理解を深め新たな発見を促す学習支援ツールです。",
    date: "2025-04-05",
    link: "https://class-notebook.vercel.app/",
  },
  {
    image: hisLab,
    title: "人間情報システム研究室のwebサイト",
    description:
      "私の研究室の人間情報システム研究室に関する情報をまとめたwebサイトです。研究室のメンバーや研究内容、活動内容などを紹介しています。",
    date: "2025-04-01",
    link: "https://his-lab.vercel.app/",
  },
  {
    image: portalMind,
    title: "Portal Mind",
    description:
      "Portal Mindは、あなたの心の状態をアートによって見える化できるアプリです。単なる言葉のラベリングでは捉えきれない、心の奥深い色彩や模様を、AIとアートの融合で解き明かします。",
    date: "2025-03-11",
    link: "https://portal-mind.vercel.app/login",
  },
  {
    image: taskGrid,
    title: "TaskGrid",
    description:
      "タスク管理をもっと直感的に、効率的にするタスク管理アプリです。Firebaseを使ってリアルタイムでデータを同期します。アカウント登録やログイン機能があります。タスクを「緊急度×重要度」で簡単に整理できるところが大きな魅力です。",
    date: "2025-02-24",
    link: "https://taskgrid.vercel.app/",
  },
  {
    image: ryogaIo,
    title: "Ryoga.io",
    description:
      "このブログ記事になります。自分の活動の幅を広げたいという思いと、もっとプログラミングスキルを高めたいという思いから作成したものになります。",
    date: "2024-06-29",
    link: "https://ryoga-hanafusa.vercel.app/",
  },
];

export default projects;
