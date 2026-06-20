#!/usr/bin/env node

const { build } = require("esbuild");
const { mkdir, readFile, rm, writeFile } = require("fs/promises");
const os = require("os");
const path = require("path");
const sharp = require("sharp");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "../..");
const artifactDir = path.join(root, "artifacts/harthmere-crafting-visual");

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

async function assertScreenshotNonBlank(buffer, label) {
  const stats = await sharp(buffer).stats();
  const variance = stats.channels.reduce(
    (sum, channel) => sum + channel.stdev,
    0
  );
  if (buffer.byteLength < 20_000 || variance < 8) {
    fail(`${label} screenshot looked blank or too uniform`);
  }
}

const browserShimPlugin = {
  name: "harthmere-browser-node-shims",
  setup(bundle) {
    const shims = {
      async_hooks: `
        export class AsyncLocalStorage {
          run(_store, callback, ...args) { return callback(...args); }
          getStore() { return undefined; }
          enterWith() {}
          disable() {}
        }
      `,
      perf_hooks: `
        export const performance = globalThis.performance;
        export default { performance };
      `,
      crypto: `
        export const webcrypto = globalThis.crypto;
        export function randomBytes(size) {
          const bytes = new Uint8Array(size);
          globalThis.crypto?.getRandomValues?.(bytes);
          return bytes;
        }
        export default { webcrypto, randomBytes };
      `,
      os: `
        export function platform() { return "browser"; }
        export function release() { return ""; }
        export function type() { return "Browser"; }
        export default { platform, release, type };
      `,
      process: `
        export const env = { NODE_ENV: "production" };
        export const browser = true;
        export const argv = [];
        export const platform = "browser";
        export default { env, browser, argv, platform };
      `,
      "colors/safe": `
        const identity = (value) => String(value);
        const colors = new Proxy({}, { get: () => identity });
        export default colors;
        export const red = identity;
        export const green = identity;
        export const yellow = identity;
        export const blue = identity;
        export const gray = identity;
        export const grey = identity;
        export const bold = identity;
      `,
      colors: `
        const identity = (value) => String(value);
        export default new Proxy({}, { get: () => identity });
      `,
      prettyjson: `
        export function render(value) {
          return typeof value === "string" ? value : JSON.stringify(value);
        }
        export default { render };
      `,
    };
    bundle.onResolve(
      {
        filter:
          /^(async_hooks|perf_hooks|crypto|os|process|colors|colors\/safe|prettyjson)$/,
      },
      (args) => ({ path: args.path, namespace: "node-shim" })
    );
    bundle.onLoad({ filter: /.*/, namespace: "node-shim" }, (args) => ({
      contents: shims[args.path],
      loader: "js",
    }));
  },
};

