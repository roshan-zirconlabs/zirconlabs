"use client";

import { useEffect, useRef, useState } from "react";

type Material = "rocky" | "banded" | "ringed" | "swirl" | "ember";

type Planet = {
  color: string; // "r,g,b"
  glow: string; // "r,g,b"
  material: Material;
  name: string;
  title: string;
  desc: string;
};

const PLANETS: Planet[] = [
  {
    color: "232,120,90",
    glow: "243,182,163",
    material: "rocky",
    name: "Sign in",
    title: "Sign in. That's it.",
    desc: "No wallet install, no seed phrase, no network switching. One account gets you a trading identity you never have to think about again.",
  },
  {
    color: "227,169,62",
    glow: "246,214,150",
    material: "banded",
    name: "Write the rule",
    title: "Write a rule, or bring your own.",
    desc: "Drag conditions onto a canvas, or point a TradingView alert at a webhook. Either way you're describing when to trade, not how to trade.",
  },
  {
    color: "111,111,217",
    glow: "186,186,244",
    material: "ringed",
    name: "KeeperHub runs it",
    title: "KeeperHub takes it from here.",
    desc: "Your rule becomes a live, monitored workflow. Every check, every trigger, every retry — logged, deterministic, and running whether you're watching or not.",
  },
  {
    color: "47,168,143",
    glow: "150,224,201",
    material: "swirl",
    name: "Every window",
    title: "Every window, re-checked live.",
    desc: "Polymarket's up/down markets roll every 15 minutes to a day. Zircon Labs resolves the live window itself each time — never a stale slug, never a guess.",
  },
  {
    color: "217,98,143",
    glow: "244,178,205",
    material: "ember",
    name: "Cash out",
    title: "Cash out, any time.",
    desc: "Positions settle to your Deposit Wallet automatically. Sell out early or withdraw to your own address whenever you want — nothing is ever locked in.",
  },
];

function easeInOutCubic(x: number) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function pathPoint(u: number, W: number, H: number) {
  // u = signed distance from focus, roughly in [-1, 1] range but can exceed it
  const clamped = Math.max(-1.6, Math.min(1.6, u));
  const absU = Math.min(1, Math.abs(clamped));
  const eased = easeInOutCubic(absU) * Math.sign(clamped);

  const x = W * 0.5 + eased * W * 0.62;
  const y = H * 0.5 + Math.sin(eased * Math.PI * 0.5) * H * 0.12;

  const focus = Math.max(0, 1 - Math.abs(clamped) * 0.95);
  const scale = 0.22 + focus * 0.78;
  const opacity = Math.max(0, 1 - Math.abs(clamped) * 0.8);
  const blur = Math.abs(clamped) * 6;

  return { x, y, scale, opacity, blur, focus };
}

