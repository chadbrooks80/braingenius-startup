import type { ElementType, ReactNode } from "react";
import type { LearningWindowName } from "@/lib/learning-engine/LearningWindowRegistry";

export type ModuleSettings = {
  showHeader: boolean;
  showSidebar: boolean;
};

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

export type LearningEngineStateSetters = {
  setActiveScreen: (screen: ActiveScreen) => void;
  setShowHeader: (show: boolean) => void;
  setShowSidebar: (show: boolean) => void;
  setAnswerFeedback: (answerFeedback: AnswerFeedback | null) => void;
  setIsSpeaking: (isSpeaking: boolean) => void;
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
