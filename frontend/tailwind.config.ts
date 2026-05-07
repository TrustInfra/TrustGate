import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/providers/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#050c0a",
          raised: "#0a1410",
          surface: "#0f1d18",
          hover: "#132318",
        },
        border: {
          DEFAULT: "#1a3028",
          hover: "#234d3a",
        },
        accent: {
          DEFAULT: "#10d9a0",
          hover: "#06b88a",
          muted: "rgba(16, 217, 160, 0.1)",
        },
        text: {
          DEFAULT: "#e8f5f0",
          secondary: "#7a9e90",
          muted: "#4d7568",
        },
        tier: {
          high: "#22c55e",
          "high-muted": "rgba(34, 197, 94, 0.12)",
          medium: "#eab308",
          "medium-muted": "rgba(234, 179, 8, 0.12)",
          low: "#ef4444",
          "low-muted": "rgba(239, 68, 68, 0.12)",
        },
      },
      fontFamily: {
        display: ["var(--font-syne)", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      animation: {
        "fade-in": "fade-in 0.5s ease-out forwards",
        "slide-up": "slide-up 0.5s ease-out forwards",
        "slide-down": "slide-down 0.3s ease-out forwards",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-down": {
          from: { opacity: "0", transform: "translateY(-8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
