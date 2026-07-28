import { registerHooks } from "node:module";

let registered = false;

/**
 * Redirects the bare `@/lib/db`, `@/lib/email`, and `next-auth` specifiers to
 * deterministic in-memory fakes for every subsequent import in this process,
 * including transitive imports made by the action/route files under test.
 * This keeps focused auth tests off Neon, Resend, and a real signed-in
 * request context without touching production code, using the same
 * `node:module` hook mechanism `tests/registerServerOnly.mjs` already relies
 * on -- no extra CLI flags or test-only exports required.
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
