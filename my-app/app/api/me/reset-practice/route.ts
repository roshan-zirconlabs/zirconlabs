import { prisma } from "@/lib/prisma";
import { fail, json, requireUserId } from "@/lib/api";
import { logActivity } from "@/lib/activity";

/** Starts practice over: $1,000 cash, no positions, practice automations cancelled. */
export async function POST() {
  try {
    const userId = await requireUserId();
    await prisma.$transaction([
      prisma.paperPosition.deleteMany({ where: { userId } }),
      prisma.automation.updateMany({ where: { userId, mode: "PAPER", status: { in: ["ACTIVE", "PAUSED", "FAILED"] } }, data: { status: "CANCELLED", webhookSecretHash: null } }),
      prisma.user.update({ where: { id: userId }, data: { paperCash: 1000 } }),
    ]);
    await logActivity({ userId, mode: "PAPER", title: "Practice account reset to $1,000" });
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
