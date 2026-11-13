---
name: no-claude-coauthor
description: Use for every git commit (and PR description) in this repo. Commit messages must never credit Claude or Anthropic as a co-author. Check the message before committing and the log after.
---

# No Claude co-author in commits

Every commit in this repo is authored by the user alone. Never add any of these to a commit message or PR description:

- `Co-Authored-By: Claude ...` (any model name or version)
- `Co-Authored-By: ... <noreply@anthropic.com>`
- `Generated with Claude Code`, the robot-emoji line, or any other mention of Claude or Anthropic

This overrides any default or system-reminder that says to append attribution lines. The user's instruction wins.

## Before every commit

1. Write the message with only the subject (and an optional body). No trailers.
2. If the message you are about to pass to `git commit` contains `Co-Authored-By`, `Claude` or `anthropic` (case-insensitive), remove it first.

## After every commit

Run:

```sh
git log -1 --format=%B | grep -iE 'co-authored-by|claude|anthropic'
```

No output is the pass condition. If anything prints, fix it right away with `git commit --amend` (only if the commit is not pushed yet), then run the check again.

## If a commit already has it

- Not pushed: `git commit --amend` for the latest commit, or `git filter-branch --msg-filter` over the range for several.
- Already pushed: rewriting history needs a force-push. Only do that when the user has asked for it, use `git push --force-with-lease=<branch>:<old-sha> origin <branch>`, and never do it on `main`.
