import type {
  LearningModuleConstructor,
  ModuleSettings,
} from "@/types/learning";
import { createLearningModuleNotFoundError } from "@/lib/learning-engine/errors/learningEngineRouteErrors";

type LearningModuleImport = {
  ModuleConstructor: LearningModuleConstructor;
  settings: ModuleSettings;
};

// Single source of truth for registered modules' settings, shared by the
// full module loader below and by `loadLearningModuleSettings` (used by the
// server-only Learning Module access boundary, which must validate a
// module's allowed subscription tiers without importing its client-facing
// module implementation).
const SUPPORTED_LEARNING_MODULE_SETTINGS_LOADERS: Record<
  string,
  () => Promise<ModuleSettings>
> = {
  vocabulary: async () => {
    const importedSettings = await import(
      "@/learning-modules/vocabulary/settings.json"
    );
    return importedSettings.default as ModuleSettings;
  },
};

const SUPPORTED_LEARNING_MODULE_LOADERS: Record<
  string,
  () => Promise<LearningModuleImport>
> = {
  vocabulary: async () => {
    const importedModule = await import("@/learning-modules/vocabulary");
    const settings = await SUPPORTED_LEARNING_MODULE_SETTINGS_LOADERS.vocabulary();

    return {
      ModuleConstructor:
        importedModule.default as LearningModuleConstructor,
      settings,
    };
  },
};

export async function loadLearningModule(
  moduleName: string
): Promise<LearningModuleImport> {
  const loadModule = SUPPORTED_LEARNING_MODULE_LOADERS[moduleName];

  if (!loadModule) {
    throw createLearningModuleNotFoundError(moduleName);
  }

  return loadModule();
}

export async function loadLearningModuleSettings(
  moduleName: string
): Promise<ModuleSettings> {
  const loadSettings = SUPPORTED_LEARNING_MODULE_SETTINGS_LOADERS[moduleName];

  if (!loadSettings) {
    throw createLearningModuleNotFoundError(moduleName);
  }

  return loadSettings();
}
