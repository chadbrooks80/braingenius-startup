import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

export async function proxy(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;
  const onboardingCompleted = Boolean(token.onboardingCompleted);

  if (pathname === "/getting-started" && onboardingCompleted) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (pathname.startsWith("/dashboard") && !onboardingCompleted) {
    return NextResponse.redirect(new URL("/getting-started", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/getting-started"],
};
