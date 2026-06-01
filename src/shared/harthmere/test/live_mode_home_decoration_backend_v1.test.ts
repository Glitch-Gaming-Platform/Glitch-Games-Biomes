import assert from "assert";
import { isTerrainID } from "../../asset_defs/terrain";
import {
  buildingSystemBlueprintByIdV1,
  buildingSystemHomeConsoleMarkerIdV1,
  buildingSystemPlotByIdV1,
  createBuildingSystemHomeConsoleMarkerV1,
  type BuildingSystemPropertyRecordV1,
} from "../building_system_v1";
import {
  createHarthmereLiveModeBuildingClientSnapshotV1,
  defaultHarthmereLiveModeBackendStateV1,
  reduceHarthmereLiveModeBackendStateV1,
  type HarthmereLiveModeBackendStateV1,
} from "../live_mode_backend_v1";
import type {
  HarthmereLiveModeActionKindV1,
  HarthmereLiveModeAuthorityEnvelopeV1,
} from "../live_mode_readiness_v1";
import {
  HARTHMERE_CRAFTING_STATIONS_V1,
  HARTHMERE_HOME_DECORATION_ITEM_IDS_V1,
  ensureHarthmereProductionCraftingCatalogueV1,
} from "../mmo_crafting_catalogue_v1";

const ACTOR = "decor_live_actor";
const NOW = 1770000000000;
let seq = 0;

