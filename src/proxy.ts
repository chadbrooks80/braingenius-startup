import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { OnboardingStep } from "@/generated/prisma";
import { getOnboardingRoute } from "@/lib/onboarding-funnel";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
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

  const targetRoute = getOnboardingRoute({
    onboardingCompleted: Boolean(token.onboardingCompleted),
    onboardingStep: token.onboardingStep ?? OnboardingStep.VERIFY_EMAIL,
  });

  if (pathname === "/getting-started" && targetRoute !== "/getting-started") {
    return NextResponse.redirect(new URL(targetRoute, req.url));
  }

  if (pathname.startsWith("/dashboard") && targetRoute !== "/dashboard") {
    return NextResponse.redirect(new URL(targetRoute, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/getting-started"],
};
