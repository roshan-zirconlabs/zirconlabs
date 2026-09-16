import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/cn";

export function PageShell({ children, width = "wide", className }: { children: React.ReactNode; width?: "narrow" | "medium" | "wide"; className?: string }) {
  const max = width === "narrow" ? "max-w-2xl" : width === "medium" ? "max-w-4xl" : "max-w-7xl";
  return <main className={cn("mx-auto w-full px-5 pb-10 pt-10 sm:px-8 sm:pt-14", max, className)}>{children}</main>;
}

export function PageHeader({
  eyebrow,
  title,
  accent,
  description,
  actions,
  back,
}: {
  eyebrow?: string;
  title: string;
  accent?: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="c-fade-in mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-5 inline-flex items-center gap-1.5 text-sm text-[var(--c-dim)] transition-colors hover:text-white">
            <ArrowLeft className="h-4 w-4" /> {back.label}
          </Link>
        )}
        {eyebrow && <p className="c-eyebrow">{eyebrow}</p>}
        <h1 className="c-serif mt-3 break-words text-[clamp(2.5rem,6vw,4.25rem)] leading-[0.98] text-white">
          {title}
          {accent && <em className="c-nebula-text"> {accent}</em>}
        </h1>
        {description && <div className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--c-dim)]">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  tone?: "default" | "good" | "bad" | "accent";
}) {
  const color =
    tone === "good" ? "text-[var(--c-up)]" : tone === "bad" ? "text-[var(--c-down)]" : tone === "accent" ? "c-nebula-text" : "text-white";
  return (
    <div className="c-panel p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] text-[var(--c-dim)]">{label}</p>
        {Icon && <Icon className="h-4 w-4 text-[var(--c-faint)]" aria-hidden="true" />}
      </div>
      <p className={cn("c-serif mt-3 text-4xl leading-none tabular-nums", color)}>{value}</p>
      {hint && <p className="mt-2 text-xs text-[var(--c-faint)]">{hint}</p>}
    </div>
  );
}

const BADGE = {
  active: "border-emerald-300/40 bg-emerald-50 text-emerald-700",
  paused: "border-white/15 bg-white/5 text-[var(--c-dim)]",
  live: "border-amber-300/40 bg-amber-50 text-amber-700",
  practice: "border-purple-300/60 bg-purple-50 text-purple-700",
  danger: "border-rose-300/50 bg-rose-50 text-rose-700",
} as const;

export function StatusBadge({ tone, children, pulse }: { tone: keyof typeof BADGE; children: React.ReactNode; pulse?: boolean }) {
  return (
    <span className={cn("c-chip", BADGE[tone])}>
      <span className={cn("h-1.5 w-1.5 rounded-full bg-current", pulse && "c-pulse")} />
      {children}
    </span>
  );
}

export function BotStatusBadge({ status }: { status: string }) {
  return status === "ACTIVE" ? (
    <StatusBadge tone="active" pulse>
      Running
    </StatusBadge>
  ) : (
    <StatusBadge tone="paused">Paused</StatusBadge>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="c-panel flex flex-col items-center px-6 py-14 text-center">
      <svg viewBox="0 0 120 80" className="h-20 w-32" aria-hidden="true">
        <ellipse cx="60" cy="40" rx="54" ry="16" fill="none" stroke="rgba(255,255,255,0.14)" strokeDasharray="3 5" transform="rotate(-10 60 40)" />
        <circle cx="60" cy="40" r="14" fill="url(#es-g)" />
        <circle cx="104" cy="30" r="3.5" fill="#f7a8cf" />
        <defs>
          <radialGradient id="es-g" cx="35%" cy="30%">
            <stop offset="0%" stopColor="#ffe3f1" />
            <stop offset="55%" stopColor="#9277f5" />
            <stop offset="100%" stopColor="#2a1d5c" />
          </radialGradient>
        </defs>
      </svg>
      <h2 className="c-serif mt-5 text-3xl text-white">{title}</h2>
      <div className="mt-2 max-w-md text-sm leading-relaxed text-[var(--c-dim)]">{body}</div>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "success" | "warning" | "error"; children: React.ReactNode }) {
  const styles = {
    info: "border-purple-300/50 bg-purple-50 text-purple-800",
    success: "border-emerald-300/50 bg-emerald-50 text-emerald-800",
    warning: "border-amber-300/50 bg-amber-50 text-amber-800",
    error: "border-rose-300/50 bg-rose-50 text-rose-800",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-2xl border px-4 py-3 text-sm leading-relaxed", styles)}>
      {children}
    </div>
  );
}
