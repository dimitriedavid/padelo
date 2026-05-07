import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        court: {
          50: "#eefcf6",
          100: "#d7f7e8",
          500: "#18a66b",
          600: "#0f8b58",
          700: "#0d7049",
        },
        ink: "#17211d",
        line: "#d8e1dc",
      },
      boxShadow: {
        soft: "0 14px 40px rgba(23, 33, 29, 0.08)",
      },
    },
  },
  plugins: [],
} satisfies Config;

