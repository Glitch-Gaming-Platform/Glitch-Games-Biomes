import assert from "assert";
import type { BuildingSystemPropertyRecordV1 } from "../building_system_v1";
import {
  canAccessHarthmereHomeConsoleV1,
  defaultHarthmereHomeDecorationStateV1,
  getHarthmereHomeDecorationDefinitionV1,
  listHarthmereHomeDecorationDefinitionsV1,
  listHarthmereHomeDecorationGardenSeedsV1,
  reduceHarthmereHomeDecorationMutationV1,
  type HarthmereHomeDecorationStateV1,
} from "../home_decoration_authority_v1";
import {
  HARTHMERE_CRAFTING_STATIONS_V1,
  HARTHMERE_CRAFTING_TOOLS_V1,
  HARTHMERE_EXOTIC_MATTER_ITEM_IDS_V1,
  HARTHMERE_HOME_DECORATION_ITEM_IDS_V1,
  ensureHarthmereProductionCraftingCatalogueV1,
} from "../mmo_crafting_catalogue_v1";

const ACTOR = "decor_actor";
const OTHER = "decor_other_actor";
const NOW = 1770000000000;

function property(
  overrides: Partial<BuildingSystemPropertyRecordV1> = {}
): BuildingSystemPropertyRecordV1 {
  return {
    propertyId: "home_plot_1",
    plotId: "grove_home_plot",
    blueprintId: "starter_cottage",
    ownerId: ACTOR,
    status: "owned",
    use: "home",
    value: 100,
    tier: 1,
    accessMode: "private",
    permissions: {
      owner: {
        storage_access: true,
        build_edit: true,
        demolition: true,
        transfer_sale: true,
      },
      friends_guests: {
        storage_access: false,
        build_edit: false,
        demolition: false,
        transfer_sale: false,
      },
      guild_members: {
        storage_access: false,
        build_edit: false,
        demolition: false,
        transfer_sale: false,
      },
      public: {
        storage_access: false,
        build_edit: false,
        demolition: false,
        transfer_sale: false,
      },
    },
    guestActorIds: [],
    storageSlots: 0,
    storageItemCount: 0,
    visualDamageApplied: false,
    upgradedVoxelTier: 1,
    condition: 1,
    repairDebtGold: 0,
    lastRepairDecayAtMs: NOW,
    taxRate: 0,
    businessTaxRate: 0,
    guildTaxRate: 0,
    taxBalanceGold: 0,
    lastTaxAssessedAtMs: NOW,
    abandoned: false,
    listedForSale: false,
    createdAtMs: NOW,
    updatedAtMs: NOW,
    ...overrides,
  };
}

function mutate(
  state: HarthmereHomeDecorationStateV1,
  payload: Parameters<typeof reduceHarthmereHomeDecorationMutationV1>[1],
  inventory: Record<string, number>,
  prop = property()
) {
  return reduceHarthmereHomeDecorationMutationV1(state, payload, {
    properties: { [prop.propertyId]: prop },
    actorInventoryItems: inventory,
  });
}

