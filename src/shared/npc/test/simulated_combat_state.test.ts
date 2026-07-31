import { npcEntity } from "@/server/spawn/spawn_npc";
import { BikkieIds } from "@/shared/bikkie/ids";
import { MovementState } from "@/shared/ecs/gen/components";
import { Npc } from "@/shared/ecs/gen/entities";
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
});
