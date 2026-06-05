import { GameEvent } from "@/server/shared/api/game_event";
import { loadVoxeloo } from "@/server/shared/voxeloo";
import { addGameUser, TestLogicApi } from "@/server/test/test_helpers";
import {
  Health,
  NpcMetadata,
  NpcState,
  Position,
  RigidBody,
  Size,
} from "@/shared/ecs/gen/components";
import { UpdateNpcHealthEvent } from "@/shared/ecs/gen/events";
import { LOCAL_DEV_HUMAN_NPC_TYPE_ID } from "@/shared/npc/bikkie";
import { generateTestId } from "@/shared/test_helpers";
import type { BiomesId } from "@/shared/ids";
import type { VoxelooModule } from "@/shared/wasm/types";
import assert from "assert";

// Backend half of the "attacks don't hit muckers" fix. The client change widens
// the *detection* reach so the entity under the crosshair is published as a melee
// target out to voxel-break reach. This test pins the server contract that makes
// that sufficient: the updateNpcHealthEvent handler applies the client-published
// damage to a live NPC and has NO attacker-distance / reach gate of its own. So a
// hit detected at 8 units lands exactly like a point-blank hit.
describe("Harthmere mucker hit (updateNpcHealthEvent)", () => {
  let voxeloo!: VoxelooModule;
  before(async () => {
    voxeloo = await loadVoxeloo();
  });

  let logic: TestLogicApi;
  beforeEach(() => {
    logic = new TestLogicApi(voxeloo);
  });

  function spawnMucker(position: [number, number, number]): BiomesId {
    const id = generateTestId();
    logic.world.writeableTable.apply([
      {
        kind: "create",
        tick: logic.world.table.tick,
        entity: {
          id,
          position: Position.create({ v: position }),
          rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
          size: Size.create({ v: [1, 2, 1] }),
          health: Health.create({ hp: 100, maxHp: 100 }),
          npc_state: NpcState.create(),
          npc_metadata: NpcMetadata.create({
            type_id: LOCAL_DEV_HUMAN_NPC_TYPE_ID,
            created_time: 0,
            spawn_position: position,
            spawn_orientation: [0, 0],
          }),
        },
      },
    ]);
    return id;
  }

  it("applies attack damage to a live mucker", async () => {
    const attacker = (await addGameUser(logic.world, generateTestId(), {
      position: [0, 0, 0],
    })).id;
    const muckerId = spawnMucker([2, 0, 0]);

    await logic.publish(
      new GameEvent(
        attacker,
        new UpdateNpcHealthEvent({
          id: muckerId,
          hp: -9,
          damageSource: { kind: "attack", attacker, dir: [1, 0, 0] },
        })
      )
    );

    const [, mucker] = logic.world.table.getWithVersion(muckerId);
    assert.equal(mucker?.health?.hp, 91);
  });

  it("lands the same hit when the target is detected far out (no server reach gate)", async () => {
    const attacker = (await addGameUser(logic.world, generateTestId(), {
      position: [0, 0, 0],
    })).id;
    // ~8 units away -- inside voxel-break reach (8.78), far outside the old 3.5
    // melee cone. The server still applies it.
    const muckerId = spawnMucker([8, 0, 0]);

    await logic.publish(
      new GameEvent(
        attacker,
        new UpdateNpcHealthEvent({
          id: muckerId,
          hp: -25,
          damageSource: { kind: "attack", attacker, dir: [1, 0, 0] },
        })
      )
    );

    const [, mucker] = logic.world.table.getWithVersion(muckerId);
    assert.equal(mucker?.health?.hp, 75);
  });

  it("does not drive health below the kill threshold prematurely (sanity)", async () => {
    const attacker = (await addGameUser(logic.world, generateTestId(), {
      position: [0, 0, 0],
    })).id;
    const muckerId = spawnMucker([2, 0, 0]);

    await logic.publish(
      new GameEvent(
        attacker,
        new UpdateNpcHealthEvent({
          id: muckerId,
          hp: -10,
          damageSource: { kind: "attack", attacker, dir: [1, 0, 0] },
        })
      )
    );

    const [, mucker] = logic.world.table.getWithVersion(muckerId);
    assert.equal(mucker?.health?.hp, 90);
  });
});
