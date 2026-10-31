import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const inventory = [];
const notices = [
  "Third-party runtime dependency notices\nGenerated from installed packages matching package-lock.json. Do not edit manually.\nOwn project code and original procedural assets use the root MIT license.\n",
];
for (const [location, info] of Object.entries(lock.packages)) {
  if (!location.includes("node_modules/") || info.link) continue;
  const name = location.split("node_modules/").at(-1);
  inventory.push({
    name,
    version: info.version,
    license: info.license ?? "NOT DECLARED",
    developmentOnly: Boolean(info.dev),
    optional: Boolean(info.optional),
    location,
  });
  if (info.dev || !existsSync(path.join(location, "package.json"))) continue;
  const texts = readdirSync(location).filter((file) =>
    /^(licen[sc]e|copying|notice)(\.|$)/i.test(file),
  );
  notices.push(
    `\n=== ${name}@${info.version} (${info.license ?? "NOT DECLARED"}) ===\n`,
  );
  for (const file of texts) {
    notices.push(
      `${file}\n${readFileSync(path.join(location, file), "utf8")}\n`,
    );
  }
  if (!texts.length)
    notices.push(
      "See the package source for its declared license; no top-level license/notice file was present.\n",
    );
}
inventory.sort(
  (a, b) =>
    a.name.localeCompare(b.name) || a.location.localeCompare(b.location),
);
writeFileSync(
  "docs/DEPENDENCY_LICENSES.json",
  JSON.stringify(
    { source: "package-lock.json", packages: inventory },
    null,
    2,
  ) + "\n",
);
writeFileSync("docs/THIRD_PARTY_NOTICES.txt", notices.join("\n"));
console.log(
  `Recorded ${inventory.length} locked dependency entries and installed runtime notices.`,
);
