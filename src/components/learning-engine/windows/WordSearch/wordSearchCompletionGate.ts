// The single decision for whether the completion effect should emit
// "submitAnswer" this render. WordSearchPuzzleSession's effect and its
// regression test both call this gate, so a test proving the gate's behavior
// proves the same behavior the component relies on.
export type WordSearchCompletionGateInput = {
  activeComplete: boolean;
  initiallyComplete: boolean;
  alreadyEmitted: boolean;
};

export function shouldEmitWordSearchCompletion({
  activeComplete,
  initiallyComplete,
  alreadyEmitted,
}: WordSearchCompletionGateInput): boolean {
  if (!activeComplete || alreadyEmitted) {
    return false;
  }

  // A puzzle seeded as already complete must not emit a completion the
  // learner did not perform.
  return !initiallyComplete;
}
