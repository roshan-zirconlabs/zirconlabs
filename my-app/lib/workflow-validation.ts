import { z } from "zod";

/** The visual editor's saved graph: nodes and edges, bounded in size. */
const node = z.object({ id: z.string().min(1).max(120), type: z.enum(["trigger", "action"]), data: z.object({ config: z.record(z.string(), z.unknown()).default({}) }).passthrough() }).passthrough();
export const graphSchema = z.object({ nodes: z.array(node).max(100), edges: z.array(z.object({ id: z.string(), source: z.string(), target: z.string() }).passthrough()).max(200) });
