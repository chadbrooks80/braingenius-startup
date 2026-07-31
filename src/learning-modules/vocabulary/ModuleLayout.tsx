"use client";

import type { ModuleLayoutProps } from "@/types/learning";
import { VocabularyStatusPanel } from "@/learning-modules/vocabulary/module-panels/VocabularyStatusPanel";

export function ModuleLayout({
  children,
  registerModulePanelSetters,
}: ModuleLayoutProps) {
  return (
    <div className="flex flex-1">
      <VocabularyStatusPanel registerModulePanelSetters={registerModulePanelSetters} />
      {children}
    </div>
  );
}

export default ModuleLayout;
