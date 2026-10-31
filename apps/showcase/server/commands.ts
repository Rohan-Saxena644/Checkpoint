import type { Input, WindowState } from "@checkpoint/core";

/** Showcase grammar only. The core never sees chat text or command prefixes. */
export function parseCommand(
  text: string,
  definition: WindowState["definition"],
  command: string,
): string | undefined {
  if (text.length > 128) return;
  const parts = text.trim().toLowerCase().split(/\s+/);
  if (parts[0] !== command) return;
  if (definition.kind === "goal")
    return parts.length === 1 ? definition.action : undefined;
  return parts.length === 2 && definition.options.includes(parts[1])
    ? parts[1]
    : undefined;
}

export type CommandMessage = {
  text: string;
  participantId: string;
  inputId: string;
  sentAt: number;
  windowId?: string;
};
export function normalizeCommand(
  message: CommandMessage,
  window: WindowState,
  command: string,
): Input | undefined {
  const action = parseCommand(message.text, window.definition, command);
  if (action === undefined) return;
  return {
    windowId: message.windowId ?? window.id,
    participantId: message.participantId,
    inputId: message.inputId,
    sentAt: message.sentAt,
    action,
  };
}
