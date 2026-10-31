import { describe, expect, it } from "vitest";
import {
  Interaction,
  type AdapterHost,
  type InputAdapter,
} from "@checkpoint/core";
import { SimulatorAdapter } from "./simulator.js";
import { normalizeCommand, parseCommand } from "./commands.js";
describe("simulator adapter uses shared normalized core inputs", () => {
  it("delegates duplicate, replacement, distinct-user and disconnect rules to core", () => {
    const core = new Interaction(() => 1000);
    core.open(
      "route",
      { kind: "choice", options: ["left", "right"], fallback: "right" },
      1000,
    );
    const host: AdapterHost = {
      currentWindow: () => core.snapshot(),
      accept: (input) => core.accept(input),
    };
    const simulator = new SimulatorAdapter((message, window) =>
      normalizeCommand(message, window, "!route"),
    );
    const adapter: InputAdapter = simulator;
    adapter.start(host);
    const message = {
      text: "!route left",
      participantId: "sim:a",
      inputId: "sim:1",
      sentAt: 1000,
    };
    expect(simulator.send(message).accepted).toBe(true);
    expect(simulator.send(message).reason).toBe("duplicate");
    expect(
      simulator.send({ ...message, inputId: "sim:2", text: "!route right" })
        .reason,
    ).toBe("replaced");
    expect(core.snapshot()).toMatchObject({
      participants: 1,
      counts: { left: 0, right: 1 },
    });
    expect(
      simulator.send({ ...message, inputId: "sim:3", sentAt: 0 }).reason,
    ).toBe("stale");
    adapter.stop();
    expect(simulator.send(message).reason).toBe("paused");
    adapter.start(host);
    expect(core.resolve()?.value).toBe("right");
  });
  it("owns showcase chat grammar outside the core", () => {
    const choice = {
      kind: "choice" as const,
      options: ["left", "right"],
      fallback: "right",
    };
    expect(parseCommand("!ROUTE right", choice, "!route")).toBe("right");
    expect(parseCommand("!route left now", choice, "!route")).toBeUndefined();
    expect(parseCommand("!supply shield", choice, "!route")).toBeUndefined();
    expect(parseCommand("!route up", choice, "!route")).toBeUndefined();
    expect(
      parseCommand(
        "!charge x",
        {
          kind: "goal",
          action: "charge",
          target: 1,
          success: "protected",
          fallback: "unprotected",
        },
        "!charge",
      ),
    ).toBeUndefined();
  });
});
