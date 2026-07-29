import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import {
  MISSING_ACCOUNT_ROUTE,
  REQUIRED_PASSWORD_RESET_ROUTE,
  resolveSessionAccountAccess,
} from "@/lib/auth/account-access";

/**
 * Database-authoritative account gate shared by every route under (app) --
 * dashboard and the learning route group both nest under this layout, so it
 * runs before either. Account existence is checked explicitly rather than
 * left as a side effect of reading `mustResetPassword`: a session whose user
 * row is missing (a deleted account riding a stale JWT) fails closed to
 * sign-in instead of falling through to render protected content, and a
 * reset-required account can never reach dashboard or authenticated learning
 * content even with a stale JWT claiming otherwise. Anonymous requests are
 * left untouched: public learning routes stay public here, and
 * /dashboard's own layout still independently requires a session.
 */
export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (userId) {
    const access = await resolveSessionAccountAccess(userId);

    if (access.status === "missing-account") {
      redirect(MISSING_ACCOUNT_ROUTE);
    }

    if (access.destination === REQUIRED_PASSWORD_RESET_ROUTE) {
      redirect(REQUIRED_PASSWORD_RESET_ROUTE);
    }
  }

  return <>{children}</>;
}
