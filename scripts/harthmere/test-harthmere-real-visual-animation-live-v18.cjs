#!/usr/bin/env node
"use strict";
const url = process.env.HARTHMERE_E2E_URL;
if (!url) {
  console.error("FAIL HARTHMERE_E2E_URL is required for live visual validation.");
  process.exit(1);
}
let puppeteer;
try {
  puppeteer = require("puppeteer");
} catch (e) {
  console.error("FAIL puppeteer is required for live visual validation. Run: npm install --save-dev puppeteer");
  process.exit(1);
}
(async () => {
  const browser = await puppeteer.launch({ headless: true, defaultViewport: { width: 1440, height: 900 }, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForFunction(() => !!window.__harthmereRendererDebug?.weaponHandTracking, { timeout: 30000 });
  const before = await page.evaluate(() => window.__harthmereRendererDebug.weaponHandTracking());
  await page.keyboard.press("KeyX");
  await page.waitForTimeout(350);
  const drawn = await page.evaluate(() => window.__harthmereRendererDebug.weaponHandTracking());
  await page.keyboard.press("KeyB");
  await page.waitForTimeout(180);
  const attackA = await page.evaluate(() => window.__harthmereRendererDebug.weaponHandTracking());
  await page.keyboard.press("KeyB");
  await page.waitForTimeout(180);
  const attackB = await page.evaluate(() => window.__harthmereRendererDebug.weaponHandTracking());
  const failures = [];
  function assert(label, cond, data) { if (!cond) failures.push(`${label}: ${JSON.stringify(data)}`); }
  assert("drawn sword is closer to right hand than left hand", drawn.rightHandDistanceMeters < drawn.leftHandDistanceMeters, drawn);
  assert("drawn sword respects right-hand distance budget", drawn.rightHandDistanceMeters <= 0.14, drawn);
  assert("main hand side score is on visual right", drawn.mainHandSideScore > 0, drawn);
  if (attackA.attackVariationEmoteType && attackB.attackVariationEmoteType) {
    assert("consecutive attacks use different variation emotes", attackA.attackVariationEmoteType !== attackB.attackVariationEmoteType, { attackA, attackB });
  }
  await browser.close();
  if (failures.length) {
    console.error("RESULT: FAIL");
    for (const failure of failures) console.error("FAIL", failure);
    process.exit(1);
  }
  console.log("RESULT: PASS");
})().catch((error) => { console.error(error); process.exit(1); });
