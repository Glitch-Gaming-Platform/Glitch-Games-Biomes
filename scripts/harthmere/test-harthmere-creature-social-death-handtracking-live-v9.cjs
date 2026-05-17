#!/usr/bin/env node
/* eslint-disable no-console */
const path = require("path");
let makeReporter;
try {
  ({ makeReporter } = require("./harthmere-town-rule-test-utils-v1.cjs"));
} catch {
  makeReporter = (title, root) => {
    let failures = 0;
    console.log(`== ${title} ==`);
    console.log(`Root: ${root}\n`);
    return {
      check(label, ok, detail) {
        if (ok) console.log(`OK ${label}`);
        else { failures += 1; console.log(`FAIL ${label}`); if (detail) console.log(`  - ${detail}`); }
      },
      fail(label, detail) { failures += 1; console.log(`FAIL ${label}`); if (detail) console.log(`  - ${detail}`); },
      finish() { console.log(`\nRESULT: ${failures ? `FAIL (${failures})` : "PASS"}`); process.exitCode = failures ? 1 : 0; },
    };
  };
}

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const report = makeReporter("Harthmere live creature/social/death/weapon-handtracking animation tests v9", root);
const url = process.env.HARTHMERE_E2E_URL || "http://localhost:3000/at/Joe";
const timeoutMs = Number(process.env.HARTHMERE_E2E_TIMEOUT_MS || 45000);
const settleMs = Number(process.env.HARTHMERE_ANIMATION_V9_SETTLE_MS || 750);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  let puppeteer;
  try {
    puppeteer = require("puppeteer");
  } catch (error) {
    report.fail("puppeteer is installed", "Install repo browser-test dependencies first; live v9 test uses Puppeteer.");
    report.finish();
    return;
  }

  const browser = await puppeteer.launch({
    headless: process.env.HARTHMERE_E2E_HEADFUL === "1" ? false : "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(timeoutMs);
    await page.evaluateOnNewDocument(() => {
      window.localStorage?.setItem("biomes.localDev.harthmere.rendererVerbose", "1");
      window.localStorage?.setItem("biomes.localDev.harthmere.combatDebug", "1");
    });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForFunction(() => Boolean(window.__harthmereRendererDebug?.weaponHandTracking), { timeout: timeoutMs });

    await page.evaluate(() => window.__harthmereRendererDebug?.swordVisualRegressionPose?.("drawn_idle"));
    await sleep(250);
    await page.evaluate(() => window.__harthmereRendererDebug?.swordVisualRegressionPose?.("basic_slash"));
    await sleep(settleMs);

    const hand = await page.evaluate(() => window.__harthmereRendererDebug?.weaponHandTracking?.());
    report.check("live weapon hand tracking debug exists", Boolean(hand?.version), "Missing weaponHandTracking debug state.");
    report.check("live weapon samples stay within grip budget", Number(hand?.gripDistance ?? 999) <= Number(hand?.maxGripDistance ?? 0.22), `Grip distance too large: ${JSON.stringify(hand)}`);
    report.check("live weapon reports current hand anchor", /hand/i.test(String(hand?.anchorName ?? "")) || Boolean(hand?.samples?.length), `Expected a hand anchor or samples: ${JSON.stringify(hand)}`);

    const creatures = await page.evaluate(() => window.__harthmereRendererDebug?.creatureAnimationAudit?.());
    report.check("live creature/animal audit is exposed", Boolean(creatures?.version), "Missing creatureAnimationAudit.");
    report.check("live creature/animal audit reports required states", Array.isArray(creatures?.states) && creatures.states.includes("attack") && creatures.states.includes("death") && creatures.states.includes("turnInPlace"), JSON.stringify(creatures));

    const social = await page.evaluate(() => window.__harthmereRendererDebug?.socialWorkAnimationAudit?.());
    report.check("live social/work audit is exposed", Boolean(social?.version), "Missing socialWorkAnimationAudit.");
    report.check("live social/work audit reports role states", Array.isArray(social?.states) && social.states.includes("vendorIdle") && social.states.includes("workLoop") && social.states.includes("guardPatrolIdle"), JSON.stringify(social));

    await page.evaluate(() => window.__harthmereRendererDebug?.fakeBanditDeath?.());
    await sleep(settleMs);
    const death = await page.evaluate(() => window.__harthmereRendererDebug?.deathRespawnCinematicAudit?.());
    report.check("live death/respawn audit is exposed", Boolean(death?.version), "Missing deathRespawnCinematicAudit.");
    report.check("dead combat actors remain visible when present", !Array.isArray(death?.deadActors) || death.deadActors.every((actor) => actor.visible !== false), JSON.stringify(death));
  } finally {
    await browser.close();
  }

  report.finish();
}

main().catch((error) => {
  report.fail("live v9 animation test completed", error?.stack || String(error));
  report.finish();
});
