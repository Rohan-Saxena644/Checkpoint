# Architecture and contracts

```text
Twitch EventSub -> TwitchAdapter -----+
                                     | InputAdapter / AdapterHost
Synthetic buttons -> SimulatorAdapter+-> Expedition.accept(Input)
                                         -> @checkpoint/core Interaction
                                         -> typed outcome -> game effect
                                         -> read-only /play /overlay /dev
```

`packages/core`: pure choice/goal state machines, definitions, typed lifecycle events, deterministic resolution, generic normalized actions, the adapter contract, and FIFO bounded sets. It has zero runtime dependencies and no command grammar. `packages/twitch`: Node OAuth/EventSub transport; no game dependency. `apps/showcase/server`: Express, protected controller, game simulation, 30 Hz authoritative update / 10 Hz public snapshots. `apps/showcase/src`: React and Canvas presentation. Browser animation only draws the server state; the browser does not own votes, health, movement effects, or deadlines.

## Lifecycle

Define a choice or goal → `open(uniqueId, definition, durationMs)` → `accept(input)` → `tick()` / `resolve()` → resolved. From open: pause/resume or cancel. A cancelled window never produces an outcome. Opening another window while one is active throws. Subscribe to the discriminated `LifecycleEvent` union for opened, input, paused, resumed, resolved and cancelled events. Unsubscribe using the returned function. Snapshots and outcomes are cloned so consumer mutation cannot change internal state.

Choice policy: a later **valid** vote replaces the same user's previous vote in the same window; invalid commands do not erase a vote. Ties use the order of `options` in the definition. Zero votes use `fallback` explicitly. Goal policy: each distinct eligible user contributes exactly one unit at most once per window, even if their delivery cache entry has been evicted. Goals return their host-defined `success` or `fallback`; The Last Beacon chooses `protected` / `unprotected`. Eligibility in the demo means a valid command from a user in the authorized channel during an open window. Shared-chat messages sourced from a different broadcaster are discarded.

## Time and recovery policy

The injected authoritative clock is in epoch milliseconds, as are normalized input timestamps. Inputs must arrive before the server deadline, originate at or after the current open/resume boundary, be at most 10 seconds old on arrival, and no more than 2 seconds in the future. At the exact deadline input is closed. An old window ID is never mapped to the current one. Twitch events do not carry a game window ID: the server assigns the current window only after validating the command and timestamp, so older events are rejected at the open/resume boundary. Provider clock skew can therefore conservatively reject legitimate boundary inputs.

Pause captures remaining time and rejects all participation. Resume sets a fresh deadline and timestamp boundary. Buffered commands sent during a pause are not replayed. An unexpected Twitch loss or keepalive timeout pauses the entire expedition and the active interaction; reconnection resumes only after a new subscription receives HTTP 202. If the streamer also pressed pause, transport recovery cannot override it. A planned Twitch `session_reconnect` keeps the old socket until the transferred session welcomes, avoiding unnecessary resubscription. Lost messages after a cold disconnect cannot be recovered. After bounded retry exhaustion, the streamer may explicitly cancel to a fair fallback and continue the current region offline; transport still reports disconnected, no synthetic inputs are admitted, and the next checkpoint pauses for another explicit fallback or reconnection. The Crew signal tab also offers broadcaster reauthorization during a live run. No automatic mode switching occurs.

## Actual guarantees

- One outcome and one resolved event per window **within the running process**. Repeated `resolve()` returns the same outcome. The game additionally checks current run, stage, window, and bounded applied outcome IDs before applying effects. Duplicate/stale application is ignored.
- Delivery deduplication and participation identity are separate. The SDK has a 4,096-entry FIFO delivery cache, a 10,000-user current-window cap, a 1,024-entry recent window-ID guard, and at most 16 options. Use fresh cryptographically unique window IDs: the recent-ID cache is not a permanent uniqueness database. The Twitch transport adds a 4,096-entry notification cache. Duplicate delivery suppression ends on eviction/restart; current-window per-user rules remain effective. Very old replayed choice deliveries should be rejected by the timestamp policy; there is no universal exactly-once claim.
- Game effects are idempotent for the current process, not across crashes. Restart starts a fresh run, requires controller login and Twitch authorization, and retains no durable outcomes or chat history.
- Sessions cap at 8, OAuth states at 8, public sockets at 32, game applied IDs at 128, logs at 100. Each request body is limited to 2 KiB and 100 HTTP requests per second per source address. Snapshot backpressure disconnects slow readers beyond 256 KiB; movement expires after 350ms without refresh. The game permits one active controller movement lease at a time.
- Unique Twitch user IDs limit participation. They do not prove human identity or prevent bots/account farming. The project has no anti-cheat claim and is not a hardened multi-tenant service.

## Reusing the packages

`npm run build -w @checkpoint/core` emits `packages/core/dist/index.js` and `.d.ts`; the Twitch package builds after core. Workspace `exports` expose both typed public APIs. The browser-only `/example` and `examples/signal-panel.ts` demonstrate a second integration without importing the Expedition class. No package publishing is necessary.

## Adapter and package boundaries

Both TwitchAdapter and SimulatorAdapter implement the public core InputAdapter interface: start(host), stop(). AdapterHost exposes currentWindow() and accept(Input). The showcase command normalizer lives in apps/showcase/server/commands.ts and is passed to both adapters. Game code delegates acceptance to Interaction.accept; it has no separate voting, deduplication, or tally implementation. Twitch payload fields exist only at the Twitch boundary and become source-qualified participantId/inputId plus an allowed action and trusted timestamp. Chat command labels in public game snapshots are presentation data, not core definitions.

See [the core package README](../packages/core/README.md) for Node/browser support, host responsibilities, timing limits and the copyable first-use example. A browser can execute the ESM state machine but is not an authority for real votes. The local archive verifier exercises installed built exports without repository source aliases; distribution excludes all source tests, credentials and game assets. The API is experimental, with breaking changes documented in [CHANGELOG](../CHANGELOG.md).
