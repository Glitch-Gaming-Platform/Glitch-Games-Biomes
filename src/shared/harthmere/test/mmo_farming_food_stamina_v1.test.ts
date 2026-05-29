import assert from "assert";
import {
  HARTHMERE_HALF_DAY_MS_V1,
  cookHarthmereFoodV1,
  damageHarthmereSpawnV1,
  defaultHarthmereFoodStaminaStateV1,
  eatHarthmereFoodV1,
  gatherHarthmereSeedV1,
  harvestHarthmereCropV1,
  huntHarthmereAnimalForFoodV1,
  plantHarthmereCropV1,
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

  it("depletes stamina over time, lets food recover it, and triggers death at zero", () => {
    let state = defaultHarthmereFoodStaminaStateV1("player_farm_1", NOW);
    state.stamina = 20;
    let result = tickHarthmereStaminaV1(state, NOW + 10 * 60_000);
    assert.equal(result.deathTriggered, false);
    assert.equal(result.state.stamina, 10);

    result = eatHarthmereFoodV1(result.state, { itemId: "road_ration", nowMs: NOW + 10 * 60_000 });
    assert.equal(result.state.stamina, 34);

    result = tickHarthmereStaminaV1(result.state, NOW + 60 * 60_000);
    assert.equal(result.state.stamina, 0);
    assert.equal(result.deathTriggered, true);
    assert.ok(result.state.deadFromStaminaAtMs);
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
