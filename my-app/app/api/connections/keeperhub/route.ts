import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { KeeperhubClient } from "@/lib/keeperhub";
import { keeperhubManagedByPlatform } from "@/lib/keeperhub-connection";
import { z } from "zod";

export async function GET() {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const connection = await prisma.keeperhubConnection.findUnique({ where: { userId: session.user.id }, select: { keyPrefix: true, verifiedAt: true } });
  // When Zircon hosts workflows itself, a personal key is optional, not required.
  return NextResponse.json({ connection, managedByPlatform: keeperhubManagedByPlatform() });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = z.object({ apiKey: z.string().trim().regex(/^kh_[A-Za-z0-9_-]{16,250}$/) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a KeeperHub organization key beginning with kh_. Webhook keys are not supported." }, { status: 400 });
  try {
    const userId = session.user.id;
    const apiKey = parsed.data.apiKey;
    await new KeeperhubClient(apiKey).verifyConnection();
    const data = { encryptedKey: encrypt(apiKey, userId), keyPrefix: apiKey.slice(0, 7), verifiedAt: new Date() };
    await prisma.keeperhubConnection.upsert({ where: { userId }, create: { userId, ...data }, update: data });
    return NextResponse.json({ connection: { keyPrefix: data.keyPrefix, verifiedAt: data.verifiedAt } });
  } catch { return NextResponse.json({ error: "Connection could not be verified or stored. Check the organization key and server encryption configuration." }, { status: 502 }); }
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await prisma.keeperhubConnection.deleteMany({ where: { userId: session.user.id } });
  return NextResponse.json({ disconnected: true, warning: "Existing KeeperHub schedules continue until disabled in KeeperHub. Revoke the key there to invalidate it." });
}
