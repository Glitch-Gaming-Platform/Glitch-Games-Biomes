#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "../..");
const auditRoot = path.join(
  root,
  "artifacts/harthmere-boss-animation-visual-audit"
);
const resultsPath = path.join(auditRoot, "results.json");
const results = JSON.parse(fs.readFileSync(resultsPath, "utf8")).results;

function percentage(text, pattern) {
  const match = String(text ?? "").match(pattern);
  return match ? Number(match[1]) : undefined;
}

const failures = [];
if (results.length !== 66) {
  failures.push(`expected 66 walk/attack states, found ${results.length}`);
}
const graphics = results.filter((entry) => entry.graphic);
if (graphics.length !== 55) {
  failures.push(`expected 55 attack graphics, found ${graphics.length}`);
}
for (const entry of results) {
  if (entry.failed || !String(entry.status).includes("visibly animated")) {
    failures.push(`${entry.bossName}.${entry.stateName} did not pass`);
  }
  const bodyMotion = percentage(entry.score, /([0-9.]+)%/);
  if (!(bodyMotion > 0)) {
    failures.push(`${entry.bossName}.${entry.stateName} has no body motion`);
  }
  const screenshot = path.join(
    auditRoot,
    "screenshots",
    entry.bossId,
    entry.fileName
  );
  if (!fs.existsSync(screenshot) || fs.statSync(screenshot).size < 10_000) {
    failures.push(`${entry.bossName}.${entry.stateName} screenshot is missing`);
  }
  if (entry.graphic) {
    const direct = percentage(entry.metadata, /GLB ([0-9.]+)% visible/);
    const production = percentage(
      entry.metadata,
      /production renderer ([0-9.]+)% visible/
    );
    if (!(direct > 0)) {
      failures.push(`${entry.bossName}.${entry.stateName} GLB is invisible`);
    }
    if (!(production > 0)) {
      failures.push(
        `${entry.bossName}.${entry.stateName} production renderer is invisible`
      );
    }
  }
}

for (const entry of new Set(results.map(({ bossId }) => bossId))) {
  const contactSheet = path.join(auditRoot, "contact-sheets", `${entry}.jpg`);
  if (
    !fs.existsSync(contactSheet) ||
    fs.statSync(contactSheet).size < 20_000
  ) {
    failures.push(`${entry} contact sheet is missing`);
  }
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}

const bodyScores = results.map((entry) =>
  percentage(entry.score, /([0-9.]+)%/)
);
const directScores = graphics.map((entry) =>
  percentage(entry.metadata, /GLB ([0-9.]+)% visible/)
);
const productionScores = graphics.map((entry) =>
  percentage(entry.metadata, /production renderer ([0-9.]+)% visible/)
);
console.log(
  `PASS 11 bosses, 66 animated states, 55 real attack GLBs; minimum body motion ${Math.min(
    ...bodyScores
  ).toFixed(2)}%, direct graphic ${Math.min(...directScores).toFixed(
    2
  )}%, production renderer ${Math.min(...productionScores).toFixed(2)}%`
);
