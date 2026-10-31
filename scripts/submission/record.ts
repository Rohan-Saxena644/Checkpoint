import { chromium, type Page, type BrowserContext } from "@playwright/test";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { createCheckpointServer } from "../../apps/showcase/server/index.js";
import type { Expedition } from "../../apps/showcase/server/game.js";
import { capture } from "./capture.js";

// Capture only synthetic UI, never OAuth, credentials, desktop, or real chat.
type Snapshot = ReturnType<Expedition["snapshot"]>;
const origin = "http://localhost:4175";
const output = path.resolve("submission/footage");
await mkdir(output, { recursive: true });
const instance = await createCheckpointServer({ production: true, origin });
await new Promise<void>((resolve) =>
  instance.server.listen(4175, "127.0.0.1", resolve),
);
const browser = await chromium.launch();
const markers: { clip: string; at: number; event: string }[] = [];
const verified: string[] = [];
const resume = process.argv.includes("--resume");
if (resume) {
  const previous = JSON.parse(
    await readFile(path.join(output, "capture-report.json"), "utf8"),
  );
  markers.push(
    ...previous.markers.filter((marker: { clip: string }) =>
      ["simulated-expedition", "simulated-reliability"].includes(marker.clip),
    ),
  );
  verified.push(...previous.verified);
}
const captures = new Map<Page, () => Promise<void>>();
let clip = "",
  epoch = 0;
const mark = (event: string) => {
  const at = (performance.now() - epoch) / 1000;
  markers.push({ clip, at, event });
  console.log(`${clip} ${at.toFixed(1)}s: ${event}`);
};
const state = async (page: Page): Promise<Snapshot> =>
  (await page.request.get(`${origin}/api/state`, { maxRetries: 2 })).json();
