# TrustGate Redesign — 2026-05-07 Clean Run

## Do all steps in order. No git commit or push. TypeScript strict. No emojis in code.

---

## STEP 1 — Font swap in frontend/src/app/layout.tsx

Read the file first. Then:

1. Replace the Syne and Plus_Jakarta_Sans imports with:
   import { Barlow_Condensed, DM_Sans } from "next/font/google";

2. Replace the syne font config with:
   const barlowCondensed = Barlow_Condensed({
     subsets: ["latin"],
     weight: ["400", "500", "600", "700", "800"],
     variable: "--font-syne",
     display: "swap",
   });

3. Replace the jakarta font config with:
   const dmSans = DM_Sans({
     subsets: ["latin"],
     weight: ["400", "500", "600", "700"],
     variable: "--font-body",
     display: "swap",
   });

4. In the html className — replace syne.variable with
   barlowCondensed.variable and jakarta.variable with dmSans.variable

5. In the body className — replace jakarta.className with
   dmSans.className

6. Wrap the existing inner div with a relative wrapper and add
   BackgroundPaths. Import it first:
   import { BackgroundPaths } from "@/components/ui/BackgroundPaths";

   Find:
   <div className="flex flex-col min-h-screen">

   Replace with:
   <div className="flex flex-col min-h-screen relative">
     <BackgroundPaths />

   The closing </div> stays as-is. Just add the BackgroundPaths
   component as the first child inside the div.

7. On the main element add relative z-10:
   Change: <main className="flex-1">
   To:     <main className="flex-1 relative z-10">

---

## STEP 2 — Green palette + visual tokens in frontend/src/app/globals.css

Read the file first. Then make these targeted changes:

1. body background-color: change #0a0a0a to #050c0a
2. body color: change #f5f5f5 to #e8f5f0

3. .card background: change #141414 to #0a1410
4. .card border: change #262626 to rgba(16,217,160,0.1)
5. .card hover border-color: change #333333 to rgba(16,217,160,0.28)

6. .card-static background: change #141414 to #0a1410
7. .card-static border: change #262626 to rgba(16,217,160,0.1)

8. scrollbar track: change #0a0a0a to #050c0a
9. scrollbar thumb: change #333333 to #0f1d18
10. scrollbar thumb hover: change #525252 to #1a3028

11. .nav-bar background: change rgba(10,10,10,0.85) to rgba(5,12,10,0.92)
12. .nav-bar border-bottom: change #1a1a1a to rgba(16,217,160,0.08)

13. Add these new classes at the bottom of the file:

/* Background paths — fixed layer behind everything */
.bp-canvas {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
}

/* All chrome sits above the path layer */
nav, header, main, footer, section, aside {
  position: relative;
  z-index: 1;
}

