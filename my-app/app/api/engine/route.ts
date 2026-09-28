import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** When the automation engine last checked a price. Public: no user data. */
export async function GET() {
  const last = await prisma.automation
    .findFirst({ where: { lastCheckedAt: { not: null } }, orderBy: { lastCheckedAt: "desc" }, select: { lastCheckedAt: true } })
    .catch(() => null);
  return NextResponse.json({ engineLastRunAt: last?.lastCheckedAt?.toISOString() ?? null }, { headers: { "Cache-Control": "no-store" } });
}
