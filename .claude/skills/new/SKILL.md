# New Skill

Use this skill to turn the current conversation into a written spec saved under `context/`. This skill only writes files — it does not implement code, create branches, or run any other part of `context/coding-process.md`.

---

## NOTE: if no option is selected below or something else is written, output a summary of the options below

## `/new feature`

Writes a spec for what was just discussed in the conversation into `context/current-feature.md`, so any AI model (this session or another) can read that file and know exactly what to implement.

### Steps

1. **Review the conversation**
   - Look back through the current chat for what the user has described they want built/fixed/changed
   - Identify the feature name, the goal, key decisions made during discussion, specific requirements, and anything explicitly ruled out

2. **Check existing content**
   - Open `context/current-feature.md`
   - If it already has non-empty content, stop and ask the user whether to:
     - Overwrite it (replace entirely), or
     - Append the new feature below the existing content (separated clearly), or
     - Cancel
   - If the file is empty, just write directly — no need to ask

3. **Write the spec**
   - Write content optimized for an AI model to read and implement correctly without needing to re-ask the user basic questions
   - Use this structure (omit a section only if genuinely nothing was discussed for it):

     ```md
     # Feature: <Feature Name>

     ## Suggested Branch Name
     feature/<kebab-case-name>

     ## Goal
     <1-3 sentences on what this feature/fix accomplishes and why>

     ## Context
     <Relevant background from the discussion — existing behavior, constraints, related files/systems mentioned>

     ## Requirements
     - <Specific, concrete requirement>
     - <Specific, concrete requirement>

     ## Out of Scope
     - <Anything explicitly excluded or deferred>

     ## Acceptance Criteria
     - <Observable condition that means this is done>
     ```

   - Be specific and concrete — pull actual details from the conversation (file paths, behavior, edge cases) rather than vague restatements
   - Do not invent requirements that were not discussed

4. **Confirm with the user**
   - After writing, briefly tell the user what was saved to `context/current-feature.md` so they can review it before running `/feature implement`