"use client";

import type { ModuleLayoutProps } from "@/types/learning";
import { VocabularyStatusPanel } from "@/learning-modules/vocabulary/module-panels/VocabularyStatusPanel";

export function ModuleLayout({ children }: ModuleLayoutProps) {
  return (
    <div className="flex flex-1">
      <VocabularyStatusPanel />
      {children}
    </div>
  );
}

export default ModuleLayout;
