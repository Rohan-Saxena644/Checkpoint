# Final verification and submission handoff

Feature scope is frozen. This phase changes only demonstrated gameplay feedback, restart cleanup, focused regression coverage and local recording/submission materials. No SDK features, engines, interaction types, integrations or dependencies were added.

## Status

| Area                                                                                   | Evidence / boundary                                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full progression, route effect, shield absorption, two-person goal, ending and restart | Normal-control simulator capture with natural 18-second windows; assertions and source times in `submission/footage/capture-report.json`. Separate browser regression suite also exercises the complete loop.                                                     |
| Failure ending and restart                                                             | Focused browser regression deliberately stands in a real storm hazard; the supplemental recording was interrupted and is excluded from approved footage. No health injection or teleport is used by recording.                                                    |
| Supply effects                                                                         | Shield absorption captured; healing's actual +2/cap and the boost's bounded active-play duration are unit-tested. Active shield/boost/field now have readable on-map feedback.                                                                                    |
| No-viewer fallback                                                                     | Browser no-input route expiry and complete fallback run, plus natural no-input supply capture. No fake viewers are inserted.                                                                                                                                      |
| Commands, timer, accepted input, outcome                                               | Canvas checkpoint command banner, accepted counters, bounded effect messages, and separate synchronized overlay. Paused input now says paused and shows remaining seconds.                                                                                        |
| Overlay read-only                                                                      | Unauthenticated control HTTP POST returns 403; existing security test closes even an authenticated broadcast socket on a control message (1008).                                                                                                                  |
| Input/reconnect reliability                                                            | Core/synthetic adapter tests and `/dev` capture cover invalid, repeated, duplicate-delivery, stale/late and old-window input, frozen timer, resume and duplicate outcome application. This is simulated/mocked verification.                                      |
| Live Twitch                                                                            | **PENDING**. No `.env` or configured Twitch client ID/secret was available. No broadcaster authorization, real message, or real outage is claimed.                                                                                                                |
| Video                                                                                  | The renderer produces a **silent INCOMPLETE review**, with synthetic labels, a missing-Codex card, and no submission-ready claim. Required manual sources are in `CLIP_MANIFEST.md`. Confirm `submission/render/validation.json` before claiming a render passed. |

## Fixed during this phase

- Restart previously left the last run's decision/command visible. The showcase now exposes a window only when it belongs to the current run, and resets the presentation command to `!route`. Regression checks cover restart cleanup.
- Current-region collection was unclear because the HUD showed the run total. It now shows region progress toward the two-fragment checkpoint requirement.
- Paused windows previously invited commands. They now explicitly pause input instructions and show preserved remaining seconds in the game view.
- Supply/gate effects were subtle. The map now shows existing shield, speed or field status, and outcome text states the actual bounded effect (including healing's real amount). Mechanics and deadlines are unchanged.
- Native multi-page WebM finalization stalled locally. The documented fallback captures actual CDP-rendered browser frames and encodes H.264 in the installed Chromium, with lighter capture load and no game timing changes. Partial native files are excluded from the approved clip manifest.

## Commands

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
npm.cmd start
```

Application: `http://localhost:4173/play`; overlay: `/overlay`; simulator: `/dev`; independent signal panel: `/example`. Stop a server on port 4173 before the browser suite, which owns that port.

```powershell
# Normal-control local synthetic capture; owns port 4175:
npm.cmd exec tsx -- scripts/submission/record.ts
# After the three required review takes finalize:
node scripts/submission/render.mjs
```

Recording helpers: `scripts/submission/record.ts`, `capture.ts`, `render.mjs`. Raw sources/screenshots/report: `submission/footage/`. Review, plan and playback validation: `submission/render/`. These media directories are Git-ignored; source and instructions are committed.

## Manual work still required

1. Register the Twitch app, privately configure `.env`, restart and authorize the broadcaster **with recording stopped**. Exact current setup is in `RECORDING_CHECKLIST.md` and `TWITCH_SETUP.md`.
2. Record actual Twitch route and cooperative clips (`submission/manual/live-route.mp4`, `live-gate.mp4`) showing command → accepted count → natural resolution → actual consequence.
3. Record 20 seconds of this genuine main Codex build thread to `submission/manual/codex-build.mp4`. Keep secrets/authentication off camera. Obtain the actual session ID with `/status`; no ID is fabricated.
4. Record the narration, replace missing/stand-in slots, inspect the final beginning/middle/end and all required segments, verify MP4 playback and duration under 180 seconds. The automated review is not a final submission.
5. Review the factual Devpost draft and eligibility, repository access and video requirements. No upload, publishing or submission was performed or authorized here.

## Official requirements rechecked

Reviewed on **31 October 2026**: [overview](https://twitchcon-codex.devpost.com/), [resources](https://twitchcon-codex.devpost.com/resources), [rules](https://twitchcon-codex.devpost.com/rules). The entry requires a runnable source repository, description of features/Codex usage, real main-thread session ID, and a public YouTube demonstration under three minutes showing Twitch functionality and Codex build evidence. Current deadline: **2 November 2026, 2 PM Pacific**, **3 November 2026, 3:30 AM Asia/Kolkata**. Publication is a later owner action, not part of this task.

## Checks completed in this phase

- Strict typecheck, lint, production build: passed.
- Unit/security suite: **45 passed**.
- Browser: all **5 scenarios** passed across the full run (4 passed, 1 transient read-reset failure) and a focused crew rerun (1 passed). Read-only polling now retries transient resets; controls are never retried automatically.
- Live Twitch: **not verified**; app credentials/authorization absent.
- Media: count only the three finalized H.264 review sources. The supplemental failure take is incomplete and excluded. Render validation is stored separately in submission/render/validation.json.

Local review MP4 validated: **159.849 seconds, 1920×1080, H.264, silent**, 7,113,040 bytes. Complete-file browser playback and beginning/middle/end frame inspection passed. The file remains clearly labeled **INCOMPLETE** because live Twitch, genuine Codex desktop footage and recorded narration are missing. See `submission/render/validation.json`. No media was uploaded.
