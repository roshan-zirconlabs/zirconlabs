import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
export async function POST() {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.APP_URL || !process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: "Billing is not configured." }, { status: 503 });
  const sub = await prisma.subscription.findUnique({ where: { userId: session.user.id } });
  if (!sub?.stripeCustomerId) return NextResponse.json({ error: "No billing account exists yet." }, { status: 404 });
  try {
    const portal = await stripe.billingPortal.sessions.create({ customer: sub.stripeCustomerId, return_url: process.env.APP_URL.replace(/\/$/, "") + "/billing" });
    return NextResponse.json({ url: portal.url });
  } catch { return NextResponse.json({ error: "Billing portal unavailable. Retry shortly." }, { status: 502 }); }
}
