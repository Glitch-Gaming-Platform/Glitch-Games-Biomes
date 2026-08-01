import { npcEntity } from "@/server/spawn/spawn_npc";
import { BikkieIds } from "@/shared/bikkie/ids";
import { MovementState } from "@/shared/ecs/gen/components";
import { Npc, type ReadonlyEntity } from "@/shared/ecs/gen/entities";
import type { BiomesId } from "@/shared/ids";
import { SimulatedNpc } from "@/shared/npc/simulated";
import assert from "assert";

const NPC_ID = 8101 as BiomesId;
const PLAYER_ID = 8102 as BiomesId;

describe("SimulatedNpc public combat state", () => {
  it("publishes and clears the active chase target without exposing private NPC state", () => {
    const entity = Npc.from(
      npcEntity(
        {
          id: NPC_ID,
          typeId: BikkieIds.dMucker,
          position: [0, 0, 0],
        },
        100
      )
    );
    assert.ok(entity);
    const npc = new SimulatedNpc(entity);

    npc.setPublicCombatTarget(PLAYER_ID);
    const acquired = npc.finish();
    assert.equal(
      acquired?.state[0]?.npc_combat_state?.attack_target,
      PLAYER_ID
    );
    assert.equal(acquired?.state[0]?.npc_state, undefined);

    npc.setPublicCombatTarget(undefined);
    const released = npc.finish();
    assert.equal(released?.state[0]?.npc_combat_state, null);
    assert.equal(released?.state[0]?.npc_state, undefined);
  });

  it("replicates native movement actions without requiring legacy NPCs to have the component", () => {
    const entity = Npc.from(
      npcEntity(
        {
          id: NPC_ID,
          typeId: BikkieIds.dMucker,
          position: [0, 0, 0],
        },
        100
      )
    );
    assert.ok(entity);
    assert.equal(entity.movement_state, undefined);
    const npc = new SimulatedNpc(entity);

    npc.setMovementState(
      MovementState.create({
        action: "evade",
        action_start_time: 10,
        action_expiry_time: 10.5,
        invulnerability_expiry_time: 10.25,
        cooldown_expiry_time: 13,
        direction: [1, 0, 0],
      })
    );

    assert.equal(npc.movementState?.action, "evade");
    assert.equal(npc.finish()?.state[0]?.movement_state?.action, "evade");
  });

  it("publishes ranged attack metadata for native ECS validation", () => {
    const entity = Npc.from(
      npcEntity(
        {
          id: NPC_ID,
          typeId: BikkieIds.dMucker,
          position: [0, 0, 0],
        },
        100
      )
    );
    assert.ok(entity);
    const npc = new SimulatedNpc(entity);
    npc.attack(PLAYER_ID, 42, {
      attackAbilityId: "fireball",
      attackTime: 100,
      impactPoint: [8, 1, 0],
    });

    const event = npc.finish()?.events[0];
    assert.equal(event?.kind, "updatePlayerHealthEvent");
    if (event?.kind !== "updatePlayerHealthEvent") return;
    assert.equal(event.attackAbilityId, "fireball");
    assert.equal(event.attackTime, 100);
    assert.deepEqual(event.impactPoint, [8, 1, 0]);
    assert.equal(event.hpDelta, -42);
  });

  it("projects only the active ranged cast into public combat state", () => {
    const entity = Npc.from(
      npcEntity(
        {
          id: NPC_ID,
          typeId: BikkieIds.dMucker,
          position: [0, 0, 0],
        },
        100
      )
    );
    assert.ok(entity);
    const npc = new SimulatedNpc(entity);
    npc.mutableState().chaseAttack = {
      attackTarget: PLAYER_ID,
      rangedAttack: {
        abilityId: "fireball",
        projectileVisualId: "fireball",
        targetId: PLAYER_ID,
        castTime: 100,
        chargeTimeSecs: 3.5,
        releaseTime: 103.5,
        impactTime: 104.5,
        cooldownUntil: 123.5,
        aimPoint: [8, 1, 0],
      },
    };
    npc.setPublicCombatTarget(PLAYER_ID);

    const firedUpdates = npc.finish();
    const firedState = firedUpdates?.state[0];
    const fired = firedState?.npc_combat_state;
    assert.deepEqual(fired, {
      attack_target: PLAYER_ID,
      ranged_attack_ability_id: "fireball",
      ranged_attack_projectile_visual_id: "fireball",
      ranged_attack_cast_time: 100,
      ranged_attack_charge_time_secs: 3.5,
      ranged_attack_release_time: 103.5,
      ranged_attack_aim_point: [8, 1, 0],
      ranged_attack_result: undefined,
    });

    npc.updateFromExternal({
      ...entity,
      npc_combat_state: fired,
      npc_state: firedState?.npc_state ?? entity.npc_state,
    } as ReadonlyEntity);
    npc.setPublicCombatTarget(PLAYER_ID);
    assert.equal(
      npc.finish(),
      undefined,
      "an unchanged synchronized cast must not republish public combat state"
    );

    npc.mutableState().chaseAttack!.rangedAttack!.result = "hit";
    assert.equal(
      npc.finish()?.state[0]?.npc_combat_state?.ranged_attack_result,
      "hit"
    );

    npc.mutableState().chaseAttack!.rangedAttack = undefined;
    assert.deepEqual(npc.finish()?.state[0]?.npc_combat_state, {
      attack_target: PLAYER_ID,
      ranged_attack_ability_id: undefined,
      ranged_attack_projectile_visual_id: undefined,
      ranged_attack_cast_time: undefined,
      ranged_attack_charge_time_secs: undefined,
      ranged_attack_release_time: undefined,
      ranged_attack_aim_point: undefined,
      ranged_attack_result: undefined,
    });
  });
});
