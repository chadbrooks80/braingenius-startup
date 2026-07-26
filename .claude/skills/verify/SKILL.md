# Verify Skill

Verify Brain Genius against the current repository without relying on machine-specific tooling.

## Checks

1. Inspect `package.json` and run only the scripts that exist and apply to the change.
2. Include lint, TypeScript, tests, and a production build when their scripts exist and the task permits generated build output.
3. Report every failure and warning. Do not suppress output or use automatic fixes.

## Runtime verification

1. Build the application with its repository script before starting the production server.
2. Choose an available non-default port.
3. Start the server as a background child process and retain its exact PID.
4. Poll the selected local URL until it responds, the server exits, or the environment's explicit timeout is reached. Do not use a fixed sleep.
5. Stop only the retained PID during cleanup. Never terminate processes by broad name or pattern.

## Browser checks

- Use browser tooling already available in the current environment. Do not hardcode browser-library imports from a user directory or package-manager cache.
- If browser tooling is unavailable, report runtime UI verification as a limitation.
- Verify the current main route `/learning/vocabulary/word_list_id`, the `/playground` surface when relevant, and the exact flow affected by the change.
- For an unknown module route, expect the learner-safe `Lesson Not Found` screen and a `Return Home` link. The handled route error may log a structured warning; it must not expose the technical error to the learner.
- Capture unexpected browser console errors and page errors. Base expectations on the current code, not historical output.

Return the commands run, observed routes and behaviors, failures, warnings, and limitations.
