# Commit Skill

Use this skill to merge a completed feature branch into main and push it up.

`/commit`

## Steps

0. **check if ./context/current-feature-md has the current feature removed**
   -if the current feature is not removed, then follow ask user if they like to do this, if yes, then follow instructions for command "/feature complete", and proceed. If they say no then procceed without running the /feature command.

1. **Stage and commit all changes on the current branch**
   - Run `git add .`
   - Run `git commit -m "<message>"`
   - The commit message should be a brief description of the feature and what was added
   - **IMPORTANT: Do NOT include "Co-authored-by: Codex" in the commit message**

2. **Switch to main**
   - Run `git checkout main`

3. **Merge the feature branch into main**
   - Run `git merge <feature-branch-name>`

4. **Delete the feature branch locally**
   - Run `git branch -d <feature-branch-name>`

5. **Push main to remote and remove the remote feature branch**
   - Run `git push origin main`
   - Run `git push origin --delete <feature-branch-name>`
