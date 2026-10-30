import WebSocket from "ws";
import { z } from "zod";
import { BoundedSet } from "@checkpoint/core";
export type ChatMessage = {
  deliveryId: string;
  userId: string;
  text: string;
  sentAt: number;
};
export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "authorization-required";
export type TwitchConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};
const tokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
});
const validationSchema = z.object({
  client_id: z.string(),
  user_id: z.string(),
  login: z.string(),
  scopes: z.array(z.string()),
  expires_in: z.number(),
});
const metadata = z.object({
  message_id: z.string().max(256),
  message_type: z.string(),
  message_timestamp: z.string(),
  subscription_type: z.string().optional(),
});
const envelope = z.object({
  metadata,
  payload: z.object({
    session: z
      .object({
        id: z.string(),
        keepalive_timeout_seconds: z.number().nullable().optional(),
        reconnect_url: z.string().nullable().optional(),
      })
      .optional(),
    subscription: z
      .object({ type: z.string(), version: z.string().optional() })
      .passthrough()
      .optional(),
    event: z
      .object({
        broadcaster_user_id: z.string(),
        chatter_user_id: z.string(),
        message: z.object({ text: z.string().max(2000) }),
        source_broadcaster_user_id: z.string().nullable().optional(),
      })
      .passthrough()
      .optional(),
  }),
});

