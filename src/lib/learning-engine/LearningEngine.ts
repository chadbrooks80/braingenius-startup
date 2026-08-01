import type {
  ActionHandlers,
  ActionPayload,
  ActiveModule,
  LearningEngineInitializeResult,
  LearningEngineStateSetters,
  LearningModuleRuntime,
  ModulePanelRegistration,
} from "@/types/learning";
import { loadLearningModule } from "@/lib/learning-engine/initialization/loadLearningModule";
import { validateModuleSettings } from "@/lib/learning-engine/initialization/validateModuleSettings";
import { validateLearningEngineStateSetters } from "@/lib/learning-engine/validation/validateLearningEngineStateSetters";
import { createLearningEngineActionHandlers } from "@/lib/learning-engine/actions/createLearningEngineActionHandlers";
import { changeLearningEngineScreen } from "@/lib/learning-engine/screens/changeLearningEngineScreen";
import { LearningRouteError } from "@/lib/learning-engine/errors/LearningRouteError";
import { logLearningRouteError } from "@/lib/learning-engine/errors/logLearningRouteError";

// Narrow callable shape for one opaque registered panel setter, used only at
// the point of invocation so calling it never requires the bare `Function`
// type.
type ModulePanelSetter = (value: unknown) => void;

// Builds the one narrow, subject-neutral runtime object a module receives at
// construction time. Exported so its shape (exactly `runPanelSetter`, frozen)
// is directly testable without depending on module loading.
export function createLearningModuleRuntime(
  runPanelSetter: (setterName: string, value: unknown) => void
): LearningModuleRuntime {
  return Object.freeze({ runPanelSetter });
}

class LearningEngine {
  private activeModule: ActiveModule | null = null;
  private learningEngineStateSetters: LearningEngineStateSetters | null = null;
  private actionHandlers: ActionHandlers | null = null;
  private modulePanelSetters: ModulePanelRegistration | null = null;
  private modulePanelSettersToken = 0;
  // Latest route-local value published per setter name, kept so a module
  // publication made before its panel registers is not lost, and so a
  // replacement/remounted panel can reconstruct its current display.
  private modulePanelSetterValues: Map<string, unknown> = new Map();

  async initialize(
    moduleName: string,
    moduleVariables: string[],
    learningEngineStateSetters: LearningEngineStateSetters,
    routePath: string,
    initializationSignal: AbortSignal
  ): Promise<LearningEngineInitializeResult> {
    validateLearningEngineStateSetters(learningEngineStateSetters);
    this.learningEngineStateSetters = learningEngineStateSetters;

    // A fresh module/route must never see a previous module's registered
    // panel setters or retained panel values.
    this.modulePanelSetters = null;
    this.modulePanelSettersToken++;
    this.modulePanelSetterValues = new Map();

    try {
      const { ModuleConstructor, settings, ModuleLayout } = await loadLearningModule(
        moduleName
      );

      validateModuleSettings(settings);

      if (initializationSignal.aborted) {
        return "stale";
      }

      learningEngineStateSetters.setShowHeader(settings.showHeader);
      learningEngineStateSetters.setModuleLayout(ModuleLayout);

      const runtime = createLearningModuleRuntime((setterName, value) => {
        this.runModulePanelSetter(setterName, value);
      });

      this.activeModule = new ModuleConstructor(moduleVariables, runtime);
      await this.activeModule.initialize();

      if (initializationSignal.aborted) {
        return "stale";
      }
    } catch (error) {
      if (error instanceof LearningRouteError) {
        if (initializationSignal.aborted) {
          return "stale";
        }

        this.showLearningRouteError(
          error,
          moduleName,
          moduleVariables,
          routePath
        );

        return "route-error";
      }

      throw error;
    }

    this.actionHandlers = createLearningEngineActionHandlers({
      getActiveModule: () => this.requireActiveModule(),
      getLearningEngineStateSetters: () =>
        this.requireLearningEngineStateSetters(),
    });

    return "ready";
  }

