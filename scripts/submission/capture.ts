import type { Browser, Page } from "@playwright/test";
import { appendFile, writeFile } from "node:fs/promises";

/** CDP captures actual rendered browser frames; H.264 encoding stays local in Chromium.
 * No desktop capture, DOM substitution, speed changes, or generated proof frames. */
export async function capture(browser: Browser, page: Page, filename: string) {
  await writeFile(filename, Buffer.alloc(0));
  const recorderContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const recorder = await recorderContext.newPage();
  await recorder.exposeFunction("writeChunk", (data: number[]) =>
    appendFile(filename, Buffer.from(data)),
  );
  await recorder.setContent('<canvas width="1280" height="800"></canvas>');
  await recorder.evaluate(() => {
    const win = window as unknown as {
      writeChunk(data: number[]): Promise<void>;
      feedFrame(data: string): Promise<void>;
      stopCapture(): Promise<{ mime: string; bytes: number }>;
    };
    const canvas = document.querySelector("canvas")!,
      ctx = canvas.getContext("2d")!;
    const stream = canvas.captureStream(10);
    const media = new MediaRecorder(stream, {
      mimeType: "video/mp4;codecs=avc1.42001E",
      videoBitsPerSecond: 1800000,
    });
    const writes: Promise<void>[] = [];
    let bytes = 0;
    media.ondataavailable = (event) => {
      if (event.data.size)
        writes.push(
          (async () => {
            const data = await event.data.arrayBuffer();
            bytes += data.byteLength;
            await win.writeChunk(Array.from(new Uint8Array(data)));
          })(),
        );
    };
    let lastImage: HTMLImageElement | undefined;
    const heartbeat = setInterval(() => {
      if (lastImage) ctx.drawImage(lastImage, 0, 0, 1280, 800);
    }, 500);
    win.feedFrame = async (data) => {
      const img = new Image();
      img.src = "data:image/jpeg;base64," + data;
      await img.decode();
      lastImage = img;
      ctx.drawImage(img, 0, 0, 1280, 800);
    };
    win.stopCapture = async () => {
      clearInterval(heartbeat);
      const stopped = new Promise<void>(
        (resolve) => (media.onstop = () => resolve()),
      );
      media.stop();
      await stopped;
      await Promise.all(writes);
      for (const track of stream.getTracks()) track.stop();
      return { mime: media.mimeType, bytes };
    };
    media.start(1000);
  });
  const session = await page.context().newCDPSession(page);
  let painting = false,
    frames = 0,
    lastPaint = Promise.resolve();
  session.on("Page.screencastFrame", (event) => {
    void session
      .send("Page.screencastFrameAck", { sessionId: event.sessionId })
      .catch(() => {});
    if (painting) return;
    painting = true;
    lastPaint = recorder
      .evaluate(
        (data) =>
          (
            window as unknown as { feedFrame(data: string): Promise<void> }
          ).feedFrame(data),
        event.data,
      )
      .then(() => {
        frames++;
      })
      .catch(() => {
        /* An aborted take closes its source; do not mask the primary failure. */
      })
      .finally(() => {
        painting = false;
      });
  });
  await session.send("Page.startScreencast", {
    format: "jpeg",
    quality: 72,
    maxWidth: 1280,
    maxHeight: 800,
    everyNthFrame: 6,
  });
  await page.bringToFront();
  return async () => {
    await session.send("Page.stopScreencast");
    await lastPaint;
    const result = await recorder.evaluate(() =>
      (
        window as unknown as {
          stopCapture(): Promise<{ mime: string; bytes: number }>;
        }
      ).stopCapture(),
    );
    await session.detach();
    await recorderContext.close();
    // A static code view legitimately produces very few source frames.
    if (frames < 1 || result.bytes < 1000)
      throw new Error(
        `Incomplete browser capture: ${frames} frames / ${result.bytes} bytes`,
      );
    console.log(
      `Saved ${filename}: ${frames} actual browser frames; ${result.mime}; ${result.bytes} bytes`,
    );
  };
}
