import assert from "assert";
import {
  HARTHMERE_COOKING_RECIPES_V1,
  HARTHMERE_FOOD_DEFINITIONS_V1,
  HARTHMERE_HALF_DAY_MS_V1,
  HARTHMERE_LIVESTOCK_PRODUCT_INTERVAL_MS_V1,
  HARTHMERE_FULL_STAMINA_SURVIVAL_MINUTES_V1,
  HARTHMERE_STAMINA_DRAIN_PER_MINUTE_V1,
  HARTHMERE_SEED_DEFINITIONS_V1,
  collectHarthmereLivestockProductV1,
  cookHarthmereFoodV1,
  damageHarthmereSpawnV1,
  defaultHarthmereFoodStaminaStateV1,
  eatHarthmereFoodV1,
  feedHarthmereLivestockV1,
  forageHarthmereFoodSpawnV1,
  gatherHarthmereSeedV1,
  harthmereFarmingFoodItemDisplayNameV1,
  harvestHarthmereCropV1,
  huntHarthmereAnimalForFoodV1,
  plantHarthmereCropV1,
  restoreHarthmereStaminaToFullV1,
  tickHarthmereStaminaForGameplayV1,
  tickHarthmereStaminaV1,
  tickHarthmereWorldRespawnAndRegenV1,
  waterHarthmereCropV1,
} from "../mmo_farming_food_stamina_v1";
import {
  HARTHMERE_ENCUMBRANCE_STAMINA_DRAIN_FACTOR_PER_LB_V1,
  harthmereEncumbranceStaminaMultiplierV1,
  harthmereInventoryCarryWeightV1,
} from "../mmo_carry_weight_v1";
import {
  HARTHMERE_BIKKIE_FOOD_ROWS_V1,
  HARTHMERE_BIKKIE_RECIPE_ROWS_V1,
  HARTHMERE_BIKKIE_SEED_ROWS_V1,
} from "../mmo_bikkie_farming_food_catalog_v1";

const NOW = 1_700_400_000_000;