  private showLearningRouteError(
    error: LearningRouteError,
    moduleName: string,
    moduleVariables: string[],
    routePath: string
  ): void {
    logLearningRouteError(error, moduleName, moduleVariables, routePath);

    const setters = this.requireLearningEngineStateSetters();

    setters.setShowHeader(false);
    setters.setModuleLayout(null);

    changeLearningEngineScreen(
      { windowName: "error", props: error.presentation },
      setters,
      (actionId, payload = {}) => this.action(actionId, payload)
    );
  }

  // Generic current-module-panel registration bridge: stores exactly one
  // opaque setter object per active panel without ever inspecting its keys.
  // The returned disposer is tied to the token issued at registration time,
  // so an old (e.g. Strict Mode) cleanup can never erase a newer
  // registration that has since replaced it.
  registerModulePanelSetters(
    setters: ModulePanelRegistration
  ): () => void {
    const token = ++this.modulePanelSettersToken;
    this.modulePanelSetters = setters;

    // Replay every retained latest value so a panel that registers after the
    // module already published (or a replacement panel remounting) starts
    // from the module's current values instead of blank state.
    for (const [setterName, value] of this.modulePanelSetterValues) {
      this.invokeModulePanelSetter(setters, setterName, value);
    }

    return () => {
      if (this.modulePanelSettersToken === token) {
        this.modulePanelSetters = null;
      }
    };
  }

  // Generic module-to-engine panel bridge: records the latest route-local
  // value per setter name so an early call (before the panel registers) is
  // never lost, then invokes the matching registered setter immediately when
  // one is already present.
  private runModulePanelSetter(setterName: string, value: unknown): void {
    this.modulePanelSetterValues.set(setterName, value);

    if (!this.modulePanelSetters) {
      return;
    }

    this.invokeModulePanelSetter(this.modulePanelSetters, setterName, value);
  }

  private invokeModulePanelSetter(
    setters: ModulePanelRegistration,
    setterName: string,
    value: unknown
  ): void {
    const setter = setters[setterName];

    if (typeof setter !== "function") {
      throw new Error(
        `No registered module panel setter named "${setterName}".`
      );
    }

    (setter as ModulePanelSetter)(value);
  }

  getModulePanelSetters(): ModulePanelRegistration | null {
    return this.modulePanelSetters;
  }

  showStartupScreen() {
    const activeModule = this.requireActiveModule();
    const setters = this.requireLearningEngineStateSetters();

    const startupProps = activeModule.getStartupProps();

    changeLearningEngineScreen(
      { windowName: "startup", props: startupProps },
      setters,
      (actionId, payload = {}) => this.action(actionId, payload)
    );
  }

  async action(actionId: string, payload: ActionPayload = {}): Promise<void> {
    const actionHandler = this.requireActionHandlers()[actionId];

    if (!actionHandler) {
      throw new Error(`Unsupported action: ${actionId}`);
    }

    const screenRequest = await actionHandler(payload);

    if (screenRequest) {
      changeLearningEngineScreen(
        screenRequest,
        this.requireLearningEngineStateSetters(),
        (actionId, payload = {}) => this.action(actionId, payload)
      );
    }
  }

  private requireActiveModule(): ActiveModule {
    if (!this.activeModule) {
      throw new Error("LearningEngine has not been initialized.");
    }

    return this.activeModule;
  }

  private requireActionHandlers(): ActionHandlers {
    if (!this.actionHandlers) {
      throw new Error("No action handlers have been registered.");
    }

    return this.actionHandlers;
  }

  private requireLearningEngineStateSetters(): LearningEngineStateSetters {
    if (!this.learningEngineStateSetters) {
      throw new Error("No Learning Engine state setters have been registered.");
    }

    return this.learningEngineStateSetters;
  }
}

export default LearningEngine;
