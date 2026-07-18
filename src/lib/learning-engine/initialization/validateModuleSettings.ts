import type { ModuleSettings } from "@/types/learning";

export function validateModuleSettings(settings: ModuleSettings): void {
  if (typeof settings.showHeader !== "boolean") {
    throw new Error("Invalid settings.json: showHeader must be a boolean.");
  }

  if (typeof settings.showSidebar !== "boolean") {
    throw new Error("Invalid settings.json: showSidebar must be a boolean.");
  }
}
