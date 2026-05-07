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
        const cycle = ((elapsed + p.delay) / p.duration) % 1;
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
      style={{ width: "100%", height: "100%" }}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    />
  );
}
