"use client";

import { useRouter } from "next/navigation";
import { useMe, useSetMode, type Mode } from "@/lib/client";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

/**
 * Practice / Live, always visible. Switching to Live before the live wallet is
 * ready takes you to Account instead of silently showing an empty book.
 */
export default function ModeSwitch({ className }: { className?: string }) {
  const { data: me } = useMe();
  const setMode = useSetMode();
  const router = useRouter();
  const { toast } = useToast();
  if (!me) return <span className={cn("c-skeleton h-9 w-40 rounded-full", className)} />;

  const choose = (mode: Mode) => {
    if (mode === me.mode) return;
    setMode.mutate(mode, {
      onSuccess: (next) => {
        if (mode === "LIVE" && !(next.live.account && next.live.enabled)) {
          toast({ title: "Live trading isn't set up yet", description: "Create and fund your live wallet, then switch it on.", variant: "default" });
          router.push("/account");
        }
      },
      onError: (e) => toast({ title: "Couldn't switch mode", description: e.message, variant: "error" }),
    });
  };

  return (
    <div role="radiogroup" aria-label="Trading mode" className={cn("flex h-9 items-center rounded-full border border-white/12 bg-black/30 p-0.5 text-xs font-medium", className)}>
      {(["PAPER", "LIVE"] as const).map((m) => {
        const active = me.mode === m;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={setMode.isPending}
            onClick={() => choose(m)}
            className={cn(
              "h-full rounded-full px-3 transition-colors",
              active
                ? m === "LIVE" ? "bg-amber-300 text-[#241300]" : "bg-[var(--c-violet)] text-white"
                : "text-[var(--c-dim)] hover:text-white",
            )}
          >
            {m === "PAPER" ? "Practice" : "Live"}
          </button>
        );
      })}
    </div>
  );
}
