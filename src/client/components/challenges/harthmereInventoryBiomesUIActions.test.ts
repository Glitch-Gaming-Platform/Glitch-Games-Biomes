/// <reference types="mocha" />

import assert from "assert";
import {
  biomesInventoryItemIcon,
  humanizeBiomesInventoryItemId,
} from "@/client/components/biomes_ui/adapters/inventoryItemPresentation";
import { BikkieIds } from "@/shared/bikkie/ids";
import {
  harthmereBikkieWearableSlotsFromAssignment,
  harthmereBikkieWearablesUseGeneratedBody,
  harthmereBikkieWearablesUseGeneratedHead,
  harthmereClothingSlotsHiddenByBikkieWearables,
  harthmereLocalEquipmentBikkieWearables,
} from "@/shared/harthmere/harthmere_bikkie_wearables";
import {
  HARTHMERE_BIOMES_ECS_INVENTORY_UPDATED_EVENT,
  HARTHMERE_GOLD_ECS_CURRENCY_ID,
} from "@/shared/harthmere/harthmere_biomes_ecs_bridge";

const memoryStore = new Map<string, string>();
const dispatchedEvents: any[] = [];
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
  dispatchEvent: (event: any) => {
    dispatchedEvents.push(event);
    return true;
  },
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
  getHarthmereItemDisplay,
  grantHarthmereItem,
  grantHarthmereNativeTerrainBlockDropForTest,
  harthmereInventoryItemForNativeTerrainBlockForTest,
  harthmereInventoryCountByItemId,
  performHarthmereBackpackItemEquipForBiomesUI,
  performHarthmereBackpackItemUseForBiomesUI,
  performHarthmereEquipmentItemUnequipForBiomesUI,
  performHarthmereHotbarAssignForBiomesUI,
  performHarthmereMaterialStorageRemoveForBiomesUI,
  readHarthmereInventoryState,
} from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import {
  HARTHMERE_BUSINESS_INVENTORY_LOOT_UPDATED_EVENT,
  HARTHMERE_LIVE_INVENTORY_SYNC_EVENT,
} from "@/client/components/challenges/harthmereEvents";
import { dispatchHarthmereLiveModeResponseEventsForTest } from "@/client/components/challenges/harthmereLiveModeClientEvents";

