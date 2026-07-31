import { GameEvent } from "@/server/shared/api/game_event";
import { authorizeCh1Warp } from "@/server/harthmere/ch1_warp_token";
import { loadVoxeloo } from "@/server/shared/voxeloo";
import {
  addGameUser,
  editEntity,
  TestLogicApi,
} from "@/server/test/test_helpers";
import {
  HarthmereChapter1WarpEvent,
  UpdatePlayerHealthEvent,
  WarpHomeEvent,
} from "@/shared/ecs/gen/events";
import {
  DeathInfo,
  Health,
  Position,
  RigidBody,
} from "@/shared/ecs/gen/components";
import {
  HARTHMERE_GROVE_RESPAWN_POSITION,
  HARTHMERE_NATIVE_MAX_BREATH_SECONDS,
  readHarthmereNativeVitals,
  writeHarthmereNativeVitals,
} from "@/shared/harthmere/harthmere_native_vitals";
import { generateTestId } from "@/shared/test_helpers";
import { harthmereRespawnPositionForDeath } from "@/shared/harthmere/harthmere_respawn_anchors";
import { HARTHMERE_ADDITIVE_TOWN_OFFSET_X } from "@/shared/harthmere/world_extension";
import { ch1ElsewhenSlot } from "@/shared/harthmere/ch1_elsewhen_region";
import { readCh1NativeRunAdmission } from "@/shared/harthmere/ch1_native_run";
import {
  ch1DungeonEncounterNpcsForDungeon,
  ch1DungeonEscortNpcsForDungeon,
} from "@/shared/harthmere/ch1_dungeon_encounters";
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

  // HARTHMERE_RESPAWN_ANCHORS (2026-07-30): a death in Harthmere used to send
  // the player to the Grove, ~1,600 blocks west, and make them walk the whole
  // connector road back. The test above still passes unchanged because it kills
  // the player at [0,0,0] — outside every settlement — which is exactly the
  // "everywhere else" case that must keep the Grove behaviour.
  it("returns a player who died in Harthmere to Harthmere", async () => {
    const logic = new TestLogicApi(voxeloo);
    const deathPosition: [number, number, number] = [
      486 + HARTHMERE_ADDITIVE_TOWN_OFFSET_X,
      53,
      -209,
    ];
    const playerId = (
      await addGameUser(logic.world, generateTestId(), {
        position: deathPosition,
      })
    ).id;
    editEntity(logic.world, playerId, (player) => {
      const health = player.mutableHealth();
      health.hp = 0;
      health.maxHp = 120;
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
    const expected = harthmereRespawnPositionForDeath(deathPosition);
    assert.equal(expected.region, "harthmere_extension");
    assert.deepEqual(player.position?.v, expected.position);
    assert.notDeepEqual(
      player.position?.v,
      HARTHMERE_GROVE_RESPAWN_POSITION,
      "a Harthmere death is still being sent to the Grove"
    );
    // Health still restores in the same transaction.
    assert.equal(player.health?.hp, 120);
  });

  it("keeps an admitted Chapter 1 death inside the portal-only dungeon", async () => {
    const logic = new TestLogicApi(voxeloo);
    const playerId = (
      await addGameUser(logic.world, generateTestId(), {
        position: [496, 71, -126],
      })
    ).id;
    const slot = ch1ElsewhenSlot("ch1_dungeon_desert")!;
    const enterInput = {
      id: playerId,
      action: "enter",
      dungeon_id: slot.dungeonId,
      run_id: "test-run",
      party_id: `solo:${playerId}`,
      reset_encounters: false,
      position: [...slot.arrival] as [number, number, number],
      orientation: [0, 0] as [number, number],
    } as const;
    await logic.publish(
      new GameEvent(
        playerId,
        new HarthmereChapter1WarpEvent({
          ...enterInput,
          authorization: authorizeCh1Warp(enterInput),
        })
      )
    );
    editEntity(logic.world, playerId, (player) => {
      player.mutableHealth().hp = 0;
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
    assert.deepEqual(player.position?.v, slot.arrival);
    assert.deepEqual(readCh1NativeRunAdmission(player.trigger_state), {
      dungeonId: slot.dungeonId,
      runId: "test-run",
      partyId: `solo:${playerId}`,
    });
  });

  it("enters Elsewhen while resetting the complete native encounter cast", async () => {
    const logic = new TestLogicApi(voxeloo);
    const playerId = (
      await addGameUser(logic.world, generateTestId(), {
        position: [496, 71, -126],
      })
    ).id;
    const slot = ch1ElsewhenSlot("ch1_dungeon_desert")!;
    const encounters = ch1DungeonEncounterNpcsForDungeon(slot.dungeonId);
    const escorts = ch1DungeonEscortNpcsForDungeon(slot.dungeonId);
    logic.world.applyChanges([
      ...encounters.map((npc) => ({
        kind: "create" as const,
        entity: {
          id: npc.entityId,
          position: Position.create({ v: [0, 0, 0] }),
          rigid_body: RigidBody.create({ velocity: [1, 2, 3] }),
          health: Health.create({ hp: 1, maxHp: 1 }),
        },
      })),
      ...escorts.map((npc) => ({
        kind: "create" as const,
        entity: {
          id: npc.entityId,
          position: Position.create({ v: [0, 0, 0] }),
          rigid_body: RigidBody.create({ velocity: [1, 2, 3] }),
        },
      })),
    ]);
    const enterInput = {
      id: playerId,
      action: "enter",
      dungeon_id: slot.dungeonId,
      run_id: "reset-run",
      party_id: `solo:${playerId}`,
      reset_encounters: true,
      position: [...slot.arrival] as [number, number, number],
      orientation: [0, 0] as [number, number],
    } as const;
    await logic.publish(
      new GameEvent(
        playerId,
        new HarthmereChapter1WarpEvent({
          ...enterInput,
          authorization: authorizeCh1Warp(enterInput),
        })
      )
    );

    const player = logic.world.table.get(playerId)!;
    assert.deepEqual(player.position?.v, slot.arrival);
    assert.deepEqual(readCh1NativeRunAdmission(player.trigger_state), {
      dungeonId: slot.dungeonId,
      runId: "reset-run",
      partyId: `solo:${playerId}`,
    });
    for (const npc of encounters) {
      const entity = logic.world.table.get(npc.entityId)!;
      assert.deepEqual(entity.position?.v, npc.position);
      assert.equal(entity.health?.hp, npc.maxHp);
      assert.deepEqual(entity.rigid_body?.velocity, [0, 0, 0]);
    }
    for (const npc of escorts) {
      const entity = logic.world.table.get(npc.entityId)!;
      assert.deepEqual(entity.position?.v, npc.startPosition);
      assert.deepEqual(entity.rigid_body?.velocity, [0, 0, 0]);
    }
  });

  it("rejects ordinary warps into Elsewhen", async () => {
    const logic = new TestLogicApi(voxeloo);
    const playerId = (
      await addGameUser(logic.world, generateTestId(), {
        position: [496, 71, -126],
      })
    ).id;
    const slot = ch1ElsewhenSlot("ch1_dungeon_desert")!;
    await logic.publish(
      new GameEvent(
        playerId,
        new WarpHomeEvent({
          id: playerId,
          position: [...slot.arrival],
          orientation: [0, 0],
          reason: "admin",
        })
      )
    );
    assert.deepEqual(
      logic.world.table.get(playerId)?.position?.v,
      [496, 71, -126]
    );
  });

  it("rejects ordinary warps into the portal-only void gap", async () => {
    const logic = new TestLogicApi(voxeloo);
    const playerId = (
      await addGameUser(logic.world, generateTestId(), {
        position: [496, 71, -126],
      })
    ).id;
    await logic.publish(
      new GameEvent(
        playerId,
        new WarpHomeEvent({
          id: playerId,
          position: [2580, 65, -126],
          orientation: [0, 0],
          reason: "admin",
        })
      )
    );
    assert.deepEqual(
      logic.world.table.get(playerId)?.position?.v,
      [496, 71, -126]
    );
  });

  it("clears the native death marker when an ally revive restores health", async () => {
    const logic = new TestLogicApi(voxeloo);
    const playerId = (
      await addGameUser(logic.world, generateTestId(), {
        position: [496, 71, -126],
      })
    ).id;
    editEntity(logic.world, playerId, (player) => {
      player.mutableHealth().hp = 0;
      player.setDeathInfo(
        DeathInfo.create({
          last_death_pos: [496, 71, -126],
          last_death_time: 1,
        })
      );
    });
    await logic.publish(
      new GameEvent(
        playerId,
        new UpdatePlayerHealthEvent({
          id: playerId,
          hp: 25,
          damageSource: { kind: "heal" },
        })
      )
    );
    const player = logic.world.table.get(playerId)!;
    assert.equal(player.health?.hp, 25);
    assert.equal(player.death_info, undefined);
  });
});
