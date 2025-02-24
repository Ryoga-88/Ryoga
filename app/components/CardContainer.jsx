// CardContainer.jsx
import React from "react";
import Card from "./card";

export default function CardContainer() {
  const cardsData = [
    {
      imageSrc: "/images/TaskGrid.png",
      title: "TaskGrid",
      description: "説明文1",
      author: "著者1",
      date: "2024-04-01",
    },
    {
      imageSrc: "/images/human.jpg",
      title: "タイトル2",
      description: "説明文2",
      author: "著者2",
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
          author={card.author}
          date={card.date}
        />
      ))}
    </div>
  );
}
