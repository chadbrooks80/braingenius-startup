import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import prisma from "@/lib/db";
import { getAccountAccessRoute, REQUIRED_PASSWORD_RESET_ROUTE } from "@/lib/auth/account-access";
import RequiredPasswordResetForm from "./RequiredPasswordResetForm";

export default async function RequiredPasswordResetPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true, mustResetPassword: true, role: true, onboardingCompleted: true, onboardingStep: true },
  });

  if (!user) {
    redirect("/sign-in");
  }

  // Render only while the database still says a reset is required and the
  // account has a credentials password to verify against. Otherwise send the
  // account to its current authoritative destination -- this also prevents
  // the page from looping back to itself once the reset already completed.
  if (!user.mustResetPassword || !user.password) {
    const destination = getAccountAccessRoute(user);
    if (destination === REQUIRED_PASSWORD_RESET_ROUTE) {
      redirect("/sign-in");
    }
    redirect(destination);
  }

  return <RequiredPasswordResetForm />;
}
