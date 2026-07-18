# Compress Skill

Create a portable project archive quickly.

1. Inspect `.gitignore` and select an archive tool available in the current environment.
2. Replace the root `Archive.zip` with a new ZIP of the project. Exclude `.git`, `node_modules`, `.next`, `references`, existing archives, secrets, and other generated or ignored non-project files.
3. Do not run a separate archive integrity test unless the user explicitly requests verification.
4. If archive creation fails, report the exact failure.
5. When the environment supports file clipboard operations, copy `Archive.zip` to the clipboard automatically and confirm that it succeeded. Do not fail archive creation when clipboard access is unavailable.
