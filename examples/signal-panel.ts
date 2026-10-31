import { BoundedSet, Interaction, type Outcome } from "@checkpoint/core";

// No Twitch, server, game, React, network, or credentials. Use only public exports.
let now = 1000;
const windows = new Interaction(() => now);
const applied = new BoundedSet(128);
let signal = "amber";
let effectCount = 0;
const window = windows.open(
  "signal-001",
  {
    kind: "choice",
    options: ["amber", "cyan"],
    fallback: "amber",
  },
  10000,
);

function apply(outcome: Outcome) {
  if (outcome.windowId !== window.id || applied.has(outcome.id)) return false;
  applied.add(outcome.id);
  signal = outcome.value;
  effectCount++;
  return true;
}
windows.accept({
  windowId: window.id,
  participantId: "participant-a",
  inputId: "input-a",
  action: "cyan",
  sentAt: now,
});
windows.accept({
  windowId: window.id,
  participantId: "participant-b",
  inputId: "input-b",
  action: "cyan",
  sentAt: now,
});
now += 10000;
windows.tick(); // the host normally calls this from its own authoritative loop
const outcome = windows.resolve()!; // returns the existing result after tick
apply(outcome);
apply(outcome); // repeated delivery has no second effect
if (signal !== "cyan" || effectCount !== 1)
  throw new Error("Unexpected signal result");
console.log(
  `Signal: ${signal}; participants: ${outcome.participants}; effects applied: ${effectCount}`,
);
