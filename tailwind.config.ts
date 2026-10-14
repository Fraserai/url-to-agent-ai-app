import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        cream: "#f5f4f0",
        ink: "#1a1a1a",
        brand: "#1a6b4a",
        muted: "rgba(26, 26, 26, 0.4)",
        card: "#ffffff",
        line: "rgba(0, 0, 0, 0.06)",
        success: "#22c55e",
        warning: "#f59e0b",
        danger: "#dc2626",
        chat: "#f7f6f3"
      },
      boxShadow: {
        card: "0 2px 12px rgba(0,0,0,0.04)",
        bubble: "0 1px 2px rgba(0,0,0,0.06)",
        glow: "0 4px 16px rgba(26,107,74,0.25)"
      },
      borderRadius: {
        xl2: "1rem",
        xl3: "1.25rem"
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        spinSoft: {
          "100%": { transform: "rotate(360deg)" }
        },
        popIn: {
          "0%": { opacity: "0", transform: "scale(0.5)" },
          "100%": { opacity: "1", transform: "scale(1)" }
        },
        bounceDot: {
          "0%,60%,100%": { transform: "translateY(0)" },
          "30%": { transform: "translateY(-5px)" }
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        "fade-up": "fadeUp 0.4s ease both",
        "spin-soft": "spinSoft 0.9s linear infinite",
        "pop-in": "popIn 0.4s ease both",
        "bounce-dot": "bounceDot 1.2s ease-in-out infinite",
        "slide-up": "slideUp 0.4s ease both"
      }
    }
  },
  plugins: []
};

export default config;
