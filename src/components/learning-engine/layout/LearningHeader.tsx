import Image from "next/image";

export function LearningHeader() {
  return (
    <header className="flex items-center justify-between px-6 py-3 sticky top-0 z-10 border-b border-surface/(--alpha-surface-soft) bg-surface/(--alpha-surface-strong) backdrop-blur-md shadow-[0_10px_35px] shadow-heading/(--alpha-hairline)">
      <Image
        src="/logo.png"
        alt="BrainGenius"
        width={1048}
        height={181}
        priority
        className="h-10 w-auto"
      />
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 bg-heading text-surface font-semibold text-xs px-4 py-2 rounded-full">
          ＋ New Word List
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full bg-secondary/(--alpha-subtle) border border-secondary/(--alpha-medium) text-secondary-strong">
          Calendar Progress
        </span>
        <span className="text-xs text-muted font-medium">Username</span>
        <span className="text-xs text-muted font-semibold px-3 py-2 rounded-full">
          Log out
        </span>
      </div>
    </header>
  );
}
