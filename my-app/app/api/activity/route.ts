import { prisma } from "@/lib/prisma";
import { fail, json, requireUserId } from "@/lib/api";

export async function GET(req: Request) {
  try {
    const userId = await requireUserId();
    const mode = new URL(req.url).searchParams.get("mode");
    const rows = await prisma.activity.findMany({
      where: { userId, ...(mode === "LIVE" || mode === "PAPER" ? { OR: [{ mode }, { mode: null }] } : {}) },
      orderBy: { createdAt: "desc" }, take: 60,
    });
    return json({
      activity: rows.map((a) => ({ id: a.id, level: a.level, mode: a.mode, title: a.title, detail: a.detail, automationId: a.automationId, createdAt: a.createdAt.toISOString() })),
    });
  } catch (error) {
    return fail(error);
  }
}
