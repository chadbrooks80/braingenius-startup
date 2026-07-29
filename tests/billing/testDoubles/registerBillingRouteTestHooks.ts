import { registerHooks } from "node:module";

let registered = false;

export function registerBillingRouteTestHooks(): void {
  if (registered) {
    return;
  }
  registered = true;

  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === "@/lib/stripe") {
        return {
          url: new URL("./fakeStripe.ts", import.meta.url).href,
          shortCircuit: true,
        };
      }
      if (specifier === "@/lib/billing/stripe-state") {
        return {
          url: new URL("./fakeStripeState.ts", import.meta.url).href,
          shortCircuit: true,
        };
      }
      return nextResolve(specifier, context);
    },
  });
}