/* Ticker fade masks */
.tg-ticker-wrapper {
  position: relative;
  overflow: hidden;
}
.tg-ticker-wrapper::before,
.tg-ticker-wrapper::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 100px;
  z-index: 2;
  pointer-events: none;
}
.tg-ticker-wrapper::before {
  left: 0;
  background: linear-gradient(to right, #050c0a, transparent);
}
.tg-ticker-wrapper::after {
  right: 0;
  background: linear-gradient(to left, #050c0a, transparent);
}

/* Card left-accent variant */
.card-feature {
  background: #0a1410;
  border: 1px solid rgba(16,217,160,0.1);
  border-left: 2px solid rgba(16,217,160,0.4);
  border-radius: 12px;
  transition: border-color 0.2s ease, background 0.2s ease;
}
.card-feature:hover {
  border-color: rgba(16,217,160,0.2);
  border-left-color: rgba(16,217,160,0.8);
  background: #0d1e18;
}

/* Stat card top accent */
.card-stat {
  background: #0a1410;
  border: 1px solid rgba(16,217,160,0.1);
  border-top: 2px solid rgba(16,217,160,0.35);
  border-radius: 12px;
  position: relative;
  overflow: hidden;
}
.card-stat::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 40px;
  background: linear-gradient(to bottom, rgba(16,217,160,0.05), transparent);
  pointer-events: none;
}

---

## STEP 3 — Update frontend/tailwind.config.ts colors block only

Read the file first. Replace only the colors block inside theme.extend.
Keep fontFamily, animation, keyframes identical.

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

---

## STEP 4 — Create frontend/src/components/ui/BackgroundPaths.tsx

Create this file with exactly these contents:

"use client";

import { useEffect, useRef, useState } from "react";

interface PathData {
  d: string;
  duration: number;
  delay: number;
  opacity: number;
  strokeWidth: number;
}

function buildPaths(w: number, h: number): PathData[] {
  const result: PathData[] = [];
  const count = 32;

  for (let i = 0; i < count; i++) {
    const x0 = Math.random() * w;
    const y0 = Math.random() * h;
    const cx1 = x0 + (Math.random() - 0.5) * w * 0.7;
    const cy1 = y0 + (Math.random() - 0.5) * h * 0.6;
    const cx2 = cx1 + (Math.random() - 0.5) * w * 0.5;
    const cy2 = cy1 + (Math.random() - 0.5) * h * 0.5;
    const x1 = cx2 + (Math.random() - 0.5) * w * 0.4;
    const y1 = cy2 + (Math.random() - 0.5) * h * 0.4;

    result.push({
      d: `M ${x0} ${y0} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x1} ${y1}`,
      duration: 3 + Math.random() * 5,
      delay: Math.random() * 6,
      opacity: 0.07 + Math.random() * 0.16,
      strokeWidth: 0.6 + Math.random() * 1.8,
    });
  }

  return result;
}

export function BackgroundPaths() {
  const [mounted, setMounted] = useState<boolean>(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const rafRef = useRef<number>(0);
  const t0Ref = useRef<number>(0);
  const pathsRef = useRef<PathData[]>([]);
  const elsRef = useRef<SVGPathElement[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const svg = svgRef.current;
    if (!svg) return;

    const w = window.innerWidth;
    const h = window.innerHeight;

    pathsRef.current = buildPaths(w, h);

    const NS = "http://www.w3.org/2000/svg";

    while (svg.firstChild) svg.removeChild(svg.firstChild);

    elsRef.current = pathsRef.current.map((p) => {
      const el = document.createElementNS(NS, "path");
      el.setAttribute("d", p.d);
      el.setAttribute("fill", "none");
      el.setAttribute("stroke", "#10d9a0");
      el.setAttribute("stroke-width", String(p.strokeWidth));
      el.setAttribute("opacity", "0");
      svg.appendChild(el);
      return el;
    });

    t0Ref.current = performance.now();

    const tick = (now: number): void => {
      const elapsed = (now - t0Ref.current) / 1000;

      elsRef.current.forEach((el, i) => {
        const p = pathsRef.current[i];
        const cycle = ((elapsed / p.duration) + (p.delay / p.duration)) % 1;
        const alpha = cycle < 0.5 ? cycle * 2 : 2 - cycle * 2;
        el.setAttribute("opacity", String(alpha * p.opacity));
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    const onResize = (): void => {
      pathsRef.current = buildPaths(window.innerWidth, window.innerHeight);
      elsRef.current.forEach((el, i) => {
        el.setAttribute("d", pathsRef.current[i].d);
      });
    };

    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onResize);
    };
  }, [mounted]);

  if (!mounted) return null;

  return (
    <svg
      ref={svgRef}
      className="bp-canvas"
      viewBox={`0 0 ${typeof window !== "undefined" ? window.innerWidth : 1440} ${typeof window !== "undefined" ? window.innerHeight : 900}`}
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    />
  );
}

---

## STEP 5 — Verify

Run: cd frontend && npx --no-install tsc --noEmit
Must show 0 errors before finishing.
