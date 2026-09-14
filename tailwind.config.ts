import type { Config } from "tailwindcss";

/**
 * Inncircles palette: white ground, deep green-teal chrome, mint accents.
 * Token names are layout-neutral (bg / surface / line / txt / accent) so the
 * whole app can be re-skinned from this file alone.
 */
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#FFFFFF",
        surface: "#FBFCFC",
        raised: "#F4F6F5",
        line: "#E3E7E6",
        "line-soft": "#EFF2F1",
        txt: {
          DEFAULT: "#141A18",
          dim: "#4D5454",
          faint: "#8A9190",
        },
        accent: {
          DEFAULT: "#128766",
          hover: "#0D6B52",
          soft: "#E7F4EF",
          ink: "#0D6B52",
        },
        shell: "#0E2B23",
        // The suite chrome above the app — its own surface, not the app palette.
        nav: {
          DEFAULT: "#122925",
          text: "#E9ECF1",
          muted: "rgba(255,255,255,0.64)",
          line: "#D2D8E3",
        },
        danger: "#C8372D",
        warn: "#A66A11",
        good: "#128766",
      },
      maxWidth: { col: "720px" },
      boxShadow: {
        lift: "0 1px 2px rgba(16,24,20,0.04), 0 4px 16px rgba(16,24,20,0.06)",
        input: "0 1px 2px rgba(16,24,20,0.04), 0 6px 20px rgba(16,24,20,0.06)",
      },
    },
  },
  plugins: [],
};
export default config;
