/// <reference types="mocha" />

import assert from "assert";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BIOMES_INVENTORY_DRAG_MIME_V1,
  BIOMES_INVENTORY_HOTBAR_SLOT_COUNT_V1,
  InventoryTab,
  canMoveInventoryItemToHotbarV1,
  parseInventoryDragRefV1,
  readInventoryDragRefFromTransferV1,
  resolveInventoryHotbarDropV1,
  serializeInventoryDragRefV1,
  writeInventoryDragRefToTransferV1,
} from "../tabs/InventoryTab";

class FakeDataTransfer {
  readonly data = new Map<string, string>();
  effectAllowed = "";
  dropEffect = "";

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

    writeInventoryDragRefToTransferV1(transfer, ref);

    assert.equal(transfer.effectAllowed, "move");
    assert.equal(
      transfer.getData(BIOMES_INVENTORY_DRAG_MIME_V1),
      serializeInventoryDragRefV1(ref)
    );
    assert.deepEqual(readInventoryDragRefFromTransferV1(transfer), ref);
    assert.deepEqual(
      parseInventoryDragRefV1(
        `biomes-inventory-ref:${serializeInventoryDragRefV1(ref)}`
      ),
      ref
    );
  });

  it("only resolves movable backpack or hotbar refs into hotbar slots", () => {
    assert.equal(canMoveInventoryItemToHotbarV1(null), false);
    assert.equal(
      canMoveInventoryItemToHotbarV1({
        id: "gold",
        label: "Gold",
        icon: "◉",
        ref: { kind: "currency", key: "gold" },
      }),
      false
    );
    assert.equal(
      canMoveInventoryItemToHotbarV1({
        id: "rough_stone",
        label: "Rough Stone",
        icon: "□",
        ref: { kind: "material", key: "rough_stone" },
      }),
      true
    );
    assert.equal(
      canMoveInventoryItemToHotbarV1({
        id: "tutorial_apron",
        label: "Tutorial Apron",
        icon: "🥼",
        ref: { kind: "item", idx: 2 },
        canMove: false,
      }),
      false
    );
    assert.equal(
      canMoveInventoryItemToHotbarV1({
        id: "muckwad",
        label: "Muckwad",
        icon: "◼",
        ref: { kind: "item", idx: 2 },
      }),
      true
    );
    assert.deepEqual(
      resolveInventoryHotbarDropV1({ kind: "item", idx: 2 }, 4),
      {
        src: { kind: "item", idx: 2 },
        dst: { kind: "hotbar", idx: 4 },
      }
    );
    assert.deepEqual(
      resolveInventoryHotbarDropV1({ kind: "hotbar", idx: 2 }, 4),
      {
        src: { kind: "hotbar", idx: 2 },
        dst: { kind: "hotbar", idx: 4 },
      }
    );
    assert.deepEqual(
      resolveInventoryHotbarDropV1({ kind: "material", key: "rough_stone" }, 3),
      {
        src: { kind: "material", key: "rough_stone" },
        dst: { kind: "hotbar", idx: 3 },
      }
    );
    assert.equal(
      resolveInventoryHotbarDropV1({ kind: "hotbar", idx: 4 }, 4),
      undefined
    );
    assert.equal(
      resolveInventoryHotbarDropV1({ kind: "wearable", key: "chest" }, 0),
      undefined
    );
    assert.equal(
      resolveInventoryHotbarDropV1({ kind: "item", idx: 2 }, -1),
      undefined
    );
    assert.equal(
      resolveInventoryHotbarDropV1(
        { kind: "item", idx: 2 },
        BIOMES_INVENTORY_HOTBAR_SLOT_COUNT_V1
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
                { length: BIOMES_INVENTORY_HOTBAR_SLOT_COUNT_V1 - 1 },
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
