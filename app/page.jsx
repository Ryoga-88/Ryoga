"use client";
import { useEffect, useRef, useState } from "react";
import { CiCircleCheck } from "react-icons/ci";
import { SiNextdotjs } from "react-icons/si";
import { RiTailwindCssFill } from "react-icons/ri";
import { FaReact } from "react-icons/fa";
import cardsData from "app/contents/projects/projects";

export default function Home() {
  return (
    <>
      <div
        className="container mx-auto max-w-3xl"
        style={{ position: "relative", zIndex: 10 }}
      >
        <div className="w-full md:justify-start">
          <div className="flex flex-wrap md:flex-nowrap justify-center py-8 items-center mx-4 ">
            <div>
              <img
                src={`/images/eyecatch.jpg`}
                alt="human"
                className="max-w-36 h-auto rounded-full aspect-square object-cover mr-7"
              />
            </div>
            <div>
              <h1 className="text-base text-left dark:text-white mt-6 md:mt-0">
                大阪公立大学大学院
                知能情報学分野専攻．第八期公益財団法人シマノ財団奨学生，2023年度・2024年度フジシール財団奨学生．現在はラフ集合理論に基づくクラスタリングベースの協調フィルタリングに関する研究に取り組んでいる．大学ではC言語，JavaScript，JavaやPythonなどを学んだ．最近では，大学発ITベンチャー株式会社Affectifyの社員として積極的に新しい技術に触れ，知識やスキルを身につけられるよう日々励んでいる．新しい技術や製品に触れたり学ぶことを愛しています．
              </h1>

              {/* Fish toggle button */}
            </div>
          </div>
        </div>

        {/* Portfolio */}
        <section className="w-full mt-12">
          <div className="mx-4">
            <h2 className="font-bold text-lg dark:text-white">
              私のポートフォリオ
            </h2>
            <p className="mb-5 dark:text-white">
              私が作ってきたポートフォリオはこちら
            </p>
            {cardsData.map((card, index) => {
              return (
                <div
                  key={index}
                  className="bg-white rounded-lg shadow-md flex flex-col md:flex-row w-full max-w-3xl md:h-48 dark:bg-black border dark:border-white mb-4"
                >
                  {/* Image - top for mobile, left for PC */}
                  <div className="w-full md:w-1/3 h-48 md:h-full">
                    <img
                      className="object-cover h-full w-full rounded-t-lg md:rounded-t-none md:rounded-l-lg"
                      src={card.imageSrc}
                      alt={card.title}
                    />
                  </div>

                  {/* Content - bottom for mobile, right for PC */}
                  <div className="p-4 flex flex-col justify-between w-full md:w-2/3">
                    {/* Title */}
                    <h2 className="text-xl font-bold text-gray-900 mb-1 dark:text-white">
                      {card.title}
                    </h2>

                    {/* Description - full for PC, conditional for mobile */}
                    <div className="overflow-y-auto flex-grow mb-2 pr-1">
                      {/* PC display (md and up) */}
                      <p className="hidden md:block text-gray-700 dark:text-white">
                        {card.description}
                      </p>

                      {/* Mobile display (below md) */}
                      <div className="block md:hidden">
                        <p className="text-gray-700 dark:text-white">
                          {card.description.length > 50
                            ? `${card.description.slice(0, 50)}...`
                            : card.description}
                        </p>
                      </div>
                    </div>

                    {/* Date info */}
                    <div className="text-sm mt-auto">
                      <p className="text-gray-600 dark:text-white">
                        {card.date}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Skills stack */}
        <section className="w-full mt-24">
          <div className="mx-4">
            <h2 className="font-bold text-lg dark:text-white">
              スキルスタック
            </h2>
            <p className="mb-5 dark:text-white">
              私が主に取り扱っている技術スタックです。
            </p>
            <div className="inline-flex items-center rounded-md bg-black dark:bg-white text-white dark:text-black px-4 py-2 text-xs font-bold ring-1 ring-inset ring-gray-500/10">
              <CiCircleCheck className="mr-2" />
              開発言語
            </div>
            <div className="py-2">
              {/* Javascript */}
              <div className="w-full border border-slate-300 px-8 py-4 flex md:justify-start justify-center items-center flex-wrap space-x-8 hover:border-slate-400 transition-all duration-300 cursor-pointer">
                {/* Language logo */}
                <img
                  src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/javascript/javascript-original.svg"
                  className="max-w-16"
                />
                {/* Skill description */}
                <div className="my-2">
                  <h3 className="font-bold dark:text-white">JavaScript</h3>
                  <div className="flex flex-wrap w-full justify-start space-x-1 ">
                    <div className="inline-flex items-center rounded-md bg-gray-50 dark:bg-slate-600 px-2 py-1 text-xs font-medium text-gray-600 dark:text-white ring-1 ring-inset ring-gray-500/10">
                      フロントエンド開発
                    </div>
                    <div className="inline-flex items-center rounded-md bg-gray-50 dark:bg-slate-600 px-2 py-1 text-xs font-medium text-gray-600 dark:text-white ring-1 ring-inset ring-gray-500/10">
                      Web開発
                    </div>
                  </div>
                  <p className="dark:text-white">
                    Javascriptエンジニア。普段はReactを使って開発現場で働いています。
                  </p>
                </div>
              </div>
            </div>

            <div className="py-2">
              {/* Python */}
              <div className="w-full border border-slate-300 px-8 py-4 flex md:justify-start justify-center items-center flex-wrap space-x-8 hover:border-slate-400 transition-all duration-300 cursor-pointer">
                {/* Language logo */}
                <img
                  src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/python/python-original.svg"
                  className="max-w-20"
                />
                {/* Skill description */}
                <div className="my-2">
                  <h3 className="font-bold dark:text-white">Python</h3>
                  <div className="felx flex-wrap w-full justify-center space-x-1 ">
                    <div className="inline-flex items-center rounded-md bg-gray-50 dark:bg-slate-600 px-2 py-1 text-xs font-medium text-gray-600 dark:text-white ring-1 ring-inset ring-gray-500/10">
                      データ分析
                    </div>
                    <div className="inline-flex items-center rounded-md bg-gray-50 dark:bg-slate-600 px-2 py-1 text-xs font-medium text-gray-600 dark:text-white ring-1 ring-inset ring-gray-500/10">
                      研究開発
                    </div>
                  </div>
                  <p className="dark:text-white">
                    大学の研究開発(データ分析)で使用しています。
                  </p>
                </div>
              </div>
            </div>
            <div className="inline-flex items-center rounded-md bg-theme dark:bg-white text-white dark:text-black px-4 py-2 text-xs font-bold ring-1 ring-inset ring-gray-500/10">
              <CiCircleCheck className="mr-2" />
              フレームワーク
            </div>
            <div className="py-2">
              {/* Next.js */}
              <div className="w-full border border-slate-300 px-8 py-4 flex md:justify-start justify-center items-center flex-wrap space-x-8 hover:border-slate-400 transition-all duration-300 cursor-pointer">
                {/* Language logo */}
                <div className="text-7xl bg-white">
                  <SiNextdotjs />
                </div>
                {/* Skill description */}
                <div className="my-2">
                  <h3 className="font-bold dark:text-white">Next.js</h3>
                  <div className="felx flex-wrap w-full justify-center space-x-1 ">
                    <div className="inline-flex items-center rounded-md bg-gray-50 dark:bg-slate-600 px-2 py-1 text-xs font-medium text-gray-600 dark:text-white ring-1 ring-inset ring-gray-500/10">
                      フロントエンド開発
                    </div>
                    <div className="inline-flex items-center rounded-md bg-gray-50 dark:bg-slate-600 px-2 py-1 text-xs font-medium text-gray-600 dark:text-white ring-1 ring-inset ring-gray-500/10">
                      バックエンド開発
                    </div>
                  </div>
                  <p className="dark:text-white">
                    本サイトを制作するのにも使用しています。
                  </p>
                </div>
              </div>
            </div>
            <div className="py-2">
              {/* Flutter */}
              <div className="w-full border border-slate-300 px-8 py-4 flex md:justify-start justify-center items-center flex-wrap space-x-8 hover:border-slate-400 transition-all duration-300 cursor-pointer">
                {/* 言語のロゴ */}
                <img
                  src="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/flutter/flutter-original.svg"
                  className="max-w-16"
                />
                {/* スキルの説明 */}
                <div className="my-2">
                  <h3 className="font-bold dark:text-white">Flutter</h3>
                  <div className="felx flex-wrap w-full justify-center space-x-1 ">
                    <div className="inline-flex items-center rounded-md bg-gray-50 dark:bg-slate-600 px-2 py-1 text-xs font-medium text-gray-600 dark:text-white ring-1 ring-inset ring-gray-500/10">
                      クロスプラットフォームアプリ開発
                    </div>
                  </div>
                  <p className="dark:text-white">
                    大学公式アプリ開発に携わった際に使用しました。
                  </p>
                </div>
              </div>
            </div>
            <div className="inline-flex items-center rounded-md  bg-theme dark:bg-white text-white dark:text-black px-4 py-2 text-xs font-bold ring-1 ring-inset ring-gray-500/10">
              <CiCircleCheck className="mr-2" />
              ライブラリ
            </div>
            <div className="py-2">
              {/* React */}
              <div className="w-full border border-slate-300 px-8 py-4 flex md:justify-start justify-center items-center flex-wrap space-x-8 hover:border-slate-400 transition-all duration-300 cursor-pointer">
                {/* 言語のロゴ */}
                <div className="text-7xl  text-sky-300">
                  <FaReact />
                </div>
                {/* スキルの説明 */}
                <div className="my-2">
                  <h3 className="font-bold dark:text-white">React</h3>
                  <div className="felx flex-wrap w-full justify-center space-x-1 ">
                    <div className="inline-flex items-center rounded-md bg-gray-50 dark:bg-slate-600 px-2 py-1 text-xs font-medium text-gray-600 dark:text-white ring-1 ring-inset ring-gray-500/10">
                      フロントエンド開発
                    </div>
                    <div className="inline-flex items-center rounded-md bg-gray-50 dark:bg-slate-600 px-2 py-1 text-xs font-medium text-gray-600 dark:text-white ring-1 ring-inset ring-gray-500/10">
                      Web開発
                    </div>
                  </div>
                  <p className="dark:text-white">
                    今、一番使っている言語です。日々、勉強中です。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
