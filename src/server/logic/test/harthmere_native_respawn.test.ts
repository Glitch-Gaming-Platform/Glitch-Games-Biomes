import { GameEvent } from "@/server/shared/api/game_event";
import { loadVoxeloo } from "@/server/shared/voxeloo";
import {
  addGameUser,
  editEntity,
  TestLogicApi,
} from "@/server/test/test_helpers";
import { WarpHomeEvent } from "@/shared/ecs/gen/events";
import {
  HARTHMERE_GROVE_RESPAWN_POSITION,
  HARTHMERE_NATIVE_MAX_BREATH_SECONDS,
  readHarthmereNativeVitals,
  writeHarthmereNativeVitals,
} from "@/shared/harthmere/harthmere_native_vitals";
import { generateTestId } from "@/shared/test_helpers";
import type { VoxelooModule } from "@/shared/wasm/types";
import assert from "assert";

describe("Harthmere native ECS respawn", () => {
  let voxeloo!: VoxelooModule;
  before(async () => {
    voxeloo = await loadVoxeloo();
  });

  it("returns a dead player to the Grove with full health and resources", async () => {
    const logic = new TestLogicApi(voxeloo);
    const playerId = (
      await addGameUser(logic.world, generateTestId(), {
        position: [0, 0, 0],
      })
    ).id;
    editEntity(logic.world, playerId, (player) => {
      const health = player.mutableHealth();
      health.hp = 0;
      health.maxHp = 120;
      writeHarthmereNativeVitals(player.mutableTriggerState(), {
        mana: 0,
        maxMana: 90,
        stamina: 0,
        maxStamina: 110,
        breath: 0,
        maxBreath: 15,
      });
    });

    await logic.publish(
      new GameEvent(
        playerId,
        new WarpHomeEvent({
          id: playerId,
          position: [999, 999, 999],
          orientation: [0, 0],
          reason: "respawn",
        })
      )
    );

    const player = logic.world.table.get(playerId)!;
    assert.deepEqual(player.position?.v, HARTHMERE_GROVE_RESPAWN_POSITION);
    assert.equal(player.health?.hp, 120);
    const vitals = readHarthmereNativeVitals(player.trigger_state);
    assert.equal(vitals.mana, 90);
    assert.equal(vitals.stamina, 110);
    assert.equal(vitals.breath, HARTHMERE_NATIVE_MAX_BREATH_SECONDS);
  });
});
