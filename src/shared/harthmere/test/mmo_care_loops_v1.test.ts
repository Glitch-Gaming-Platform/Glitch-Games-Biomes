import assert from "assert";
import {
  applyHarthmereCareLoopInventoryDeltasV1,
  defaultHarthmereCareLoopStateV1,
  reduceHarthmereCareLoopV1,
  type HarthmereCareLoopKindV1,
  type HarthmereCareLoopStateV1,
} from "../mmo_care_loops_v1";

const ACTOR = "player_care_001";
const NOW = 1_700_500_000_000;
const TOMORROW = NOW + 24 * 60 * 60 * 1000;

function mutate(
  state: HarthmereCareLoopStateV1,
  operation: HarthmereCareLoopKindV1,
  payload: Record<string, unknown> = {},
) {
  return reduceHarthmereCareLoopV1(state, {
    requestId: `care_${operation}_${Math.random()}`,
    actorId: ACTOR,
    operation,
    nowMs: NOW,
    ...payload,
  });
}

describe("mmo_care_loops_v1", () => {
  it("supports daily routine check-ins without punishing missed days", () => {
    let state = defaultHarthmereCareLoopStateV1(ACTOR, NOW);
    let result = mutate(state, "daily_check_in", { targetId: "garden" });
    assert.deepEqual(result.warnings, []);
    assert.equal(result.care.daily.streak, 1);
    assert.equal(result.itemDeltas.seed_carrot, 1);

    const duplicate = mutate(result.care, "daily_check_in", { targetId: "garden" });
    assert.ok(duplicate.warnings.includes("care_rejected:daily_already_claimed"));

    result = reduceHarthmereCareLoopV1(result.care, {
      requestId: "care_tomorrow",
      actorId: ACTOR,
      operation: "daily_check_in",
      targetId: "garden",
      nowMs: TOMORROW + 2 * 24 * 60 * 60 * 1000,
    });
    assert.equal(result.care.daily.streak, 1);
  });

  it("supports NPC talk and gifting with daily caps, preferences, and dialogue unlocks", () => {
    let state = defaultHarthmereCareLoopStateV1(ACTOR, NOW);
    let result = mutate(state, "npc_talk", { targetId: "gus_the_baker" });
    assert.equal(result.care.npcs.gus_the_baker.relationship, 3);

    const duplicateTalk = mutate(result.care, "npc_talk", { targetId: "gus_the_baker" });
    assert.ok(duplicateTalk.warnings.includes("care_rejected:npc_already_talked_today"));

    result = mutate(result.care, "npc_gift", {
      targetId: "gus_the_baker",
      itemId: "field_wheat",
      inventory: { field_wheat: 1 },
    });
    assert.equal(result.itemDeltas.field_wheat, -1);
    assert.equal(result.care.npcs.gus_the_baker.relationship, 13);
    assert.ok(result.care.npcs.gus_the_baker.unlockedDialogue.includes("trust_1"));

    const duplicateGift = mutate(result.care, "npc_gift", {
      targetId: "gus_the_baker",
      itemId: "field_wheat",
      inventory: { field_wheat: 1 },
    });
    assert.ok(duplicateGift.warnings.includes("care_rejected:npc_already_gifted_today"));
  });

  it("rejects invalid NPC gift inputs without consuming inventory", () => {
    const state = defaultHarthmereCareLoopStateV1(ACTOR, NOW);
    let result = mutate(state, "npc_gift", { targetId: "jackie" });
    assert.ok(result.warnings.includes("care_rejected:missing_gift_item"));

    result = mutate(state, "npc_gift", { targetId: "jackie", itemId: "road_ration", inventory: {} });
    assert.ok(result.warnings.includes("care_rejected:missing_gift_inventory"));
    assert.deepEqual(result.itemDeltas, {});
  });

  it("restores and upgrades town projects with material gates and world-state unlocks", () => {
    let state = defaultHarthmereCareLoopStateV1(ACTOR, NOW);
    let result = mutate(state, "restore_project", {
      targetId: "grove_food_satchel",
      inventory: { loaf_bread: 2, road_ration: 1 },
    });
    assert.equal(result.care.projects.grove_food_satchel.stage, 1);
    assert.equal(result.itemDeltas.loaf_bread, -2);
    assert.ok(result.unlocked.includes("project:grove_food_satchel:stage_1"));

    result = mutate(result.care, "restore_project", {
      targetId: "grove_food_satchel",
      inventory: { loaf_bread: 2, road_ration: 1 },
    });
    assert.equal(result.care.projects.grove_food_satchel.stage, 2);
    assert.ok(result.care.projects.grove_food_satchel.completedAtMs);
    assert.ok(result.unlocked.includes("project:grove_food_satchel:complete"));

    const completeAgain = mutate(result.care, "restore_project", {
      targetId: "grove_food_satchel",
      inventory: { loaf_bread: 2, road_ration: 1 },
    });
    assert.ok(completeAgain.warnings.includes("care_rejected:project_complete"));
  });

  it("rejects restoration with missing materials or unknown projects", () => {
    const state = defaultHarthmereCareLoopStateV1(ACTOR, NOW);
    let result = mutate(state, "restore_project", { targetId: "missing", inventory: {} });
    assert.ok(result.warnings.includes("care_rejected:unknown_project"));

    result = mutate(state, "restore_project", { targetId: "grove_food_satchel", inventory: { loaf_bread: 1 } });
    assert.ok(result.warnings.includes("care_rejected:missing_project_materials"));
  });

  it("supports harvest-production-profit through food sales and skill growth", () => {
    const state = defaultHarthmereCareLoopStateV1(ACTOR, NOW);
    const result = mutate(state, "production_sale", {
      itemId: "loaf_bread",
      count: 2,
      inventory: { loaf_bread: 2 },
    });
    assert.equal(result.itemDeltas.loaf_bread, -2);
    assert.equal(result.goldDelta, 10);
    assert.ok(result.care.townNeeds.food > state.townNeeds.food);
    assert.equal(result.care.skills.cooking.xp, 16);
  });

  it("rejects production sales without stock", () => {
    const state = defaultHarthmereCareLoopStateV1(ACTOR, NOW);
    const result = mutate(state, "production_sale", {
      itemId: "loaf_bread",
      count: 2,
      inventory: { loaf_bread: 1 },
    });
    assert.ok(result.warnings.includes("care_rejected:missing_sale_inventory"));
  });

  it("supports collection donations, duplicate protection, and inventory deltas", () => {
    let state = defaultHarthmereCareLoopStateV1(ACTOR, NOW);
    let result = mutate(state, "collection_donation", {
      itemId: "seed_carrot",
      inventory: { seed_carrot: 1 },
    });
    assert.equal(result.itemDeltas.seed_carrot, -1);
    assert.equal(result.care.collections.seed_carrot.category, "seed_catalog");

    result = mutate(result.care, "collection_donation", {
      itemId: "seed_carrot",
      inventory: { seed_carrot: 1 },
    });
    assert.ok(result.warnings.includes("care_rejected:collection_duplicate"));
  });

  it("supports decoration as expression and blocks occupied slots", () => {
    let state = defaultHarthmereCareLoopStateV1(ACTOR, NOW);
    let result = mutate(state, "decorate_space", {
      targetId: "home_table",
      itemId: "flower_pot",
      inventory: { flower_pot: 1 },
    });
    assert.equal(result.itemDeltas.flower_pot, -1);
    assert.equal(result.care.decorations.home_table.itemId, "flower_pot");
    assert.ok(result.care.townNeeds.happiness > state.townNeeds.happiness);

    result = mutate(result.care, "decorate_space", {
      targetId: "home_table",
      itemId: "candle",
      inventory: { candle: 1 },
    });
    assert.ok(result.warnings.includes("care_rejected:decor_slot_occupied"));
  });

  it("supports explore-forage and rejects unknown forage", () => {
    const state = defaultHarthmereCareLoopStateV1(ACTOR, NOW);
    let result = mutate(state, "explore_forage", { itemId: "wild_berries" });
    assert.equal(result.itemDeltas.wild_berries, 1);
    assert.equal(result.care.skills.foraging.xp, 10);

    result = mutate(state, "explore_forage", { itemId: "unknown_rock" });
    assert.ok(result.warnings.includes("care_rejected:unknown_forage"));
  });

  it("supports light town-life help and skill mastery loops", () => {
    let state = defaultHarthmereCareLoopStateV1(ACTOR, NOW);
    let result = mutate(state, "town_life_help", { targetId: "safety" });
    assert.ok(result.care.townNeeds.safety > state.townNeeds.safety);
    assert.equal(result.goldDelta, 4);

    state = result.care;
    result = mutate(state, "skill_mastery", { targetId: "farming", count: 220 });
    assert.equal(result.care.skills.farming.level, 3);
    assert.ok(result.unlocked.includes("skill:farming:level_3"));
  });

  it("supports seasonal discoveries with duplicate and out-of-season protection", () => {
    let state = defaultHarthmereCareLoopStateV1(ACTOR, NOW);
    let result = mutate(state, "seasonal_discovery", {
      season: "spring",
      itemId: "seed_carrot",
    });
    assert.equal(result.itemDeltas.seed_carrot, 1);
    assert.ok(result.unlocked.includes("seasonal:spring:seed_carrot"));

    result = mutate(result.care, "seasonal_discovery", {
      season: "spring",
      itemId: "seed_carrot",
    });
    assert.ok(result.warnings.includes("care_rejected:seasonal_duplicate"));

    result = mutate(state, "seasonal_discovery", {
      season: "winter",
      itemId: "seed_carrot",
    });
    assert.ok(result.warnings.includes("care_rejected:item_not_in_season"));
  });

  it("applies care loop inventory deltas without negative item counts", () => {
    const next = applyHarthmereCareLoopInventoryDeltasV1(
      { loaf_bread: 1, seed_carrot: 2 },
      { loaf_bread: -5, wild_berries: 1 },
    );
    assert.equal(next.loaf_bread, undefined);
    assert.equal(next.seed_carrot, 2);
    assert.equal(next.wild_berries, 1);
  });
});
