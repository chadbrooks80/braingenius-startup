"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { getStripe, PRICE_ENV_BY_PLAN, type PaidPlan } from "@/lib/stripe";
import prisma from "@/lib/db";

export type CheckoutPlan = PaidPlan;

type CheckoutResult = { success: true; url: string } | { success: false; error: string };

export async function createCheckoutSession(plan: CheckoutPlan): Promise<CheckoutResult> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) {
    return { success: false, error: "You must be signed in to upgrade." };
  }

  const priceId = PRICE_ENV_BY_PLAN[plan];
  if (!priceId) {
    return { success: false, error: "Stripe is not configured for this plan yet." };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { subscription: true },
  });

  if (!user) {
    return { success: false, error: "Account not found." };
  }

  try {
    const stripe = getStripe();
    const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: plan === "MONTHLY" ? "subscription" : "payment",
      customer: user.subscription?.stripeCustomerId ?? undefined,
      customer_email: user.subscription?.stripeCustomerId ? undefined : user.email ?? undefined,
      client_reference_id: userId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/getting-started?checkout=success`,
      cancel_url: `${baseUrl}/getting-started?checkout=canceled`,
    });

    if (!checkoutSession.url) {
      return { success: false, error: "Could not start checkout. Please try again." };
    }

    return { success: true, url: checkoutSession.url };
  } catch {
    return { success: false, error: "Could not start checkout. Please try again." };
  }
}