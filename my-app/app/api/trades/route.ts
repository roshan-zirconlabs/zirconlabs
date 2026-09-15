import { Prisma, TradeStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user) {
      return NextResponse.json({ trades: [], total: 0, limit: 50, offset: 0 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 100);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10) || 0;
    const botId = searchParams.get("botId") || undefined;
    // Only a real TradeStatus may reach the query; anything else is ignored
    // rather than passed through to Prisma, which would throw.
    const requested = searchParams.get("status");
    const status = requested && requested in TradeStatus ? (requested as TradeStatus) : undefined;

    const where: Prisma.TradeWhereInput = {
      userId: user.id,
      ...(botId ? { botId } : {}),
      ...(status ? { status } : {}),
    };

    const [trades, total] = await Promise.all([
      prisma.trade.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: { bot: { select: { name: true } } },
      }),
      prisma.trade.count({ where }),
    ]);

    return NextResponse.json({ trades, total, limit, offset });
  } catch (err: unknown) {
    console.error("GET /api/trades error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to fetch trades" }, { status: 500 });
  }
}
