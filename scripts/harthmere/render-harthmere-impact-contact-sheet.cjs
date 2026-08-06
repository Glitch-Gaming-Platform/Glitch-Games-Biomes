#!/usr/bin/env node

const esbuild = require("esbuild");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const puppeteer = require("puppeteer");

const root = path.resolve(__dirname, "../..");
const outputRoot = path.join(root, "public/assets/harthmere/impact_previews");
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "harthmere-impact-review-"));
const bundlePath = path.join(temporaryRoot, "review.js");
const htmlPath = path.join(temporaryRoot, "review.html");

async function main() {
  fs.mkdirSync(outputRoot, { recursive: true });
  await esbuild.build({
    entryPoints: [path.join(__dirname, "harthmere-impact-review-entry.ts")],
    bundle: true,
    platform: "browser",
    format: "iife",
    target: ["chrome120"],
    alias: { "@": path.join(root, "src") },
    outfile: bundlePath,
    sourcemap: false,
  });
  fs.writeFileSync(
    htmlPath,
    `<!doctype html><html><head><meta charset="utf-8"><style>
      * { box-sizing: border-box; }
      html, body { margin: 0; background: #05070c; color: #f1f5ff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      body { width: 1280px; padding: 28px 28px 34px; }
      h1 { margin: 0 0 6px; font-size: 27px; letter-spacing: 0.02em; }
      .subtitle { color: #98a7c4; margin: 0 0 24px; font-size: 14px; }
      #impact-grid { display: grid; grid-template-columns: repeat(4, 300px); gap: 18px 8px; }
      .impact-card { width: 300px; overflow: hidden; border: 1px solid #253047; border-radius: 12px; background: #0b101a; box-shadow: 0 10px 28px rgba(0,0,0,.28); }
      canvas { display: block; width: 300px; height: 220px; }
      .impact-label { padding: 10px 12px 2px; font-size: 15px; font-weight: 700; }
      .impact-meta { padding: 0 12px 11px; color: #8fa2c5; font-size: 11px; text-transform: capitalize; }
    </style></head><body>
      <h1>Harthmere Polished Impact & Explosion Families</h1>
      <p class="subtitle">Actual runtime geometry sampled at the hero frame of each impact.</p>
      <main id="impact-grid"></main>
      <script src="review.js"></script>
    </body></html>`
  );

  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    page.on("console", (message) => console.log(`[browser:${message.type()}] ${message.text()}`));
    page.on("pageerror", (error) => console.error(`[browser:error] ${error.stack || error.message}`));
    await page.setViewport({ width: 1280, height: 1200, deviceScaleFactor: 1 });
    await page.goto(`file://${htmlPath}`, { waitUntil: "load" });
    await page.waitForFunction(() => window.__harthmereImpactReviewReady === true, { timeout: 30000 });
    await page.screenshot({ path: path.join(outputRoot, "contact_sheet.png"), fullPage: true });
    const cards = await page.$$(".impact-card");
    for (const card of cards) {
      const id = await card.evaluate((element) => element.dataset.impactId);
      if (!id) continue;
      await card.screenshot({ path: path.join(outputRoot, `${id}.png`) });
    }
    console.log(path.join(outputRoot, "contact_sheet.png"));
  } finally {
    await browser.close();
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
