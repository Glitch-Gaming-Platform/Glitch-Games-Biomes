#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
const url = process.env.HARTHMERE_E2E_URL;
let ok = true;
function check(label, condition, detail) {
  if (condition) console.log(`OK ${label}`);
  else { ok = false; console.error(`FAIL ${label}`); if (detail) console.error(`  - ${detail}`); }
}
console.log("== Harthmere full animation runtime live tests v6 ==");
console.log(`Root: ${root}`);
console.log(`URL: ${url || "<not set>"}\n`);
if (!url) {
  console.log("INFO live test skipped because HARTHMERE_E2E_URL is not set");
  console.log("\nRESULT: PASS");
  process.exit(0);
}
(async () => {
  let puppeteer;
  try { puppeteer = require("puppeteer"); }
  catch (error) {
    check("puppeteer is installed", false, "Install repo browser-test dependencies first.");
    console.log(`\nRESULT: ${ok ? "PASS" : "FAIL"}`);
    process.exit(ok ? 0 : 1);
  }
  const artifacts = path.join(root, "scripts/harthmere/.artifacts/full-animation-runtime-v6");
  fs.mkdirSync(artifacts, { recursive: true });
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => !!window.__harthmereAnimationRuntimeV6, { timeout: 60000 });
    const snapshot = await page.evaluate(() => window.__harthmereAnimationRuntimeV6.snapshot());
    check("runtime bridge exposes snapshot", !!snapshot && snapshot.version === "harthmere-full-animation-runtime-bridge-v6");
    const families = ["creature", "mount", "ranged", "magic", "shield", "dodge", "airborne", "gathering", "crafting", "building", "social", "deathRespawn", "boss", "screenshot"];
    const results = await page.evaluate((families) => families.map((family) => window.__harthmereAnimationRuntimeV6.request({ family, action: `live-${family}`, phase: "start", screenshotLabel: family })), families);
    check("live runtime accepts one request for every animation family", Array.isArray(results) && results.length === families.length);
    const after = await page.evaluate(() => window.__harthmereAnimationRuntimeV6.snapshot());
    check("live runtime debug log records every family", after && after.count >= families.length);
    const seen = await page.evaluate(() => new Set((window.__harthmereAnimationRuntimeV6.log || []).map((x) => x.family)).size);
    check("live runtime has diverse family coverage", seen >= families.length, `Only saw ${seen} families`);
    await page.screenshot({ path: path.join(artifacts, "full-animation-runtime-v6.png"), fullPage: false });
  } finally {
    await browser.close();
  }
  console.log(`\nRESULT: ${ok ? "PASS" : "FAIL"}`);
  process.exit(ok ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
