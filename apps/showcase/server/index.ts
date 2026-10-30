import "dotenv/config";
import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import { z } from "zod";
import { TwitchAdapter } from "@checkpoint/twitch";
import { Expedition } from "./game.js";

export async function createCheckpointServer(
  options: { production?: boolean; origin?: string; port?: number } = {},
) {
  const app = express(),
    server = createServer(app),
    game = new Expedition();
  const origin =
    options.origin ?? process.env.PUBLIC_ORIGIN ?? "http://localhost:4173";
  const publicUrl = new URL(origin);
  const secret = randomBytes(32).toString("hex");
  const sessions = new Map<string, number>();
  const oauthStates = new Map<string, { session: string; expires: number }>();
  let adapter: TwitchAdapter | undefined;
  let controlLease: { session: string; expires: number } | undefined;
  const equal = (a: string, b: string) =>
    a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
  const cookie = (req: Request) =>
    /(?:^|;\s*)checkpoint_control=([a-f0-9]{64})(?:;|$)/.exec(
      req.headers.cookie ?? "",
    )?.[1] ?? "";
  const authenticated = (req: Request) =>
    (sessions.get(cookie(req)) ?? 0) > Date.now();
  const sameOrigin = (req: Request) => req.headers.origin === origin;
  const limited = new Map<string, { count: number; until: number }>();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    if (req.headers.host !== publicUrl.host) {
      res
        .status(403)
        .json({ error: "Host not allowed. Use the configured PUBLIC_ORIGIN." });
      return;
    }
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "no-store",
      "X-Frame-Options": "DENY",
    });
    if (options.production)
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      );
    const key = req.socket.remoteAddress ?? "local",
      now = Date.now();
    let rate = limited.get(key);
    if (!rate || rate.until < now) {
      rate = { count: 0, until: now + 1000 };
      limited.set(key, rate);
    }
    if (++rate.count > 100) {
      res.status(429).json({ error: "Slow down" });
      return;
    }
    if (limited.size > 1000) limited.delete(limited.keys().next().value!);
    next();
  });
  app.use(express.json({ limit: "2kb" }));
  app.get("/api/session", (req, res) =>
    res.json({
      authenticated: authenticated(req),
      twitchConfigured: Boolean(
        process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET,
      ),
    }),
  );
  app.post("/api/login", (req, res) => {
    if (
      !sameOrigin(req) ||
      typeof req.body?.code !== "string" ||
      !/^[a-f0-9]{64}$/.test(req.body.code) ||
      !equal(req.body.code, secret)
    ) {
      res.status(403).json({ error: "Invalid control code or origin" });
      return;
    }
    if (sessions.size >= 8) sessions.delete(sessions.keys().next().value!);
    const session = randomBytes(32).toString("hex");
    sessions.set(session, Date.now() + 12 * 3600000);
    // Lax allows Twitch's top-level OAuth return; control POSTs also require exact Origin.
    res.cookie("checkpoint_control", session, {
      httpOnly: true,
      sameSite: "lax",
      secure: publicUrl.protocol === "https:",
      path: "/",
      maxAge: 12 * 3600000,
    });
    res.json({ ok: true });
  });
  app.get("/api/state", (_req, res) => res.json(game.snapshot()));
  app.use("/api/control", (req, res, next) => {
    if (!sameOrigin(req) || !authenticated(req)) {
      res
        .status(403)
        .json({ error: "Authenticated streamer session required" });
      return;
    }
    next();
  });
  const command = z.discriminatedUnion("type", [
    z.object({
      type: z.literal("start"),
      easy: z.boolean(),
      crew: z.union([z.literal(1), z.literal(2), z.literal(5), z.literal(10)]),
      mode: z.enum(["simulator", "twitch"]),
    }),
    z.object({
      type: z.literal("move"),
      x: z.number().min(-1).max(1),
      y: z.number().min(-1).max(1),
    }),
    ...(
      [
        "pause",
        "resume",
        "resolve",
        "fallback",
        "logout",
        "sim-disconnect",
        "sim-resume",
        "duplicate-outcome",
        "twitch-disconnect",
      ] as const
    ).map((type) => z.object({ type: z.literal(type) })),
    z.object({
      type: z.literal("sim-input"),
      text: z.string().max(128),
      user: z.enum(["ada", "moss", "nova", "sol"]),
      scenario: z
        .enum(["normal", "duplicate", "stale", "old-window"])
        .default("normal"),
    }),
  ]);
  app.post("/api/control", (req, res) => {
    const parsed = command.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid control message" });
      return;
    }
    const c = parsed.data;
    if (c.type === "start") {
      if (c.mode === "twitch" && game.transportStatus !== "connected") {
        res
          .status(409)
          .json({ error: "Connect Twitch before starting live mode" });
        return;
      }
      if (c.mode === "simulator") {
        adapter?.stop();
        game.setTransport(true, "simulator-ready");
      }
      game.start(c.easy, c.crew, c.mode);
    } else if (c.type === "move") {
      const session = cookie(req);
      if (
        controlLease &&
        controlLease.expires > Date.now() &&
        controlLease.session !== session
      ) {
        res.status(409).json({ error: "Another streamer is piloting" });
        return;
      }
      controlLease = { session, expires: Date.now() + 1000 };
      game.movement(c.x, c.y);
    } else if (c.type === "pause") game.pause();
    else if (c.type === "resume") game.resume();
    else if (c.type === "resolve") {
      if (!game.paused && game.connected) game.interaction.resolve();
    } else if (c.type === "fallback") game.fallback();
    else if (c.type === "logout") {
      sessions.delete(cookie(req));
      game.pause();
      res.clearCookie("checkpoint_control", { path: "/" });
      res.clearCookie("checkpoint_control", { path: "/api" });
    } else if (c.type === "twitch-disconnect") {
      adapter?.stop();
      game.setTransport(false, "disconnected");
    } else if (c.type.startsWith("sim-") || c.type === "duplicate-outcome") {
      if (game.mode !== "simulator") {
        res
          .status(409)
          .json({ error: "Synthetic input is disabled in Twitch mode" });
        return;
      }
      if (c.type === "sim-disconnect")
        game.setTransport(false, "simulator-disconnected");
      else if (c.type === "sim-resume")
        game.setTransport(true, "simulator-ready");
      else if (c.type === "duplicate-outcome") {
        const outcome = game.interaction.snapshot()?.outcome;
        if (outcome) {
          game.applyOutcome(outcome);
          game.applyOutcome(outcome);
        }
      } else if (c.type === "sim-input") {
        const id =
          c.scenario === "duplicate"
            ? "sim-duplicate-delivery"
            : randomBytes(12).toString("hex");
        const result = game.input(
          c.text,
          `sim:${c.user}`,
          id,
          Date.now() - (c.scenario === "stale" ? 30000 : 0),
          c.scenario === "old-window" ? "retired-window" : undefined,
        );
        res.json({ ok: true, result });
        return;
      }
    }
    res.json({ ok: true });
  });
  app.post("/api/control/twitch", (req, res) => {
    if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) {
      res.status(409).json({
        error: "Add Twitch client credentials to .env and restart the server",
      });
      return;
    }
    if (
      (game.run.status === "playing" || game.run.status === "checkpoint") &&
      game.mode !== "twitch"
    ) {
      res.status(409).json({
        error: "Finish the simulator expedition before authorizing Twitch",
      });
      return;
    }
    adapter?.stop();
    adapter = new TwitchAdapter(
      {
        clientId: process.env.TWITCH_CLIENT_ID,
        clientSecret: process.env.TWITCH_CLIENT_SECRET,
        redirectUri:
          process.env.TWITCH_REDIRECT_URI ?? `${origin}/auth/twitch/callback`,
      },
      (chat) => {
        if (game.mode === "twitch")
          game.input(chat.text, chat.userId, chat.deliveryId, chat.sentAt);
      },
      (status) => game.setTransport(status === "connected", status),
    );
    const state = randomBytes(24).toString("hex");
    if (oauthStates.size >= 8)
      oauthStates.delete(oauthStates.keys().next().value!);
    oauthStates.set(state, {
      session: cookie(req),
      expires: Date.now() + 300000,
    });
    res.json({ url: adapter.authorizationUrl(state) });
  });
  app.get("/auth/twitch/callback", async (req, res) => {
    const state = typeof req.query.state === "string" ? req.query.state : "",
      pending = oauthStates.get(state);
    oauthStates.delete(state);
    if (
      !pending ||
      pending.expires < Date.now() ||
      pending.session !== cookie(req) ||
      !authenticated(req) ||
      typeof req.query.code !== "string" ||
      !adapter
    ) {
      res
        .status(403)
        .send(
          "Authorization could not be verified. Return to /play and connect again.",
        );
      return;
    }
    try {
      await adapter.authorize(req.query.code);
      res.redirect("/play");
    } catch {
      adapter.stop();
      game.setTransport(false, "authorization-required");
      res
        .status(502)
        .send("Twitch authorization failed. Return to /play and reconnect.");
    }
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 2048 });
  server.on("upgrade", (req, socket, head) => {
    // In development Vite owns its separate HMR upgrade route.
    if (req.url !== "/ws") {
      if (options.production) socket.destroy();
      return;
    }
    if (
      req.headers.origin !== origin ||
      req.headers.host !== publicUrl.host ||
      wss.clients.size >= 32
    ) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });
  wss.on("connection", (ws) => {
    ws.send(JSON.stringify(game.snapshot()));
    ws.on("error", () => {});
    ws.on("message", () => ws.close(1008, "Read-only stream"));
  });
  const tick = setInterval(() => game.tick(1000 / 30), 1000 / 30);
  const broadcast = setInterval(() => {
    const data = JSON.stringify(game.snapshot());
    for (const ws of wss.clients)
      if (ws.readyState === WebSocket.OPEN) {
        if (ws.bufferedAmount > 256000) ws.terminate();
        else ws.send(data);
      }
  }, 100);
  let vite:
    Awaited<ReturnType<(typeof import("vite"))["createServer"]>> | undefined;
  if (options.production) {
    const client = path.resolve("apps/showcase/dist");
    app.use(express.static(client));
    app.get("/{*path}", (_req, res) =>
      res.sendFile(path.join(client, "index.html")),
    );
  } else {
    const { createServer: createVite } = await import("vite");
    vite = await createVite({
      configFile: path.resolve("apps/showcase/vite.config.ts"),
      server: { middlewareMode: true, ws: { server } },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }
  app.use(
    (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      const status =
        typeof error === "object" &&
        error &&
        "status" in error &&
        typeof error.status === "number"
          ? error.status
          : 500;
      res.status(status).json({
        error:
          status === 413
            ? "Message too large"
            : "Request could not be processed",
      });
    },
  );
  return {
    server,
    game,
    controlCode: secret,
    close: async () => {
      clearInterval(tick);
      clearInterval(broadcast);
      adapter?.stop();
      for (const ws of wss.clients) ws.terminate();
      wss.close();
      await vite?.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const port = Number(process.env.PORT ?? 4173),
    origin = process.env.PUBLIC_ORIGIN ?? `http://localhost:${port}`;
  const instance = await createCheckpointServer({
    production:
      process.env.NODE_ENV === "production" ||
      import.meta.url.includes("dist-server"),
    origin,
  });
  instance.server.listen(port, process.env.HOST ?? "127.0.0.1", () => {
    console.log(
      `\n  CHECKPOINT · The Last Beacon\n  ${origin}/play\n  Streamer control code (keep private): ${instance.controlCode}\n  /overlay is read-only. /dev contains synthetic tools.\n`,
    );
  });
  const shutdown = () => {
    void instance.close().then(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