async function buildHarness(tempDir) {
  const entryPath = path.join(tempDir, "entry.tsx");
  const bundlePath = path.join(tempDir, "bundle.js");
  const tsconfigPath = path.join(tempDir, "tsconfig.json");
  await writeFile(
    tsconfigPath,
    JSON.stringify({
      compilerOptions: {
        jsx: "react",
        baseUrl: path.join(root, "src"),
        paths: {
          "@/*": ["*"],
          "@/galois/*": ["galois/js/*"],
        },
        moduleResolution: "node",
        esModuleInterop: true,
      },
    })
  );
  await writeFile(
    entryPath,
    `
      import * as React from "react";
      import { createRoot } from "react-dom/client";
      import {
        HarthmereCraftingStationPanel,
        createHarthmereCraftingStationAdapter,
        normalizeHarthmereCraftingStationClientSnapshot,
      } from "@/client/components/harthmere_crafting";
      import {
        HARTHMERE_CRAFTING_STATION_RECIPE_IDS,
        HARTHMERE_CRAFTING_STATIONS,
        HARTHMERE_CRAFTING_TOOLS,
        HARTHMERE_EXOTIC_MATTER_ITEM_IDS,
        HARTHMERE_EXOTIC_MATTER_RECIPE_IDS,
        HARTHMERE_HOME_DECORATION_ITEM_IDS,
        HARTHMERE_HOME_DECORATION_RECIPE_IDS,
        ensureHarthmereProductionCraftingCatalogue,
      } from "@/shared/harthmere/mmo_crafting_catalogue";

      ensureHarthmereProductionCraftingCatalogue();
      const nowMs = 1770000000000;

      function adapter(state: any) {
        const snapshot = normalizeHarthmereCraftingStationClientSnapshot(state);
        return createHarthmereCraftingStationAdapter({
          state: snapshot,
          hydrated: true,
          submit: async () => ({ ok: true, craftingState: snapshot }),
        });
      }

      const workbench = adapter({
        actorId: "visual_crafter",
        stationId: HARTHMERE_CRAFTING_STATIONS.workbench,
        gold: 300,
        inventoryItems: {
          [HARTHMERE_CRAFTING_TOOLS.slabber]: 1,
          [HARTHMERE_CRAFTING_TOOLS.woodenFencer]: 1,
        },
        materialStorage: {
          wood_log: 6,
          wood_plank: 40,
          iron_ingot: 18,
          crystal_shard: 8,
          arcane_dust: 6,
          coal: 6,
          linen_cloth: 6,
          rough_herb: 6,
          grain_seed: 6,
          river_reed: 6,
        },
        knownRecipes: [
          "harthmere_carpentry_wood_plank",
          ...Object.values(HARTHMERE_CRAFTING_STATION_RECIPE_IDS),
          ...Object.values(HARTHMERE_HOME_DECORATION_RECIPE_IDS),
        ],
        skills: {
          carpentry: { level: 10 },
          blacksmithing: { level: 10 },
          exotic_refining: { level: 10 },
          tailoring: { level: 10 },
          alchemy: { level: 10 },
          enchanting: { level: 10 },
        },
        nowMs,
      });

      const thermoblaster = adapter({
        actorId: "visual_refiner",
        stationId: HARTHMERE_CRAFTING_STATIONS.thermoblaster,
        gold: 800,
        inventoryItems: {
          [HARTHMERE_CRAFTING_TOOLS.bucket]: 1,
          [HARTHMERE_CRAFTING_TOOLS.slabber]: 1,
        },
        materialStorage: {
          [HARTHMERE_EXOTIC_MATTER_ITEM_IDS.antiprotonCapsule]: 20,
          [HARTHMERE_EXOTIC_MATTER_ITEM_IDS.positronCapsule]: 20,
          [HARTHMERE_EXOTIC_MATTER_ITEM_IDS.antineutronCapsule]: 20,
          [HARTHMERE_EXOTIC_MATTER_ITEM_IDS.antihydrogenBlock]: 3,
          [HARTHMERE_EXOTIC_MATTER_ITEM_IDS.antiheliumBlock]: 3,
          [HARTHMERE_EXOTIC_MATTER_ITEM_IDS.antiboronBlock]: 3,
          [HARTHMERE_EXOTIC_MATTER_ITEM_IDS.rawExoticMatter]: 4,
          [HARTHMERE_EXOTIC_MATTER_ITEM_IDS.stabilizedExoticMatter]: 4,
          [HARTHMERE_EXOTIC_MATTER_ITEM_IDS.containmentFilter]: 12,
          [HARTHMERE_EXOTIC_MATTER_ITEM_IDS.coolant]: 6,
          [HARTHMERE_EXOTIC_MATTER_ITEM_IDS.stabilizingCrystal]: 4,
          [HARTHMERE_EXOTIC_MATTER_ITEM_IDS.exoticMatterPowerCell]: 2,
          [HARTHMERE_EXOTIC_MATTER_ITEM_IDS.portalFuel]: 2,
          [HARTHMERE_EXOTIC_MATTER_ITEM_IDS.destinationCrystal]: 2,
          iron_ingot: 8,
          crystal_shard: 8,
        },
        knownRecipes: Object.values(HARTHMERE_EXOTIC_MATTER_RECIPE_IDS),
        skills: { exotic_refining: { level: 20 } },
        nowMs,
      });

      const jobs = adapter({
        actorId: "visual_jobs",
        stationId: HARTHMERE_CRAFTING_STATIONS.workbench,
        gold: 120,
        inventoryItems: {
          [HARTHMERE_CRAFTING_TOOLS.slabber]: 1,
          [HARTHMERE_HOME_DECORATION_ITEM_IDS.storageCabinet]: 1,
        },
        materialStorage: { wood_plank: 12, iron_ingot: 4 },
        knownRecipes: [
          HARTHMERE_CRAFTING_STATION_RECIPE_IDS.workbench,
          HARTHMERE_HOME_DECORATION_RECIPE_IDS.storageCabinet,
        ],
        skills: { carpentry: { level: 8 } },
        activeJobs: [
          {
            jobId: "craft_visual_jobs_1",
            recipeId: HARTHMERE_HOME_DECORATION_RECIPE_IDS.storageCabinet,
            readyAtMs: nowMs + 45000,
            status: "active",
          },
        ],
        history: [
          {
            jobId: "craft_visual_jobs_done",
            recipeId: HARTHMERE_CRAFTING_STATION_RECIPE_IDS.workbench,
            readyAtMs: nowMs - 1000,
            status: "completed",
          },
        ],
        nowMs,
      });

      function App() {
        return (
          <main className="crafting-visual-page">
            <HarthmereCraftingStationPanel adapter={workbench} compact />
            <HarthmereCraftingStationPanel adapter={thermoblaster} compact />
            <HarthmereCraftingStationPanel adapter={jobs} compact initialTab="jobs" />
          </main>
        );
      }

      createRoot(document.getElementById("root")!).render(<App />);
    `
  );

  await build({
    entryPoints: [entryPath],
    outfile: bundlePath,
    bundle: true,
    absWorkingDir: root,
    nodePaths: [path.join(root, "node_modules")],
    platform: "browser",
    format: "iife",
    banner: {
      js: "var process = globalThis.process || { env: { NODE_ENV: 'production' }, browser: true, argv: [], platform: 'browser' }; globalThis.process = process;",
    },
    jsx: "transform",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
    loader: { ".tsx": "tsx", ".ts": "ts" },
    tsconfig: tsconfigPath,
    define: {
      global: "globalThis",
      "process.env.NODE_ENV": '"production"',
    },
    plugins: [browserShimPlugin],
  });
  return bundlePath;
}

