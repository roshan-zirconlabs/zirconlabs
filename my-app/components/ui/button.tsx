"use client";
import { cn } from "@/lib/cn";
import React from "react";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const variants: Record<Variant, string> = {
  primary: "c-btn-primary",
  secondary: "c-btn-ghost",
  outline: "c-btn-ghost",
  ghost:
    "inline-flex items-center justify-center gap-2 rounded-full px-3 text-sm text-[var(--c-dim)] transition-colors hover:bg-white/5 hover:text-white disabled:opacity-45",
  danger: "c-btn-danger",
};

const sizes: Record<Size, string> = {
  sm: "c-btn-sm",
  md: "",
  lg: "!min-h-12 !px-6 !text-[15px]",
};

export default function Button({ className, variant = "primary", size = "md", ...props }: Props) {
  return <button className={cn(variants[variant], sizes[size], className)} {...props} />;
}
