import { GameEvent } from "@/server/shared/api/game_event";
import { loadVoxeloo } from "@/server/shared/voxeloo";
import {
  TestLogicApi,
  addGameUser,
  editEntity,
} from "@/server/test/test_helpers";
import { secondsSinceEpoch } from "@/shared/ecs/config";
import { MovementState } from "@/shared/ecs/gen/components";
import {
  MovementActionEvent,
  SetCrouchingEvent,
  UpdatePlayerHealthEvent,
} from "@/shared/ecs/gen/events";
import {
  DOUBLE_JUMP_STAMINA_COST,
  EVADE_MOVEMENT_ACTION_STAMINA_COST,
  MOVEMENT_ACTION_STAMINA_COST,
} from "@/shared/game/movement_actions";
import {
  readHarthmereNativeVitals,
  writeHarthmereNativeVitals,
} from "@/shared/harthmere/harthmere_native_vitals";
import { generateTestId } from "@/shared/test_helpers";
import type { VoxelooModule } from "@/shared/wasm/types";
import assert from "assert";

describe("native ECS movement actions", () => {
  let voxeloo!: VoxelooModule;
  let logic!: TestLogicApi;

  before(async () => {
    voxeloo = await loadVoxeloo();
  });

  beforeEach(() => {
    logic = new TestLogicApi(voxeloo);
  });

  it("replicates crouch transitions", async () => {
    const playerId = (await addGameUser(logic.world, generateTestId(), {})).id;

    await logic.publish(
      new GameEvent(
        playerId,
        new SetCrouchingEvent({ id: playerId, crouching: true })
      )
    );
    assert.equal(
      logic.world.table.get(playerId)?.movement_state?.crouching,
      true
    );

    await logic.publish(
      new GameEvent(
        playerId,
        new SetCrouchingEvent({ id: playerId, crouching: false })
      )
    );
    assert.equal(
      logic.world.table.get(playerId)?.movement_state?.crouching,
      false
    );
  });

  it("accepts one action, normalizes it, and deducts survival stamina", async () => {
    const playerId = (await addGameUser(logic.world, generateTestId(), {})).id;
    editEntity(logic.world, playerId, (player) => {
      writeHarthmereNativeVitals(player.mutableTriggerState(), {
        stamina: 50,
        maxStamina: 100,
      });
    });

    await logic.publish(
      new GameEvent(
        playerId,
        new MovementActionEvent({
          id: playerId,
          action: "dodge",
          direction: [3, 99, 4],
          nonce: 7,
        })
      )
    );

    const player = logic.world.table.get(playerId)!;
    const state = player.movement_state!;
    assert.equal(state.action, "dodge");
    assert.ok(Math.abs(state.direction[0] - 0.6) < 1e-6);
    assert.equal(state.direction[1], 0);
    assert.ok(Math.abs(state.direction[2] - 0.8) < 1e-6);
    assert.equal(state.action_nonce, 7);
    assert.ok(state.action_expiry_time > state.action_start_time);
    assert.ok(
      state.invulnerability_expiry_time < state.action_expiry_time,
      "invulnerability must end before the animation/movement window"
    );
    assert.ok(state.cooldown_expiry_time > state.action_expiry_time);
    assert.equal(
      readHarthmereNativeVitals(player.trigger_state).stamina,
      50 - MOVEMENT_ACTION_STAMINA_COST
    );
  });

  it("rejects cooldown spam without charging stamina twice", async () => {
    const playerId = (await addGameUser(logic.world, generateTestId(), {})).id;
    editEntity(logic.world, playerId, (player) => {
      writeHarthmereNativeVitals(player.mutableTriggerState(), {
        stamina: 50,
      });
    });

    for (const nonce of [1, 2]) {
      await logic.publish(
        new GameEvent(
          playerId,
          new MovementActionEvent({
            id: playerId,
            action: "evade",
            direction: [1, 0, 0],
            nonce,
          })
        )
      );
    }

    const player = logic.world.table.get(playerId)!;
    assert.equal(player.movement_state?.action_nonce, 1);
    assert.equal(
      readHarthmereNativeVitals(player.trigger_state).stamina,
      50 - EVADE_MOVEMENT_ACTION_STAMINA_COST
    );
  });

  it("replicates a double jump and deducts its survival stamina cost", async () => {
    const playerId = (await addGameUser(logic.world, generateTestId(), {})).id;
    editEntity(logic.world, playerId, (player) => {
      writeHarthmereNativeVitals(player.mutableTriggerState(), {
        stamina: 50,
        maxStamina: 100,
      });
    });

    await logic.publish(
      new GameEvent(
        playerId,
        new MovementActionEvent({
          id: playerId,
          action: "doubleJump",
          direction: [0, 0, -1],
          nonce: 17,
        })
      )
    );

    const player = logic.world.table.get(playerId)!;
    assert.equal(player.movement_state?.action, "doubleJump");
    assert.equal(player.movement_state?.action_nonce, 17);
    assert.equal(
      player.movement_state?.invulnerability_expiry_time,
      player.movement_state?.action_start_time,
      "double jump must not grant dodge invulnerability"
    );
    assert.equal(
      readHarthmereNativeVitals(player.trigger_state).stamina,
      50 - DOUBLE_JUMP_STAMINA_COST
    );
  });

  it("rejects a double jump when fewer than four stamina remain", async () => {
    const playerId = (await addGameUser(logic.world, generateTestId(), {})).id;
    editEntity(logic.world, playerId, (player) => {
      writeHarthmereNativeVitals(player.mutableTriggerState(), {
        stamina: DOUBLE_JUMP_STAMINA_COST - 1,
      });
    });

    await logic.publish(
      new GameEvent(
        playerId,
        new MovementActionEvent({
          id: playerId,
          action: "doubleJump",
          direction: [0, 0, -1],
          nonce: 19,
        })
      )
    );

    const player = logic.world.table.get(playerId)!;
    assert.equal(player.movement_state?.action, undefined);
    assert.equal(
      readHarthmereNativeVitals(player.trigger_state).stamina,
      DOUBLE_JUMP_STAMINA_COST - 1
    );
  });

  it("rejects an action when survival stamina is below its cost", async () => {
    const playerId = (await addGameUser(logic.world, generateTestId(), {})).id;
    editEntity(logic.world, playerId, (player) => {
      writeHarthmereNativeVitals(player.mutableTriggerState(), {
        stamina: MOVEMENT_ACTION_STAMINA_COST - 1,
      });
    });

    await logic.publish(
      new GameEvent(
        playerId,
        new MovementActionEvent({
          id: playerId,
          action: "dodge",
          direction: [1, 0, 0],
          nonce: 9,
        })
      )
    );

    const player = logic.world.table.get(playerId)!;
    assert.equal(player.movement_state, undefined);
    assert.equal(
      readHarthmereNativeVitals(player.trigger_state).stamina,
      MOVEMENT_ACTION_STAMINA_COST - 1
    );
  });

  it("rejects movement while dead", async () => {
    const playerId = (await addGameUser(logic.world, generateTestId(), {})).id;
    editEntity(logic.world, playerId, (player) => {
      player.mutableHealth().hp = 0;
      writeHarthmereNativeVitals(player.mutableTriggerState(), {
        stamina: 50,
      });
    });

    await logic.publish(
      new GameEvent(
        playerId,
        new MovementActionEvent({
          id: playerId,
          action: "evade",
          direction: [1, 0, 0],
          nonce: 10,
        })
      )
    );

    const player = logic.world.table.get(playerId)!;
    assert.equal(player.movement_state, undefined);
    assert.equal(readHarthmereNativeVitals(player.trigger_state).stamina, 50);
  });

  it("takes damage during anticipation, ignores it in the iframe, and accepts it afterward", async () => {
    const targetId = (
      await addGameUser(logic.world, generateTestId(), { position: [0, 0, 0] })
    ).id;
    const attackerId = (
      await addGameUser(logic.world, generateTestId(), { position: [1, 0, 0] })
    ).id;

    await logic.publish(
      new GameEvent(
        targetId,
        new MovementActionEvent({
          id: targetId,
          action: "dodge",
          direction: [1, 0, 0],
          nonce: 11,
        })
      )
    );
    await logic.publish(
      new GameEvent(
        attackerId,
        new UpdatePlayerHealthEvent({
          id: targetId,
          hpDelta: -10,
          damageSource: {
            kind: "attack",
            attacker: attackerId,
            dir: [1, 0, 0],
          },
        })
      )
    );
    assert.equal(
      logic.world.table.get(targetId)?.health?.hp,
      90,
      "the anticipation pose must remain vulnerable"
    );

    editEntity(logic.world, targetId, (player) => {
      const now = secondsSinceEpoch();
      player.mutableHealth().hp = 100;
      player.setMovementState(
        MovementState.create({
          ...MovementState.clone(player.movementState()),
          action_start_time: now - 0.2,
          action_expiry_time: now + 0.55,
          invulnerability_expiry_time: now + 0.2,
        })
      );
    });
    await logic.publish(
      new GameEvent(
        attackerId,
        new UpdatePlayerHealthEvent({
          id: targetId,
          hpDelta: -10,
          damageSource: {
            kind: "attack",
            attacker: attackerId,
            dir: [1, 0, 0],
          },
        })
      )
    );
    assert.equal(logic.world.table.get(targetId)?.health?.hp, 100);

    editEntity(logic.world, targetId, (player) => {
      const expired = secondsSinceEpoch() - 1;
      player.setMovementState(
        MovementState.create({
          ...MovementState.clone(player.movementState()),
          action_expiry_time: expired,
          invulnerability_expiry_time: expired,
        })
      );
    });
    await logic.publish(
      new GameEvent(
        attackerId,
        new UpdatePlayerHealthEvent({
          id: targetId,
          hpDelta: -10,
          damageSource: {
            kind: "attack",
            attacker: attackerId,
            dir: [1, 0, 0],
          },
        })
      )
    );
    assert.equal(logic.world.table.get(targetId)?.health?.hp, 90);
  });
});
