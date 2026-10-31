# Contributing

Checkpoint is an experimental TypeScript SDK plus one Twitch showcase. Keep changes small and useful to those boundaries. Pre-1.0 API stability is not promised. Do not add speculative engine/platform integrations.

## Structure

- `packages/core`: platform-independent state machine, public types and adapter contract; zero runtime dependencies.
- `packages/twitch`: Node-only OAuth/EventSub transport and caller-supplied normalization.
- `apps/showcase/server`: trusted game host, controller security, showcase command grammar and explicit simulator adapter.
- `apps/showcase/src`: React/Canvas expedition, dashboard, read-only overlay and existing browser signal panel.
- `examples/signal-panel.ts`: tiny generic console integration; also used by the external package verifier.
- `tests`: keyboard/browser flows. `scripts`: offline/archive/license verification. `docs`: architecture, Twitch setup, evidence and submission drafts.

## Setup without credentials

Use Node **22.13+** (tested on 22.16) and npm. In Windows PowerShell, use `npm.cmd` / `npx.cmd` if necessary.

```sh
npm ci
npm run build
npm run dev
```

Open `http://localhost:4173/play`, unlock with the private terminal code, and select **Simulator**. No `.env`, Twitch account, network service or paid API is needed to run the installed app. Dependency installation initially needs npm registry access or a prepopulated cache.

## Checks and package builds

```sh
npm run typecheck
npm run lint
npm test
npm run test:core:offline
npm run build:packages
npm run verify:package
npm run example
npm run build
npx playwright install chromium
npm run test:e2e
```

The offline check removes Twitch/secret-related environment variables and preloads a networking denial guard into the core test process. Once dependencies are installed, it uses no registry or external service. The archive verifier uses offline npm, checks an exact contents allowlist, installs the core archive in a temporary directory outside source aliases, compiles the original example against public declarations, and runs it with networking denied. It retains the external consumer for inspection and reports its path. Do not publish to npm as part of verification. Browser tests own port 4173; stop an existing server first.

Format changed files with `npm exec prettier -- --write <paths>`. Update package changelogs for API changes. Keep package license copies consistent with root LICENSE. Regenerate dependency notices with `npm run licenses` when changing the lockfile.

## Add or modify an adapter

Implement the two-method `InputAdapter` from the **public** `@checkpoint/core` export. `start(host)` attaches `AdapterHost`; `stop()` must cease delivery and release transport resources. Authenticate at the transport boundary, namespace stable participant/input IDs, normalize allowed actions, preserve original timestamps/window association, and call `host.accept(input)`. Do not implement your own tally, resolution or participation rules. Report disconnects to application policy so the trusted host can pause/resume or cancel. Never silently switch live data to synthetic input.

Test against a fake transport/injected clock first: duplicate IDs, repeated participants, malformed actions, stale timestamps, closed/paused windows, reconnect and cancellation. The current task supports only Twitch and the simulator; propose additional integrations in an issue before implementing them. Do not add credentials or chat logs to fixtures.

## Reproduce a bug

Include commit/version, Node/npm/browser/OS versions, exact commands, simulator versus live mode, expected/actual behavior, and the smallest synthetic steps. Prefer `/dev` buttons or a tiny core fixture using an injected clock. Include sanitized state/inspector output if needed. Remove control codes, cookies, `.env`, Twitch IDs, tokens and real chat transcripts. State whether the issue reproduces after restart and whether a genuine live test occurred. Do not publish a private channel's data.

## Propose an API change

Describe a real caller use case, the smallest before/after example, alternatives (including a simple poll), changed guarantees and memory/timing implications. Include a migration note and focused tests, and prove archive consumption still works. Keep browser-compatible core code free of Node/transport/framework imports; do not make the showcase a required SDK dependency. Changes that add paid services, persistence promises, platforms or engines require separate discussion rather than expanding this implementation's scope.

Contributions are provided under this repository's MIT license. Preserve upstream dependency license and copyright notices; see `docs/LICENSING.md`.
