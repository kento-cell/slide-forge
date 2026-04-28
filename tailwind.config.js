/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#EAF1FA",
          100: "#D4E2F4",
          500: "#3D6098",
          700: "#1B3A6B",
          900: "#0B1F3F",
        },
        accent: {
          amber: "#ED6C02",
          green: "#2E7D32",
          red: "#C62828",
        },
      },
      fontFamily: {
        sans: ['"Yu Gothic"', '"Noto Sans JP"', "system-ui", "sans-serif"],
        head: ['"Yu Mincho"', '"Noto Serif JP"', "serif"],
        mono: ['Consolas', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
