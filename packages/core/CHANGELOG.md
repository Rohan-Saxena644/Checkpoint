# Changelog

The API is experimental; pre-1.0 releases may contain breaking changes.

## 0.2.0 — 2026-10-31

- **Breaking:** normalized `Input` now uses `participantId`, `inputId`, and `action` instead of `userId`, `deliveryId`, and `value`.
- **Breaking:** removed `command` from definitions and `parseCommand` from core exports. Command parsing belongs to the input adapter/application.
- **Breaking:** cooperative goals require an explicit `action`, `success`, and `fallback` rather than game-specific result strings.
- Added the minimal `InputAdapter` / `AdapterHost` contract. Timing, pause/resume, replacement votes and deterministic tie policy remain unchanged.
- Restricted distribution to built ESM, declarations, README, changelog and MIT license; no runtime dependencies.
- Added offline core checks and an external archive consumer that compiles against package exports.

## 0.1.0 — 2026-10-30

- Initial choice/goal state machines, bounded input deduplication, typed lifecycle events, clock injection and deterministic outcomes.
