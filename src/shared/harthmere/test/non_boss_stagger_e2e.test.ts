import { Health, NpcCombatState } from "@/shared/ecs/gen/components";
import { Npc } from "@/shared/ecs/gen/entities";
import { HARTHMERE_ROAD_GROUP_MONSTER_SEEDS } from "@/shared/harthmere/road_to_harthmere_groups";
import { harthmereNativeNpcCombatProfileForSeed } from "@/shared/harthmere/harthmere_native_combat";
import { npcEntity } from "@/server/spawn/spawn_npc";
import { cancelPendingMeleeAttack } from "@/shared/npc/behavior/chase_attack";
import {
  selectNpcLocomotion,
  updateHarthmereNpcStagger,
} from "@/shared/npc/logic";
import { SimulatedNpc } from "@/shared/npc/simulated";
import type { BiomesId } from "@/shared/ids";
import {
  activeHarthmereNpcStaggerPresentation,
  advanceHarthmereNpcStagger,
  type HarthmereNpcStaggerState,
} from "@/shared/npc/stagger";
import assert from "assert";

describe("non-boss stagger E2E combat sequence", () => {
  it("breaks poise, cancels a committed swing, locks AI, renders, and recovers", () => {
    let staggerState: HarthmereNpcStaggerState | undefined;
    let now = 100;
    let triggered = false;
    const attackState = {
      attackTime: now,
      meleeAttack: { result: undefined as "cancelled" | undefined },
    };

    for (let hit = 0; hit < 5 && !triggered; hit += 1) {
      now += 0.2;
      const result = advanceHarthmereNpcStagger({
        state: staggerState,
        nowSeconds: now,
        maxHp: 550,
        level: 3,
        damageTime: now,
        damageAmount: hit === 2 ? 48 : 30,
        damageIsAttack: true,
        damageDirection: [0, 0, -1],
      });
      staggerState = result.state;
      triggered = Boolean(result.triggered);
    }

    assert.equal(triggered, true, "the combo should break enemy poise");
    assert.equal(cancelPendingMeleeAttack(attackState, now), true);
    assert.equal(attackState.meleeAttack.result, "cancelled");
    assert.equal(
      selectNpcLocomotion({
        hasActiveStagger: true,
        hasActiveEvade: true,
        swim: false,
        fly: false,
        hasFleeOutput: false,
        isQuestGiver: false,
        hasActiveSchedule: false,
        hasChaseAttack: true,
        hasAttackTarget: true,
        canMeander: true,
        canSocialize: true,
      }),
      "stagger"
    );

    const publicState = NpcCombatState.create({
      stagger_kind: staggerState!.stagger!.kind,
      stagger_start_time: staggerState!.stagger!.startTime,
      stagger_expiry_time: staggerState!.stagger!.expiryTime,
      stagger_direction: staggerState!.stagger!.direction,
      stagger_sequence: staggerState!.sequence,
      poise: staggerState!.poise,
      poise_max: staggerState!.poiseMax,
    });
    assert.ok(activeHarthmereNpcStaggerPresentation(publicState, now));

    const recoveredAt = staggerState!.immunityUntil! + 0.25;
    const recovered = advanceHarthmereNpcStagger({
      state: staggerState,
      nowSeconds: recoveredAt,
      maxHp: 550,
      level: 3,
      damageIsAttack: false,
    });
    assert.equal(recovered.active, false);
    assert.ok((recovered.state.poise ?? 0) > 0);
    assert.equal(
      selectNpcLocomotion({
        hasActiveStagger: false,
        hasActiveEvade: false,
        swim: false,
        fly: false,
        hasFleeOutput: false,
        isQuestGiver: false,
        hasActiveSchedule: false,
        hasChaseAttack: true,
        hasAttackTarget: true,
        canMeander: false,
        canSocialize: false,
      }),
      "chaseAttack"
    );
  });

  it("interrupts the real SimulatedNpc pending melee receipt on poise break", () => {
    const seed = HARTHMERE_ROAD_GROUP_MONSTER_SEEDS[0];
    const profile = harthmereNativeNpcCombatProfileForSeed(seed);
    const base = npcEntity(
      {
        id: seed.entityId,
        typeId: profile.id,
        position: [0, 0, 0],
        displayName: seed.displayName,
        spawnPositionJitterRadius: 0,
      },
      100
    );
    const entity = Npc.from({
      ...base,
      health: Health.create({
        ...Health.clone(base.health),
        hp: Math.max(1, profile.maxHp - 165),
        maxHp: profile.maxHp,
        lastDamageTime: 100,
        lastDamageAmount: -165,
        lastDamageSource: {
          kind: "attack",
          attacker: 999 as BiomesId,
          dir: [1, 0, 0],
        },
      }),
    });
    assert.ok(entity);
    const npc = new SimulatedNpc(entity);
    npc.mutableState().damageReaction = {
      poise: 20,
      poiseMax: 100,
      poiseUpdatedAt: 100,
    };
    npc.mutableState().chaseAttack = {
      attackTarget: 999 as BiomesId,
      attackTime: 99.8,
      meleeAttack: {
        targetId: 999 as BiomesId,
        attackTime: 99.8,
        impactTime: 100.2,
        expiresAt: 100.5,
        originPoint: [0, 0, 0],
        castYaw: 0,
        attackDistance: 2.4,
        attackFovDeg: 125,
        verticalReach: 1,
        attackDamage: 30,
      },
    };

    const runtime = updateHarthmereNpcStagger(
      { resources: { get: () => undefined } } as any,
      npc,
      100
    );
    assert.equal(runtime.active, true);
    assert.equal(npc.state.chaseAttack?.meleeAttack?.result, "cancelled");
    assert.equal(npc.state.chaseAttack?.attackTime, undefined);
    const publicState = npc.finish()?.state[0]?.npc_combat_state;
    assert.equal(publicState?.stagger_kind, "heavy");
    assert.equal(publicState?.stagger_sequence, 1);
  });
});
