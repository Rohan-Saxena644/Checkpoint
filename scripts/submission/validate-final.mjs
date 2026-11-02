import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import assert from "node:assert/strict";
const dir = path.resolve("submission/final");
const manifest = JSON.parse(
  await readFile(path.join(dir, "edit-manifest.json"), "utf8"),
);
const name = manifest.hasCodex
  ? "checkpoint-submission.mp4"
  : "checkpoint-cut-PENDING-CODEX.mp4";
const bytes = await readFile(path.join(dir, name));
const server = createServer((req, res) =>
  req.url === "/file"
    ? res
        .writeHead(200, {
          "Content-Type": "video/mp4",
          "Content-Length": bytes.length,
        })
        .end(bytes)
    : res
        .writeHead(200, { "Content-Type": "text/html" })
        .end(
          "<style>body{margin:0;background:#0b111b}video{width:1920px;height:1080px}</style><video muted></video>",
        ),
);
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const metadata = await page.evaluate(async () => {
    const data = await (await fetch("/file")).arrayBuffer();
    const v = document.querySelector("video");
    v.src = URL.createObjectURL(new Blob([data], { type: "video/mp4" }));
    await new Promise((r, j) => {
      v.onloadeddata = r;
      v.onerror = j;
    });
    const context = new AudioContext();
    const sound = await context.decodeAudioData(data.slice(0));
    const samples = sound.getChannelData(0);
    let peak = 0,
      sum = 0;
    for (let i = 0; i < samples.length; i += 20) {
      peak = Math.max(peak, Math.abs(samples[i]));
      sum += samples[i] * samples[i];
    }
    const rms = Math.sqrt(sum / Math.ceil(samples.length / 20));
    await context.close();
    return {
      duration: v.duration,
      width: v.videoWidth,
      height: v.videoHeight,
      audio: {
        channels: sound.numberOfChannels,
        duration: sound.duration,
        peak,
        rms,
      },
    };
  });
  assert(
    metadata.duration > 158 && metadata.duration < 180,
    "Video must remain below 180 seconds",
  );
  assert.equal(metadata.width, 1920);
  assert.equal(metadata.height, 1080);
  assert(
    metadata.audio.duration > 158 &&
      metadata.audio.peak > 0.02 &&
      metadata.audio.rms > 0.001,
    "Narration must decode and contain non-silent audio",
  );
  const frames = [];
  for (const time of [
    2, 24, 38, 48, 53, 70, 82, 90, 101, 118, 126, 140, 148, 157,
  ]) {
    await page.evaluate(async (t) => {
      const v = document.querySelector("video");
      await new Promise((r) => {
        v.onseeked = r;
        v.currentTime = t;
      });
    }, time);
    const name = `inspect-${time}s.jpg`;
    await page.screenshot({
      path: path.join(dir, name),
      type: "jpeg",
      quality: 85,
    });
    frames.push(name);
  }
  const result = {
    status: manifest.hasCodex
      ? "PLAYBACK_VALIDATED_REQUIRES_VISUAL_REVIEW"
      : "INCOMPLETE_CODEX_REQUIRED",
    ...metadata,
    bytes: bytes.length,
    frames,
    narration: "Offline synthetic voice; no music or source audio",
    missing: manifest.hasCodex ? [] : ["Genuine 20-second Codex footage"],
  };
  await writeFile(
    path.join(dir, "validation.json"),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
