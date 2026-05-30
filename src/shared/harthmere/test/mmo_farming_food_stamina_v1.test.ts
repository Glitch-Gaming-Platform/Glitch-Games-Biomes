import assert from "assert";
import {
  HARTHMERE_COOKING_RECIPES_V1,
  HARTHMERE_HALF_DAY_MS_V1,
  HARTHMERE_LIVESTOCK_PRODUCT_INTERVAL_MS_V1,
  HARTHMERE_FULL_STAMINA_SURVIVAL_MINUTES_V1,
  collectHarthmereLivestockProductV1,
  cookHarthmereFoodV1,
  damageHarthmereSpawnV1,
  defaultHarthmereFoodStaminaStateV1,
  eatHarthmereFoodV1,
  feedHarthmereLivestockV1,
  forageHarthmereFoodSpawnV1,
  gatherHarthmereSeedV1,
  harvestHarthmereCropV1,
  huntHarthmereAnimalForFoodV1,
  plantHarthmereCropV1,
  restoreHarthmereStaminaToFullV1,
  tickHarthmereStaminaForGameplayV1,
  tickHarthmereStaminaV1,
  tickHarthmereWorldRespawnAndRegenV1,
  waterHarthmereCropV1,
} from "../mmo_farming_food_stamina_v1";

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

  it("depletes stamina over time, lets food recover it, and triggers death at zero", () => {
    let state = defaultHarthmereFoodStaminaStateV1("player_farm_1", NOW);
    state.stamina = 20;
    let result = tickHarthmereStaminaV1(state, NOW + 10 * 60_000);
    assert.equal(result.deathTriggered, false);
    assert.ok(result.state.stamina > 15 && result.state.stamina < 16);

    result = eatHarthmereFoodV1(result.state, { itemId: "road_ration", nowMs: NOW + 10 * 60_000 });
    assert.ok(result.state.stamina > 39 && result.state.stamina < 40);

    result = tickHarthmereStaminaV1(result.state, NOW + 60 * 60_000);
    assert.ok(result.state.stamina > 18 && result.state.stamina < 20);
    assert.equal(result.deathTriggered, false);

    result = tickHarthmereStaminaV1(result.state, NOW + 4 * 60 * 60_000);
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

  it("lets a full stamina bar last four hours before starvation death", () => {
    const state = defaultHarthmereFoodStaminaStateV1("player_farm_1", NOW);

    const justBefore = tickHarthmereStaminaV1(
      state,
      NOW + (HARTHMERE_FULL_STAMINA_SURVIVAL_MINUTES_V1 - 1) * 60_000,
    );
    assert.equal(justBefore.deathTriggered, false);
    assert.ok(justBefore.state.stamina > 0);

    const atFourHours = tickHarthmereStaminaV1(
      state,
      NOW + HARTHMERE_FULL_STAMINA_SURVIVAL_MINUTES_V1 * 60_000,
    );
    assert.equal(atFourHours.state.stamina, 0);
    assert.equal(atFourHours.deathTriggered, true);
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
