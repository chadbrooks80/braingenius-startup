import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import {
  synchronizeCheckoutForWebhook,
  synchronizeSubscriptionDeleted,
  synchronizeSubscriptionUpdated,
} from "@/lib/billing/stripe-state";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook is not configured" }, { status: 400 });
  }

  let stripe: ReturnType<typeof getStripe>;
  try {
    stripe = getStripe();
  } catch {
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await synchronizeCheckoutForWebhook(event.data.object.id);
        break;

      case "customer.subscription.updated":
        await synchronizeSubscriptionUpdated(event.data.object);
        break;

      case "customer.subscription.deleted":
        await synchronizeSubscriptionDeleted(event.data.object);
        break;

      default:
        break;
    }
  } catch {
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
