import type {
  AdapterHost,
  InputAdapter,
  InputResult,
  WindowState,
  Input,
} from "@checkpoint/core";
import type { CommandMessage } from "./commands.js";

/** Explicit synthetic messages; no automatic viewers and no voting implementation. */
export class SimulatorAdapter implements InputAdapter {
  private host?: AdapterHost;
  constructor(
    private normalize: (
      message: CommandMessage,
      window: WindowState,
    ) => Input | undefined,
  ) {}
  start(host: AdapterHost) {
    this.host = host;
  }
  stop() {
    this.host = undefined;
  }
  send(message: CommandMessage): InputResult {
    if (!this.host) return { accepted: false, reason: "paused" };
    const window = this.host.currentWindow();
    if (!window) return { accepted: false, reason: "closed" };
    const input = this.normalize(message, window);
    return input
      ? this.host.accept(input)
      : { accepted: false, reason: "invalid" };
  }
}
