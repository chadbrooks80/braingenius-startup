# Button

Shared presentation button for learner actions.

`Button` owns only visual variants, disabled presentation, and optional label adornments. Callers own behavior through `onClick`; it does not know about Learning Engine actions or module state. Learning Windows use `disabled` when an engine-owned operation such as sequential recap playback must finish before progression.

See `src/components/UI/Button.tsx` for the current prop contract.
