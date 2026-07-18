# AnswerRecapWindow

Neutral post-answer window registered as `"answer-recap"`.

The active module supplies the label, title, primary and secondary text, replay label, playback messages, speech queue, and TTS configuration. Declarative TTS can speak the supplied entries sequentially; the manual speaker replays the same queue. Next remains disabled while engine-owned playback is active.

Vocabulary configures the window with the word, definition, and one randomly selected example. The shared component contains no vocabulary answer discriminants, reward behavior, or lesson decisions.

Sources: `src/components/LearningWindows/AnswerRecap/` and `src/learning-modules/vocabulary/screens/answerRecapScreen.ts`.
