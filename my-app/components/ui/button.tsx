"use client";
import { cn } from "@/lib/cn";
import React from "react";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40 disabled:opacity-40 disabled:pointer-events-none cursor-pointer select-none";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--primary)] text-white font-semibold hover:bg-[var(--primary-hover)] shadow-md shadow-purple-500/25 active:scale-[0.98]",
  secondary:
    "border border-purple-200 bg-purple-50/70 text-purple-900 hover:bg-purple-100 hover:border-purple-300 font-medium shadow-xs",
  outline:
    "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-xs",
  ghost: "text-slate-600 hover:text-purple-900 hover:bg-purple-50/70",
  danger: "bg-rose-500 text-white hover:bg-rose-600 shadow-md shadow-rose-500/20",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-xs",
  lg: "h-11 px-5 text-sm",
};

export default function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: Props) {
  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  );
}
