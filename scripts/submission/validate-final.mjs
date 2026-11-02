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
// Inspect actual MP4 handlers rather than trusting a muted player or manifest.
function handlers(buffer, start = 0, end = buffer.length) {
  const result = [];
  for (let offset = start; offset + 8 <= end;) {
    let size = buffer.readUInt32BE(offset),
      header = 8;
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    if (size === 1) {
      size = Number(buffer.readBigUInt64BE(offset + 8));
      header = 16;
    }
    if (size === 0) size = end - offset;
    assert(size >= header && offset + size <= end, "Invalid MP4 box");
    if (["moov", "trak", "mdia"].includes(type))
      result.push(...handlers(buffer, offset + header, offset + size));
    if (type === "hdlr")
      result.push(
        buffer.toString("ascii", offset + header + 8, offset + header + 12),
      );
    offset += size;
  }
  return result;
}
const trackHandlers = handlers(bytes);
assert(trackHandlers.includes("vide"), "Video track must exist");
assert(
  !trackHandlers.includes("soun"),
  "Subtitled version must contain no audio track",
);
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
    return {
      duration: v.duration,
      width: v.videoWidth,
      height: v.videoHeight,
    };
  });
  assert(
    metadata.duration > 158 && metadata.duration < 180,
    "Video must remain below 180 seconds",
  );
  assert.equal(metadata.width, 1920);
  assert.equal(metadata.height, 1080);
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
    audio: {
      tracks: 0,
      verifiedHandlers: trackHandlers,
      description: "Silent; no audio track",
    },
    bytes: bytes.length,
    frames,
    narration:
      "None. Burned-in English subtitles; no voice, music or source audio.",
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
