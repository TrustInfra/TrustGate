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
          DEFAULT: "#0a0a0a",
          raised: "#141414",
          surface: "#1a1a1a",
          hover: "#1f1f1f",
        },
        border: {
          DEFAULT: "#262626",
          hover: "#333333",
        },
        accent: {
          DEFAULT: "#3b82f6",
          hover: "#2563eb",
          muted: "rgba(59, 130, 246, 0.12)",
        },
        text: {
          DEFAULT: "#f5f5f5",
          secondary: "#a1a1aa",
          muted: "#71717a",
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
