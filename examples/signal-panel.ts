import { Interaction } from "@checkpoint/core";
// A second integration with no game, Twitch, DOM, or renderer dependencies.
let clock = 1000;
const crew = new Interaction(() => clock);
let signal = "amber";
const applied = new Set<string>(); // this short-lived example opens only one window
crew.subscribe((event) => {
  if (event.type !== "resolved" || !event.state.outcome) return;
  const outcome = event.state.outcome;
  if (applied.has(outcome.id)) return;
  applied.add(outcome.id);
  signal = outcome.value;
  console.log(`Signal changed to ${signal}; outcome ${outcome.id}`);
});
crew.open(
  "signal-001",
  {
    kind: "choice",
    command: "!signal",
    options: ["amber", "cyan"],
    fallback: "amber",
  },
  10000,
);
crew.accept({
  windowId: "signal-001",
  deliveryId: "synthetic-delivery",
  userId: "synthetic-viewer",
  value: "cyan",
  sentAt: clock,
});
clock += 10000;
crew.tick();
console.log(`Final signal: ${signal}`);
