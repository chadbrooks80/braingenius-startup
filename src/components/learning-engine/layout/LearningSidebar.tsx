import { BOOK_EMOJI, PENCIL_EMOJI, TIMER_EMOJI, TROPHY_EMOJI } from "@/lib/emojis";

export function LearningSidebar() {
  return (
    <aside className="w-60 shrink-0 flex flex-col overflow-y-auto bg-surface/(--alpha-surface) backdrop-blur-md border-r border-surface/(--alpha-surface)">
      <div className="px-5 pt-4 pb-3 border-b border-heading/(--alpha-hairline)">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-xs">{TIMER_EMOJI}</span>
          <p className="font-display text-sm font-extrabold text-heading tracking-tight flex-1">
            Today&apos;s Practice
          </p>
        </div>

        <div className="h-1.5 rounded-full mb-3 overflow-hidden bg-heading/(--alpha-hairline)">
          <div className="h-full w-1/3 rounded-full bg-linear-to-r from-secondary to-primary" />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-muted font-medium">Remaining today</span>
            <span className="font-display text-sm font-extrabold text-heading">
              30:00
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-muted font-medium">Studied today</span>
            <span className="font-display text-sm font-extrabold text-heading">
              00:00
            </span>
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-heading/(--alpha-hairline)">
            <span className="text-[11px] text-muted font-medium">Days completed</span>
            <span className="font-display text-sm font-extrabold text-primary-strong">
              0
            </span>
          </div>
        </div>
      </div>

      <div className="px-5 pt-5 pb-3 border-b border-heading/(--alpha-hairline)">
        <p className="font-display text-sm font-extrabold text-heading tracking-tight">
          My Words
        </p>
      </div>

      <div className="mb-1">
        <div className="flex items-center gap-1.5 px-5 py-2.5 border-b border-heading/(--alpha-hairline)">
          <span className="text-xs">{BOOK_EMOJI}</span>
          <span className="font-display text-xs font-extrabold tracking-tight flex-1 text-heading">
            Word List
          </span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-heading/(--alpha-hairline) text-heading">
            0
          </span>
        </div>
        <p className="px-5 py-2 text-[11px] text-muted italic">All words advanced!</p>
      </div>

      <div className="mb-1">
        <div className="flex items-center gap-1.5 px-5 py-2.5 border-b border-heading/(--alpha-hairline)">
          <span className="text-xs">{PENCIL_EMOJI}</span>
          <span className="font-display text-xs font-extrabold tracking-tight flex-1 text-secondary-strong">
            Spelling
          </span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-secondary/(--alpha-soft) text-secondary-strong">
            0
          </span>
        </div>
        <p className="px-5 py-2 text-[11px] text-muted italic">None yet</p>
      </div>

      <div className="mb-1">
        <div className="flex items-center gap-1.5 px-5 py-2.5 border-b border-heading/(--alpha-hairline)">
          <span className="text-xs">{TROPHY_EMOJI}</span>
          <span className="font-display text-xs font-extrabold tracking-tight flex-1 text-primary-strong">
            Mastered
          </span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/(--alpha-subtle) text-primary-strong">
            0
          </span>
        </div>
        <p className="px-5 py-2 text-[11px] text-muted italic">None yet</p>
      </div>
    </aside>
  );
}
