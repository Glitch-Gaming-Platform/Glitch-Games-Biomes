import assert from "assert";
import { build } from "esbuild";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { chromium } from "playwright";

describe("MapQuestsTab browser interactions", () => {
  // Skipped until the repo's standalone browser bundling harness can mount the
  // React tab reliably under ts-mocha. The non-browser map tests still cover
  // static rendering, tab classification, centering math, terrain swatches, and
  // wheel zoom bounds.
  it.skip("supports zoom controls, drag pan, center-player, quest centering, and tab switching", async function () {
    this.timeout(45_000);

    const tempDir = await mkdtemp(path.join(tmpdir(), "biomes-map-ux-"));
    const entryPath = path.join(tempDir, "entry.tsx");
    const bundlePath = path.join(tempDir, "bundle.js");
    const tsconfigPath = path.join(tempDir, "tsconfig.json");
    const componentPath = path
      .join(process.cwd(), "src/client/components/biomes_ui/tabs/MapQuestsTab.tsx")
      .replace(/\\/g, "/");

    await writeFile(
      entryPath,
      `
        import * as React from "react";
        import { createRoot } from "react-dom/client";
        import { MapQuestsTab } from "${componentPath}";

        const adapter = {
          getMissionTitle: () => "Road Work",
          getMissionSteps: () => [
            { id: "step_1", title: "Current step 1", objective: "Find the board.", done: false },
          ],
          getPlayerMarker: () => ({
            id: "local_player",
            label: "You",
            x: 0.8,
            y: 0.2,
            kind: "player",
            worldPosition: [520, 70, -120],
          }),
          getMarkers: () => [
            {
              id: "quest_board",
              label: "Grove Jobs Board",
              x: 0.75,
              y: 0.25,
              kind: "quest",
              active: true,
              worldPosition: [518, 70, -122],
            },
            {
              id: "jackie",
              label: "Jackie",
              x: 0.7,
              y: 0.2,
              kind: "vendor",
              worldPosition: [516, 70, -120],
            },
            {
              id: "gus_oven",
              label: "Gus's Oven",
              x: 0.72,
              y: 0.26,
              kind: "store",
              worldPosition: [524, 70, -126],
            },
            {
              id: "muck_patch",
              label: "Muckwad Patch",
              x: 0.3,
              y: 0.7,
              kind: "danger",
              description: "muck edge",
              worldPosition: [470, 70, -90],
            },
          ],
          getTrackableQuests: () => [{
            questId: "road_work",
            title: "Road Work",
            area: "The Grove",
            status: "available",
            firstMarkerId: "quest_board",
          }],
        };

        createRoot(document.getElementById("root")!).render(
          <MapQuestsTab adapter={adapter as any} />
        );
      `
    );
    await writeFile(
      tsconfigPath,
      JSON.stringify({
        compilerOptions: {
          jsx: "react",
        },
      })
    );

    await build({
      entryPoints: [entryPath],
      outfile: bundlePath,
      bundle: true,
      absWorkingDir: process.cwd(),
      nodePaths: [path.join(process.cwd(), "node_modules")],
      platform: "browser",
      format: "iife",
      jsx: "transform",
      jsxFactory: "React.createElement",
      jsxFragment: "React.Fragment",
      loader: { ".tsx": "tsx", ".ts": "ts" },
      tsconfig: tsconfigPath,
    });

    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
      const browserErrors: string[] = [];
      page.on("pageerror", (error) => browserErrors.push(error.stack ?? error.message));
      page.on("console", (message) => {
        if (message.type() === "error") {
          browserErrors.push(message.text());
        }
      });
      await page.setContent(`
        <html>
          <head>
            <style>
              body { margin: 0; background: #07101d; color: #e5eefb; font-family: sans-serif; }
              #root { width: 1180px; height: 760px; padding: 12px; }
            </style>
          </head>
          <body><div id="root"></div></body>
        </html>
      `);
      await page.addScriptTag({ content: await readFile(bundlePath, "utf8") });
      const canvas = page.locator("[aria-label='Live world map']");
      try {
        await canvas.waitFor({ timeout: 10_000 });
      } catch (error) {
        assert.fail(
          `Map tab did not mount in browser. Browser errors: ${
            browserErrors.join("\n") || String(error)
          }`
        );
      }

      const zoom = page.locator("span[aria-label^='Map zoom']");
      await zoom.waitFor();
      const zoomBefore = await zoom.textContent();
      await page.getByRole("button", { name: "Zoom map in" }).click();
      await page.waitForTimeout(100);
      assert.notEqual(await zoom.textContent(), zoomBefore);

      const questMarker = page.locator("button[data-marker='quest_board']");
      const markerBeforeDrag = await questMarker.boundingBox();
      assert.ok(markerBeforeDrag, "Expected quest marker before drag");
      const canvasBox = await canvas.boundingBox();
      assert.ok(canvasBox, "Expected map canvas bounds");
      await page.mouse.move(canvasBox.x + 150, canvasBox.y + 150);
      await page.mouse.down();
      await page.mouse.move(canvasBox.x + 330, canvasBox.y + 220);
      await page.mouse.up();
      const markerAfterDrag = await questMarker.boundingBox();
      assert.ok(markerAfterDrag, "Expected quest marker after drag");
      assert.notEqual(Math.round(markerAfterDrag.x), Math.round(markerBeforeDrag.x));

      await page.getByRole("button", { name: /Center Player/ }).click();
      await page.waitForFunction(() => {
        const marker = document.querySelector("button[data-marker='local_player']") as HTMLElement | null;
        return marker?.style.left === "50%" && marker?.style.top === "50%";
      });

      const questButton = page.locator("[data-testid='biomes-map-quest-road_work']");
      assert.equal(await questButton.getAttribute("aria-pressed"), "false");
      await questButton.click();
      await page.waitForFunction(() => {
        const button = document.querySelector("[data-testid='biomes-map-quest-road_work']");
        return button?.getAttribute("aria-pressed") === "true";
      });

      await page.getByRole("button", { name: "People" }).click();
      await page.waitForSelector("[aria-label='people map panel']");
      assert.ok((await page.textContent("body"))?.includes("Jackie"));

      await page.getByRole("button", { name: "Buildings" }).click();
      await page.waitForSelector("[aria-label='buildings map panel']");
      assert.ok((await page.textContent("body"))?.includes("Gus's Oven"));

      await page.getByRole("button", { name: "Geography" }).click();
      await page.waitForSelector("[data-testid='biomes-map-geography-terrain-layer']");
      const bodyText = await page.textContent("body");
      assert.ok(bodyText?.includes("Muckwad Patch"));
    } finally {
      await browser.close();
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
