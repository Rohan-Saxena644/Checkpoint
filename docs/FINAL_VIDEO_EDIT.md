# Final video edit

**Current upload file:** `submission/final/checkpoint-submission.mp4` is now the **silent, subtitled** version requested by the owner. Verified duration **159.904967 seconds**, 1920×1080 H.264, 12,462,136 bytes. MP4 handler inspection confirms **one video track and no audio track**. It has 27 short burned-in English cues, complete timeline coverage and a maximum reading rate of 13.8 characters/second. Beginning, middle, SDK, Codex and ending frames were visually inspected. Footage, cuts, timing and evidence labels are preserved. Older narrated measurements below describe superseded versions. The optional SRT is beside the MP4; it is not required for the burned-in text to appear.

The edit uses the owner's real Twitch/game screen recording from 2 November, existing explicitly simulated reliability footage, and actual SDK-example footage. Playback stays at normal speed; travel and preparation are cut between sections. The one-person preset is labeled accurately. At the owner's request, the current final version is **silent, with short burned-in English subtitles**. Voice, source microphone/system audio and music are excluded. The previous voiced version is only a local backup.

Required final source: a **genuine 20-second screen recording of the main Codex build thread**, saved to `submission/manual/codex-build.mp4`. Show actual implementation or passing verification. Do not show authentication, private codes or secrets. Do not recreate messages or session IDs. The final renderer refuses to run without this source; it checks decodability and duration, and the content must also be inspected by a person.

From the repository root on Windows:

```powershell
node scripts/submission/render-final.mjs
node scripts/submission/validate-final.mjs
```

The live recording path is specified in `scripts/submission/final-plan.mjs`; override it with `CHECKPOINT_LIVE_VIDEO` if moved. Source cuts remain in that plan. Current subtitles are in `scripts/submission/subtitles.mjs`, cover all 160 seconds, and are also written to `submission/final/checkpoint-submission.srt`. No voice generation or audio files are needed. No npm installation, network service or new editing dependency is required.

Output: `submission/final/checkpoint-submission.mp4`, approximately 160 seconds, 1920×1080 H.264/AAC. `edit-manifest.json` records sources, speech duration and exact segments; `validation.json` records actual decoded duration, video dimensions and non-silent audio. Inspect all sections and beginning/middle/end frames, and listen to the finished file before uploading. Check captions, command acceptance and actual effect; ensure no unintended private material appears.

Without the Codex source, `node scripts/submission/render-final.mjs --preview` makes `checkpoint-cut-PENDING-CODEX.mp4` with a conspicuous incomplete label and missing-source card. **That is not a submission-ready video.** The preview uses the intended final narration script, whose Codex passage requires replacement of the missing footage before release.

Storyboard: 0:00 pitch; 0:12 live route; 0:41 live shield; 0:55 live cooperative goal; 1:25 simulated reliability; 1:45 SDK and local-button integration; 2:10 genuine Codex; 2:30 real winning ending; end 2:40. The live route and shield together occupy the planned 43-second live decision section. Exact cuts must be checked against the original causal sequence.

Nothing is uploaded or published by these commands.

## Local preview verification — 2 November

`checkpoint-cut-PENDING-CODEX.mp4` decoded successfully: **159.8746 seconds, 1920×1080, H.264/AAC, 12,380,579 bytes**. The stereo narration track decoded for 158.66 seconds with nonzero signal (RMS 0.0825). Nine frames across all chapters were captured; live accepted route/supply/charge, simulated pause, SDK panel, missing-Codex card and winning ending were visually inspected. Source and captions are readable at full resolution; smaller source text in the simulated footage is softer. This checks decoding and non-silent audio, not a complete listening review.

The opening source offset was subsequently adjusted from 14 to 24 seconds to avoid a paused-gameplay section; this improvement will be included in the next render. The preview remains incomplete until genuine Codex footage replaces its missing-source card, followed by final visual and listening review. Scripts pass repository lint. The underlying application has not been changed during editing.

## Final handoff — 2 November

**Upload file: `D:/Comeback/CheckPoint/submission/final/checkpoint-submission.mp4`.** Actual encoded duration **159.9661 seconds**, **1920×1080**, **H.264/AAC**, **13,368,373 bytes**. All required source segments are present; no placeholder or incomplete watermark remains. The genuine Codex clip uses source time 8–28 seconds, showing real tests and build output. The replacement SDK source shows the actual cyan result, repository example and executed `2 participants / 1 effect` output; an earlier stale source was replaced before this final encode.

Playback decoding and stereo non-silent narration checks passed. Fourteen inspection frames were extracted across all chapters; beginning, live consequence, shield, protection, corrected SDK source/output, genuine Codex and ending were visually reviewed. Smaller source text in the simulated reliability clip is softer; its explanatory captions remain readable. Audio was checked by decoding/signal measurement, not a full listening review. The owner should watch the finished file with sound before uploading. Source system/microphone audio and music are excluded. Nothing has been uploaded or published.
