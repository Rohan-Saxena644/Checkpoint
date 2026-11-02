// Source times are seconds in the owner's real screen recording, at normal speed.
export const ownerVideo =
  "C:/Users/VICTUS/Videos/Screen Recordings/Screen Recording 2026-11-02 005830.mp4";
export const plan = [
  {
    start: 0,
    duration: 12,
    file: "live",
    in: 24,
    title: "Checkpoint — Give chat a role. Keep the game in control.",
    label: "REAL TWITCH · EASY MODE · ONE-PERSON CREW",
    caption:
      "A playable expedition, powered by a reusable TypeScript interaction SDK.",
    narration:
      "Checkpoint gives chat a role while the game stays in control. The Last Beacon turns a courier expedition into a shared experience, using a reusable TypeScript SDK.",
  },
  {
    start: 12,
    duration: 29,
    file: "live",
    in: 37,
    title: "Real Twitch chat → accepted input → route decision",
    label: "REAL TWITCH · NORMAL 18-SECOND WINDOW",
    caption:
      "!route left → one accepted participant → The Shatterpath. Game layout and hazards change.",
    narration:
      "At a beacon, the game opens an eighteen second route window. Watch the real Twitch command and the accepted participant count. One account has one effective vote. When the timer ends, Left wins. The next region becomes the Shatterpath, with six hazards and four salvage opportunities. This is a game consequence, beyond a displayed poll.",
  },
  {
    start: 41,
    duration: 14,
    file: "live",
    in: 90,
    title: "A supply vote grants an actual shield",
    label: "REAL TWITCH · SAME EXPEDITION · TRAVEL CUT",
    caption:
      "!supply shield → Shield delivered. The visible ring absorbs one storm strike.",
    narration:
      "At the next checkpoint, chat chooses a supply. This real shield vote grants one shield. The courier gains a visible ring that can absorb a storm strike.",
  },
  {
    start: 55,
    duration: 30,
    file: "live",
    in: 115,
    title: "One small audience can power the final crossing",
    label: "REAL TWITCH · EXPLICIT ONE-PERSON PRESET",
    caption:
      "!charge → 1/1 distinct participants → 12-second protective field. Repeats cannot add contributors.",
    narration:
      "This run uses the explicit one person crew preset. At the final gate, each distinct participant contributes once with charge. The real message fills the goal. Resolution activates twelve seconds of protection for the crossing. Normal movement and game rules still apply. With no participation, a shorter crossing grace keeps the expedition playable. Larger crew presets use the same core.",
  },
  {
    start: 85,
    duration: 12,
    file: "reliability",
    in: 9.4,
    crop: true,
    title: "Reliability: pause and recovery",
    label: "SIMULATED TRANSPORT FAILURE · NOT A LIVE OUTAGE",
    caption:
      "Input and remaining time pause together. Recovery resumes the synchronized window.",
    narration:
      "This failure is simulated. Input and the remaining timer pause together. Recovery resumes the synchronized window. The overlay follows the authoritative host.",
  },
  {
    start: 97,
    duration: 8,
    file: "reliability",
    in: 27,
    title: "Reliability: an outcome must not apply twice",
    label: "SIMULATED TEST · IDLE WAIT CUT",
    caption:
      "The repeated outcome is ignored. No second game effect is applied.",
    narration:
      "A repeated outcome is ignored. Invalid, duplicate and late inputs also have focused automated coverage.",
  },
  {
    start: 105,
    duration: 25,
    file: "sdk",
    in: 0,
    title: "Actual SDK usage and the minimal second integration",
    label: "DEVELOPMENT EVIDENCE · NO TWITCH CREDENTIALS",
    caption:
      "Public exports → choice → two generic participants → resolution → one idempotent effect.",
    narration:
      "The core works without Twitch, React, or the game. This actual example opens a choice, accepts two generic participants, resolves it, and guards the outcome before applying a signal change. The same core powers a local button panel. Built JavaScript, TypeScript declarations and a tested package archive make reuse practical. The MIT licensed API is experimental.",
  },
  {
    start: 130,
    duration: 20,
    file: "codex",
    in: 8,
    title: "Built and verified with Codex",
    label: "GENUINE CODEX BUILD THREAD",
    caption:
      "Core, Twitch adapter, game, security and regression tests. Final checks: 47 tests + typecheck + build.",
    narration:
      "This is the genuine Codex build thread. Codex implemented the core, Twitch adapter, game and tests. During live testing, it traced rejected messages to a host clock offset and added a regression fix. Forty seven tests, strict type checking, and the production build pass.",
  },
  {
    start: 150,
    duration: 10,
    file: "live",
    in: 145.5,
    title: "Give chat a role. Keep the game in control.",
    label: "REAL TWITCH · WINNING ENDING",
    caption:
      "Checkpoint · Experimental TypeScript SDK + The Last Beacon showcase · MIT licensed",
    narration:
      "One courier, a shared expedition, and predictable consequences. Checkpoint gives chat a role, while the game stays in control.",
  },
];
