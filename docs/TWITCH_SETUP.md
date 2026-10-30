# Twitch setup and transport policy

Documentation inspected on **30 October 2026**. Live authorization and chat verification remain pending. All adapter automated tests use synthetic messages and fake HTTP responses.

1. Use your own Twitch account with verified email and two-factor authentication. [Register an app](https://dev.twitch.tv/docs/authentication/register-app/) in the developer console; select a suitable game integration category and **Confidential** client type. Register the exact OAuth redirect URL `http://localhost:4173/auth/twitch/callback`.
2. Copy `.env.example` to `.env`. Enter the app's client ID and client secret. Keep the app secret private. Never use a `VITE_` prefix for secrets. No existing account credentials are discovered or used automatically.
3. Run `npm run build` then `npm start`. Unlock the dashboard with its private terminal code, choose **Twitch**, and click **Authorize broadcaster** before beginning a run. Authorize using the account whose channel you intend to read. The adapter uses the validated token's `user_id` for both `broadcaster_user_id` and `user_id` in its subscription.
4. Confirm **Twitch connected**. Begin a Twitch expedition, reach the first checkpoint, and have an ordinary channel participant send `!route left` or `!route right`. Observe accepted counts, resolve, and verify the next region has the appropriate hazard/fragment layout.
5. Test supply and gate with one/two participants and the corresponding preset. Disconnect authorization or transport only in a controlled test, then verify the pause/fallback behavior. Record the date, channel consent, and result in `VERIFICATION.md`, without chat transcripts, identities, tokens, or account secrets.

## Authentication

The server uses Twitch's [authorization code grant](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#authorization-code-grant-flow). A one-time OAuth state expires after five minutes and is bound to an authenticated controller session. The callback exchanges the authorization code via a server-to-server POST to `https://id.twitch.tv/oauth2/token`. Access/refresh tokens stay in memory. The OAuth browser redirect necessarily contains a short-lived authorization code, **never an access/refresh token**; no request URLs or raw OAuth errors are logged.

Installed single-user chat access requires only **`user:read:chat`**. We do not request chat write, `user:bot`, `channel:bot`, moderation, Bits, subscriptions, or Channel Points permissions. See [installed chatbot authentication](https://dev.twitch.tv/docs/chat/authenticating/) and [subscription requirements](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchatmessage). No Affiliate status or Extension review is required for this flow.

The token is [validated](https://dev.twitch.tv/docs/authentication/validate-tokens/) after exchange and every 55 minutes; the client ID, stable account ID, required scope, and expiry are checked. Refresh is serialized using the [documented refresh endpoint](https://dev.twitch.tv/docs/authentication/refresh-tokens/), keeping rotated refresh tokens only in memory. Expiry is checked every 30 seconds and refreshed within two minutes of expiry. Authorization errors or revocation end the connection visibly and require explicit reauthorization. There is no token persistence or offline recovery.

## EventSub

The adapter connects to `wss://eventsub.wss.twitch.tv/ws`, receives `session_welcome`, and creates one `channel.chat.message` **version 1** subscription with `POST https://api.twitch.tv/helix/eventsub/subscriptions`. It uses a **user access token**, `Client-Id`, and the welcomed session ID. Subscription creation is attempted within the welcome's ten-second requirement. The incoming event fields are `chatter_user_id` and `message.text`; the envelope's `metadata.message_id` is the delivery identity and `message_timestamp` supplies event time. Ordinary noncommand chat is not forwarded to the game.

The client responds to protocol ping through `ws` automatic pong support. A watchdog checks keepalive health. Server-directed session transfer uses the supplied `reconnect_url` unchanged (validated Twitch WSS hostname), retains the old socket until the new welcome, and does not create a duplicate subscription. Unexpected loss creates a new connection and subscription, with up to six exponentially delayed retries (1, 2, 4, 8, 16, 30 seconds); there is no replay. Revocation clears authorization. See [WebSocket handling](https://dev.twitch.tv/docs/eventsub/handling-websocket-events/).

Current documented WebSocket limits are 3 connections per client/user tuple, 300 subscriptions per connection, and total subscription cost 10. This integration ordinarily uses 1 connection / 1 subscription, temporarily overlapping only for planned transfer. API throttling uses Twitch's `Ratelimit-Reset` timestamp on HTTP 429 rather than immediate retry. Twitch describes its token bucket and `Ratelimit-*` response headers in [API rate limits](https://dev.twitch.tv/docs/api/guide/#twitch-rate-limits). This project sends **zero** chat announcements, so it does not consume chat-send limits.

## Local hosting

The callback and browser must use the configured `PUBLIC_ORIGIN`. OBS uses the same origin and is read-only. All URLs in `.env.example` refer to the local machine. A static host cannot keep the Node EventSub connection or authoritative state. A separate deployment needs explicit authorization and an operational HTTPS/WebSocket setup; none has been provisioned.
