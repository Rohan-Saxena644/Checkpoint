# Checkpoint — Give chat a role. Keep the game in control.

## Inspiration

Streamers want their community to matter without surrendering the game to a constant stream of commands. Checkpoint makes participation an explicit part of game design: the developer chooses when chat may act, what counts, and exactly how the result changes play.

## What it does

The Last Beacon is an original top-down courier expedition. The streamer genuinely pilots the character, collects fragments and dodges telegraphed storm strikes. At three beacons the community chooses a risky or safe route, sends a bounded supply effect, and cooperatively charges protection for the final crossing. A broadcaster selects an explicit crew-size preset; the game never guesses audience size from chat. Fair fallbacks keep every route playable without viewers.

Checkpoint is also a reusable TypeScript SDK with choice and cooperative-goal primitives, typed lifecycle events, stable outcome IDs, deterministic ties, replacement votes, distinct-user contribution limits, bounded deduplication and injectable timing. The experimental 0.2.0 core has zero runtime dependencies and consumes generic actions. A tiny independent signal panel and an external package-archive consumer demonstrate reuse beyond the game.

## Twitch integration

The implemented Node adapter uses broadcaster authorization-code OAuth with only `user:read:chat`, validates tokens and manages refresh, and subscribes to `channel.chat.message` v1 through EventSub WebSockets. It handles keepalive health, planned transfer without duplicate subscription, cold reconnect, and revocation. Unexpected loss pauses the server-owned window and game. A separate readable overlay exposes no privileged control channel. Ordinary chat commands are sufficient; no paid viewer actions, Extension approval, or Affiliate status is needed.

**Verification disclosure:** automated adapter checks use synthetic events and mocked Twitch HTTP responses. Live broadcaster authorization and actual chat verification remain pending. Replace this disclosure with accurate dated results only after completing the live test. Simulator activity is labeled and cannot enter a live-mode run.

## How we built it with Codex

Codex implemented a local npm TypeScript workspace: pure core, Twitch transport, Express/WebSocket authority, React/Vite dashboard, and procedural Canvas game. The build thread included inspection of official documentation, state-machine tests, controller security tests, browser playthrough verification, layout inspection, and documentation. Runtime AI and paid APIs are unnecessary. All game art is rendered from original geometric shapes.

Codex session ID: **PENDING — type `/status` in the main build thread; paste the actual ID.** Do not invent an ID. Review this description against the final verification record before submitting.

## Reliability and limitations

Resolution happens once per window in the running authoritative process; the game ignores duplicate/stale outcomes. Memory is bounded. This is not universal exactly-once delivery, crash durability, bot prevention, or a production multi-tenant cloud service. A restart requires a new run and Twitch authorization. Missed EventSub chat is not replayed. The focus is explicit game-defined participation windows, not a claim to be the first audience voting system or Twitch SDK.

## Remaining submission fields

- Repository URL: **pending separate publication authorization**.
- Public YouTube demo under three minutes: **pending recording and publication**.
- Live Twitch test: **pending credentials, broadcaster authorization and verification**.
- Session ID: **pending actual `/status` output**.
- Screenshots: use genuine captured game/overlay images; exclude secrets.
- Team/eligibility and final Devpost submission: **owner review required**.

## Final-phase evidence disclosure

The demonstrated workflow uses normal controls and unchanged 18-second windows. Final verification covers the full simulated expedition, no-viewer fallback, actual storm damage and restart, visible route/supply effects, small-crew cooperation, overlay permissions and transport/input reliability. Recording scripts capture actual browser frames and assemble a clearly labeled, silent, incomplete review. No real Twitch footage or genuine Codex desktop clip has been fabricated. Configure the registered app and complete the manual clips before claiming live verification or a finished submission video. The implementation uses Codex at build time, not runtime AI.
