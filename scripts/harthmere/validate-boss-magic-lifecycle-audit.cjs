#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "../..");
const artifactRoot = path.join(
  root,
  "artifacts/harthmere-boss-magic-lifecycle-audit"
);
const payload = JSON.parse(
  fs.readFileSync(path.join(artifactRoot, "results.json"), "utf8")
);
const failures = [];

if (payload.version !== "harthmere-boss-magic-lifecycle-audit-v1") {
  failures.push(`unexpected version ${payload.version}`);
}
if (payload.bossCount !== 11 || payload.results?.length !== 11) {
  failures.push(`expected 11 bosses, found ${payload.results?.length ?? 0}`);
}
if (payload.magicAttackCount !== 40) {
  failures.push(`expected 40 magic attacks, found ${payload.magicAttackCount}`);
}
if (payload.failures?.length) {
  failures.push(...payload.failures);
}

let attackCount = 0;
for (const boss of payload.results ?? []) {
  attackCount += boss.articles?.length ?? 0;
  if (!String(boss.status).includes("magic attacks pass")) {
    failures.push(`${boss.bossId} status: ${boss.status}`);
  }
  const screenshot = path.join(
    artifactRoot,
    "screenshots",
    `${boss.bossId}.png`
  );
  if (!fs.existsSync(screenshot) || fs.statSync(screenshot).size < 50_000) {
    failures.push(`${boss.bossId} lifecycle image is missing or empty`);
  }
  for (const attack of boss.articles ?? []) {
    if (attack.result !== "charge, travel, and explosion pass") {
      failures.push(`${boss.bossId}.${attack.heading}: ${attack.result}`);
    }
    if ((attack.frames?.length ?? 0) !== 3) {
      failures.push(
        `${boss.bossId}.${attack.heading} lacks three phase frames`
      );
    }
    for (const frame of attack.frames ?? []) {
      const percentage = Number(String(frame).match(/([0-9.]+)%/)?.[1]);
      if (!(percentage > 0)) {
        failures.push(
          `${boss.bossId}.${attack.heading} invisible frame: ${frame}`
        );
      }
    }
  }
}
if (attackCount !== 40) {
  failures.push(`expected 40 attack rows, found ${attackCount}`);
}

const master = path.join(artifactRoot, "all-bosses.png");
if (!fs.existsSync(master) || fs.statSync(master).size < 500_000) {
  failures.push("all-bosses contact sheet is missing or empty");
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}

console.log(
  "PASS 11 bosses, 40 magic attacks, 120 visible lifecycle phases, 11 boss sheets, and one master contact sheet."
);
