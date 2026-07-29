"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { getStripe, PRICE_ENV_BY_PLAN, type PaidPlan } from "@/lib/stripe";
import prisma from "@/lib/db";
import { resolveAppBaseUrl } from "@/lib/app-base-url";

export type CheckoutPlan = PaidPlan;

type CheckoutResult = { success: true; url: string } | { success: false; error: string };

export async function createCheckoutSession(plan: CheckoutPlan): Promise<CheckoutResult> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return { success: false, error: "You must be signed in to upgrade." };
  }

  if (plan !== "MONTHLY" && plan !== "LIFETIME") {
    return { success: false, error: "Could not start checkout. Please try again." };
  }

  const priceId = PRICE_ENV_BY_PLAN[plan];
  if (!priceId) {
    return { success: false, error: "Stripe is not configured for this plan yet." };
  }

  const baseUrl = resolveAppBaseUrl();
  if (!baseUrl) {
    return { success: false, error: "Could not start checkout. Please try again." };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { subscription: true },
  });

  if (!user) {
    return { success: false, error: "Account not found." };
  }

  // A reset-required account must complete its required password change
  // before it can reach paid checkout -- this is a direct Server Action
  // call, not a hidden UI route, so it must be denied here independently of
  // the shared (app) layout gate.
  if (user.mustResetPassword) {
    return { success: false, error: "You must reset your password before continuing." };
  }

  try {
    const stripe = getStripe();
    const existingCustomerId = user.subscription?.stripeCustomerId ?? null;

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: plan === "MONTHLY" ? "subscription" : "payment",
      customer: existingCustomerId ?? undefined,
      customer_email: existingCustomerId ? undefined : user.email ?? undefined,
      customer_creation:
        plan === "LIFETIME" && !existingCustomerId ? "always" : undefined,
      client_reference_id: userId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/getting-started?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
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
