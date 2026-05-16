#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = process.argv[2] || process.cwd();
const url = process.env.HARTHMERE_E2E_URL;
console.log("== Harthmere all-weapon animation live smoke tests v4 ==");
console.log(`Root: ${root}`);
console.log(`URL: ${url || "<HARTHMERE_E2E_URL not set>"}`);

if (!url) {
  console.log("INFO live all-weapon probe skipped because HARTHMERE_E2E_URL is not set");
  console.log("RESULT: PASS");
  process.exit(0);
}

const probe = path.join(root, "scripts/harthmere/.tmp-all-weapon-live-v4.cjs");
fs.mkdirSync(path.dirname(probe), { recursive: true });
fs.writeFileSync(probe, `
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(${JSON.stringify(url)}, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForFunction(() => window.__harthmereRendererDebug?.swordState, null, { timeout: 45000 });
  const testItems = ['iron_longsword', 'woodsman_axe', 'two_handed_sword', 'training_dagger', 'wooden_shield', 'bow', 'staff', 'wand'];
  const results = [];
  for (const itemId of testItems) {
    await page.evaluate((itemId) => {
      window.dispatchEvent(new CustomEvent('biomes:harthmere-player-sword-visual', {
        detail: { action: 'draw', drawn: true, itemId, at: Date.now(), recoveryMs: 350 }
      }));
    }, itemId);
    await page.waitForTimeout(350);
    const state = await page.evaluate(() => window.__harthmereRendererDebug.swordState());
    results.push({ itemId, equipmentId: state?.equipmentId, category: state?.category, activeClip: state?.activeClip, usingGltf: state?.usingGltf, anchorMode: state?.anchorMode });
  }
  await browser.close();
  console.log(JSON.stringify(results, null, 2));
  const missing = results.filter((row) => !row.equipmentId || !row.category);
  if (missing.length) {
    console.error('Missing equipment/category in live weapon debug snapshot', missing);
    process.exit(1);
  }
})();
`, "utf8");
const result = spawnSync("node", [probe], { stdio: "inherit", cwd: root, env: process.env });
process.exit(result.status ?? 1);
