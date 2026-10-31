export type Choice = {
  kind: "choice";
  options: readonly string[];
  fallback: string;
};
export type Goal = {
  kind: "goal";
  action: string;
  target: number;
  success: string;
  fallback: string;
};
export type Definition = Choice | Goal;
export type Phase = "open" | "paused" | "resolved" | "cancelled";
export type Input = {
  windowId: string;
  inputId: string;
  participantId: string;
  action: string;
  sentAt: number;
};
export type Outcome = {
  id: string;
  windowId: string;
  kind: Definition["kind"];
  value: string;
  participants: number;
  fallback: boolean;
};
export type WindowState = {
  id: string;
  definition: Definition;
  phase: Phase;
  openedAt: number;
  deadline: number;
  remainingMs: number;
  participants: number;
  counts: Record<string, number>;
  outcome?: Outcome;
};
export type InputResult = {
  accepted: boolean;
  reason:
    | "accepted"
    | "replaced"
    | "duplicate"
    | "already-contributed"
    | "invalid"
    | "stale"
    | "closed"
    | "paused"
    | "capacity";
};
export type LifecycleEvent =
  | {
      type: "opened" | "paused" | "resumed" | "cancelled" | "resolved";
      state: WindowState;
    }
  | { type: "input"; result: InputResult; state: WindowState };

/** The trusted host supplies window context and owns all acceptance decisions. */
export interface AdapterHost {
  currentWindow(): WindowState | undefined;
  accept(input: Input): InputResult;
}

/** Attach a normalized input source. Transport authorization remains adapter-specific. */
export interface InputAdapter {
  start(host: AdapterHost): void;
  stop(): void;
}

const validAction = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= 128;

/** FIFO delivery cache: bounded suppression, not a durable exactly-once guarantee. */
export class BoundedSet {
  private values = new Set<string>();
  constructor(readonly capacity = 4096) {
    if (!Number.isInteger(capacity) || capacity < 1)
      throw new Error("Invalid capacity");
  }
  has(key: string) {
    return this.values.has(key);
  }
  add(key: string) {
    this.values.add(key);
    if (this.values.size > this.capacity)
      this.values.delete(this.values.values().next().value!);
  }
  get size() {
    return this.values.size;
  }
}

