#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { makeReporter } = require("./harthmere-town-rule-test-utils-v1.cjs");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const report = makeReporter("Harthmere live sword animation polish screenshot tests v3", root);
const url = process.env.HARTHMERE_E2E_URL || "http://localhost:3000/at/Joe";
const timeoutMs = Number(process.env.HARTHMERE_E2E_TIMEOUT_MS || 45000);
const settleMs = Number(process.env.HARTHMERE_SWORD_E2E_SETTLE_MS || 650);
const outDir = process.env.HARTHMERE_SWORD_SCREENSHOT_DIR || path.join(root, "scripts/harthmere/.artifacts/sword-visual-regression-v3");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  let puppeteer;
  try {
    puppeteer = require("puppeteer");
  } catch (error) {
    report.fail("puppeteer is installed", "Install repo browser-test dependencies first; this test intentionally uses Puppeteer screenshots.");
    report.finish();
    return;
  }

  fs.mkdirSync(outDir, { recursive: true });
  const browser = await puppeteer.launch({
    headless: process.env.HARTHMERE_E2E_HEADFUL === "1" ? false : "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(timeoutMs);
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument(() => {
      window.localStorage?.setItem("biomes.localDev.harthmere.rendererVerbose", "1");
      window.localStorage?.setItem("biomes.localDev.harthmere.combatDebug", "1");
    });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForFunction(() => Boolean(window.__harthmereRendererDebug?.swordState), { timeout: timeoutMs });
    await sleep(settleMs);

    async function pose(name, setup) {
      if (setup) {
        await setup();
      }
      await sleep(settleMs);
      const state = await page.evaluate(() => window.__harthmereRendererDebug?.swordState?.());
      await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: false });
      return state;
    }

    const sheathed = await pose("01-sheathed-sword", () => page.evaluate(() => window.__harthmereRendererDebug?.swordVisualRegressionPose?.("sheathed")));
    report.check("sheathed screenshot captured with sword debug state", Boolean(sheathed), "Expected swordState after sheathed pose.");

    const drawn = await pose("02-drawn-idle", () => page.evaluate(() => window.__harthmereRendererDebug?.swordVisualRegressionPose?.("drawn_idle")));
    report.check("drawn idle screenshot reports drawn sword", drawn?.drawn === true || drawn?.state?.drawn === true, "Drawn idle should report drawn=true.");

    const basic = await pose("03-basic-slash", () => page.evaluate(() => window.__harthmereRendererDebug?.swordVisualRegressionPose?.("basic_slash")));
    report.check("basic slash screenshot reports slash trail or basic clip", Boolean(basic?.trailVisible || /BasicSlash|basic/i.test(String(basic?.activeClip ?? basic?.clip ?? basic?.attack ?? ""))), "Basic slash should expose trail or BasicSlash_24 state.");

    const heavy = await pose("04-heavy-slash", () => page.evaluate(() => window.__harthmereRendererDebug?.swordVisualRegressionPose?.("heavy_slash")));
    report.check("heavy slash screenshot reports heavy attack state", Boolean(heavy?.trailVisible || /HeavySlash|heavy/i.test(String(heavy?.activeClip ?? heavy?.clip ?? heavy?.attack ?? ""))), "Heavy slash should expose trail or HeavySlash_24 state.");

    const block = await pose("05-block-contact", () => page.evaluate(() => window.__harthmereRendererDebug?.swordVisualRegressionPose?.("block")));
    report.check("block screenshot reports block contact feedback", Boolean(block?.blockFeedbackVisible), "Block pose should show block feedback state.");

    const npc = await pose("06-npc-attack", () => page.evaluate(() => window.__harthmereRendererDebug?.swordVisualRegressionPose?.("npc_attack")));
    report.check("NPC attack screenshot reports NPC weapon visual coverage", Number(npc?.npcWeaponVisualCount ?? 0) > 0, "At least one NPC weapon visual should be attached.");

    for (const direction of ["north", "east", "south", "west"]) {
      const state = await pose(`07-facing-${direction}`, () => page.evaluate((dir) => window.__harthmereRendererDebug?.setSwordFacing?.(dir), direction));
      report.check(`facing ${direction} screenshot captured`, Boolean(state?.position || state?.rotation), `Missing debug state for ${direction} facing.`);
    }

    const files = fs.readdirSync(outDir).filter((file) => file.endsWith(".png"));
    report.check("screenshot regression artifacts were written", files.length >= 10, `Expected at least 10 PNG screenshots in ${outDir}; found ${files.length}.`);
    console.log(`Screenshots written to: ${outDir}`);
  } finally {
    await browser.close();
  }

  report.finish();
}

main().catch((error) => {
  report.fail("live sword animation polish test completed", error?.stack || String(error));
  report.finish();
});
