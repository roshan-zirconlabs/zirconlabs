import { z } from "zod";
export const marketHistorySchema = z.array(z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,220}$/), startTs: z.number().int().positive(), endTs: z.number().int().positive(),
  sourceTimeframe: z.enum(["15m", "1h", "4h", "1d"]).optional(),
  yesTokenHistory: z.object({ history: z.array(z.object({ t: z.number().int().positive(), p: z.number().min(0).max(1) })).max(3000) }).optional(),
}).refine(m => m.endTs > m.startTs, "Market end must follow start")).max(200);
export const backtestInput = z.object({ tradesCsv: z.string().min(1).max(1000000).refine(s => s.split("\n").length <= 5000, "Limit CSV to 5,000 lines"), markets: marketHistorySchema.default([]), marketType: z.enum(["15m", "1h", "4h", "1d", "all"]), stakeUsd: z.number().positive().max(10000), name: z.string().trim().min(1).max(100).default("Backtest") });
