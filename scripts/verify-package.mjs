import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  realpathSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

const root = process.cwd();
const output = path.join(root, ".local", "packages");
mkdirSync(output, { recursive: true });
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Run this verifier with npm run verify:package");
function npm(args, cwd = root) {
  return execFileSync(
    process.execPath,
    [
      npmCli,
      ...args,
      "--offline",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
    ],
    {
      cwd,
      encoding: "utf8",
      env: { ...process.env, npm_config_offline: "true" },
    },
  );
}
const [pack] = JSON.parse(
  npm(["pack", "./packages/core", "--pack-destination", output, "--json"]),
);
const expected = [
  "CHANGELOG.md",
  "LICENSE",
  "README.md",
  "dist/index.d.ts",
  "dist/index.js",
  "package.json",
].sort();
assert.deepEqual(
  pack.files.map((file) => file.path).sort(),
  expected,
  "Archive must contain only the explicit library distribution",
);
const archive = path.join(output, pack.filename);
const consumer = mkdtempSync(path.join(tmpdir(), "checkpoint-consumer-"));
assert(
  !path.resolve(consumer).startsWith(root + path.sep),
  "Consumer must be outside the monorepo",
);
writeFileSync(
  path.join(consumer, "package.json"),
  JSON.stringify({
    name: "checkpoint-external-consumer",
    private: true,
    type: "module",
    dependencies: {
      "@checkpoint/core": `file:${archive.replaceAll("\\", "/")}`,
    },
  }),
);
npm(["install"], consumer);
const installed = path.join(consumer, "node_modules", "@checkpoint", "core");
assert(
  !realpathSync(installed).startsWith(path.join(root, "packages")),
  "Consumer must use extracted archive, not workspace symlinks",
);
const manifest = JSON.parse(
  readFileSync(path.join(installed, "package.json"), "utf8"),
);
assert.equal(Object.keys(manifest.dependencies ?? {}).length, 0);
assert.equal(
  readdirSync(path.join(consumer, "node_modules", "@checkpoint")).length,
  1,
);
const source = readFileSync(
  path.join(root, "examples", "signal-panel.ts"),
  "utf8",
);
writeFileSync(path.join(consumer, "consumer.ts"), source);
writeFileSync(
  path.join(consumer, "tsconfig.json"),
  JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      strict: true,
      types: [],
      lib: ["ES2022", "DOM"],
      outDir: "out",
    },
    include: ["consumer.ts"],
  }),
);
execFileSync(
  process.execPath,
  [
    path.join(root, "node_modules", "typescript", "bin", "tsc"),
    "-p",
    path.join(consumer, "tsconfig.json"),
  ],
  { cwd: consumer, stdio: "inherit" },
);
const result = execFileSync(process.execPath, ["out/consumer.js"], {
  cwd: consumer,
  encoding: "utf8",
  env: {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    TEMP: process.env.TEMP,
    TMP: process.env.TMP,
    NODE_OPTIONS: `--require=${path.join(root, "scripts", "no-network.cjs")}`,
  },
});
writeFileSync(
  path.join(consumer, "exports-check.mjs"),
  `import assert from 'node:assert/strict';\nimport { Interaction } from '@checkpoint/core';\nassert.equal(typeof Interaction, 'function');\nawait assert.rejects(import('@checkpoint/core/src/index.js'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });\nconsole.log('Package-root exports enforced; internal source import rejected.');\n`,
);
execFileSync(process.execPath, ["exports-check.mjs"], {
  cwd: consumer,
  stdio: "inherit",
});
assert.match(result, /Signal: cyan; participants: 2; effects applied: 1/);
console.log(result.trim());
console.log(
  `Verified offline archive: ${archive}\nContents: ${expected.join(", ")}\nExternal consumer (retained for review): ${consumer}`,
);
