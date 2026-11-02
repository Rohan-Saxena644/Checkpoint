# Connect your own game

Checkpoint is an **experimental, MIT-licensed TypeScript library**, not a universal game mod. A streamer can run The Last Beacon with their own Twitch account using the [root quick start](../README.md#connect-your-twitch-channel). Connecting another game requires a developer to define interaction points and implement the resulting game effects. No extra engine or platform integration is included.

## Install built packages locally

Use Node 22.13+ and an ESM JavaScript/TypeScript project. From this repository root:

```sh
npm ci
npm run build:packages
npm run verify:package
npm pack -w @checkpoint/twitch --pack-destination .local/packages
```

The verifier creates `.local/packages/checkpoint-core-0.2.0.tgz`; packing creates `checkpoint-twitch-0.2.0.tgz` beside it. In **your own project**, use the actual absolute paths (quote paths with spaces):

```sh
npm install /absolute/path/checkpoint-core-0.2.0.tgz /absolute/path/checkpoint-twitch-0.2.0.tgz
# For a TypeScript Node host using the Twitch adapter:
npm install --save-dev typescript @types/node @types/ws
```

Install both in the same command so the adapter's `@checkpoint/core` dependency resolves to the supplied local archive. The core has no runtime dependencies; the Node-only Twitch package also needs `ws` and `zod`, which npm installs. Initial dependency installation requires registry access or an existing cache. Nothing is published to npm. Import `@checkpoint/core` and `@checkpoint/twitch`, never monorepo source paths. Built JavaScript, declarations, license and package guides are included.

For a browser-only/local-input project, install just the core archive. It needs no Twitch credentials, React, game or showcase server. Browser-provided identities are untrusted: authoritative multiplayer decisions belong in a trusted host.

## Wire the existing parts

1. **Open a game-defined window.** Use the complete two-participant example in the [core guide](../packages/core/README.md#first-window) or run `npm run example`. It creates a choice, accepts generic inputs, resolves and applies the result once. Replace the signal change with your game's bounded effect. Use unique window/input IDs.
2. **Attach the Twitch adapter on your Node host.** Follow the [public adapter example](../packages/twitch/README.md). `start({ currentWindow, accept })` connects it to the same `Interaction` instance; do not keep another vote tally. The normalizer maps eligible chat commands to generic actions such as `left` or `shield`, namespaces participant/delivery IDs and preserves the adapter's normalized timestamp. Never execute chat as code.
3. **Authorize the broadcaster.** Register a confidential app for your host's exact callback URL, keep the client secret server-side, and request `user:read:chat`. Your authenticated server redirects using `authorizationUrl(state)`, verifies expiring one-use session-bound state, then calls `authorize(code)`. `start` alone does not log in. The [Twitch setup guide](TWITCH_SETUP.md) explains the complete showcase flow; its protected session/callback implementation is in `apps/showcase/server/index.ts` as reference, not a package export to import.
4. **Drive time and apply results.** Call `tick()` from your authoritative loop. Consume typed lifecycle events or resolve after the deadline. Check the expected run/window and guard outcome IDs before applying a game change. Use the `BoundedSet` pattern from the core guide for recent in-process duplicate protection. The host defines safe fallbacks, permissions and effect duration.
5. **Handle lifecycle explicitly.** Pause the game and window on transport loss, then deliberately resume or cancel. Reauthorization after a server restart is required. `stop()` clears adapter resources/tokens and detaches the host; call `start(host)` again before authorizing. Missed chat is not replayed. Windows, participation, deduplication and tokens are memory-only. Durable recovery and transactionally applying external game effects require host persistence; the SDK does not promise crash-safe exactly-once execution.

The existing [console signal example](../examples/signal-panel.ts) and browser `/example` are the minimal second integration. The showcase's route/supply/goal demonstrate larger effects; its Twitch and simulator paths share the same core. A simple poll is sufficient when you only need a displayed count.

## Test your integration

Start without Twitch using generic participants and an injected clock. Check invalid actions, repeated participants, duplicate delivery IDs, input after resolution, pause/resume and repeated outcome application. Run this repository's `npm run test:core:offline` and `npm run verify:package` to inspect the verified package boundary. Then explicitly authorize your own broadcaster and verify one real command causes one actual game effect; synthetic tests do not establish live Twitch operation.

The current live evidence is a complete one-participant showcase run. Multi-account cooperation and real outages were not live-tested. There is no hosted multi-tenant service, automatic audience discovery, universal engine binding, npm release or long-term API stability promise. See [CONTRIBUTING.md](../CONTRIBUTING.md) for proposing changes and reporting sanitized reproductions.
