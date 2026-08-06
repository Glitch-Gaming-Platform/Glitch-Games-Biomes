import { Health } from "@/shared/ecs/gen/components";
import { Npc } from "@/shared/ecs/gen/entities";
import { HARTHMERE_BOSS_VISUAL_ASSETS } from "@/shared/harthmere/boss_visual_assets";
import { harthmereNativeNpcCombatProfileForEntity } from "@/shared/harthmere/harthmere_native_combat_catalog";
import { HARTHMERE_ROAD_GROUP_MONSTER_SEEDS } from "@/shared/harthmere/road_to_harthmere_groups";
import { harthmereNativeNpcCombatProfileForSeed } from "@/shared/harthmere/harthmere_native_combat";
import type { BiomesId } from "@/shared/ids";
import { updateHarthmereNpcStagger } from "@/shared/npc/logic";
import { SimulatedNpc } from "@/shared/npc/simulated";
import {
  HARTHMERE_BOSS_STAGGER_TIMING,
  harthmereNpcStaggerEligible,
} from "@/shared/npc/stagger";
import { npcEntity } from "@/server/spawn/spawn_npc";
import assert from "assert";
import fs from "fs";
import path from "path";

describe("boss stagger E2E", () => {
  it("makes all eleven live boss profiles eligible", () => {
    assert.equal(HARTHMERE_BOSS_VISUAL_ASSETS.length, 11);
    HARTHMERE_BOSS_VISUAL_ASSETS.forEach((visual, index) => {
      const profile = harthmereNativeNpcCombatProfileForEntity({
        entityId: visual.entityIds?.[0] as BiomesId | undefined,
        typeId: (9_900_000 + index) as BiomesId,
        displayName: visual.displayName,
        maxHp: 5000,
      });
      assert.equal(profile?.isBoss, true, visual.displayName);
      assert.equal(
        harthmereNpcStaggerEligible(profile),
        true,
        visual.displayName
      );
    });
  });

  it("interrupts a live boss attack and publishes the boss disable window", () => {
    const seed = HARTHMERE_ROAD_GROUP_MONSTER_SEEDS[0];
    const baseProfile = harthmereNativeNpcCombatProfileForSeed(seed);
    const bossId = 8_810_000_000_099_901 as BiomesId;
    const now = 200;
    const base = npcEntity(
      {
        id: bossId,
        typeId: baseProfile.id,
        position: [0, 0, 0],
        displayName: "Muck-Scarred Helix",
        spawnPositionJitterRadius: 0,
      },
      now
    );
    const entity = Npc.from({
      ...base,
      health: Health.create({
        ...Health.clone(base.health),
        hp: 3500,
        maxHp: 5000,
        lastDamageTime: now,
        lastDamageAmount: -1500,
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
      poise: 1,
      poiseMax: 420,
      poiseUpdatedAt: now,
    };
    npc.mutableState().chaseAttack = {
      attackTarget: 999 as BiomesId,
      attackTime: now - 0.1,
      meleeAttack: {
        targetId: 999 as BiomesId,
        attackTime: now - 0.1,
        impactTime: now + 0.4,
        expiresAt: now + 0.8,
        originPoint: [0, 0, 0],
        castYaw: 0,
        attackDistance: 8,
        attackFovDeg: 125,
        verticalReach: 8,
        attackDamage: 80,
      },
    };

    const runtime = updateHarthmereNpcStagger(
      { resources: { get: () => undefined } } as any,
      npc,
      now
    );
    assert.equal(runtime.profile?.isBoss, true);
    assert.equal(runtime.active, true);
    assert.equal(npc.state.chaseAttack?.meleeAttack?.result, "cancelled");
    const publicState = npc.finish()?.state[0]?.npc_combat_state;
    assert.equal(publicState?.stagger_kind, "heavy");
    assert.ok(
      Math.abs(
        publicState!.stagger_expiry_time! -
          publicState!.stagger_start_time! -
          HARTHMERE_BOSS_STAGGER_TIMING.heavy.durationSeconds
      ) < 1e-9
    );
  });

  it("selects every dedicated boss stagger clip in the production renderer", () => {
    const renderer = fs.readFileSync(
      path.join(process.cwd(), "src/client/game/resources/npcs.ts"),
      "utf8"
    );
    for (const clip of [
      "BossStaggerLight",
      "BossStaggerMedium",
      "BossStaggerHeavy",
    ]) {
      assert.match(renderer, new RegExp(`fileAnimationName: "${clip}"`));
    }
    assert.match(renderer, /harthmereBossVisualId/);
    assert.match(renderer, /getNpcStaggerAnimationAction/);
  });
});
