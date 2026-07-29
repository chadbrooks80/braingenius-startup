import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

/**
 * The proxy makes no allow/deny or routing decision from JWT claims such as
 * `mustResetPassword` or onboarding state -- a stale token can't be trusted
 * to grant protected content, and it also can't be trusted to send a
 * database-required account away from the reset page, so a two-way redirect
 * built from it can loop against the database-authoritative pages underneath
 * (the shared (app) layout, /getting-started, and /required-password-reset
 * each re-read the database and redirect on their own). The only decision
 * left here is a pure UX shortcut for a fully anonymous request: send it to
 * sign-in immediately instead of waiting for the destination page to do it.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token && (pathname === "/dashboard" || pathname.startsWith("/dashboard/"))) {
    // Reuses the same `callbackUrl` contract the sign-in page already
    // sanitizes (`sanitizeReturnPath`), so an anonymous deep link returns
    // to the requested dashboard page after sign-in instead of a new,
    // unvalidated redirect contract.
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("callbackUrl", `${pathname}${req.nextUrl.search}`);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
