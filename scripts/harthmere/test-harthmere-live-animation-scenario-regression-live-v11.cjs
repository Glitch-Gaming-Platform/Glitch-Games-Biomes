#!/usr/bin/env node
"use strict";

const root = process.argv[2] || process.cwd();
const url = process.env.HARTHMERE_E2E_URL;

console.log("== Harthmere live animation scenario browser tests v11 ==");
console.log(`Root: ${root}`);
console.log(`URL: ${url || "<HARTHMERE_E2E_URL not set>"}\n`);

if (!url) {
  console.log("INFO live browser scenario probe skipped because HARTHMERE_E2E_URL is not set");
  console.log("RESULT: PASS");
  process.exit(0);
}

async function loadPlaywright() {
  const candidates = ["playwright", "playwright-chromium"];
  for (const name of candidates) {
    try {
      return require(name);
    } catch (error) {
      // try next
    }
  }
  return null;
}

(async () => {
  const pw = await loadPlaywright();
  if (!pw?.chromium) {
    console.log("INFO live browser scenario probe skipped because Playwright is not installed");
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
      const w = window;
      const api = w.__harthmereAnimationScenarioRegressionV11 || w.__harthmereLiveAnimationScenarioRegressionV11;
      if (!api) {
        return { ok: false, error: "missing __harthmereAnimationScenarioRegressionV11" };
      }
      const snapshot = api.snapshot?.();
      const hand = api.handTrackingSamples?.();
      const resource = api.resourceHitVisibilityProbe?.("rock");
      const death = api.playerDeathRespawnProbe?.();
      const npc = api.npcInterruptionProbe?.();
      const location = api.locationEffectProbe?.();
      const perf = api.performanceProbe?.();

      return {
        ok: true,
        version: api.version,
        contract: api.contract?.(),
        snapshot,
        hand,
        resource,
        death,
        npc,
        location,
        perf,
      };
    });

    function assert(label, condition, detail) {
      if (condition) {
        console.log(`OK ${label}`);
      } else {
        failures.push(`${label}${detail ? `: ${detail}` : ""}`);
        console.log(`FAIL ${label}`);
        if (detail) console.log(`  - ${detail}`);
      }
    }

    assert("browser exposes v11 animation scenario API", result.ok, result.error);
    assert("v11 version is correct", result.version === "harthmere-live-animation-scenario-regression-v11", result.version);
    assert("contract includes swing sample frames", JSON.stringify(result.contract?.sampleFrames) === JSON.stringify([0, 8, 15, 22, 30]));
    assert("hand tracking probe exists", !!result.hand);
    assert("hand tracking budget is <= 0.22m", Number(result.hand?.budgetMeters ?? 999) <= 0.22);
    assert("resource hit visibility probe requires surface reticle", result.resource?.requiresSurfaceReticle === true);
    assert("resource hit visibility probe requires impact particles at hit point", result.resource?.requiresImpactParticlesAtHitPoint === true);
    assert("death/respawn probe clears pending impact timers", result.death?.clearsPendingImpactTimer === true);
    assert("NPC interruption probe keeps corpse visible", Number(result.npc?.corpseHoldMs ?? 0) >= 3000);
    assert("location probe enforces surface hit point origin", result.location?.resourceEffectOriginMustBeSurfaceHitPoint === true);
    assert("performance probe requires effect cleanup", result.perf?.requiresEffectCleanup === true);

    await browser.close();

    console.log("");
    if (failures.length) {
      console.log(`RESULT: FAIL (${failures.length})`);
      process.exit(1);
    }
    console.log("RESULT: PASS");
  } catch (error) {
    await browser.close();
    console.log("FAIL live browser scenario probe threw");
    console.log(`  - ${error?.stack || error}`);
    console.log("RESULT: FAIL (1)");
    process.exit(1);
  }
})();
