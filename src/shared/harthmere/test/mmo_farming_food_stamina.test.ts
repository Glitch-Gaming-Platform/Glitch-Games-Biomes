import assert from "assert";
import {
  HARTHMERE_COOKING_RECIPES,
  HARTHMERE_FARM_MAX_WATER_INTERVAL_MS,
  HARTHMERE_FOOD_DEFINITIONS,
  HARTHMERE_HALF_DAY_MS,
  HARTHMERE_LIVESTOCK_PRODUCT_INTERVAL_MS,
  HARTHMERE_FULL_STAMINA_SURVIVAL_MINUTES,
  HARTHMERE_STAMINA_DRAIN_PER_MINUTE,
  HARTHMERE_SEED_DEFINITIONS,
  collectHarthmereLivestockProduct,
  cookHarthmereFood,
  damageHarthmereSpawn,
  defaultHarthmereFoodStaminaState,
  eatHarthmereFood,
  feedHarthmereLivestock,
  forageHarthmereFoodSpawn,
  gatherHarthmereSeed,
  harthmereFarmingFoodItemDisplayName,
  harvestHarthmereCrop,
  huntHarthmereAnimalForFood,
  plantHarthmereCrop,
  restoreHarthmereStaminaToFull,
  tickHarthmereStaminaForGameplay,
  tickHarthmereStamina,
  tickHarthmereWorldRespawnAndRegen,
  waterHarthmereCrop,
} from "../mmo_farming_food_stamina";
import {
  HARTHMERE_ENCUMBRANCE_STAMINA_DRAIN_FACTOR_PER_LB,
  harthmereEncumbranceStaminaMultiplier,
  harthmereInventoryCarryWeight,
} from "../mmo_carry_weight";
import {
  HARTHMERE_BIKKIE_FOOD_ROWS,
  HARTHMERE_BIKKIE_RECIPE_ROWS,
  HARTHMERE_BIKKIE_SEED_ROWS,
} from "../mmo_bikkie_farming_food_catalog";

const NOW = 1_700_400_000_000;

