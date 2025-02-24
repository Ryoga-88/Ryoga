// CardContainer.jsx
import React from "react";
import Card from "./card";

export default function CardContainer() {
  const cardsData = [
    {
      imageSrc: "/images/TaskGrid.png",
      title: "TaskGrid",
      description:
        "タスク管理をもっと直感的に、効率的にするタスク管理アプリです。Firebaseを使ってリアルタイムでデータを同期します。アカウント登録やログイン機能があります。タスクを「緊急度×重要度」で簡単に整理できるところが大きな魅力です。",
      date: "2025-02-24",
    },
    {
      imageSrc: "/images/human.jpg",
      title: "タイトル2",
      description: "説明文2",
      date: "2024-04-02",
    },
  ];

  return (
    <div className="flex flex-col items-center p-4 space-y-6">
      {cardsData.map((card, index) => (
        <Card
          key={index}
          imageSrc={card.imageSrc}
          title={card.title}
          description={card.description}
          date={card.date}
        />
      ))}
    </div>
  );
}
