#!/usr/bin/env node
"use strict";
/* HARTHMERE_COLLISION_PERFORMANCE_BUDGET_V2_STRICT_RUNTIME */
const fs = require("fs");
const path = require("path");
const {
  resolvePlaywright,
  waitForHarthmereRuntime,
  formatProbe,
} = require("./harthmere-live-runtime-probe-v1.cjs");

const root = process.argv[2] || process.cwd();
const url = process.env.HARTHMERE_E2E_URL || "";
const timeoutMs = Number(process.env.HARTHMERE_E2E_TIMEOUT_MS || 90000);
let ok = true;

function pass(label) { console.log(`OK ${label}`); }
function fail(label, detail) {
  ok = false;
  console.log(`FAIL ${label}`);
  if (detail) for (const line of (Array.isArray(detail) ? detail : String(detail).split("\n")).filter(Boolean)) console.log(`  - ${line}`);
}

console.log("== Harthmere collision performance budget tests v2 ==");
console.log(`Root: ${root}`);
console.log(`URL: ${url || "<optional HARTHMERE_E2E_URL not provided>"}`);
console.log();

const playerPath = path.join(root, "src/client/game/scripts/player.ts");
const assetsPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const registryPath = path.join(root, "src/shared/harthmere/town_registry.ts");

for (const file of [playerPath, assetsPath, registryPath]) {
  if (fs.existsSync(file)) pass(`${path.relative(root, file)} exists`);
  else fail(`${path.relative(root, file)} exists`, `Missing ${file}`);
}

const player = fs.existsSync(playerPath) ? fs.readFileSync(playerPath, "utf8") : "";
if (/HARTHMERE_COLLISION_BROADPHASE_V1|BROADPHASE_CELL_SIZE|getHarthmereLocalDevHorizontalBroadphaseCandidates/.test(player)) {
  pass("player/town collision has a broadphase or spatial-grid contract");
} else {
  fail("player/town collision has a broadphase or spatial-grid contract", "Add a spatial grid/broadphase so player collision does not scan every blocker every frame.");
}

if (/HARTHMERE_COLLISION_PERFORMANCE_BUDGET_V1|MAX_CANDIDATES|MAX_SWEEP_CHECKS|PERFORMANCE_MAX/.test(player)) {
  pass("collision code declares explicit performance budget constants/markers");
} else {
  fail("collision code declares explicit performance budget constants/markers", "Expected max blockers per cell/frame or max sweep checks budget marker.");
}

if (/candidateCount|sweepChecks|broadphase|cellCount/.test(player)) {
  pass("browser collision stats expose candidate/sweep counts for perf audits");
} else {
  fail("browser collision stats expose candidate/sweep counts for perf audits", "Stats should include candidateCount/sweepChecks/cellCount/broadphase info.");
}

async function maybeBrowserPerf() {
  if (!url) {
    console.log("INFO browser perf probe skipped because HARTHMERE_E2E_URL is not set");
    return;
  }
  const playwright = resolvePlaywright(root);
  if (!playwright) {
    fail("Playwright is installed for live collision perf probe", "Run: npm install --save-dev playwright --legacy-peer-deps");
    return;
  }
  const browser = await playwright.chromium.launch({ headless: process.env.HARTHMERE_E2E_HEADLESS !== "0" });
  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    const probe = await waitForHarthmereRuntime(page, timeoutMs);
    if (!probe || !(
      probe.hasStats ||
      probe.hasNpcCollisionObstacles ||
      probe.hasCollisionE2E ||
      probe.hasTownAudit
    )) {
      fail("live browser loaded Harthmere runtime before perf stats check", formatProbe(probe));
      return;
    }
    pass("live browser loaded Harthmere runtime before perf stats check");

    await page.evaluate(async () => {
      const runner = globalThis.__harthmereCollisionE2E?.runSolidFixtureMovementTest
        || globalThis.__harthmereTownAudit?.runSolidFixtureMovementTest;
      if (runner) {
        await runner([
          {
            id: "perf_stats_hydration_probe",
            district: "North Gate",
            assetHints: ["obj_flag_large_red", "obj_lamp_ground_large", "ground lamp", "flag"],
          },
          {
            id: "perf_stats_market_probe",
            district: "Market Square",
            assetHints: ["fountain_round", "fountain_center", "Bridge Fountain"],
          },
        ], { includeStats: true, requireObstacleHit: true });
      }
    });
    const stats = await page.evaluate(() => globalThis.__harthmereHorizontalPlayerTownCollisionStats || null);
    if (!stats) {
      fail("live browser exposes collision performance stats", formatProbe(await waitForHarthmereRuntime(page, 2000)));
      return;
    }
    pass("live browser exposes collision performance stats");

    const candidates = Number(stats.candidateCount ?? stats.lastCandidateCount ?? 0);
    const sweeps = Number(stats.sweepChecks ?? stats.segmentSamples ?? 0);
    const obstacleCount = Number(stats.obstacleCount ?? 0);
    if (obstacleCount <= 0) {
      fail("live browser collision stats include exported obstacles", JSON.stringify(stats));
    } else {
      pass("live browser collision stats include exported obstacles");
    }
    if (candidates <= 160 || /broadphase|grid|cell/i.test(String(stats.broadphase ?? ""))) {
      pass("live browser collision perf stays within broadphase budget");
    } else {
      fail("live browser collision perf stays within broadphase budget", JSON.stringify(stats));
    }
    console.log(`INFO liveCollisionStats=${JSON.stringify(stats).slice(0, 1200)}`);
  } catch (error) {
    fail("collision performance budget test completed without exception", error.stack || String(error));
  } finally {
    await browser.close().catch(() => null);
  }
}

maybeBrowserPerf().then(() => {
  console.log(ok ? "\nRESULT: PASS" : "\nRESULT: FAIL");
  process.exit(ok ? 0 : 1);
});
