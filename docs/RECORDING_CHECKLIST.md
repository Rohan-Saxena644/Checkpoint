# Recording checklist · 2:40 target

**Missing:** genuine Twitch authorization/input footage, genuine Codex desktop footage, recorded narration. Simulator activity is not a live test. No upload or publication is authorized. The automated review must not be submitted as final.

## Tools checked in this environment

- Playwright Chromium can capture actual browser frames and encode/decode H.264 MP4 locally. The recording script uses CDP frames and MediaRecorder after native multi-page WebM finalization stalled. No dependencies were added.
- Playwright's bundled FFmpeg supports VP9/WebM and PNG, **not H.264/MP4 editing**. No system `ffmpeg` or `ffprobe` was found on PATH.
- Windows Snipping Tool **11.2608.41.0** and Xbox Game Bar are installed. OBS was not found on PATH or its standard installation path. Native desktop capture requires owner operation; Codex desktop footage was not captured automatically.
- Automated footage/review is silent. Narration is supplied separately; no music or generated functionality imagery is used.

## Start the application

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd start
```

Open `http://localhost:4173/play`. Unlock using the private terminal code **before recording**. Close/minimize that terminal and `.env` afterward. WASD/arrows move; collect **2 region fragments**, then enter the beacon on the right. Escape pauses. Use the existing Easy mode for the take and disclose it; do not change speed or deadlines.

## Exact Twitch setup — recorder OFF

1. Register a **Confidential** app in the [developer console](https://dev.twitch.tv/console/apps), using an email-verified, 2FA-enabled account. Add exactly `http://localhost:4173/auth/twitch/callback`. [Official registration guide](https://dev.twitch.tv/docs/authentication/register-app/).
2. Copy `.env.example` to `.env`; privately enter `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET`. Keep `PUBLIC_ORIGIN=http://localhost:4173` and the redirect consistent. Never paste or print the values in evidence.
3. Restart, unlock, choose **Twitch → Authorize broadcaster**. Complete OAuth as the broadcaster whose channel will supply commands. This installed single-channel flow uses only `user:read:chat`, per [official Twitch authentication](https://dev.twitch.tv/docs/chat/authenticating/). No paid viewer action is used.
4. Wait for **Twitch connected**. Before starting, select **Small crew · 2 participants** and Easy mode. With only one available participant, explicitly choose **Solo signal · 1 participant** and change the narration accordingly. Never call repeated commands from one account two participants.
5. See `TWITCH_SETUP.md` for token and reconnect policy. If authorization fails, keep recording stopped. Do not relabel simulator footage or silently switch modes.

## Record real game and chat together

Place `/play` and actual channel pop-out chat side by side; optionally include the separate `/overlay` if readable. Use the installed Snipping Tool **Win+Shift+R**, select a rectangular region containing game and chat, start, then stop and save locally. This region recorder can capture both windows. [Microsoft's instructions](https://support.microsoft.com/en-us/windows/apps/use-snipping-tool-to-capture-screenshots). Game Bar is an alternative for a single-window take.

Target 1920×1080. Keep commands, accepted counts, timer, outcome and game consequence readable. Exclude OAuth/account menus, private messages, emails, unrelated chat, terminal codes and `.env`. Ask participants for consent and minimize visible identity data. Disable notifications and copyrighted/background audio.

## Timestamped final takes

| Final time    | Take and checks                                                                                                                                                                                                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0:00–0:12** | Pitch over actual movement and a collected fragment. Label simulated input if using the automated opening.                                                                                                                                                                                                    |
| **0:12–0:55** | **Real Twitch route:** start 3s before the beacon. Show real `!route left`, accepted count rising, the normal **18s** timer expiring, the Shatterpath decision, then actual movement through **6 hazards / 4 salvage opportunities**. Retain 43 usable seconds and preserve the causal sequence continuously. |
| **0:55–1:25** | **Real cooperative gate:** explicitly cut past traversal. Show the selected preset, distinct accounts entering `!charge`, accepted progress, natural resolution, and the **12s protective field** during crossing. Capture 30 usable seconds. A shield absorption insert may supplement this, not replace it. |
| **1:25–1:45** | **SIMULATED TRANSPORT FAILURE:** `/dev` disconnect → frozen countdown → resume. Cut idle waiting explicitly, then show repeated outcome ignored. Do not claim a real Twitch outage.                                                                                                                           |
| **1:45–2:10** | **Actual SDK/dev example:** `examples/signal-panel.ts`, two generic participants, idempotent apply guard, `npm.cmd run example`, and `/example` local buttons. This is development evidence.                                                                                                                  |
| **2:10–2:30** | **Genuine Codex build:** this real main thread, actual relevant edits and passing checks. Keep private tool outputs collapsed. Repository files and commits support the thread evidence; do not recreate a session.                                                                                           |
| **2:30–2:40** | Actual win/gameplay and tagline. No missing placeholder or incomplete-review watermark may remain in a final submission.                                                                                                                                                                                      |

Cuts between encounters are allowed. Do not speed up footage, change deadlines, teleport, invoke private game state or mask failed input. The automated capture uses normal keyboard/buttons and full natural windows.

## Manual files still required

Save locally under `submission/manual/`:

- `live-route.mp4`: 43+ seconds of real chat/game causal evidence, after authentication.
- `live-gate.mp4`: 30+ seconds of real cooperation and the protective crossing.
- `codex-build.mp4`: 20+ seconds of the genuine main build thread.
- `narration.wav` or a local editor voiceover: read `NARRATION.md` against the timeline.

These files are not supplied by the simulator recorder. The review renderer never auto-promotes files to verified live evidence.

## Automated capture and incomplete review

```powershell
# Capture script owns loopback port 4175; stop an existing capture first.
npm.cmd exec tsx -- scripts/submission/record.ts
# After the three required review takes have finalized:
node scripts/submission/render.mjs
```

Outputs: ignored `submission/footage/` and `submission/render/`. `capture-report.json` contains real markers/assertions; `review-plan.json` records edits; `validation.json` records playback/duration and missing evidence. The fallback samples actual browser frames; it invents no intermediate imagery. The incomplete review is silent and prominently labels synthetic stand-ins and missing Codex evidence.

## Final owner review

- [ ] Genuine live commands worked; record date/results without secrets.
- [ ] Replace live slots and Codex card; add narration. Use a local editor of your choice.
- [ ] Inspect beginning, route sequence, gate, simulated reliability, SDK, Codex and ending at normal playback. Check readability, voice levels, and absence of secrets/music.
- [ ] Export a local MP4, verify it opens, and measure **under 180s**, targeting 160s.
- [ ] Enter `/status` in this main build thread and obtain the actual session ID, per the [official FAQ](https://twitchcon-codex.devpost.com/resources).
- [ ] Review `SUBMISSION_CHECKLIST.md` and `DEVPOST_DRAFT.md`. Nothing is uploaded by these commands.

The supplemental no-viewer/failure capture was interrupted by a transient HTTP read reset. It is excluded from the edit and not counted as completed footage. Those game behaviors passed browser regression tests. The renderer accepts the three finalized review sources, validates decoding and length, and keeps the incomplete review labels regardless of the supplemental take. Read-only polling now retries transient connection resets; it never retries game-control mutations.
