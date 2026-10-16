# 0001: Game rules are pure functions in `src/lib/`

**Status:** Accepted (Phase 1)

## Context

Spawn's rules ("can I catch this?", "is it hidden?", "how much XP?") depend on time, position and the collection. If they live inside React components, testing them requires rendering UI, mocking GPS and faking the clock.

## Decision

Rules are plain TypeScript functions in `src/lib/` with no React and no browser APIs. Time and position are passed in as arguments (`viewSpawn(spawn, me, now, caught)`), never read from globals. Components only render what these functions return.

## Alternatives considered

- **Rules inside components.** Less code at first, but untestable without a browser, and duplicated between the map and the list.
- **A state library (Redux, Zustand).** Unnecessary for an app this size; it would not by itself make rules testable.

## Consequences

- 52 unit tests run in Node in about 2 seconds, with a fixed `now` and fixed positions, so they are deterministic.
- Two real bugs were found by these tests before any user hit them.
- The same separation is reused in the backend (`domain/` holds pure mapping and rarity rules).
