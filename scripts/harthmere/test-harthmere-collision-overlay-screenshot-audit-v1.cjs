#!/usr/bin/env node
"use strict";
/* HARTHMERE_COLLISION_OVERLAY_SCREENSHOT_AUDIT_V2_STRICT_RUNTIME */
const fs = require("fs");
const path = require("path");
const {
  resolvePlaywright,
  fixtureOverlayViewpoints,
  collectRuntimeProbe,
  waitForHarthmereRuntime,
  formatProbe,
} = require("./harthmere-live-runtime-probe-v1.cjs");

const root = process.argv[2] || process.cwd();
const url = process.env.HARTHMERE_E2E_URL || "";
const outDir = process.env.HARTHMERE_SCREENSHOT_OUT || path.join(root, "tmp", "harthmere-collision-overlays");
const timeoutMs = Number(process.env.HARTHMERE_E2E_TIMEOUT_MS || 90000);
let ok = true;

function pass(label) { console.log(`OK ${label}`); }
function fail(label, detail) {
  ok = false;
  console.log(`FAIL ${label}`);
  if (detail) for (const line of (Array.isArray(detail) ? detail : String(detail).split("\n")).filter(Boolean)) console.log(`  - ${line}`);
}

console.log("== Harthmere collision overlay screenshot audit tests v2 ==");
console.log(`Root: ${root}`);
console.log(`URL: ${url || "<missing HARTHMERE_E2E_URL>"}`);
console.log(`Output: ${outDir}`);
console.log();

for (const rel of [
  "src/shared/harthmere/visual_readability.ts",
  "src/client/game/renderers/local_dev/harthmere_assets.ts",
  "src/client/game/scripts/player.ts",
]) {
  const file = path.join(root, rel);
  if (fs.existsSync(file)) pass(`${rel} exists`);
  else fail(`${rel} exists`, `Missing ${file}`);
}

if (!url) {
  fail("live browser URL is provided for overlay audit", "Set HARTHMERE_E2E_URL to the running Harthmere page.");
  console.log("\nRESULT: FAIL (missing live URL)");
  process.exit(1);
}

const playwright = resolvePlaywright(root);
if (!playwright) {
  fail("Playwright is installed for overlay screenshot audit", "Run: npm install --save-dev playwright --legacy-peer-deps");
  console.log("\nRESULT: FAIL (missing Playwright)");
  process.exit(1);
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await playwright.chromium.launch({ headless: process.env.HARTHMERE_E2E_HEADLESS !== "0" });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.setDefaultTimeout(timeoutMs);

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 15000) }).catch(() => null);

    const runtimeProbe = await waitForHarthmereRuntime(page, timeoutMs);
    if (!runtimeProbe || !(
      runtimeProbe.hasNpcCollisionObstacles ||
      runtimeProbe.hasTownAudit ||
      runtimeProbe.hasOverlayAudit ||
      runtimeProbe.hasRendererDebug ||
      runtimeProbe.hasTownWalkDebug
    )) {
      fail("browser loaded the actual Harthmere runtime for overlay audit", [
        "Overlay audit must run after Harthmere renderer/runtime is active.",
        formatProbe(runtimeProbe),
      ]);
      await browser.close();
      console.log("\nRESULT: FAIL (Harthmere runtime not loaded)");
      process.exit(1);
    }
    pass("browser loaded the actual Harthmere runtime for overlay audit");

    const hasHelper = await page.evaluate(() => Boolean(
      globalThis.__harthmereCollisionOverlayAudit?.captureSolidFixtureOverlayReport
      || globalThis.__harthmereTownAudit?.captureSolidFixtureOverlayReport
    ));

    if (!hasHelper) {
      const probe = await collectRuntimeProbe(page);
      fail("browser exposes collision overlay screenshot audit helper", [
        "Expected window.__harthmereCollisionOverlayAudit.captureSolidFixtureOverlayReport(viewpoints)",
        "or window.__harthmereTownAudit.captureSolidFixtureOverlayReport(viewpoints).",
        formatProbe(probe),
      ]);
      await browser.close();
      console.log("\nRESULT: FAIL (missing overlay audit helper)");
      process.exit(1);
    }
    pass("browser exposes collision overlay screenshot audit helper");

    const report = await page.evaluate(async (viewpoints) => {
      const runner = globalThis.__harthmereCollisionOverlayAudit?.captureSolidFixtureOverlayReport
        || globalThis.__harthmereTownAudit?.captureSolidFixtureOverlayReport;
      return await runner(viewpoints, {
        showOverlay: true,
        requireVisibleMesh: true,
        requireCollisionProxy: true,
        requireAttachment: true,
        maxCenterDeltaMeters: 1.25,
        minProxyCoverageRatio: 0.35,
        maxProxyCoverageRatio: 1.6,
      });
    }, fixtureOverlayViewpoints());

    await page.screenshot({ path: path.join(outDir, "harthmere-collision-overlay-audit.png"), fullPage: true });
    pass("collision overlay screenshot was captured");

    if (!report || report.ok !== true) {
      const details = (report?.failures || []).map((f) => `${f.viewpoint || f.id || "unknown"}: ${f.message || f.reason || JSON.stringify(f)}`);
      fail("visible imported fixtures have matching player collision overlay proxies", details.length ? details : JSON.stringify(report || null));
    } else {
      pass("visible imported fixtures have matching player collision overlay proxies");
    }
  } catch (error) {
    fail("collision overlay screenshot audit completed without unhandled exception", error.stack || String(error));
  } finally {
    await browser.close().catch(() => null);
  }

  console.log(ok ? "\nRESULT: PASS" : "\nRESULT: FAIL");
  process.exit(ok ? 0 : 1);
})();
