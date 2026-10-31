import { execFileSync } from "node:child_process";
import path from "node:path";
const env = { ...process.env };
for (const key of Object.keys(env))
  if (/TWITCH|TOKEN|SECRET|API_KEY|CREDENTIAL/i.test(key)) delete env[key];
env.NODE_OPTIONS = `--require=${path.resolve("scripts/no-network.cjs")}`;
execFileSync(
  process.execPath,
  [
    "node_modules/vitest/vitest.mjs",
    "run",
    "--config",
    "vitest.core.config.ts",
  ],
  { stdio: "inherit", env },
);
