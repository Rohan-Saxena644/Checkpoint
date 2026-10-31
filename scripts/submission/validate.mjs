import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import assert from "node:assert/strict";
const dir = path.resolve("submission/render"),
  file = path.join(dir, "checkpoint-review-INCOMPLETE.mp4");
const bytes = await readFile(file);
const server = createServer((req, res) => {
  if (req.url === "/file") {
    res
      .writeHead(200, {
        "Content-Type": "video/mp4",
        "Content-Length": bytes.length,
      })
      .end(bytes);
  } else
    res
      .writeHead(200, { "Content-Type": "text/html" })
      .end(
        "<style>body{margin:0;background:#0b111b}video{width:1920px;height:1080px}</style><video muted></video>",
      );
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  const metadata = await page.evaluate(async () => {
    const v = document.querySelector("video");
    const blob = await (await fetch("/file")).blob();
    v.src = URL.createObjectURL(blob);
    v.preload = "auto";
    await new Promise((resolve, reject) => {
      v.onloadeddata = resolve;
      v.onerror = reject;
    });
    if (v.duration < 159) {
      v.currentTime = 1e10;
      await new Promise((resolve) => {
        v.onseeked = resolve;
        setTimeout(resolve, 3000);
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { duration: v.duration, width: v.videoWidth, height: v.videoHeight };
  });
  console.log(JSON.stringify(metadata));
  assert(metadata.duration >= 159 && metadata.duration < 180);
  assert.equal(metadata.width, 1920);
  assert.equal(metadata.height, 1080);
  for (const [name, time] of [
    ["beginning", 1],
    ["middle", 80],
    ["ending", 158],
    ["missing-codex", 140],
  ]) {
    await page.evaluate(async (t) => {
      const v = document.querySelector("video");
      await new Promise((resolve) => {
        v.onseeked = resolve;
        v.currentTime = t;
      });
    }, time);
    await page.screenshot({ path: path.join(dir, name + ".png") });
  }
  await writeFile(
    path.join(dir, "validation.json"),
    JSON.stringify(
      {
        status: "INCOMPLETE_REVIEW",
        ...metadata,
        bytes: bytes.length,
        audio: "Silent; narration script supplied separately",
        liveTwitchVerified: false,
        codexDesktopPresent: false,
        missing: [
          "Real Twitch route/gate footage",
          "Genuine Codex desktop footage",
          "Recorded narration",
        ],
        inspectionFrames: [
          "beginning.png",
          "middle.png",
          "ending.png",
          "missing-codex.png",
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    "Playback validated; beginning, middle, ending and missing-evidence frames captured.",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
