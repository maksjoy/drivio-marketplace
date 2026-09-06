import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        prairie: {
          50: "#faf7f0",
          100: "#f2ead6",
          200: "#e3d0a3",
          300: "#cfb77d",
          400: "#b79a5c",
          500: "#9e7f40",
          600: "#8a6a2f",
          700: "#6c5226",
          800: "#4a3a1c",
          900: "#2d2414",
        },
        rig: {
          700: "#1f3d3a",
          900: "#0f211f",
        },
      },
      fontFamily: {
        display: ["'Fraunces'", "serif"],
        body: ["'Inter'", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
