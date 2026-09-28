import { SiFlutter, SiJavascript, SiNextdotjs, SiPython, SiReact, SiTypescript } from "react-icons/si";

const SKILL_GROUPS = [
  {
    label: "開発言語",
    items: [
      {
        name: "JavaScript",
        Icon: SiJavascript,
        tags: ["フロントエンド開発", "Web開発"],
        description: "Javascriptエンジニア。普段はReactを使って開発現場で働いています。",
      },
      {
        name: "TypeScript",
        Icon: SiTypescript,
        tags: ["フロントエンド開発", "Web開発"],
        description: "Typescriptエンジニア。最近はよく使うことが多いです。",
      },
      {
        name: "Python",
        Icon: SiPython,
        tags: ["データ分析", "研究開発"],
        description: "大学の研究開発(データ分析)で使用しています。",
      },
    ],
  },
  {
    label: "フレームワーク",
    items: [
      {
        name: "Next.js",
        Icon: SiNextdotjs,
        tags: ["フロントエンド開発", "バックエンド開発"],
        description: "本サイトを制作するのにも使用しています。",
      },
      {
        name: "Flutter",
        Icon: SiFlutter,
        tags: ["クロスプラットフォームアプリ開発"],
        description: "大学公式アプリ開発に携わった際に使用しました。",
      },
    ],
  },
  {
    label: "ライブラリ",
    items: [
      {
        name: "React",
        Icon: SiReact,
        tags: ["フロントエンド開発", "Web開発"],
        description: "今、一番使っている言語です。日々、勉強中です。",
      },
    ],
  },
];

export default function Skills() {
  return (
    <div className="space-y-10">
      {SKILL_GROUPS.map((group) => (
        <div key={group.label}>
          <h3 className="mb-3 text-sm font-bold tracking-wider text-muted">{group.label}</h3>
          <ul className="grid gap-3 sm:grid-cols-2">
            {group.items.map(({ name, Icon, tags, description }) => (
              <li key={name} className="flex gap-4 rounded-card border border-line p-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-squircle bg-soft">
                  <Icon size={24} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="font-bold tracking-wide">{name}</p>
                  <p className="mt-1 text-[0.95rem] leading-[1.8] text-muted">{description}</p>
                  <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`${name}の用途`}>
                    {tags.map((tag) => (
                      <li key={tag} className="rounded-full bg-soft px-2.5 py-0.5 text-xs text-muted">
                        {tag}
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
