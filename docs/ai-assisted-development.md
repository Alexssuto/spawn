# AI-assisted development

Spawn is developed with two AI tools that do different jobs. This page records what each one was actually used for, so it's clear which work came from where.

| Tool | Where it runs | Best at |
|---|---|---|
| **Claude Code** | Terminal / desktop app, works across the whole repo | Multi-file changes, architecture, writing and running tests, Git and GitHub operations, code review |
| **GitHub Copilot** | Inside VS Code, as you type | Inline completions, quick questions about the open file, small focused edits |

**Rule for both:** nothing is merged without being read, understood, and passing CI.

## Claude Code: log of contributions

| Change | What Claude Code did | What was checked |
|---|---|---|
| Initial prototype | Scaffolded the Vite project; wrote the map, list, catch flow and Dex from a feature description | Clicked through the full flow in a mobile-size browser |
| Architecture | Separated game rules into pure functions in `src/lib/` so they can be tested without a browser | Tests run in Node in under 2 seconds |
| Unit tests | Set up Vitest and wrote 52 tests for distance, time windows, catch rules, progression, storage and data integrity | All pass locally and in CI |
| Bugs found by tests | `formatDistance(996)` returned `"1000 m"`; a non-list value in `localStorage` crashed the app on load. Each was fixed in its own commit, with a regression test | Tests were red before the fix and green after |
| CI | Wrote the GitHub Actions workflow (lint → typecheck → test → build) | Runs on the Phase 1 pull request |
| Repository hygiene | Checked tracked files for secrets before the first push, hardened `.gitignore`, created the private repo | Confirmed through the GitHub API that the repo is private |

Claude Code features used: project memory (`CLAUDE.md`), running tests and builds, Git/GitHub CLI operations, and browser checks of the running app. `/code-review` will be used on pull requests from Phase 2 on.

## GitHub Copilot: setup and how to use it

### Setup

1. **Get access.** As a student, apply for the [GitHub Student Developer Pack](https://education.github.com/pack), which includes Copilot Pro for free. Without it, the limited **Copilot Free** plan works for getting started.
2. In VS Code, install the **GitHub Copilot** extension (Copilot Chat comes with it) and sign in with the GitHub account that owns this repo.
3. Open the `spawn` folder in VS Code (`code .` from the project folder).

### Features to actually use

| Feature | How | Try it on Spawn |
|---|---|---|
| Inline suggestions | Type and press `Tab` to accept, `Esc` to reject | Start writing a new test in `src/lib/time.test.ts` and see what it proposes |
| Copilot Chat | `Ctrl+Alt+I` | Select `levelFromXp` and ask "explain this function and its edge cases" |
| `/tests` | In Chat, with a function selected | Generate cases for `formatDuration`, then delete the ones that are wrong or redundant |
| `/explain` | In Chat | Ask it to explain the haversine formula in `geo.ts` |
| Edit / agent mode | The mode selector in the Chat panel | Small, scoped multi-file edits |
| Commit messages | Sparkle icon in the Source Control panel | Compare its message with what you would write |

### Suggested learning exercises

These are small on purpose. Write the code yourself with Copilot helping, and make sure you can explain every line.

1. **Add a "Free" filter** in `App.tsx` that shows only spawns with `price === 'Free'`. Add a test if you put the logic in `src/lib/`.
2. **Add a test** that hidden spawns reveal at exactly `REVEAL_RADIUS` (boundary case) in `src/lib/spawnView.test.ts`.
3. **Show total XP** on the Dex card using `totalXp` from `src/lib/progression.ts`.

Open each one as its own branch and pull request, and watch CI run on it.

### Copilot usage log

Fill this in as you go. It's the most convincing thing to show in an interview.

| Date | Task | What Copilot suggested | What I kept / changed and why |
|---|---|---|---|
| | | | |
