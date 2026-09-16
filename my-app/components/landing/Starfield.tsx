"use client";

import { useEffect, useRef } from "react";

type Star = { x: number; y: number; r: number; depth: number; phase: number; speed: number; hue: number };
type Meteor = { x: number; y: number; vx: number; vy: number; life: number };

const HUES = ["255,255,255", "214,226,255", "255,220,240", "190,215,255"];

// One pre-rendered glow per hue, stamped with drawImage instead of building a gradient per star per frame.
function makeGlow(rgb: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, `rgba(${rgb},0.5)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  return c;
}

export default function Starfield() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio, 2);
    const glows = HUES.map(makeGlow);
    let w = 0;
    let h = 0;
    let stars: Star[] = [];

    function build() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(420, Math.round((w * h) / 5200));
      stars = Array.from({ length: count }, () => {
        const depth = Math.random();
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          r: depth > 0.93 ? 1.1 + Math.random() * 0.9 : 0.35 + depth * 0.7,
          depth,
          phase: Math.random() * Math.PI * 2,
          speed: 0.6 + Math.random() * 1.8,
          hue: Math.floor(Math.random() * HUES.length),
        };
      });
    }

    const meteors: Meteor[] = [];
    let nextMeteor = 2500;
    let last = performance.now();

    function draw(now: number) {
      const dt = Math.min(now - last, 50);
      last = now;
      const t = now / 1000;
      const sy = window.scrollY;
      ctx!.clearRect(0, 0, w, h);

      for (const s of stars) {
        const y = (((s.y - sy * (0.04 + s.depth * 0.12)) % h) + h) % h;
        const tw = reduced ? 0.8 : 0.55 + 0.45 * Math.sin(t * s.speed + s.phase);
        const a = (0.25 + s.depth * 0.75) * tw;
        ctx!.globalAlpha = a;
        if (s.r > 1.1) {
          const size = s.r * 12;
          ctx!.drawImage(glows[s.hue], s.x - size / 2, y - size / 2, size, size);
        }
        ctx!.fillStyle = `rgb(${HUES[s.hue]})`;
        ctx!.fillRect(s.x - s.r, y - s.r, s.r * 2, s.r * 2);
      }
      ctx!.globalAlpha = 1;

      if (!reduced) {
        nextMeteor -= dt;
        if (nextMeteor <= 0) {
          meteors.push({ x: Math.random() * w * 0.8 + w * 0.2, y: Math.random() * h * 0.4, vx: -0.9, vy: 0.45, life: 1 });
          nextMeteor = 5000 + Math.random() * 7000;
        }
        for (let i = meteors.length - 1; i >= 0; i--) {
          const m = meteors[i];
          m.x += m.vx * dt;
          m.y += m.vy * dt;
          m.life -= dt / 1100;
          if (m.life <= 0) {
            meteors.splice(i, 1);
            continue;
          }
          const tail = ctx!.createLinearGradient(m.x, m.y, m.x - m.vx * 140, m.y - m.vy * 140);
          tail.addColorStop(0, `rgba(255,235,250,${m.life})`);
          tail.addColorStop(1, "rgba(255,235,250,0)");
          ctx!.strokeStyle = tail;
          ctx!.lineWidth = 1.4;
          ctx!.beginPath();
          ctx!.moveTo(m.x, m.y);
          ctx!.lineTo(m.x - m.vx * 140, m.y - m.vy * 140);
          ctx!.stroke();
        }
      }
    }

    let raf = 0;
    const loop = (now: number) => {
      draw(now);
      raf = requestAnimationFrame(loop);
    };
    const redraw = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(draw);
    };
    const onResize = () => {
      build();
      if (reduced) redraw();
    };

    build();
    window.addEventListener("resize", onResize);
    if (reduced) {
      window.addEventListener("scroll", redraw, { passive: true });
      redraw();
    } else {
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", redraw);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 h-full w-full" />;
}
