# @checkpoint/twitch

Experimental **0.2.0**, MIT. Node **22.13+**, ESM only. This package depends on `@checkpoint/core`, `ws` (MIT), and `zod` (MIT). It is a server-side installed single-broadcaster OAuth/EventSub adapter; it is not safe for browser bundles because it handles the client secret and tokens.

Build from the repository root with `npm run build:packages`. Public imports come from `@checkpoint/twitch`; JavaScript and declarations are in `dist/`. Nothing is published to npm. To make a local archive run `npm pack -w @checkpoint/twitch --pack-destination .local/packages`; install a local core archive first in an external project.

For a strict TypeScript Node host, also install development declarations with `npm install --save-dev typescript @types/node @types/ws`. These are development tools, not core runtime dependencies. The adapter's declarations expose the optional WebSocket factory used for testing.

```ts
import { Interaction } from "@checkpoint/core";
import { TwitchAdapter } from "@checkpoint/twitch";

const windows = new Interaction();
const twitch = new TwitchAdapter(
  { clientId, clientSecret, redirectUri }, // server-owned app configuration
  (chat, window) => {
    if (chat.text.trim() !== "!cyan") return;
    return {
      windowId: window.id,
      participantId: `twitch:${chat.userId}`,
      inputId: `twitch:${chat.deliveryId}`,
      action: "cyan",
      sentAt: chat.sentAt,
    };
  },
  (status) => {
    if (status !== "connected") windows.pause();
    else windows.resume();
  },
);
twitch.start({
  currentWindow: () => windows.snapshot(),
  accept: (input) => windows.accept(input),
});
// Your authenticated server starts OAuth using authorizationUrl(csrfState).
// After verifying one-use session-bound state in your callback:
await twitch.authorize(code);
// twitch.stop() clears tokens, disconnects, and detaches the host.
```

The normalizer controls chat grammar and must map only eligible commands/actions. Window association uses validated provider timestamps; do not replay old chat into new windows. The adapter never implements a separate voting tally: normalized inputs go to `AdapterHost.accept`. `start` alone does not connect to Twitch. This snippet assumes your server has obtained explicit broadcaster authorization and verified callback state; it is not an OAuth server implementation.

The showcase provides the complete protected callback/session flow. Its setup is documented in the repository's `docs/TWITCH_SETUP.md`. Required scope is `user:read:chat`; subscription is `channel.chat.message` v1. Tokens are memory-only, validated at startup and every 55 minutes, with serialized refresh, cold reconnect, planned handover and revocation handling. No replay/crash durability is promised. `stop` requires another `start(host)` before reauthorization. Never pass secrets into a browser or log provider errors verbatim.

Real OAuth/EventSub and route, supply and one-person cooperative commands were verified through a winning showcase run on 1 November 2026. Reconnect, revocation and larger-crew scenarios have separate synthetic coverage. Every new host must register its own app and obtain explicit broadcaster authorization. API stability is not promised; see CHANGELOG.md. The repository's `docs/INTEGRATING_YOUR_GAME.md` explains the local archive workflow and host responsibilities.
