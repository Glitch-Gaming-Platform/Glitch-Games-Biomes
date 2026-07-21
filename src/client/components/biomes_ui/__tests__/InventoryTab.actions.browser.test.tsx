import assert from "assert";
import { build } from "esbuild";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { chromium } from "playwright";

describe("InventoryTab browser actions", () => {
  it("wires Use/Select, Equip, Unequip, Hotbar, Split, Drop, and Destroy to the inventory adapter", async () => {
    const tempDir = await mkdtemp(
      path.join(tmpdir(), "biomes-inventory-actions-")
    );
    const entryPath = path.join(tempDir, "entry.tsx");
    const bundlePath = path.join(tempDir, "bundle.js");
    const tsconfigPath = path.join(tempDir, "tsconfig.json");
    const componentPath = path
      .join(
        process.cwd(),
        "src/client/components/biomes_ui/tabs/InventoryTab.tsx"
      )
      .replace(/\\/g, "/");

    await writeFile(
      entryPath,
      `
        import * as React from "react";
        import { createRoot } from "react-dom/client";
        import { InventoryTab } from "${componentPath}";

        const selectedRef = { kind: "item", idx: 0 };
        const selectedItem = {
          id: "travel_top",
          label: "Travel Top",
          icon: "T",
          count: 4,
          category: "gear",
          equipSlot: "chest",
          ref: selectedRef,
          source: "equipment",
          canUse: true,
          canEquip: true,
          canUnequip: true,
          canMove: true,
          hotbarEligible: true,
          canSplit: true,
          canDrop: true,
          canDestroy: true,
        };
        let revisionItem = {
          id: "inventory_revision",
          label: "Inventory Revision",
          count: 1,
          ref: { kind: "hotbar", idx: 9 },
          source: "hotbar",
        };

        window.__inventoryEvents = [];
        let forceInventoryRefresh = () => {};
        const record = (kind, payload) => {
          window.__inventoryEvents.push({ kind, payload });
          revisionItem = { ...revisionItem, count: revisionItem.count + 1 };
          forceInventoryRefresh();
        };
        const adapter = {
          getEquipment: () => [],
          getCurrencies: () => [],
          getBackpack: () => ({
            items: [selectedItem, null, null, null],
            maxSlots: 8,
            usedSlots: 1,
            capacityLabel: "Backpack",
          }),
          getHotbar: () => ({ items: [revisionItem], selectedIndex: -1 }),
          getSelectedItem: () => selectedItem,
          useItem: (ref) => record("use", { ref }),
          equipItem: (ref, slot) => record("equip", { ref, slot }),
          unequipItem: (ref) => record("unequip", { ref }),
          moveItem: (src, dst) => record("move", { src, dst }),
          splitStack: (src, dst, count) => record("split", { src, dst, count }),
          dropItem: (ref, count) => record("drop", { ref, count: count ?? "all" }),
          destroyItem: (ref, count) => record("destroy", { ref, count }),
        };

        function App() {
          const [, force] = React.useReducer((x) => x + 1, 0);
          forceInventoryRefresh = force;
          return <InventoryTab adapter={adapter} />;
        }

        createRoot(document.getElementById("root")).render(<App />);
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
      const page = await browser.newPage({
        viewport: { width: 1200, height: 800 },
      });
      const browserErrors: string[] = [];
      page.on("pageerror", (error) =>
        browserErrors.push(error.stack ?? error.message)
      );
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
              #root { width: 1180px; min-height: 760px; padding: 12px; }
            </style>
          </head>
          <body><div id="root"></div></body>
        </html>
      `);
      await page.addScriptTag({ content: await readFile(bundlePath, "utf8") });
      await page
        .locator("[data-inventory-action='use']")
        .waitFor({ timeout: 10_000 });
      assert.deepEqual(browserErrors, []);

      for (const action of [
        "use",
        "equip",
        "unequip",
        "move-hotbar",
        "split",
        "drop-one",
        "drop-all",
        "destroy",
      ]) {
        await page.locator(`[data-inventory-action='${action}']`).click();
      }

      const events = await page.evaluate(
        () => (window as any).__inventoryEvents
      );
      assert.deepEqual(events, [
        { kind: "use", payload: { ref: { kind: "item", idx: 0 } } },
        {
          kind: "equip",
          payload: { ref: { kind: "item", idx: 0 }, slot: "chest" },
        },
        { kind: "unequip", payload: { ref: { kind: "item", idx: 0 } } },
        {
          kind: "move",
          payload: {
            src: { kind: "item", idx: 0 },
            dst: { kind: "hotbar", idx: 0 },
          },
        },
        {
          kind: "split",
          payload: {
            src: { kind: "item", idx: 0 },
            dst: { kind: "item", idx: 1 },
            count: 2,
          },
        },
        { kind: "drop", payload: { ref: { kind: "item", idx: 0 }, count: 1 } },
        {
          kind: "drop",
          payload: { ref: { kind: "item", idx: 0 }, count: "all" },
        },
        {
          kind: "destroy",
          payload: { ref: { kind: "item", idx: 0 }, count: 1 },
        },
      ]);
    } finally {
      await browser.close();
      await rm(tempDir, { recursive: true, force: true });
    }
  }).timeout(45_000);
});
