import { prisma } from "@/lib/prisma";
import { fail, json, requireUserId } from "@/lib/api";
import { getPortfolio } from "@/lib/trading/portfolio";

export async function GET(req: Request) {
  try {
    const userId = await requireUserId();
    const requested = new URL(req.url).searchParams.get("mode");
    const mode = requested === "LIVE" || requested === "PAPER"
      ? requested
      : (await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { mode: true } })).mode;
    return json(await getPortfolio(userId, mode));
  } catch (error) {
    return fail(error);
  }
}
