import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { keeperhub } from "@/lib/keeperhub";

function decorateBot<T extends { keeperhubWorkflowId: string | null }>(b: T) {
  return {
    ...b,
    editorUrl: b.keeperhubWorkflowId
      ? keeperhub.editorUrl(b.keeperhubWorkflowId)
      : null,
    webhookUrl: b.keeperhubWorkflowId
      ? keeperhub.webhookUrl(b.keeperhubWorkflowId)
      : null,
  };
}

function isMissingSchemaColumn(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === "P2022";
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });
    if (!user) return NextResponse.json({ bots: [] });

    const bots = await prisma.bot.findMany({
      where: { userId: user.id },
      include: { _count: { select: { trades: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ bots: bots.map(decorateBot) });
  } catch (err: unknown) {
    console.error("GET /api/bots error:", err);
    if (isMissingSchemaColumn(err)) {
      return NextResponse.json(
        { error: "Database schema is out of date. Run the release command: yarn db:migrate.", code: "SCHEMA_MIGRATION_REQUIRED" },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to fetch bots" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 100) {
      return NextResponse.json({ error: "Name is required (max 100 chars)" }, { status: 400 });
    }

    const user = await prisma.user.upsert({
      where: { id: session.user.id },
      create: { id: session.user.id, email: session.user.email, name: session.user.name || "User" },
      update: {},
    });

    const [botCount, subscription] = await Promise.all([
      prisma.bot.count({ where: { userId: user.id } }),
      prisma.subscription.upsert({
        where: { userId: user.id },
        create: { userId: user.id, plan: "FREE", status: "ACTIVE" },
        update: {},
      }),
    ]);

    const plan = subscription?.plan ?? "FREE";
    const limit = plan === "ENTERPRISE" ? 100 : plan === "PRO" ? 3 : 1;
    if (botCount >= limit) {
      return NextResponse.json(
        { error: `Bot limit reached (${limit}) for your ${plan} plan. Upgrade to build more.` },
        { status: 403 },
      );
    }

    // New bots are durable local drafts until explicitly published to KeeperHub.
    const workflowId: string | null = null;

    const bot = await prisma.bot.create({
      data: {
        userId: user.id,
        name,
        keeperhubWorkflowId: workflowId,
      },
    });

    return NextResponse.json(decorateBot(bot), { status: 201 });
  } catch (err: unknown) {
    console.error("POST /api/bots error:", err);
    if (isMissingSchemaColumn(err)) {
      return NextResponse.json(
        { error: "Database schema is out of date. Run the release command: yarn db:migrate.", code: "SCHEMA_MIGRATION_REQUIRED" },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create bot" }, { status: 500 });
  }
}
