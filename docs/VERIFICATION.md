# Verification record

Build and verification completed across 30–31 October 2026, Node 22.16 on Windows. Run commands from the repository root (use `npm.cmd` in PowerShell if necessary).

| Check                                                                                         | Status                                                              |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| TypeScript strict type check                                                                  | Passed                                                              |
| ESLint                                                                                        | Passed                                                              |
| Vitest core, synthetic Twitch, game authority and controller security                         | **44 tests passed across 5 files**                                  |
| Production packages, browser bundle and Node build                                            | Passed                                                              |
| Playwright real keyboard crew expedition, recovery, no-viewer play, restart and mobile layout | **4 tests passed in 2.1 minutes after the 0.2.0 refactor**          |
| Independent console signal-panel integration                                                  | Passed: two generic participants, cyan result, one applied effect   |
| Desktop, mobile and OBS overlay screenshots                                                   | Captured and visually inspected; screenshots in `docs/screenshots/` |
| Live OAuth and real single-channel Twitch commands                                            | **Pending. No credentials configured or used.**                     |
| Standard-mode 3–5-minute play balance                                                         | Design target; no user playtest or timing study claimed             |
| Public deployment, video, npm release, repository publication and submission                  | Not performed                                                       |

## Library reusability verification · 0.2.0

- `npm run test:core:offline`: **20 core tests passed** with Twitch/secret-related environment variables removed and a preload that denies Node networking calls. This imports no Twitch adapter, server, React or game code.
- `npm run verify:package`: packed `@checkpoint/core` **0.2.0**, checked the exact six-file contents (`package.json`, built JS/declarations, README, changelog, MIT license), installed it with offline npm into a temporary consumer **outside the monorepo**, and compiled the existing signal-panel example using a fresh TypeScript config with **no paths aliases or ambient Node types**.
- The external Node consumer ran with networking denied and no inherited credentials: **2 participants, cyan outcome, 1 effect** despite repeated application. Package-root import worked; `@checkpoint/core/src/index.js` was rejected with `ERR_PACKAGE_PATH_NOT_EXPORTED`. The archive has **zero runtime dependencies** and no credentials, source tests, or showcase assets.
- `TwitchAdapter` and `SimulatorAdapter` both implement `InputAdapter`. Synthetic transport tests assert actual `Interaction` state. The game's acceptance path delegates to `Interaction.accept` and maintains no second voting tally. Command parsing lives outside core in the showcase normalizer shared by the two adapters.
- Package READMEs, MIT license copies, changelogs and contributor guidance are included. The API remains experimental. Dependency-license metadata and installed runtime notices were generated from the lockfile, with original asset provenance in `LICENSING.md`.

Automated Twitch tests deliberately use mocked token endpoints and synthetic EventSub frames. They check subscription version and account conditions, command delivery, stale/duplicate handling, shared-channel exclusion, planned handover without duplicate subscription, cold reconnect, revocation, keepalive timeout and hourly validation. They do not test Twitch's real servers or account-specific authorization.

Additional regressions verify cancelled in-flight OAuth cannot resurrect a connection, duplicate reconnect instructions are coalesced, subscription HTTP 401 refreshes once, and HTTP 429 waits for reset without falsely reporting connected. Browser tests also exercise duplicate/stale/old-window inputs through `/dev`, explicit offline continuation after cancellation, and a paused next checkpoint while still disconnected. The visible in-app preview browser was unavailable in this environment; layout inspection used actual Playwright Chromium screenshots.

The browser suite owns a temporary loopback server, enters its real private controller code, and pilots using keyboard events through rendered UI. It does not teleport the character or add a public testing endpoint. Separate unit tests may position in-memory game fixtures directly to cover state effects deterministically.

The documented production start was also exercised: `/play`, `/overlay`, `/dev`, `/example`, and `/api/state` all returned HTTP 200. A separate development smoke check launched actual Chromium, confirmed the Vite hot-update WebSocket connected, and waited for the rendered showcase. All temporary servers were stopped after verification.

## Live test to perform

Configure a registered app, authorize the broadcaster explicitly, choose Twitch mode and a tiny preset, reach each checkpoint, send real commands from one/two consenting accounts, and verify actual game changes and the OBS overlay. Confirm duplicate user voting policy, connection loss pause/resume, cancellation fallback and token revocation. Record only a minimal dated result here; never commit real chat transcripts, account IDs, app secrets or tokens.
