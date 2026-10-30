# Checkpoint

**Give chat a role. Keep the game in control.**

Checkpoint is a TypeScript SDK for game-defined participation windows. The game decides when chat can act, which actions count, when voting ends, and how a predictable result changes play.

**The Last Beacon** is its playable showcase: pilot a courier through four compact regions, dodge telegraphed storm strikes, collect beacon fragments, and invite your crew to choose a route, send supplies, and power the final protective field. Original procedural Canvas artwork; no runtime AI, paid services, downloaded game assets, or audio dependencies.

![The Last Beacon expedition console](docs/screenshots/expedition.png)

## Run locally

Requires Node **22.13+** (tested with 22.16) and npm. Use the repository root for every command. On Windows PowerShell use `npm.cmd` / `npx.cmd` if script execution blocks `npm` / `npx`.

```sh
npm ci
npm run build
npm start
```

Open **http://localhost:4173/play**. The server prints a private streamer control code. Enter it in **Unlock streamer controls**; then **Begin expedition**. No credentials are needed for simulator mode. Do not show the private code on stream.

For development with Vite middleware and browser hot updates:

```sh
npm run dev
```

SDK output must exist first (`npm run build` does this). Restart `npm run dev` after server/SDK changes. Browser source changes update automatically.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run example
```

Stop an existing server before browser tests: the suite owns port 4173. Test screenshots and the HTML report are written to ignored `test-results/` and `playwright-report/`. No live credentials are used by tests.

## Play and broadcast

- `/play`: expedition and authenticated streamer dashboard. WASD / arrows move; Escape pauses. Collect **2 fragments** per region, then enter the beacon ring on the right. Final region requires no fragments. Yellow dashed rings telegraph incoming red storm strikes. **Easy expedition** adds health, smaller hazards, and faster movement for judging. Standard mode targets roughly 3–5 minutes, depending on route and exploration; easy mode is quicker.
- `/overlay`: read-only transparent OBS browser source. Use `http://localhost:4173/overlay`, width **640**, height **1000**, 30 FPS. Add the game via window/game capture separately. This overlay contains no control credential; do not add a control code to its URL. It shows exact commands, server time, accepted participation, and outcomes. Open it in an OBS browser source on the same machine.
- `/dev`: explicitly synthetic input and bounded technical inspector. Choose a synthetic viewer. Try valid or invalid commands, repeated votes, duplicate deliveries (press twice), stale timestamps, old window IDs, disconnect/resume, and duplicate outcome application. Use **Crew signal → Cancel & use fair fallback** if recovery cannot complete. This explicitly allows offline play until the next checkpoint while retaining the disconnected label and original mode. In a live run, **Reconnect broadcaster** permits reauthorization without restarting.
- `/example`: a tiny browser-only signal panel using `@checkpoint/core`, independent of the showcase game. `examples/signal-panel.ts` is its minimal console counterpart.

The default simulator never creates automatic fake activity. Buttons submit only the synthetic commands you explicitly choose. Live mode rejects simulator inputs and never silently changes to simulator mode.

| Crew moment | Commands                                          | Actual game consequence                                                                                                  | No-participation fallback                                |
| ----------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| Route       | `!route left`, `!route right`                     | Shatterpath: 6 hazards / 4 collectible opportunities. Stillwater: 2 hazards / 2 opportunities. Both require 2 fragments. | Stillwater                                               |
| Supply      | `!supply shield`, `!supply heal`, `!supply boost` | Absorb one strike; restore up to 2 health; or +50% movement for 15 seconds of active play.                               | Healing                                                  |
| Final gate  | `!charge`                                         | Distinct crew members meet an explicit preset of 1, 2, 5, or 10 to grant 12 seconds of protection.                       | 3 seconds of crossing grace; the storm remains dodgeable |

Each interaction lasts 18 seconds unless the streamer explicitly resolves early. Movement is held at the checkpoint. Presets are selected **before** a run and are never inferred from chat participants. No-viewer play is supported.

## Connect your Twitch channel

See [docs/TWITCH_SETUP.md](docs/TWITCH_SETUP.md) for the complete setup and verified official references. In brief:

