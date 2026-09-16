"use client";

import { useEffect, useRef } from "react";

/**
 * A quiet, fixed starfield behind every page — the same atmosphere as the
 * homepage journey, dialed down so it never competes with dense UI (tables,
 * forms, charts). Purely decorative: pointer-events are off, it sits behind
 * content, and it draws nothing when the user asked for reduced motion.
 */
export default function AmbientGalaxy() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function resize() {
      if (!canvas || !ctx) return;
      const w = window.innerWidth, h = window.innerHeight;
      const targetW = w * devicePixelRatio, targetH = h * devicePixelRatio;
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW; canvas.height = targetH;
        ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      }
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(document.documentElement);

    const dust = Array.from({ length: 46 }, () => ({
      x: Math.random(), y: Math.random(), r: Math.random() * 1.3 + 0.4,
      ph: Math.random() * Math.PI * 2, sp: Math.random() * 0.3 + 0.15,
    }));

    let raf = 0;
    const start = performance.now();
    function draw(now: number) {
      if (!ctx || !canvas) return;
      const time = (now - start) / 1000;
      const w = window.innerWidth, h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);
      dust.forEach((d) => {
        const tw = reduced ? 0.22 : 0.14 + Math.sin(time * d.sp + d.ph) * 0.09;
        ctx.beginPath();
        ctx.fillStyle = `rgba(111,111,217,${Math.max(0.04, tw)})`;
        ctx.arc(d.x * w, d.y * h, d.r, 0, Math.PI * 2);
        ctx.fill();
      });
      if (!reduced) raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    if (reduced) draw(start); // one static frame, no loop

    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
      style={{ width: "100vw", height: "100vh" }}
    />
  );
}
