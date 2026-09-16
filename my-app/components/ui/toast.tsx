"use client";
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";

type ToastItem = {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "success" | "error";
  duration?: number;
};

type ToastContextValue = {
  toast: (t: Omit<ToastItem, "id">) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((t: Omit<ToastItem, "id">) => {
    const id = Math.random().toString(36).slice(2);
    const item: ToastItem = { id, duration: 3200, variant: "default", ...t };
    setItems((prev) => [...prev, item]);
    setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== id)), item.duration);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed right-4 top-20 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
        {items.map((i) => {
          const Icon = i.variant === "success" ? CheckCircle2 : i.variant === "error" ? XCircle : Info;
          return (
            <div
              key={i.id}
              role={i.variant === "error" ? "alert" : "status"}
              className="c-panel c-fade-in pointer-events-auto flex gap-3 bg-[rgba(10,12,36,0.95)] px-4 py-3"
            >
              <Icon
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0",
                  i.variant === "success" ? "text-[var(--c-up)]" : i.variant === "error" ? "text-[var(--c-down)]" : "text-[var(--c-pink)]",
                )}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">{i.title}</p>
                {i.description && <p className="mt-0.5 break-words text-xs text-[var(--c-dim)]">{i.description}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
