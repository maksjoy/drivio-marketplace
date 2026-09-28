import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        prairie: {
          50: "#ffffff",
          100: "#f8fafc",
          200: "#e5e7eb",
          300: "#d1d5db",
          400: "#9ca3af",
          500: "#6b7280",
          600: "#4b5563",
          700: "#374151",
          800: "#1f2937",
          900: "#111827",
        },
        // Alberta blue sampled from the company plate artwork.
        rig: {
          50: "#eef5fb",
          100: "#dcebf7",
          700: "#245886",
          900: "#173f61",
        },
        // Wild-rose red sampled from the Alberta-Cars wordmark.
        wildrose: {
          50: "#fff1f2",
          100: "#ffe4e6",
          600: "#cb0111",
          700: "#a9000e",
          800: "#85000b",
        },
      },
      fontFamily: {
        display: ["'Inter'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
