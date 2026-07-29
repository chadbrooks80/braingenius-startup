import type { CheckoutConfirmationResult } from "../../../src/lib/billing/stripe-state";

let confirmationResult: CheckoutConfirmationResult = { status: "rejected" };
let confirmationCalls: Array<{ checkoutSessionId: string; userId: string }> = [];

export function __resetFakeBilling(): void {
  confirmationResult = { status: "rejected" };
  confirmationCalls = [];
}

export function __setCheckoutConfirmationResult(
  result: CheckoutConfirmationResult
): void {
  confirmationResult = result;
}

export function __getCheckoutConfirmationCalls(): ReadonlyArray<{
  checkoutSessionId: string;
  userId: string;
}> {
  return confirmationCalls;
}

export async function confirmPaidCheckoutForUser(input: {
  checkoutSessionId: string;
  userId: string;
}): Promise<CheckoutConfirmationResult> {
  confirmationCalls.push(input);
  return confirmationResult;
}
