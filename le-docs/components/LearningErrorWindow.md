# LearningErrorWindow

Learner-safe recovery screen for malformed or unavailable learning routes.

The Learning Engine renders this registered `"error"` window when initialization catches a known `LearningRouteError`. Modules do not request it directly.

Display copy comes from `getLearningRouteErrorPresentation()` so raw exception messages, codes, stacks, route variables, and provider details never reach the learner. The static `Return Home` link is the recovery path; it navigates to `/` without emitting an engine action.

Sources: `src/components/LearningWindows/Error/LearningErrorWindow.tsx`, `src/lib/learning-engine/errors/LearningRouteError.ts`, and `src/lib/learning-engine/LearningEngine.ts`.
