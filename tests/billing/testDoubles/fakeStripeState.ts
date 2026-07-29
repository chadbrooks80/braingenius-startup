let calls: Array<{ operation: string; id: string }> = [];
let shouldFail = false;

export function __resetFakeStripeState(): void {
  calls = [];
  shouldFail = false;
}

export function __getStripeStateCalls(): ReadonlyArray<{
  operation: string;
  id: string;
}> {
  return calls;
}

export function __failNextStripeStateOperation(): void {
  shouldFail = true;
}

function record(operation: string, value: { id: string } | string): void {
  if (shouldFail) {
    shouldFail = false;
    throw new Error("simulated synchronization failure");
  }
  calls.push({ operation, id: typeof value === "string" ? value : value.id });
}

export async function synchronizeCheckoutForWebhook(id: string): Promise<void> {
  record("checkout", id);
}

export async function synchronizeSubscriptionUpdated(
  subscription: { id: string }
): Promise<void> {
  record("subscription.updated", subscription);
}

export async function synchronizeSubscriptionDeleted(
  subscription: { id: string }
): Promise<void> {
  record("subscription.deleted", subscription);
}
