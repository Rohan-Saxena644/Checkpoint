import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
// Pass this repository-owned script as a command; do not change machine policy.
const script = await readFile(
  new URL("./narrate.ps1", import.meta.url),
  "utf8",
);
execFileSync("powershell.exe", ["-NoProfile", "-Command", script], {
  stdio: "inherit",
  windowsHide: true,
});
