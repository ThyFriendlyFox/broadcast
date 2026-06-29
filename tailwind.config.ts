import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0a0a0b",
          panel: "#121214",
          card: "#17171a",
          elevated: "#1c1c20",
          hover: "#202024",
        },
        border: {
          DEFAULT: "#26262b",
          subtle: "#1e1e22",
        },
        ink: {
          DEFAULT: "#ededef",
          muted: "#a1a1aa",
          faint: "#6b6b74",
        },
        brand: {
          DEFAULT: "#6366f1",
          fg: "#a5b4fc",
        },
        good: "#22c55e",
        warn: "#f59e0b",
        bad: "#ef4444",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      keyframes: {
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.3" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "pulse-dot": "pulse-dot 1.6s ease-in-out infinite",
        "slide-up": "slide-up 0.25s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
