import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFile, writeFile, appendFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { ownerVideo, plan } from "./final-plan.mjs";

const output = path.resolve("submission/final");
await mkdir(output, { recursive: true });
const files = {
  live: process.env.CHECKPOINT_LIVE_VIDEO || ownerVideo,
  reliability: path.resolve("submission/footage/simulated-reliability.mp4"),
  sdk: path.resolve("submission/footage/sdk-example.mp4"),
  codex: path.resolve("submission/manual/codex-build.mp4"),
};
const hasCodex = await stat(files.codex)
  .then((s) => s.size > 0)
  .catch(() => false);
const preview = process.argv.includes("--preview");
if (!hasCodex && !preview)
  throw new Error(
    "Genuine Codex footage required: submission/manual/codex-build.mp4. Use --preview only for a clearly marked incomplete review.",
  );
const target = path.join(
  output,
  hasCodex ? "checkpoint-submission.mp4" : "checkpoint-cut-PENDING-CODEX.mp4",
);
const server = createServer(async (req, res) => {
  try {
    const route = new URL(req.url, "http://localhost").pathname.slice(1);
    if (route === "editor")
      return res
        .writeHead(200, { "Content-Type": "text/html" })
        .end('<canvas width="1920" height="1080"></canvas>');
    let file, type;
    if (Object.hasOwn(files, route)) {
      file = files[route];
      type = "video/mp4";
    } else if (/^audio-[0-8]$/.test(route)) {
      file = path.join(output, "audio", `segment-${route.slice(6)}.wav`);
      type = "audio/wav";
    } else return res.writeHead(404).end();
    const bytes = await readFile(file);
    res
      .writeHead(200, { "Content-Type": type, "Content-Length": bytes.length })
      .end(bytes);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  args: ["--autoplay-policy=no-user-gesture-required"],
});
let writes = Promise.resolve();
try {
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
  });
  await writeFile(target, Buffer.alloc(0));
  await page.exposeFunction("writeChunk", (data) => {
    writes = writes.then(() => appendFile(target, Buffer.from(data)));
    return writes;
  });
  await page.exposeFunction("chapter", (title) =>
    console.log(`Rendering: ${title}`),
  );
  await page.goto(origin + "/editor");
  const details = await page.evaluate(
    async ({ plan, hasCodex, origin }) => {
      const canvas = document.querySelector("canvas"),
        ctx = canvas.getContext("2d");
      const audio = new AudioContext(),
        destination = audio.createMediaStreamDestination();
      await audio.resume();
      const videos = new Map(),
        metadata = [];
      for (const file of new Set(plan.map((p) => p.file))) {
        if (file === "codex" && !hasCodex) continue;
        const v = document.createElement("video");
        v.muted = true;
        v.playsInline = true;
        v.src = URL.createObjectURL(
          await (await fetch(origin + "/" + file)).blob(),
        );
        await new Promise((r, j) => {
          v.onloadeddata = r;
          v.onerror = () => j(new Error("Video decode failed: " + file));
        });
        videos.set(file, v);
        metadata.push({
          file,
          duration: v.duration,
          width: v.videoWidth,
          height: v.videoHeight,
        });
      }
      if (hasCodex && videos.get("codex").duration < 19.8)
        throw Error("Codex evidence must be at least 20 seconds");
      const narration = [];
      for (let i = 0; i < plan.length; i++) {
        const response = await fetch(origin + "/audio-" + i);
        if (!response.ok) throw Error("Missing narration " + i);
        const buffer = await audio.decodeAudioData(
          await response.arrayBuffer(),
        );
        if (buffer.duration > plan[i].duration - 0.1)
          throw Error(`Narration ${i} too long: ${buffer.duration}`);
        narration.push(buffer);
      }
      const stream = canvas.captureStream(30);
      for (const track of destination.stream.getAudioTracks())
        stream.addTrack(track);
      const mime = "video/mp4;codecs=avc1.42001E,mp4a.40.2";
      if (!MediaRecorder.isTypeSupported(mime))
        throw Error("H264/AAC MP4 encoding unavailable");
      const recorder = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: 7500000,
        audioBitsPerSecond: 128000,
      });
      const pending = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size)
          pending.push(
            (async () =>
              window.writeChunk(
                Array.from(new Uint8Array(await e.data.arrayBuffer())),
              ))(),
          );
      };
      const stopped = new Promise((r) => (recorder.onstop = r));
      const wrap = (text, x, y, width, size = 28) => {
        ctx.font = `${size}px system-ui`;
        let line = "";
        for (const word of text.split(" ")) {
          if (line && ctx.measureText(line + word).width > width) {
            ctx.fillText(line, x, y);
            y += size * 1.3;
            line = "";
          }
          line += word + " ";
        }
        ctx.fillText(line, x, y);
      };
      let current = -1,
        frames = 0;
      const epoch = performance.now(),
        audioEpoch = audio.currentTime;
      recorder.start(1000);
      // Synthetic narration is the only audio; source microphone/system audio is excluded.
      for (let i = 0; i < plan.length; i++) {
        const source = audio.createBufferSource();
        source.buffer = narration[i];
        source.connect(destination);
        source.start(audioEpoch + plan[i].start + 0.15);
      }
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
              if (current >= 0) videos.get(plan[current].file)?.pause();
              current = index;
              window.chapter(part.title);
              const v = videos.get(part.file);
              if (v) {
                v.currentTime = part.in;
                v.playbackRate = 1;
                void v.play().catch(reject);
              }
            }
            ctx.fillStyle = "#0b111b";
            ctx.fillRect(0, 0, 1920, 1080);
            const v = videos.get(part.file);
            if (v) {
              const sy = part.crop ? v.videoHeight * 0.23 : 0,
                sh = v.videoHeight - sy;
              const scale = Math.min(1920 / v.videoWidth, 888 / sh),
                w = v.videoWidth * scale,
                h = sh * scale;
              ctx.drawImage(
                v,
                0,
                sy,
                v.videoWidth,
                sh,
                (1920 - w) / 2,
                112 + (888 - h) / 2,
                w,
                h,
              );
            } else {
              ctx.fillStyle = "#edc58e";
              ctx.font = "bold 44px system-ui";
              ctx.fillText("GENUINE CODEX CLIP STILL REQUIRED", 110, 400);
              ctx.fillStyle = "#d8e8e4";
              wrap(
                "This is an incomplete edit. Record the actual build thread; do not substitute recreated or generated evidence.",
                110,
                485,
                1650,
                34,
              );
            }
            ctx.fillStyle = "#edc58e";
            ctx.font = "600 31px system-ui";
            ctx.fillText(part.title, 28, 41);
            ctx.fillStyle = "#9de1ca";
            ctx.font = "bold 23px monospace";
            ctx.fillText(
              !hasCodex && part.file === "codex"
                ? "MISSING SOURCE · INCOMPLETE EDIT"
                : part.label,
              28,
              83,
            );
            ctx.fillStyle = "#172a32";
            ctx.fillRect(0, 1000, 1920, 80);
            ctx.fillStyle = "#edf5f3";
            wrap(part.caption, 28, 1032, 1860, 26);
            if (!hasCodex) {
              ctx.fillStyle = "#f3c78b";
              ctx.font = "bold 20px monospace";
              ctx.textAlign = "right";
              ctx.fillText("INCOMPLETE · CODEX FOOTAGE REQUIRED", 1880, 982);
              ctx.textAlign = "left";
            }
            frames++;
          } catch (e) {
            clearInterval(timer);
            reject(e);
          }
        }, 1000 / 30);
      });
      recorder.stop();
      await stopped;
      await Promise.all(pending);
      for (const v of videos.values()) v.pause();
      for (const t of stream.getTracks()) t.stop();
      await audio.close();
      return {
        metadata,
        narrationDurations: narration.map((b) => b.duration),
        frames,
        mime,
      };
    },
    { plan, hasCodex, origin },
  );
  await writes;
  await writeFile(
    path.join(output, "edit-manifest.json"),
    JSON.stringify(
      {
        status: hasCodex ? "RENDERED_AWAITING_INSPECTION" : "PENDING_CODEX",
        seconds: 160,
        hasCodex,
        narration:
          "Offline Microsoft Zira synthetic narration; no source audio or music",
        segments: plan,
        ...details,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ target, hasCodex, ...details }));
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
