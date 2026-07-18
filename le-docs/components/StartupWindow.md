# StartupWindow

Reusable Learning Window composed from module-owned startup content.

The registered `"startup"` window owns the responsive presentation shell and action-panel rendering. A learning module supplies opaque React content for the content and visual panels plus button configuration. Button clicks emit the configured action ID through the shared `onAction` callback.

This boundary lets modules control subject-specific copy and visuals without resolving windows, calling React setters, or controlling the Learning Engine directly. Changes to vocabulary startup content belong under `src/learning-modules/vocabulary/components/Startup/`, not in the shared window.

Sources: `src/components/LearningWindows/Startup/StartupWindow.tsx`, `src/learning-modules/vocabulary/screens/startupScreen.tsx`, and `src/types/learning.ts`.
