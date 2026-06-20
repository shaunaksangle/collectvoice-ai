import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef5ff",
          100: "#d9e8ff",
          500: "#2563eb",
          600: "#1d4ed8",
          700: "#1e40af",
          900: "#172554",
        },
      },
      boxShadow: {
        soft: "0 16px 40px -28px rgba(15, 23, 42, 0.35)",
      },
    },
  },
  plugins: [],
} satisfies Config;