1. Register your own confidential Twitch developer app, with exact redirect URL `http://localhost:4173/auth/twitch/callback`. Enable account 2FA and verify your email.
2. Copy `.env.example` to `.env` and enter `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET`. Keep the origin/redirect URL consistent; use **localhost**, not a different hostname, in your browser.
3. Restart the server, unlock controls, select **Twitch**, then **Authorize broadcaster**. Sign in as the broadcaster whose channel will supply commands. This app supports that one account/channel, not a separate cloud bot.
4. After the dashboard says connected, begin a **Twitch** expedition. In ordinary channel chat, use the displayed commands. Only the currently appropriate window accepts them.

The adapter implements OAuth authorization-code exchange, `user:read:chat` only, startup and 55-minute validation, expiry refresh, EventSub `channel.chat.message` v1, delivery deduplication, keepalive monitoring, session transfer, cold reconnect/resubscription, bounded backoff, revocation and rate-limit reset handling. It does not send messages to chat. **Live channel testing is pending** until you configure credentials and authorize the broadcaster. Synthetic tests are not proof of a live Twitch connection.

## Use the SDK

`packages/core` has no Twitch, Node, browser, or rendering dependencies. Build outputs include JavaScript and declarations. Both packages are private local workspaces; nothing is published to npm.

```ts
import { Interaction, parseCommand, BoundedSet } from "@checkpoint/core";

const windows = new Interaction(); // inject () => number for deterministic tests
const applied = new BoundedSet(128);
windows.subscribe((event) => {
  if (event.type !== "resolved" || !event.state.outcome) return;
  const outcome = event.state.outcome;
  if (applied.has(outcome.id)) return;
  applied.add(outcome.id);
  setRoute(outcome.value); // your own game effect
});
const window = windows.open(
  crypto.randomUUID(),
  {
    kind: "choice",
    command: "!route",
    options: ["left", "right"],
    fallback: "right",
  },
  18000,
);
const value = parseCommand("!route left", window.definition);
if (value !== undefined)
  windows.accept({
    windowId: window.id,
    deliveryId: "transport-event-123",
    userId: "stable-viewer-id",
    value,
    sentAt: Date.now(),
  });
// Call windows.tick() from your authoritative process loop.
// windows.pause(); windows.resume(); windows.resolve(); windows.cancel();
```

`setRoute` above belongs to the integrating game. For cooperative goals, use `{ kind: 'goal', command: '!charge', target: 2, fallback: 'unprotected' }` and normalized value `'charge'`. See the [architecture and guarantees](docs/ARCHITECTURE.md) for timing and lifecycle contracts.

## Security and data

The server binds to loopback by default. A fresh private random control code bootstraps HttpOnly, SameSite=Lax sessions lasting 12 hours. Every control mutation requires an exact Origin and authenticated cookie; OAuth uses a one-use expiring state bound to that session. Host checks defend against DNS rebinding. Public WebSockets are read-only, including sockets opened by an authenticated browser. Spectators can read public state, never mutate it. All inputs are validated, payloads and request rates are limited, and chat is never evaluated as code.

Twitch access/refresh tokens stay in server memory and are never sent to browser bundles, storage, state exports, logs, or overlay URLs. `.env` contains only your developer app configuration and is Git-ignored. By default there is no token file, chat transcript, analytics, database, or durable session. Only bounded transport IDs, current-window user participation, aggregates, and a 100-event inspector are retained in memory. The inspector omits chat text and user IDs. Reconnecting cannot replay missed Twitch chat. Restarting discards the run, tokens, cookies' server-side validity, and all windows.

This is a **single local authoritative process**. Ordinary static hosting cannot run its Twitch connection, game authority, or WebSocket server. No hosted instance has been deployed. Deliberate network exposure requires setting `HOST` and `PUBLIC_ORIGIN`, HTTPS, a WebSocket-capable reverse proxy, trusted access to the controller, and operational hardening beyond this local demo. Do not simply expose port 4173 to the public internet.

## Submission materials

- [Demo script under three minutes](docs/DEMO_SCRIPT.md)
- [Devpost draft](docs/DEVPOST_DRAFT.md)
- [Submission checklist with official sources](docs/SUBMISSION_CHECKLIST.md)
- [Verification record and pending live test](docs/VERIFICATION.md)

No video, deployment, npm release, published repository, or hackathon submission is claimed. To obtain the real Codex session ID, type **`/status` in the main thread where most of this project was built**, as documented in the [hackathon resources](https://twitchcon-codex.devpost.com/resources). Do not substitute a generated ID.

MIT licensed. Checkpoint focuses on explicit game-controlled participation windows; it does not claim to be the first Twitch SDK or voting system.
