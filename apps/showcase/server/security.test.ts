import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import WebSocket from "ws";
import { createCheckpointServer } from "./index.js";
describe("control boundary", () => {
  let instance: Awaited<ReturnType<typeof createCheckpointServer>>,
    port: number,
    session = "";
  beforeAll(async () => {
    instance = await createCheckpointServer({
      production: true,
      origin: "http://localhost:4173",
    });
    await new Promise<void>((resolve) =>
      instance.server.listen(0, "127.0.0.1", resolve),
    );
    port = (instance.server.address() as { port: number }).port;
  });
  afterAll(async () => instance.close());
  const request = (
    route: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ) =>
    new Promise<{
      status: number;
      body: Record<string, unknown>;
      cookie: string[];
    }>((resolve, reject) => {
      const req = http.request(
        {
          hostname: "127.0.0.1",
          port,
          path: route,
          method: body ? "POST" : "GET",
          headers: {
            host: "localhost:4173",
            "Content-Type": "application/json",
            ...headers,
          },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
          });
          res.on("end", () =>
            resolve({
              status: res.statusCode!,
              body: JSON.parse(data),
              cookie: res.headers["set-cookie"] ?? [],
            }),
          );
        },
      );
      req.on("error", reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  it("allows spectators to read state without receiving credentials", async () => {
    const response = await request("/api/state");
    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).not.toContain(instance.controlCode);
  });
  it("rejects unauthenticated, cross-origin, malformed and DNS-rebound controls", async () => {
    expect(
      (
        await request(
          "/api/control",
          { type: "pause" },
          { origin: "http://localhost:4173" },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await request(
          "/api/login",
          { code: instance.controlCode },
          { origin: "https://evil.invalid" },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await request(
          "/api/login",
          { code: "😀".repeat(32) },
          { origin: "http://localhost:4173" },
        )
      ).status,
    ).toBe(403);
    expect(
      (await request("/api/state", undefined, { host: "evil.invalid" })).status,
    ).toBe(403);
  });
  it("issues a private HttpOnly session and requires Origin for every control", async () => {
    const response = await request(
      "/api/login",
      { code: instance.controlCode },
      { origin: "http://localhost:4173" },
    );
    expect(response.status).toBe(200);
    expect(response.cookie[0]).toContain("HttpOnly");
    expect(response.cookie[0]).toContain("SameSite=Lax");
    session = response.cookie[0].split(";")[0];
    expect(
      (await request("/api/control", { type: "pause" }, { cookie: session }))
        .status,
    ).toBe(403);
    expect(
      (
        await request(
          "/api/control",
          { type: "start", easy: true, crew: 2, mode: "simulator" },
          { cookie: session, origin: "http://localhost:4173" },
        )
      ).status,
    ).toBe(200);
  });
  it("rejects invalid controls, oversized messages, and live startup without authorization", async () => {
    const headers = { cookie: session, origin: "http://localhost:4173" };
    expect(
      (await request("/api/control", { type: "move", x: 500, y: 0 }, headers))
        .status,
    ).toBe(400);
    expect(
      (await request("/api/control", { type: "mark-outcome-applied" }, headers))
        .status,
    ).toBe(400);
    expect(
      (
        await request(
          "/api/control",
          { type: "start", easy: true, crew: 2, mode: "twitch" },
          headers,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await request(
          "/api/control",
          { type: "sim-input", text: "x".repeat(3000) },
          headers,
        )
      ).status,
    ).toBe(413);
  });
  it("makes all broadcast sockets read-only, even with a streamer cookie", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
      origin: "http://localhost:4173",
      headers: { Host: "localhost:4173", Cookie: session },
    });
    await new Promise<void>((resolve, reject) => {
      ws.once("open", resolve);
      ws.once("error", reject);
    });
    const closed = new Promise<number>((resolve) =>
      ws.once("close", (code) => resolve(code)),
    );
    ws.send(JSON.stringify({ type: "start" }));
    expect(await closed).toBe(1008);
  });
});
