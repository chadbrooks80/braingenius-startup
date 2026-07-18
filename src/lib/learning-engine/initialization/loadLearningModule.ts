import type {
  LearningModuleConstructor,
  ModuleSettings,
} from "@/types/learning";
import { LearningRouteError } from "@/lib/learning-engine/errors/LearningRouteError";

type LearningModuleImport = {
  ModuleConstructor: LearningModuleConstructor;
  settings: ModuleSettings;
};

const SUPPORTED_LEARNING_MODULE_LOADERS: Record<
  string,
  () => Promise<LearningModuleImport>
> = {
  vocabulary: async () => {
    const importedModule = await import("@/learning-modules/vocabulary");
    const importedSettings = await import(
      "@/learning-modules/vocabulary/settings.json"
    );

    return {
      ModuleConstructor:
        importedModule.default as LearningModuleConstructor,
      settings: importedSettings.default as ModuleSettings,
    };
  },
};

export async function loadLearningModule(
  moduleName: string
): Promise<LearningModuleImport> {
  const loadModule = SUPPORTED_LEARNING_MODULE_LOADERS[moduleName];

  if (!loadModule) {
    throw new LearningRouteError(
      "LEARNING_MODULE_NOT_FOUND",
      `Unknown learning module requested: ${moduleName}`
    );
  }

  return loadModule();
}
