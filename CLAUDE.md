# Spawn: notes for Claude Code

Spawn is a React + TypeScript (Vite) app: a live map of real-world experiences in Montréal that you "catch" by being there. See README.md for the full picture.

## Commands

- `npm run dev`: dev server on http://localhost:5173
- `npm test`: Vitest, run once (`npm run test:watch` to watch)
- `npm run lint`: oxlint, warnings fail
- `npm run typecheck`: `tsc -b`
- `npm run build`: production build

Before saying a change is done, run lint, typecheck and tests. CI (`.github/workflows/ci.yml`) runs the same steps.

## Architecture rules

- Game rules live in `src/lib/` as **pure functions** with no React or browser APIs. Components render what `lib/` computes and should not re-implement rules.
- Every rule change in `src/lib/` or `src/hooks/` comes with a test next to it (`*.test.ts`).
- Tests run in Node by default; a test file that needs the DOM starts with `// @vitest-environment jsdom`.
- Sample data in `src/data/spawns.ts` uses times relative to "now"; keep at least one live and one upcoming spawn (a test enforces this).

## Workflow

- Never commit directly to `main`. Use a branch (`feat/`, `fix/`, `chore/`, `docs/`) and open a PR.
- Small commits, each describing one change.
- The GitHub repository is **private**. Never change its visibility, deploy publicly, or commit secrets (`.env` files are gitignored).
- The owner is learning from this project: explain non-obvious changes in the PR description so they can be understood, not just merged.
- Stories labeled `copilot-practice` in `docs/roadmap.md` are for the owner to write. Review them; don't implement them unless asked.

## Keeping notes (always)

The owner needs to explain this project in technical interviews. After every meaningful change:

- **New technical decision** → add an ADR in `docs/decisions/` (Context, Decision, Alternatives, Consequences) and list it in `docs/decisions/README.md`.
- **End of a phase or notable change** → update `docs/interview-notes.md`: what was built, why, likely interview questions with plain answers, and a checklist of concepts to understand.
- **AI involvement** → add a row to `docs/ai-assisted-development.md` saying what Claude Code did and what was verified.
- **Technology status** must stay honest: built vs designed vs planned vs not used. Never describe planned work as done, and never invent metrics.
