"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { ScreenRenderer } from "@/learning-engine-components/Blocks/ScreenRenderer";
import { Header } from "@/learning-engine-components/Blocks/Header";
import { Sidebar } from "@/learning-engine-components/Blocks/Sidebar";
import LearningEngine from "@/lib/learning-engine/LearningEngine";
import { cancelSpeech } from "@/lib/learning-engine/speech/speechPlaybackService";
import type { ActiveScreen, AnswerFeedback } from "@/types/learning";

export default function LearningPage() {
  const { learning } = useParams<{ learning: string[] }>();
  const routeKey = learning.join("/");

  return (
    <LearningRoute key={routeKey} learning={learning} routeKey={routeKey} />
  );
}

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
  const learningEngineRef = useRef<LearningEngine | null>(null);

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
      {showHeader && <Header />}
      <div className="flex flex-1">
        {showSidebar && <Sidebar />}
        <ScreenRenderer
          screen={activeScreen}
          answerFeedback={answerFeedback}
          isSpeaking={isSpeaking}
        />
      </div>
    </>
  );
}
