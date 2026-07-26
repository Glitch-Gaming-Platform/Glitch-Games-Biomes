import assert from "assert";
import { build } from "esbuild";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { chromium } from "playwright";

describe("InventoryTab browser actions", () => {
  it("consumes health and food items from inventory and restores HP and stamina", async () => {
    const tempDir = await mkdtemp(
      path.join(tmpdir(), "biomes-inventory-health-item-")
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
    const adapterPath = path
      .join(
        process.cwd(),
        "src/client/components/biomes_ui/adapters/nativeConsumptionAdapter.ts"
      )
      .replace(/\\/g, "/");

    await writeFile(
      entryPath,
      `
        import * as React from "react";
        import { createRoot } from "react-dom/client";
        import { InventoryTab } from "${componentPath}";
        import { nativeConsumablePresentationForBiomesUIForTest } from "${adapterPath}";

        const healthRef = { kind: "item", idx: 0 };
        const foodRef = { kind: "item", idx: 1 };
        const nativeHealthItem = {
          id: 8688497353431638,
          isConsumable: true,
          action: "drink",
        };
        const nativeFoodItem = {
          id: 8688497353431639,
          isConsumable: true,
          action: "eat",
        };
        const healthPresentation =
          nativeConsumablePresentationForBiomesUIForTest(nativeHealthItem);
        const foodPresentation =
          nativeConsumablePresentationForBiomesUIForTest(nativeFoodItem);
        let hp = 80;
        let stamina = 50;
        let hasHealthItem = true;
        let hasFoodItem = true;
        let refresh = () => {};

        const healthItem = {
          id: "health_potion",
          label: "Health Potion",
          icon: "+",
          count: 1,
          category: "consumables",
          ref: healthRef,
          source: "backpack",
          canUse: healthPresentation.canUse,
          useActionLabel: healthPresentation.useActionLabel,
        };
        const foodItem = {
          id: "road_ration",
          label: "Road Ration",
          icon: "R",
          count: 1,
          category: "consumables",
          ref: foodRef,
          source: "backpack",
          canUse: foodPresentation.canUse,
          useActionLabel: foodPresentation.useActionLabel,
        };

        const adapter = {
          getEquipment: () => [],
          getCurrencies: () => [],
          getBackpack: () => ({
            items: [
              hasHealthItem ? healthItem : null,
              hasFoodItem ? foodItem : null,
            ],
            maxSlots: 2,
            usedSlots: Number(hasHealthItem) + Number(hasFoodItem),
            capacityLabel: "Backpack",
          }),
          getHotbar: () => ({ items: [], selectedIndex: -1 }),
          getSelectedItem: () =>
            hasHealthItem ? healthItem : hasFoodItem ? foodItem : null,
          useItem: (usedRef) => {
            if (usedRef.kind === "item" && usedRef.idx === 0 && hasHealthItem) {
              hp = 100;
              hasHealthItem = false;
              refresh();
            } else if (
              usedRef.kind === "item" &&
              usedRef.idx === 1 &&
              hasFoodItem
            ) {
              stamina = 74;
              hasFoodItem = false;
              refresh();
            }
          },
        };

        function App() {
          const [, force] = React.useReducer((x) => x + 1, 0);
          refresh = force;
          return <>
            <output data-testid="health">{hp}</output>
            <output data-testid="stamina">{stamina}</output>
            <InventoryTab adapter={adapter} />
          </>;
        }

        createRoot(document.getElementById("root")).render(<App />);
      `
    );
    await writeFile(
      tsconfigPath,
      JSON.stringify({ compilerOptions: { jsx: "react" } })
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
        if (message.type() === "error") browserErrors.push(message.text());
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

      const drink = page.locator("[data-inventory-action='use']");
      await drink.waitFor({ timeout: 10_000 });
      assert.equal(await drink.textContent(), "Drink");
      assert.equal(
        await page.locator("[data-testid='health']").textContent(),
        "80"
      );

      await drink.click();

      assert.equal(
        await page.locator("[data-testid='health']").textContent(),
        "100"
      );
      assert.equal(await page.getByText("Health Potion").count(), 0);

      await page.waitForFunction(
        () =>
          document.querySelector("[data-inventory-action='use']")
            ?.textContent === "Eat"
      );
      const eat = page.locator("[data-inventory-action='use']");
      await eat.waitFor({ timeout: 10_000 });
      assert.equal(await eat.textContent(), "Eat");
      assert.equal(
        await page.locator("[data-testid='stamina']").textContent(),
        "50"
      );

      await eat.click();

      assert.equal(
        await page.locator("[data-testid='stamina']").textContent(),
        "74"
      );
      assert.equal(await page.getByText("Road Ration").count(), 0);
      assert.deepEqual(browserErrors, []);
    } finally {
      await browser.close();
      await rm(tempDir, { recursive: true, force: true });
    }
  }).timeout(45_000);

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
