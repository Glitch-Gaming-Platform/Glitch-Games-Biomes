#!/usr/bin/env node
"use strict";
/* HARTHMERE_DUNGEON_CONSOLE_TELEPORT_LIVE_TEST_V2 */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const url = process.env.HARTHMERE_E2E_URL || "";
let ok = true;

function pass(label) { console.log(`OK ${label}`); }
function fail(label, detail) {
  ok = false;
  console.log(`FAIL ${label}`);
  const lines = String(detail || "").split("\n").filter(Boolean).slice(0, 80);
  for (const line of lines) console.log(`  - ${line}`);
}
function check(label, condition, detail) { condition ? pass(label) : fail(label, detail); }

console.log("== Harthmere dungeon console teleport live tests v2 ==");
console.log(`Root: ${root}`);
console.log(`URL: ${url || "<HARTHMERE_E2E_URL not set>"}`);
console.log("");

check("player.ts exists", fs.existsSync(path.join(root, "src/client/game/scripts/player.ts")), "Missing player.ts");
check("harthmere_assets.ts exists", fs.existsSync(path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts")), "Missing harthmere_assets.ts");

if (!url) {
  console.log("INFO live teleport test skipped because HARTHMERE_E2E_URL is not set");
  console.log(ok ? "\nRESULT: PASS" : "\nRESULT: FAIL");
  process.exit(ok ? 0 : 1);
}

let chromium;
try {
  chromium = require("playwright").chromium;
  pass("Playwright is installed");
} catch (error) {
  fail("Playwright is installed", "Run: npm install --save-dev playwright --legacy-peer-deps && npx playwright install chromium");
  console.log("\nRESULT: FAIL");
  process.exit(1);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(2500);

    const probe = await page.evaluate(() => ({
      href: location.href,
      title: document.title,
      hasDungeonTest: !!window.__harthmereDungeonTest,
      hasTownAudit: !!window.__harthmereTownAudit,
      hasLivePlayerDebug: !!window.__harthmereLivePlayerDebug,
      livePlayerDebugKeys: Object.keys(window.__harthmereLivePlayerDebug || {}),
      dungeonKeys: Object.keys(window.__harthmereDungeonTest || {}),
      townAuditKeys: Object.keys(window.__harthmereTownAudit || {}),
      bodySample: document.body?.innerText?.slice(0, 300) || "",
    }));

    check("browser loaded Harthmere runtime with dungeon teleport helper", probe.hasDungeonTest || probe.hasTownAudit, JSON.stringify(probe, null, 2));
    check("browser exposes live player teleport hook", probe.hasLivePlayerDebug, JSON.stringify(probe, null, 2));

    const result = await page.evaluate(async () => {
      const before = window.__harthmereLivePlayerDebug?.getPosition?.();
      const out =
        window.__harthmereDungeonTest?.teleportToBellwardHalls?.()
        || window.__harthmereTownAudit?.teleportToDungeonTestTarget?.("bellwardHalls");
      await new Promise((resolve) => setTimeout(resolve, 500));
      const after = window.__harthmereLivePlayerDebug?.getPosition?.();
      return { before, after, out, last: window.__harthmereDungeonTeleportLastResult };
    });

    check(
      "console teleport returns teleported:true and stored:false",
      result.out?.teleported === true && result.out?.stored !== true,
      JSON.stringify(result, null, 2)
    );

    check(
      "live player position changed to Bellward Halls target",
      Array.isArray(result.after)
        && Math.abs(Number(result.after[0]) - 356) < 0.75
        && Math.abs(Number(result.after[2]) + 318) < 0.75,
      JSON.stringify(result, null, 2)
    );
  } catch (error) {
    fail("live teleport test completed without unhandled exception", error && error.stack ? error.stack : String(error));
  } finally {
    await browser.close();
  }

  console.log(ok ? "\nRESULT: PASS" : "\nRESULT: FAIL");
  process.exit(ok ? 0 : 1);
})();
