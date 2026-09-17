import { Activity, Box, Clock, Code, GitBranch, Globe, Play, Webhook, type LucideIcon } from "lucide-react";

export const TRIGGER_ICONS: Record<string, LucideIcon> = {
  Manual: Play,
  Schedule: Clock,
  Webhook: Webhook,
};

export function ActionIcon({ actionType, className }: { actionType?: string; className?: string }) {
  const t = actionType?.toLowerCase() ?? "";
  const props = { className, strokeWidth: 1.75 };
  if (!t) return <Box {...props} />;
  if (t.includes("condition")) return <GitBranch {...props} />;
  if (t.startsWith("code")) return <Code {...props} />;
  if (t.includes("/")) return <Activity {...props} />;
  return <Globe {...props} />;
}
