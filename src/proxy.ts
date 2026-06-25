import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { OnboardingStep } from "@/generated/prisma";
import { getOnboardingRoute } from "@/lib/onboarding-funnel";

export async function proxy(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;
  const targetRoute = getOnboardingRoute({
    onboardingCompleted: Boolean(token.onboardingCompleted),
    onboardingStep: (token.onboardingStep as OnboardingStep) ?? OnboardingStep.VERIFY_EMAIL,
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
