import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type IngestPayload = {
  workflowId?: string;
  executionId?: string;
  runId?: string;
  zlabsBotId?: string;
  tokenId?: string;
  marketSlug?: string;
  side?: "BUY" | "SELL";
  signal?: "BUY" | "SELL";
  sizeUsd?: number | string;
  price?: number | string;
  paper?: boolean | string;
  orderId?: string;
  submittedAt?: string;
};

function verifyBearer(req: NextRequest): "missing-secret" | "invalid" | "valid" {
  const expectedSecret = process.env.ZLABS_INGEST_SECRET;
  if (!expectedSecret) return "missing-secret";
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return "invalid";
  return authHeader.slice(7).trim() === expectedSecret ? "valid" : "invalid";
}

export async function POST(req: NextRequest) {
  try {
    const authorization = verifyBearer(req);
    if (authorization === "missing-secret") {
      return NextResponse.json({ error: "Trade ingestion is not configured." }, { status: 503 });
    }
    if (authorization !== "valid") {
      return NextResponse.json(
        { error: "Invalid Authorization header. Expected: Bearer <ZLABS_INGEST_SECRET>" },
        { status: 401 },
      );
    }

    const body: IngestPayload = await req.json();
    if (!body?.zlabsBotId) {
      return NextResponse.json({ error: "zlabsBotId required" }, { status: 400 });
    }

    const bot = await prisma.bot.findUnique({
      where: { id: body.zlabsBotId },
    });
    if (!bot) {
      return NextResponse.json({ error: "Unknown bot" }, { status: 404 });
    }

    const sizeUsd = Number(body.sizeUsd);
    const price = Number(body.price);
    if (!Number.isFinite(sizeUsd) || sizeUsd <= 0 || !Number.isFinite(price) || price <= 0) {
      return NextResponse.json({ error: "sizeUsd and price must be positive numbers." }, { status: 400 });
    }
    const sideStr = (body.side ?? body.signal ?? "BUY").toString().toUpperCase();
    const sigStr = (body.signal ?? body.side ?? "BUY").toString().toUpperCase();
    const paper = body.paper === true || body.paper === "true";
    const tokenId = body.tokenId ?? "unknown";
    const marketSlug = body.marketSlug ?? "polymarket";
    const execId = body.executionId ?? `kh_${body.orderId ?? Date.now()}`;

    const trade = await prisma.trade.upsert({
      where: { keeperhubExecutionId: execId },
      create: {
        userId: bot.userId,
        botId: bot.id,
        signal: sigStr === "SELL" ? "SELL" : "BUY",
        side: sideStr === "SELL" ? "SELL" : "BUY",
        direction: sigStr === "SELL" ? "DOWN" : "UP",
        marketSlug,
        tokenId,
        amount: sizeUsd,
        price,
        status: "FILLED",
        orderId: body.orderId ?? null,
        executedAt: body.submittedAt ? new Date(body.submittedAt) : new Date(),
        keeperhubExecutionId: execId,
        keeperhubRunId: body.runId ?? null,
        paper,
      },
      update: {
        status: "FILLED",
        price,
        amount: sizeUsd,
        executedAt: body.submittedAt ? new Date(body.submittedAt) : new Date(),
      },
    });

    return NextResponse.json({ success: true, tradeId: trade.id });
  } catch (err: unknown) {
    console.error("POST /api/ingest/trade error:", err);
    const message = err instanceof Error ? err.message : "Failed to ingest trade";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