async function until(
  page: Page,
  predicate: (snapshot: Snapshot) => boolean,
  timeout = 25000,
) {
  const deadline = performance.now() + timeout;
  while (performance.now() < deadline) {
    const value = await state(page);
    if (predicate(value)) return value;
    if (value.run.status === "lost")
      throw new Error("Courier lost during capture");
    await page.waitForTimeout(100);
  }
  throw new Error("Expected normal game transition did not occur");
}
async function pilot(page: Page, x: number, y: number) {
  const held = new Set<string>();
  try {
    for (let step = 0; step < 220; step++) {
      const snapshot = await state(page);
      if (snapshot.run.status !== "playing") break;
      const dx = x - snapshot.run.x,
        dy = y - snapshot.run.y;
      if (Math.hypot(dx, dy) < 17) return;
      const desired = new Set<string>();
      if (Math.abs(dx) > 10) desired.add(dx > 0 ? "d" : "a");
      if (Math.abs(dy) > 10) desired.add(dy > 0 ? "s" : "w");
      for (const key of held)
        if (!desired.has(key)) {
          await page.keyboard.up(key);
          held.delete(key);
        }
      for (const key of desired)
        if (!held.has(key)) {
          await page.keyboard.down(key);
          held.add(key);
        }
      await page.waitForTimeout(100);
    }
  } finally {
    for (const key of held) await page.keyboard.up(key);
  }
}
async function checkpoint(page: Page) {
  await page.getByRole("button", { name: "Crew signal", exact: true }).click();
  await page
    .getByRole("button", { name: "Lock streamer controls", exact: true })
    .waitFor();
  const snapshot = await state(page);
  if (snapshot.run.stage < 3)
    for (const fragment of snapshot.run.fragments.slice(0, 2))
      await pilot(page, fragment.x, fragment.y);
  await pilot(page, 910, 280);
  assert.equal(
    (await state(page)).run.status,
    snapshot.run.stage === 3 ? "won" : "checkpoint",
  );
}
async function context() {
  const result = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
  });
  // Bootstrap private controller session before any page/video exists. Never print the code.
  const response = await result.request.post(`${origin}/api/login`, {
    headers: { origin },
    data: { code: instance.controlCode },
  });
  assert.equal(response.status(), 200);
  return result;
}
async function finish(ctx: BrowserContext, page: Page, _filename: string) {
  await captures.get(page)!();
  captures.delete(page);
  await page.close();
  await ctx.close();
  await writeFile(
    path.join(output, "capture-report.json"),
    JSON.stringify(
      {
        complete: false,
        evidence: "SIMULATED GAMEPLAY AND ACTUAL DEVELOPMENT EXAMPLE ONLY",
        liveTwitchVerified: false,
        codexDesktopCaptured: false,
        markers,
        verified,
      },
      null,
      2,
    ),
  );
}
async function recordedPage(ctx: BrowserContext, filename: string) {
  const page = await ctx.newPage();
  captures.set(page, await capture(browser, page, path.join(output, filename)));
  return page;
}
async function selectCrew(page: Page, user: string, command: string) {
  if ((await page.getByLabel("SYNTHETIC VIEWER").inputValue()) !== user)
    await page.getByLabel("SYNTHETIC VIEWER").selectOption(user);
  await page.getByRole("button", { name: command, exact: true }).click();
}
try {
  if (!resume) {
    clip = "simulated-expedition";
    epoch = performance.now();
    const ctx = await context();
    const page = await recordedPage(ctx, "simulated-expedition.mp4");
    await page.goto(`${origin}/play`);
    await page.getByRole("button", { name: "Begin expedition" }).click();
    await page
      .getByRole("button", { name: "Crew signal", exact: true })
      .click();
    mark("gameplay-start");
    const observer = await browser.newContext({
      viewport: { width: 640, height: 1000 },
    });
    const overlay = await observer.newPage();
    await overlay.goto(`${origin}/overlay`);
    await page.bringToFront();
    const unauthorized = await observer.request.post(`${origin}/api/control`, {
      headers: { origin },
      data: { type: "pause" },
    });
    assert.equal(unauthorized.status(), 403);
    verified.push("Unauthenticated overlay control POST rejected with 403");
    await checkpoint(page);
    mark("route-window-open");
    await page.waitForTimeout(1000);
    await selectCrew(page, "ada", "!route left");
    mark("route-first-accepted");
    await page.waitForTimeout(900);
    await selectCrew(page, "moss", "!route left");
    assert.equal((await state(page)).window?.participants, 2);
    mark("route-two-accepted");
    await overlay.getByText("2 accepted participants").first().waitFor();
    await overlay.screenshot({
      path: path.join(output, "overlay-window.png"),
      omitBackground: true,
    });
    await page.bringToFront();
    const route = await until(page, (s) => s.run.stage === 1);
    assert.equal(route.run.route, "left");
    assert.equal(route.run.hazards.length, 6);
    mark("route-outcome-applied");
    await page.screenshot({ path: path.join(output, "route-effect.png") });
    verified.push(
      "Route: two synthetic participants, full 18s deadline, 6-hazard Shatterpath",
    );
    await checkpoint(page);
    mark("supply-window-open");
    await selectCrew(page, "ada", "!supply shield");
    mark("supply-accepted");
    await until(page, (s) => s.run.stage === 2);
    assert.equal((await state(page)).run.shield, 1);
    mark("shield-delivered");
    const hazard = (await state(page)).run.hazards[0];
    const hp = (await state(page)).run.hp;
    await pilot(page, hazard.x, hazard.y);
    await until(page, (s) => s.run.shield === 0, 10000);
    assert.equal((await state(page)).run.hp, hp);
    mark("shield-absorbed-strike");
    verified.push(
      "Supply shield visibly absorbed a real storm strike without losing health",
    );
    await checkpoint(page);
    mark("goal-window-open");
    await selectCrew(page, "ada", "!charge");
    mark("goal-first-accepted");
    await selectCrew(page, "ada", "!charge");
    assert.equal((await state(page)).window?.participants, 1);
    verified.push(
      "Repeated charge from same synthetic participant did not increase count",
    );
    await page.waitForTimeout(1000);
    await selectCrew(page, "moss", "!charge");
    mark("goal-two-accepted");
    await until(page, (s) => s.run.stage === 3);
    assert((await state(page)).run.fieldMs > 10000);
    mark("protective-field-applied");
    await checkpoint(page);
    mark("win");
    await page.screenshot({ path: path.join(output, "win.png") });
    await page.waitForTimeout(12000);
    await page.getByRole("button", { name: "Start a new expedition" }).click();
    assert.equal((await state(page)).window, undefined);
    mark("restart-clean");
    verified.push(
      "Complete expedition, two-person goal, win, and clean restart via UI",
    );
    await observer.close();
    await finish(ctx, page, "simulated-expedition.mp4");

    clip = "simulated-reliability";
    epoch = performance.now();
    const lab = await context();
    const dev = await recordedPage(lab, "simulated-reliability.mp4");
    await dev.goto(`${origin}/play`);
    await checkpoint(dev);
    await dev.goto(`${origin}/dev`);
    await dev.getByRole("button", { name: "Crew signal", exact: true }).click();
    const field = dev.getByLabel("Synthetic command", { exact: true });
    await field.fill("!route left");
    await dev.getByRole("button", { name: "duplicate", exact: true }).click();
    await dev.getByRole("button", { name: "duplicate", exact: true }).click();
    assert.equal((await state(dev)).window?.participants, 1);
    await field.fill("!route right");
    await dev.getByRole("button", { name: "normal", exact: true }).click();
    assert.equal((await state(dev)).window?.counts.right, 1);
    await field.fill("!route banana");
    await dev.getByRole("button", { name: "normal", exact: true }).click();
    await field.fill("!route left");
    await dev.getByRole("button", { name: "stale", exact: true }).click();
    mark("invalid-duplicate-repeated-late-demonstrated");
    await dev
      .getByRole("button", { name: "sim-disconnect", exact: true })
      .click();
    const remaining = (await state(dev)).window!.remainingMs;
    await dev.goto(`${origin}/play`);
    mark("simulated-disconnect");
    await dev.waitForTimeout(5000);
    assert.equal((await state(dev)).window!.remainingMs, remaining);
    await dev.screenshot({ path: path.join(output, "paused.png") });
    await dev.goto(`${origin}/dev`);
    await dev.getByRole("button", { name: "sim-resume", exact: true }).click();
    await dev.goto(`${origin}/play`);
    assert.equal((await state(dev)).window?.phase, "open");
    mark("simulated-resume");
    await until(dev, (s) => s.run.stage === 1);
    await dev.goto(`${origin}/dev`);
    await dev
      .getByRole("button", { name: "duplicate-outcome", exact: true })
      .click();
    assert.equal((await state(dev)).run.stage, 1);
    mark("duplicate-outcome-ignored");
    await dev.waitForTimeout(3000);
    verified.push(
      "Simulator invalid, repeated, duplicate-delivery, stale inputs; 5s disconnection froze timer; resume and duplicate-outcome guard",
    );
    await finish(lab, dev, "simulated-reliability.mp4");
  }
  clip = "sdk-example";
  epoch = performance.now();
  const sdk = await context();
  const example = await recordedPage(sdk, "sdk-example.mp4");
  await example.goto(`${origin}/example`);
  mark("example-start");
  await example.getByRole("button", { name: "Open a 10s choice" }).click();
  await example.getByRole("button", { name: "Vote cyan" }).click();
  await example.waitForTimeout(11000);
  assert.equal(
    await example.locator(".signal-lamp").getAttribute("class"),
    "signal-lamp cyan",
  );
  mark("example-resolved");
  const code = await readFile("examples/signal-panel.ts", "utf8");
  const result = execFileSync(
    process.execPath,
    ["--import", "tsx", "examples/signal-panel.ts"],
    { encoding: "utf8" },
  ).trim();
  const escape = (value: string) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  const lines = code.split("\n"),
    half = Math.ceil(lines.length / 2);
  await example.setContent(
    `<html><head><style>body{background:#0b111b;color:#dae5e6;font:22px/1.5 system-ui;margin:30px}h1{font-size:28px;color:#efbd77}main{display:grid;grid-template-columns:1fr 1fr;gap:18px}pre{font:16px/1.4 Consolas,monospace;background:#14212a;padding:18px;white-space:pre-wrap}strong{color:#92dbbf}</style></head><body><h1>ACTUAL REPOSITORY SOURCE · examples/signal-panel.ts</h1><main><pre>${escape(lines.slice(0, half).join("\n"))}</pre><pre>${escape(lines.slice(half).join("\n"))}</pre></main><strong>ACTUAL NODE OUTPUT: ${escape(result)}</strong></body></html>`,
  );
  mark("actual-source-and-executed-result");
  await example.waitForTimeout(16000);
  await finish(sdk, example, "sdk-example.mp4");
  verified.push(
    "Actual local-button example and executed repository CLI result captured (development evidence, not Codex desktop)",
  );

  clip = "simulated-no-viewer-failure";
  epoch = performance.now();
  const last = await context();
  const failure = await recordedPage(last, "simulated-no-viewer-failure.mp4");
  await failure.goto(`${origin}/play`);
  if ((await state(failure)).run.status === "ready")
    await failure.getByRole("button", { name: "Begin expedition" }).click();
  const expectedStage = (await state(failure)).run.stage + 1;
  await checkpoint(failure);
  mark("no-viewer-window-open");
  await until(failure, (s) => s.run.stage === expectedStage);
  assert.equal((await state(failure)).window?.outcome?.fallback, true);
  assert.equal((await state(failure)).window?.outcome?.participants, 0);
  mark("no-viewer-fallback");
  // Normal damage, no state injection: deliberately stand inside a storm ring.
  const h = (await state(failure)).run.hazards[0];
  await pilot(failure, h.x, h.y);
  mark("intentional-storm-damage");
  const deathDeadline = performance.now() + 50000;
  while (
    (await state(failure)).run.status !== "lost" &&
    performance.now() < deathDeadline
  )
    await failure.waitForTimeout(150);
  assert.equal((await state(failure)).run.status, "lost");
  mark("failure-ending");
  await failure.screenshot({ path: path.join(output, "failure.png") });
  await failure.waitForTimeout(4000);
  await failure.getByRole("button", { name: "Start a new expedition" }).click();
  assert.equal((await state(failure)).run.stage, 0);
  assert.equal((await state(failure)).window, undefined);
  mark("restart-after-failure");
  await failure.waitForTimeout(3000);
  await finish(last, failure, "simulated-no-viewer-failure.mp4");
  verified.push(
    "No-viewer natural choice fallback, real storm damage, failure ending, and clean restart",
  );
  await writeFile(
    path.join(output, "capture-report.json"),
    JSON.stringify(
      {
        complete: true,
        evidence: "SIMULATED GAMEPLAY AND ACTUAL DEVELOPMENT EXAMPLE ONLY",
        liveTwitchVerified: false,
        codexDesktopCaptured: false,
        timing:
          "Normal game speed and full natural 18-second windows; no teleports or automatic fake participants",
        viewport: { width: 1600, height: 1000 },
        encodedVideo: {
          width: 1280,
          height: 800,
          targetFps: 10,
          source:
            "Actual CDP browser frames; static frames held at their real wall-clock duration",
        },
        markers,
        verified,
      },
      null,
      2,
    ),
  );
  console.log(
    "Capture complete. Real Twitch and genuine Codex desktop evidence remain missing.",
  );
} catch {
  // Playwright's raw HTTP errors can include session headers: never print them.
  console.error(
    "Capture stopped before completion. Retain only finalized clips; inspect the sanitized capture report and rerun --resume if needed.",
  );
  process.exitCode = 1;
} finally {
  await browser.close();
  await instance.close();
}
