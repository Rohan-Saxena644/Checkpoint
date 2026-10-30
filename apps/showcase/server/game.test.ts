import { describe, it, expect } from "vitest";
import { Expedition } from "./game.js";
function checkpoint(game: Expedition) {
  game.run.collected = 2;
  game.run.x = 910;
  game.run.y = 280;
  game.tick(33);
}
describe("authoritative expedition", () => {
  it("boost counts down only during active play and healing stays within max health", () => {
    const game = new Expedition();
    game.start(true, 1, "simulator");
    checkpoint(game);
    game.interaction.resolve();
    checkpoint(game);
    game.input("!supply boost", "ada");
    game.interaction.resolve();
    expect(game.run.boostMs).toBe(15000);
    game.pause();
    game.tick(1000);
    expect(game.run.boostMs).toBe(15000);
    game.resume();
    game.tick(16000);
    expect(game.run.boostMs).toBe(0);
    game.start(true, 1, "simulator");
    checkpoint(game);
    game.interaction.resolve();
    checkpoint(game);
    game.input("!supply heal", "ada");
    game.interaction.resolve();
    expect(game.run.hp).toBe(game.run.maxHp);
  });
  it("applies choice outcomes once, with actual route differences", () => {
    const game = new Expedition();
    game.start(true, 2, "simulator");
    checkpoint(game);
    game.input("!route left", "ada");
    const outcome = game.interaction.resolve()!;
    expect(game.run.route).toBe("left");
    expect(game.run.hazards.length).toBe(6);
    expect(game.applyOutcome(outcome)).toBe(false);
    expect(game.run.stage).toBe(1);
  });
  it("finishes all three windows with fair no-viewer fallbacks", () => {
    const game = new Expedition();
    game.start(true, 1, "simulator");
    for (let i = 0; i < 3; i++) {
      checkpoint(game);
      game.interaction.resolve();
    }
    expect(game.run.route).toBe("right");
    expect(game.run.supply).toBe("heal");
    expect(game.run.fieldMs).toBe(3000);
    checkpoint(game);
    expect(game.run.status).toBe("won");
    game.start(true, 2, "simulator");
    expect(game.run.status).toBe("playing");
    expect(game.run.stage).toBe(0);
    expect(game.run.total).toBe(0);
  });
  it("freezes movement and deadline on disconnected transport", () => {
    let now = 1000;
    const game = new Expedition(() => now);
    game.start(true, 2, "simulator");
    checkpoint(game);
    game.setTransport(false, "disconnected");
    const remaining = game.interaction.snapshot()?.remainingMs;
    now += 30000;
    game.tick(1000);
    expect(game.interaction.snapshot()?.remainingMs).toBe(remaining);
    expect(game.input("!route left", "a").reason).toBe("disconnected");
    game.setTransport(true, "connected");
    expect(game.interaction.snapshot()?.phase).toBe("open");
  });
  it("manual pause stays paused after transport recovery", () => {
    const game = new Expedition();
    game.start(true, 2, "simulator");
    checkpoint(game);
    game.pause();
    game.setTransport(false, "disconnected");
    game.setTransport(true, "connected");
    expect(game.interaction.snapshot()?.phase).toBe("paused");
  });
  it("explicit fallback allows disconnected play without faking connection or synthetic crew", () => {
    const game = new Expedition();
    game.start(true, 2, "twitch");
    checkpoint(game);
    game.setTransport(false, "disconnected");
    game.fallback();
    expect(game.connected).toBe(false);
    expect(game.offlineContinuation).toBe(true);
    expect(game.mode).toBe("twitch");
    game.movement(1, 0);
    game.tick(100);
    expect(game.run.x).toBeGreaterThan(70);
    checkpoint(game);
    expect(game.interaction.snapshot()?.phase).toBe("paused");
    expect(game.offlineContinuation).toBe(false);
  });
  it("shield absorbs one hit and healing is capped", () => {
    const game = new Expedition();
    game.start(true, 1, "simulator");
    checkpoint(game);
    game.interaction.resolve();
    checkpoint(game);
    game.input("!supply shield", "ada");
    game.interaction.resolve();
    expect(game.run.shield).toBe(1);
    const h = game.run.hazards[0];
    game.run.x = h.x;
    game.run.y = h.y;
    game.run.elapsedMs = 3600 - h.cycle;
    game.tick(1);
    expect(game.run.shield).toBe(0);
    expect(game.run.hp).toBe(game.run.maxHp);
  });
  it("cancel applies visible fallback and rejects previous outcomes after restart", () => {
    const game = new Expedition();
    game.start(true, 1, "simulator");
    checkpoint(game);
    const outcome = game.interaction.resolve()!;
    checkpoint(game);
    game.fallback();
    expect(game.interaction.snapshot()?.phase).toBe("cancelled");
    game.start(true, 1, "simulator");
    expect(game.applyOutcome(outcome)).toBe(false);
  });
});
