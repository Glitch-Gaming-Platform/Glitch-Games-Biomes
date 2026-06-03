/// <reference types="mocha" />

import assert from "assert";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "esbuild";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { chromium } from "playwright";
import { BankingTab } from "../tabs/BankingTab";
import { InventoryTab, type InventoryUiItem } from "../tabs/InventoryTab";

const FORBIDDEN_COPY = [
  "audit_quest_badge",
  "request_",
  "server_authoritative",
  "payload",
  "undefined",
  "NaN",
];

function visibleText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function gearItem(overrides: Partial<InventoryUiItem> = {}): InventoryUiItem {
  return {
    id: "travel_top",
    label: "Travel Top",
    icon: "T",
    count: 1,
    category: "gear",
    equipSlot: "chest",
    ref: { kind: "item", idx: 0 },
    source: "backpack",
    storageLocation: "backpack",
    canUse: true,
    canEquip: true,
    canMove: true,
    canSplit: false,
    canDrop: true,
    canDestroy: true,
    ...overrides,
  };
}

describe("InventoryTab full stack frontend and SSR audit", () => {
  it("SSR-renders backpack, equipment, currencies, hotbar, storage, overflow, and protected item states with player-facing copy", () => {
    const questItem = gearItem({
      id: "quest_badge",
      label: "Quest Badge",
      icon: "Q",
      category: "quest",
      equipSlot: undefined,
      count: 1,
      ref: { kind: "item", idx: 1 },
      canUse: true,
      canEquip: false,
      canMove: true,
      canSplit: false,
      canDrop: false,
      canDestroy: false,
      protectedReason: "Quest items stay with your quest pouch.",
    });
    const html = renderToStaticMarkup(
      <InventoryTab
        adapter={{
          getEquipment: () => ({
            chest: gearItem({
              id: "worn_jacket",
              label: "Worn Jacket",
              ref: { kind: "wearable", key: "chest" },
            }),
          }),
          getCurrencies: () => [
            { id: "gold", name: "Gold", amount: 77, icon: "G" },
          ],
          getBackpack: () => ({
            items: [
              gearItem(),
              questItem,
              null,
              gearItem({
                id: "audit_ore",
                label: "Audit Ore",
                icon: "O",
                category: "materials",
                count: 4,
                ref: { kind: "item", idx: 3 },
                canSplit: true,
              }),
            ],
            maxSlots: 8,
            usedSlots: 3,
            capacityLabel: "Backpack",
            weight: { current: 12, max: 40, overLimit: false },
            materialStorage: {
              items: [
                gearItem({
                  id: "audit_ingot",
                  label: "Audit Ingot",
                  icon: "I",
                  category: "materials",
                  count: 2,
                  ref: { kind: "item", idx: 9 },
                }),
              ],
              maxSlots: 12,
              usedSlots: 1,
            },
            overflow: [
              gearItem({
                id: "overflow_badge",
                label: "Overflow Badge",
                icon: "!",
                category: "quest",
                count: 1,
                ref: { kind: "item", idx: 10 },
              }),
            ],
          }),
          getHotbar: () => ({
            items: [gearItem({ label: "Hotbar Snack", icon: "S" })],
            selectedIndex: 0,
          }),
          getSelectedItem: () => questItem,
        }}
      />
    );
    const text = visibleText(html);

    assert.match(text, /Equipped/);
    assert.match(text, /Worn Jacket/);
    assert.match(text, /Gold/);
    assert.match(text, /Backpack/);
    assert.match(text, /Hotbar Snack/);
    assert.match(text, /Material Storage/);
    assert.match(text, /Audit Ingot/);
    assert.match(text, /Overflow Badge/);
    assert.match(text, /Quest items stay with your quest pouch/);
    for (const token of FORBIDDEN_COPY) {
      assert.equal(
        text.includes(token),
        false,
        `inventory UI leaked internal copy: ${token}`
      );
    }
  });

  it("SSR-renders banking vault inventory with image and glyph icons without leaking raw asset URLs", () => {
    const html = renderToStaticMarkup(
      <BankingTab
        adapter={{
          isHydrated: () => true,
          getCurrencies: () => [
            { id: "gold", name: "Gold", amount: 77, icon: "G" },
          ],
          getDepositCandidates: () => [
            {
              id: "travel_top",
              name: "Travel Top",
              icon: "/buckets/biomes-static/assets/example-top.png",
              quantity: 1,
              category: "gear",
            },
          ],
          getVault: () => ({
            maxSlots: 2,
            usedSlots: 1,
            items: [
              {
                id: "audit_ingot",
                name: "Audit Ingot",
                icon: "I",
                quantity: 2,
              },
              null,
            ],
          }),
          getLoans: () => [],
          getLogs: () => [],
        }}
      />
    );
    const text = visibleText(html);

    assert.match(text, /Balances/);
    assert.match(text, /Backpack/);
    assert.match(text, /Travel Top/);
    assert.match(text, /Audit Ingot/);
    assert.match(text, /Personal Vault/);
    assert.match(html, /data-banking-icon-kind="image"/);
    assert.match(html, /data-banking-icon-kind="glyph"/);
    assert.equal(
      text.includes("/buckets/biomes-static/assets/example-top.png"),
      false,
      "banking UI should render image assets instead of printing raw URLs"
    );
  });

  it("browser-wires enabled item actions and suppresses protected item drop/destroy/equip clicks", async function () {
    this.timeout(45_000);

    const tempDir = await mkdtemp(
      path.join(tmpdir(), "biomes-inventory-full-stack-")
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

        const enabledRef = { kind: "item", idx: 0 };
        const protectedRef = { kind: "item", idx: 1 };
        const enabledItem = {
          id: "travel_top",
          label: "Travel Top",
          icon: "T",
          count: 4,
          category: "gear",
          equipSlot: "chest",
          ref: enabledRef,
          source: "backpack",
          canUse: true,
          canEquip: true,
          canMove: true,
          canSplit: true,
          canDrop: true,
          canDestroy: true,
        };
        const protectedItem = {
          id: "quest_badge",
          label: "Quest Badge",
          icon: "Q",
          count: 1,
          category: "quest",
          ref: protectedRef,
          source: "backpack",
          canUse: true,
          canEquip: false,
          canMove: true,
          canSplit: false,
          canDrop: false,
          canDestroy: false,
          protectedReason: "Quest items stay with your quest pouch.",
        };

        window.__inventoryEvents = [];
        const record = (kind, payload) => window.__inventoryEvents.push({ kind, payload });
        let selected = enabledItem;
        const adapter = {
          getEquipment: () => [],
          getCurrencies: () => [{ id: "gold", name: "Gold", amount: 77, icon: "G" }],
          getBackpack: () => ({
            items: [enabledItem, protectedItem, null, null],
            maxSlots: 8,
            usedSlots: 2,
            capacityLabel: "Backpack",
          }),
          getHotbar: () => ({ items: [enabledItem], selectedIndex: 0 }),
          getSelectedItem: () => selected,
          selectItem: (ref) => {
            selected = ref.idx === 1 ? protectedItem : enabledItem;
            record("select", { ref });
          },
          useItem: (ref) => record("use", { ref }),
          equipItem: (ref, slot) => record("equip", { ref, slot }),
          moveItem: (src, dst) => record("move", { src, dst }),
          splitStack: (src, dst, count) => record("split", { src, dst, count }),
          dropItem: (ref, count) => record("drop", { ref, count: count ?? "all" }),
          destroyItem: (ref, count) => record("destroy", { ref, count }),
        };

        function App() {
          const [, force] = React.useReducer((x) => x + 1, 0);
          const wrapped = {
            ...adapter,
            selectItem: (ref) => {
              adapter.selectItem(ref);
              force();
            },
          };
          return <InventoryTab adapter={wrapped} />;
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
      await page.locator("[data-inventory-action='use']").waitFor();
      assert.deepEqual(browserErrors, []);

      for (const action of [
        "use",
        "equip",
        "move-hotbar",
        "split",
        "drop-one",
        "drop-all",
        "destroy",
      ]) {
        await page.locator(`[data-inventory-action='${action}']`).click();
      }
      await page.locator("[data-inventory-ref='item:1']").click();
      await page.locator("[data-inventory-action='use']").click();
      await page.locator("[data-inventory-action='move-hotbar']").click();

      for (const action of ["equip", "split", "drop-one", "drop-all", "destroy"]) {
        assert.equal(
          await page.locator(`[data-inventory-action='${action}']`).isDisabled(),
          true,
          `${action} should be disabled for protected quest item`
        );
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
            dst: { kind: "item", idx: 2 },
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
        { kind: "select", payload: { ref: { kind: "item", idx: 1 } } },
        { kind: "use", payload: { ref: { kind: "item", idx: 1 } } },
        {
          kind: "move",
          payload: {
            src: { kind: "item", idx: 1 },
            dst: { kind: "hotbar", idx: 0 },
          },
        },
      ]);
    } finally {
      await browser.close();
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
