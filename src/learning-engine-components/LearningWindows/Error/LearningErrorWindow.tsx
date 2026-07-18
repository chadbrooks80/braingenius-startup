import Link from "next/link";
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
    <div className="flex-1 flex items-center justify-center p-6">
      <div
        className="w-full max-w-lg rounded-3xl p-8 border border-white/70 shadow-[0_16px_56px_var(--shadow-card)] text-center"
        style={{
          background: "var(--surface-strong)",
          backdropFilter: "blur(12px)",
        }}
      >
        <h1
          className="font-display text-2xl font-extrabold mb-3"
          style={{ color: "var(--navy)" }}
        >
          {title}
        </h1>
        <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
          {message}
        </p>
        <Link
          href={LEARNING_ROUTE_ERROR_HOME_PATH}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 text-white hover:-translate-y-0.5 hover:shadow-[0_6px_18px_var(--shadow-button-hover)]"
          style={{
            background: "var(--navy)",
            boxShadow: "0 2px 8px var(--shadow-button)",
          }}
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}

export default LearningErrorWindow;
