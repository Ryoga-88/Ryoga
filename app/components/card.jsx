"use client";
import React, { useState } from "react";
import Link from "next/link"; // Next.jsのLinkコンポーネントをインポート

export default function Card({ imageSrc, title, description, date, link }) {
  const [isExpanded, setIsExpanded] = useState(false);
  // 説明文の短縮版と完全版
  const shortDescription =
    description.length > 50 ? `${description.slice(0, 50)}...` : description;
  // モバイルでの表示を制御
  const toggleExpand = (e) => {
    // リンククリックとの競合を防ぐために、イベントの伝播を停止
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  // カードをラップするコンポーネント
  const CardWrapper = ({ children }) => {
    // リンクがある場合はLinkで囲み、なければdivで囲む
    return link ? (
      <Link href={link}>
        <div className="bg-white rounded-lg shadow-md flex flex-col md:flex-row w-full max-w-3xl md:h-48 dark:bg-black border dark:border-white cursor-pointer transition-transform">
          {children}
        </div>
      </Link>
    ) : (
      <div className="bg-white rounded-lg shadow-md flex flex-col md:flex-row w-full max-w-3xl md:h-48 dark:bg-black border dark:border-white">
        {children}
      </div>
    );
  };

  return (
    <CardWrapper>
      {/* 画像 - モバイルでは上部、PCでは左側 */}
      <div className="w-full md:w-1/3 h-48 md:h-full">
        <img
          className="object-cover h-full w-full rounded-t-lg md:rounded-t-none md:rounded-l-lg"
          src={imageSrc}
          alt={title}
        />
      </div>
      {/* コンテンツ - モバイルでは下部、PCでは右側 */}
      <div className="p-4 flex flex-col justify-between w-full md:w-2/3">
        {/* タイトル */}
        <h2 className="text-xl font-bold text-gray-900 mb-1 dark:text-white">
          {title}
        </h2>
        {/* 説明文 - PCでは全文表示、モバイルでは条件付き */}
        <div className="overflow-y-auto flex-grow mb-2 pr-1">
          {/* PCでの表示 (md以上) */}
          <p className="hidden md:block text-gray-700 dark:text-white">
            {description}
          </p>
          {/* モバイルでの表示 (md未満) */}
          <div className="block md:hidden">
            <p className="text-gray-700 dark:text-white">
              {isExpanded ? description : shortDescription}
            </p>
            {/* 「もっと見る」ボタン - 説明文が長い場合のみ表示 */}
            {description.length > 50 && (
              <button
                className="text-blue-500 text-sm mt-1 font-medium"
                onClick={toggleExpand}
              >
                {isExpanded ? "折りたたむ" : "もっと見る"}
              </button>
            )}
          </div>
        </div>
        {/* 日付情報 */}
        <div className="text-sm mt-auto">
          <p className="text-gray-600 dark:text-white">{date}</p>
        </div>
      </div>
    </CardWrapper>
  );
}