/** Installed, single-broadcaster EventSub client. No message sending or token persistence. */
export class TwitchAdapter {
  private tokens?: z.infer<typeof tokenSchema>;
  private identity?: z.infer<typeof validationSchema>;
  private expiresAt = 0;
  private socket?: WebSocket;
  private pendingTransfer?: WebSocket;
  private sockets = new Set<WebSocket>();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private health?: ReturnType<typeof setInterval>;
  private stopped = true;
  private generation = 0;
  private retry = 0;
  private refreshInFlight?: Promise<void>;
  private seen = new BoundedSet(4096);
  constructor(
    private config: TwitchConfig,
    private onChat: (input: ChatMessage) => void,
    private onStatus: (status: ConnectionStatus) => void,
    private request: typeof fetch = fetch,
    private createSocket: (url: string) => WebSocket = (url) =>
      new WebSocket(url, { maxPayload: 65536, handshakeTimeout: 10000 }),
  ) {}
  authorizationUrl(state: string) {
    const url = new URL("https://id.twitch.tv/oauth2/authorize");
    url.search = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: "code",
      scope: "user:read:chat",
      state,
      force_verify: "true",
    }).toString();
    return url.toString();
  }
  private async exchange(body: Record<string, string>) {
    const generation = this.generation;
    const response = await this.request("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      body: new URLSearchParams({
        ...body,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok)
      throw new Error(
        "Twitch authorization failed. Reconnect your broadcaster account.",
      );
    const tokens = tokenSchema.parse(await response.json());
    if (generation !== this.generation)
      throw new Error("Authorization was cancelled");
    this.tokens = tokens;
    this.expiresAt = Date.now() + tokens.expires_in * 1000;
  }
  async authorize(code: string) {
    this.stop();
    const generation = this.generation;
    await this.exchange({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.config.redirectUri,
    });
    if (generation !== this.generation)
      throw new Error("Authorization was cancelled");
    await this.validate();
    if (generation !== this.generation)
      throw new Error("Authorization was cancelled");
    this.stopped = false;
    this.retry = 0;
    this.onStatus("connecting");
    this.connect();
    this.scheduleValidation();
  }
  private async validate() {
    const generation = this.generation;
    if (!this.tokens) throw new Error("Authorization required");
    const response = await this.request(
      "https://id.twitch.tv/oauth2/validate",
      {
        headers: { Authorization: `OAuth ${this.tokens.access_token}` },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok) throw new Error("Authorization required");
    const identity = validationSchema.parse(await response.json());
    if (generation !== this.generation)
      throw new Error("Authorization was cancelled");
    if (
      identity.client_id !== this.config.clientId ||
      !identity.scopes.includes("user:read:chat") ||
      (this.identity && identity.user_id !== this.identity.user_id)
    )
      throw new Error("Authorization mismatch");
    this.identity = identity;
    this.expiresAt = Date.now() + identity.expires_in * 1000;
  }
  private scheduleValidation() {
    const generation = this.generation;
    clearInterval(this.health);
    this.health = setInterval(() => {
      if (!this.stopped && this.expiresAt - Date.now() < 120000)
        void this.refresh().catch(() => {
          if (generation === this.generation) this.revoke();
        });
    }, 30000);
    // Hourly validation is independent of expiry polling.
    const hourly = () =>
      this.later(() => {
        void this.validate()
          .then(() => {
            if (generation === this.generation) hourly();
          })
          .catch(() => {
            if (generation === this.generation) this.revoke();
          });
      }, 55 * 60000);
    hourly();
  }
  private async refresh() {
    if (this.refreshInFlight) return this.refreshInFlight;
    const generation = this.generation;
    this.refreshInFlight = (async () => {
      if (!this.tokens) throw new Error("Authorization required");
      await this.exchange({
        grant_type: "refresh_token",
        refresh_token: this.tokens.refresh_token,
      });
      if (generation !== this.generation)
        throw new Error("Authorization was cancelled");
      await this.validate();
    })().finally(() => {
      if (generation === this.generation) this.refreshInFlight = undefined;
    });
    return this.refreshInFlight;
  }
  private later(fn: () => void, ms: number) {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      if (!this.stopped) fn();
    }, ms);
    this.timers.add(timer);
    return timer;
  }
  private revoke() {
    this.stop();
    this.onStatus("authorization-required");
  }
  private reconnect() {
    if (this.stopped) return;
    if (++this.retry > 6) {
      this.onStatus("disconnected");
      return;
    }
    this.onStatus("reconnecting");
    this.later(
      () => this.connect(),
      Math.min(30000, 1000 * 2 ** (this.retry - 1)),
    );
  }
  private connect(url = "wss://eventsub.wss.twitch.tv/ws", transfer = false) {
    if (this.stopped || (transfer && this.pendingTransfer)) return;
    const generation = this.generation;
    const old = this.socket;
    const ws = this.createSocket(url);
    this.sockets.add(ws);
    if (!transfer) this.socket = ws;
    else this.pendingTransfer = ws;
    let alive = Date.now(),
      timeoutMs = 20000,
      welcomed = false;
    const watchdog = setInterval(() => {
      if (Date.now() - alive > timeoutMs + 5000) ws.terminate();
    }, 1000);
    ws.on("error", () => {
      /* close drives bounded retry; never log raw errors/tokens */
    });
    ws.on("message", (raw) => {
      void (async () => {
        if (this.stopped || generation !== this.generation) return;
        const parsed = envelope.safeParse(JSON.parse(raw.toString()));
        if (!parsed.success) return;
        const { metadata: meta, payload } = parsed.data;
        if (meta.message_type === "session_welcome" && payload.session) {
          if (welcomed) return;
          welcomed = true;
          timeoutMs = (payload.session.keepalive_timeout_seconds ?? 10) * 1000;
          alive = Date.now();
          if (transfer) {
            this.socket = ws;
            this.pendingTransfer = undefined;
            old?.close();
          } else {
            if (!(await this.subscribe(payload.session.id))) return;
          }
          if (
            this.stopped ||
            generation !== this.generation ||
            ws.readyState !== WebSocket.OPEN
          )
            return;
          this.retry = 0;
          this.onStatus("connected");
          return;
        }
        alive = Date.now();
        if (meta.message_type === "session_keepalive") return;
        if (meta.message_type === "revocation") {
          this.revoke();
          return;
        }
        if (
          meta.message_type === "session_reconnect" &&
          payload.session?.reconnect_url
        ) {
          const next = new URL(payload.session.reconnect_url);
          if (
            next.protocol !== "wss:" ||
            next.hostname !== "eventsub.wss.twitch.tv"
          )
            throw new Error("Invalid reconnect host");
          this.connect(payload.session.reconnect_url, true);
          return;
        }
        if (
          meta.message_type !== "notification" ||
          meta.subscription_type !== "channel.chat.message" ||
          payload.subscription?.type !== "channel.chat.message" ||
          !payload.event ||
          !this.identity
        )
          return;
        const event = payload.event,
          sentAt = Date.parse(meta.message_timestamp);
        if (
          !Number.isFinite(sentAt) ||
          Date.now() - sentAt > 10000 ||
          sentAt > Date.now() + 2000 ||
          this.seen.has(meta.message_id)
        )
          return;
        if (
          event.broadcaster_user_id !== this.identity.user_id ||
          (event.source_broadcaster_user_id &&
            event.source_broadcaster_user_id !== this.identity.user_id)
        )
          return;
        this.seen.add(meta.message_id);
        if (event.message.text.startsWith("!"))
          this.onChat({
            deliveryId: meta.message_id,
            userId: event.chatter_user_id,
            text: event.message.text,
            sentAt,
          });
      })().catch(() => {
        if (!this.stopped && generation === this.generation) ws.terminate();
      });
    });
    ws.on("close", () => {
      clearInterval(watchdog);
      this.sockets.delete(ws);
      if (this.pendingTransfer === ws) this.pendingTransfer = undefined;
      if (this.stopped || generation !== this.generation) return;
      if (ws === this.socket) {
        if (this.pendingTransfer) {
          this.onStatus("reconnecting");
          return;
        }
        this.reconnect();
      } else if (transfer && old?.readyState !== WebSocket.OPEN)
        this.reconnect();
    });
  }
  private async subscribe(
    sessionId: string,
    refreshed = false,
  ): Promise<boolean> {
    const generation = this.generation;
    if (!this.tokens || !this.identity)
      throw new Error("Authorization required");
    if (this.expiresAt < Date.now() + 60000) await this.refresh();
    if (generation !== this.generation || !this.tokens || !this.identity)
      return false;
    const body = {
      type: "channel.chat.message",
      version: "1",
      condition: {
        broadcaster_user_id: this.identity.user_id,
        user_id: this.identity.user_id,
      },
      transport: { method: "websocket", session_id: sessionId },
    };
    const response = await this.request(
      "https://api.twitch.tv/helix/eventsub/subscriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.tokens.access_token}`,
          "Client-Id": this.config.clientId,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      },
    );
    if (generation !== this.generation || this.stopped) return false;
    if (response.status === 401 && !refreshed) {
      try {
        await this.refresh();
      } catch {
        if (generation === this.generation) this.revoke();
        return false;
      }
      return this.subscribe(sessionId, true);
    }
    if (response.status === 401 || response.status === 403) {
      this.revoke();
      return false;
    }
    if (response.status === 429) {
      const header = response.headers.get("Ratelimit-Reset"),
        reset = header ? Number(header) * 1000 : NaN;
      this.stopSockets();
      this.onStatus("reconnecting");
      this.later(
        () => this.connect(),
        Math.min(
          3600000,
          Math.max(1000, Number.isFinite(reset) ? reset - Date.now() : 60000),
        ),
      );
      return false;
    }
    if (response.status !== 202)
      throw new Error("Subscription could not be created");
    return true;
  }
  private stopSockets() {
    this.socket = undefined;
    this.pendingTransfer = undefined;
    for (const ws of this.sockets) {
      ws.removeAllListeners("message");
      ws.close();
    }
  }
  stop() {
    this.stopped = true;
    this.generation++;
    this.refreshInFlight = undefined;
    clearInterval(this.health);
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    this.stopSockets();
    this.tokens = undefined;
    this.identity = undefined;
    this.onStatus("disconnected");
  }
}
