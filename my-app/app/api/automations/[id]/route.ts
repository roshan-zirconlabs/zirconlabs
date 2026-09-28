import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fail, json, readJson, requireUserId, HttpError } from "@/lib/api";
import { logActivity } from "@/lib/activity";
import { describeAutomation, rotateWebhookSecret } from "@/lib/automations/service";

type Params = { params: Promise<{ id: string }> };

const patch = z.union([
  z.object({ status: z.enum(["ACTIVE", "PAUSED"]) }).strict(),
  z.object({ rotateSecret: z.literal(true) }).strict(),
]);

export async function PATCH(req: Request, { params }: Params) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const parsed = patch.safeParse(await readJson(req));
    if (!parsed.success) throw new HttpError("Choose pause, resume or a new webhook link.");
    const automation = await prisma.automation.findFirst({ where: { id, userId } });
    if (!automation) throw new HttpError("Automation not found.", 404);

    if ("rotateSecret" in parsed.data) {
      const secret = await rotateWebhookSecret(userId, id);
      // Never AUTH_URL: an apex domain that redirects to www breaks TradingView, which won't follow redirects.
      const origin = process.env.APP_URL || new URL(req.url).origin;
      return json({ webhookUrl: `${origin.replace(/\/$/, "")}/api/hooks/${id}/${secret}` });
    }
    if (!["ACTIVE", "PAUSED", "FAILED"].includes(automation.status)) throw new HttpError("This automation has finished and can't be changed.", 409);
    await prisma.automation.update({ where: { id }, data: { status: parsed.data.status, lastError: null, lockedUntil: null } });
    await logActivity({ userId, automationId: id, mode: automation.mode, title: `${parsed.data.status === "ACTIVE" ? "Resumed" : "Paused"}: ${describeAutomation(automation)}` });
    return json({ ok: true, status: parsed.data.status });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const automation = await prisma.automation.findFirst({ where: { id, userId } });
    if (!automation) throw new HttpError("Automation not found.", 404);
    await prisma.automation.update({ where: { id }, data: { status: "CANCELLED", webhookSecretHash: null, lockedUntil: null } });
    await logActivity({ userId, automationId: id, mode: automation.mode, title: `Cancelled: ${describeAutomation(automation)}` });
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