export class Interaction {
  private state?: WindowState;
  private votes = new Map<string, string>();
  private deliveries: BoundedSet;
  private usedWindows = new BoundedSet(1024);
  private listeners = new Set<(event: LifecycleEvent) => void>();
  private activeSince = 0;
  constructor(
    private clock: () => number = Date.now,
    private maxParticipants = 10000,
    cacheSize = 4096,
  ) {
    if (!Number.isInteger(maxParticipants) || maxParticipants < 1)
      throw new Error("Invalid participant capacity");
    this.deliveries = new BoundedSet(cacheSize);
  }
  subscribe(listener: (event: LifecycleEvent) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private emit(
    type: "opened" | "paused" | "resumed" | "cancelled" | "resolved",
  ) {
    const event = { type, state: this.snapshot()! };
    for (const fn of this.listeners) fn(event);
  }
  open(id: string, definition: Definition, durationMs: number) {
    if (this.state && ["open", "paused"].includes(this.state.phase))
      throw new Error("Window already active");
    if (!id || id.length > 128 || this.usedWindows.has(id))
      throw new Error("Use a unique window ID");
    if (!Number.isFinite(durationMs) || durationMs < 1 || durationMs > 300000)
      throw new Error("Invalid duration");
    if (
      definition.kind === "choice" &&
      (definition.options.length < 2 ||
        definition.options.length > 16 ||
        new Set(definition.options).size !== definition.options.length ||
        definition.options.some((v) => !validAction(v)) ||
        !definition.options.includes(definition.fallback))
    )
      throw new Error("Invalid choices");
    if (
      definition.kind === "goal" &&
      (!Number.isInteger(definition.target) ||
        definition.target < 1 ||
        definition.target > this.maxParticipants ||
        !validAction(definition.action) ||
        !validAction(definition.success) ||
        !validAction(definition.fallback) ||
        definition.success === definition.fallback)
    )
      throw new Error("Invalid goal");
    const now = this.clock();
    this.activeSince = now;
    this.votes.clear();
    this.usedWindows.add(id);
    this.state = {
      id,
      definition: structuredClone(definition),
      phase: "open",
      openedAt: now,
      deadline: now + durationMs,
      remainingMs: durationMs,
      participants: 0,
      counts: Object.fromEntries(
        (definition.kind === "choice"
          ? definition.options
          : [definition.action]
        ).map((action) => [action, 0]),
      ),
    };
    this.emit("opened");
    return this.snapshot()!;
  }
  snapshot(): WindowState | undefined {
    if (!this.state) return undefined;
    return structuredClone({
      ...this.state,
      remainingMs:
        this.state.phase === "open"
          ? Math.max(0, this.state.deadline - this.clock())
          : this.state.remainingMs,
    });
  }
  accept(input: Input): InputResult {
    const s = this.state,
      now = this.clock();
    const reject = (reason: InputResult["reason"]): InputResult => {
      const result = { accepted: false, reason };
      if (s)
        for (const fn of this.listeners)
          fn({ type: "input", result, state: this.snapshot()! });
      return result;
    };
    if (!s || s.id !== input.windowId || !["open", "paused"].includes(s.phase))
      return reject("closed");
    if (s.phase === "paused") return reject("paused");
    if (now >= s.deadline) {
      this.resolve();
      return reject("closed");
    }
    if (
      typeof input.participantId !== "string" ||
      !input.participantId ||
      input.participantId.length > 128 ||
      typeof input.inputId !== "string" ||
      !input.inputId ||
      input.inputId.length > 256 ||
      !validAction(input.action) ||
      !Number.isFinite(input.sentAt)
    )
      return reject("invalid");
    if (
      input.sentAt < this.activeSince ||
      input.sentAt > now + 2000 ||
      now - input.sentAt > 10000
    )
      return reject("stale");
    if (this.deliveries.has(input.inputId)) return reject("duplicate");
    this.deliveries.add(input.inputId);
    const d = s.definition;
    if (
      d.kind === "choice"
        ? !d.options.includes(input.action)
        : input.action !== d.action
    )
      return reject("invalid");
    const previous = this.votes.get(input.participantId);
    if (d.kind === "goal" && previous) return reject("already-contributed");
    if (!previous && this.votes.size >= this.maxParticipants)
      return reject("capacity");
    this.votes.set(input.participantId, input.action);
    if (previous) s.counts[previous]--;
    s.counts[input.action] = (s.counts[input.action] ?? 0) + 1;
    s.participants = this.votes.size;
    const result: InputResult = {
      accepted: true,
      reason: previous ? "replaced" : "accepted",
    };
    for (const fn of this.listeners)
      fn({ type: "input", result, state: this.snapshot()! });
    return result;
  }
  tick() {
    if (this.state?.phase === "open" && this.clock() >= this.state.deadline)
      this.resolve();
  }
  pause() {
    this.tick();
    if (this.state?.phase !== "open") return;
    this.state.remainingMs = Math.max(0, this.state.deadline - this.clock());
    this.state.phase = "paused";
    this.emit("paused");
  }
  resume() {
    if (this.state?.phase !== "paused") return;
    this.activeSince = this.clock();
    this.state.deadline = this.activeSince + this.state.remainingMs;
    this.state.phase = "open";
    this.emit("resumed");
  }
  cancel() {
    if (!this.state || !["open", "paused"].includes(this.state.phase)) return;
    this.state.phase = "cancelled";
    this.state.remainingMs = 0;
    this.emit("cancelled");
  }
  resolve(): Outcome | undefined {
    const s = this.state;
    if (!s || s.phase === "cancelled") return;
    if (s.outcome) return structuredClone(s.outcome);
    const d = s.definition;
    let value: string, fallback: boolean;
    if (d.kind === "choice") {
      fallback = s.participants === 0;
      value = fallback
        ? d.fallback
        : d.options.reduce((a, b) =>
            (s.counts[b] ?? 0) > (s.counts[a] ?? 0) ? b : a,
          );
    } else {
      fallback = s.participants < d.target;
      value = fallback ? d.fallback : d.success;
    }
    s.outcome = {
      id: `${s.id}:outcome`,
      windowId: s.id,
      kind: d.kind,
      value,
      participants: s.participants,
      fallback,
    };
    s.phase = "resolved";
    s.remainingMs = 0;
    this.emit("resolved");
    return structuredClone(s.outcome);
  }
}
