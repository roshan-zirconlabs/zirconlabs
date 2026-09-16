import { cn } from "@/lib/cn";

const SURFACES = [
  "radial-gradient(circle at 32% 28%, #ffe2d6, #ef8a66 45%, #6d2a2a 100%)",
  "radial-gradient(circle at 32% 28%, #e3f7ff, #6fb6f0 45%, #1d3a7a 100%)",
  "radial-gradient(circle at 32% 28%, #f1e6ff, #9d7cf2 45%, #2d1d6b 100%)",
  "radial-gradient(circle at 32% 28%, #dffff4, #4fc7a4 45%, #0f4a45 100%)",
  "radial-gradient(circle at 32% 28%, #fff1d6, #e8ac4e 45%, #4a2418 100%)",
  "radial-gradient(circle at 32% 28%, #ffe0ef, #e0619f 45%, #521a44 100%)",
];

function hash(value: string) {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export default function BotAvatar({ id, active, size = "md" }: { id: string; active?: boolean; size?: "md" | "lg" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative block shrink-0 rounded-full shadow-[inset_-5px_-5px_10px_rgba(0,0,0,0.45)]",
        size === "lg" ? "h-14 w-14" : "h-10 w-10",
        active && "ring-2 ring-[rgba(94,224,166,0.5)] ring-offset-2 ring-offset-[#0e1030]",
      )}
      style={{ background: SURFACES[hash(id) % SURFACES.length] }}
    />
  );
}
