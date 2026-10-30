import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Alberta blue. Primary actions and links.
        primary: {
          DEFAULT: "#245886",
          strong: "#173f61",
          soft: "#eef5fb",
          muted: "#dcebf7",
        },
        // Wild-rose red. Use only for the Sell call to action.
        accent: {
          DEFAULT: "#cb0111",
          strong: "#a9000e",
          soft: "#fff1f2",
        },
        success: {
          DEFAULT: "#15803d",
          strong: "#166534",
          soft: "#ecfdf3",
        },
        danger: {
          DEFAULT: "#b42318",
          strong: "#912018",
          soft: "#fef3f2",
        },
        surface: {
          DEFAULT: "#ffffff",
          sunken: "#f5f8fb",
        },
        ink: {
          DEFAULT: "#0f1b2a",
          soft: "#334155",
        },
        muted: {
          DEFAULT: "#526072",
        },
        line: {
          DEFAULT: "#e3e9f0",
          strong: "#cdd6e0",
        },
        // Wordmark and non-CTA brand red retained from the identity lockup.
        // Card prices and the header stripe still use this until later redesign PRs.
        wildrose: {
          50: "#fff1f2",
          100: "#ffe4e6",
          600: "#cb0111",
          700: "#a9000e",
          800: "#85000b",
        },
      },
      borderRadius: {
        control: "0.75rem",
        card: "1.25rem",
        sheet: "1.5rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 27, 42, 0.04), 0 6px 20px rgba(15, 27, 42, 0.06)",
        lift: "0 10px 30px rgba(15, 27, 42, 0.12)",
        sheet: "0 -12px 40px rgba(15, 27, 42, 0.18)",
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
