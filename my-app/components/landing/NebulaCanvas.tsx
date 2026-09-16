"use client";

import { useEffect, useRef, useState } from "react";

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform float uScroll;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

float dust(vec2 uv, float scale, float keep) {
  vec2 g = uv * scale;
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;
  float h = hash(id);
  if (h < keep) return 0.0;
  vec2 off = vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5;
  float d = length(f - off * 0.7);
  return smoothstep(0.09, 0.0, d) * (h - keep) / (1.0 - keep);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec2 p = uv + uMouse * 0.025;

  float ang = -0.72;
  mat2 R = mat2(cos(ang), sin(ang), -sin(ang), cos(ang));
  vec2 q = R * p;
  q.x += uScroll * 0.55;
  q.y += sin(uScroll * 0.9) * 0.18;

  float t = uTime * 0.012;
  vec2 w = vec2(fbm(q * 1.3 + t), fbm(q * 1.3 + vec2(5.2, 1.3) - t));
  vec2 w2 = vec2(fbm(q * 2.1 + w * 1.4 + vec2(1.7, 9.2) + t * 0.6),
                 fbm(q * 2.1 + w * 1.4 + vec2(8.3, 2.8)));
  float n = fbm(q * 1.7 + w2 * 1.2);

  float wob = (fbm(vec2(q.x * 0.7, 3.0) + t) - 0.5) * 0.55;
  float bd = abs(q.y - 0.05 - wob);
  float band = exp(-bd * bd * 4.2);
  float core = exp(-bd * bd * 18.0);
  float neb = band * smoothstep(0.3, 0.86, n);
  float lanes = smoothstep(0.48, 0.78, fbm(q * 2.6 + w * 1.2 + vec2(2.0, 4.0))) * band;

  vec3 col = mix(vec3(0.020, 0.027, 0.085), vec3(0.055, 0.070, 0.190),
                 smoothstep(-0.9, 0.9, uv.y - uv.x * 0.4));

  vec3 blue = vec3(0.20, 0.27, 0.66);
  vec3 violet = vec3(0.46, 0.31, 0.82);
  vec3 magenta = vec3(0.86, 0.33, 0.60);
  vec3 pink = vec3(1.00, 0.62, 0.80);
  vec3 lav = vec3(1.00, 0.90, 0.97);

  float haze = exp(-bd * bd * 1.4);

  col += blue * haze * 0.14;
  col += blue * band * 0.34 * (0.4 + n);
  col += mix(violet, magenta, smoothstep(0.22, 0.62, w2.x)) * neb * 1.45;
  col += pink * neb * neb * core * 1.1;
  col += lav * pow(core * n, 3.0) * 0.85;
  col *= 1.0 - lanes * 0.72;

  float s = dust(uv + uMouse * 0.012, 140.0, 0.86) * (0.35 + band * 0.9);
  s += dust(uv + uMouse * 0.006, 70.0, 0.9) * 0.6;
  col += vec3(0.85, 0.88, 1.0) * s * 0.55;

  col *= 1.0 - 0.28 * dot(uv, uv);
  col = 1.0 - exp(-col * 1.35);
  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export default function NebulaCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false, powerPreference: "low-power" });
    if (!gl) { setFailed(true); return; }

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram();
    if (!vs || !fs || !prog) { setFailed(true); return; }
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { setFailed(true); return; }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "uRes");
    const uTime = gl.getUniformLocation(prog, "uTime");
    const uMouse = gl.getUniformLocation(prog, "uMouse");
    const uScroll = gl.getUniformLocation(prog, "uScroll");

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // The nebula is soft, so it renders below native resolution; the scale adapts to the device's speed.
    let scale = Math.min(window.devicePixelRatio, 1.5) * 0.5;
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    let scroll = 0;

    function resize() {
      if (!canvas || !gl) return;
      const w = Math.round(window.innerWidth * scale);
      const h = Math.round(window.innerHeight * scale);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    }
    resize();
    const onResize = () => {
      resize();
      if (reduced) raf = requestAnimationFrame(frame);
    };
    window.addEventListener("resize", onResize);

    const onMove = (e: PointerEvent) => {
      mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.ty = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    if (!reduced) window.addEventListener("pointermove", onMove, { passive: true });

    let raf = 0;
    let running = true;
    const start = performance.now();
    let slowFrames = 0;
    let last = start;
    let lastDraw = 0;

    // The gas drifts slowly, so ~30fps is visually identical at half the GPU cost.
    function frame(now: number) {
      if (!gl) return;
      if (!reduced && now - lastDraw < 32) {
        if (running) raf = requestAnimationFrame(frame);
        return;
      }
      lastDraw = now;
      const dt = now - last;
      last = now;
      if (dt > 60 && scale > 0.3) {
        if (++slowFrames > 20) { scale *= 0.8; slowFrames = 0; resize(); }
      } else slowFrames = Math.max(0, slowFrames - 1);

      mouse.x += (mouse.tx - mouse.x) * 0.04;
      mouse.y += (mouse.ty - mouse.y) * 0.04;
      const target = window.scrollY / window.innerHeight;
      scroll += (target - scroll) * 0.08;

      gl.uniform2f(uRes, canvas!.width, canvas!.height);
      gl.uniform1f(uTime, reduced ? 20 : (now - start) / 1000);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.uniform1f(uScroll, reduced ? 0 : scroll);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (running && !reduced) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    const onVis = () => {
      cancelAnimationFrame(raf);
      running = document.visibilityState === "visible";
      if (running && !reduced) { last = performance.now(); raf = requestAnimationFrame(frame); }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVis);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 bg-[#05071a]">
      {failed ? (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_40%_at_60%_45%,rgba(217,87,155,0.45),transparent_70%),radial-gradient(ellipse_70%_50%_at_30%_65%,rgba(118,80,210,0.4),transparent_70%),linear-gradient(160deg,#070a22,#0e1334)]" />
      ) : (
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      )}
    </div>
  );
}
