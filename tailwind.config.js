/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: token("bg"),
        ink: token("ink"),
        muted: token("muted"),
        line: token("line"),
        soft: token("soft"),
        tint: token("tint"),
        "tint-strong": token("tint-strong"),
        paper: token("paper"),
        accent: token("accent"),
      },
      fontFamily: {
        // System fonts like sizu.me: no web font download, native Japanese glyphs.
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          '"Hiragino Kaku Gothic ProN"',
          '"Hiragino Sans"',
          '"Noto Sans JP"',
          "Meiryo",
          "sans-serif",
        ],
      },
      maxWidth: {
        page: "52rem",
        article: "40rem",
      },
      borderRadius: {
        card: "1.2rem",
        squircle: "28%",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
