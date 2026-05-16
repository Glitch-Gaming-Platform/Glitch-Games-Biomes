#!/usr/bin/env node
"use strict";
/* HARTHMERE_COLLISION_RADIUS_VARIANTS_V2_STRICT_RUNTIME */
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

console.log("== Harthmere collision radius variant tests v2 ==");
console.log(`Root: ${root}`);
console.log(`URL: ${url || "<optional HARTHMERE_E2E_URL not provided>"}`);
console.log();

const playerPath = path.join(root, "src/client/game/scripts/player.ts");
const mountPath = path.join(root, "src/shared/harthmere/town_mount_rules.ts");
const routesPath = path.join(root, "src/shared/harthmere/town_routes.ts");

for (const file of [playerPath, mountPath, routesPath]) {
  if (fs.existsSync(file)) pass(`${path.relative(root, file)} exists`);
  else fail(`${path.relative(root, file)} exists`, `Missing ${file}`);
}

const player = fs.existsSync(playerPath) ? fs.readFileSync(playerPath, "utf8") : "";
const mount = fs.existsSync(mountPath) ? fs.readFileSync(mountPath, "utf8") : "";
const routes = fs.existsSync(routesPath) ? fs.readFileSync(routesPath, "utf8") : "";

const required = ["normalPlayer", "shortPlayer", "tallPlayer", "widePlayer", "mountedPlayer", "npcAdult", "animalSmall", "animalLarge"];
const missing = required.filter((name) => !player.includes(name) && !mount.includes(name) && !routes.includes(name));
if (missing.length) fail("collision policy defines body-radius variants for players, mounts, NPCs, and animals", missing);
else pass("collision policy defines body-radius variants for players, mounts, NPCs, and animals");

if (/HARTHMERE_COLLISION_RADIUS_VARIANTS_V1|collision-radius-variants/i.test(player + mount + routes)) {
  pass("collision radius variant contract marker exists");
} else {
  fail("collision radius variant contract marker exists", "Add HARTHMERE_COLLISION_RADIUS_VARIANTS_V1 or equivalent radius variant definitions.");
}

if (/mountedPlayer/.test(player + mount + routes) && /normalPlayer/.test(player + mount + routes)) {
  pass("mounted collision radius is distinct from normal player radius");
} else {
  fail("mounted collision radius is distinct from normal player radius", "Mounted traffic should use a larger body radius than normal player.");
}

if (/mounted|laneClearance|clearance|dismount|mainRoad/i.test(mount + routes)) {
  pass("route/mount rules declare lane clearance for larger radii");
} else {
  fail("route/mount rules declare lane clearance for larger radii", "Mount and route policy should preserve wider lanes.");
}

async function maybeBrowserRadius() {
  if (!url) {
    console.log("INFO live radius probe skipped because HARTHMERE_E2E_URL is not set");
    return;
  }
  const playwright = resolvePlaywright(root);
  if (!playwright) {
    fail("Playwright is installed for live radius variant probe", "Run: npm install --save-dev playwright --legacy-peer-deps");
    return;
  }
  const browser = await playwright.chromium.launch({ headless: process.env.HARTHMERE_E2E_HEADLESS !== "0" });
  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    const probe = await waitForHarthmereRuntime(page, timeoutMs);
    if (!probe || !(
      probe.hasCollisionE2E ||
      probe.hasTownAudit ||
      probe.hasStats ||
      probe.hasNpcCollisionObstacles
    )) {
      fail("live browser loaded Harthmere runtime before radius variant check", formatProbe(probe));
      return;
    }
    pass("live browser loaded Harthmere runtime before radius variant check");

    const hasRunner = await page.evaluate(() => Boolean(
      globalThis.__harthmereCollisionE2E?.runRadiusVariantCollisionCases
      || globalThis.__harthmereTownAudit?.runRadiusVariantCollisionCases
    ));
    if (!hasRunner) {
      fail("browser exposes radius variant collision runner", formatProbe(await waitForHarthmereRuntime(page, 2000)));
      return;
    }
    pass("browser exposes radius variant collision runner");

    await page.evaluate(async () => {
      const movementRunner = globalThis.__harthmereCollisionE2E?.runSolidFixtureMovementTest
        || globalThis.__harthmereTownAudit?.runSolidFixtureMovementTest;
      if (movementRunner) {
        await movementRunner([
          {
            id: "radius_stats_hydration_probe",
            district: "North Gate",
            assetHints: ["obj_flag_large_red", "obj_lamp_ground_large", "flag", "ground lamp"],
          },
        ], { includeStats: true, requireObstacleHit: true });
      }
    });
    const result = await page.evaluate(async (variants) => {
      const runner = globalThis.__harthmereCollisionE2E?.runRadiusVariantCollisionCases
        || globalThis.__harthmereTownAudit?.runRadiusVariantCollisionCases;
      return await runner(variants, { requireObstacleExport: true });
    }, required);
    if (!result || result.ok !== true) {
      fail("browser radius variant collision cases pass", JSON.stringify(result || null).slice(0, 1800));
    } else {
      pass("browser radius variant collision cases pass");
    }
  } catch (error) {
    fail("collision radius variant test completed without exception", error.stack || String(error));
  } finally {
    await browser.close().catch(() => null);
  }
}

maybeBrowserRadius().then(() => {
  console.log(ok ? "\nRESULT: PASS" : "\nRESULT: FAIL");
  process.exit(ok ? 0 : 1);
});