describe("mmo_farming_food_stamina_v1", () => {
  it("plants, waters, rejects early harvest, and harvests food crops", () => {
    let state = defaultHarthmereFoodStaminaStateV1("player_farm_1", NOW);
    state.inventory.seed_carrot = 1;
    let result = plantHarthmereCropV1(state, { plotId: "plot_1", seedItemId: "seed_carrot", nowMs: NOW });
    assert.deepEqual(result.warnings, []);
    assert.equal(result.state.inventory.seed_carrot, 0);

    result = waterHarthmereCropV1(result.state, { plotId: "plot_1", nowMs: NOW + 60_000 });
    assert.equal(result.state.plots.plot_1.wateredAtMs, NOW + 60_000);

    const repeatedWater = waterHarthmereCropV1(result.state, { plotId: "plot_1", nowMs: NOW + 120_000 });
    assert.ok(repeatedWater.warnings.includes("farming_rejected:already_watered"));

    const early = harvestHarthmereCropV1(result.state, { plotId: "plot_1", nowMs: NOW + 2 * 60 * 60 * 1000 });
    assert.ok(early.warnings.includes("farming_rejected:not_ready"));

    const readyAt = result.state.plots.plot_1.harvestReadyAtMs;
    const harvested = harvestHarthmereCropV1(result.state, { plotId: "plot_1", nowMs: readyAt });
    assert.equal(harvested.state.inventory.fresh_carrot, 3);
    assert.ok(harvested.state.plots.plot_1.harvestedAtMs);
  });

  it("allows seeds from valid vendor, world, or monster sources only", () => {
    let state = defaultHarthmereFoodStaminaStateV1("player_farm_1", NOW);
    let result = gatherHarthmereSeedV1(state, { seedItemId: "seed_wheat", source: "vendor", nowMs: NOW });
    assert.equal(result.state.inventory.seed_wheat, 1);
    state = result.state;
    result = gatherHarthmereSeedV1(state, { seedItemId: "seed_muckroot", source: "monster", nowMs: NOW });
    assert.equal(result.state.inventory.seed_muckroot, 1);
    const invalid = gatherHarthmereSeedV1(state, { seedItemId: "seed_muckroot", source: "vendor", nowMs: NOW });
    assert.ok(invalid.warnings.includes("farming_rejected:invalid_seed_source"));
  });

  it("registers the Bikkie food, seed, crop, and recipe catalog in the stamina systems", () => {
    for (const [itemId, , , , edible] of HARTHMERE_BIKKIE_FOOD_ROWS_V1) {
      if (edible) {
        assert.ok(HARTHMERE_FOOD_DEFINITIONS_V1[itemId], `missing Bikkie food ${itemId}`);
      }
    }
    for (const [seedItemId] of HARTHMERE_BIKKIE_SEED_ROWS_V1) {
      assert.ok(HARTHMERE_SEED_DEFINITIONS_V1[seedItemId], `missing Bikkie seed ${seedItemId}`);
    }
    for (const [recipeId] of HARTHMERE_BIKKIE_RECIPE_ROWS_V1) {
      assert.ok(HARTHMERE_COOKING_RECIPES_V1[recipeId], `missing Bikkie recipe ${recipeId}`);
    }

    const sweetCornSeed = HARTHMERE_SEED_DEFINITIONS_V1["4851938639186947"];
    assert.equal(sweetCornSeed.displayName, "Sweet Corn Seeds");
    assert.equal(sweetCornSeed.yieldItemId, "1708273808636291");
    assert.equal(sweetCornSeed.growMs, 57_600_000);
    assert.equal(sweetCornSeed.requiresSun, true);
    assert.ok(sweetCornSeed.metadata?.visualAsset?.includes("corn_seed.vox"));
    assert.equal(harthmereFarmingFoodItemDisplayNameV1("1708273808636291"), "Sweet Corn");
  });

  it("plants and harvests a Bikkie crop using Bikkie item ids", () => {
    let state = defaultHarthmereFoodStaminaStateV1("player_farm_1", NOW);
    state.inventory["4851938639186947"] = 1;

    let result = plantHarthmereCropV1(state, {
      plotId: "bikkie_corn_1",
      seedItemId: "4851938639186947",
      nowMs: NOW,
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(result.state.plots.bikkie_corn_1.cropItemId, "3875486849453562");

    result = harvestHarthmereCropV1(result.state, {
      plotId: "bikkie_corn_1",
      nowMs: result.state.plots.bikkie_corn_1.harvestReadyAtMs,
    });
    assert.equal(result.state.inventory["1708273808636291"], 1);

    result = eatHarthmereFoodV1({ ...result.state, stamina: 70 }, {
      itemId: "1708273808636291",
      nowMs: NOW,
    });
    assert.equal(result.state.stamina, 90);
  });

  it("cooks Bikkie food recipes with Bikkie ingredients and station checks", () => {
    const state = defaultHarthmereFoodStaminaStateV1("player_farm_1", NOW);
    state.inventory["7539420629350036"] = 4;

    const wrongStation = cookHarthmereFoodV1(state, {
      recipeId: "7031555443006367",
      stationKind: "campfire",
      nowMs: NOW,
    });
    assert.ok(wrongStation.warnings.includes("cooking_rejected:missing_station:oven"));

    const cooked = cookHarthmereFoodV1(state, {
      recipeId: "7031555443006367",
      stationKind: "oven",
      nowMs: NOW,
    });
    assert.deepEqual(cooked.warnings, []);
    assert.equal(cooked.state.inventory["7539420629350036"], 0);
    assert.equal(cooked.state.inventory["7697913156978978"], 1);
    assert.equal(HARTHMERE_FOOD_DEFINITIONS_V1["7697913156978978"].displayName, "Baked Fish");
  });

  it("supports Bikkie field recipes that generate new seeds", () => {
    const state = defaultHarthmereFoodStaminaStateV1("player_farm_1", NOW);
    state.inventory["1534621126189838"] = 3;

    const result = cookHarthmereFoodV1(state, {
      recipeId: "7961837670372290",
      nowMs: NOW,
    });

    assert.deepEqual(result.warnings, []);
    assert.equal(result.state.inventory["1534621126189838"], 0);
    assert.equal(result.state.inventory["1534621126189658"], 4);
    assert.equal(HARTHMERE_SEED_DEFINITIONS_V1["1534621126189658"].displayName, "Red Mushroom Spores");
  });

  it("forages food spawns once and sets their respawn timer", () => {
    const state = defaultHarthmereFoodStaminaStateV1("player_farm_1", NOW);
    state.spawns.berries_1 = {
      spawnId: "berries_1",
      kind: "food",
      itemId: "wild_berries",
    };

    const result = forageHarthmereFoodSpawnV1(state, { spawnId: "berries_1", nowMs: NOW });
    assert.equal(result.state.inventory.wild_berries, 1);
    assert.equal(result.state.spawns.berries_1.depletedAtMs, NOW);
    assert.equal(result.state.spawns.berries_1.respawnAtMs, NOW + HARTHMERE_HALF_DAY_MS_V1);

    const duplicate = forageHarthmereFoodSpawnV1(result.state, { spawnId: "berries_1", nowMs: NOW + 1 });
    assert.ok(duplicate.warnings.includes("forage_rejected:spawn_depleted"));
  });

  it("turns killed animals into raw meat and cooked stamina food", () => {
    let state = defaultHarthmereFoodStaminaStateV1("player_farm_1", NOW);
    state.spawns.boar_1 = { spawnId: "boar_1", kind: "animal", hp: 0, maxHp: 20 };

    let result = huntHarthmereAnimalForFoodV1(state, { animalId: "boar_1", nowMs: NOW });
    assert.equal(result.state.inventory.raw_meat, 2);
    assert.ok(result.state.spawns.boar_1.respawnAtMs);

    result = cookHarthmereFoodV1(result.state, { rawItemId: "raw_meat", nowMs: NOW });
    assert.equal(result.state.inventory.raw_meat, 1);
    assert.equal(result.state.inventory.grilled_meat, 1);

    const eaten = eatHarthmereFoodV1({ ...result.state, stamina: 50 }, { itemId: "grilled_meat", nowMs: NOW });
    assert.equal(eaten.state.stamina, 82);
    assert.equal(eaten.state.inventory.grilled_meat, 0);
  });

  it("cooks recipe batches with station requirements and multiple ingredients", () => {
    const state = defaultHarthmereFoodStaminaStateV1("player_farm_1", NOW);
    state.inventory.loaf_bread = 2;
    state.inventory.fresh_carrot = 2;

    const result = cookHarthmereFoodV1(state, {
      recipeId: "worker_meal",
      stationKind: "cookpot",
      count: 2,
      nowMs: NOW,
    });

    assert.deepEqual(result.warnings, []);
    assert.equal(result.state.inventory.loaf_bread, 0);
    assert.equal(result.state.inventory.fresh_carrot, 0);
    assert.equal(result.state.inventory.worker_meal, 4);
    assert.deepEqual(result.inventoryDeltas, {
      loaf_bread: -2,
      fresh_carrot: -2,
      worker_meal: 4,
    });
    assert.equal(HARTHMERE_COOKING_RECIPES_V1.worker_meal.stationKind, "cookpot");
  });

  it("rejects invalid cooking recipes, counts, missing stations, and missing inputs", () => {
    const state = defaultHarthmereFoodStaminaStateV1("player_farm_1", NOW);
    state.inventory.loaf_bread = 1;

    const unknown = cookHarthmereFoodV1(state, {
      recipeId: "imaginary_soup",
      stationKind: "cookpot",
      nowMs: NOW,
    });
    assert.ok(unknown.warnings.includes("cooking_rejected:unknown_recipe"));

    const badCount = cookHarthmereFoodV1(state, {
      recipeId: "worker_meal",
      stationKind: "cookpot",
      count: 0,
      nowMs: NOW,
    });
    assert.ok(badCount.warnings.includes("cooking_rejected:invalid_count"));

    const missingStation = cookHarthmereFoodV1(state, {
      recipeId: "worker_meal",
      stationKind: "campfire",
      nowMs: NOW,
    });
    assert.ok(missingStation.warnings.includes("cooking_rejected:missing_station:cookpot"));

    const missingInput = cookHarthmereFoodV1(state, {
      recipeId: "worker_meal",
      stationKind: "cookpot",
      nowMs: NOW,
    });
    assert.ok(missingInput.warnings.includes("cooking_rejected:missing_input:fresh_carrot"));

    const tooLarge = cookHarthmereFoodV1({
      ...state,
      inventory: { raw_meat: 99 },
    }, {
      recipeId: "grilled_meat",
      stationKind: "campfire",
      count: HARTHMERE_COOKING_RECIPES_V1.grilled_meat.maxBatchCount + 1,
      nowMs: NOW,
    });
    assert.ok(tooLarge.warnings.includes("cooking_rejected:batch_too_large"));
  });

  it("rejects livestock and protected species from wild hunting", () => {
    const state = defaultHarthmereFoodStaminaStateV1("player_farm_1", NOW);
    state.spawns.cow_1 = { spawnId: "cow_1", kind: "animal", hp: 0, maxHp: 20, isLivestock: true };
    state.spawns.deer_1 = { spawnId: "deer_1", kind: "animal", hp: 0, maxHp: 20, protected: true };

    const cattle = huntHarthmereAnimalForFoodV1(state, { animalId: "cow_1", nowMs: NOW });
    assert.ok(cattle.warnings.includes("hunt_rejected:livestock_requires_care_action"));

    const protectedSpecies = huntHarthmereAnimalForFoodV1(state, { animalId: "deer_1", nowMs: NOW });
    assert.ok(protectedSpecies.warnings.includes("hunt_rejected:protected_species"));
  });

  it("feeds cattle and collects milk only after the animal is cared for and ready", () => {
    let state = defaultHarthmereFoodStaminaStateV1("player_farm_1", NOW);
    state.inventory.seed_wheat = 1;
    state.livestock.cow_1 = {
      livestockId: "cow_1",
      species: "cow",
      ownerId: "player_farm_1",
      health: 40,
      hunger: 10,
      productItemId: "fresh_milk",
      productReadyAtMs: NOW + HARTHMERE_LIVESTOCK_PRODUCT_INTERVAL_MS_V1,
    };

    const notReady = collectHarthmereLivestockProductV1(state, { livestockId: "cow_1", nowMs: NOW });
    assert.ok(notReady.warnings.includes("livestock_rejected:animal_needs_care"));

    let result = feedHarthmereLivestockV1(state, {
      livestockId: "cow_1",
      feedItemId: "seed_wheat",
      nowMs: NOW,
    });
    assert.equal(result.state.inventory.seed_wheat, 0);
    assert.ok(result.state.livestock.cow_1.hunger > 25);
    state = result.state;

    const earlyMilk = collectHarthmereLivestockProductV1(state, {
      livestockId: "cow_1",
      nowMs: NOW + 60_000,
    });
    assert.ok(earlyMilk.warnings.includes("livestock_rejected:product_not_ready"));

    result = collectHarthmereLivestockProductV1(state, {
      livestockId: "cow_1",
      nowMs: state.livestock.cow_1.productReadyAtMs,
    });
    assert.equal(result.state.inventory.fresh_milk, 1);
    assert.equal(result.state.livestock.cow_1.lastCollectedAtMs, state.livestock.cow_1.productReadyAtMs);
  });

  it("allows Bikkie seeds and crop foods to feed livestock", () => {
    const state = defaultHarthmereFoodStaminaStateV1("player_farm_1", NOW);
    state.inventory["1534621126189364"] = 1;
    state.livestock.cow_1 = {
      livestockId: "cow_1",
      species: "cow",
      ownerId: "player_farm_1",
      health: 20,
      hunger: 5,
      productItemId: "fresh_milk",
      productReadyAtMs: NOW + HARTHMERE_LIVESTOCK_PRODUCT_INTERVAL_MS_V1,
    };

    const result = feedHarthmereLivestockV1(state, {
      livestockId: "cow_1",
      feedItemId: "1534621126189364",
      nowMs: NOW,
    });

    assert.deepEqual(result.warnings, []);
    assert.equal(result.state.inventory["1534621126189364"], 0);
    assert.ok(result.state.livestock.cow_1.hunger > 25);
  });

  it("depletes stamina over time, lets food recover it, and triggers death at zero", () => {
    // Times are halved vs. the old 4h clock because the rate is now 100 per 2h (twice as
    // fast), which preserves the same stamina trajectory at each step.
    let state = defaultHarthmereFoodStaminaStateV1("player_farm_1", NOW);
    state.stamina = 20;
    let result = tickHarthmereStaminaV1(state, NOW + 5 * 60_000);
    assert.equal(result.deathTriggered, false);
    assert.ok(result.state.stamina > 15 && result.state.stamina < 16);

    result = eatHarthmereFoodV1(result.state, { itemId: "road_ration", nowMs: NOW + 5 * 60_000 });
    assert.ok(result.state.stamina > 39 && result.state.stamina < 40);

    result = tickHarthmereStaminaV1(result.state, NOW + 30 * 60_000);
    assert.ok(result.state.stamina > 18 && result.state.stamina < 20);
    assert.equal(result.deathTriggered, false);

    result = tickHarthmereStaminaV1(result.state, NOW + 2 * 60 * 60_000);
    assert.equal(result.state.stamina, 0);
    assert.equal(result.deathTriggered, true);
    assert.ok(result.state.deadFromStaminaAtMs);
  });

  it("keeps food stamina-only and does not restore health", () => {
    const state = defaultHarthmereFoodStaminaStateV1("player_farm_1", NOW) as any;
    state.inventory.grilled_meat = 1;
    state.stamina = 80;
    state.health = 50;
    state.maxHealth = 100;

    const result = eatHarthmereFoodV1(state, { itemId: "grilled_meat", nowMs: NOW });
    assert.equal(result.state.stamina, 100);
    assert.equal((result.state as any).health, 50);
    assert.equal(result.state.inventory.grilled_meat, 0);
  });

  it("lets a full 100 stamina bar last exactly two hours before starvation death", () => {
    // Spec: 100 stamina = 2 hours of gameplay.
    assert.equal(HARTHMERE_FULL_STAMINA_SURVIVAL_MINUTES_V1, 120);
    const state = defaultHarthmereFoodStaminaStateV1("player_farm_1", NOW);

    const justBefore = tickHarthmereStaminaV1(
      state,
      NOW + (HARTHMERE_FULL_STAMINA_SURVIVAL_MINUTES_V1 - 1) * 60_000,
    );
    assert.equal(justBefore.deathTriggered, false);
    assert.ok(justBefore.state.stamina > 0);

    const atTwoHours = tickHarthmereStaminaV1(
      state,
      NOW + HARTHMERE_FULL_STAMINA_SURVIVAL_MINUTES_V1 * 60_000,
    );
    assert.equal(atTwoHours.state.stamina, 0);
    assert.equal(atTwoHours.deathTriggered, true);
  });

  it("drains at a constant 100-stamina-per-2-hours rate regardless of max stamina", () => {
    const state = {
      ...defaultHarthmereFoodStaminaStateV1("player_farm_1", NOW),
      stamina: 200,
      maxStamina: 200,
    };

    // Constant rate = 50 stamina/hour (100 per 2h), so a 200 bar loses 50 in the first hour.
    const afterOneHour = tickHarthmereStaminaV1(state, NOW + 60 * 60_000);
    assert.equal(afterOneHour.state.stamina, 150);
    assert.equal(afterOneHour.deathTriggered, false);

    // A 200 bar therefore lasts 4 hours (twice the default 100 bar's 2-hour survival).
    const atSurvival = tickHarthmereStaminaV1(
      state,
      NOW + 2 * HARTHMERE_FULL_STAMINA_SURVIVAL_MINUTES_V1 * 60_000,
    );
    assert.equal(atSurvival.state.stamina, 0);
    assert.equal(atSurvival.deathTriggered, true);
  });

  it("drains stamina faster when carrying weight over the limit, and at the base rate otherwise", () => {
    // steel_sword weighs 5 lb each (tools). 6 = 30 lb → 5 lb over the 25 lb limit.
    const carryWeight = harthmereInventoryCarryWeightV1({ steel_sword: 6 });
    assert.equal(carryWeight, 30);
    const multiplier = harthmereEncumbranceStaminaMultiplierV1(carryWeight);
    assert.ok(
      Math.abs(
        multiplier -
          Math.pow(HARTHMERE_ENCUMBRANCE_STAMINA_DRAIN_FACTOR_PER_LB_V1, 5)
      ) < 1e-9
    );
    assert.ok(multiplier > 1);

    const oneMinute = 60_000;
    const baseState = {
      ...defaultHarthmereFoodStaminaStateV1("player_light", NOW),
      // Default inventory (road_ration ×2 = 2 lb) is well under the limit.
      stamina: 100,
      maxStamina: 100,
    };
    const overState = {
      ...defaultHarthmereFoodStaminaStateV1("player_heavy", NOW),
      inventory: { steel_sword: 6 },
      stamina: 100,
      maxStamina: 100,
    };

    const baseDrain =
      100 - tickHarthmereStaminaV1(baseState, NOW + oneMinute).state.stamina;
    const overDrain =
      100 - tickHarthmereStaminaV1(overState, NOW + oneMinute).state.stamina;

    // The light player drains at exactly the constant base rate (no penalty).
    assert.ok(Math.abs(baseDrain - HARTHMERE_STAMINA_DRAIN_PER_MINUTE_V1) < 1e-9);
    // The overweight player drains by the compounded encumbrance multiplier.
    assert.ok(Math.abs(overDrain - baseDrain * multiplier) < 1e-9);
  });

  it("does not penalize stamina drain at exactly the carry-weight limit", () => {
    // steel_sword ×5 = 25 lb = the limit exactly → no encumbrance penalty.
    assert.equal(harthmereInventoryCarryWeightV1({ steel_sword: 5 }), 25);
    const atLimit = {
      ...defaultHarthmereFoodStaminaStateV1("player_at_limit", NOW),
      inventory: { steel_sword: 5 },
      stamina: 100,
      maxStamina: 100,
    };
    const oneHour = 60 * 60_000;
    const after = tickHarthmereStaminaV1(atLimit, NOW + oneHour);
    // Base rate = 50 stamina/hour, unchanged by the at-limit load.
    assert.equal(after.state.stamina, 50);
  });

  it("applies the encumbrance penalty to the pending drain when eating while overweight", () => {
    const food = Object.values(HARTHMERE_FOOD_DEFINITIONS_V1).find(
      (f) => f.edible !== false && f.staminaRestore > 0
    );
    assert.ok(food, "expected at least one edible food definition");
    const overState = {
      ...defaultHarthmereFoodStaminaStateV1("player_heavy_eater", NOW),
      // Overweight load plus one unit of the food being eaten.
      inventory: { steel_sword: 6, [food!.itemId]: 1 },
      // Start mid-bar so the restored meal does not clamp at max and hide the penalty.
      stamina: 50,
      maxStamina: 100,
    };
    const multiplier = harthmereEncumbranceStaminaMultiplierV1(
      harthmereInventoryCarryWeightV1(overState.inventory)
    );
    assert.ok(multiplier > 1);
    const oneMinute = 60_000;
    const result = eatHarthmereFoodV1(overState, {
      itemId: food!.itemId,
      nowMs: NOW + oneMinute,
    });
    const pendingDrain =
      HARTHMERE_STAMINA_DRAIN_PER_MINUTE_V1 * multiplier;
    const expected = Math.min(
      100,
      50 - pendingDrain + food!.staminaRestore
    );
    assert.ok(Math.abs(result.state.stamina - expected) < 1e-9);
  });

  it("normalizes malformed stamina values instead of skipping death checks", () => {
    const badMax = tickHarthmereStaminaV1({
      ...defaultHarthmereFoodStaminaStateV1("player_farm_1", NOW),
      stamina: Number.NaN,
      maxStamina: Number.NaN,
      lastStaminaTickMs: Number.NaN,
    }, NOW);
    assert.equal(badMax.state.stamina, 100);
    assert.equal(badMax.state.maxStamina, 100);
    assert.equal(badMax.deathTriggered, false);

    const backwardsClock = tickHarthmereStaminaV1({
      ...defaultHarthmereFoodStaminaStateV1("player_farm_1", NOW),
      lastStaminaTickMs: NOW + 60_000,
    }, NOW);
    assert.equal(backwardsClock.state.stamina, 100);
    assert.equal(backwardsClock.state.lastStaminaTickMs, NOW + 60_000);
  });

  it("does not drain stamina while gameplay is inactive", () => {
    const state = defaultHarthmereFoodStaminaStateV1("player_farm_1", NOW);
    const result = tickHarthmereStaminaForGameplayV1(state, {
      nowMs: NOW + 8 * 60 * 60 * 1000,
      gameplayActive: false,
    });

    assert.equal(result.deathTriggered, false);
    assert.equal(result.state.stamina, state.stamina);
    assert.equal(result.state.deadFromStaminaAtMs, undefined);
    assert.equal(result.state.lastStaminaTickMs, NOW + 8 * 60 * 60 * 1000);
  });

  it("drains and can kill only once gameplay is active again", () => {
    const state = defaultHarthmereFoodStaminaStateV1("player_farm_1", NOW);
    const paused = tickHarthmereStaminaForGameplayV1(state, {
      nowMs: NOW + 8 * 60 * 60 * 1000,
      gameplayActive: false,
    });
    const active = tickHarthmereStaminaForGameplayV1(paused.state, {
      nowMs:
        paused.state.lastStaminaTickMs +
        HARTHMERE_FULL_STAMINA_SURVIVAL_MINUTES_V1 * 60_000,
      gameplayActive: true,
    });

    assert.equal(active.state.stamina, 0);
    assert.equal(active.deathTriggered, true);
    assert.ok(active.state.deadFromStaminaAtMs);
  });

  it("restores stamina to full on respawn and clears starvation death", () => {
    const state = defaultHarthmereFoodStaminaStateV1("player_farm_1", NOW);
    const dead = tickHarthmereStaminaV1(
      state,
      NOW + HARTHMERE_FULL_STAMINA_SURVIVAL_MINUTES_V1 * 60_000,
    );
    const restored = restoreHarthmereStaminaToFullV1(
      dead.state,
      NOW + HARTHMERE_FULL_STAMINA_SURVIVAL_MINUTES_V1 * 60_000 + 1_000,
    );

    assert.equal(restored.state.stamina, 100);
    assert.equal(restored.state.deadFromStaminaAtMs, undefined);
    assert.equal(restored.deathTriggered, false);
  });

  it("does not let food revive a stamina-dead player", () => {
    const state = defaultHarthmereFoodStaminaStateV1("player_farm_1", NOW);
    const dead = tickHarthmereStaminaV1(
      state,
      NOW + HARTHMERE_FULL_STAMINA_SURVIVAL_MINUTES_V1 * 60_000,
    );

    const eaten = eatHarthmereFoodV1(dead.state, {
      itemId: "road_ration",
      nowMs: NOW + HARTHMERE_FULL_STAMINA_SURVIVAL_MINUTES_V1 * 60_000 + 1_000,
    });

    assert.ok(eaten.warnings.includes("food_rejected:stamina_depleted"));
    assert.equal(eaten.state.stamina, 0);
    assert.equal(eaten.state.inventory.road_ration, 2);
    assert.equal(eaten.state.deadFromStaminaAtMs, dead.state.deadFromStaminaAtMs);
  });

  it("respawns resources and regenerates monster health to full after half a day", () => {
    let state = defaultHarthmereFoodStaminaStateV1("player_farm_1", NOW);
    state.spawns.food_1 = {
      spawnId: "food_1",
      kind: "food",
      itemId: "wild_berries",
      depletedAtMs: NOW,
      respawnAtMs: NOW + HARTHMERE_HALF_DAY_MS_V1,
    };
    state.spawns.mucker_1 = {
      spawnId: "mucker_1",
      kind: "monster",
      hp: 10,
      maxHp: 100,
      lastDamagedAtMs: NOW,
      lastRegenAtMs: NOW,
    };

    let result = tickHarthmereWorldRespawnAndRegenV1(state, NOW + HARTHMERE_HALF_DAY_MS_V1 / 2);
    assert.equal(result.state.spawns.food_1.depletedAtMs, NOW);
    assert.equal(Math.round(result.state.spawns.mucker_1.hp ?? 0), 60);

    result = tickHarthmereWorldRespawnAndRegenV1(result.state, NOW + HARTHMERE_HALF_DAY_MS_V1);
    assert.equal(result.state.spawns.food_1.depletedAtMs, undefined);
    assert.equal(result.state.spawns.food_1.respawnAtMs, undefined);
    assert.equal(Math.round(result.state.spawns.mucker_1.hp ?? 0), 100);
  });

  it("records death and respawn timers when animal or monster spawns are killed", () => {
    const state = defaultHarthmereFoodStaminaStateV1("player_farm_1", NOW);
    state.spawns.mucker_1 = { spawnId: "mucker_1", kind: "monster", hp: 15, maxHp: 40 };

    const result = damageHarthmereSpawnV1(state, { spawnId: "mucker_1", damage: 99, nowMs: NOW });

    assert.equal(result.state.spawns.mucker_1.hp, 0);
    assert.equal(result.state.spawns.mucker_1.depletedAtMs, NOW);
    assert.equal(result.state.spawns.mucker_1.respawnAtMs, NOW + HARTHMERE_HALF_DAY_MS_V1);
  });
});

describe("mmo_farming_food_stamina_v1 — survival clock + farming edge cases (audit hardening)", () => {
  it("applies pending stamina drain before crediting an eaten meal", () => {
    const foodId = Object.keys(HARTHMERE_FOOD_DEFINITIONS_V1).find(
      (id) =>
        HARTHMERE_FOOD_DEFINITIONS_V1[id].edible !== false &&
        HARTHMERE_FOOD_DEFINITIONS_V1[id].staminaRestore > 0,
    )!;
    const restore = HARTHMERE_FOOD_DEFINITIONS_V1[foodId].staminaRestore;
    // 60 minutes of drain at the constant rate (100 per 2h => 50/hour).
    const drainOverHour = 60 * HARTHMERE_STAMINA_DRAIN_PER_MINUTE_V1;
    const startStamina = 80;
    const base = {
      ...defaultHarthmereFoodStaminaStateV1("p_eat_drain", NOW),
      stamina: startStamina,
      maxStamina: 100,
      lastStaminaTickMs: NOW,
      inventory: { [foodId]: 2 },
    };
    // Eat 60 min later WITHOUT a preceding tick: the drain must still be applied first.
    const eaten = eatHarthmereFoodV1(base, { itemId: foodId, nowMs: NOW + 60 * 60 * 1000 });
    assert.deepEqual(eaten.warnings, []);
    const expected = Math.min(100, Math.max(0, startStamina - drainOverHour) + restore);
    assert.ok(
      Math.abs(eaten.state.stamina - expected) < 0.01,
      `stamina ${eaten.state.stamina} should be drain-then-restore ${expected}, not the no-drain ${Math.min(100, startStamina + restore)}`,
    );
  });

  it("watering cannot make a fast-growing crop instantly harvestable", () => {
    const state = defaultHarthmereFoodStaminaStateV1("p_water_cap", NOW);
    state.inventory.seed_carrot = 1;
    const planted = plantHarthmereCropV1(state, { plotId: "fast_plot", seedItemId: "seed_carrot", nowMs: NOW });
    assert.deepEqual(planted.warnings, []);
    const plot = planted.state.plots.fast_plot;
    const growMs = 20 * 60 * 1000; // under the old flat 1h water bonus
    const fastState = {
      ...planted.state,
      plots: { ...planted.state.plots, fast_plot: { ...plot, harvestReadyAtMs: plot.plantedAtMs + growMs } },
    };
    const watered = waterHarthmereCropV1(fastState, { plotId: "fast_plot", nowMs: plot.plantedAtMs });
    assert.deepEqual(watered.warnings, []);
    const readyAt = watered.state.plots.fast_plot.harvestReadyAtMs;
    assert.ok(readyAt > plot.plantedAtMs, "crop became instantly harvestable after watering");
    assert.ok(readyAt >= plot.plantedAtMs + growMs * 0.75 - 1, "water bonus exceeded the 25% cap");
    const early = harvestHarthmereCropV1(watered.state, { plotId: "fast_plot", nowMs: plot.plantedAtMs });
    assert.ok(early.warnings.length > 0, "fast crop should not be harvestable at plant time after watering");
  });

  it("does not let feeding livestock pull the product timer earlier", () => {
    const state = defaultHarthmereFoodStaminaStateV1("p_feed", NOW);
    state.inventory.seed_wheat = 1;
    const farFuture = NOW + 10 * HARTHMERE_LIVESTOCK_PRODUCT_INTERVAL_MS_V1;
    state.livestock.cow_1 = {
      livestockId: "cow_1",
      species: "cow",
      ownerId: "p_feed",
      health: 50,
      hunger: 50,
      productItemId: "fresh_milk",
      productReadyAtMs: farFuture,
    };
    const result = feedHarthmereLivestockV1(state, { livestockId: "cow_1", feedItemId: "seed_wheat", nowMs: NOW });
    assert.deepEqual(result.warnings, []);
    assert.ok(
      result.state.livestock.cow_1.productReadyAtMs >= farFuture,
      "feeding must not shorten the product-ready timer",
    );
  });

  it("normalizes corrupt (NaN) livestock health/hunger as needs-care instead of waving collection through", () => {
    const state = defaultHarthmereFoodStaminaStateV1("p_nan", NOW);
    state.livestock.cow_1 = {
      livestockId: "cow_1",
      species: "cow",
      ownerId: "p_nan",
      health: Number.NaN,
      hunger: Number.NaN,
      productItemId: "fresh_milk",
      productReadyAtMs: NOW - 1, // already "ready" so only the care gate can block it
    };
    const collected = collectHarthmereLivestockProductV1(state, { livestockId: "cow_1", nowMs: NOW });
    assert.ok(collected.warnings.includes("livestock_rejected:animal_needs_care"));
  });
});

describe("mmo_farming_food_stamina_v1 — crop death/spoilage (audit hardening)", () => {
  const TOMATO_SEED = "1534621126189358"; // grow 3 days, death window 5 days
  const DAY_MS = 24 * 60 * 60 * 1000;

  it("withers a crop left unharvested past its death window and frees the plot for replant", () => {
    const state = defaultHarthmereFoodStaminaStateV1("p_death", NOW);
    state.inventory[TOMATO_SEED] = 2;
    const planted = plantHarthmereCropV1(state, { plotId: "death_plot", seedItemId: TOMATO_SEED, nowMs: NOW });
    assert.deepEqual(planted.warnings, []);

    // Harvest 6 days later — past the 5-day death window — yields nothing and withers.
    const withered = harvestHarthmereCropV1(planted.state, { plotId: "death_plot", nowMs: NOW + 6 * DAY_MS });
    assert.ok(withered.warnings.includes("farming_rejected:crop_withered"));
    assert.ok(withered.state.plots.death_plot.diedAtMs, "plot is marked dead");
    // The rejection yields nothing — the seed's yield item is not granted.
    const yieldItem = HARTHMERE_SEED_DEFINITIONS_V1[TOMATO_SEED].yieldItemId;
    const witheredDeltas = (withered as { itemDeltas?: Record<string, number> }).itemDeltas ?? {};
    assert.equal(witheredDeltas[yieldItem] ?? 0, 0, "withered crop yields nothing");

    // A withered plot can be cleared and replanted.
    const replanted = plantHarthmereCropV1(withered.state, { plotId: "death_plot", seedItemId: TOMATO_SEED, nowMs: NOW + 6 * DAY_MS });
    assert.deepEqual(replanted.warnings, []);
    assert.equal(replanted.state.plots.death_plot.diedAtMs, undefined, "replant clears the dead marker");
  });

  it("still harvests a crop within its death window", () => {
    const state = defaultHarthmereFoodStaminaStateV1("p_window", NOW);
    state.inventory[TOMATO_SEED] = 1;
    const planted = plantHarthmereCropV1(state, { plotId: "window_plot", seedItemId: TOMATO_SEED, nowMs: NOW });
    // 4 days: after the 3-day grow, before the 5-day death window → harvest succeeds.
    const harvested = harvestHarthmereCropV1(planted.state, { plotId: "window_plot", nowMs: NOW + 4 * DAY_MS });
    assert.deepEqual(harvested.warnings, []);
    assert.ok(harvested.state.plots.window_plot.harvestedAtMs);
  });
});