describe("mmo_farming_food_stamina", () => {
  it("plants, waters, rejects early harvest, and harvests food crops", () => {
    let state = defaultHarthmereFoodStaminaState("player_farm_1", NOW);
    state.inventory.seed_carrot = 1;
    let result = plantHarthmereCrop(state, { plotId: "plot_1", seedItemId: "seed_carrot", nowMs: NOW });
    assert.deepEqual(result.warnings, []);
    assert.equal(result.state.inventory.seed_carrot, 0);

    result = waterHarthmereCrop(result.state, { plotId: "plot_1", nowMs: NOW + 60_000 });
    assert.equal(result.state.plots.plot_1.wateredAtMs, NOW + 60_000);

    // Watering is repeatable — tending again just refreshes the watered time.
    result = waterHarthmereCrop(result.state, { plotId: "plot_1", nowMs: NOW + 120_000 });
    assert.deepEqual(result.warnings, []);
    assert.equal(result.state.plots.plot_1.wateredAtMs, NOW + 120_000);

    const early = harvestHarthmereCrop(result.state, { plotId: "plot_1", nowMs: NOW + 2 * 60 * 60 * 1000 });
    assert.ok(early.warnings.includes("farming_rejected:not_ready"));

    const readyAt = result.state.plots.plot_1.harvestReadyAtMs;
    const harvested = harvestHarthmereCrop(result.state, { plotId: "plot_1", nowMs: readyAt });
    // Watered crop → full yield.
    assert.equal(harvested.state.inventory.fresh_carrot, 3);
    assert.ok(harvested.state.plots.plot_1.harvestedAtMs);
  });

  it("allows seeds from valid vendor, world, or monster sources only", () => {
    let state = defaultHarthmereFoodStaminaState("player_farm_1", NOW);
    let result = gatherHarthmereSeed(state, { seedItemId: "seed_wheat", source: "vendor", nowMs: NOW });
    assert.equal(result.state.inventory.seed_wheat, 1);
    state = result.state;
    result = gatherHarthmereSeed(state, { seedItemId: "seed_muckroot", source: "monster", nowMs: NOW });
    assert.equal(result.state.inventory.seed_muckroot, 1);
    const invalid = gatherHarthmereSeed(state, { seedItemId: "seed_muckroot", source: "vendor", nowMs: NOW });
    assert.ok(invalid.warnings.includes("farming_rejected:invalid_seed_source"));
  });

  it("registers the Bikkie food, seed, crop, and recipe catalog in the stamina systems", () => {
    for (const [itemId, , , , edible] of HARTHMERE_BIKKIE_FOOD_ROWS) {
      if (edible) {
        assert.ok(HARTHMERE_FOOD_DEFINITIONS[itemId], `missing Bikkie food ${itemId}`);
      }
    }
    for (const [seedItemId] of HARTHMERE_BIKKIE_SEED_ROWS) {
      assert.ok(HARTHMERE_SEED_DEFINITIONS[seedItemId], `missing Bikkie seed ${seedItemId}`);
    }
    for (const [recipeId] of HARTHMERE_BIKKIE_RECIPE_ROWS) {
      assert.ok(HARTHMERE_COOKING_RECIPES[recipeId], `missing Bikkie recipe ${recipeId}`);
    }

    const sweetCornSeed = HARTHMERE_SEED_DEFINITIONS["4851938639186947"];
    assert.equal(sweetCornSeed.displayName, "Sweet Corn Seeds");
    assert.equal(sweetCornSeed.yieldItemId, "1708273808636291");
    assert.equal(sweetCornSeed.growMs, 57_600_000);
    assert.equal(sweetCornSeed.requiresSun, true);
    assert.ok(sweetCornSeed.metadata?.visualAsset?.includes("corn_seed.vox"));
    assert.equal(harthmereFarmingFoodItemDisplayName("1708273808636291"), "Sweet Corn");
  });

  it("plants and harvests a Bikkie crop using Bikkie item ids", () => {
    let state = defaultHarthmereFoodStaminaState("player_farm_1", NOW);
    state.inventory["4851938639186947"] = 1;

    let result = plantHarthmereCrop(state, {
      plotId: "bikkie_corn_1",
      seedItemId: "4851938639186947",
      nowMs: NOW,
    });
    assert.deepEqual(result.warnings, []);
    assert.equal(result.state.plots.bikkie_corn_1.cropItemId, "3875486849453562");

    result = harvestHarthmereCrop(result.state, {
      plotId: "bikkie_corn_1",
      nowMs: result.state.plots.bikkie_corn_1.harvestReadyAtMs,
    });
    assert.equal(result.state.inventory["1708273808636291"], 1);

    result = eatHarthmereFood({ ...result.state, stamina: 70 }, {
      itemId: "1708273808636291",
      nowMs: NOW,
    });
    assert.equal(result.state.stamina, 90);
  });

  it("cooks Bikkie food recipes with Bikkie ingredients and station checks", () => {
    const state = defaultHarthmereFoodStaminaState("player_farm_1", NOW);
    state.inventory["7539420629350036"] = 4;

    const wrongStation = cookHarthmereFood(state, {
      recipeId: "7031555443006367",
      stationKind: "campfire",
      nowMs: NOW,
    });
    assert.ok(wrongStation.warnings.includes("cooking_rejected:missing_station:oven"));

    const cooked = cookHarthmereFood(state, {
      recipeId: "7031555443006367",
      stationKind: "oven",
      nowMs: NOW,
    });
    assert.deepEqual(cooked.warnings, []);
    assert.equal(cooked.state.inventory["7539420629350036"], 0);
    assert.equal(cooked.state.inventory["7697913156978978"], 1);
    assert.equal(HARTHMERE_FOOD_DEFINITIONS["7697913156978978"].displayName, "Baked Fish");
  });

  it("supports Bikkie field recipes that generate new seeds", () => {
    const state = defaultHarthmereFoodStaminaState("player_farm_1", NOW);
    state.inventory["1534621126189838"] = 3;

    const result = cookHarthmereFood(state, {
      recipeId: "7961837670372290",
      nowMs: NOW,
    });

    assert.deepEqual(result.warnings, []);
    assert.equal(result.state.inventory["1534621126189838"], 0);
    assert.equal(result.state.inventory["1534621126189658"], 4);
    assert.equal(HARTHMERE_SEED_DEFINITIONS["1534621126189658"].displayName, "Red Mushroom Spores");
  });

  it("forages food spawns once and sets their respawn timer", () => {
    const state = defaultHarthmereFoodStaminaState("player_farm_1", NOW);
    state.spawns.berries_1 = {
      spawnId: "berries_1",
      kind: "food",
      itemId: "wild_berries",
    };

    const result = forageHarthmereFoodSpawn(state, { spawnId: "berries_1", nowMs: NOW });
    assert.equal(result.state.inventory.wild_berries, 1);
    assert.equal(result.state.spawns.berries_1.depletedAtMs, NOW);
    assert.equal(result.state.spawns.berries_1.respawnAtMs, NOW + HARTHMERE_HALF_DAY_MS);

    const duplicate = forageHarthmereFoodSpawn(result.state, { spawnId: "berries_1", nowMs: NOW + 1 });
    assert.ok(duplicate.warnings.includes("forage_rejected:spawn_depleted"));
  });

  it("turns killed animals into raw meat and cooked stamina food", () => {
    let state = defaultHarthmereFoodStaminaState("player_farm_1", NOW);
    state.spawns.boar_1 = { spawnId: "boar_1", kind: "animal", hp: 0, maxHp: 20 };

    let result = huntHarthmereAnimalForFood(state, { animalId: "boar_1", nowMs: NOW });
    assert.equal(result.state.inventory.raw_meat, 2);
    assert.ok(result.state.spawns.boar_1.respawnAtMs);

    result = cookHarthmereFood(result.state, { rawItemId: "raw_meat", nowMs: NOW });
    assert.equal(result.state.inventory.raw_meat, 1);
    assert.equal(result.state.inventory.grilled_meat, 1);

    const eaten = eatHarthmereFood({ ...result.state, stamina: 50 }, { itemId: "grilled_meat", nowMs: NOW });
    assert.equal(eaten.state.stamina, 82);
    assert.equal(eaten.state.inventory.grilled_meat, 0);
  });

  it("cooks recipe batches with station requirements and multiple ingredients", () => {
    const state = defaultHarthmereFoodStaminaState("player_farm_1", NOW);
    state.inventory.loaf_bread = 2;
    state.inventory.fresh_carrot = 2;

    const result = cookHarthmereFood(state, {
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
    assert.equal(HARTHMERE_COOKING_RECIPES.worker_meal.stationKind, "cookpot");
  });

  it("rejects invalid cooking recipes, counts, missing stations, and missing inputs", () => {
    const state = defaultHarthmereFoodStaminaState("player_farm_1", NOW);
    state.inventory.loaf_bread = 1;

    const unknown = cookHarthmereFood(state, {
      recipeId: "imaginary_soup",
      stationKind: "cookpot",
      nowMs: NOW,
    });
    assert.ok(unknown.warnings.includes("cooking_rejected:unknown_recipe"));

    const badCount = cookHarthmereFood(state, {
      recipeId: "worker_meal",
      stationKind: "cookpot",
      count: 0,
      nowMs: NOW,
    });
    assert.ok(badCount.warnings.includes("cooking_rejected:invalid_count"));

    const missingStation = cookHarthmereFood(state, {
      recipeId: "worker_meal",
      stationKind: "campfire",
      nowMs: NOW,
    });
    assert.ok(missingStation.warnings.includes("cooking_rejected:missing_station:cookpot"));

    const missingInput = cookHarthmereFood(state, {
      recipeId: "worker_meal",
      stationKind: "cookpot",
      nowMs: NOW,
    });
    assert.ok(missingInput.warnings.includes("cooking_rejected:missing_input:fresh_carrot"));

    const tooLarge = cookHarthmereFood({
      ...state,
      inventory: { raw_meat: 99 },
    }, {
      recipeId: "grilled_meat",
      stationKind: "campfire",
      count: HARTHMERE_COOKING_RECIPES.grilled_meat.maxBatchCount + 1,
      nowMs: NOW,
    });
    assert.ok(tooLarge.warnings.includes("cooking_rejected:batch_too_large"));
  });

  it("rejects livestock and protected species from wild hunting", () => {
    const state = defaultHarthmereFoodStaminaState("player_farm_1", NOW);
    state.spawns.cow_1 = { spawnId: "cow_1", kind: "animal", hp: 0, maxHp: 20, isLivestock: true };
    state.spawns.deer_1 = { spawnId: "deer_1", kind: "animal", hp: 0, maxHp: 20, protected: true };

    const cattle = huntHarthmereAnimalForFood(state, { animalId: "cow_1", nowMs: NOW });
    assert.ok(cattle.warnings.includes("hunt_rejected:livestock_requires_care_action"));

    const protectedSpecies = huntHarthmereAnimalForFood(state, { animalId: "deer_1", nowMs: NOW });
    assert.ok(protectedSpecies.warnings.includes("hunt_rejected:protected_species"));
  });

  it("feeds cattle and collects milk only after the animal is cared for and ready", () => {
    let state = defaultHarthmereFoodStaminaState("player_farm_1", NOW);
    state.inventory.seed_wheat = 1;
    state.livestock.cow_1 = {
      livestockId: "cow_1",
      species: "cow",
      ownerId: "player_farm_1",
      health: 40,
      hunger: 10,
      productItemId: "fresh_milk",
      productReadyAtMs: NOW + HARTHMERE_LIVESTOCK_PRODUCT_INTERVAL_MS,
    };

    const notReady = collectHarthmereLivestockProduct(state, { livestockId: "cow_1", nowMs: NOW });
    assert.ok(notReady.warnings.includes("livestock_rejected:animal_needs_care"));

    let result = feedHarthmereLivestock(state, {
      livestockId: "cow_1",
      feedItemId: "seed_wheat",
      nowMs: NOW,
    });
    assert.equal(result.state.inventory.seed_wheat, 0);
    assert.ok(result.state.livestock.cow_1.hunger > 25);
    state = result.state;

    const earlyMilk = collectHarthmereLivestockProduct(state, {
      livestockId: "cow_1",
      nowMs: NOW + 60_000,
    });
    assert.ok(earlyMilk.warnings.includes("livestock_rejected:product_not_ready"));

    result = collectHarthmereLivestockProduct(state, {
      livestockId: "cow_1",
      nowMs: state.livestock.cow_1.productReadyAtMs,
    });
    assert.equal(result.state.inventory.fresh_milk, 1);
    assert.equal(result.state.livestock.cow_1.lastCollectedAtMs, state.livestock.cow_1.productReadyAtMs);
  });

  it("allows Bikkie seeds and crop foods to feed livestock", () => {
    const state = defaultHarthmereFoodStaminaState("player_farm_1", NOW);
    state.inventory["1534621126189364"] = 1;
    state.livestock.cow_1 = {
      livestockId: "cow_1",
      species: "cow",
      ownerId: "player_farm_1",
      health: 20,
      hunger: 5,
      productItemId: "fresh_milk",
      productReadyAtMs: NOW + HARTHMERE_LIVESTOCK_PRODUCT_INTERVAL_MS,
    };

    const result = feedHarthmereLivestock(state, {
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
    let state = defaultHarthmereFoodStaminaState("player_farm_1", NOW);
    state.stamina = 20;
    let result = tickHarthmereStamina(state, NOW + 5 * 60_000);
    assert.equal(result.deathTriggered, false);
    assert.ok(result.state.stamina > 15 && result.state.stamina < 16);

    result = eatHarthmereFood(result.state, { itemId: "road_ration", nowMs: NOW + 5 * 60_000 });
    assert.ok(result.state.stamina > 39 && result.state.stamina < 40);

    result = tickHarthmereStamina(result.state, NOW + 30 * 60_000);
    assert.ok(result.state.stamina > 18 && result.state.stamina < 20);
    assert.equal(result.deathTriggered, false);

    result = tickHarthmereStamina(result.state, NOW + 2 * 60 * 60_000);
    assert.equal(result.state.stamina, 0);
    assert.equal(result.deathTriggered, true);
    assert.ok(result.state.deadFromStaminaAtMs);
  });

  it("keeps food stamina-only and does not restore health", () => {
    const state = defaultHarthmereFoodStaminaState("player_farm_1", NOW) as any;
    state.inventory.grilled_meat = 1;
    state.stamina = 80;
    state.health = 50;
    state.maxHealth = 100;

    const result = eatHarthmereFood(state, { itemId: "grilled_meat", nowMs: NOW });
    assert.equal(result.state.stamina, 100);
    assert.equal((result.state as any).health, 50);
    assert.equal(result.state.inventory.grilled_meat, 0);
  });

  it("lets a full 100 stamina bar last exactly two hours before starvation death", () => {
    // Spec: 100 stamina = 2 hours of gameplay.
    assert.equal(HARTHMERE_FULL_STAMINA_SURVIVAL_MINUTES, 120);
    const state = defaultHarthmereFoodStaminaState("player_farm_1", NOW);

    const justBefore = tickHarthmereStamina(
      state,
      NOW + (HARTHMERE_FULL_STAMINA_SURVIVAL_MINUTES - 1) * 60_000,
    );
    assert.equal(justBefore.deathTriggered, false);
    assert.ok(justBefore.state.stamina > 0);

    const atTwoHours = tickHarthmereStamina(
      state,
      NOW + HARTHMERE_FULL_STAMINA_SURVIVAL_MINUTES * 60_000,
    );
    assert.equal(atTwoHours.state.stamina, 0);
    assert.equal(atTwoHours.deathTriggered, true);
  });

  it("drains at a constant 100-stamina-per-2-hours rate regardless of max stamina", () => {
    const state = {
      ...defaultHarthmereFoodStaminaState("player_farm_1", NOW),
      stamina: 200,
      maxStamina: 200,
    };

    // Constant rate = 50 stamina/hour (100 per 2h), so a 200 bar loses 50 in the first hour.
    const afterOneHour = tickHarthmereStamina(state, NOW + 60 * 60_000);
    assert.equal(afterOneHour.state.stamina, 150);
    assert.equal(afterOneHour.deathTriggered, false);

    // A 200 bar therefore lasts 4 hours (twice the default 100 bar's 2-hour survival).
    const atSurvival = tickHarthmereStamina(
      state,
      NOW + 2 * HARTHMERE_FULL_STAMINA_SURVIVAL_MINUTES * 60_000,
    );
    assert.equal(atSurvival.state.stamina, 0);
    assert.equal(atSurvival.deathTriggered, true);
  });

  it("drains stamina faster when carrying weight over the limit, and at the base rate otherwise", () => {
    // steel_sword weighs 5 lb each (tools). 6 = 30 lb → 5 lb over the 25 lb limit.
    const carryWeight = harthmereInventoryCarryWeight({ steel_sword: 6 });
    assert.equal(carryWeight, 30);
    const multiplier = harthmereEncumbranceStaminaMultiplier(carryWeight);
    assert.ok(
      Math.abs(
        multiplier -
          Math.pow(HARTHMERE_ENCUMBRANCE_STAMINA_DRAIN_FACTOR_PER_LB, 5)
      ) < 1e-9
    );
    assert.ok(multiplier > 1);

    const oneMinute = 60_000;
    const baseState = {
      ...defaultHarthmereFoodStaminaState("player_light", NOW),
      // Default inventory (road_ration ×2 = 2 lb) is well under the limit.
      stamina: 100,
      maxStamina: 100,
    };
    const overState = {
      ...defaultHarthmereFoodStaminaState("player_heavy", NOW),
      inventory: { steel_sword: 6 },
      stamina: 100,
      maxStamina: 100,
    };

    const baseDrain =
      100 - tickHarthmereStamina(baseState, NOW + oneMinute).state.stamina;
    const overDrain =
      100 - tickHarthmereStamina(overState, NOW + oneMinute).state.stamina;

    // The light player drains at exactly the constant base rate (no penalty).
    assert.ok(Math.abs(baseDrain - HARTHMERE_STAMINA_DRAIN_PER_MINUTE) < 1e-9);
    // The overweight player drains by the compounded encumbrance multiplier.
    assert.ok(Math.abs(overDrain - baseDrain * multiplier) < 1e-9);
  });

  it("does not penalize stamina drain at exactly the carry-weight limit", () => {
    // steel_sword ×5 = 25 lb = the limit exactly → no encumbrance penalty.
    assert.equal(harthmereInventoryCarryWeight({ steel_sword: 5 }), 25);
    const atLimit = {
      ...defaultHarthmereFoodStaminaState("player_at_limit", NOW),
      inventory: { steel_sword: 5 },
      stamina: 100,
      maxStamina: 100,
    };
    const oneHour = 60 * 60_000;
    const after = tickHarthmereStamina(atLimit, NOW + oneHour);
    // Base rate = 50 stamina/hour, unchanged by the at-limit load.
    assert.equal(after.state.stamina, 50);
  });

  it("applies the encumbrance penalty to the pending drain when eating while overweight", () => {
    const food = Object.values(HARTHMERE_FOOD_DEFINITIONS).find(
      (f) => f.edible !== false && f.staminaRestore > 0
    );
    assert.ok(food, "expected at least one edible food definition");
    const overState = {
      ...defaultHarthmereFoodStaminaState("player_heavy_eater", NOW),
      // Overweight load plus one unit of the food being eaten.
      inventory: { steel_sword: 6, [food!.itemId]: 1 },
      // Start mid-bar so the restored meal does not clamp at max and hide the penalty.
      stamina: 50,
      maxStamina: 100,
    };
    const multiplier = harthmereEncumbranceStaminaMultiplier(
      harthmereInventoryCarryWeight(overState.inventory)
    );
    assert.ok(multiplier > 1);
    const oneMinute = 60_000;
    const result = eatHarthmereFood(overState, {
      itemId: food!.itemId,
      nowMs: NOW + oneMinute,
    });
    const pendingDrain =
      HARTHMERE_STAMINA_DRAIN_PER_MINUTE * multiplier;
    const expected = Math.min(
      100,
      50 - pendingDrain + food!.staminaRestore
    );
    assert.ok(Math.abs(result.state.stamina - expected) < 1e-9);
  });

  it("normalizes malformed stamina values instead of skipping death checks", () => {
    const badMax = tickHarthmereStamina({
      ...defaultHarthmereFoodStaminaState("player_farm_1", NOW),
      stamina: Number.NaN,
      maxStamina: Number.NaN,
      lastStaminaTickMs: Number.NaN,
    }, NOW);
    assert.equal(badMax.state.stamina, 100);
    assert.equal(badMax.state.maxStamina, 100);
    assert.equal(badMax.deathTriggered, false);

    const backwardsClock = tickHarthmereStamina({
      ...defaultHarthmereFoodStaminaState("player_farm_1", NOW),
      lastStaminaTickMs: NOW + 60_000,
    }, NOW);
    assert.equal(backwardsClock.state.stamina, 100);
    assert.equal(backwardsClock.state.lastStaminaTickMs, NOW + 60_000);
  });

  it("does not drain stamina while gameplay is inactive", () => {
    const state = defaultHarthmereFoodStaminaState("player_farm_1", NOW);
    const result = tickHarthmereStaminaForGameplay(state, {
      nowMs: NOW + 8 * 60 * 60 * 1000,
      gameplayActive: false,
    });

    assert.equal(result.deathTriggered, false);
    assert.equal(result.state.stamina, state.stamina);
    assert.equal(result.state.deadFromStaminaAtMs, undefined);
    assert.equal(result.state.lastStaminaTickMs, NOW + 8 * 60 * 60 * 1000);
  });

  it("drains and can kill only once gameplay is active again", () => {
    const state = defaultHarthmereFoodStaminaState("player_farm_1", NOW);
    const paused = tickHarthmereStaminaForGameplay(state, {
      nowMs: NOW + 8 * 60 * 60 * 1000,
      gameplayActive: false,
    });
    const active = tickHarthmereStaminaForGameplay(paused.state, {
      nowMs:
        paused.state.lastStaminaTickMs +
        HARTHMERE_FULL_STAMINA_SURVIVAL_MINUTES * 60_000,
      gameplayActive: true,
    });

    assert.equal(active.state.stamina, 0);
    assert.equal(active.deathTriggered, true);
    assert.ok(active.state.deadFromStaminaAtMs);
  });

  it("restores stamina to full on respawn and clears starvation death", () => {
    const state = defaultHarthmereFoodStaminaState("player_farm_1", NOW);
    const dead = tickHarthmereStamina(
      state,
      NOW + HARTHMERE_FULL_STAMINA_SURVIVAL_MINUTES * 60_000,
    );
    const restored = restoreHarthmereStaminaToFull(
      dead.state,
      NOW + HARTHMERE_FULL_STAMINA_SURVIVAL_MINUTES * 60_000 + 1_000,
    );

    assert.equal(restored.state.stamina, 100);
    assert.equal(restored.state.deadFromStaminaAtMs, undefined);
    assert.equal(restored.deathTriggered, false);
  });

  it("does not let food revive a stamina-dead player", () => {
    const state = defaultHarthmereFoodStaminaState("player_farm_1", NOW);
    const dead = tickHarthmereStamina(
      state,
      NOW + HARTHMERE_FULL_STAMINA_SURVIVAL_MINUTES * 60_000,
    );

    const eaten = eatHarthmereFood(dead.state, {
      itemId: "road_ration",
      nowMs: NOW + HARTHMERE_FULL_STAMINA_SURVIVAL_MINUTES * 60_000 + 1_000,
    });

    assert.ok(eaten.warnings.includes("food_rejected:stamina_depleted"));
    assert.equal(eaten.state.stamina, 0);
    assert.equal(eaten.state.inventory.road_ration, 2);
    assert.equal(eaten.state.deadFromStaminaAtMs, dead.state.deadFromStaminaAtMs);
  });

  it("respawns resources and regenerates monster health to full after half a day", () => {
    let state = defaultHarthmereFoodStaminaState("player_farm_1", NOW);
    state.spawns.food_1 = {
      spawnId: "food_1",
      kind: "food",
      itemId: "wild_berries",
      depletedAtMs: NOW,
      respawnAtMs: NOW + HARTHMERE_HALF_DAY_MS,
    };
    state.spawns.mucker_1 = {
      spawnId: "mucker_1",
      kind: "monster",
      hp: 10,
      maxHp: 100,
      lastDamagedAtMs: NOW,
      lastRegenAtMs: NOW,
    };

    let result = tickHarthmereWorldRespawnAndRegen(state, NOW + HARTHMERE_HALF_DAY_MS / 2);
    assert.equal(result.state.spawns.food_1.depletedAtMs, NOW);
    assert.equal(Math.round(result.state.spawns.mucker_1.hp ?? 0), 60);

    result = tickHarthmereWorldRespawnAndRegen(result.state, NOW + HARTHMERE_HALF_DAY_MS);
    assert.equal(result.state.spawns.food_1.depletedAtMs, undefined);
    assert.equal(result.state.spawns.food_1.respawnAtMs, undefined);
    assert.equal(Math.round(result.state.spawns.mucker_1.hp ?? 0), 100);
  });

  it("records death and respawn timers when animal or monster spawns are killed", () => {
    const state = defaultHarthmereFoodStaminaState("player_farm_1", NOW);
    state.spawns.mucker_1 = { spawnId: "mucker_1", kind: "monster", hp: 15, maxHp: 40 };

    const result = damageHarthmereSpawn(state, { spawnId: "mucker_1", damage: 99, nowMs: NOW });

    assert.equal(result.state.spawns.mucker_1.hp, 0);
    assert.equal(result.state.spawns.mucker_1.depletedAtMs, NOW);
    assert.equal(result.state.spawns.mucker_1.respawnAtMs, NOW + HARTHMERE_HALF_DAY_MS);
  });
});

describe("mmo_farming_food_stamina — survival clock + farming edge cases (audit hardening)", () => {
  it("applies pending stamina drain before crediting an eaten meal", () => {
    const foodId = Object.keys(HARTHMERE_FOOD_DEFINITIONS).find(
      (id) =>
        HARTHMERE_FOOD_DEFINITIONS[id].edible !== false &&
        HARTHMERE_FOOD_DEFINITIONS[id].staminaRestore > 0,
    )!;
    const restore = HARTHMERE_FOOD_DEFINITIONS[foodId].staminaRestore;
    // 60 minutes of drain at the constant rate (100 per 2h => 50/hour).
    const drainOverHour = 60 * HARTHMERE_STAMINA_DRAIN_PER_MINUTE;
    const startStamina = 80;
    const base = {
      ...defaultHarthmereFoodStaminaState("p_eat_drain", NOW),
      stamina: startStamina,
      maxStamina: 100,
      lastStaminaTickMs: NOW,
      inventory: { [foodId]: 2 },
    };
    // Eat 60 min later WITHOUT a preceding tick: the drain must still be applied first.
    const eaten = eatHarthmereFood(base, { itemId: foodId, nowMs: NOW + 60 * 60 * 1000 });
    assert.deepEqual(eaten.warnings, []);
    const expected = Math.min(100, Math.max(0, startStamina - drainOverHour) + restore);
    assert.ok(
      Math.abs(eaten.state.stamina - expected) < 0.01,
      `stamina ${eaten.state.stamina} should be drain-then-restore ${expected}, not the no-drain ${Math.min(100, startStamina + restore)}`,
    );
  });

  it("watering never changes the grow timer (cannot make a crop instantly harvestable)", () => {
    const state = defaultHarthmereFoodStaminaState("p_water_cap", NOW);
    state.inventory.seed_carrot = 1;
    const planted = plantHarthmereCrop(state, { plotId: "fast_plot", seedItemId: "seed_carrot", nowMs: NOW });
    assert.deepEqual(planted.warnings, []);
    const plot = planted.state.plots.fast_plot;
    const readyBefore = plot.harvestReadyAtMs;
    const watered = waterHarthmereCrop(planted.state, { plotId: "fast_plot", nowMs: plot.plantedAtMs });
    assert.deepEqual(watered.warnings, []);
    // Watering records the watered time but leaves the ripen time untouched.
    assert.equal(watered.state.plots.fast_plot.harvestReadyAtMs, readyBefore);
    const early = harvestHarthmereCrop(watered.state, { plotId: "fast_plot", nowMs: plot.plantedAtMs });
    assert.ok(early.warnings.includes("farming_rejected:not_ready"));
  });

  it("yields a full harvest only when watered; unwatered crops yield less", () => {
    const base = defaultHarthmereFoodStaminaState("p_yield", NOW);
    base.inventory.seed_carrot = 2; // carrot yields 3

    // Unwatered: reduced yield (ceil(3/2) = 2).
    const dryPlant = plantHarthmereCrop(base, { plotId: "dry", seedItemId: "seed_carrot", nowMs: NOW });
    const dryReady = dryPlant.state.plots.dry.harvestReadyAtMs;
    const dryHarvest = harvestHarthmereCrop(dryPlant.state, { plotId: "dry", nowMs: dryReady });
    assert.equal(dryHarvest.state.inventory.fresh_carrot, 2);

    // Watered: full yield (3).
    const wetPlant = plantHarthmereCrop(dryHarvest.state, { plotId: "wet", seedItemId: "seed_carrot", nowMs: NOW });
    const watered = waterHarthmereCrop(wetPlant.state, { plotId: "wet", nowMs: NOW + 1000 });
    const wetReady = watered.state.plots.wet.harvestReadyAtMs;
    const wetHarvest = harvestHarthmereCrop(watered.state, { plotId: "wet", nowMs: wetReady });
    // 2 (carried from dry) + 3 (full) = 5.
    assert.equal(wetHarvest.state.inventory.fresh_carrot, 5);
  });

  it("does not let feeding livestock pull the product timer earlier", () => {
    const state = defaultHarthmereFoodStaminaState("p_feed", NOW);
    state.inventory.seed_wheat = 1;
    const farFuture = NOW + 10 * HARTHMERE_LIVESTOCK_PRODUCT_INTERVAL_MS;
    state.livestock.cow_1 = {
      livestockId: "cow_1",
      species: "cow",
      ownerId: "p_feed",
      health: 50,
      hunger: 50,
      productItemId: "fresh_milk",
      productReadyAtMs: farFuture,
    };
    const result = feedHarthmereLivestock(state, { livestockId: "cow_1", feedItemId: "seed_wheat", nowMs: NOW });
    assert.deepEqual(result.warnings, []);
    assert.ok(
      result.state.livestock.cow_1.productReadyAtMs >= farFuture,
      "feeding must not shorten the product-ready timer",
    );
  });

  it("normalizes corrupt (NaN) livestock health/hunger as needs-care instead of waving collection through", () => {
    const state = defaultHarthmereFoodStaminaState("p_nan", NOW);
    state.livestock.cow_1 = {
      livestockId: "cow_1",
      species: "cow",
      ownerId: "p_nan",
      health: Number.NaN,
      hunger: Number.NaN,
      productItemId: "fresh_milk",
      productReadyAtMs: NOW - 1, // already "ready" so only the care gate can block it
    };
    const collected = collectHarthmereLivestockProduct(state, { livestockId: "cow_1", nowMs: NOW });
    assert.ok(collected.warnings.includes("livestock_rejected:animal_needs_care"));
  });
});

describe("mmo_farming_food_stamina — crop death/spoilage (audit hardening)", () => {
  const TOMATO_SEED = "1534621126189358"; // grow 3 days, death window 5 days
  const DAY_MS = 24 * 60 * 60 * 1000;

  it("withers a crop left unharvested past its death window and frees the plot for replant", () => {
    const state = defaultHarthmereFoodStaminaState("p_death", NOW);
    state.inventory[TOMATO_SEED] = 2;
    const planted = plantHarthmereCrop(state, { plotId: "death_plot", seedItemId: TOMATO_SEED, nowMs: NOW });
    assert.deepEqual(planted.warnings, []);

    // Harvest 6 days later — past the 5-day death window — yields nothing and withers.
    const withered = harvestHarthmereCrop(planted.state, { plotId: "death_plot", nowMs: NOW + 6 * DAY_MS });
    assert.ok(withered.warnings.includes("farming_rejected:crop_withered"));
    assert.ok(withered.state.plots.death_plot.diedAtMs, "plot is marked dead");
    // The rejection yields nothing — the seed's yield item is not granted.
    const yieldItem = HARTHMERE_SEED_DEFINITIONS[TOMATO_SEED].yieldItemId;
    const witheredDeltas = (withered as { itemDeltas?: Record<string, number> }).itemDeltas ?? {};
    assert.equal(witheredDeltas[yieldItem] ?? 0, 0, "withered crop yields nothing");

    // A withered plot can be cleared and replanted.
    const replanted = plantHarthmereCrop(withered.state, { plotId: "death_plot", seedItemId: TOMATO_SEED, nowMs: NOW + 6 * DAY_MS });
    assert.deepEqual(replanted.warnings, []);
    assert.equal(replanted.state.plots.death_plot.diedAtMs, undefined, "replant clears the dead marker");
  });

  it("still harvests a crop within its death window", () => {
    const state = defaultHarthmereFoodStaminaState("p_window", NOW);
    state.inventory[TOMATO_SEED] = 1;
    const planted = plantHarthmereCrop(state, { plotId: "window_plot", seedItemId: TOMATO_SEED, nowMs: NOW });
    // 4 days: after the 3-day grow, before the 5-day death window → harvest succeeds.
    const harvested = harvestHarthmereCrop(planted.state, { plotId: "window_plot", nowMs: NOW + 4 * DAY_MS });
    assert.deepEqual(harvested.warnings, []);
    assert.ok(harvested.state.plots.window_plot.harvestedAtMs);
  });
});

describe("mmo_farming_food_stamina — sun requirement (audit fix)", () => {
  const SWEET_CORN_SEED = "4851938639186947"; // requiresSun: true

  it("rejects planting a sun crop in a shaded plot, allows it in sun", () => {
    const base = defaultHarthmereFoodStaminaState("p_sun", NOW);
    base.inventory[SWEET_CORN_SEED] = 2;
    assert.equal(HARTHMERE_SEED_DEFINITIONS[SWEET_CORN_SEED].requiresSun, true);

    const shade = plantHarthmereCrop(base, {
      plotId: "shade_plot",
      seedItemId: SWEET_CORN_SEED,
      nowMs: NOW,
      plotHasSun: false,
    });
    assert.ok(shade.warnings.includes("farming_rejected:requires_sun"));

    const sun = plantHarthmereCrop(base, {
      plotId: "sun_plot",
      seedItemId: SWEET_CORN_SEED,
      nowMs: NOW,
      plotHasSun: true,
    });
    assert.deepEqual(sun.warnings, []);

    // Unknown sun (undefined) defaults to allowed so existing callers don't break.
    const unknown = plantHarthmereCrop(base, {
      plotId: "unknown_plot",
      seedItemId: SWEET_CORN_SEED,
      nowMs: NOW,
    });
    assert.deepEqual(unknown.warnings, []);
  });

  it("does not gate a non-sun crop even in shade", () => {
    const base = defaultHarthmereFoodStaminaState("p_shade_ok", NOW);
    base.inventory.seed_carrot = 1;
    const planted = plantHarthmereCrop(base, {
      plotId: "p",
      seedItemId: "seed_carrot",
      nowMs: NOW,
      plotHasSun: false,
    });
    assert.deepEqual(planted.warnings, []);
  });
});

describe("mmo_farming_food_stamina — data fixes (audit)", () => {
  it("clamps absurd authored water intervals into a sane band", () => {
    // Strawberry Seed's raw interval is ~10.6 quadrillion ms; must be clamped.
    const strawberry = HARTHMERE_SEED_DEFINITIONS["4537020877769691"];
    assert.ok(strawberry.waterIntervalMs !== undefined);
    assert.ok(
      strawberry.waterIntervalMs! <= HARTHMERE_FARM_MAX_WATER_INTERVAL_MS,
      `interval ${strawberry.waterIntervalMs} not clamped`,
    );
    // Every seed's interval is within the sane band.
    for (const seed of Object.values(HARTHMERE_SEED_DEFINITIONS)) {
      if (seed.waterIntervalMs !== undefined) {
        assert.ok(
          seed.waterIntervalMs <= HARTHMERE_FARM_MAX_WATER_INTERVAL_MS,
          `${seed.seedItemId} interval not clamped`,
        );
      }
    }
  });

  it("gives Banana Seed a sane yield (not the 11 outlier)", () => {
    assert.equal(HARTHMERE_SEED_DEFINITIONS["1534621126189361"].yieldCount, 3);
  });

  it("fixes the Muck-me-not Seeds recipe to output muck-me-not (not Ultra Violet)", () => {
    const recipe = HARTHMERE_COOKING_RECIPES["3752138317055497"];
    assert.ok(recipe, "muck-me-not recipe exists");
    assert.ok(
      (recipe.outputs["922013052023689"] ?? 0) > 0,
      "outputs the Muck-me-not Seed id",
    );
    assert.equal(
      recipe.outputs["6905450518852631"] ?? 0,
      0,
      "no longer outputs the Ultra Violet Seed id",
    );
  });

  it("fixes the Golden Mushroom Spores recipe to output gold (not muckshroom) spores", () => {
    const recipe = HARTHMERE_COOKING_RECIPES["3242894934816699"];
    assert.ok(recipe, "golden mushroom recipe exists");
    assert.ok((recipe.outputs["1108069497496786"] ?? 0) > 0);
    assert.equal(recipe.outputs["3170539650465345"] ?? 0, 0);
  });
});
