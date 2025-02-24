import React from "react";

export default function Card({ imageSrc, title, description, author, date }) {
  return (
    <div className="bg-white rounded-lg shadow-md flex w-full max-w-3xl h-48">
      {/* 左側の画像 */}
      <div className="flex-none w-1/3">
        <img
          className="object-cover h-full w-full rounded-l-lg"
          src={imageSrc}
          alt={title}
        />
      </div>

      {/* 右側のコンテンツ */}
      <div className="p-4 flex flex-col justify-between w-2/3">
        {/* タイトル */}
        <h2 className="text-xl font-bold text-gray-900 mb-2">{title}</h2>

        {/* 説明文 */}
        <p className="text-gray-700 mb-4">{description}</p>

        {/* 作成者情報 */}
        <div className="text-sm">
          <p className="text-gray-900">{author}</p>
          <p className="text-gray-600">{date}</p>
        </div>
      </div>
    </div>
  );
}
