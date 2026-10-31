import { test, expect, type Page } from "@playwright/test";
import type { Expedition } from "../apps/showcase/server/game.js";
type Snapshot = ReturnType<Expedition["snapshot"]>;
const state = async (page: Page): Promise<Snapshot> =>
  (await page.request.get("/api/state", { maxRetries: 2 })).json();
async function unlock(page: Page) {
  await page.goto("/play");
  await page
    .getByLabel("Unlock streamer controls")
    .fill(process.env.CHECKPOINT_TEST_CODE!);
  await page.getByRole("button", { name: "Unlock console" }).click();
  await expect(page.getByText("Unlock streamer controls")).toHaveCount(0);
}
async function pilot(page: Page, x: number, y: number) {
  const held = new Set<string>();
  for (let i = 0; i < 160; i++) {
    const snapshot = await state(page),
      r = snapshot.run;
    if (r.status !== "playing") break;
    const dx = x - r.x,
      dy = y - r.y;
    if (Math.hypot(dx, dy) < 18) break;
    const wanted = new Set<string>();
    if (Math.abs(dx) > 10) wanted.add(dx > 0 ? "d" : "a");
    if (Math.abs(dy) > 10) wanted.add(dy > 0 ? "s" : "w");
    for (const key of held)
      if (!wanted.has(key)) {
        await page.keyboard.up(key);
        held.delete(key);
      }
    for (const key of wanted)
      if (!held.has(key)) {
        await page.keyboard.down(key);
        held.add(key);
      }
    await page.waitForTimeout(100);
  }
  for (const key of held) await page.keyboard.up(key);
}
async function reachCheckpoint(page: Page) {
  let snapshot = await state(page);
  if (snapshot.run.stage < 3)
    for (const f of snapshot.run.fragments.slice(0, 2))
      await pilot(page, f.x, f.y);
  await pilot(page, 910, 280);
  snapshot = await state(page);
  expect(snapshot.run.hp).toBeGreaterThan(0);
  expect(snapshot.run.status).toBe(
    snapshot.run.stage === 3 ? "won" : "checkpoint",
  );
}
async function resolve(page: Page) {
  await page.getByRole("button", { name: "Crew signal", exact: true }).click();
  await page
    .getByRole("button", { name: "Resolve crew window", exact: true })
    .click();
  await page.waitForTimeout(200);
}
test("complete a crew expedition, recover a simulated loss, inspect overlay and restart", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await unlock(page);
  await page.screenshot({
    path: "test-results/desktop-ready.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Begin expedition" }).click();
  await reachCheckpoint(page);
  await page.getByRole("button", { name: "!route left", exact: true }).click();
  await page.getByLabel("SYNTHETIC VIEWER").selectOption("moss");
  await page.getByRole("button", { name: "!route left", exact: true }).click();
  const overlay = await context.newPage();
  await overlay.goto("/overlay");
  await expect(overlay.getByText("Which way, crew?")).toBeVisible();
  await expect(
    overlay.getByText("2 accepted participants").first(),
  ).toBeVisible();
  expect(await overlay.getByRole("button").count()).toBe(0);
  const overlaySeconds = Number.parseInt(
    await overlay.locator(".countdown").innerText(),
  );
  expect(
    Math.abs(
      overlaySeconds -
        Math.ceil((await state(page)).window!.remainingMs / 1000),
    ),
  ).toBeLessThanOrEqual(1);
  await overlay.screenshot({
    path: "test-results/overlay-window.png",
    omitBackground: true,
  });
  await resolve(page);
  await expect(
    overlay.getByRole("heading", { name: "The Shatterpath", exact: true }),
  ).toBeVisible();
  await overlay.close();
  expect((await state(page)).run.route).toBe("left");
  expect((await state(page)).run.hazards).toHaveLength(6);
  await page.screenshot({
    path: "test-results/desktop-playing.png",
    fullPage: true,
  });
  await reachCheckpoint(page);
  const before = (await state(page)).window!.remainingMs;
  await page.request.post("/api/control", {
    headers: { origin: "http://localhost:4173" },
    data: { type: "sim-disconnect" },
  });
  await expect(page.getByText("Holding the signal.")).toBeVisible();
  await expect(page.locator(".paused-countdown")).toContainText(
    "seconds remain",
  );
  await page.waitForTimeout(500);
  expect((await state(page)).window!.remainingMs).toBeLessThanOrEqual(before);
  expect((await state(page)).window!.phase).toBe("paused");
  await page.request.post("/api/control", {
    headers: { origin: "http://localhost:4173" },
    data: { type: "sim-resume" },
  });
  await page
    .getByRole("button", { name: "!supply shield", exact: true })
    .click();
  await resolve(page);
  expect((await state(page)).run.shield).toBe(1);
  await reachCheckpoint(page);
  await page.getByRole("button", { name: "!charge", exact: true }).click();
  await page.getByLabel("SYNTHETIC VIEWER").selectOption("ada");
  await page.getByRole("button", { name: "!charge", exact: true }).click();
  await resolve(page);
  expect((await state(page)).run.fieldMs).toBeGreaterThan(10000);
  await reachCheckpoint(page);
  await expect(
    page.getByRole("heading", { name: "You brought it home." }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/desktop-win.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Start a new expedition" }).click();
  expect((await state(page)).run.stage).toBe(0);
  expect((await state(page)).run.total).toBe(0);
  expect((await state(page)).window).toBeUndefined();
  expect(errors).toEqual([]);
});

test("storm damage reaches the failure ending and restart clears the previous run", async ({
  page,
}) => {
  await unlock(page);
  await page.request.post("/api/control", {
    headers: { origin: "http://localhost:4173" },
    data: { type: "start", easy: false, crew: 2, mode: "simulator" },
  });
  const hazard = (await state(page)).run.hazards[0];
  await pilot(page, hazard.x, hazard.y);
  await expect
    .poll(async () => (await state(page)).run.status, { timeout: 35000 })
    .toBe("lost");
  await expect(
    page.getByRole("heading", { name: "Every light gets another chance." }),
  ).toBeVisible();
  expect((await state(page)).run.hp).toBe(0);
  await page.getByRole("button", { name: "Start a new expedition" }).click();
  expect((await state(page)).run.hp).toBe(5);
  expect((await state(page)).run.stage).toBe(0);
  expect((await state(page)).window).toBeUndefined();
});
test("complete a no-viewer expedition with the real timer and explicit fallbacks", async ({
  page,
}) => {
  await unlock(page);
  const current = await state(page);
  if (current.run.status !== "ready")
    await page.request.post("/api/control", {
      headers: { origin: "http://localhost:4173" },
      data: { type: "start", easy: true, crew: 1, mode: "simulator" },
    });
  else await page.getByRole("button", { name: "Begin expedition" }).click();
  await reachCheckpoint(page);
  await expect
    .poll(async () => (await state(page)).run.stage, { timeout: 22000 })
    .toBe(1);
  expect((await state(page)).run.route).toBe("right");
  for (let i = 0; i < 2; i++) {
    await reachCheckpoint(page);
    await resolve(page);
  }
  expect((await state(page)).window?.outcome).toMatchObject({
    value: "unprotected",
    participants: 0,
    fallback: true,
  });
  await reachCheckpoint(page);
  await expect(page.getByText("You brought it home.")).toBeVisible();
});
test("second integration works and mobile layout stays within the viewport", async ({
  page,
}) => {
  await page.goto("/example");
  await page.getByRole("button", { name: "Open a 10s choice" }).click();
  await page.getByRole("button", { name: "Vote cyan" }).click();
  await page.getByRole("button", { name: "Resolve", exact: true }).click();
  await expect(page.locator(".signal-lamp")).toHaveClass("signal-lamp cyan");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/play");
  await page.waitForTimeout(300);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
});

test("simulator inspector demonstrates duplicate, stale and disconnected fallback paths", async ({
  page,
}) => {
  await unlock(page);
  await page.request.post("/api/control", {
    headers: { origin: "http://localhost:4173" },
    data: { type: "start", easy: true, crew: 2, mode: "simulator" },
  });
  await reachCheckpoint(page);
  await page.goto("/dev");
  await page
    .getByLabel("Synthetic command", { exact: true })
    .fill("!route left");
  await page.getByRole("button", { name: "duplicate", exact: true }).click();
  await page.getByRole("button", { name: "duplicate", exact: true }).click();
  expect((await state(page)).window!.participants).toBe(1);
  expect(
    (await state(page)).events.some((event) => event.detail === "duplicate"),
  ).toBe(true);
  await page
    .getByLabel("Synthetic command", { exact: true })
    .fill("!route right");
  await page.getByRole("button", { name: "normal", exact: true }).click();
  expect((await state(page)).window!.counts.right).toBe(1);
  await page.getByRole("button", { name: "stale", exact: true }).click();
  expect(
    (await state(page)).events.some((event) => event.detail === "stale"),
  ).toBe(true);
  await page.getByRole("button", { name: "old-window", exact: true }).click();
  expect(
    (await state(page)).events.some((event) => event.detail === "closed"),
  ).toBe(true);
  await page
    .getByRole("button", { name: "sim-disconnect", exact: true })
    .click();
  await page.getByRole("button", { name: "Crew signal", exact: true }).click();
  await page
    .getByRole("button", { name: "Cancel & use fair fallback", exact: true })
    .click();
  expect((await state(page)).offlineContinuation).toBe(true);
  expect((await state(page)).connected).toBe(false);
  await page.goto("/play");
  await expect(page.getByText("Holding the signal.")).toHaveCount(0);
  await reachCheckpoint(page);
  expect((await state(page)).window!.phase).toBe("paused");
  await expect(page.getByText("Holding the signal.")).toBeVisible();
});