function drawRocky(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  const spots = [
    [-0.3, -0.2, 0.5], [0.25, 0.1, 0.4], [-0.1, 0.35, 0.3], [0.35, -0.3, 0.28],
  ];
  spots.forEach(([dx, dy, s]) => {
    const cx = x + dx * r, cy = y + dy * r, cr = s * r;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
    g.addColorStop(0, `rgba(0,0,0,0.16)`);
    g.addColorStop(1, `rgba(0,0,0,0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, cr, cr * 0.7, dx, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawBanded(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  for (let i = -3; i <= 3; i++) {
    const by = y + i * r * 0.24;
    ctx.beginPath();
    ctx.ellipse(x, by, r * 1.05, r * 0.09, 0, 0, Math.PI * 2);
    ctx.fillStyle = i % 2 === 0 ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.07)";
    ctx.fill();
  }
  ctx.restore();
}

function drawRinged(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  const g = ctx.createRadialGradient(x, y - r * 0.5, 0, x, y - r * 0.5, r * 0.8);
  g.addColorStop(0, `rgba(${color},0.35)`);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSwirl(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  for (let i = 0; i < 3; i++) {
    const a = t * 0.4 + (i * Math.PI * 2) / 3;
    const cx = x + Math.cos(a) * r * 0.35;
    const cy = y + Math.sin(a) * r * 0.3;
    const cr = r * (0.45 + i * 0.08);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
    g.addColorStop(0, "rgba(255,255,255,0.14)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawEmber(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, color: string) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  const pulse = 0.55 + Math.sin(t * 1.6) * 0.15;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * pulse);
  g.addColorStop(0, `rgba(${color},0.55)`);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlanet(ctx: CanvasRenderingContext2D, p: Planet, x: number, y: number, r: number, opacity: number, blur: number, t: number) {
  if (r < 0.6 || opacity <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = opacity;
  if (blur > 0.5) ctx.filter = `blur(${blur}px)`;

  // halo
  const halo = ctx.createRadialGradient(x, y, r * 0.6, x, y, r * 2.4);
  halo.addColorStop(0, `rgba(${p.glow},0.35)`);
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
  ctx.fill();

  // ring (behind body, back half)
  if (p.material === "ringed" && r > 10) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.35);
    ctx.scale(1, 0.32);
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.9, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${p.color},0.35)`;
    ctx.lineWidth = r * 0.16;
    ctx.stroke();
    ctx.restore();
  }

  // body
  const body = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  body.addColorStop(0, `rgba(${p.glow},1)`);
  body.addColorStop(0.55, `rgba(${p.color},1)`);
  body.addColorStop(1, `rgba(${p.color},0.55)`);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  if (r > 16) {
    if (p.material === "rocky") drawRocky(ctx, x, y, r);
    else if (p.material === "banded") drawBanded(ctx, x, y, r);
    else if (p.material === "ringed") drawRinged(ctx, x, y, r, p.color);
    else if (p.material === "swirl") drawSwirl(ctx, x, y, r, t);
    else if (p.material === "ember") drawEmber(ctx, x, y, r, t, p.color);
  }

  // terminator shading
  const term = ctx.createRadialGradient(x + r * 0.4, y + r * 0.4, 0, x, y, r);
  term.addColorStop(0, "rgba(0,0,0,0)");
  term.addColorStop(1, "rgba(0,0,0,0.32)");
  ctx.fillStyle = term;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // specular
  ctx.beginPath();
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.arc(x - r * 0.38, y - r * 0.4, Math.max(1, r * 0.13), 0, Math.PI * 2);
  ctx.fill();

  // ring front half
  if (p.material === "ringed" && r > 10) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.35);
    ctx.scale(1, 0.32);
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.9, Math.PI * 0.05, Math.PI * 0.95);
    ctx.strokeStyle = `rgba(${p.glow},0.65)`;
    ctx.lineWidth = r * 0.12;
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

export default function GalaxyJourney() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const section = sectionRef.current;
    if (!canvas || !section) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function resize() {
      if (!canvas || !ctx) return;
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, rect.width), h = Math.max(1, rect.height);
      const targetW = w * devicePixelRatio, targetH = h * devicePixelRatio;
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
        ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      }
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    document.fonts?.ready?.then(resize).catch(() => {});

    const starsNear = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.4 + 0.4 }));
    const starsFar = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 0.9 + 0.2 }));

    let progress = 0;
    let raf = 0;

    function readProgress() {
      if (!section) return 0;
      const rect = section.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      if (total <= 0) return 0;
      return Math.min(1, Math.max(0, -rect.top / total));
    }

    function draw(t: number) {
      if (!ctx || !canvas) return;
      const W = canvas.getBoundingClientRect().width;
      const H = canvas.getBoundingClientRect().height;
      const time = t / 1000;

      progress = readProgress();
      const focusT = progress * (PLANETS.length - 1);
      const nextActive = Math.round(focusT);
      if (nextActive !== activeRef.current) {
        activeRef.current = nextActive;
        setActive(nextActive);
      }

      ctx.clearRect(0, 0, W, H);

      // parallax starfield, drifts opposite scroll direction slightly
      const drift = progress * 40;
      ctx.fillStyle = "rgba(111,111,217,0.10)";
      starsFar.forEach((s) => {
        ctx.beginPath();
        ctx.arc(s.x * W - drift * 0.4, ((s.y * H + drift * 0.2) % H + H) % H, s.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillStyle = "rgba(111,111,217,0.22)";
      starsNear.forEach((s) => {
        ctx.beginPath();
        ctx.arc(s.x * W - drift, ((s.y * H + drift * 0.6) % H + H) % H, s.r, 0, Math.PI * 2);
        ctx.fill();
      });

      // orbit lane
      ctx.save();
      ctx.setLineDash([2, 10]);
      ctx.strokeStyle = "rgba(111,111,217,0.22)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(W * 0.02, H * 0.5);
      ctx.bezierCurveTo(W * 0.3, H * 0.38, W * 0.7, H * 0.62, W * 0.98, H * 0.5);
      ctx.stroke();
      ctx.restore();

      const baseR = Math.min(W, H) * 0.16;
      PLANETS.forEach((p, i) => {
        const u = i - focusT;
        const { x, y, scale, opacity, blur } = pathPoint(u, W, H);
        drawPlanet(ctx, p, x, y, baseR * scale, opacity, reduced ? 0 : blur, time + i * 10);
      });

      if (!reduced) raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    if (reduced) {
      const onScroll = () => draw(performance.now());
      window.addEventListener("scroll", onScroll, { passive: true });
      draw(performance.now());
      return () => { window.removeEventListener("scroll", onScroll); ro.disconnect(); };
    }

    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  function jumpTo(i: number) {
    const section = sectionRef.current;
    if (!section) return;
    const rect = section.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    const top = window.scrollY + rect.top + (total * i) / (PLANETS.length - 1);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
  }

  const p = PLANETS[active];

  return (
    <section ref={sectionRef} className="relative" style={{ height: "560vh" }}>
      <div className="sticky top-0 flex h-[100svh] items-center overflow-hidden">
        <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0" style={{ width: "100%", height: "100%" }} />

        {/* rail dots */}
        <div className="absolute right-4 top-1/2 z-10 hidden -translate-y-1/2 flex-col items-end gap-3 sm:right-8 md:flex">
          {PLANETS.map((planet, i) => (
            <button
              key={planet.name}
              onClick={() => jumpTo(i)}
              aria-label={`Jump to ${planet.name}`}
              aria-current={active === i}
              className="group flex items-center gap-2"
            >
              <span className={`text-[11px] font-medium transition-opacity ${active === i ? "opacity-100 text-[var(--ink)]" : "opacity-0 group-hover:opacity-60 text-[var(--muted)]"}`}>
                {planet.name}
              </span>
              <span
                className="h-2 w-2 rounded-full transition-all"
                style={{
                  background: active === i ? `rgb(${planet.color})` : "var(--line-accent)",
                  transform: active === i ? "scale(1.5)" : "scale(1)",
                }}
              />
            </button>
          ))}
        </div>

        {/* badge */}
        <div className="absolute left-4 top-6 z-10 sm:left-8 sm:top-10">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line-accent)] bg-white/80 px-3 py-1 text-[11px] font-medium text-[var(--muted)] backdrop-blur">
            Step {active + 1} of {PLANETS.length}
          </span>
        </div>

        {/* content panel */}
        <div className="relative z-10 mx-auto w-full max-w-6xl px-4 sm:px-8">
          <div className="max-w-md rounded-2xl border border-[var(--line-accent)] bg-white/85 p-6 backdrop-blur-md sm:p-8" style={{ boxShadow: "var(--shadow-elevated)" }}>
            <div
              className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ background: `rgb(${p.color})` }}
            >
              {active + 1}
            </div>
            <h3 className="text-2xl font-bold tracking-tight text-[var(--ink)] sm:text-[28px]">{p.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{p.desc}</p>
          </div>
        </div>

        {/* scrubber */}
        <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 sm:bottom-10">
          {PLANETS.map((planet, i) => (
            <button
              key={planet.name}
              onClick={() => jumpTo(i)}
              aria-label={`Jump to ${planet.name}`}
              className="flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors"
              style={{
                borderColor: active === i ? `rgb(${planet.color})` : "var(--line-accent)",
                color: active === i ? `rgb(${planet.color})` : "var(--muted2)",
                background: active === i ? "white" : "transparent",
              }}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export { PLANETS };
