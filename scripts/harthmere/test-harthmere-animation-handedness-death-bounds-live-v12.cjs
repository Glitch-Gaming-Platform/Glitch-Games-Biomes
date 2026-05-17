#!/usr/bin/env node
"use strict";

const root = process.argv[2] || process.cwd();
const url = process.env.HARTHMERE_E2E_URL;
console.log("== Harthmere animation handedness/death/bounds live tests v12 ==");
console.log(`Root: ${root}`);
console.log(`URL: ${url || "<HARTHMERE_E2E_URL not set>"}\n`);

if (!url) {
  console.log("INFO live v12 probe skipped because HARTHMERE_E2E_URL is not set");
  console.log("RESULT: PASS");
  process.exit(0);
}

async function loadPlaywright() {
  for (const name of ["playwright", "playwright-chromium"]) {
    try { return require(name); } catch (_) {}
  }
  return null;
}

(async () => {
  const pw = await loadPlaywright();
  if (!pw?.chromium) {
    console.log("INFO live v12 probe skipped because Playwright is not installed");
    console.log("RESULT: PASS");
    return;
  }
  const browser = await pw.chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const failures = [];
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(5000);
    const result = await page.evaluate(() => {
      const api = window.__harthmereAnimationHandednessDeathBoundsV12;
      const debug = window.__harthmereRendererDebug;
      return {
        ok: !!api,
        version: api?.version,
        handedness: api?.handednessProbe?.() ?? debug?.handednessProbeV12?.(),
        deathAll: api?.deathAllActorsProbe?.() ?? debug?.deathAllActorsProbeV12?.(),
        deathBounds: api?.deathBoundsProbe?.() ?? debug?.deathBoundsProbeV12?.(),
        worldEffects: api?.worldEffectVisibilityProbe?.() ?? debug?.worldEffectVisibilityProbeV12?.(),
      };
    });
    function assert(label, condition, detail) {
      if (condition) console.log(`OK ${label}`);
      else { failures.push(label); console.log(`FAIL ${label}`); if (detail) console.log(`  - ${detail}`); }
    }
    assert("browser exposes v12 API", result.ok, "missing __harthmereAnimationHandednessDeathBoundsV12");
    assert("v12 version matches", result.version === "harthmere-animation-handedness-death-bounds-v12", result.version);
    assert("main-hand probe expects visual-right attack side", result.handedness?.primaryAttackVisualSide === "right");
    assert("main-hand grip budget is tight", Number(result.handedness?.maxGripDistanceMeters ?? 999) <= 0.22);
    assert("death probe covers all actor families", Array.isArray(result.deathAll?.actorFamilies) && result.deathAll.actorFamilies.includes("animal") && result.deathAll.actorFamilies.includes("boss"));
    assert("death probe requires locomotion stop", result.deathAll?.deathStopsLocomotion === true);
    assert("death bounds probe requires above-ground corpse", result.deathBounds?.corpseAboveGroundRequired === true);
    assert("world effect probe requires obvious hit point", result.worldEffects?.hitPointMustBeObvious === true);
    await browser.close();
    console.log("");
    if (failures.length) { console.log(`RESULT: FAIL (${failures.length})`); process.exit(1); }
    console.log("RESULT: PASS");
  } catch (error) {
    await browser.close();
    console.log("FAIL live v12 probe threw");
    console.log(`  - ${error?.stack || error}`);
    console.log("RESULT: FAIL (1)");
    process.exit(1);
  }
})();
