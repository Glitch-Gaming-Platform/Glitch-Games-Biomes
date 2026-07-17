/// <reference types="mocha" />

import assert from "assert";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BIOMES_INVENTORY_DRAG_MIME,
  BIOMES_INVENTORY_HOTBAR_SLOT_COUNT,
  InventoryTab,
  canMoveInventoryItemToHotbar,
  parseInventoryDragRef,
  readInventoryDragRefFromTransfer,
  resolveInventoryHotbarDrop,
  serializeInventoryDragRef,
  writeInventoryDragRefToTransfer,
} from "../tabs/InventoryTab";

class FakeDataTransfer {
  readonly data = new Map<string, string>();
  effectAllowed: DataTransfer["effectAllowed"] = "uninitialized";
  dropEffect: DataTransfer["dropEffect"] = "none";

  getData(type: string) {
    return this.data.get(type) ?? "";
  }

  setData(type: string, value: string) {
    this.data.set(type, value);
  }
}

describe("Biomes UI inventory hotbar drag and drop", () => {
  it("serializes inventory refs through the drag data transfer", () => {
    const transfer = new FakeDataTransfer();
    const ref = { kind: "item" as const, idx: 7, key: "harthmere:abc" };

    writeInventoryDragRefToTransfer(transfer, ref);

    assert.equal(transfer.effectAllowed, "move");
    assert.equal(
      transfer.getData(BIOMES_INVENTORY_DRAG_MIME),
      serializeInventoryDragRef(ref)
    );
    assert.deepEqual(readInventoryDragRefFromTransfer(transfer), ref);
    assert.deepEqual(
      parseInventoryDragRef(
        `biomes-inventory-ref:${serializeInventoryDragRef(ref)}`
      ),
      ref
    );
  });

  it("only resolves movable backpack or hotbar refs into hotbar slots", () => {
    assert.equal(canMoveInventoryItemToHotbar(null), false);
    assert.equal(
      canMoveInventoryItemToHotbar({
        id: "gold",
        label: "Gold",
        icon: "◉",
        ref: { kind: "currency", key: "gold" },
      }),
      false
    );
    assert.equal(
      canMoveInventoryItemToHotbar({
        id: "rough_stone",
        label: "Rough Stone",
        icon: "□",
        ref: { kind: "material", key: "rough_stone" },
      }),
      false
    );
    assert.equal(
      canMoveInventoryItemToHotbar({
        id: "tutorial_apron",
        label: "Tutorial Apron",
        icon: "🥼",
        ref: { kind: "item", idx: 2 },
        canMove: false,
      }),
      false
    );
    assert.equal(
      canMoveInventoryItemToHotbar({
        id: "muckwad",
        label: "Muckwad",
        icon: "◼",
        ref: { kind: "item", idx: 2 },
        hotbarEligible: true,
      }),
      true
    );
    assert.deepEqual(resolveInventoryHotbarDrop({ kind: "item", idx: 2 }, 4), {
      src: { kind: "item", idx: 2 },
      dst: { kind: "hotbar", idx: 4 },
    });
    assert.deepEqual(
      resolveInventoryHotbarDrop({ kind: "hotbar", idx: 2 }, 4),
      {
        src: { kind: "hotbar", idx: 2 },
        dst: { kind: "hotbar", idx: 4 },
      }
    );
    assert.deepEqual(
      resolveInventoryHotbarDrop({ kind: "material", key: "rough_stone" }, 3),
      {
        src: { kind: "material", key: "rough_stone" },
        dst: { kind: "hotbar", idx: 3 },
      }
    );
    assert.equal(
      resolveInventoryHotbarDrop({ kind: "hotbar", idx: 4 }, 4),
      undefined
    );
    assert.equal(
      resolveInventoryHotbarDrop({ kind: "wearable", key: "chest" }, 0),
      undefined
    );
    assert.equal(
      resolveInventoryHotbarDrop({ kind: "item", idx: 2 }, -1),
      undefined
    );
    assert.equal(
      resolveInventoryHotbarDrop(
        { kind: "item", idx: 2 },
        BIOMES_INVENTORY_HOTBAR_SLOT_COUNT
      ),
      undefined
    );
  });

  it("renders draggable inventory slots and explicit hotbar drop targets", () => {
    const html = renderToStaticMarkup(
      <InventoryTab
        adapter={{
          getEquipment: () => [],
          getCurrencies: () => [],
          getBackpack: () => ({
            items: [
              {
                id: "muckwad",
                label: "Muckwad",
                icon: "◼",
                count: 6,
                category: "materials",
                ref: { kind: "item", idx: 0 },
                source: "backpack",
                hotbarEligible: true,
              },
            ],
            maxSlots: 1,
            usedSlots: 1,
            materialStorage: {
              items: [
                {
                  id: "audit_ingot",
                  label: "Audit Ingot",
                  icon: "I",
                  count: 12,
                  category: "materials",
                  ref: { kind: "material", key: "audit_ingot" },
                  source: "material_storage",
                  storageLocation: "material_storage",
                },
              ],
              maxSlots: 32,
              usedSlots: 1,
            },
          }),
          getHotbar: () => ({
            items: [
              {
                id: "hotbar_snack",
                label: "Hotbar Snack",
                icon: "S",
                count: 2,
                category: "consumables",
                ref: { kind: "hotbar", idx: 0 },
                source: "hotbar",
              },
              ...Array.from(
                { length: BIOMES_INVENTORY_HOTBAR_SLOT_COUNT - 1 },
                () => null
              ),
            ],
            selectedIndex: -1,
          }),
          moveItem: () => {},
        }}
      />
    );

    assert.ok(html.includes('data-inventory-draggable="true"'));
    assert.ok(html.includes('draggable="true"'));
    assert.ok(html.includes('data-hotbar-drop-target="true"'));
    assert.ok(html.includes('data-hotbar-drop-index="0"'));
    assert.ok(html.includes('data-hotbar-drop-enabled="true"'));
    assert.ok(html.includes("Hotbar Snack"));
    assert.ok(html.includes("Audit Ingot"));
    assert.ok(html.includes("Material Storage"));
    assert.ok(html.includes('data-inventory-draggable="true"'));
    assert.ok(html.includes('title="Muckwad x6"'));
    assert.ok(html.includes('data-inventory-tooltip="Muckwad x6"'));
    assert.ok(html.includes('title="Hotbar 1: Hotbar Snack x2"'));
    assert.ok(html.includes('data-inventory-tooltip="Hotbar Snack x2"'));
    assert.ok(html.includes('title="Audit Ingot x12"'));
    assert.ok(html.includes('data-inventory-tooltip="Audit Ingot x12"'));
  });
});
