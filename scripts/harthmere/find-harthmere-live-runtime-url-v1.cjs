#!/usr/bin/env node
"use strict";
/* HARTHMERE_FIND_LIVE_RUNTIME_URL_V1 */
const { resolvePlaywright, collectRuntimeProbe, runtimeLooksLoaded, formatProbe } = require("./harthmere-live-runtime-probe-v1.cjs");

const root = process.argv[2] || process.cwd();
const base = process.env.HARTHMERE_BASE_URL || "http://localhost:3000";
const timeoutMs = Number(process.env.HARTHMERE_E2E_TIMEOUT_MS || 20000);

const explicit = (process.env.HARTHMERE_E2E_URLS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const candidates = explicit.length ? explicit : [
  `${base}/`,
  `${base}/at`,
  `${base}/at/harthmere`,
  `${base}/at/dev`,
  `${base}/at/local`,
  `${base}/play`,
  `${base}/play/harthmere`,
  `${base}/game`,
  `${base}/game/harthmere`,
  `${base}/world`,
  `${base}/world/harthmere`,
  `${base}/harthmere`,
  `${base}/local/harthmere`,
  `${base}/?harthmere=1`,
  `${base}/?localDev=harthmere`,
];

function short(probe) {
  return {
    href: probe?.href,
    title: probe?.title,
    hasCanvas: probe?.hasCanvas,
    hasHarthmereText: probe?.hasHarthmereText,
    hasNpcCollisionObstacles: probe?.hasNpcCollisionObstacles,
    obstacleCount: probe?.obstacleCount,
    hasTownAudit: probe?.hasTownAudit,
    hasCollisionE2E: probe?.hasCollisionE2E,
    hasOverlayAudit: probe?.hasOverlayAudit,
    hasStats: probe?.hasStats,
    hasRendererDebug: probe?.hasRendererDebug,
    hasTownWalkDebug: probe?.hasTownWalkDebug,
    bodySample: String(probe?.bodySample || "").slice(0, 140).replace(/\s+/g, " "),
  };
}

(async () => {
  console.log("== Harthmere live runtime URL finder v1 ==");
  console.log(`Root: ${root}`);
  console.log(`Base: ${base}`);
  console.log();

  const playwright = resolvePlaywright(root);
  if (!playwright) {
    console.log("FAIL Playwright is not installed. Run: npm install --save-dev playwright --legacy-peer-deps");
    process.exit(1);
  }

  const browser = await playwright.chromium.launch({ headless: process.env.HARTHMERE_E2E_HEADLESS !== "0" });
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  page.setDefaultTimeout(timeoutMs);

  let found = null;
  for (const url of candidates) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
      await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => null);
      await page.waitForTimeout(1500).catch(() => null);
      const probe = await collectRuntimeProbe(page);
      const loaded = runtimeLooksLoaded(probe);
      console.log(`${loaded ? "FOUND" : "NO"} ${url}`);
      console.log(JSON.stringify(short(probe), null, 2));
      console.log();
      if (loaded && !found) {
        found = { url, probe };
        break;
      }
    } catch (error) {
      console.log(`ERR ${url}`);
      console.log(String(error.message || error));
      console.log();
    }
  }

  await browser.close().catch(() => null);

  if (!found) {
    console.log("RESULT: FAIL no candidate loaded Harthmere runtime globals.");
    console.log("Open the game manually, copy the exact URL after you are actually in Harthmere, then run:");
    console.log(`  HARTHMERE_E2E_URL="<that exact URL>" node scripts/harthmere/test-harthmere-live-browser-regression-suite-v1.cjs "${root}"`);
    process.exit(1);
  }

  console.log("RESULT: PASS found Harthmere runtime URL");
  console.log(`HARTHMERE_E2E_URL=${found.url}`);
  console.log(formatProbe(found.probe));
})();
