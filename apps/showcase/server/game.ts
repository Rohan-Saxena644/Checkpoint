import { randomUUID } from "node:crypto";
import {
  BoundedSet,
  Interaction,
  type Input,
  type InputResult,
  type Outcome,
} from "@checkpoint/core";
export type Mode = "simulator" | "twitch";
export type GameStatus = "ready" | "playing" | "checkpoint" | "won" | "lost";
export type Fragment = { x: number; y: number; taken: boolean };
export type Hazard = {
  x: number;
  y: number;
  radius: number;
  phase: "quiet" | "warning" | "active";
  cycle: number;
};
export type Run = {
  id: string;
  status: GameStatus;
  stage: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  fragments: Fragment[];
  collected: number;
  total: number;
  hazards: Hazard[];
  route: string;
  supply: string;
  shield: number;
  boostMs: number;
  fieldMs: number;
  elapsedMs: number;
  invulnerableMs: number;
  easy: boolean;
  crew: number;
  message: string;
};
export class Expedition {
  readonly interaction: Interaction;
  run: Run;
  mode: Mode = "simulator";
  connected = true;
  offlineContinuation = false;
  paused = false;
  transportStatus = "simulator-ready";
  windowCommand = "!route";
  private keys = { x: 0, y: 0 };
  private keyExpires = 0;
  private applied = new BoundedSet(128);
  events: { time: number; type: string; detail: string }[] = [];
  constructor(private clock: () => number = Date.now) {
    this.interaction = new Interaction(clock);
    this.run = this.fresh(true, 2);
    this.interaction.subscribe((event) => {
      this.log(
        event.type,
        event.type === "input" ? event.result.reason : event.state.id,
      );
      if (event.type === "resolved" && event.state.outcome)
        this.applyOutcome(event.state.outcome);
    });
  }
  private fresh(easy: boolean, crew: number): Run {
    return {
      id: randomUUID(),
      status: "ready",
      stage: 0,
      x: 70,
      y: 280,
      hp: easy ? 7 : 5,
      maxHp: easy ? 7 : 5,
      fragments: [],
      collected: 0,
      total: 0,
      hazards: [],
      route: "pending",
      supply: "pending",
      shield: 0,
      boostMs: 0,
      fieldMs: 0,
      elapsedMs: 0,
      invulnerableMs: 0,
      easy,
      crew,
      message: "The beacon is fading. Bring it home.",
    };
  }
  log(type: string, detail: string) {
    this.events.unshift({ time: this.clock(), type, detail });
    this.events.length = Math.min(this.events.length, 100);
  }
  start(easy: boolean, crew: number, mode: Mode) {
    this.interaction.cancel();
    this.mode = mode;
    this.paused = false;
    this.offlineContinuation = false;
    this.keys = { x: 0, y: 0 };
    this.run = this.fresh(easy, crew);
    this.run.status = "playing";
    this.setupStage();
    this.log("run", "Expedition started");
    if (!this.connected) this.paused = true;
  }
  private setupStage() {
    const r = this.run;
    r.x = 70;
    r.y = 280;
    r.collected = 0;
    this.keys = { x: 0, y: 0 };
    const safe = r.stage === 1 && r.route === "right";
    r.fragments = (
      safe
        ? [
            [300, 200],
            [630, 340],
          ]
        : [
            [260, 190],
            [470, 370],
            [660, 210],
            [770, 390],
          ]
    ).map(([x, y]) => ({ x, y, taken: false }));
    if (r.stage === 3) r.fragments = [];
    const count =
      r.stage === 0 ? 3 : safe ? 2 : r.stage === 1 ? 6 : r.stage === 2 ? 4 : 7;
    r.hazards = Array.from({ length: count }, (_, i) => ({
      x: 230 + ((i * 117) % 610),
      y: 170 + ((i * 157) % 240),
      radius: r.easy ? 39 : 52,
      phase: "quiet",
      cycle: i * 713,
    }));
    r.message = [
      "Collect 2 fragments, then reach the route beacon.",
      r.route === "left"
        ? "The Shatterpath: more salvage, more falling stars."
        : "The Stillwater: a quieter path with just enough salvage.",
      "Collect 2 fragments. Your supply is active.",
      "Cross the storm and reach the last beacon.",
    ][r.stage];
  }
  movement(x: number, y: number) {
    this.keys = { x, y };
    this.keyExpires = this.clock() + 350;
  }
  stopMovement() {
    this.keys = { x: 0, y: 0 };
  }
  setTransport(connected: boolean, status: string) {
    this.connected = connected;
    this.offlineContinuation = false;
    this.transportStatus = status;
    if (!connected) {
      this.interaction.pause();
      this.stopMovement();
    } else if (!this.paused) this.interaction.resume();
    this.log("transport", status);
  }
  pause() {
    this.paused = true;
    this.stopMovement();
    this.interaction.pause();
    this.log("control", "Emergency pause");
  }
  resume() {
    if (!this.connected && !this.offlineContinuation) return;
    this.paused = false;
    if (this.connected) this.interaction.resume();
    this.log("control", "Resumed");
  }
  tick(dt: number) {
    if (this.paused || (!this.connected && !this.offlineContinuation)) return;
    this.interaction.tick();
    const r = this.run;
    if (r.status !== "playing") return;
    r.elapsedMs += dt;
    r.boostMs = Math.max(0, r.boostMs - dt);
    r.fieldMs = Math.max(0, r.fieldMs - dt);
    r.invulnerableMs = Math.max(0, r.invulnerableMs - dt);
    const keys = this.clock() > this.keyExpires ? { x: 0, y: 0 } : this.keys;
    const length = Math.hypot(keys.x, keys.y) || 1,
      speed = (r.easy ? 155 : 85) * (r.boostMs > 0 ? 1.5 : 1);
    r.x = Math.max(
      25,
      Math.min(965, r.x + ((keys.x / length) * speed * dt) / 1000),
    );
    r.y = Math.max(
      55,
      Math.min(515, r.y + ((keys.y / length) * speed * dt) / 1000),
    );
    for (const f of r.fragments)
      if (!f.taken && Math.hypot(r.x - f.x, r.y - f.y) < 29) {
        f.taken = true;
        r.collected++;
        r.total++;
      }
    for (const h of r.hazards) {
      const phase = (r.elapsedMs + h.cycle) % (r.easy ? 5500 : 4200);
      h.phase = phase < 2300 ? "quiet" : phase < 3500 ? "warning" : "active";
      if (
        h.phase === "active" &&
        Math.hypot(r.x - h.x, r.y - h.y) < h.radius + 9 &&
        r.invulnerableMs <= 0 &&
        r.fieldMs <= 0
      ) {
        if (r.shield > 0) {
          r.shield--;
          r.message = "Shield absorbed a storm strike.";
        } else {
          r.hp--;
          r.message = "Storm strike. Move out of the red rings.";
        }
        r.invulnerableMs = 1600;
        if (r.hp <= 0) {
          r.status = "lost";
          this.stopMovement();
          r.message = "The light went quiet. A new expedition awaits.";
          return;
        }
      }
    }
    if (
      r.x > 885 &&
      Math.abs(r.y - 280) < 75 &&
      (r.collected >= 2 || r.stage === 3)
    ) {
      this.stopMovement();
      if (r.stage === 3) {
        r.status = "won";
        r.message = "The last beacon burns again. You brought the light home.";
        this.log("run", "Beacon restored");
        return;
      }
      r.status = "checkpoint";
      const id = `${r.id}:${r.stage}:${randomUUID()}`;
      this.windowCommand =
        r.stage === 0 ? "!route" : r.stage === 1 ? "!supply" : "!charge";
      this.interaction.open(
        id,
        r.stage === 0
          ? {
              kind: "choice",
              options: ["left", "right"],
              fallback: "right",
            }
          : r.stage === 1
            ? {
                kind: "choice",
                options: ["shield", "heal", "boost"],
                fallback: "heal",
              }
            : {
                kind: "goal",
                action: "charge",
                success: "protected",
                target: r.crew,
                fallback: "unprotected",
              },
        18000,
      );
      if (!this.connected) {
        this.offlineContinuation = false;
        this.interaction.pause();
      }
    }
  }
  accept(input: Input): InputResult {
    if (!this.connected) return { accepted: false, reason: "paused" };
    return this.interaction.accept(input);
  }
  applyOutcome(outcome: Outcome) {
    const state = this.interaction.snapshot(),
      r = this.run;
    if (
      this.applied.has(outcome.id) ||
      state?.outcome?.id !== outcome.id ||
      state.id !== outcome.windowId ||
      r.status !== "checkpoint" ||
      !outcome.windowId.startsWith(`${r.id}:${r.stage}:`)
    ) {
      this.log("outcome", "Duplicate or stale outcome ignored");
      return false;
    }
    this.applied.add(outcome.id);
    if (r.stage === 0) r.route = outcome.value;
    if (r.stage === 1) {
      r.supply = outcome.value;
      if (outcome.value === "shield") r.shield = 1;
      else if (outcome.value === "heal") r.hp = Math.min(r.maxHp, r.hp + 2);
      else r.boostMs = 15000;
    }
    if (r.stage === 2) r.fieldMs = outcome.value === "protected" ? 12000 : 3000;
    r.stage++;
    r.status = "playing";
    this.setupStage();
    if (outcome.fallback)
      r.message = `Crew fallback: ${outcome.value === "unprotected" ? "3-second crossing grace" : outcome.value}. ${r.message}`;
    this.log(
      "applied",
      `${outcome.value}${outcome.fallback ? " (fallback)" : ""}`,
    );
    return true;
  }
  fallback() {
    if (this.run.status !== "checkpoint") return;
    this.interaction.cancel();
    const stage = this.run.stage;
    this.run.stage++;
    this.run.status = "playing";
    if (stage === 0) this.run.route = "right";
    if (stage === 1) {
      this.run.supply = "heal";
      this.run.hp = Math.min(this.run.maxHp, this.run.hp + 2);
    }
    if (stage === 2) this.run.fieldMs = 3000;
    this.setupStage();
    this.offlineContinuation = !this.connected;
    this.run.message = `${this.connected ? "Crew" : "Offline"} fallback applied. ${this.run.message}`;
    this.log(
      "fallback",
      "Window cancelled; safe route / healing / 3-second grace",
    );
  }
  snapshot() {
    const window = this.interaction.snapshot();
    return {
      run: structuredClone(this.run),
      window: window ? { ...window, command: this.windowCommand } : undefined,
      mode: this.mode,
      connected: this.connected,
      offlineContinuation: this.offlineContinuation,
      paused: this.paused,
      transportStatus: this.transportStatus,
      events: this.events,
      serverTime: this.clock(),
    };
  }
}
