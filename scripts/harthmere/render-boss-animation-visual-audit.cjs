#!/usr/bin/env node

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const puppeteer = require("puppeteer");
const sharp = require("sharp");

const root = path.resolve(__dirname, "../..");
const auditRoot = path.join(
  root,
  "artifacts/harthmere-boss-animation-visual-audit"
);
const screenshotsRoot = path.join(auditRoot, "screenshots");
const contactSheetsRoot = path.join(auditRoot, "contact-sheets");
const port = Number(process.env.HARTHMERE_BOSS_AUDIT_PORT || 4179);
const url = `http://127.0.0.1:${port}/`;

function slug(text) {
  return text
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function waitForServer(server) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Boss animation audit server did not start")),
      30_000
    );
    let output = "";
    server.stdout.on("data", (chunk) => {
      output += chunk.toString();
      if (output.includes(url)) {
        clearTimeout(timeout);
        resolve();
      }
    });
    server.stderr.on("data", (chunk) => process.stderr.write(chunk));
    server.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Boss animation audit server exited with ${code}`));
    });
  });
}

async function buildMasterContactSheet(paths) {
  const width = 560;
  const gap = 16;
  const tiles = [];
  for (const filePath of paths) {
    const buffer = await sharp(filePath)
      .resize({ width, withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer();
    const metadata = await sharp(buffer).metadata();
    tiles.push({ buffer, height: metadata.height });
  }
  const rows = Math.ceil(tiles.length / 2);
  const rowHeights = Array.from({ length: rows }, (_, row) =>
    Math.max(tiles[row * 2]?.height ?? 0, tiles[row * 2 + 1]?.height ?? 0)
  );
  const height =
    rowHeights.reduce((sum, value) => sum + value, 0) + gap * (rows + 1);
  const canvas = sharp({
    create: {
      width: width * 2 + gap * 3,
      height,
      channels: 3,
      background: "#091017",
    },
  });
  const composites = [];
  let top = gap;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < 2; column += 1) {
      const tile = tiles[row * 2 + column];
      if (!tile) continue;
      composites.push({
        input: tile.buffer,
        left: gap + column * (width + gap),
        top,
      });
    }
    top += rowHeights[row] + gap;
  }
  await canvas
    .composite(composites)
    .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
    .toFile(path.join(auditRoot, "all-bosses.jpg"));
}

async function main() {
  fs.mkdirSync(screenshotsRoot, { recursive: true });
  fs.mkdirSync(contactSheetsRoot, { recursive: true });
  const manifest = JSON.parse(
    fs.readFileSync(
      path.join(root, "public/assets/harthmere/glb/bosses/manifest.json"),
      "utf8"
    )
  );
  const server = spawn(
    process.execPath,
    [
      path.join(
        root,
        "scripts/harthmere/serve-boss-animation-visual-audit.cjs"
      ),
    ],
    {
      cwd: root,
      env: { ...process.env, HARTHMERE_BOSS_AUDIT_PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  let browser;
  try {
    await waitForServer(server);
    browser = await puppeteer.launch({
      headless: "new",
      defaultViewport: { width: 1220, height: 900, deviceScaleFactor: 1 },
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--ignore-gpu-blocklist",
        "--enable-webgl",
      ],
    });
    const page = await browser.newPage();
    page.setDefaultTimeout(120_000);
    const results = [];
    const contactSheetPaths = [];
    for (const boss of manifest.bosses) {
      process.stdout.write(`Rendering ${boss.id}...\n`);
      await page.goto(`${url}?boss=${encodeURIComponent(boss.id)}`, {
        waitUntil: "networkidle0",
      });
      await page.waitForFunction(
        () => window.__harthmereBossAnimationVisualAudit?.ready === true
      );
      const audit = await page.evaluate(
        () => window.__harthmereBossAnimationVisualAudit
      );
      if (!audit || audit.failures.length) {
        throw new Error(
          `${boss.id}: ${audit?.failures.join("; ") || "missing audit state"}`
        );
      }
      const contactSheetPath = path.join(contactSheetsRoot, `${boss.id}.jpg`);
      await page.screenshot({
        path: contactSheetPath,
        fullPage: true,
        type: "jpeg",
        quality: 90,
      });
      contactSheetPaths.push(contactSheetPath);
      const articles = await page.$$("article");
      if (articles.length !== audit.states.length) {
        throw new Error(
          `${boss.id}: ${articles.length} rendered states for ${audit.states.length} audit states`
        );
      }
      const bossRoot = path.join(screenshotsRoot, boss.id);
      fs.mkdirSync(bossRoot, { recursive: true });
      for (let index = 0; index < articles.length; index += 1) {
        const article = articles[index];
        const state = audit.states[index];
        const details = await article.evaluate((element) => ({
          failed: element.classList.contains("fail"),
          title: element.querySelector("h2")?.textContent?.trim() ?? "",
          metadata:
            element.querySelector(".metadata")?.textContent?.trim() ?? "",
          score: element.querySelector(".score")?.textContent?.trim() ?? "",
          frameLabels: Array.from(element.querySelectorAll("figcaption")).map(
            (node) => node.textContent?.trim() ?? ""
          ),
          graphic:
            element.querySelector(".visual-label")?.textContent?.trim() ?? null,
        }));
        const fileName = `${String(index).padStart(2, "0")}-${slug(
          state.name
        )}.png`;
        const screenshot = path.join(bossRoot, fileName);
        await article.screenshot({ path: screenshot });
        results.push({
          bossId: audit.bossId,
          bossName: audit.bossName,
          stateIndex: index,
          stateName: state.name,
          fileName,
          bytes: fs.statSync(screenshot).size,
          auditState: state,
          failed: details.failed,
          failures: details.failed
            ? [`${state.name}: visual audit failed`]
            : [],
          frameLabels: details.frameLabels,
          graphic: details.graphic,
          metadata: details.metadata,
          score: details.score,
          status: `${audit.states.length}/${audit.states.length} visibly animated`,
          title: details.title,
        });
      }
    }
    fs.writeFileSync(
      path.join(auditRoot, "results.json"),
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          animationPolishVersion: manifest.animationPolishVersion,
          results,
        },
        null,
        2
      )}\n`
    );
    await buildMasterContactSheet(contactSheetPaths);
    process.stdout.write(`Rendered ${results.length} polished boss states.\n`);
  } finally {
    await browser?.close();
    server.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
