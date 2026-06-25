import { ReactNode } from "react";
import Image from "next/image";

export default function OnboardingShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-(--color-bg-top)">
      <header className="flex h-(--header-height) items-center justify-center">
        <Image
          src="/logo.png"
          alt="BrainGenius.ai"
          height={56}
          width={200}
          loading="eager"
          className="h-[clamp(28px,3.9vw,56px)] w-auto"
        />
      </header>

      <div className="flex flex-1 items-center justify-center px-(--spacing-container) py-10">
        <div className="w-full max-w-2xl rounded-(--radius-2xl) bg-(--color-surface-strong) p-8 shadow-(--shadow-xl)">
          {children}
        </div>
      </div>
    </div>
  );
}