describe("Harthmere home decoration authority", () => {
  before(() => {
    ensureHarthmereProductionCraftingCatalogueV1();
  });

  it("exposes crafted stations and functional home objects as decorations", () => {
    const definitions = listHarthmereHomeDecorationDefinitionsV1();
    assert.ok(
      definitions.some(
        (definition) =>
          definition.itemId === HARTHMERE_CRAFTING_STATIONS_V1.workbench &&
          definition.functionalEffects.craftingStationId ===
            HARTHMERE_CRAFTING_STATIONS_V1.workbench
      )
    );
    assert.strictEqual(
      getHarthmereHomeDecorationDefinitionV1(
        HARTHMERE_HOME_DECORATION_ITEM_IDS_V1.storageCabinet
      )?.functionalEffects.storageSlots,
      8
    );
    assert.strictEqual(
      getHarthmereHomeDecorationDefinitionV1(
        HARTHMERE_EXOTIC_MATTER_ITEM_IDS_V1.utilityCore
      )?.functionalEffects.powerMegawatts,
      100400
    );
    assert.ok(
      listHarthmereHomeDecorationGardenSeedsV1().some(
        (seed) => seed.seedItemId === "grain_seed"
      )
    );
  });

  it("gates the home console to the owner inside an available home", () => {
    assert.deepStrictEqual(
      canAccessHarthmereHomeConsoleV1(property(), {
        actorId: ACTOR,
        insideHome: true,
        nearbyConsoleId: "home_console_home_plot_1",
        requireNearbyConsole: true,
      }),
      { ok: true, reason: "available" }
    );
    assert.strictEqual(
      canAccessHarthmereHomeConsoleV1(property(), {
        actorId: OTHER,
        insideHome: true,
        nearbyConsoleId: "home_console_home_plot_1",
        requireNearbyConsole: true,
      }).reason,
      "not_owner"
    );
    assert.strictEqual(
      canAccessHarthmereHomeConsoleV1(property({ use: "business" }), {
        actorId: ACTOR,
        insideHome: true,
        nearbyConsoleId: "home_console_home_plot_1",
        requireNearbyConsole: true,
      }).reason,
      "not_home_property"
    );
    assert.strictEqual(
      canAccessHarthmereHomeConsoleV1(property(), {
        actorId: ACTOR,
        insideHome: false,
        nearbyConsoleId: "home_console_home_plot_1",
        requireNearbyConsole: true,
      }).reason,
      "not_inside_home"
    );
    assert.strictEqual(
      canAccessHarthmereHomeConsoleV1(
        property({ status: "abandoned", abandoned: true }),
        {
          actorId: ACTOR,
          insideHome: true,
          nearbyConsoleId: "home_console_home_plot_1",
          requireNearbyConsole: true,
        }
      ).reason,
      "property_unavailable"
    );
    assert.strictEqual(
      canAccessHarthmereHomeConsoleV1(property(), {
        actorId: ACTOR,
        insideHome: true,
        requireNearbyConsole: true,
      }).reason,
      "console_not_nearby"
    );
  });

  it("places, uses, moves, and removes a crafting station on owned property", () => {
    const placed = mutate(
      defaultHarthmereHomeDecorationStateV1(),
      {
        requestId: "decor-place-1",
        actorId: ACTOR,
        operation: "place_decoration",
        propertyId: "home_plot_1",
        itemId: HARTHMERE_CRAFTING_STATIONS_V1.workbench,
        position: { x: 2, y: 0, z: 3 },
        rotationDegrees: 90,
        nowMs: NOW,
      },
      { [HARTHMERE_CRAFTING_STATIONS_V1.workbench]: 1 }
    );
    assert.ok(placed.ok, JSON.stringify(placed.errors));
    assert.strictEqual(
      placed.itemDeltas[HARTHMERE_CRAFTING_STATIONS_V1.workbench],
      -1
    );
    const decorationId = Object.keys(placed.state.placed)[0];
    assert.ok(decorationId);
    assert.deepStrictEqual(
      placed.state.propertySummaries.home_plot_1.craftingStationIds,
      [HARTHMERE_CRAFTING_STATIONS_V1.workbench]
    );

    const replayed = mutate(
      placed.state,
      {
        requestId: "decor-place-1",
        actorId: ACTOR,
        operation: "place_decoration",
        propertyId: "home_plot_1",
        itemId: HARTHMERE_CRAFTING_STATIONS_V1.workbench,
        position: { x: 2, y: 0, z: 3 },
        rotationDegrees: 90,
        nowMs: NOW,
      },
      { [HARTHMERE_CRAFTING_STATIONS_V1.workbench]: 1 }
    );
    assert.ok(replayed.ok, JSON.stringify(replayed.errors));
    assert.deepStrictEqual(replayed.itemDeltas, {});
    assert.strictEqual(Object.keys(replayed.state.placed).length, 1);

    const used = mutate(
      placed.state,
      {
        requestId: "decor-use-1",
        actorId: ACTOR,
        operation: "use_decoration",
        decorationId,
        nowMs: NOW + 1,
      },
      {}
    );
    assert.strictEqual(
      used.openedStationId,
      HARTHMERE_CRAFTING_STATIONS_V1.workbench
    );

    const moved = mutate(
      used.state,
      {
        requestId: "decor-move-1",
        actorId: ACTOR,
        operation: "move_decoration",
        decorationId,
        position: { x: 5, y: 0, z: 6 },
        rotationDegrees: 180,
        nowMs: NOW + 2,
      },
      {}
    );
    assert.deepStrictEqual(moved.state.placed[decorationId].position, {
      x: 5,
      y: 0,
      z: 6,
    });
    assert.strictEqual(moved.state.placed[decorationId].rotationDegrees, 180);

    const removed = mutate(
      moved.state,
      {
        requestId: "decor-remove-1",
        actorId: ACTOR,
        operation: "remove_decoration",
        decorationId,
        nowMs: NOW + 3,
      },
      {}
    );
    assert.ok(removed.ok, JSON.stringify(removed.errors));
    assert.strictEqual(
      removed.itemDeltas[HARTHMERE_CRAFTING_STATIONS_V1.workbench],
      1
    );
    assert.strictEqual(Object.keys(removed.state.placed).length, 0);
  });

  it("rejects unsupported placement, missing inventory, and unowned property edits", () => {
    const unsupported = mutate(
      defaultHarthmereHomeDecorationStateV1(),
      {
        requestId: "decor-unsupported",
        actorId: ACTOR,
        operation: "place_decoration",
        propertyId: "home_plot_1",
        itemId: "iron_ingot",
        nowMs: NOW,
      },
      { iron_ingot: 1 }
    );
    assert.deepStrictEqual(unsupported.errors, ["decoration_not_supported"]);

    const missingItem = mutate(
      defaultHarthmereHomeDecorationStateV1(),
      {
        requestId: "decor-missing-item",
        actorId: ACTOR,
        operation: "place_decoration",
        propertyId: "home_plot_1",
        itemId: HARTHMERE_HOME_DECORATION_ITEM_IDS_V1.storageCabinet,
        nowMs: NOW,
      },
      {}
    );
    assert.deepStrictEqual(missingItem.errors, ["missing_decoration_item"]);

    const unowned = mutate(
      defaultHarthmereHomeDecorationStateV1(),
      {
        requestId: "decor-unowned",
        actorId: OTHER,
        operation: "place_decoration",
        propertyId: "home_plot_1",
        itemId: HARTHMERE_HOME_DECORATION_ITEM_IDS_V1.storageCabinet,
        nowMs: NOW,
      },
      { [HARTHMERE_HOME_DECORATION_ITEM_IDS_V1.storageCabinet]: 1 }
    );
    assert.deepStrictEqual(unowned.errors, ["property_not_owned"]);

    const invalidPosition = mutate(
      defaultHarthmereHomeDecorationStateV1(),
      {
        requestId: "decor-invalid-position",
        actorId: ACTOR,
        operation: "place_decoration",
        propertyId: "home_plot_1",
        itemId: HARTHMERE_HOME_DECORATION_ITEM_IDS_V1.storageCabinet,
        position: { x: Number.POSITIVE_INFINITY, y: 0, z: 0 },
        nowMs: NOW,
      },
      { [HARTHMERE_HOME_DECORATION_ITEM_IDS_V1.storageCabinet]: 1 }
    );
    assert.deepStrictEqual(invalidPosition.errors, [
      "invalid_decoration_position",
    ]);
  });

  it("rechecks property ownership before a placed decoration can be used", () => {
    const placed = mutate(
      defaultHarthmereHomeDecorationStateV1(),
      {
        requestId: "decor-place-use-ownership",
        actorId: ACTOR,
        operation: "place_decoration",
        propertyId: "home_plot_1",
        itemId: HARTHMERE_CRAFTING_STATIONS_V1.workbench,
        nowMs: NOW,
      },
      { [HARTHMERE_CRAFTING_STATIONS_V1.workbench]: 1 }
    );
    const decorationId = Object.keys(placed.state.placed)[0];

    const usedByOther = reduceHarthmereHomeDecorationMutationV1(
      placed.state,
      {
        requestId: "decor-use-other",
        actorId: OTHER,
        operation: "use_decoration",
        decorationId,
        nowMs: NOW + 1,
      },
      {
        properties: { home_plot_1: property() },
        actorInventoryItems: {},
      }
    );
    assert.deepStrictEqual(usedByOther.errors, ["property_not_owned"]);
  });

  it("supports optional gardening with seed, watering, and timed harvest validation", () => {
    const placed = mutate(
      defaultHarthmereHomeDecorationStateV1(),
      {
        requestId: "decor-garden-place",
        actorId: ACTOR,
        operation: "place_decoration",
        propertyId: "home_plot_1",
        itemId: HARTHMERE_HOME_DECORATION_ITEM_IDS_V1.gardenPlanterBox,
        nowMs: NOW,
      },
      { [HARTHMERE_HOME_DECORATION_ITEM_IDS_V1.gardenPlanterBox]: 1 }
    );
    const decorationId = Object.keys(placed.state.placed)[0];

    const planted = mutate(
      placed.state,
      {
        requestId: "decor-garden-plant",
        actorId: ACTOR,
        operation: "plant_garden",
        decorationId,
        seedItemId: "grain_seed",
        nowMs: NOW + 1,
      },
      { grain_seed: 1 }
    );
    assert.ok(planted.ok, JSON.stringify(planted.errors));
    assert.strictEqual(planted.itemDeltas.grain_seed, -1);

    const early = mutate(
      planted.state,
      {
        requestId: "decor-garden-early",
        actorId: ACTOR,
        operation: "harvest_garden",
        decorationId,
        nowMs: NOW + 2,
      },
      {}
    );
    assert.deepStrictEqual(early.errors, ["garden_not_ready"]);

    const watered = mutate(
      planted.state,
      {
        requestId: "decor-garden-water",
        actorId: ACTOR,
        operation: "water_garden",
        decorationId,
        nowMs: NOW + 3,
      },
      { [HARTHMERE_CRAFTING_TOOLS_V1.wateringCan]: 1 }
    );
    assert.ok(watered.ok, JSON.stringify(watered.errors));

    const harvested = mutate(
      watered.state,
      {
        requestId: "decor-garden-harvest",
        actorId: ACTOR,
        operation: "harvest_garden",
        decorationId,
        nowMs: NOW + 3 + 60_000,
      },
      {}
    );
    assert.strictEqual(harvested.harvestedItemId, "rough_herb");
    assert.strictEqual(harvested.itemDeltas.rough_herb, 2);
    assert.strictEqual(harvested.state.placed[decorationId].garden, undefined);
  });
});
