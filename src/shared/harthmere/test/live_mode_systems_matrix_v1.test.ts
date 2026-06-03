import assert from "assert";
import {
  createHarthmereLiveModePlayerStatusClientSnapshotV1,
  defaultHarthmereLiveModeBackendStateV1,
  reduceHarthmereLiveModeBackendStateV1,
  type HarthmereLiveModeBackendStateV1,
} from "../live_mode_backend_v1";
import { buildingSystemPlotByIdV1 } from "../building_system_v1";
import {
  HARTHMERE_GUILD_CREATION_MIN_LEVEL_V1,
  createHarthmereLiveModeGuildClientSnapshotV1,
} from "../mmo_guild_authority_v1";
import { HARTHMERE_AUCTION_LISTING_FEE_BASE_GOLD } from "../mmo_auction_authority_v1";
import {
  registerHarthmereItemDefinitionV1,
  type HarthmereItemDefinitionV1,
} from "../mmo_inventory_authority_v1";
import type {
  HarthmereLiveModeActionKindV1,
  HarthmereLiveModeAuthorityEnvelopeV1,
} from "../live_mode_readiness_v1";

const NOW_MS = 1_760_000_000_000;
const ACTOR = "systems_matrix_player";

let seq = 0;

function state() {
  return defaultHarthmereLiveModeBackendStateV1(ACTOR, NOW_MS);
}

function envelope(
  actionKind: HarthmereLiveModeActionKindV1,
  payload: Record<string, unknown> = {},
  overrides: Partial<HarthmereLiveModeAuthorityEnvelopeV1> = {}
): HarthmereLiveModeAuthorityEnvelopeV1 {
  seq += 1;
  return {
    requestId: `systems-matrix-${seq}`,
    idempotencyKey: `systems-matrix-idem-${seq}`,
    actorId: ACTOR,
    actionKind,
    subsystem: "combat",
    source: "client_request",
    serverReceivedAtMs: NOW_MS,
    serverTick: seq,
    actorEntityVersion: 1,
    zoneId: "the_grove",
    payload,
    clientClaims: {},
    ...overrides,
  };
}

function apply(
  current: HarthmereLiveModeBackendStateV1,
  actionKind: HarthmereLiveModeActionKindV1,
  payload: Record<string, unknown> = {},
  overrides: Partial<HarthmereLiveModeAuthorityEnvelopeV1> = {}
) {
  return reduceHarthmereLiveModeBackendStateV1(
    current,
    envelope(actionKind, payload, overrides),
    NOW_MS
  );
}

function registerMatrixItem(overrides: Partial<HarthmereItemDefinitionV1>) {
  registerHarthmereItemDefinitionV1({
    itemId: "matrix_iron_ore",
    displayName: "Matrix Iron Ore",
    maxStackSize: 99,
    baseValue: 5,
    binding: "none",
    isQuestItem: false,
    isCurrency: false,
    isConsumable: false,
    isCraftingMaterial: true,
    isSpellTome: false,
    levelRequirement: 1,
    classRestriction: [],
    stats: { weight: 1 },
    tradeable: true,
    ...overrides,
  });
}

before(function registerSystemsMatrixItems() {
  registerMatrixItem({});
  registerMatrixItem({
    itemId: "matrix_trade_sword",
    displayName: "Matrix Trade Sword",
    maxStackSize: 1,
    baseValue: 100,
    isCraftingMaterial: false,
    stats: { attack: 5, weight: 2 },
  });
});

