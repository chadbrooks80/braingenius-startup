import { LEARNING_SUBSCRIPTION_TIERS, type ModuleSettings } from "@/types/learning";

const VALID_SUBSCRIPTION_TIERS = new Set<string>(LEARNING_SUBSCRIPTION_TIERS);

export function validateModuleSettings(settings: ModuleSettings): void {
  if (typeof settings.showHeader !== "boolean") {
    throw new Error("Invalid settings.json: showHeader must be a boolean.");
  }

  if (typeof settings.showSidebar !== "boolean") {
    throw new Error("Invalid settings.json: showSidebar must be a boolean.");
  }

  if (!Array.isArray(settings.subscriptionTier)) {
    throw new Error("Invalid settings.json: subscriptionTier must be an array.");
  }

  if (settings.subscriptionTier.length === 0) {
    throw new Error("Invalid settings.json: subscriptionTier must not be empty.");
  }

  const seen = new Set<string>();
  for (const tier of settings.subscriptionTier) {
    if (typeof tier !== "string" || !VALID_SUBSCRIPTION_TIERS.has(tier)) {
      throw new Error(`Invalid settings.json: unsupported subscriptionTier value "${String(tier)}".`);
    }
    if (seen.has(tier)) {
      throw new Error(`Invalid settings.json: duplicate subscriptionTier value "${tier}".`);
    }
    seen.add(tier);
  }
}
