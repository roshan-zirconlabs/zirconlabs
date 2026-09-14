import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, PLANS } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  if (!process.env.STRIPE_WEBHOOK_SECRET || !process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: "Billing not configured" }, { status: 503 });
  let event: Stripe.Event;
  try { event = stripe.webhooks.constructEvent(await req.text(), signature || "", process.env.STRIPE_WEBHOOK_SECRET); }
  catch { return NextResponse.json({ error: "Invalid signature" }, { status: 400 }); }
  let subscriptionId: string | null = null;
  if (event.type === "checkout.session.completed") {
    const value = event.data.object.subscription;
    subscriptionId = typeof value === "string" ? value : value?.id || null;
  } else if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
    subscriptionId = (event.data.object as Stripe.Subscription).id;
  }
  if (!subscriptionId) return NextResponse.json({ received: true });
  try {
    // Retrieve current state; never trust stale webhook ordering to grant a plan.
    const current = await stripe.subscriptions.retrieve(subscriptionId);
    const customerId = typeof current.customer === "string" ? current.customer : current.customer.id;
    const record = await prisma.subscription.findUnique({ where: { stripeCustomerId: customerId } });
    if (!record) return NextResponse.json({ received: true });
    const item = current.items.data[0];
    const entitled = current.status === "active" || current.status === "trialing";
    const plan = entitled && item?.price.id === PLANS.PRO.priceId ? "PRO" : entitled && item?.price.id === PLANS.ENTERPRISE.priceId ? "ENTERPRISE" : "FREE";
    await prisma.subscription.update({ where: { id: record.id }, data: {
      plan, stripeSubscriptionId: current.id, stripePriceId: item?.price.id ?? null,
      status: entitled ? "ACTIVE" : current.status === "past_due" ? "PAST_DUE" : current.status === "incomplete" ? "INCOMPLETE" : "CANCELED",
      cancelAtPeriodEnd: current.cancel_at_period_end,
      currentPeriodStart: item ? new Date(item.current_period_start * 1000) : null,
      currentPeriodEnd: item ? new Date(item.current_period_end * 1000) : null,
    } });
    return NextResponse.json({ received: true });
  } catch { return NextResponse.json({ error: "Billing synchronization failed. Retry delivery." }, { status: 500 }); }
}
