#!/usr/bin/env node
const assert = require("assert");

const url = process.argv[2] || process.env.BIOMES_UI_BROWSER_URL || "http://localhost:3000/at/Local%20Biomes%20Player";
const timeoutMs = Number(process.env.BIOMES_UI_BROWSER_TIMEOUT_MS || 90000);

async function main() {
  let puppeteer;
  try {
    puppeteer = require("puppeteer");
  } catch (err) {
    console.error("puppeteer is not installed. Run yarn install first, or skip this live browser test.");
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    headless: process.env.BIOMES_UI_HEADLESS === "0" ? false : "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();
  const runtimeErrors = [];
  const consoleErrors = [];

  page.on("pageerror", (err) => runtimeErrors.push(err.stack || err.message || String(err)));

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.evaluateOnNewDocument(() => {
    localStorage.setItem("biomes_ui_enabled", "1");
    localStorage.setItem("biomes_ui_replace_legacy", "1");
  });

  let response;
  try {
    response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  } catch (err) {
    await browser.close();
    console.error(`Could not open ${url}. Start ./b data-snapshot run first, then rerun this test.`);
    console.error(err.stack || err.message || String(err));
    process.exit(1);
  }

  assert(response && response.ok(), `page returned HTTP ${response && response.status()}`);

  await page.waitForSelector('[data-ui-id="hotbar.slot_1"]', { timeout: timeoutMs });

  const keys = [
    ["KeyI", "tab.inventory"],
    ["KeyB", "tab.abilities"],
    ["KeyK", "tab.skills"],
    ["KeyY", "tab.classes"],
    ["KeyL", "tab.land"],
    ["KeyO", "tab.loot"],
    ["KeyG", "tab.guilds"],
    ["KeyP", "tab.banking"],
    ["KeyM", "tab.map"],
    ["BracketRight", "tab.collections"],
    ["KeyV", "tab.inbox"],
    ["Comma", "tab.options"],
  ];

  for (const [code, uiId] of keys) {
    await page.keyboard.press(code);
    await page.waitForSelector(`[data-ui-id="${uiId}"]`, { timeout: 5000 });
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(100);
  }

  await page.keyboard.press("Digit1");
  await page.keyboard.press("Digit2");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await page.keyboard.press("KeyU");

  await page.keyboard.press("KeyM");
  await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Home");
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");

  await page.keyboard.press("KeyR");
  await page.waitForTimeout(1000);

  const bodyText = await page.evaluate(() => document.body.innerText || "");

  assert(!/Unhandled Runtime Error/i.test(bodyText), "no Next.js unhandled runtime error overlay is visible");
  assert(!/findCombatLifeByEcsNpcSnapshot is not a function/i.test(bodyText), "missing combat resolver crash did not occur");
  assert(runtimeErrors.length === 0, `no pageerror events; got:\n${runtimeErrors.join("\n---\n")}`);

  const seriousConsoleErrors = consoleErrors.filter((line) => !/favicon|source map|WebSocket connection|Failed to load resource/i.test(line));
  assert(seriousConsoleErrors.length === 0, `no serious console errors; got:\n${seriousConsoleErrors.join("\n---\n")}`);

  await browser.close();
  console.log(`PASS Biomes UI browser smoke against ${url}`);
}

main().catch((err) => {
  console.error(err.stack || err.message || String(err));
  process.exit(1);
});
