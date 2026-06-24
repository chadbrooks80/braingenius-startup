import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, planFromPriceId } from "@/lib/stripe";
import prisma from "@/lib/db";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook is not configured" }, { status: 400 });
  }

  const stripe = getStripe();
  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const checkoutSession = event.data.object as Stripe.Checkout.Session;
      const userId = checkoutSession.client_reference_id;
      if (!userId) break;

      // Delayed payment methods (e.g. bank debits) fire this event before funds clear.
      // Only grant the paid tier once Stripe confirms the payment actually succeeded.
      if (checkoutSession.payment_status !== "paid") break;

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) break;

      const lineItems = await stripe.checkout.sessions.listLineItems(checkoutSession.id);
      const priceId = lineItems.data[0]?.price?.id ?? null;
      const tier = planFromPriceId(priceId);

      await prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          tier: tier ?? undefined,
          stripeCustomerId:
            typeof checkoutSession.customer === "string" ? checkoutSession.customer : undefined,
          stripeSubscriptionId:
            typeof checkoutSession.subscription === "string"
              ? checkoutSession.subscription
              : undefined,
          stripePriceId: priceId ?? undefined,
          stripeStatus: checkoutSession.payment_status,
        },
        update: {
          tier: tier ?? undefined,
          stripeCustomerId:
            typeof checkoutSession.customer === "string" ? checkoutSession.customer : undefined,
          stripeSubscriptionId:
            typeof checkoutSession.subscription === "string"
              ? checkoutSession.subscription
              : undefined,
          stripePriceId: priceId ?? undefined,
          stripeStatus: checkoutSession.payment_status,
        },
      });
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const priceId = subscription.items.data[0]?.price?.id ?? null;
      const tier = planFromPriceId(priceId);
      const periodEndItem = subscription.items.data[0];

      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: {
          tier: event.type === "customer.subscription.deleted" ? "CANCELED" : tier ?? undefined,
          stripePriceId: priceId ?? undefined,
          stripeStatus: subscription.status,
          currentPeriodEnd: periodEndItem
            ? new Date(periodEndItem.current_period_end * 1000)
            : undefined,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        },
      });
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}