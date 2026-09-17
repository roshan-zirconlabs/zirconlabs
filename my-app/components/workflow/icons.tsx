import { Activity, Box, Clock, Code, GitBranch, Globe, Play, ShoppingCart, Webhook, type LucideIcon } from "lucide-react";

export const TRIGGER_ICONS: Record<string, LucideIcon> = {
  Manual: Play,
  Schedule: Clock,
  Webhook: Webhook,
};

export function ActionIcon({ actionType, className }: { actionType?: string; className?: string }) {
  const t = actionType?.toLowerCase() ?? "";
  const props = { className, strokeWidth: 1.75 };
  if (!t) return <Box {...props} />;
  if (t.includes("place-order")) return <ShoppingCart {...props} />;
  if (t.includes("signal") || t.includes("odds")) return <Activity {...props} />;
  if (t.includes("condition")) return <GitBranch {...props} />;
  if (t.startsWith("code")) return <Code {...props} />;
  if (t.includes("/")) return <Activity {...props} />;
  return <Globe {...props} />;
}
