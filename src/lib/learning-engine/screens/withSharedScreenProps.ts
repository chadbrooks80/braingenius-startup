import type { OnAction } from "@/types/learning";

export function withSharedScreenProps<T extends object>(
  screenProps: T,
  onAction: OnAction
) {
  return {
    ...screenProps,
    onAction,
  };
}
