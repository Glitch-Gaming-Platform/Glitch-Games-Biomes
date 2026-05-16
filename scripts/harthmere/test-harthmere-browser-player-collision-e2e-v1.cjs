#!/usr/bin/env node
"use strict";
/* HARTHMERE_BROWSER_PLAYER_COLLISION_E2E_V2_STRICT_RUNTIME */
const fs = require("fs");
const path = require("path");
const {
  resolvePlaywright,
  fixtureMovementCases,
  collectRuntimeProbe,
  waitForHarthmereRuntime,
  formatProbe,
  movementReportProvesActualMovement,
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
function requireFile(rel) {
  const full = path.join(root, rel);
  if (fs.existsSync(full)) pass(`${rel} exists`);
  else fail(`${rel} exists`, `Missing ${full}`);
}

console.log("== Harthmere browser movement E2E collision tests v2 ==");
console.log(`Root: ${root}`);
console.log(`URL: ${url || "<missing HARTHMERE_E2E_URL>"}`);
console.log();

requireFile("src/client/game/scripts/player.ts");
requireFile("src/client/game/renderers/local_dev/harthmere_assets.ts");
requireFile("src/shared/harthmere/town_registry.ts");

if (!url) {
  fail("live browser URL is provided", "Set HARTHMERE_E2E_URL to the running Harthmere page.");
  console.log("\nRESULT: FAIL (missing live URL)");
  process.exit(1);
}

const playwright = resolvePlaywright(root);
if (!playwright) {
  fail("Playwright is installed for browser collision E2E", "Run: npm install --save-dev playwright --legacy-peer-deps");
  console.log("\nRESULT: FAIL (missing Playwright)");
  process.exit(1);
}

(async () => {
  const browser = await playwright.chromium.launch({ headless: process.env.HARTHMERE_E2E_HEADLESS !== "0" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.setDefaultTimeout(timeoutMs);

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 15000) }).catch(() => null);

    const runtimeProbe = await waitForHarthmereRuntime(page, timeoutMs);
    if (!runtimeProbe || runtimeProbe.hasCompileOverlay) {
      fail("browser page has no compile/runtime overlay", formatProbe(runtimeProbe));
    } else {
      pass("browser page has no compile/runtime overlay");
    }

    if (!runtimeProbe || !(
      runtimeProbe.hasNpcCollisionObstacles ||
      runtimeProbe.hasTownAudit ||
      runtimeProbe.hasCollisionE2E ||
      runtimeProbe.hasStats ||
      runtimeProbe.hasRendererDebug ||
      runtimeProbe.hasTownWalkDebug
    )) {
      fail("browser loaded the actual Harthmere runtime, not just any page/canvas", [
        "The live collision tests must run on the actual Harthmere game runtime.",
        "Use the exact local game URL/path if http://localhost:3000/ is only a shell.",
        formatProbe(runtimeProbe),
      ]);
      await browser.close();
      console.log("\nRESULT: FAIL (Harthmere runtime not loaded)");
      process.exit(1);
    }
    pass("browser loaded the actual Harthmere runtime");

    const helperStatus = await page.evaluate(() => {
      const e2e = globalThis.__harthmereCollisionE2E;
      const audit = globalThis.__harthmereTownAudit;
      return {
        hasE2E: Boolean(e2e),
        hasAudit: Boolean(audit),
        hasMovementRunner: Boolean(e2e?.runSolidFixtureMovementTest || audit?.runSolidFixtureMovementTest),
        hasStats: Boolean(globalThis.__harthmereHorizontalPlayerTownCollisionStats),
      };
    });

    if (!helperStatus.hasMovementRunner) {
      const probe = await collectRuntimeProbe(page);
      fail("browser exposes solid-fixture movement collision test helper", [
        "Expected window.__harthmereCollisionE2E.runSolidFixtureMovementTest(cases) or window.__harthmereTownAudit.runSolidFixtureMovementTest(cases).",
        "The page did load Harthmere runtime markers, so this is now a real helper-exposure bug.",
        formatProbe(probe),
      ]);
      await browser.close();
      console.log("\nRESULT: FAIL (missing browser movement helper)");
      process.exit(1);
    }
    pass("browser exposes solid-fixture movement collision test helper");

    const result = await page.evaluate(async (cases) => {
      const runner = globalThis.__harthmereCollisionE2E?.runSolidFixtureMovementTest
        || globalThis.__harthmereTownAudit?.runSolidFixtureMovementTest;
      return await runner(cases, {
        durationMs: 2200,
        pushKeys: ["KeyW"],
        maxPenetrationMeters: 0.18,
        requireObstacleHit: true,
        requirePositionBlocked: true,
        requireActualMovement: true,
        includeStats: true,
      });
    }, fixtureMovementCases());

    if (!result || result.ok !== true) {
      const details = [];
      for (const item of result?.failures || []) {
        details.push(`${item.id || item.caseId || "unknown"}: ${item.reason || item.message || JSON.stringify(item)}`);
      }
      if (details.length === 0) details.push(JSON.stringify(result || null));
      fail("player is blocked by reported solid imported fixtures in live browser movement", details);
    } else {
      pass("player is blocked by reported solid imported fixtures in live browser movement");
    }

    if (!movementReportProvesActualMovement(result)) {
      fail("solid-fixture helper proves actual movement blocking, not metadata-only collision", [
        "The helper returned ok metadata, but did not prove before/after player movement or actual movement resolver blocking.",
        "The next production fix must make runSolidFixtureMovementTest place the player near the fixture, simulate movement, and report beforePosition/afterPosition/blockedByMovement.",
        JSON.stringify(result || null).slice(0, 1800),
      ]);
    } else {
      pass("solid-fixture helper proves actual movement blocking, not metadata-only collision");
    }

    const stats = await page.evaluate(() => globalThis.__harthmereHorizontalPlayerTownCollisionStats || null);
    if (!stats) {
      fail("browser exposes player town collision stats", "Expected window.__harthmereHorizontalPlayerTownCollisionStats");
    } else {
      pass("browser exposes player town collision stats");
      console.log(`INFO collisionStats=${JSON.stringify({
        active: stats.active,
        obstacleCount: stats.obstacleCount,
        candidateCount: stats.candidateCount,
        sweepChecks: stats.sweepChecks,
        hits: stats.hits,
        lastReason: stats.lastReason,
        version: stats.version || stats.marker,
      })}`);
    }
  } catch (error) {
    fail("browser collision E2E completed without unhandled exception", error.stack || String(error));
  } finally {
    await browser.close().catch(() => null);
  }

  console.log(ok ? "\nRESULT: PASS" : "\nRESULT: FAIL");
  process.exit(ok ? 0 : 1);
})();
