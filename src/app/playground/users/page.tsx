import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import {
  MISSING_ACCOUNT_ROUTE,
  REQUIRED_PASSWORD_RESET_ROUTE,
  resolveSessionAccountAccess,
} from "@/lib/auth/account-access";
import SignInOut from './signInOut';

const UsersPage = async () => {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/sign-in?callbackUrl=%2Fplayground%2Fusers");
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
      <SignInOut />
    </div>
  )
}

export default UsersPage;
