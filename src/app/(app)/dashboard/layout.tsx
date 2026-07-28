import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);

  // Independent server boundary for every current and future page nested
  // under /dashboard: the proxy already redirects anonymous requests before
  // they reach here, but this must reject a missing/invalid session on its
  // own so the route stays protected even if middleware routing changes.
  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  return <>{children}</>;
}
