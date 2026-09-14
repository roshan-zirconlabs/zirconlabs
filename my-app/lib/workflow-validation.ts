import { z } from "zod";

const node = z.object({ id: z.string().min(1).max(120), type: z.enum(["trigger", "action"]), data: z.object({ config: z.record(z.string(), z.unknown()).default({}) }).passthrough() }).passthrough();
export const graphSchema = z.object({ nodes: z.array(node).max(100), edges: z.array(z.object({ id: z.string(), source: z.string(), target: z.string() }).passthrough()).max(200) });
export type HostedSchemas = { actions: Record<string, { requiredFields?: Record<string, string>; featureEnabled?: boolean }>; triggers: Record<string, { requiredFields?: Record<string, string> }> };

type HostedSchemaFetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type HostedSchemaOptions = {
  fetcher?: HostedSchemaFetcher;
  retries?: number;
  retryDelayMs?: number;
};

export type KeeperhubCatalogErrorCode = "KEEPERHUB_CATALOG_UNAVAILABLE" | "KEEPERHUB_CATALOG_INVALID";

export class KeeperhubCatalogError extends Error {
  readonly code: KeeperhubCatalogErrorCode;
  readonly retryable: boolean;
  readonly upstreamStatus?: number;

  constructor(code: KeeperhubCatalogErrorCode, message: string, options: { retryable: boolean; upstreamStatus?: number; cause?: unknown }) {
    super(message, { cause: options.cause });
    this.name = "KeeperhubCatalogError";
    this.code = code;
    this.retryable = options.retryable;
    this.upstreamStatus = options.upstreamStatus;
  }
}

export function validateHostedGraph(input: unknown, schemas: HostedSchemas) {
  const graph = graphSchema.parse(input);
  const ids = new Set(graph.nodes.map(n => n.id));
  if (ids.size !== graph.nodes.length) throw new Error("Workflow contains duplicate node IDs.");
  const triggers = graph.nodes.filter(n => n.type === "trigger");
  if (triggers.length !== 1 || graph.nodes.length < 2) throw new Error("Add one trigger and at least one connected action.");
  for (const edge of graph.edges) if (!ids.has(edge.source) || !ids.has(edge.target)) throw new Error("Workflow has an invalid connection.");
  for (const n of graph.nodes) {
    const config = n.data.config;
    const key = String(n.type === "trigger" ? config.triggerType : config.actionType);
    const schema = (n.type === "trigger" ? schemas.triggers : schemas.actions)[key];
    if (!schema || ("featureEnabled" in schema && schema.featureEnabled === false)) throw new Error(`Action ${key} is not available on this KeeperHub host. Your draft is preserved.`);
    for (const field of Object.keys(schema.requiredFields ?? {})) {
      if (config[field] === undefined || config[field] === null || config[field] === "") throw new Error(`${key} requires ${field}.`);
    }
  }
  const reached = new Set<string>();
  const visiting = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id)) throw new Error("Workflow contains a cycle.");
    if (reached.has(id)) return;
    visiting.add(id);
    for (const e of graph.edges.filter(e => e.source === id)) visit(e.target);
    visiting.delete(id); reached.add(id);
  }
  visit(triggers[0].id);
  if (reached.size !== ids.size) throw new Error("Every action must be connected to the trigger.");
  return graph;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function wait(ms: number) {
  return ms > 0 ? new Promise<void>((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

export async function getHostedSchemas(options: HostedSchemaOptions = {}): Promise<HostedSchemas> {
  const base = (process.env.KEEPERHUB_BASE_URL?.trim() || "https://app.keeperhub.com").replace(/\/$/, "");
  const fetcher = options.fetcher ?? fetch;
  const retries = Math.max(0, Math.floor(options.retries ?? 2));
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? 250);
  const url = `${base}/api/mcp/schemas`;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    let response: Response;
    try {
      response = await fetcher(url, { signal: AbortSignal.timeout(15000), cache: "no-store" });
    } catch (cause) {
      if (attempt < retries) {
        await wait(retryDelayMs * 2 ** attempt);
        continue;
      }
      throw new KeeperhubCatalogError("KEEPERHUB_CATALOG_UNAVAILABLE", "KeeperHub action catalog is unavailable. Retry shortly.", { retryable: true, cause });
    }

    if (!response.ok) {
      if (isRetryableStatus(response.status) && attempt < retries) {
        await wait(retryDelayMs * 2 ** attempt);
        continue;
      }
      throw new KeeperhubCatalogError("KEEPERHUB_CATALOG_UNAVAILABLE", "KeeperHub action catalog is unavailable. Retry shortly.", {
        retryable: isRetryableStatus(response.status),
        upstreamStatus: response.status,
      });
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch (cause) {
      throw new KeeperhubCatalogError("KEEPERHUB_CATALOG_INVALID", "KeeperHub returned an invalid action catalog.", { retryable: false, cause });
    }
    if (!isRecord(data) || !isRecord(data.actions) || !isRecord(data.triggers)) {
      throw new KeeperhubCatalogError("KEEPERHUB_CATALOG_INVALID", "KeeperHub returned an invalid action catalog.", { retryable: false });
    }
    return data as HostedSchemas;
  }

  throw new KeeperhubCatalogError("KEEPERHUB_CATALOG_UNAVAILABLE", "KeeperHub action catalog is unavailable. Retry shortly.", { retryable: true });
}
