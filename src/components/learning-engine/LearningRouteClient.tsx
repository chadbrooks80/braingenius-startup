"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ScreenRenderer } from "@/components/learning-engine/ScreenRenderer";
import { LearningHeader } from "@/components/learning-engine/layout/LearningHeader";
import { LearningSidebar } from "@/components/learning-engine/layout/LearningSidebar";
import { SpeechPlaybackFailureBanner } from "@/components/learning-engine/SpeechPlaybackFailureBanner";
import LearningEngine from "@/lib/learning-engine/LearningEngine";
import { cancelSpeech } from "@/lib/learning-engine/speech/speechPlaybackService";
import type {
  ActiveScreen,
  AnswerFeedback,
  SpeechFailureNotice,
} from "@/types/learning";

export type LearningRouteClientProps = {
  learning: string[];
};

export function LearningRouteClient({ learning }: LearningRouteClientProps) {
  const routeKey = learning.join("/");

  return (
    <LearningRoute key={routeKey} learning={learning} routeKey={routeKey} />
  );
}

export default LearningRouteClient;

type LearningRouteProps = {
  learning: string[];
  routeKey: string;
};

function LearningRoute({ learning, routeKey }: LearningRouteProps) {
  const [activeScreen, setActiveScreen] = useState<ActiveScreen | null>(
    null
  );
  const [showHeader, setShowHeader] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [answerFeedback, setAnswerFeedback] = useState<AnswerFeedback | null>(
    null
  );
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechFailureNotice, setSpeechFailureNotice] =
    useState<SpeechFailureNotice | null>(null);
  const learningEngineRef = useRef<LearningEngine | null>(null);

  const dismissSpeechFailureNotice = useCallback((requestId: number) => {
    // A stale timer or stale X callback must never dismiss a newer notice.
    setSpeechFailureNotice((current) =>
      current && current.requestId === requestId ? null : current
    );
  }, []);

  useEffect(() => {
    const [moduleName, ...moduleVariables] = learning;
    const routePath = `/learning/${learning.join("/")}`;
    const initializationController = new AbortController();

    async function initializeLearningEngine() {
      const learningEngine = new LearningEngine();
      learningEngineRef.current = learningEngine;

      const result = await learningEngine.initialize(
        moduleName,
        moduleVariables,
        {
          setActiveScreen,
          setShowHeader,
          setShowSidebar,
          setAnswerFeedback,
          setIsSpeaking,
          setSpeechFailureNotice,
        },
        routePath,
        initializationController.signal
      );

      // A slower initialize() can resolve after this route has already been
      // torn down (fast navigation); its speech/screen side effects must not
      // run against a singleton speech service no longer owned by any route.
      if (initializationController.signal.aborted) {
        return;
      }

      if (result === "ready") {
        learningEngine.showStartupScreen();
      }
    }

    initializeLearningEngine();

    return () => {
      initializationController.abort();
      cancelSpeech();
    };
    // Only routeKey should retrigger initialization: the state setters are stable,
    // and moduleName/moduleVariables are derived from learning, which changes in lockstep with routeKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  if (!activeScreen) {
    return null;
  }

  return (
    <>
      {speechFailureNotice && (
        <SpeechPlaybackFailureBanner
          requestId={speechFailureNotice.requestId}
          onDismiss={dismissSpeechFailureNotice}
        />
      )}
      {showHeader && <LearningHeader />}
      <div className="flex flex-1">
        {showSidebar && <LearningSidebar />}
        <ScreenRenderer
          screen={activeScreen}
          answerFeedback={answerFeedback}
          isSpeaking={isSpeaking}
        />
      </div>
    </>
  );
}