async function verifyViewport(page, screenshotPath, label, errors) {
  try {
    await page.waitForSelector(
      "[data-harthmere-crafting-station-interface='true']"
    );
  } catch (error) {
    const body = await page
      .locator("body")
      .innerText()
      .catch(() => "");
    fail(
      `${label} crafting station UI did not mount. Browser errors: ${
        errors.join("\\n") || "none"
      }. Body: ${body || String(error)}`
    );
  }
  await page.waitForFunction(
    () =>
      document.querySelectorAll(
        "[data-harthmere-crafting-station-interface='true']"
      ).length === 3
  );
  const bodyText = await page.locator("body").innerText();
  for (const required of [
    "Workbench",
    "Thermoblaster",
    "Exotic Matter",
    "Storage Cabinet",
    "JOBS",
  ]) {
    if (!bodyText.includes(required)) {
      fail(`${label} did not show ${required}. Text: ${bodyText}`);
    }
  }
  const forbidden = /\b(debug|dummy|placeholder|todo|local player)\b/i;
  if (forbidden.test(bodyText)) {
    fail(`${label} showed developer or placeholder text: ${bodyText}`);
  }
  if (bodyText.includes("_") || /\bharthmere\b/i.test(bodyText)) {
    fail(`${label} leaked internal identifiers: ${bodyText}`);
  }
  if (/\b[a-z]+[A-Z][A-Za-z]*\b/.test(bodyText)) {
    fail(`${label} leaked camel case text: ${bodyText}`);
  }
  const overflowing = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("button, [role='gridcell']"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          text: (element.textContent || "").trim(),
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth,
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight,
          width: rect.width,
          height: rect.height,
        };
      })
      .filter(
        (entry) =>
          entry.scrollWidth > entry.clientWidth + 2 ||
          entry.scrollHeight > entry.clientHeight + 2 ||
          entry.width <= 0 ||
          entry.height <= 0
      );
  });
  if (overflowing.length > 0) {
    fail(`${label} had overflowing controls: ${JSON.stringify(overflowing)}`);
  }
  const buffer = await page.screenshot({
    path: screenshotPath,
    fullPage: true,
  });
  await assertScreenshotNonBlank(buffer, label);
}

(async () => {
  const tempDir = await mkdir(
    path.join(os.tmpdir(), "harthmere-crafting-visual-"),
    { recursive: true }
  ).then(() =>
    path.join(os.tmpdir(), `harthmere-crafting-visual-${Date.now()}`)
  );
  await mkdir(tempDir, { recursive: true });
  await mkdir(artifactDir, { recursive: true });
  const bundlePath = await buildHarness(tempDir);
  const html = `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>
          html, body {
            margin: 0;
            min-height: 100%;
            background: #111510;
            color: #f2eadb;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }
          #root { min-height: 100vh; }
          .crafting-visual-page {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
            padding: 14px;
            box-sizing: border-box;
          }
          .crafting-visual-page > :last-child {
            grid-column: 1 / -1;
          }
          @media (max-width: 720px) {
            .crafting-visual-page {
              grid-template-columns: minmax(0, 1fr);
              padding: 10px;
            }
            .crafting-visual-page > :last-child {
              grid-column: auto;
            }
          }
        </style>
      </head>
      <body><div id="root"></div></body>
    </html>
  `;

  const browser = await chromium.launch({ headless: true });
  try {
    const errors = [];
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1050 },
    });
    page.on("pageerror", (error) => errors.push(error.stack || error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.setContent(html);
    await page.addScriptTag({ content: await readFile(bundlePath, "utf8") });
    await verifyViewport(
      page,
      path.join(artifactDir, "crafting-station-desktop.png"),
      "desktop",
      errors
    );

    await page.setViewportSize({ width: 390, height: 900 });
    await verifyViewport(
      page,
      path.join(artifactDir, "crafting-station-mobile.png"),
      "mobile",
      errors
    );
    if (errors.length > 0) {
      fail(`browser emitted errors: ${errors.join("\\n")}`);
    }
    console.log(
      "PASS Harthmere crafting station visual snapshots are polished"
    );
    console.log(
      `desktop=${path.join(artifactDir, "crafting-station-desktop.png")}`
    );
    console.log(
      `mobile=${path.join(artifactDir, "crafting-station-mobile.png")}`
    );
  } finally {
    await browser.close();
    await rm(tempDir, { recursive: true, force: true });
  }
})().catch((error) => fail(error.stack || error.message));
