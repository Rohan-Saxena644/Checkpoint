# @checkpoint/core

**Experimental API · 0.2.0 · MIT · zero runtime dependencies.**

Checkpoint resolves bounded participation windows in a trusted host. It handles choice replacement, distinct-participant cooperative goals, validation, deadlines, pause/resume, deterministic outcomes and bounded duplicate-input suppression. It has no Twitch, chat grammar, React, Node imports, server, rendering or game dependency.

Use a simple poll when all you need is a displayed tally. Checkpoint is useful when an application must open and close a timed participation window and apply one explicit result as a game or application effect.

## Install locally

Nothing is published to npm. From the source repository, using Node **22.13+** and npm:

```sh
npm ci
npm run build -w @checkpoint/core
npm run verify:package
```

The verifier creates `.local/packages/checkpoint-core-0.2.0.tgz`. In a separate ESM Node/TypeScript project, install that local file with `npm install /absolute/path/to/checkpoint-core-0.2.0.tgz`. Import **only** `@checkpoint/core`. The archive includes built ES2022 JavaScript, TypeScript declarations, this README, MIT license and changelog. Internal source paths are deliberately not exported. Packages remain marked private to guard against accidental registry publication.

## First window

This complete example also runs as the existing `examples/signal-panel.ts` with `npm run example`. It does not need Twitch credentials or a running server.

```ts
import { BoundedSet, Interaction, type Outcome } from "@checkpoint/core";

let now = 1000;
const windows = new Interaction(() => now);
const applied = new BoundedSet(128);
let signal = "amber";
const window = windows.open(
  "signal-001",
  {
    kind: "choice",
    options: ["amber", "cyan"],
    fallback: "amber",
  },
  10000,
);

function apply(outcome: Outcome) {
  if (outcome.windowId !== window.id || applied.has(outcome.id)) return;
  applied.add(outcome.id);
  signal = outcome.value; // your application's effect
}
windows.accept({
  windowId: window.id,
  participantId: "participant-a",
  inputId: "input-a",
  action: "cyan",
  sentAt: now,
});
windows.accept({
  windowId: window.id,
  participantId: "participant-b",
  inputId: "input-b",
  action: "cyan",
  sentAt: now,
});
now += 10000;
windows.tick();
const outcome = windows.resolve()!;
apply(outcome);
apply(outcome); // ignored; signal is cyan, with one applied effect
console.log(signal);
```

Use fresh unique window/input IDs in real applications. The fixed IDs and injected clock above make the example reproducible. `BoundedSet` is an in-memory recent-ID guard, not a durable idempotency store. Check the expected run/window as well as the outcome ID, as the example does. The separate browser signal panel at `/example` uses local buttons and the same public API; it is an intentionally untrusted demonstration.

## Contract and lifecycle

`open(id, definition, durationMs)` → `accept(input)` → `tick()` / `resolve()`. `pause()` freezes remaining time; `resume()` starts a fresh deadline; `cancel()` terminates without an outcome. `snapshot()` returns a clone. `subscribe(listener)` supplies the discriminated `LifecycleEvent` union and returns an unsubscribe function. There are no background timers: the host must call `tick()`.

For choices, a later valid action replaces the participant's previous action. Invalid actions do not erase a vote. Ties use definition option order; zero participation uses the required fallback. Action strings are case-sensitive opaque identifiers (1–128 characters, not all whitespace); the core does not parse commands. `participantId` is a host-verified stable identity, not necessarily a Twitch account; `inputId` identifies a delivery independently of participation identity.

For cooperative goals, define `{ kind: 'goal', action: 'contribute', target: 2, success: 'ready', fallback: 'not-ready' }`. Each distinct participant contributes at most once. At resolution, meeting the target returns `success`; all failures including no participation return `fallback`. These strings and resulting effects belong to the application.

## Minimal adapter interface

```ts
import type { AdapterHost, InputAdapter, Input } from "@checkpoint/core";

class LocalButtons implements InputAdapter {
  private host?: AdapterHost;
  start(host: AdapterHost) {
    this.host = host;
  }
  stop() {
    this.host = undefined;
  }
  press(input: Input) {
    return this.host?.accept(input);
  }
}
const buttons = new LocalButtons();
buttons.start({
  currentWindow: () => windows.snapshot(),
  accept: (input) => windows.accept(input),
});
```

This is an interface illustration, not an additional application. Twitch and the showcase's explicitly synthetic simulator implement this exact interface. `start` attaches the host; it does not grant external authorization. Twitch additionally requires an explicit `authorize(code)` call. `stop` disconnects/detaches the source. No auto-discovery, plugin registry, networking framework or persistence abstraction is required.

The **adapter** authenticates its transport, derives stable identities and source-qualified delivery IDs, parses untrusted payloads into allowed action identifiers, supplies timestamps in the host clock domain, associates the correct window, and reports connection health to host policy. It must not turn old input into a fresh timestamp/window or silently invent participants. The **host** authenticates participants/controllers, authorizes eligibility, rate-limits transport, chooses definitions/fallbacks, owns the clock and loop, decides disconnect handling, and applies outcomes idempotently. Core validation is an additional boundary, not authentication.

## Timing, memory and persistence

Inputs must arrive before the deadline, originate at/after the most recent open/resume boundary, be at most 10 seconds old, and at most 2 seconds in the future. All timestamps use the injected host clock's units (milliseconds). Use a consistent clock across adapters. At the exact deadline the window resolves and rejects further inputs. Pause rejects inputs; buffered input originating before resume is rejected. Clock skew or wall-clock adjustment can reject boundary inputs: synchronize provider timestamps and use a stable authoritative clock.

There is one resolution per window within the running instance. `resolve()` returns the same result on repeated calls; a cancelled window cannot resolve. Default bounds: 10,000 current participants, 4,096 recent input IDs, 1,024 recent window IDs, 16 choices, 300-second maximum duration. The constructor allows participant/input-cache limits. Old IDs eventually evict; generate unique IDs rather than relying on a permanent uniqueness database. Retaining snapshots/events in application code is the host's memory responsibility.

The core detects no disconnect on its own. A trusted host should pause on loss, resume only after synchronization, or explicitly cancel/fallback. No durable persistence, event replay, crash recovery, bot prevention, or universal exactly-once delivery is supplied. Restarting creates empty state. Durable effects and recovery need host-owned storage and transaction/idempotency policy; the showcase deliberately starts a new run after restart.

## Node and browser support

Node **22.13+** is the supported development/runtime baseline (tested on 22.16). Distribution is **ESM only** with typed package-root exports; CommonJS `require` and legacy browsers are not supported. Browser consumers need ES2022, `structuredClone`, `Map` and `Set`; use an ESM-aware bundler or an explicit import map for the bare package name. The code does not touch DOM APIs and works in modern browser execution contexts, but background-tab timer throttling and untrusted browser clocks/identities make client-side authority unsuitable for real votes. **Browser compatibility never makes browser-submitted votes trustworthy.** Run shared decisions on your trusted host. No polyfills are bundled.

The API is experimental and may change incompatibly before 1.0. See CHANGELOG.md for the 0.1 → 0.2 migration. No long-term API stability is promised.
