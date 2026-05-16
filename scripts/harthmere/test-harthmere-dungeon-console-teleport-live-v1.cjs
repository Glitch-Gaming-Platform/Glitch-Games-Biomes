#!/usr/bin/env node
"use strict";
/* HARTHMERE_DUNGEON_CONSOLE_TELEPORT_LIVE_TEST_V1 */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const url = process.env.HARTHMERE_E2E_URL || "";
let ok = true;

function pass(label) { console.log(`OK ${label}`); }
function fail(label, detail) {
  ok = false;
  console.log(`FAIL ${label}`);
  const lines = Array.isArray(detail) ? detail : String(detail || "").split("\n");
  for (const line of lines.filter(Boolean).slice(0, 80)) console.log(`  - ${line}`);
}
function check(label, condition, detail) { condition ? pass(label) : fail(label, detail); }

console.log("== Harthmere dungeon console teleport live tests v1 ==");
console.log(`Root: ${root}`);
console.log(`URL: ${url || "<HARTHMERE_E2E_URL not set>"}`);
console.log("");

check("harthmere_assets.ts exists", fs.existsSync(path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts")), "Missing harthmere_assets.ts");

if (!url) {
  console.log("INFO live teleport probe skipped because HARTHMERE_E2E_URL is not set");
  console.log(ok ? "\nRESULT: PASS" : "\nRESULT: FAIL");
  process.exit(ok ? 0 : 1);
}

let chromium;
try {
  chromium = require("playwright").chromium;
  pass("Playwright is installed for dungeon teleport live test");
} catch (error) {
  fail("Playwright is installed for dungeon teleport live test", "Run: npm install --save-dev playwright --legacy-peer-deps && npx playwright install chromium");
  console.log("\nRESULT: FAIL");
  process.exit(1);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3000);

    const probe = await page.evaluate(() => {
      const win = window;
      return {
        href: win.location.href,
        title: document.title,
        hasTownAudit: !!win.__harthmereTownAudit,
        hasDungeonTest: !!win.__harthmereDungeonTest,
        hasTeleport:
          typeof win.__harthmereDungeonTest?.teleportToBellwardHalls === "function" ||
          typeof win.__harthmereTownAudit?.teleportToDungeonTestTarget === "function",
        localStorageKeys: Object.keys(win.localStorage || {}).filter((key) => key.includes("harthmere")),
      };
    });

    check("browser loaded actual Harthmere runtime with dungeon teleport helper", probe.hasTeleport, JSON.stringify(probe, null, 2));

    if (probe.hasTeleport) {
      const result = await page.evaluate(async () => {
        const before = window.__harthmereTownAudit?.getPlayerPosition?.()
          || window.__harthmerePlayerDebug?.getPosition?.()
          || window.__biomesDebug?.getPlayerPosition?.()
          || null;

        const teleportResult =
          window.__harthmereDungeonTest?.teleportToBellwardHalls?.()
          || window.__harthmereTownAudit?.teleportToDungeonTestTarget?.("bellwardHalls");

        await new Promise((resolve) => setTimeout(resolve, 500));

        const after = window.__harthmereTownAudit?.getPlayerPosition?.()
          || window.__harthmerePlayerDebug?.getPosition?.()
          || window.__biomesDebug?.getPlayerPosition?.()
          || null;

        return { before, after, teleportResult };
      });

      check(
        "teleport command performs a real live teleport instead of only storing localStorage",
        result.teleportResult && result.teleportResult.teleported === true && result.teleportResult.stored !== true,
        JSON.stringify(result, null, 2)
      );

      check(
        "teleport result targets Bellward Halls",
        result.teleportResult?.target?.name === "bellwardHalls" || result.teleportResult?.target?.district === "Old Well / Underways",
        JSON.stringify(result.teleportResult || {}, null, 2)
      );
    }
  } catch (error) {
    fail("dungeon console teleport live test completed without unhandled exception", error && error.stack ? error.stack : String(error));
  } finally {
    await browser.close();
  }

  console.log(ok ? "\nRESULT: PASS" : "\nRESULT: FAIL");
  process.exit(ok ? 0 : 1);
})();
