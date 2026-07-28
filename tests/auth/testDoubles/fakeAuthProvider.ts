/**
 * Stands in for both `next-auth/providers/google` and
 * `next-auth/providers/credentials` in tests. Node's native ESM loader (used
 * by the `node --test` runner here, unlike Next.js's webpack bundler) does
 * not unwrap a CJS `exports.default` for a plain `import X from "..."`, so
 * importing the real provider factories directly under the test runner
 * fails before any test code runs. No test in this repository signs in
 * through Google or Credentials -- only `authOptions.callbacks.jwt` is
 * exercised directly -- so a shape-compatible stand-in is sufficient.
 */
export default function fakeAuthProvider(
  options: Record<string, unknown> = {}
): Record<string, unknown> {
  return { id: "fake-provider", type: "oauth", ...options };
}
