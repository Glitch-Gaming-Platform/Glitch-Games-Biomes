/// <reference types="mocha" />

import assert from "assert";
import { humanizeBiomesInventoryItemIdV1 } from "@/client/components/biomes_ui/adapters/inventoryItemPresentation";
import { BikkieIds } from "@/shared/bikkie/ids";
import {
  harthmereBikkieWearableSlotsFromAssignmentV1,
  harthmereBikkieWearablesUseGeneratedBodyV1,
  harthmereBikkieWearablesUseGeneratedHeadV1,
  harthmereClothingSlotsHiddenByBikkieWearablesV1,
  harthmereLocalEquipmentBikkieWearablesV1,
} from "@/shared/harthmere/harthmere_bikkie_wearables_v1";

const memoryStore = new Map<string, string>();
const localStorageShim = {
  getItem: (key: string) =>
    memoryStore.has(key) ? memoryStore.get(key)! : null,
  setItem: (key: string, value: string) => {
    memoryStore.set(key, String(value));
  },
  removeItem: (key: string) => {
    memoryStore.delete(key);
  },
  clear: () => memoryStore.clear(),
};

(globalThis as any).window = {
  localStorage: localStorageShim,
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {},
};
(globalThis as any).localStorage = localStorageShim;
if (typeof (globalThis as any).Event === "undefined") {
  (globalThis as any).Event = class {
    type: string;
    constructor(type: string) {
      this.type = type;
    }
  };
}
if (typeof (globalThis as any).CustomEvent === "undefined") {
  (globalThis as any).CustomEvent = class {
    type: string;
    detail: unknown;
    constructor(type: string, init?: { detail?: unknown }) {
      this.type = type;
      this.detail = init?.detail;
    }
  };
}

import {
  getHarthmereItemDisplayV1,
  grantHarthmereItem,
  harthmereInventoryCountByItemIdV141,
  performHarthmereBackpackItemEquipForBiomesUI,
  performHarthmereBackpackItemUseForBiomesUI,
  performHarthmereEquipmentItemUnequipForBiomesUI,
  performHarthmereHotbarAssignForBiomesUI,
  performHarthmereMaterialStorageRemoveForBiomesUI,
  readHarthmereInventoryState,
} from "@/client/components/challenges/LocalDevHarthmereInventorySystem";

describe("Harthmere inventory BiomesUI presentation and actions", () => {
  beforeEach(() => {
    (globalThis as any).window = {
      localStorage: localStorageShim,
      dispatchEvent: () => true,
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    (globalThis as any).localStorage = localStorageShim;
    memoryStore.clear();
  });

  it("exposes human-readable local item names and distinct icons", () => {
    const apron = getHarthmereItemDisplayV1("baker_apron");
    const trousers = getHarthmereItemDisplayV1("field_trousers");
    assert.equal(apron?.name, "Dawn Loaf Apron");
    assert.equal(apron?.slot, "chest");
    assert.equal(apron?.icon, "🥼");
    assert.equal(apron?.bikkieWearableSlot, Number(BikkieIds.top));
    assert.equal(apron?.bikkieWearableItemId, Number(BikkieIds.grassyTop));
    assert.equal(trousers?.name, "Grove Field Trousers");
    assert.equal(trousers?.slot, "legs");
    assert.equal(trousers?.icon, "👖");
    assert.equal(trousers?.bikkieWearableSlot, Number(BikkieIds.bottoms));
    assert.equal(trousers?.bikkieWearableItemId, Number(BikkieIds.bellBottoms));
    assert.notEqual(apron?.icon, trousers?.icon);
    assert.notEqual(apron?.icon, "▣");
    assert.notEqual(trousers?.icon, "▥");
    assert.equal(
      humanizeBiomesInventoryItemIdV1("bakerApron", "bakerApron"),
      "Baker Apron"
    );
  });

  it("equips and unequips local clothing through the BiomesUI action bridge", () => {
    grantHarthmereItem("baker_apron", 1, "test clothing");
    const apron = readHarthmereInventoryState().backpack.items.find(
      (item) => item.itemId === "baker_apron"
    );
    assert.ok(apron);

    performHarthmereBackpackItemEquipForBiomesUI(apron.instanceId);
    let state = readHarthmereInventoryState();
    assert.equal(state.equipment.chest?.itemId, "baker_apron");
    assert.equal(harthmereInventoryCountByItemIdV141("baker_apron"), 0);
    assert.equal(
      state.backpack.items.some((item) => item.itemId === "baker_apron"),
      false
    );

    performHarthmereEquipmentItemUnequipForBiomesUI("chest");
    state = readHarthmereInventoryState();
    assert.equal(state.equipment.chest, undefined);
    assert.equal(
      state.backpack.items.some((item) => item.itemId === "baker_apron"),
      true
    );
  });

  it("maps equipped Harthmere and Bikkie clothes to visible avatar slots", () => {
    assert.deepEqual(
      harthmereLocalEquipmentBikkieWearablesV1({
        chest: { itemId: "baker_apron" },
        legs: "field_trousers",
        back: { itemId: "patched_cloak" },
        main_hand: { itemId: "iron_longsword" },
      }),
      [
        { slot: BikkieIds.top, itemId: BikkieIds.grassyTop },
        { slot: BikkieIds.bottoms, itemId: BikkieIds.bellBottoms },
        { slot: BikkieIds.outerwear, itemId: BikkieIds.poncho },
      ]
    );

    const slots = harthmereBikkieWearableSlotsFromAssignmentV1(
      new Map([
        [BikkieIds.top, { id: BikkieIds.grassyTop }],
        [BikkieIds.bottoms, { id: BikkieIds.bellBottoms }],
        [BikkieIds.hat, { id: BikkieIds.flowerCrown }],
      ])
    );

    assert.equal(harthmereBikkieWearablesUseGeneratedBodyV1(slots), true);
    assert.equal(harthmereBikkieWearablesUseGeneratedHeadV1(slots), true);
    assert.deepEqual(
      [...harthmereClothingSlotsHiddenByBikkieWearablesV1(slots)].sort(),
      ["belt", "hair", "head", "legs", "torso"]
    );
  });

  it("uses local consumables instead of only selecting them", () => {
    const scroll = readHarthmereInventoryState().backpack.items.find(
      (item) => item.itemId === "field_revival_scroll"
    );
    assert.ok(scroll);
    assert.equal(
      harthmereInventoryCountByItemIdV141("field_revival_scroll"),
      1
    );

    performHarthmereBackpackItemUseForBiomesUI(
      scroll.instanceId,
      "field_revival_scroll"
    );

    assert.equal(
      harthmereInventoryCountByItemIdV141("field_revival_scroll"),
      0
    );
    assert.equal(readHarthmereInventoryState().recent[0]?.action, "Item Used");
  });

  it("assigns material storage shortcuts to the local hotbar without backpack transfer", () => {
    grantHarthmereItem("iron_ore", 3, "test material");
    assert.equal(readHarthmereInventoryState().materialStorage.iron_ore, 3);

    assert.equal(performHarthmereHotbarAssignForBiomesUI("iron_ore", 2), true);
    let state = readHarthmereInventoryState();
    assert.equal(state.hotbar.slot_3, "iron_ore");
    assert.equal(state.materialStorage.iron_ore, 3);
    assert.equal(
      state.backpack.items.some((item) => item.itemId === "iron_ore"),
      false
    );

    assert.equal(
      performHarthmereMaterialStorageRemoveForBiomesUI("iron_ore", 2),
      2
    );
    state = readHarthmereInventoryState();
    assert.equal(state.materialStorage.iron_ore, 1);
  });
});
