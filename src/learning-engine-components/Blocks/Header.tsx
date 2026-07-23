import Image from "next/image";

export function Header() {
  return (
    <header className="flex items-center justify-between px-6 py-3 sticky top-0 z-10 border-b border-surface/48 bg-surface/85 backdrop-blur-md shadow-[0_10px_35px] shadow-heading/7">
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
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full bg-secondary/13 border border-secondary/34 text-secondary-strong">
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