describe("Harthmere inventory BiomesUI presentation and actions", () => {
  beforeEach(() => {
    (globalThis as any).window = {
      localStorage: localStorageShim,
      dispatchEvent: (event: any) => {
        dispatchedEvents.push(event);
        return true;
      },
      addEventListener: () => {},
      removeEventListener: () => {},
      location: {
        href: "https://www.glitch.fun/games/test/play?install_id=test-install",
        search: "?install_id=test-install",
      },
    };
    (globalThis as any).localStorage = localStorageShim;
    memoryStore.clear();
    dispatchedEvents.length = 0;
  });

  it("exposes human-readable local item names and distinct icons", () => {
    const apron = getHarthmereItemDisplay("baker_apron");
    const trousers = getHarthmereItemDisplay("field_trousers");
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
      humanizeBiomesInventoryItemId("bakerApron", "bakerApron"),
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
    assert.equal(harthmereInventoryCountByItemId("baker_apron"), 0);
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
      harthmereLocalEquipmentBikkieWearables({
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

    const slots = harthmereBikkieWearableSlotsFromAssignment(
      new Map([
        [BikkieIds.top, { id: BikkieIds.grassyTop }],
        [BikkieIds.bottoms, { id: BikkieIds.bellBottoms }],
        [BikkieIds.hat, { id: BikkieIds.flowerCrown }],
      ])
    );

    assert.equal(harthmereBikkieWearablesUseGeneratedBody(slots), true);
    assert.equal(harthmereBikkieWearablesUseGeneratedHead(slots), true);
    assert.deepEqual(
      [...harthmereClothingSlotsHiddenByBikkieWearables(slots)].sort(),
      ["belt", "hair", "head", "legs", "torso"]
    );
  });

  it("uses local consumables instead of only selecting them", () => {
    const scroll = readHarthmereInventoryState().backpack.items.find(
      (item) => item.itemId === "field_revival_scroll"
    );
    assert.ok(scroll);
    assert.equal(harthmereInventoryCountByItemId("field_revival_scroll"), 1);

    performHarthmereBackpackItemUseForBiomesUI(
      scroll.instanceId,
      "field_revival_scroll"
    );

    assert.equal(harthmereInventoryCountByItemId("field_revival_scroll"), 0);
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

  it("publishes the canonical Biomes ECS inventory projection on writes", () => {
    grantHarthmereItem("iron_ore", 2, "ecs projection test");
    const event = dispatchedEvents.find(
      (entry) => entry.type === HARTHMERE_BIOMES_ECS_INVENTORY_UPDATED_EVENT
    );

    assert.ok(event);
    assert.equal(
      event.detail.component.currencies.get(
        String(HARTHMERE_GOLD_ECS_CURRENCY_ID)
      )?.count,
      75n
    );
    assert.ok(
      event.detail.warnings.some(
        (warning: { id?: string }) => warning.id === "iron_ore"
      )
    );
  });

  it("mirrors local collection grants to live inventory snapshots for BiomesUI", async () => {
    const fetchCalls: Array<{ input: unknown; init?: RequestInit }> = [];
    (globalThis as any).window.fetch = async (
      input: unknown,
      init?: RequestInit
    ) => {
      fetchCalls.push({ input, init });
      return {
        ok: true,
        json: async () => ({
          inventoryLootState: {
            actor: { gold: 75, items: {}, instanceIds: [] },
            materialStorage: { items: { iron_ore: 2 } },
          },
          playerStatusState: { combat: { hp: 100, deathState: "alive" } },
        }),
      };
    };

    grantHarthmereItem("iron_ore", 2, "mined block test");
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(fetchCalls.length, 1);
    const body = JSON.parse(String(fetchCalls[0].init?.body ?? "{}"));
    assert.equal(body.actionKind, "request_loot_roll");
    assert.equal(body.payload.itemId, "iron_ore");
    assert.equal(body.payload.count, 2);
    assert.ok(body.includeSnapshots.includes("inventoryLootState"));
    assert.ok(body.includeSnapshots.includes("buildingState"));
    assert.ok(
      dispatchedEvents.some(
        (event) => event.type === HARTHMERE_LIVE_INVENTORY_SYNC_EVENT
      )
    );
  });

  it("broadcasts live loot snapshots to the loot prompt and BiomesUI adapters", () => {
    dispatchHarthmereLiveModeResponseEventsForTest({
      inventoryLootState: {
        availableLootDrops: [
          {
            dropId: "drop-1",
            itemStacks: { raw_meat: 2 },
            status: "available",
          },
        ],
      },
      playerStatusState: { combat: { hp: 0, maxHp: 100 } },
    });

    const eventTypes = dispatchedEvents.map((event) => event.type);
    assert.ok(
      eventTypes.includes(HARTHMERE_BUSINESS_INVENTORY_LOOT_UPDATED_EVENT)
    );
    assert.ok(eventTypes.includes(HARTHMERE_LIVE_INVENTORY_SYNC_EVENT));
    assert.ok(
      dispatchedEvents.some(
        (event) =>
          event.type === HARTHMERE_BUSINESS_INVENTORY_LOOT_UPDATED_EVENT &&
          event.detail?.inventoryLootState?.availableLootDrops?.[0]?.dropId ===
            "drop-1"
      )
    );
  });

  it("turns native terrain block breaks into BiomesUI material storage and live loot rolls", async () => {
    const dirtBlockItemId = `b:${BikkieIds.dirt}`;
    const dirtDisplay = getHarthmereItemDisplay(dirtBlockItemId);
    assert.equal(dirtDisplay?.name, "Dirt");
    assert.notEqual(dirtDisplay?.icon, "◼");
    assert.notEqual(biomesInventoryItemIcon(dirtBlockItemId), "◼");
    assert.match(
      dirtDisplay?.icon ?? "",
      /^(?:\/|https?:\/\/|data:image\/|blob:)/
    );
    assert.equal(
      harthmereInventoryItemForNativeTerrainBlockForTest({
        blockItemId: dirtBlockItemId,
        blockName: "Dirt",
      }),
      dirtBlockItemId
    );
    assert.equal(
      harthmereInventoryItemForNativeTerrainBlockForTest({
        blockName: "Road Muckwad",
      }),
      "rough_stone"
    );
    assert.equal(
      harthmereInventoryItemForNativeTerrainBlockForTest({
        blockName: "Old Wood Copse Mucker",
      }),
      "softwood_log"
    );

    const fetchCalls: Array<{ input: unknown; init?: RequestInit }> = [];
    (globalThis as any).window.fetch = async (
      input: unknown,
      init?: RequestInit
    ) => {
      fetchCalls.push({ input, init });
      return {
        ok: true,
        json: async () => ({
          inventoryLootState: {
            actor: { gold: 75, items: {}, instanceIds: [] },
            materialStorage: { items: { [dirtBlockItemId]: 1 } },
          },
        }),
      };
    };

    const grant = grantHarthmereNativeTerrainBlockDropForTest(
      {
        blockItemId: dirtBlockItemId,
        blockName: "Dirt",
        position: [12.2, 53, -18.8],
      },
      { dedupeMs: 0 }
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(grant.itemId, dirtBlockItemId);
    assert.equal(grant.added, 1);
    assert.equal(
      readHarthmereInventoryState().materialStorage[dirtBlockItemId],
      1
    );
    assert.equal(fetchCalls.length, 1);
    assert.match(String(fetchCalls[0].input), /install_id=test-install/);
    const body = JSON.parse(String(fetchCalls[0].init?.body ?? "{}"));
    assert.equal(body.actionKind, "request_loot_roll");
    assert.equal(body.payload.itemId, dirtBlockItemId);
    assert.equal(body.payload.count, 1);
    assert.ok(body.includeSnapshots.includes("playerStatusState"));
  });

  it("uses readable glyph fallbacks instead of square placeholders for unknown inventory items", () => {
    assert.equal(biomesInventoryItemIcon("unknown_widget"), "UN");
    assert.notEqual(biomesInventoryItemIcon("unknown_widget"), "◼");
  });
});
