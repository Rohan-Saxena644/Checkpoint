# Checkpoint — Give chat a role. Keep the game in control.

## Inspiration

Streamers want their community to matter without surrendering the game to a constant stream of commands. Checkpoint makes participation an explicit part of game design: the developer chooses when chat may act, what counts, and exactly how the result changes play.

## What it does

The Last Beacon is an original top-down courier expedition. The streamer genuinely pilots the character, collects fragments and dodges telegraphed storm strikes. At three beacons the community chooses a risky or safe route, sends a bounded supply effect, and cooperatively charges protection for the final crossing. A broadcaster selects an explicit crew-size preset; the game never guesses audience size from chat. Fair fallbacks keep every route playable without viewers.

Checkpoint is also a reusable TypeScript SDK with choice and cooperative-goal primitives, typed lifecycle events, stable outcome IDs, deterministic ties, replacement votes, distinct-user contribution limits, bounded deduplication and injectable timing. The experimental 0.2.0 core has zero runtime dependencies and consumes generic actions. A tiny independent signal panel and an external package-archive consumer demonstrate reuse beyond the game.

## Twitch integration

The implemented Node adapter uses broadcaster authorization-code OAuth with only `user:read:chat`, validates tokens and manages refresh, and subscribes to `channel.chat.message` v1 through EventSub WebSockets. It handles keepalive health, planned transfer without duplicate subscription, cold reconnect, and revocation. Unexpected loss pauses the server-owned window and game. A separate readable overlay exposes no privileged control channel. Ordinary chat commands are sufficient; no paid viewer actions, Extension approval, or Affiliate status is needed.

**Verification:** real broadcaster OAuth/EventSub and all three chat interactions were verified on 1 November 2026. One consenting participant selected Left, received a shield, and charged protection in the explicit one-person preset; the run reached its winning ending. A subsequent owner recording shows the real chat commands, accepted participation, effects and ending. Automated tests separately cover larger crews, invalid/duplicate/late inputs, reconnect and controller permissions using synthetic events; those are not claimed as live multi-account or outage tests. Simulator activity is labeled and cannot enter a live-mode run.

## How we built it with Codex

Codex implemented a local npm TypeScript workspace: pure core, Twitch transport, Express/WebSocket authority, React/Vite dashboard, and procedural Canvas game. The build thread included inspection of official documentation, state-machine tests, controller security tests, browser playthrough verification, layout inspection, and documentation. Runtime AI and paid APIs are unnecessary. All game art is rendered from original geometric shapes.

During real integration testing, Codex traced rejected fresh chat messages to a host clock offset, normalized EventSub timestamps to the host clock, and added stale/future-message regressions. The final unit suite passes 47 tests; strict type checking and production build pass. Codex also verified an offline core package archive from a consumer outside the monorepo. This combines a visible game demonstration with evidence that the library can be reused independently.

Codex session ID: **PENDING — type `/status` in the main build thread; paste the actual ID.** Do not invent an ID. Review this description against the final verification record before submitting.

## Reliability and limitations

Resolution happens once per window in the running authoritative process; the game ignores duplicate/stale outcomes. Memory is bounded. This is not universal exactly-once delivery, crash durability, bot prevention, or a production multi-tenant cloud service. A restart requires a new run and Twitch authorization. Missed EventSub chat is not replayed. The focus is explicit game-defined participation windows, not a claim to be the first audience voting system or Twitch SDK.

## Remaining submission fields

- Repository URL: **pending separate publication authorization**.
- Public YouTube demo under three minutes: **pending recording and publication**.
- Live Twitch test: **passed; route, supply and one-participant cooperative goal through winning ending**.
- Session ID: **pending actual `/status` output**.
- Screenshots: use genuine captured game/overlay images; exclude secrets.
- Team/eligibility and final Devpost submission: **owner review required**.

## Final-phase evidence disclosure

The demonstrated workflow uses normal movement and unchanged 18-second windows, with pauses for preparation. The live test helper sends ordinary protected movement controls; it does not teleport the courier or alter game rules. The owner supplied a 155.5-second real Twitch/game screen recording showing accepted participation, shield, protection and ending. This is source footage, not the completed submission edit. Separate simulated verification covers no-viewer fallback, storm damage/restart, multi-person cooperation, overlay permissions and transport/input reliability. The final edit still needs genuine Codex build footage and an English explanation. The implementation uses Codex at build time, not runtime AI.
