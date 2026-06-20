import assert from "assert";
import { isTerrainID } from "../../asset_defs/terrain";
import type { BuildingSystemPropertyRecord } from "../building_system";
import {
  buildingSystemBlueprintById,
  buildingSystemPlotById,
  createBuildingSystemPropertyRecord,
} from "../building_system";
import {
  canAccessHarthmereHomeConsole,
  defaultHarthmereHomeDecorationState,
  getHarthmereHomeDecorationDefinition,
  listHarthmereHomeDecorationDefinitions,
  listHarthmereHomeDecorationGardenSeeds,
  reduceHarthmereHomeDecorationMutation,
  validateHarthmereHomeDecorationGuidePlacement,
  type HarthmereHomeDecorationState,
} from "../home_decoration_authority";
import {
  HARTHMERE_CRAFTING_STATIONS,
  HARTHMERE_CRAFTING_TOOLS,
  HARTHMERE_EXOTIC_MATTER_ITEM_IDS,
  HARTHMERE_HOME_DECORATION_ITEM_IDS,
  ensureHarthmereProductionCraftingCatalogue,
} from "../mmo_crafting_catalogue";

const ACTOR = "decor_actor";
const OTHER = "decor_other_actor";
const NOW = 1770000000000;

function property(
  overrides: Partial<BuildingSystemPropertyRecord> = {}
): BuildingSystemPropertyRecord {
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
  state: HarthmereHomeDecorationState,
  payload: Parameters<typeof reduceHarthmereHomeDecorationMutation>[1],
  inventory: Record<string, number>,
  prop = property()
) {
  return reduceHarthmereHomeDecorationMutation(state, payload, {
    properties: { [prop.propertyId]: prop },
    actorInventoryItems: inventory,
  });
}

