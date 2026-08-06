import { npcEntity } from "@/server/spawn/spawn_npc";
import { BikkieIds } from "@/shared/bikkie/ids";
import { MovementState } from "@/shared/ecs/gen/components";
import { Npc, type ReadonlyEntity } from "@/shared/ecs/gen/entities";
import type { BiomesId } from "@/shared/ids";
import { deserializeNpcCustomState } from "@/shared/npc/serde";
import { SimulatedNpc } from "@/shared/npc/simulated";
import assert from "assert";

const NPC_ID = 8101 as BiomesId;
const PLAYER_ID = 8102 as BiomesId;
const playerTarget = { id: PLAYER_ID, player_status: {} } as ReadonlyEntity;

describe("SimulatedNpc public combat state", () => {
  it("treats a generated empty NPC-state payload as default custom state", () => {
    assert.deepEqual(deserializeNpcCustomState(new Uint8Array()), {});
  });

  it("never publishes a non-finite orientation", () => {
    const entity = Npc.from(
      npcEntity(
        {
          id: NPC_ID,
          typeId: BikkieIds.dMucker,
          position: [0, 0, 0],
          orientation: [0.2, -0.4],
        },
        100
      )
    );
    assert.ok(entity);
    const npc = new SimulatedNpc(entity);

    npc.setOrientation([NaN, Infinity]);

    assert.deepEqual(npc.orientation, [0.2, -0.4]);
    assert.deepEqual(npc.finish()?.state[0]?.orientation?.v, [0.2, -0.4]);
  });

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
    npc.attack(playerTarget, 42, {
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

  it("publishes the same swing timestamp and contact point for melee validation", () => {
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
    npc.attack(playerTarget, 18, {
      attackTime: 100,
      impactPoint: [1.5, 0.9, 0],
    });

    const event = npc.finish()?.events[0];
    assert.equal(event?.kind, "updatePlayerHealthEvent");
    if (event?.kind !== "updatePlayerHealthEvent") return;
    assert.equal(event.attackAbilityId, undefined);
    assert.equal(event.attackTime, 100);
    assert.deepEqual(event.impactPoint, [1.5, 0.9, 0]);
    assert.equal(event.hpDelta, -18);
  });

  it("routes attacks on NPC escorts through native NPC health authority", () => {
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
    const escortEntity = Npc.from(
      npcEntity(
        {
          id: 8103 as BiomesId,
          typeId: BikkieIds.dMucker,
          position: [1, 0, 0],
        },
        100
      )
    );
    assert.ok(entity && escortEntity);
    const npc = new SimulatedNpc(entity);
    npc.attack(escortEntity, 18, {
      attackTime: 100,
      impactPoint: [1, 0.6, 0],
    });

    const event = npc.finish()?.events[0];
    assert.equal(event?.kind, "updateNpcHealthEvent");
    if (event?.kind !== "updateNpcHealthEvent") return;
    assert.equal(event.id, escortEntity.id);
    assert.equal(event.hp, -18);
    assert.equal(event.attackTime, 100);
    assert.equal(event.damageSource?.kind, "attack");
    if (event.damageSource?.kind !== "attack") return;
    assert.equal(event.damageSource.attacker, NPC_ID);
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
      stagger_kind: undefined,
      stagger_start_time: undefined,
      stagger_expiry_time: undefined,
      stagger_direction: undefined,
      stagger_sequence: undefined,
      poise: undefined,
      poise_max: undefined,
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
      stagger_kind: undefined,
      stagger_start_time: undefined,
      stagger_expiry_time: undefined,
      stagger_direction: undefined,
      stagger_sequence: undefined,
      poise: undefined,
      poise_max: undefined,
    });
  });

  it("publishes the authoritative stagger window and poise without exposing private state", () => {
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
    npc.mutableState().damageReaction = {
      poise: 0,
      poiseMax: 90,
      sequence: 3,
      stagger: {
        kind: "medium",
        startTime: 20,
        expiryTime: 20.95,
        direction: [1, 0, 0],
      },
    };

    const updates = npc.finish();
    assert.deepEqual(updates?.state[0]?.npc_combat_state, {
      attack_target: undefined,
      ranged_attack_ability_id: undefined,
      ranged_attack_projectile_visual_id: undefined,
      ranged_attack_cast_time: undefined,
      ranged_attack_charge_time_secs: undefined,
      ranged_attack_release_time: undefined,
      ranged_attack_aim_point: undefined,
      ranged_attack_result: undefined,
      stagger_kind: "medium",
      stagger_start_time: 20,
      stagger_expiry_time: 20.95,
      stagger_direction: [1, 0, 0],
      stagger_sequence: 3,
      poise: 0,
      poise_max: 90,
    });
  });

  it("publishes a newly acquired target when poise was already synchronized", () => {
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
    npc.mutableState().damageReaction = {
      poise: 120,
      poiseMax: 120,
    };

    const poiseUpdates = npc.finish();
    const poiseState = poiseUpdates?.state[0];
    assert.equal(poiseState?.npc_combat_state?.attack_target, undefined);
    assert.equal(poiseState?.npc_combat_state?.poise, 120);

    npc.updateFromExternal({
      ...entity,
      npc_combat_state: poiseState?.npc_combat_state,
      npc_state: poiseState?.npc_state ?? entity.npc_state,
    } as ReadonlyEntity);
    npc.mutableState().chaseAttack = { attackTarget: PLAYER_ID };

    const targetUpdates = npc.finish();
    assert.equal(
      targetUpdates?.state[0]?.npc_combat_state?.attack_target,
      PLAYER_ID
    );
    assert.equal(targetUpdates?.state[0]?.npc_combat_state?.poise, 120);
    assert.equal(targetUpdates?.state[0]?.npc_combat_state?.poise_max, 120);
  });
});
