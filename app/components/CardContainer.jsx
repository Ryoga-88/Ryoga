// CardContainer.jsx
import React from "react";
import Card from "./card";
import cardsData from "app/contents/projects/projects";

export default function CardContainer() {
  return (
    <div
      className="flex flex-col items-center p-4 space-y-6"
      style={{ position: "relative", zIndex: 10 }}
    >
      {cardsData.map((card, index) => (
        <Card
          key={index}
          imageSrc={card.imageSrc}
          title={card.title}
          description={card.description}
          date={card.date}
          link={card.link} // リンク情報を渡す
        />
      ))}
    </div>
  );
}
