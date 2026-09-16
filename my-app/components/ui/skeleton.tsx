import { cn } from "@/lib/cn";

export default function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("c-skeleton", className)} />;
}
