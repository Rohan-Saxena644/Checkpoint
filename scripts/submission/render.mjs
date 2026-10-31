import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { readFile, writeFile, appendFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";

// Deliberately produces an INCOMPLETE review only. Live/Codex evidence cannot be synthesized.
const root = path.resolve("submission/footage"),
  output = path.resolve("submission/render");
await mkdir(output, { recursive: true });
const report = JSON.parse(
  await readFile(path.join(root, "capture-report.json"), "utf8"),
);
assert.equal(report.liveTwitchVerified, false);
// Supplemental failure footage is not required by this incomplete review cut.
// Required source markers and actual decoding/length are checked below.
const at = (clip, event) => {
  const marker = report.markers.find(
    (m) => m.clip === clip && m.event === event,
  );
  assert(marker, `Missing marker ${event}`);
  return marker.at;
};
const main = "simulated-expedition",
  reliability = "simulated-reliability";
const plan = [
  {
    start: 0,
    duration: 12,
    file: main + ".mp4",
    in: at(main, "gameplay-start"),
    crop: true,
    title: "Checkpoint · The Last Beacon",
    label: "SIMULATED GAMEPLAY",
    caption: "Give chat a role. Keep the game in control.",
  },
  {
    start: 12,
    duration: 43,
    file: main + ".mp4",
    in: Math.max(0, at(main, "route-window-open") - 3),
    crop: true,
    title: "Command → acceptance → decision → consequence",
    label: "SIMULATED INPUT · REPLACE WITH LIVE TWITCH",
    caption:
      "!route left → two accepted participants → Shatterpath: six hazards, four salvage opportunities.",
  },
  {
    start: 55,
    duration: 30,
    file: main + ".mp4",
    in: Math.max(0, at(main, "goal-window-open") - 2),
    crop: true,
    title: "A small crew powers the final crossing",
    label: "SIMULATED INPUT · LIVE GATE CLIP MISSING",
    caption:
      "!charge · one contribution per participant · two-person goal · 12-second protective field.",
  },
  {
    start: 85,
    duration: 12,
    file: reliability + ".mp4",
    in: Math.max(0, at(reliability, "simulated-disconnect") - 2),
    crop: true,
    title: "Reliability demonstration",
    label: "SIMULATED TRANSPORT FAILURE",
    caption:
      "Disconnection freezes input and remaining time. Recovery resumes the synchronized window.",
  },
  {
    start: 97,
    duration: 8,
    file: reliability + ".mp4",
    in: Math.max(0, at(reliability, "duplicate-outcome-ignored") - 5),
    crop: false,
    title: "Reliability demonstration · explicit edit",
    label: "SIMULATED · IDLE WAIT CUT",
    caption:
      "A repeated outcome is ignored. The courier does not receive its effect twice.",
  },
  {
    start: 105,
    duration: 25,
    file: "sdk-example.mp4",
    in: 0,
    crop: false,
    title: "Actual SDK usage · existing second example",
    label: "DEVELOPMENT EVIDENCE · NO TWITCH REQUIRED",
    caption:
      "Public core exports, two generic participants, deterministic resolution, idempotent application.",
  },
  {
    start: 130,
    duration: 20,
    file: null,
    in: 0,
    crop: false,
    title: "Codex build evidence is still required",
    label: "MISSING MANUAL SOURCE · NOT PROOF",
    caption:
      "Record the genuine main build thread. This placeholder must be replaced before submission.",
  },
  {
    start: 150,
    duration: 10,
    file: main + ".mp4",
    in: at(main, "win") + 0.5,
    crop: true,
    title: "Give chat a role. Keep the game in control.",
    label: "SIMULATED GAMEPLAY · INCOMPLETE REVIEW",
    caption:
      "Real Twitch and genuine Codex desktop clips are still missing. Nothing has been uploaded.",
  },
];
await writeFile(
  path.join(output, "review-plan.json"),
  JSON.stringify(
    {
      status: "INCOMPLETE_REVIEW",
      seconds: 160,
      missing: [
        "live-route.mp4",
        "live-gate.mp4",
        "codex-build.mp4",
        "recorded narration",
      ],
      segments: plan,
    },
    null,
    2,
  ),
);
const server = createServer(async (req, res) => {
  try {
    if (req.url === "/editor") {
      res
        .writeHead(200, { "Content-Type": "text/html" })
        .end("<!doctype html><title>Local review renderer</title>");
      return;
    }
    const name = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname.slice(1),
    );
    if (path.basename(name) !== name || !name.endsWith(".mp4")) {
      res.writeHead(404).end();
      return;
    }
    const file = path.join(root, name),
      size = (await stat(file)).size;
    const match = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range ?? "");
    if (match) {
      const start = Number(match[1]),
        end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
      if (start >= size) {
        res.writeHead(416).end();
        return;
      }
      res.writeHead(206, {
        "Content-Type": "video/mp4",
        "Content-Length": end - start + 1,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Accept-Ranges": "bytes",
      });
      createReadStream(file, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Type": "video/mp4",
        "Content-Length": size,
        "Accept-Ranges": "bytes",
      });
      createReadStream(file).pipe(res);
    }
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const browser = await chromium.launch();
const target = path.join(output, "checkpoint-review-INCOMPLETE.mp4");
await writeFile(target, Buffer.alloc(0));
let writeQueue = Promise.resolve();
try {
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
  });
  await page.exposeFunction("writeReviewChunk", (data) => {
    writeQueue = writeQueue.then(() => appendFile(target, Buffer.from(data)));
    return writeQueue;
  });
  await page.exposeFunction("chapter", (title) =>
    console.log(`Rendering: ${title}`),
  );
  await page.goto(`http://127.0.0.1:${port}/editor`);
  await page.setContent(
    '<style>html,body{margin:0;background:#0b111b}canvas{display:block;width:100vw;height:100vh}</style><canvas width="1920" height="1080"></canvas>',
  );
  const result = await page.evaluate(
    async ({ plan, port }) => {
      const canvas = document.querySelector("canvas"),
        ctx = canvas.getContext("2d");
      const videos = new Map();
      const metadata = [];
      for (const file of new Set(
        plan.filter((p) => p.file).map((p) => p.file),
      )) {
        const v = document.createElement("video");
        v.muted = true;
        v.preload = "auto";
        v.src = `http://127.0.0.1:${port}/${file}`;
        await new Promise((resolve, reject) => {
          v.onloadeddata = resolve;
          v.onerror = () => reject(new Error(`Cannot decode ${file}`));
        });
        videos.set(file, v);
        metadata.push({
          file,
          duration: v.duration,
          width: v.videoWidth,
          height: v.videoHeight,
        });
      }
      for (const segment of plan) {
        if (segment.file) {
          const v = videos.get(segment.file);
          if (Number.isFinite(v.duration) && segment.duration > v.duration)
            throw new Error(
              `Insufficient source footage for ${segment.title}: ${v.duration}`,
            );
          if (Number.isFinite(v.duration))
            segment.in = Math.min(
              segment.in,
              Math.max(0, v.duration - segment.duration - 0.05),
            );
        }
      }
      const stream = canvas.captureStream(30);
      const media = new MediaRecorder(stream, {
        mimeType: "video/mp4;codecs=avc1.42001E",
        videoBitsPerSecond: 6000000,
      });
      const writes = [];
      media.ondataavailable = (e) => {
        if (e.data.size)
          writes.push(
            (async () =>
              window.writeReviewChunk(
                Array.from(new Uint8Array(await e.data.arrayBuffer())),
              ))(),
          );
      };
      const stop = new Promise((resolve) => (media.onstop = resolve));
      let current = -1,
        frames = 0;
      const epoch = performance.now();
      media.start(1000);
      const wrap = (text, x, y, maxWidth, font = 30) => {
        ctx.font = `${font}px system-ui`;
        const words = text.split(" ");
        let line = "";
        for (const word of words) {
          if (ctx.measureText(line + word).width > maxWidth && line) {
            ctx.fillText(line, x, y);
            y += font * 1.35;
            line = "";
          }
          line += word + " ";
        }
        ctx.fillText(line, x, y);
      };
      await new Promise((resolve, reject) => {
        const timer = setInterval(() => {
          try {
            const elapsed = (performance.now() - epoch) / 1000;
            if (elapsed >= 160) {
              clearInterval(timer);
              resolve();
              return;
            }
            const index = plan.findIndex(
                (p) => elapsed >= p.start && elapsed < p.start + p.duration,
              ),
              part = plan[index];
            if (index !== current) {
              if (current >= 0 && plan[current].file)
                videos.get(plan[current].file).pause();
              current = index;
              window.chapter(part.title);
              if (part.file) {
                const v = videos.get(part.file);
                v.currentTime = part.in;
                v.playbackRate = 1;
                void v.play().catch(reject);
              }
            }
            ctx.fillStyle = "#0b111b";
            ctx.fillRect(0, 0, 1920, 1080);
            if (part.file) {
              const video = videos.get(part.file);
              if (part.crop)
                ctx.drawImage(
                  video,
                  0,
                  video.videoHeight * 0.23,
                  video.videoWidth,
                  video.videoHeight * 0.77,
                  0,
                  70,
                  1920,
                  924,
                );
              else {
                const scale = Math.min(
                    1920 / video.videoWidth,
                    924 / video.videoHeight,
                  ),
                  w = video.videoWidth * scale,
                  h = video.videoHeight * scale;
                ctx.drawImage(video, (1920 - w) / 2, 70 + (924 - h) / 2, w, h);
              }
            } else {
              ctx.fillStyle = "#14232e";
              ctx.fillRect(120, 190, 1680, 650);
              ctx.fillStyle = "#f0bc77";
              ctx.font = "bold 54px system-ui";
              ctx.fillText("MISSING: GENUINE CODEX BUILD CLIP", 190, 315);
              ctx.fillStyle = "#d4e2e4";
              wrap(
                "Capture 20 seconds of the real main build thread and relevant edits or passing verification.",
                190,
                420,
                1500,
                38,
              );
              wrap(
                "Do not replace this card with generated chat, recreated sessions, or a fake session ID.",
                190,
                565,
                1500,
                34,
              );
              ctx.fillStyle = "#88bfb2";
              wrap(
                "Manual source: submission/manual/codex-build.mp4",
                190,
                730,
                1500,
                30,
              );
            }
            ctx.fillStyle = "#0b111bf5";
            ctx.fillRect(0, 0, 1920, 70);
            ctx.fillStyle = "#efc183";
            ctx.font = "600 27px system-ui";
            ctx.fillText(part.title, 30, 43);
            ctx.fillStyle = "#182831";
            ctx.fillRect(0, 994, 1920, 86);
            ctx.fillStyle = "#deebe9";
            wrap(part.caption, 30, 1027, 1850, 27);
            ctx.fillStyle = "#0a171eea";
            ctx.fillRect(
              20,
              84,
              Math.min(1700, part.label.length * 17 + 30),
              46,
            );
            ctx.fillStyle = "#a6e1cb";
            ctx.font = "bold 24px monospace";
            ctx.fillText(part.label, 35, 115);
            ctx.fillStyle = "#f1bf7a";
            ctx.font = "bold 21px monospace";
            ctx.textAlign = "right";
            ctx.fillText("INCOMPLETE REVIEW · NOT FOR SUBMISSION", 1890, 966);
            ctx.textAlign = "left";
            frames++;
          } catch (error) {
            clearInterval(timer);
            reject(error);
          }
        }, 1000 / 30);
      });
      media.stop();
      await stop;
      await Promise.all(writes);
      for (const track of stream.getTracks()) track.stop();
      for (const v of videos.values()) v.pause();
      return { mime: media.mimeType, frames, metadata, effectivePlan: plan };
    },
    { plan, port },
  );
  await writeQueue;
  console.log(JSON.stringify(result));
  await writeFile(
    path.join(output, "render-details.json"),
    JSON.stringify(result, null, 2),
  );
  await writeFile(
    path.join(output, "review-plan.json"),
    JSON.stringify(
      {
        status: "INCOMPLETE_REVIEW",
        seconds: 160,
        segments: result.effectivePlan,
      },
      null,
      2,
    ),
  );
  execFileSync(process.execPath, ["scripts/submission/validate.mjs"], {
    stdio: "inherit",
  });
  console.log(
    "Local incomplete review rendered and validated. Real Twitch/Codex evidence remains missing.",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
