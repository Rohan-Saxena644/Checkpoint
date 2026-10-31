# Changelog

Checkpoint's API is **experimental**. No long-term stability or compatibility promise is made before 1.0.

## 0.2.0 — 2026-10-31

- Made core definitions and normalized inputs platform-independent. Removed chat syntax and game-specific goal results from core. See [core migration notes](packages/core/CHANGELOG.md).
- Added the minimal input adapter contract, implemented by Twitch and the existing showcase simulator. Both paths share the same state machine; the game contains no voting tally.
- Added explicit distributable contents, package READMEs/licenses, offline tests and an external TypeScript/Node consumer of a local package archive.
- Reused the original signal panel for the generic two-participant, idempotent first-use example.
- Added contributor guidance and dependency/asset license documentation. Preserved one Twitch browser showcase; no platforms, engines, infrastructure or runtime AI added.

## 0.1.0 — 2026-10-30

- Initial SDK, Twitch adapter, The Last Beacon game, dashboard, broadcast overlay, simulator, tests and hackathon materials.
