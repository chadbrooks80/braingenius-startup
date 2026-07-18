import type {
  ActionHandlers,
  ActionPayload,
  ActiveModule,
  LearningEngineInitializeResult,
  LearningEngineStateSetters,
} from "@/types/learning";
import { loadLearningModule } from "@/lib/learning-engine/initialization/loadLearningModule";
import { validateModuleSettings } from "@/lib/learning-engine/initialization/validateModuleSettings";
import { validateLearningEngineStateSetters } from "@/lib/learning-engine/validation/validateLearningEngineStateSetters";
import { createLearningEngineActionHandlers } from "@/lib/learning-engine/actions/createLearningEngineActionHandlers";
import { changeLearningEngineScreen } from "@/lib/learning-engine/screens/changeLearningEngineScreen";
import {
  LearningRouteError,
  getLearningRouteErrorPresentation,
} from "@/lib/learning-engine/errors/LearningRouteError";
import { logLearningRouteError } from "@/lib/learning-engine/errors/logLearningRouteError";

class LearningEngine {
  private activeModule: ActiveModule | null = null;
  private learningEngineStateSetters: LearningEngineStateSetters | null = null;
  private actionHandlers: ActionHandlers | null = null;

  async initialize(
    moduleName: string,
    moduleVariables: string[],
    learningEngineStateSetters: LearningEngineStateSetters,
    routePath: string,
    initializationSignal: AbortSignal
  ): Promise<LearningEngineInitializeResult> {
    validateLearningEngineStateSetters(learningEngineStateSetters);
    this.learningEngineStateSetters = learningEngineStateSetters;

    try {
      const { ModuleConstructor, settings } = await loadLearningModule(
        moduleName
      );

      validateModuleSettings(settings);

      if (initializationSignal.aborted) {
        return "stale";
      }

      learningEngineStateSetters.setShowHeader(settings.showHeader);
      learningEngineStateSetters.setShowSidebar(settings.showSidebar);

      this.activeModule = new ModuleConstructor(moduleVariables);
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
    setters.setShowSidebar(false);

    changeLearningEngineScreen(
      { windowName: "error", props: getLearningRouteErrorPresentation(error.code) },
      setters,
      (actionId, payload = {}) => this.action(actionId, payload)
    );
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