describe("Harthmere home decoration authority", () => {
  before(() => {
    ensureHarthmereProductionCraftingCatalogue();
  });

  it("exposes crafted stations and functional home objects as decorations", () => {
    const definitions = listHarthmereHomeDecorationDefinitions();
    assert.ok(
      definitions.some(
        (definition) =>
          definition.itemId === HARTHMERE_CRAFTING_STATIONS.workbench &&
          definition.functionalEffects.craftingStationId ===
            HARTHMERE_CRAFTING_STATIONS.workbench
      )
    );
    assert.strictEqual(
      getHarthmereHomeDecorationDefinition(
        HARTHMERE_HOME_DECORATION_ITEM_IDS.storageCabinet
      )?.functionalEffects.storageSlots,
      8
    );
    assert.strictEqual(
      getHarthmereHomeDecorationDefinition(
        HARTHMERE_EXOTIC_MATTER_ITEM_IDS.utilityCore
      )?.functionalEffects.powerMegawatts,
      100400
    );
    assert.ok(
      listHarthmereHomeDecorationGardenSeeds().some(
        (seed) => seed.seedItemId === "grain_seed"
      )
    );
    assert.ok(
      definitions.every(
        (definition) =>
          definition.guidePlacement.snap === "voxel_floor_grid" &&
          definition.guidePlacement.keepDoorAisleClearBlocks === 2
      )
    );
  });

  it("gates the home console to the owner inside an available home", () => {
    assert.deepStrictEqual(
      canAccessHarthmereHomeConsole(property(), {
        actorId: ACTOR,
        insideHome: true,
        nearbyConsoleId: "home_console_home_plot_1",
        requireNearbyConsole: true,
      }),
      { ok: true, reason: "available" }
    );
    assert.strictEqual(
      canAccessHarthmereHomeConsole(property(), {
        actorId: OTHER,
        insideHome: true,
        nearbyConsoleId: "home_console_home_plot_1",
        requireNearbyConsole: true,
      }).reason,
      "not_owner"
    );
    assert.strictEqual(
      canAccessHarthmereHomeConsole(property({ use: "business" }), {
        actorId: ACTOR,
        insideHome: true,
        nearbyConsoleId: "home_console_home_plot_1",
        requireNearbyConsole: true,
      }).reason,
      "not_home_property"
    );
    assert.strictEqual(
      canAccessHarthmereHomeConsole(property(), {
        actorId: ACTOR,
        insideHome: false,
        nearbyConsoleId: "home_console_home_plot_1",
        requireNearbyConsole: true,
      }).reason,
      "not_inside_home"
    );
    assert.strictEqual(
      canAccessHarthmereHomeConsole(
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
      canAccessHarthmereHomeConsole(property(), {
        actorId: ACTOR,
        insideHome: true,
        requireNearbyConsole: true,
      }).reason,
      "console_not_nearby"
    );
  });

  it("places, uses, moves, and removes a crafting station on owned property", () => {
    const placed = mutate(
      defaultHarthmereHomeDecorationState(),
      {
        requestId: "decor-place-1",
        actorId: ACTOR,
        operation: "place_decoration",
        propertyId: "home_plot_1",
        itemId: HARTHMERE_CRAFTING_STATIONS.workbench,
        position: { x: 2, y: 0, z: 3 },
        rotationDegrees: 90,
        nowMs: NOW,
      },
      { [HARTHMERE_CRAFTING_STATIONS.workbench]: 1 }
    );
    assert.ok(placed.ok, JSON.stringify(placed.errors));
    assert.strictEqual(
      placed.itemDeltas[HARTHMERE_CRAFTING_STATIONS.workbench],
      -1
    );
    const decorationId = Object.keys(placed.state.placed)[0];
    assert.ok(decorationId);
    assert.deepStrictEqual(
      placed.state.propertySummaries.home_plot_1.craftingStationIds,
      [HARTHMERE_CRAFTING_STATIONS.workbench]
    );

    const replayed = mutate(
      placed.state,
      {
        requestId: "decor-place-1",
        actorId: ACTOR,
        operation: "place_decoration",
        propertyId: "home_plot_1",
        itemId: HARTHMERE_CRAFTING_STATIONS.workbench,
        position: { x: 2, y: 0, z: 3 },
        rotationDegrees: 90,
        nowMs: NOW,
      },
      { [HARTHMERE_CRAFTING_STATIONS.workbench]: 1 }
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
      HARTHMERE_CRAFTING_STATIONS.workbench
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
      removed.itemDeltas[HARTHMERE_CRAFTING_STATIONS.workbench],
      1
    );
    assert.strictEqual(Object.keys(removed.state.placed).length, 0);
  });

  it("rejects unsupported placement, missing inventory, and unowned property edits", () => {
    const unsupported = mutate(
      defaultHarthmereHomeDecorationState(),
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
      defaultHarthmereHomeDecorationState(),
      {
        requestId: "decor-missing-item",
        actorId: ACTOR,
        operation: "place_decoration",
        propertyId: "home_plot_1",
        itemId: HARTHMERE_HOME_DECORATION_ITEM_IDS.storageCabinet,
        nowMs: NOW,
      },
      {}
    );
    assert.deepStrictEqual(missingItem.errors, ["missing_decoration_item"]);

    const unowned = mutate(
      defaultHarthmereHomeDecorationState(),
      {
        requestId: "decor-unowned",
        actorId: OTHER,
        operation: "place_decoration",
        propertyId: "home_plot_1",
        itemId: HARTHMERE_HOME_DECORATION_ITEM_IDS.storageCabinet,
        nowMs: NOW,
      },
      { [HARTHMERE_HOME_DECORATION_ITEM_IDS.storageCabinet]: 1 }
    );
    assert.deepStrictEqual(unowned.errors, ["property_not_owned"]);

    const invalidPosition = mutate(
      defaultHarthmereHomeDecorationState(),
      {
        requestId: "decor-invalid-position",
        actorId: ACTOR,
        operation: "place_decoration",
        propertyId: "home_plot_1",
        itemId: HARTHMERE_HOME_DECORATION_ITEM_IDS.storageCabinet,
        position: { x: Number.POSITIVE_INFINITY, y: 0, z: 0 },
        nowMs: NOW,
      },
      { [HARTHMERE_HOME_DECORATION_ITEM_IDS.storageCabinet]: 1 }
    );
    assert.deepStrictEqual(invalidPosition.errors, [
      "invalid_decoration_position",
    ]);
  });

  it("applies guide voxel placement rules to known home interiors", () => {
    const plot = buildingSystemPlotById("grove_muckstead_cottage_lot");
    const blueprint = buildingSystemBlueprintById("grove_voxel_cottage_tier_1");
    assert.ok(plot);
    assert.ok(blueprint);
    const realProperty = createBuildingSystemPropertyRecord({
      propertyId: "property_grove_muckstead_cottage_lot",
      ownerId: ACTOR,
      plot,
      blueprint,
      nowMs: NOW,
    });
    const storageDefinition = getHarthmereHomeDecorationDefinition(
      HARTHMERE_HOME_DECORATION_ITEM_IDS.storageCabinet
    );
    assert.ok(storageDefinition);
    const placed = mutate(
      defaultHarthmereHomeDecorationState(),
      {
        requestId: "decor-guide-place",
        actorId: ACTOR,
        operation: "place_decoration",
        propertyId: realProperty.propertyId,
        itemId: HARTHMERE_HOME_DECORATION_ITEM_IDS.storageCabinet,
        nowMs: NOW,
      },
      { [HARTHMERE_HOME_DECORATION_ITEM_IDS.storageCabinet]: 1 },
      realProperty
    );
    assert.ok(placed.ok, JSON.stringify(placed.errors));
    const decorationId = Object.keys(placed.state.placed)[0];
    assert.deepStrictEqual(placed.state.placed[decorationId].position, {
      x: 0,
      y: 0,
      z: 2,
    });
    assert.equal(placed.materializationPlans?.length, 1);
    assert.equal(
      placed.materializationPlans?.[0]?.reason,
      "home_decoration_voxel_materialization"
    );
    assert.ok(
      placed.materializationPlans?.[0]?.edits.every((edit) =>
        isTerrainID(Number(edit.value))
      ),
      "placed decorations must publish terrain block ids, not Bikkie item ids"
    );

    const offGrid = mutate(
      placed.state,
      {
        requestId: "decor-guide-off-grid",
        actorId: ACTOR,
        operation: "move_decoration",
        decorationId,
        position: { x: 1.5, y: 0, z: 2 },
        nowMs: NOW + 1,
      },
      {},
      realProperty
    );
    assert.deepStrictEqual(offGrid.errors, ["decoration_off_voxel_grid"]);

    const blocksAisle = mutate(
      placed.state,
      {
        requestId: "decor-guide-blocks-aisle",
        actorId: ACTOR,
        operation: "move_decoration",
        decorationId,
        position: { x: 1, y: 0, z: 0 },
        nowMs: NOW + 2,
      },
      {},
      realProperty
    );
    assert.deepStrictEqual(blocksAisle.errors, [
      "decoration_blocks_guide_clearance",
    ]);

    const overlap = mutate(
      placed.state,
      {
        requestId: "decor-guide-overlap",
        actorId: ACTOR,
        operation: "place_decoration",
        propertyId: realProperty.propertyId,
        itemId: HARTHMERE_HOME_DECORATION_ITEM_IDS.hearthLamp,
        position: { x: 0, y: 0, z: 2 },
        nowMs: NOW + 3,
      },
      { [HARTHMERE_HOME_DECORATION_ITEM_IDS.hearthLamp]: 1 },
      realProperty
    );
    assert.deepStrictEqual(overlap.errors, ["decoration_overlaps_existing"]);

    assert.strictEqual(
      validateHarthmereHomeDecorationGuidePlacement({
        definition: storageDefinition,
        state: placed.state,
        property: realProperty,
        position: { x: 2, y: 0, z: 2 },
        rotationDegrees: 0,
        ignoreDecorationId: decorationId,
      }).ok,
      true
    );

    const moved = mutate(
      placed.state,
      {
        requestId: "decor-guide-valid-move",
        actorId: ACTOR,
        operation: "move_decoration",
        decorationId,
        position: { x: 2, y: 0, z: 2 },
        nowMs: NOW + 4,
      },
      {},
      realProperty
    );
    assert.ok(moved.ok, JSON.stringify(moved.errors));
    assert.equal(moved.materializationPlans?.length, 2);
    assert.ok(
      moved.materializationPlans?.[0]?.edits.every((edit) => edit.value === 0),
      "moving decorations must first cleanup old voxel positions"
    );
    assert.ok(
      moved.materializationPlans?.[1]?.edits.every((edit) =>
        isTerrainID(Number(edit.value))
      ),
      "moving decorations must materialize new terrain-backed voxels"
    );

    const removed = mutate(
      moved.state,
      {
        requestId: "decor-guide-remove",
        actorId: ACTOR,
        operation: "remove_decoration",
        decorationId,
        nowMs: NOW + 5,
      },
      {},
      realProperty
    );
    assert.ok(removed.ok, JSON.stringify(removed.errors));
    assert.equal(removed.materializationPlans?.length, 1);
    assert.ok(
      removed.materializationPlans?.[0]?.edits.every((edit) => edit.value === 0),
      "removing decorations must publish cleanup voxel edits"
    );
  });

  it("materializes business counters as voxel-backed business markers", () => {
    const plot = buildingSystemPlotById("grove_crossroads_shop_lot");
    const blueprint = buildingSystemBlueprintById("grove_voxel_shop_tier_1");
    assert.ok(plot);
    assert.ok(blueprint);
    const businessProperty = createBuildingSystemPropertyRecord({
      propertyId: "property_grove_crossroads_shop_lot",
      ownerId: ACTOR,
      plot,
      blueprint,
      nowMs: NOW,
    });
    const placed = mutate(
      defaultHarthmereHomeDecorationState(),
      {
        requestId: "decor-business-counter-place",
        actorId: ACTOR,
        operation: "place_decoration",
        propertyId: businessProperty.propertyId,
        itemId: HARTHMERE_HOME_DECORATION_ITEM_IDS.businessServiceCounter,
        nowMs: NOW,
      },
      { [HARTHMERE_HOME_DECORATION_ITEM_IDS.businessServiceCounter]: 1 },
      businessProperty
    );

    assert.ok(placed.ok, JSON.stringify(placed.errors));
    assert.equal(
      placed.state.propertySummaries[businessProperty.propertyId]
        .customerAppeal,
      4
    );
    assert.equal(placed.materializationPlans?.length, 1);
    assert.ok(
      placed.materializationPlans?.[0]?.edits.every(
        (edit) => edit.label === "business_marker" && isTerrainID(Number(edit.value))
      ),
      "business counters must publish voxel business-marker edits"
    );
  });

  it("rechecks property ownership before a placed decoration can be used", () => {
    const placed = mutate(
      defaultHarthmereHomeDecorationState(),
      {
        requestId: "decor-place-use-ownership",
        actorId: ACTOR,
        operation: "place_decoration",
        propertyId: "home_plot_1",
        itemId: HARTHMERE_CRAFTING_STATIONS.workbench,
        nowMs: NOW,
      },
      { [HARTHMERE_CRAFTING_STATIONS.workbench]: 1 }
    );
    const decorationId = Object.keys(placed.state.placed)[0];

    const usedByOther = reduceHarthmereHomeDecorationMutation(
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
      defaultHarthmereHomeDecorationState(),
      {
        requestId: "decor-garden-place",
        actorId: ACTOR,
        operation: "place_decoration",
        propertyId: "home_plot_1",
        itemId: HARTHMERE_HOME_DECORATION_ITEM_IDS.gardenPlanterBox,
        nowMs: NOW,
      },
      { [HARTHMERE_HOME_DECORATION_ITEM_IDS.gardenPlanterBox]: 1 }
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
      { [HARTHMERE_CRAFTING_TOOLS.wateringCan]: 1 }
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
