import Link from "next/link";
import { LearningWindowShell } from "@/learning-engine-components/UI/LearningWindowShell";
import { LEARNING_ROUTE_ERROR_HOME_PATH } from "@/lib/learning-engine/errors/LearningRouteError";

export type LearningErrorWindowProps = {
  title: string;
  message: string;
};

export function LearningErrorWindow({
  title,
  message,
}: LearningErrorWindowProps) {
  return (
    <LearningWindowShell align="center">
      <h1 className="font-display text-2xl font-extrabold mb-3 text-heading">
        {title}
      </h1>
      <p className="text-sm mb-6 text-muted">
        {message}
      </p>
      <Link
        href={LEARNING_ROUTE_ERROR_HOME_PATH}
        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 text-surface bg-heading shadow-[0_2px_8px] shadow-heading/(--alpha-soft) hover:-translate-y-0.5 hover:shadow-[0_6px_18px]"
      >
        Return Home
      </Link>
    </LearningWindowShell>
  );
}

export default LearningErrorWindow;
