import type { StartupScreenData } from "@/types/learning";
import { VocabularyStartupContent } from "../components/Startup/VocabularyStartupContent";
import { VocabularyStartupVisual } from "../components/Startup/VocabularyStartupVisual";

export function createStartupProps(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for future list-driven fixture data
  wordListId: string
): StartupScreenData {
  return {
    contentPanel: <VocabularyStartupContent />,
    visualPanel: <VocabularyStartupVisual />,
    actionPanel: {
      buttons: [
        {
          id: "start-lesson",
          actionId: "next",
          label: "Start Lesson",
          variant: "primary",
          trailingIcon: "→",
        },
      ],
    },
  };
}
