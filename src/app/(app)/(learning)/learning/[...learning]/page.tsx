import { redirect } from "next/navigation";
import { authorizeLearningModuleAccess } from "@/lib/auth/module-access";
import { LearningRouteClient } from "@/components/learning-engine/LearningRouteClient";
import { LearningModuleAccessUnavailable } from "@/components/learning-engine/LearningModuleAccessUnavailable";

type LearningPageProps = {
  params: Promise<{ learning: string[] }>;
};

/**
 * Server authorization boundary for `/learning/:module/:variables*`. Owns
 * resolving the requested module's access decision before any client
 * Learning Engine initialization; the narrow `LearningRouteClient` below
 * preserves the exact existing route-key remount, initialization, and
 * teardown behavior unchanged. An unregistered/malformed module is not an
 * access decision -- it renders the client host unchanged so the existing
 * Learning Engine module-not-found route error keeps its own ownership.
 */
export default async function LearningPage({ params }: LearningPageProps) {
  const { learning } = await params;
  const moduleName = learning[0];

  const access = await authorizeLearningModuleAccess(moduleName);

  if (access.status === "unauthenticated") {
    const requestedPath = `/learning/${learning.map(encodeURIComponent).join("/")}`;
    redirect(`/sign-in?${new URLSearchParams({ callbackUrl: requestedPath }).toString()}`);
  }

  if (access.status === "forbidden" || access.status === "unavailable") {
    return <LearningModuleAccessUnavailable />;
  }

  return <LearningRouteClient learning={learning} />;
}
