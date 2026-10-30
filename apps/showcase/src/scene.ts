import type { Run } from "../server/game.js";
export function drawScene(
  ctx: CanvasRenderingContext2D,
  run: Run,
  time: number,
) {
  const w = 1000,
    h = 560,
    t = time / 1000;
  ctx.clearRect(0, 0, w, h);
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "#142b31");
  bg.addColorStop(0.48, "#152b2c");
  bg.addColorStop(1, "#0b1a28");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  const circle = (x: number, y: number, r: number, color: string) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  };
  // Seeded procedural landscape. No external sprites or image assets.
  const hash = (n: number) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  for (let i = 0; i < 160; i++) {
    const x = hash(i) * w,
      y = hash(i + 400) * h;
    circle(
      x,
      y,
      2 + hash(i + 80) * 16,
      `rgba(30,66,57,${0.08 + hash(i + 7) * 0.25})`,
    );
  }
  // Weathered stone route.
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(45, 280);
  ctx.bezierCurveTo(260, 290, 275, 150, 430, 250);
  ctx.bezierCurveTo(600, 400, 710, 250, 930, 280);
  ctx.lineWidth = 97;
  ctx.strokeStyle = "#253b37";
  ctx.stroke();
  ctx.lineWidth = 72;
  ctx.strokeStyle = "#30413a";
  ctx.stroke();
  for (let i = 0; i < 130; i++) {
    const x = 60 + hash(i + 812) * 880,
      y = 220 + Math.sin(x / 115) * 30 + hash(i + 81) * 90;
    ctx.fillStyle = `rgba(123,139,109,${0.06 + hash(i + 83) * 0.13})`;
    ctx.fillRect(x, y, 4 + hash(i) * 21, 2 + hash(i + 8) * 9);
  }
  // Ruin foundations and pools.
  for (const [x, y, rx, ry] of [
    [110, 450, 100, 42],
    [590, 90, 150, 55],
    [860, 470, 130, 50],
  ]) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, -0.2, 0, Math.PI * 2);
    ctx.fillStyle = "#0c2730";
    ctx.fill();
    ctx.strokeStyle = "#245052";
    ctx.lineWidth = 2;
    ctx.stroke();
    for (let j = 0; j < 6; j++) {
      ctx.fillStyle = "#447b7255";
      ctx.fillRect(
        x - rx * 0.6 + j * 24,
        y + Math.sin(j * 4 + t * 0.5) * 8,
        12,
        1,
      );
    }
  }
  const rock = (x: number, y: number, scale: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = "#07192388";
    ctx.beginPath();
    ctx.ellipse(5, 12, 23, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#374d47";
    ctx.beginPath();
    ctx.moveTo(-21, 3);
    ctx.lineTo(-12, -17);
    ctx.lineTo(8, -23);
    ctx.lineTo(24, -5);
    ctx.lineTo(17, 14);
    ctx.lineTo(-13, 16);
    ctx.fill();
    ctx.fillStyle = "#516158";
    ctx.beginPath();
    ctx.moveTo(-12, -17);
    ctx.lineTo(8, -23);
    ctx.lineTo(2, -1);
    ctx.lineTo(-21, 3);
    ctx.fill();
    ctx.restore();
  };
  for (let i = 0; i < 27; i++) {
    const x = hash(i + 990) * w,
      y = hash(i + 710) * h;
    if (y < 145 || y > 420) rock(x, y, 0.45 + hash(i) * 0.7);
  }
  const tree = (x: number, y: number, s: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = "#06182080";
    ctx.beginPath();
    ctx.ellipse(10, 20, 35, 14, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#172e2b";
    ctx.fillRect(-4, 0, 9, 27);
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(0, -70 + k * 22);
      ctx.lineTo(33 - k * 3, -10 + k * 16);
      ctx.lineTo(-33 + k * 3, -10 + k * 16);
      ctx.closePath();
      ctx.fillStyle = ["#284b3d", "#26473b", "#234136"][k];
      ctx.fill();
      ctx.strokeStyle = "#4e6a4a44";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  };
  for (let i = 0; i < 34; i++) {
    const x = hash(i + 41) * w,
      y = i % 2 ? 65 + hash(i + 6) * 80 : 450 + hash(i + 3) * 100;
    tree(x, y, 0.6 + hash(i + 103) * 0.65);
  }
  // Broken arches frame the sanctuary.
  for (const x of [190, 790]) {
    ctx.fillStyle = "#102326";
    ctx.fillRect(x - 15, 117, 31, 65);
    ctx.fillStyle = "#476058";
    ctx.fillRect(x - 21, 104, 37, 16);
    ctx.fillStyle = "#334b45";
    ctx.fillRect(x - 17, 120, 29, 52);
    ctx.fillStyle = "#6f807044";
    ctx.fillRect(x - 17, 121, 5, 52);
  }
  for (const hazard of run.hazards) {
    const { x, y, radius: r, phase } = hazard;
    circle(x, y, r + 3, "#081d2520");
    if (phase === "quiet") {
      ctx.strokeStyle = "#93aa9b20";
      ctx.setLineDash([2, 7]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      continue;
    }
    const active = phase === "active";
    circle(x, y, r, active ? "#e3725140" : "#efbb6720");
    ctx.strokeStyle = active ? "#f18669" : "#d6b776";
    ctx.lineWidth = active ? 3 : 1.5;
    ctx.setLineDash(active ? [] : [8, 5]);
    ctx.beginPath();
    ctx.arc(
      x,
      y,
      r * (active ? 1 : 0.9 + Math.sin(t * 8) * 0.06),
      0,
      Math.PI * 2,
    );
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = "bold 20px sans-serif";
    ctx.fillStyle = active ? "#ffb899" : "#e3c58b";
    ctx.textAlign = "center";
    ctx.fillText(active ? "×" : "!", x, y + 7);
    if (active) {
      ctx.strokeStyle = "#f7c09a88";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - 12, y - 90);
      ctx.lineTo(x + 6, y - 35);
      ctx.lineTo(x - 3, y - 9);
      ctx.stroke();
    }
  }
  for (const f of run.fragments) {
    if (f.taken) continue;
    const bob = Math.sin(t * 2 + f.x) * 3;
    const glow = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 34);
    glow.addColorStop(0, "#ffc56b44");
    glow.addColorStop(1, "#ffc56b00");
    ctx.fillStyle = glow;
    ctx.fillRect(f.x - 34, f.y - 34, 68, 68);
    ctx.save();
    ctx.translate(f.x, f.y + bob);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = "#f7ca7c";
    ctx.shadowColor = "#ffc96b";
    ctx.shadowBlur = 16;
    ctx.fillRect(-6, -6, 12, 12);
    ctx.fillStyle = "#fff0c2";
    ctx.fillRect(-3, -3, 4, 4);
    ctx.restore();
  }
  // Checkpoint beacon and its threshold ring.
  circle(925, 280, 53, "#56cbbb0c");
  ctx.beginPath();
  ctx.ellipse(925, 298, 48, 25, 0, 0, Math.PI * 2);
  ctx.strokeStyle = "#63cbbc88";
  ctx.lineWidth = 2;
  ctx.stroke();
  const gateGlow = ctx.createRadialGradient(925, 257, 0, 925, 257, 110);
  gateGlow.addColorStop(0, "#f8bc6044");
  gateGlow.addColorStop(1, "#f8bc6000");
  ctx.fillStyle = gateGlow;
  ctx.fillRect(815, 147, 220, 220);
  ctx.fillStyle = "#41534a";
  ctx.fillRect(905, 266, 40, 32);
  ctx.fillStyle = "#718074";
  ctx.fillRect(901, 261, 48, 8);
  ctx.fillStyle = "#ffc979";
  ctx.shadowColor = "#ffc979";
  ctx.shadowBlur = 24;
  ctx.beginPath();
  ctx.moveTo(925, 213);
  ctx.lineTo(936, 243);
  ctx.lineTo(925, 254);
  ctx.lineTo(914, 243);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.font = "10px monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = "#aec7b6";
  ctx.fillText(run.stage === 3 ? "THE LAST BEACON" : "CHECKPOINT", 925, 331);
  // Courier silhouette, shadow, cloak and carried beacon.
  ctx.save();
  ctx.translate(run.x, run.y);
  circle(3, 15, 14, "#020e1877");
  if (run.fieldMs > 0 || run.shield > 0) {
    circle(0, 0, 29, "#76e6d820");
    ctx.strokeStyle = "#7ce9d6";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 29, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = run.invulnerableMs > 0 ? 0.55 + Math.sin(t * 25) * 0.3 : 1;
  ctx.fillStyle = "#172029";
  ctx.fillRect(-7, 10, 5, 9);
  ctx.fillRect(3, 10, 5, 9);
  ctx.fillStyle = "#d39751";
  ctx.beginPath();
  ctx.moveTo(-7, -6);
  ctx.lineTo(7, -6);
  ctx.lineTo(14, 13);
  ctx.lineTo(0, 17);
  ctx.lineTo(-13, 13);
  ctx.fill();
  circle(0, -9, 9, "#bdc7ab");
  circle(0, -10, 10, "#d8b77e");
  ctx.fillStyle = "#26393c";
  ctx.fillRect(-5, -11, 10, 5);
  ctx.fillStyle = "#997341";
  ctx.fillRect(12, -4, 3, 20);
  circle(14, -9, 6, "#ffdf9b");
  ctx.shadowColor = "#ffca70";
  ctx.shadowBlur = 26;
  circle(14, -9, 4, "#fff2c9");
  ctx.shadowBlur = 0;
  ctx.restore();
  const vignette = ctx.createRadialGradient(500, 280, 100, 500, 280, 550);
  vignette.addColorStop(0, "#06131c00");
  vignette.addColorStop(1, "#06131c99");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 20; i++) {
    circle(
      hash(i + 4000) * w,
      (hash(i + 5000) * h - ((t * (2 + hash(i) * 6)) % h) + h) % h,
      1.2,
      "#d5ddac44",
    );
  }
}
