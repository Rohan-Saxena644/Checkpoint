import { describe, expect, it } from "vitest";
import { BoundedSet, Interaction, type Choice, type Input } from "./index.js";
const choice: Choice = {
  kind: "choice",
  options: ["left", "right"],
  fallback: "right",
};
function fixture(capacity = 10, cache = 4) {
  let now = 1000;
  const engine = new Interaction(() => now, capacity, cache);
  engine.open("one", choice, 10000);
  const send = (overrides: Partial<Input> = {}) =>
    engine.accept({
      windowId: "one",
      participantId: "ada",
      inputId: crypto.randomUUID(),
      action: "left",
      sentAt: now,
      ...overrides,
    });
  return {
    engine,
    send,
    advance: (ms: number) => {
      now += ms;
    },
  };
}
describe("interaction lifecycle", () => {
  it("accepts opaque generic actions and participant IDs without command syntax", () => {
    const engine = new Interaction(() => 1000);
    engine.open(
      "local-window",
      {
        kind: "choice",
        options: ["north exit", "南门", "__proto__", "constructor"],
        fallback: "north exit",
      },
      1000,
    );
    engine.accept({
      windowId: "local-window",
      participantId: "local person",
      inputId: "button-1",
      action: "__proto__",
      sentAt: 1000,
    });
    engine.accept({
      windowId: "local-window",
      participantId: "another person",
      inputId: "button-2",
      action: "__proto__",
      sentAt: 1000,
    });
    expect(engine.snapshot()?.counts.__proto__).toBe(2);
    expect(engine.resolve()?.value).toBe("__proto__");
  });
  it("resolves a goal using only host-defined actions and result values", () => {
    const engine = new Interaction(() => 1);
    engine.open(
      "cooperate",
      {
        kind: "goal",
        action: "lend a hand",
        target: 1,
        success: "door unlocked",
        fallback: "use key",
      },
      1000,
    );
    expect(
      engine.accept({
        windowId: "cooperate",
        participantId: "person-a",
        inputId: "click-a",
        action: "lend a hand",
        sentAt: 1,
      }).accepted,
    ).toBe(true);
    expect(engine.resolve()?.value).toBe("door unlocked");
  });
  it("rejects empty actions, invalid capacities and ambiguous goal results", () => {
    expect(() => new Interaction(Date.now, 0)).toThrow();
    const engine = new Interaction();
    expect(() =>
      engine.open(
        "empty",
        { kind: "choice", options: [" ", "yes"], fallback: "yes" },
        100,
      ),
    ).toThrow();
    expect(() =>
      engine.open(
        "ambiguous",
        {
          kind: "goal",
          action: "help",
          target: 1,
          success: "same",
          fallback: "same",
        },
        100,
      ),
    ).toThrow();
  });
  it("replaces the same user vote while keeping one effective vote", () => {
    const f = fixture();
    f.send();
    expect(f.send({ action: "right" }).reason).toBe("replaced");
    expect(f.engine.snapshot()).toMatchObject({
      participants: 1,
      counts: { left: 0, right: 1 },
    });
  });
  it("suppresses transport delivery IDs independently of viewer identity", () => {
    const f = fixture();
    f.send({ inputId: "same" });
    expect(f.send({ inputId: "same", participantId: "other" }).reason).toBe(
      "duplicate",
    );
    expect(f.engine.snapshot()?.participants).toBe(1);
  });
  it("breaks ties using definition option order", () => {
    const f = fixture();
    f.send({ action: "right" });
    f.send({ participantId: "moss" });
    expect(f.engine.resolve()?.value).toBe("left");
  });
  it("uses explicit no-vote fallback", () => {
    expect(fixture().engine.resolve()).toMatchObject({
      value: "right",
      fallback: true,
      participants: 0,
    });
  });
  it("rejects invalid, malformed, future and old inputs", () => {
    const f = fixture();
    expect(f.send({ action: "up" }).reason).toBe("invalid");
    expect(f.send({ participantId: "" }).reason).toBe("invalid");
    expect(f.send({ sentAt: NaN }).reason).toBe("invalid");
    expect(f.send({ sentAt: 999 }).reason).toBe("stale");
    expect(f.send({ sentAt: 5000 }).reason).toBe("stale");
    f.advance(10001);
    expect(f.send().reason).toBe("closed");
  });
  it("closes at the exact server deadline and resolves only once", () => {
    const f = fixture();
    f.advance(10000);
    expect(f.send().reason).toBe("closed");
    const outcome = f.engine.resolve();
    expect(f.engine.resolve()).toEqual(outcome);
  });
  it("freezes the remaining time and rejects buffered messages from the pause", () => {
    const f = fixture();
    f.advance(3000);
    f.engine.pause();
    expect(f.engine.snapshot()?.remainingMs).toBe(7000);
    expect(f.send().reason).toBe("paused");
    f.advance(20000);
    expect(f.engine.snapshot()?.remainingMs).toBe(7000);
    f.engine.resume();
    expect(f.send({ sentAt: 4000 }).reason).toBe("stale");
    expect(f.send().accepted).toBe(true);
    f.advance(6999);
    f.engine.tick();
    expect(f.engine.snapshot()?.phase).toBe("open");
    f.advance(1);
    f.engine.tick();
    expect(f.engine.snapshot()?.phase).toBe("resolved");
  });
  it("does not extend a deadline by pausing an expired window", () => {
    const f = fixture();
    f.advance(10000);
    f.engine.pause();
    expect(f.engine.snapshot()?.phase).toBe("resolved");
  });
  it("cancel cannot produce an outcome", () => {
    const f = fixture();
    f.engine.cancel();
    expect(f.engine.resolve()).toBeUndefined();
    expect(f.send().reason).toBe("closed");
  });
  it("new windows reject old IDs and timestamps", () => {
    const f = fixture();
    f.engine.resolve();
    f.advance(100);
    f.engine.open("two", choice, 10000);
    expect(f.send().reason).toBe("closed");
    expect(f.send({ windowId: "two", sentAt: 1000 }).reason).toBe("stale");
  });
  it("counts each goal contributor once and resolves success at the threshold", () => {
    const f = fixture();
    f.engine.cancel();
    f.engine.open(
      "goal",
      {
        kind: "goal",
        action: "charge",
        success: "protected",
        target: 2,
        fallback: "unprotected",
      },
      10000,
    );
    expect(f.send({ windowId: "goal", action: "charge" }).accepted).toBe(true);
    expect(f.send({ windowId: "goal", action: "charge" }).reason).toBe(
      "already-contributed",
    );
    f.send({ windowId: "goal", action: "charge", participantId: "moss" });
    expect(f.engine.resolve()).toMatchObject({
      value: "protected",
      participants: 2,
      fallback: false,
    });
  });
  it("goal failure and no participation use the documented fallback", () => {
    const e = new Interaction();
    e.open(
      "goal",
      {
        kind: "goal",
        action: "charge",
        success: "protected",
        target: 2,
        fallback: "unprotected",
      },
      1000,
    );
    expect(e.resolve()).toMatchObject({ value: "unprotected", fallback: true });
  });
  it("bounds participant storage and cache entries", () => {
    const f = fixture(2);
    f.send();
    f.send({ participantId: "moss" });
    expect(f.send({ participantId: "nova" }).reason).toBe("capacity");
    const set = new BoundedSet(2);
    set.add("a");
    set.add("b");
    set.add("c");
    expect(set.size).toBe(2);
    expect(set.has("a")).toBe(false);
    expect(() => new BoundedSet(0)).toThrow();
  });
  it("eviction does not defeat distinct-user goal limits", () => {
    const e = new Interaction(() => 1, 100, 1);
    e.open(
      "g",
      {
        kind: "goal",
        action: "charge",
        success: "protected",
        target: 3,
        fallback: "unprotected",
      },
      1000,
    );
    const input = {
      windowId: "g",
      participantId: "a",
      inputId: "a",
      action: "charge",
      sentAt: 1,
    };
    e.accept(input);
    e.accept({ ...input, participantId: "b", inputId: "b" });
    expect(e.accept(input).reason).toBe("already-contributed");
  });
  it("emits one resolution event and supports unsubscribe", () => {
    const f = fixture(),
      types: string[] = [];
    const off = f.engine.subscribe((e) => types.push(e.type));
    f.send();
    f.engine.resolve();
    f.engine.resolve();
    expect(types).toEqual(["input", "resolved"]);
    off();
    f.engine.open("next", choice, 100);
    expect(types.length).toBe(2);
  });
  it("rejects invalid definitions and concurrent windows", () => {
    const f = fixture();
    expect(() => f.engine.open("other", choice, 100)).toThrow();
    f.engine.cancel();
    expect(() => f.engine.open("one", choice, 100)).toThrow();
    expect(() =>
      f.engine.open("two", { ...choice, fallback: "invalid" }, 100),
    ).toThrow();
  });
  it("isolates snapshots and definitions from consumer mutation", () => {
    const f = fixture();
    const snapshot = f.engine.snapshot()!;
    snapshot.counts.left = 50;
    snapshot.definition.kind = "goal";
    expect(f.engine.snapshot()?.counts.left).toBe(0);
    expect(f.engine.snapshot()?.definition.kind).toBe("choice");
  });
});
