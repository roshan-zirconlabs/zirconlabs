import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe, PLANS } from "@/lib/stripe";
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const plan: "PRO" | "ENTERPRISE" | undefined = body?.plan === "PRO" || body?.plan === "ENTERPRISE" ? body.plan : undefined;
  if (plan !== "PRO" && plan !== "ENTERPRISE") return NextResponse.json({ error: "Choose a paid plan." }, { status: 400 });
  const priceId = PLANS[plan].priceId;
  const appUrl = process.env.APP_URL;
  if (!priceId || !appUrl || !process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: "Billing is not configured on this deployment." }, { status: 503 });
  try {
    let sub = await prisma.subscription.upsert({ where: { userId: session.user.id }, create: { userId: session.user.id }, update: {} });
    if (!sub.stripeCustomerId) {
      const customer = await stripe.customers.create({ email: session.user.email || undefined, metadata: { userId: session.user.id } }, { idempotencyKey: "customer-" + session.user.id });
      sub = await prisma.subscription.update({ where: { userId: session.user.id }, data: { stripeCustomerId: customer.id } });
    }
    const customerId = sub.stripeCustomerId!;
    const existing = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 });
    if (existing.data.some(s => !["canceled", "incomplete_expired"].includes(s.status))) return NextResponse.json({ error: "A subscription already exists. Use Manage billing to change or cancel it." }, { status: 409 });
    const checkout = await stripe.checkout.sessions.create({ customer: customerId, mode: "subscription", line_items: [{ price: priceId, quantity: 1 }], success_url: appUrl.replace(/\/$/, "") + "/billing?success=true", cancel_url: appUrl.replace(/\/$/, "") + "/billing?canceled=true", subscription_data: { metadata: { userId: session.user.id } } }, { idempotencyKey: "checkout-" + session.user.id + "-" + plan + "-" + Math.floor(Date.now() / 300000) });
    return NextResponse.json({ url: checkout.url });
  } catch { return NextResponse.json({ error: "Stripe checkout is unavailable. No plan was changed. Retry or use Manage billing." }, { status: 502 }); }
}
