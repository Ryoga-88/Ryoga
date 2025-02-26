// CardContainer.jsx
import React from "react";
import Card from "./card";
import cardsData from "app/contents/projects/projects";

export default function CardContainer() {
  return (
    <div className="flex flex-col items-center p-4 space-y-6 ">
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
