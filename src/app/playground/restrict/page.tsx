import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { redirect } from "next/navigation";
import {
  MISSING_ACCOUNT_ROUTE,
  REQUIRED_PASSWORD_RESET_ROUTE,
  resolveSessionAccountAccess,
} from "@/lib/auth/account-access";

export default async function RestrictedPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/sign-in");
  }

  const access = await resolveSessionAccountAccess(userId);

  if (access.status === "missing-account") {
    redirect(MISSING_ACCOUNT_ROUTE);
  }

  if (access.destination === REQUIRED_PASSWORD_RESET_ROUTE) {
    redirect(REQUIRED_PASSWORD_RESET_ROUTE);
  }

  return (
    <div>
      <p>You are on a restricted page.</p>
    </div>
  );
}
