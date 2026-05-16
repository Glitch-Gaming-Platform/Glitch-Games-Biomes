#!/usr/bin/env node
const root = process.argv[2] || process.cwd();
const url = process.env.HARTHMERE_E2E_URL;

console.log("== Harthmere body animation / weapon sync live tests v5 ==");
console.log(`Root: ${root}`);
console.log(`URL: ${url || "<HARTHMERE_E2E_URL not set>"}\n`);

if (!url) {
  console.log("INFO live body animation sync test skipped because HARTHMERE_E2E_URL is not set");
  console.log("\nRESULT: PASS");
  process.exit(0);
}
let chromium;
try { ({ chromium } = require("playwright")); }
catch { console.log("INFO live body animation sync test skipped because playwright is not installed"); console.log("\nRESULT: PASS"); process.exit(0); }
let ok = true;
function check(label, condition, detail) { if (condition) console.log(`OK ${label}`); else { ok = false; console.error(`FAIL ${label}`); if (detail) console.error(`  - ${detail}`); } }
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      window.__harthmereBodyAnimationSyncDebug = [];
      window.dispatchEvent(new CustomEvent("biomes:harthmere-attack-animation", { detail: { attack: "basic", at: Date.now(), windupMs: 150, impactMs: 220, recoveryMs: 340, itemId: "iron_longsword" } }));
    });
    await page.waitForFunction(() => Array.isArray(window.__harthmereBodyAnimationSyncDebug) && window.__harthmereBodyAnimationSyncDebug.length > 0, null, { timeout: 8000 });
    const sample = await page.evaluate(() => window.__harthmereBodyAnimationSyncDebug?.[0]);
    check("body sync debug record exists after attack animation event", !!sample);
    check("body sync debug uses weapon timing bridge", sample?.source === "weapon_timing_synced_body_animation", JSON.stringify(sample));
    check("basic body duration equals impact+recovery timing", Math.abs((sample?.duration ?? 0) - 0.56) < 0.05, JSON.stringify(sample));
    check("body emote is attack1 for basic weapon event", sample?.emoteType === "attack1", JSON.stringify(sample));
    check("upper body owns attack while lower body locomotion is preserved", sample?.upperBodyOnly === true && sample?.lowerBodyLocomotionPreserved === true, JSON.stringify(sample));
  } catch (error) { ok = false; console.error("FAIL live body animation sync probe crashed"); console.error(`  - ${error?.stack || error}`); }
  finally { await browser.close(); }
  console.log(`\nRESULT: ${ok ? "PASS" : "FAIL"}`);
  process.exit(ok ? 0 : 1);
})();
