Use the text supplied after `/current-feature`.

1. Resolve Google Drive `dev-instructions/learning-engine/current-feature.md` by traversing that exact folder path live.
   - Never use, store, hard-code, or reuse a Google Drive file or folder ID from memory, history, another task, or prior tool output.
   - Do not search by filename alone. Verify the complete parent path.
   - If the exact path cannot be resolved, stop and report it. Never fall back to a remembered ID or a same-named file elsewhere.
2. Read the resolved file and check whether it is empty. If it is not empty, inform the user and stop without changing it.
3. If it is empty, write the text supplied after `/current-feature` to that resolved file.


