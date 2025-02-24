/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        /* background: "var(--background)",
        foreground: "var(--foreground)", */
        // header: "#F4F7F7",
        header: "#F5F5F7",
        theme: "#1E2529",
      },
      textColor: {
        DEFAULT: "#1E2529",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
  darkMode: "class",
};
