import { GameEvent } from "@/server/shared/api/game_event";
import { loadVoxeloo } from "@/server/shared/voxeloo";
import {
  addGameUser,
  editEntity,
  setItemAtSlotIndex,
  TestLogicApi,
} from "@/server/test/test_helpers";
import { BikkieRuntime } from "@/shared/bikkie/active";
import { ConsumptionEvent } from "@/shared/ecs/gen/events";
import { countOf } from "@/shared/game/items";
import {
  ensureHarthmereNativeItemCatalogue,
  harthmereBiscuitForItemDefinition,
  harthmereNativeBiomesIdForItemId,
} from "@/shared/harthmere/harthmere_native_bikkie_items";
import {
  readHarthmereNativeVitals,
  writeHarthmereNativeVitals,
} from "@/shared/harthmere/harthmere_native_vitals";
import { generateTestId } from "@/shared/test_helpers";
import type { VoxelooModule } from "@/shared/wasm/types";
import assert from "assert";

describe("Harthmere native ECS consumption", () => {
  let voxeloo!: VoxelooModule;
  before(async () => {
    voxeloo = await loadVoxeloo();
    const definitions = ensureHarthmereNativeItemCatalogue();
    const fixtures = new Map();
    for (const itemId of ["road_ration", "health_potion", "mana_draught"]) {
      const definition = definitions.find((entry) => entry.itemId === itemId)!;
      const biscuit = harthmereBiscuitForItemDefinition(definition);
      fixtures.set(biscuit.id, biscuit);
    }
    BikkieRuntime.get().registerBiscuits(fixtures);
  });

  let logic: TestLogicApi;
  beforeEach(() => {
    logic = new TestLogicApi(voxeloo);
  });

  it("consumes one food item from inventory and restores stamina", async () => {
    const playerId = (await addGameUser(logic.world, generateTestId(), {})).id;
    const rationId = harthmereNativeBiomesIdForItemId("road_ration")!;
    setItemAtSlotIndex(logic.world, playerId, countOf(rationId, 1n), 0);
    editEntity(logic.world, playerId, (player) => {
      writeHarthmereNativeVitals(player.mutableTriggerState(), {
        stamina: 50,
        maxStamina: 100,
      });
    });

    await logic.publish(
      new GameEvent(
        playerId,
        new ConsumptionEvent({
          id: playerId,
          item_id: rationId,
          inventory_ref: { kind: "item", idx: 0 },
          action: "eat",
        })
      )
    );

    const player = logic.world.table.get(playerId)!;
    assert.equal(player.inventory?.items[0], undefined);
    assert.equal(readHarthmereNativeVitals(player.trigger_state).stamina, 74);
  });

  it("consumes one health item from inventory and restores HP", async () => {
    const playerId = (await addGameUser(logic.world, generateTestId(), {})).id;
    const healthPotionId = harthmereNativeBiomesIdForItemId("health_potion")!;
    setItemAtSlotIndex(logic.world, playerId, countOf(healthPotionId, 1n), 0);
    editEntity(logic.world, playerId, (player) => {
      const health = player.mutableHealth();
      health.hp = 80;
      health.maxHp = 100;
    });

    await logic.publish(
      new GameEvent(
        playerId,
        new ConsumptionEvent({
          id: playerId,
          item_id: healthPotionId,
          inventory_ref: { kind: "item", idx: 0 },
          action: "drink",
        })
      )
    );
    const player = logic.world.table.get(playerId)!;
    assert.equal(player.health?.hp, 100);
    assert.equal(player.inventory?.items[0], undefined);
  });

  it("restores native mana without exceeding its maximum", async () => {
    const playerId = (await addGameUser(logic.world, generateTestId(), {})).id;
    const manaDraughtId = harthmereNativeBiomesIdForItemId("mana_draught")!;
    setItemAtSlotIndex(logic.world, playerId, countOf(manaDraughtId, 1n), 0);
    editEntity(logic.world, playerId, (player) => {
      writeHarthmereNativeVitals(player.mutableTriggerState(), {
        mana: 80,
        maxMana: 100,
      });
    });

    await logic.publish(
      new GameEvent(
        playerId,
        new ConsumptionEvent({
          id: playerId,
          item_id: manaDraughtId,
          inventory_ref: { kind: "item", idx: 0 },
          action: "drink",
        })
      )
    );

    const player = logic.world.table.get(playerId)!;
    assert.equal(readHarthmereNativeVitals(player.trigger_state).mana, 100);
    assert.equal(player.inventory?.items[0], undefined);
  });
});
