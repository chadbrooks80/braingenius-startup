import { registerHooks } from "node:module";

let registered = false;

/**
 * Redirects protected provider/database boundaries to deterministic in-memory
 * fakes for every subsequent import in this process, including transitive
 * imports made by the action/route files under test.
 */
export function registerAuthTestHooks(): void {
  if (registered) {
    return;
  }
  registered = true;

  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === "@/lib/db") {
        return { url: new URL("./fakeDb.ts", import.meta.url).href, shortCircuit: true };
      }
      if (specifier === "@/lib/email") {
        return { url: new URL("./fakeEmail.ts", import.meta.url).href, shortCircuit: true };
      }
      if (specifier === "@/lib/billing/stripe-state") {
        return { url: new URL("./fakeBilling.ts", import.meta.url).href, shortCircuit: true };
      }
      if (specifier === "next-auth") {
        return { url: new URL("./fakeNextAuth.ts", import.meta.url).href, shortCircuit: true };
      }
      if (specifier === "next-auth/providers/google" || specifier === "next-auth/providers/credentials") {
        return { url: new URL("./fakeAuthProvider.ts", import.meta.url).href, shortCircuit: true };
      }
      return nextResolve(specifier, context);
    },
  });
}
