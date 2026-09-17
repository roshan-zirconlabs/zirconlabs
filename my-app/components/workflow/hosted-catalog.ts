"use client";
import { useQuery } from "@tanstack/react-query";
import type { ActionDef, FieldDef } from "./registry";

type Schema = { label: string; description?: string; integration?: string; featureEnabled?: boolean; requiredPlan?: string; requiredFields?: Record<string, string>; optionalFields?: Record<string, string> };
export function useHostedCatalog() {
  return useQuery({ queryKey: ["keeperhub-action-catalog"], staleTime: 300000, queryFn: async (): Promise<ActionDef[]> => {
    const res = await fetch("/api/keeperhub/catalog");
    if (!res.ok) throw new Error("Cannot load the hosted action catalog. Retry to browse actions.");
    const data = await res.json() as { actions: Record<string, Schema> };
    return Object.entries(data.actions).filter(([, a]) => a.featureEnabled !== false).map(([id, a]) => ({
      id, actionType: id, integrationType: a.integration || "system", label: a.label,
      description: [a.description || id, a.requiredPlan ? `Requires KeeperHub ${a.requiredPlan}` : ""].filter(Boolean).join(". "),
      category: inferCategory(a.integration),
      fields: [...Object.entries(a.requiredFields ?? {}), ...Object.entries(a.optionalFields ?? {})].filter(([key]) => !key.startsWith("_")).map(([key, type]): FieldDef => ({
        key, label: key, kind: inferFieldKind(type), description: type,
        required: key in (a.requiredFields ?? {}),
      })),
    }));
  } });
}

function inferFieldKind(type: string): FieldDef["kind"] {
  const value = type.toLowerCase();
  if (value.includes("boolean")) return "boolean";
  if (value.includes("number") || value.includes("integer") || value.includes("float") || value.includes("amount")) return "number";
  if (value.includes("json") || value.includes("object") || value.includes("array") || value.includes("[]")) return "textarea";
  if (value.includes("cron")) return "cron";
  return "text";
}

function inferCategory(integration?: string): ActionDef["category"] {
  const value = (integration ?? "").toLowerCase();
  return value.includes("logic") || value.includes("code") || value === "system" ? "logic" : "io";
}
