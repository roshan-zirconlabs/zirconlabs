import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
export async function GET() {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, email: true, name: true, image: true, createdAt: true, subscription: true, _count: { select: { bots: true, trades: true } } } });
  return NextResponse.json({ user }, { status: user ? 200 : 404 });
}
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = z.object({ name: z.string().trim().min(1).max(100) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Use a name between 1 and 100 characters." }, { status: 400 });
  const user = await prisma.user.update({ where: { id: session.user.id }, data: parsed.data, select: { id: true, name: true, email: true } });
  return NextResponse.json({ user });
}
