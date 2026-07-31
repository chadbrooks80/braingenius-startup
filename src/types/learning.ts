import type { ComponentType, ElementType, ReactNode } from "react";
import type { LearningWindowName } from "@/lib/learning-engine/LearningWindowRegistry";

// Client-safe, dependency-free Learning Module access tiers. Deliberately
// excludes `CANCELED`: that is a database subscription-lifecycle value, not
// a grantable module-access tier. Centralized here so settings validation,
// route/API access comparison, and tests share one source instead of
// scattering independent tier lists.
export const LEARNING_SUBSCRIPTION_TIERS = [
  "FREE_TRIAL",
  "MONTHLY",
  "LIFETIME",
  "ADMIN",
] as const;

export type LearningSubscriptionTier = (typeof LEARNING_SUBSCRIPTION_TIERS)[number];

export type ModuleSettings = {
  showHeader: boolean;
  subscriptionTier: LearningSubscriptionTier[];
};

// Subject-neutral module-owned placement boundary: a module's ModuleLayout
// receives only the engine-provided learning window as children and controls
// where its own panels sit around it. The engine must not add subject fields
// here.
export type ModuleLayoutProps = {
  children: ReactNode;
};

export type ModuleLayoutComponent = ComponentType<ModuleLayoutProps>;

export type StartupButtonVariant = "primary" | "secondary" | "ghost";

export type StartupButtonConfig = {
  id: string;
  actionId: string;
  label: string;
  variant: StartupButtonVariant;
  trailingIcon?: string;
  helperText?: string;
};

export type StartupScreenData = {
  contentPanel: ReactNode;
  visualPanel: ReactNode;
  actionPanel: {
    buttons: StartupButtonConfig[];
  };
};

export type ActiveScreen = {
  WindowComponent: ElementType;
  props: Record<string, unknown>;
};

export type AnswerFeedback =
  | { correctChoiceId: string }
  | { correct: true }
  | { correct: false; correctAnswer: string };

export type SpeechFailureNotice = {
  readonly requestId: number;
};

export type LearningEngineStateSetters = {
  setActiveScreen: (screen: ActiveScreen) => void;
  setShowHeader: (show: boolean) => void;
  setModuleLayout: (ModuleLayout: ModuleLayoutComponent | null) => void;
  setAnswerFeedback: (answerFeedback: AnswerFeedback | null) => void;
  setIsSpeaking: (isSpeaking: boolean) => void;
  setSpeechFailureNotice: (notice: SpeechFailureNotice | null) => void;
};

export type LearningEngineInitializeResult = "ready" | "route-error" | "stale";

export type ActionPayload = Record<string, unknown>;

export type OnAction = (
  actionId: string,
  payload?: ActionPayload
) => void | Promise<void>;

export type ScreenRequest = {
  windowName: LearningWindowName;
  props: Record<string, unknown>;
  speak?: DeclarativeSpeechRequest;
};

export type ActionHandlers = Record<
  string,
  (
    payload: ActionPayload
  ) => ScreenRequest | void | Promise<ScreenRequest | void>
>;

export type ActiveModule = {
  initialize(): Promise<void>;
  getStartupProps(): StartupScreenData;
  next(): ScreenRequest | void | Promise<ScreenRequest | void>;
  submitAnswer(payload: ActionPayload): Promise<AnswerFeedback>;
};

export type LearningModuleConstructor = new (
  moduleVariables: string[]
) => ActiveModule;

export type GoogleTtsConfiguration = {
  provider: "google";
  model: string;
  voice: string;
  languageCode: string;
};

export type LemonfoxTtsConfiguration = {
  provider: "lemonfox";
  voice: string;
};

export type TtsConfiguration = GoogleTtsConfiguration | LemonfoxTtsConfiguration;

export type SpeechSourceReference = {
  endpoint: string;
  reference: string;
};

export type SpeakActionPayload =
  | {
      text: string | string[];
      tts: TtsConfiguration;
    }
  | {
      source: SpeechSourceReference;
    };

export type DeclarativeSpeechRequest = SpeakActionPayload;
