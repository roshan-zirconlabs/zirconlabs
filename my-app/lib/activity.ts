import type { ActivityLevel, Prisma, PrismaClient, TradingMode } from "@prisma/client";
import { prisma } from "./prisma";

type Db = PrismaClient | Prisma.TransactionClient;

export type ActivityInput = {
  userId: string;
  title: string;
  detail?: string;
  level?: ActivityLevel;
  mode?: TradingMode;
  automationId?: string | null;
  orderId?: string | null;
};

/** One line in the user's audit trail — and, for non-INFO levels, an alert. */
export async function logActivity(input: ActivityInput, db: Db = prisma) {
  await db.activity.create({
    data: {
      userId: input.userId,
      title: input.title.slice(0, 200),
      detail: input.detail?.slice(0, 2000),
      level: input.level ?? "INFO",
      mode: input.mode,
      automationId: input.automationId ?? null,
      orderId: input.orderId ?? null,
    },
  });
}
