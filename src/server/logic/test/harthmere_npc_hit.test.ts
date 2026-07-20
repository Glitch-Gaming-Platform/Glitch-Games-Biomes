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
import { harthmereGroundedMuckMonsterSeedsInTerritory } from "@/shared/harthmere/live_entity_production_seed";
import { harthmereSharedLiveCreatureRespawnRegistry } from "@/shared/harthmere/live_creature_respawn_registry";

// Native NPC health is the one combat authority for Harthmere seeds. The handler
// also verifies melee reach so a voxel interaction or forged client event cannot
// damage an NPC from outside combat range.
describe("Harthmere mucker hit (updateNpcHealthEvent)", () => {
  let voxeloo!: VoxelooModule;
  before(async () => {
    voxeloo = await loadVoxeloo();
  });

  let logic: TestLogicApi;
  beforeEach(() => {
    logic = new TestLogicApi(voxeloo);
  });

  function spawnMucker(
    position: [number, number, number],
    entityId?: BiomesId
  ): BiomesId {
    const id = entityId ?? generateTestId();
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
    const attacker = (
      await addGameUser(logic.world, generateTestId(), {
        position: [0, 0, 0],
      })
    ).id;
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

  it("applies native attack damage to Harthmere seeded NPCs", async () => {
    const attacker = (
      await addGameUser(logic.world, generateTestId(), {
        position: [0, 0, 0],
      })
    ).id;
    const managedMuckerId = spawnMucker(
      [2, 0, 0],
      8810000000019451 as BiomesId
    );

    await logic.publish(
      new GameEvent(
        attacker,
        new UpdateNpcHealthEvent({
          id: managedMuckerId,
          hp: -90,
          damageSource: { kind: "attack", attacker, dir: [1, 0, 0] },
        })
      )
    );

    const [, mucker] = logic.world.table.getWithVersion(managedMuckerId);
    assert.equal(mucker?.health?.hp, 10);
  });

  it("rejects a remote client-published melee hit", async () => {
    const attacker = (
      await addGameUser(logic.world, generateTestId(), {
        position: [0, 0, 0],
      })
    ).id;
    // A voxel can be interacted with at this distance, but a melee target cannot.
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
    assert.equal(mucker?.health?.hp, 100);
  });

  it("does not drive health below the kill threshold prematurely (sanity)", async () => {
    const attacker = (
      await addGameUser(logic.world, generateTestId(), {
        position: [0, 0, 0],
      })
    ).id;
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

  it("schedules fixed-id Harthmere creatures for delayed native respawn", async () => {
    const attacker = (
      await addGameUser(logic.world, generateTestId(), {
        position: [0, 0, 0],
      })
    ).id;
    const seedId = harthmereGroundedMuckMonsterSeedsInTerritory()[0].entityId;
    const registry = harthmereSharedLiveCreatureRespawnRegistry();
    registry.clear(seedId);
    spawnMucker([2, 0, 0], seedId);

    await logic.publish(
      new GameEvent(
        attacker,
        new UpdateNpcHealthEvent({
          id: seedId,
          hp: -100,
          damageSource: { kind: "attack", attacker, dir: [1, 0, 0] },
        })
      )
    );

    assert.ok((registry.respawnAt(seedId) ?? 0) > Date.now());
    registry.clear(seedId);
  });
});