describe("Harthmere live-mode MMO systems matrix", function () {
  it("covers house buying through the live backend reducer", function () {
    const start = state();
    start.inventory.gold = 2_000;
    const plot = buildingSystemPlotByIdV1("grove_muckstead_cottage_lot");
    assert.ok(plot);

    const { state: next, summary } = apply(
      start,
      "request_property_building_mutation",
      { buildingAction: "claim_plot", plotId: plot.plotId },
      { subsystem: "building" }
    );

    assert.ok(next.building.ownedPlots.includes(plot.plotId));
    assert.ok(next.building.inWorldMarkers[`${plot.plotId}:map`]);
    assert.ok(summary.touchedModels.includes("owned_plots"));
    assert.ok(next.inventory.gold < 2_000);
  });

  it("covers building a house and exposing its home console SSR data", function () {
    const start = state();
    start.inventory.gold = 2_000;
    start.building.ownedPlots.push("grove_muckstead_cottage_lot");

    const { state: next, summary } = apply(
      start,
      "request_property_building_mutation",
      {
        buildingAction: "place",
        plotId: "grove_muckstead_cottage_lot",
        blueprintId: "grove_voxel_cottage_tier_1",
        propertyId: "property_grove_muckstead_cottage_lot",
      },
      { subsystem: "building" }
    );

    const property = next.property.owned.property_grove_muckstead_cottage_lot;
    assert.equal(property?.use, "home");
    assert.equal(
      next.property.buildingProgress.property_grove_muckstead_cottage_lot,
      100
    );
    assert.ok(summary.touchedModels.includes("property_building"));
  });

  it("covers business creation from a player-owned shop plot", function () {
    let current = state();
    current.inventory.gold = 10_000;
    current.building.ownedPlots.push("grove_crossroads_shop_lot");
    ({ state: current } = apply(
      current,
      "request_property_building_mutation",
      {
        buildingAction: "place",
        plotId: "grove_crossroads_shop_lot",
        blueprintId: "grove_voxel_shop_tier_1",
        propertyId: "property_grove_crossroads_shop_lot",
      },
      { subsystem: "building" }
    ));

    const { state: next } = apply(
      current,
      "request_property_building_mutation",
      {
        buildingAction: "start_business",
        propertyId: "property_grove_crossroads_shop_lot",
        businessType: "general_trader",
      },
      { subsystem: "building" }
    );

    const businessId = "business_property_grove_crossroads_shop_lot";
    assert.ok(next.economy.businesses[businessId]);
    assert.equal(next.economy.production.businesses[businessId]?.status, "open");
    assert.equal(
      next.economy.production.businesses[businessId]?.propertyId,
      "property_grove_crossroads_shop_lot"
    );
  });

  it("covers guild creation and client snapshot boundaries", function () {
    const start = state();
    start.inventory.gold = 1_000;
    start.classMagic.skills.character_level = {
      xp: 50_000,
      level: HARTHMERE_GUILD_CREATION_MIN_LEVEL_V1,
    };

    const { state: next, summary } = apply(
      start,
      "request_guild_mutation",
      {
        operation: "create_guild",
        name: "Matrix Wardens",
        tag: "MW",
        description: "Coverage guild for live-mode systems.",
        recruitment: "application",
        guildType: "civic",
      },
      { subsystem: "guild" }
    );

    const snapshot = createHarthmereLiveModeGuildClientSnapshotV1(
      next.guild,
      ACTOR
    );
    assert.equal(snapshot.guild?.name, "Matrix Wardens");
    assert.equal(snapshot.role, "leader");
    assert.ok(
      summary.touchedModels.some((model) => model.includes("guild")),
      `guild mutation should report a guild touch, saw ${summary.touchedModels.join(", ")}`
    );
    assert.ok(next.inventory.gold < 1_000);
  });

  it("covers combat and PVP guardrails through server-known targets", function () {
    let current = state();
    const targetId = "mob_goblin_001";
    current.classMagic.knownAbilities = ["basic_strike"];
    current.classMagic.loadout = { slot_0: "basic_strike" };
    current.combat.entitySnapshots[targetId] = {
      hp: 40,
      maxHp: 40,
      position: { x: 1, y: 0, z: 0 },
      isHostile: true,
      isAlive: true,
      isAttackable: true,
      entityKind: "monster",
      level: 1,
    };

    const attack = apply(
      current,
      "request_attack",
      { abilityId: "basic_strike", targetHp: 1, targetX: 999 },
      { subsystem: "combat", targetId, zoneId: "harthmere_wilderness" }
    );
    current = attack.state;
    assert.ok(
      (current.combat.threat[targetId] ?? 0) > 0,
      `attack should write threat against the target; warnings=${attack.summary.warnings.join(", ")}`
    );
    assert.ok(
      current.combat.cooldowns.basic_strike,
      "attack should write a basic strike cooldown"
    );

    const flagged = apply(
      current,
      "request_pvp_flag_change",
      { factionId: "open_world", crimeKind: "pvp_flagged" },
      { subsystem: "law" }
    ).state;
    assert.equal(
      flagged.law.flags.pvp_flagged,
      true,
      "PVP flag mutation should set the law pvp flag"
    );
  });

  it("covers auction listing escrow and live loot claim storage", function () {
    let current = state();
    current.inventory.gold = 1_000;
    current.inventory.items.matrix_trade_sword = 1;

    ({ state: current } = apply(
      current,
      "request_auction_post",
      {
        itemId: "matrix_trade_sword",
        count: 1,
        unitPrice: 250,
      },
      { subsystem: "auction" }
    ));
    const listing = Object.values(current.economy.auctionListings).find(
      (entry) => entry.itemId === "matrix_trade_sword"
    );
    assert.ok(listing);
    assert.equal(current.inventory.escrow.matrix_trade_sword, 1);
    assert.ok(current.inventory.gold <= 1_000 - HARTHMERE_AUCTION_LISTING_FEE_BASE_GOLD);

    ({ state: current } = apply(
      current,
      "request_loot_claim",
      { itemId: "matrix_iron_ore", count: 3 },
      { subsystem: "inventory" }
    ));
    assert.equal(current.banking.materialStorage.matrix_iron_ore, 3);
  });

  it("covers law and likeability state in the player status snapshot", function () {
    const { state: next, summary } = apply(
      state(),
      "request_law_reputation_mutation",
      {
        factionId: "harthmere",
        likeabilityDelta: 12,
        legalDelta: -4,
        notorietyDelta: 2,
        fineDelta: 25,
        witnessLevel: "public",
        reason: "systems_matrix_check",
      },
      { subsystem: "law" }
    );

    const status = createHarthmereLiveModePlayerStatusClientSnapshotV1(next);
    assert.equal(status.standing.scopeId, "harthmere");
    assert.ok(status.standing.likeability > 0);
    assert.ok((next.law.fines.harthmere ?? 0) >= 25);
    assert.ok(
      summary.touchedModels.some((model) => model.startsWith("law_")),
      `law mutation should report a law touch, saw ${summary.touchedModels.join(", ")}`
    );
  });

  it("covers farming and food as separate live backend flows", function () {
    let current = state();
    current.inventory.items.seed_carrot = 1;

    ({ state: current } = apply(
      current,
      "request_farming_action",
      {
        operation: "plant",
        plotId: "matrix_plot",
        seedItemId: "seed_carrot",
      },
      { subsystem: "farming" }
    ));
    assert.equal(current.farming.plots.matrix_plot.seedItemId, "seed_carrot");

    current.inventory.items.raw_meat = 1;
    ({ state: current } = apply(
      current,
      "request_farming_action",
      {
        operation: "cook_food",
        recipeId: "grilled_meat",
        rawItemId: "raw_meat",
        stationKind: "campfire",
      },
      { subsystem: "farming" }
    ));
    assert.equal(current.inventory.items.grilled_meat, 1);

    current.combat.resources.stamina = 50;
    const eaten = apply(
      current,
      "request_farming_action",
      { operation: "eat_food", itemId: "grilled_meat" },
      { subsystem: "farming" }
    ).state;
    assert.equal(eaten.inventory.items.grilled_meat ?? 0, 0);
    assert.ok(eaten.combat.resources.stamina > 50);
  });
});