function property(
  overrides: Partial<BuildingSystemPropertyRecordV1> = {}
): BuildingSystemPropertyRecordV1 {
  return {
    propertyId: "decor_live_home",
    plotId: "grove_muckstead_cottage_lot",
    blueprintId: "grove_voxel_cottage_tier_1",
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

function homeConsolePosition() {
  const prop = property();
  const marker = createBuildingSystemHomeConsoleMarkerV1({
    property: prop,
    plot: buildingSystemPlotByIdV1(prop.plotId)!,
    blueprint: buildingSystemBlueprintByIdV1(prop.blueprintId)!,
    nowMs: NOW,
  });
  return {
    x: marker.position[0],
    y: marker.position[1],
    z: marker.position[2],
  };
}

function envelope(
  actionKind: HarthmereLiveModeActionKindV1,
  payload: Record<string, unknown> = {},
  nowMs = NOW
): HarthmereLiveModeAuthorityEnvelopeV1 {
  seq += 1;
  return {
    requestId: `decor-live-${seq}`,
    idempotencyKey: `decor-live-idem-${seq}`,
    actorId: ACTOR,
    actionKind,
    subsystem:
      actionKind === "request_property_building_mutation"
        ? "building"
        : "home_decoration",
    source: "client_request",
    serverReceivedAtMs: nowMs,
    serverTick: seq,
    actorEntityVersion: 1,
    zoneId: "harthmere_grove",
    payload,
    clientClaims: {},
    serverActorPosition: homeConsolePosition(),
  };
}

function freshState(): HarthmereLiveModeBackendStateV1 {
  ensureHarthmereProductionCraftingCatalogueV1();
  const state = defaultHarthmereLiveModeBackendStateV1(ACTOR, NOW);
  state.property.owned.decor_live_home = property();
  return state;
}

function reduce(
  state: HarthmereLiveModeBackendStateV1,
  payload: Record<string, unknown>,
  nowMs = NOW
) {
  return reduceHarthmereLiveModeBackendStateV1(
    state,
    envelope("request_home_decoration", payload, nowMs),
    nowMs
  );
}

describe("Harthmere live-mode home decoration backend", () => {
  it("stores completed homes with backend-owned console access points in the materialization plan", () => {
    const state = defaultHarthmereLiveModeBackendStateV1(ACTOR, NOW);
    state.inventory.gold = 1_000;
    state.building.ownedPlots.push("grove_muckstead_cottage_lot");
    const request = envelope("request_property_building_mutation", {
      buildingAction: "place",
      plotId: "grove_muckstead_cottage_lot",
      blueprintId: "grove_voxel_cottage_tier_1",
      propertyId: "decor_live_placed_home",
    });

    const placed = reduceHarthmereLiveModeBackendStateV1(
      state,
      request,
      NOW
    );
    const plan = placed.state.building.materializationPlans[request.requestId];
    const markerId = buildingSystemHomeConsoleMarkerIdV1(
      "decor_live_placed_home"
    );
    const planConsole = (
      plan && "inWorldMarkers" in plan ? plan.inWorldMarkers ?? [] : []
    ).find((marker) => marker.markerId === markerId);
    const worldConsole = placed.state.building.inWorldMarkers[markerId];

    assert.deepStrictEqual(placed.summary.warnings, []);
    assert.ok(planConsole);
    assert.equal(planConsole.kind, "home_console");
    assert.equal(planConsole.label, "Home Console");
    assert.deepStrictEqual(worldConsole.position, planConsole.position);
    assert.equal(worldConsole.label, "Home Console");
    assert.ok(
      plan.edits.some((edit) => edit.label === "home_console"),
      "the console must also have a physical voxel edit"
    );
  });

  it("places crafted stations as functional home workshop decorations", () => {
    const state = freshState();
    state.inventory.items[HARTHMERE_CRAFTING_STATIONS_V1.workbench] = 1;

    const placed = reduce(state, {
      operation: "place_decoration",
      propertyId: "decor_live_home",
      itemId: HARTHMERE_CRAFTING_STATIONS_V1.workbench,
      position: { x: 2, y: 0, z: 2 },
      rotationDegrees: 90,
    });

    assert.deepStrictEqual(placed.summary.warnings, []);
    assert.strictEqual(
      placed.state.inventory.items[HARTHMERE_CRAFTING_STATIONS_V1.workbench] ??
        0,
      0
    );
    assert.ok(placed.summary.touchedModels.includes("home_decoration"));
    assert.ok(placed.summary.touchedModels.includes("inventory_items"));
    assert.ok(
      placed.summary.touchedModels.includes(
        "home_decoration_voxel_materialization"
      )
    );
    assert.equal(placed.summary.buildingMaterializationPlans?.length, 1);
    assert.ok(
      placed.summary.buildingMaterializationPlans?.[0]?.edits.every((edit) =>
        isTerrainID(Number(edit.value))
      ),
      "home decorations must publish real terrain IDs"
    );
    assert.deepStrictEqual(
      placed.state.homeDecoration.propertySummaries.decor_live_home
        .craftingStationIds,
      [HARTHMERE_CRAFTING_STATIONS_V1.workbench]
    );

    const snapshot = createHarthmereLiveModeBuildingClientSnapshotV1(
      placed.state
    );
    assert.strictEqual(
      snapshot.homeDecoration.propertySummaries.decor_live_home
        .activeDecorations,
      1
    );
  });

  it("replays duplicate decoration requests without minting or consuming twice", () => {
    const state = freshState();
    state.inventory.items[HARTHMERE_CRAFTING_STATIONS_V1.workbench] = 1;
    const request = envelope("request_home_decoration", {
      operation: "place_decoration",
      propertyId: "decor_live_home",
      itemId: HARTHMERE_CRAFTING_STATIONS_V1.workbench,
      position: { x: 2, y: 0, z: 2 },
    });

    const first = reduceHarthmereLiveModeBackendStateV1(state, request, NOW);
    const replay = reduceHarthmereLiveModeBackendStateV1(
      first.state,
      request,
      NOW + 1
    );

    assert.deepStrictEqual(replay.summary.warnings, []);
    assert.strictEqual(
      replay.state.inventory.items[HARTHMERE_CRAFTING_STATIONS_V1.workbench] ??
        0,
      0
    );
    assert.strictEqual(
      Object.keys(replay.state.homeDecoration.placed).length,
      1
    );
    assert.ok(!replay.summary.touchedModels.includes("home_decoration"));
    assert.equal(replay.summary.buildingMaterializationPlans?.length ?? 0, 0);
  });

  it("keeps property invalidation when decorations are removed", () => {
    const state = freshState();
    state.inventory.items[HARTHMERE_CRAFTING_STATIONS_V1.workbench] = 1;
    const placed = reduce(state, {
      operation: "place_decoration",
      propertyId: "decor_live_home",
      itemId: HARTHMERE_CRAFTING_STATIONS_V1.workbench,
    });
    const decorationId = Object.keys(placed.state.homeDecoration.placed)[0];

    const removed = reduce(placed.state, {
      operation: "remove_decoration",
      decorationId,
    });

    assert.deepStrictEqual(removed.summary.warnings, []);
    assert.strictEqual(
      Object.keys(removed.state.homeDecoration.placed).length,
      0
    );
    assert.equal(removed.summary.buildingMaterializationPlans?.length, 1);
    assert.ok(
      removed.summary.buildingMaterializationPlans?.[0]?.edits.every(
        (edit) => edit.value === 0
      ),
      "removing home decorations must cleanup voxel edits"
    );
    assert.ok(
      removed.summary.sharedStateKeys.some((key) =>
        key.endsWith(":property:decor_live_home")
      ),
      JSON.stringify(removed.summary.sharedStateKeys)
    );
  });

  it("rejects home decoration actions that do not own a crafted item", () => {
    const rejected = reduce(freshState(), {
      operation: "place_decoration",
      propertyId: "decor_live_home",
      itemId: HARTHMERE_HOME_DECORATION_ITEM_IDS_V1.storageCabinet,
    });

    assert.ok(
      rejected.summary.warnings.includes(
        "home_decoration_rejected:missing_decoration_item"
      ),
      JSON.stringify(rejected.summary)
    );
    assert.strictEqual(
      Object.keys(rejected.state.homeDecoration.placed).length,
      0
    );
  });

  it("rejects client home decoration actions away from the home console", () => {
    const state = freshState();
    state.inventory.items[HARTHMERE_CRAFTING_STATIONS_V1.workbench] = 1;
    const request = envelope("request_home_decoration", {
      operation: "place_decoration",
      propertyId: "decor_live_home",
      itemId: HARTHMERE_CRAFTING_STATIONS_V1.workbench,
    });

    const unverified = reduceHarthmereLiveModeBackendStateV1(
      state,
      { ...request, serverActorPosition: undefined },
      NOW
    );
    assert.ok(
      unverified.summary.warnings.includes(
        "home_decoration_rejected:console_proximity_unverified"
      )
    );

    const tooFar = reduceHarthmereLiveModeBackendStateV1(
      state,
      { ...request, serverActorPosition: { x: 0, y: 0, z: 0 } },
      NOW
    );
    assert.ok(
      tooFar.summary.warnings.includes(
        "home_decoration_rejected:console_proximity_required"
      )
    );
    assert.strictEqual(
      Object.keys(tooFar.state.homeDecoration.placed).length,
      0
    );
  });
});
