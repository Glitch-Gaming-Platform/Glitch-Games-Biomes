import type { ReadonlyEntity } from "@/shared/ecs/gen/entities";
import type { BiomesId } from "@/shared/ids";
import type { Environment } from "@/shared/npc/environment";
import type { BehaviorRangedAttackParams } from "@/shared/npc/npc_types";
import { rangedAttackTargetTick } from "@/shared/npc/behavior/chase_attack";
import type { SimulatedNpc } from "@/shared/npc/simulated";
import { harthmereBossAttacksForLabel } from "@/shared/harthmere/boss_attack_catalog";
import { HARTHMERE_BOSS_VISUAL_ASSETS } from "@/shared/harthmere/boss_visual_assets";
import {
  deserializeNpcCustomState,
  serializeNpcCustomState,
} from "@/shared/npc/serde";
import assert from "assert";

const NPC_ID = 91_001 as BiomesId;
const PLAYER_ID = 91_002 as BiomesId;

const fireball: BehaviorRangedAttackParams = {
  abilityId: "fireball",
  projectileVisualId: "fireball",
  minimumDistance: 4.25,
  attackDistance: 12,
  attackDamage: 63,
  castTimeSecs: 1,
  cooldownSecs: 20,
  sharedCooldownSecs: 20,
  hitRadius: 0.8,
};

const resonance: BehaviorRangedAttackParams = {
  abilityId: "thaedryn_resonance",
  projectileVisualId: "thaedryn_resonance",
  minimumDistance: 4,
  attackDistance: 18,
  attackDamage: 100,
  castTimeSecs: 0.8,
  cooldownSecs: 5.5,
  sharedCooldownSecs: 2.75,
  hitRadius: 1.25,
};

function targetAt(x: number): ReadonlyEntity {
  return {
    id: PLAYER_ID,
    position: { v: [x, 0, 0] },
    size: { v: [0.8, 1.8, 0.8] },
    health: {
      hp: 100,
      maxHp: 100,
      lastDamageSource: undefined,
      lastDamageTime: undefined,
      lastDamageInventoryConsequence: undefined,
      lastDamageAmount: undefined,
    },
  } as ReadonlyEntity;
}

function fixture(initialTarget = targetAt(8)) {
  const state: any = {
    chaseAttack: { attackTarget: PLAYER_ID, targetVisible: true },
  };
  const attacks: any[] = [];
  const emotes: any[] = [];
  let target = initialTarget;
  const npc = {
    id: NPC_ID,
    position: [0, 0, 0],
    hp: 100,
    health: { maxHp: 100 },
    size: [1, 2, 1],
    state,
    mutableState: () => state,
    setEmote: (emote: unknown) => emotes.push(emote),
    attack: (...args: unknown[]) => attacks.push(args),
  } as unknown as SimulatedNpc;
  const env = {
    ecsMetaIndex: {
      player_selector: {
        scanSphere: () => [PLAYER_ID],
      },
    },
    resources: {
      get: (path: string, id: BiomesId) =>
        path === "/ecs/entity" && id === PLAYER_ID ? target : undefined,
    },
  } as unknown as Environment;
  return {
    npc,
    env,
    state,
    attacks,
    emotes,
    setTarget: (next: ReadonlyEntity) => {
      target = next;
    },
    getTarget: () => target,
  };
}

describe("Harthmere Hex ranged attacks", () => {
  it("fires the authored Fireball, resolves a hit, and enforces cooldown", () => {
    const test = fixture();
    test.state.chaseAttack.attackTime = 90;
    test.state.chaseAttack.strikeTime = 90.5;
    assert.deepEqual(
      rangedAttackTargetTick(
        test.env,
        test.npc,
        test.getTarget(),
        [fireball],
        100
      ),
      { handled: true, phase: "fired" }
    );
    assert.equal(test.state.chaseAttack.rangedAttack.abilityId, "fireball");
    assert.equal(test.state.chaseAttack.attackTime, undefined);
    assert.equal(test.state.chaseAttack.strikeTime, undefined);
    assert.equal(test.emotes[0].emote_type, "attack1");
    const firstCast = test.state.chaseAttack.rangedAttack;
    assert.ok(firstCast.chargeTimeSecs >= 2);
    assert.ok(firstCast.chargeTimeSecs <= 10);
    assert.equal(
      firstCast.releaseTime,
      firstCast.castTime + firstCast.chargeTimeSecs
    );
    assert.equal(firstCast.impactTime, firstCast.releaseTime + 1);
    assert.deepEqual(
      deserializeNpcCustomState(serializeNpcCustomState(test.state)).chaseAttack
        ?.rangedAttack,
      test.state.chaseAttack.rangedAttack,
      "the Anima cast must survive the native ECS npc_state round trip"
    );

    assert.deepEqual(
      rangedAttackTargetTick(
        test.env,
        test.npc,
        test.getTarget(),
        [fireball],
        firstCast.releaseTime - 0.01
      ),
      { handled: true, phase: "charging" }
    );
    assert.equal(test.attacks.length, 0);

    assert.deepEqual(
      rangedAttackTargetTick(
        test.env,
        test.npc,
        test.getTarget(),
        [fireball],
        firstCast.releaseTime + 0.5
      ),
      { handled: true, phase: "in_flight" }
    );

    assert.deepEqual(
      rangedAttackTargetTick(
        test.env,
        test.npc,
        test.getTarget(),
        [fireball],
        firstCast.impactTime
      ),
      { handled: true, phase: "hit" }
    );
    assert.equal(test.attacks.length, 1);
    assert.deepEqual(test.attacks[0].slice(0, 2), [PLAYER_ID, 63]);
    assert.equal(test.attacks[0][2].attackAbilityId, "fireball");
    assert.equal(test.attacks[0][2].attackTime, firstCast.releaseTime);

    assert.deepEqual(
      rangedAttackTargetTick(
        test.env,
        test.npc,
        test.getTarget(),
        [fireball],
        firstCast.cooldownUntil - 0.01
      ),
      { handled: false, phase: "cooldown" }
    );
    assert.deepEqual(
      rangedAttackTargetTick(
        test.env,
        test.npc,
        test.getTarget(),
        [fireball],
        firstCast.cooldownUntil
      ),
      { handled: true, phase: "fired" }
    );
  });

  it("misses when the target leaves the fixed Fireball aim point", () => {
    const test = fixture();
    rangedAttackTargetTick(
      test.env,
      test.npc,
      test.getTarget(),
      [fireball],
      200
    );
    const active = test.state.chaseAttack.rangedAttack;
    test.setTarget(targetAt(11));

    assert.deepEqual(
      rangedAttackTargetTick(
        test.env,
        test.npc,
        test.getTarget(),
        [fireball],
        active.impactTime
      ),
      { handled: true, phase: "miss" }
    );
    assert.equal(test.attacks.length, 0);
    assert.equal(test.state.chaseAttack.rangedAttack.result, "miss");
  });

  it("leaves close-range combat to the existing melee attack", () => {
    const test = fixture(targetAt(2.5));
    assert.deepEqual(
      rangedAttackTargetTick(
        test.env,
        test.npc,
        test.getTarget(),
        [fireball],
        300
      ),
      { handled: false, phase: "none" }
    );
    assert.equal(test.state.chaseAttack.rangedAttack, undefined);
  });

  it("alternates Hex-boss ranged attacks without bypassing shared cooldown", () => {
    const bossFireball = { ...fireball, sharedCooldownSecs: 2.75 };
    const test = fixture();
    rangedAttackTargetTick(
      test.env,
      test.npc,
      test.getTarget(),
      [bossFireball, resonance],
      400
    );
    const firstCast = test.state.chaseAttack.rangedAttack;
    rangedAttackTargetTick(
      test.env,
      test.npc,
      test.getTarget(),
      [bossFireball, resonance],
      firstCast.impactTime
    );
    assert.deepEqual(
      rangedAttackTargetTick(
        test.env,
        test.npc,
        test.getTarget(),
        [bossFireball, resonance],
        firstCast.releaseTime + bossFireball.sharedCooldownSecs - 0.01
      ),
      { handled: false, phase: "cooldown" }
    );
    assert.deepEqual(
      rangedAttackTargetTick(
        test.env,
        test.npc,
        test.getTarget(),
        [bossFireball, resonance],
        firstCast.releaseTime + bossFireball.sharedCooldownSecs
      ),
      { handled: true, phase: "fired" }
    );
    assert.equal(
      test.state.chaseAttack.rangedAttack.abilityId,
      "thaedryn_resonance"
    );
  });

  it("round-robins all five ready boss attacks instead of starving later moves", () => {
    const attacks = Array.from({ length: 5 }, (_, index) => ({
      ...fireball,
      abilityId: `boss_attack_${index + 1}`,
      damageType: "physical" as const,
      castTimeSecs: 0.1,
      cooldownSecs: 100,
      sharedCooldownSecs: 0.2,
    }));
    const test = fixture();
    const selected: string[] = [];
    for (let index = 0; index < attacks.length; index += 1) {
      const castTime = 500 + index * 0.25;
      assert.equal(
        rangedAttackTargetTick(
          test.env,
          test.npc,
          test.getTarget(),
          attacks,
          castTime
        ).phase,
        "fired"
      );
      selected.push(test.state.chaseAttack.rangedAttack.abilityId);
      assert.equal(
        rangedAttackTargetTick(
          test.env,
          test.npc,
          test.getTarget(),
          attacks,
          castTime + 0.1
        ).phase,
        "hit"
      );
    }
    assert.deepEqual(
      selected,
      attacks.map(({ abilityId }) => abilityId)
    );
  });

  it("casts, serializes, and hits with all five attacks for every live boss", () => {
    let attackCount = 0;
    for (const boss of HARTHMERE_BOSS_VISUAL_ASSETS) {
      const bossAttacks = harthmereBossAttacksForLabel(boss.displayName);
      assert.ok(bossAttacks, boss.displayName);
      assert.equal(bossAttacks.length, 5, boss.displayName);
      for (const attack of bossAttacks) {
        attackCount += 1;
        const shape = attack.attackShape ?? "projectile";
        const maximumHitDistance =
          shape === "self_aoe"
            ? Math.min(attack.attackDistance, attack.hitRadius * 0.75)
            : attack.attackDistance;
        const targetDistance = Math.max(
          attack.minimumDistance + 0.25,
          Math.min(maximumHitDistance - 0.25, 8)
        );
        const test = fixture(targetAt(targetDistance));
        const minimumHealth = attack.minimumHealthRatio ?? 0;
        const maximumHealth = attack.maximumHealthRatio ?? 1;
        (test.npc as any).hp = ((minimumHealth + maximumHealth) / 2) * 100;
        const castAt = 1_000 + attackCount * 10;

        assert.equal(
          rangedAttackTargetTick(
            test.env,
            test.npc,
            test.getTarget(),
            [attack],
            castAt
          ).phase,
          "fired",
          `${boss.displayName}: ${attack.displayName} did not fire`
        );
        assert.equal(
          deserializeNpcCustomState(serializeNpcCustomState(test.state))
            .chaseAttack?.rangedAttack?.abilityId,
          attack.abilityId,
          `${boss.displayName}: ${attack.displayName} did not survive npc_state`
        );
        assert.equal(
          rangedAttackTargetTick(
            test.env,
            test.npc,
            test.getTarget(),
            [attack],
            test.state.chaseAttack.rangedAttack.impactTime
          ).phase,
          "hit",
          `${boss.displayName}: ${attack.displayName} did not hit`
        );
        assert.equal(
          test.attacks[0]?.[2]?.attackAbilityId,
          attack.abilityId,
          `${boss.displayName}: ${attack.displayName} lost its receipt identity`
        );
      }
    }
    assert.equal(attackCount, 55);
  });

  it("resolves a native ground-area magic attack against every visible player in the radius", () => {
    const secondPlayerId = 91_003 as BiomesId;
    const primary = targetAt(8);
    const secondary = {
      ...targetAt(9),
      id: secondPlayerId,
    } as ReadonlyEntity;
    const test = fixture(primary);
    (test.env as any).ecsMetaIndex.player_selector.scanSphere = () => [
      PLAYER_ID,
      secondPlayerId,
    ];
    (test.env as any).resources.get = (path: string, id: BiomesId) => {
      if (path !== "/ecs/entity") return undefined;
      return id === PLAYER_ID
        ? primary
        : id === secondPlayerId
        ? secondary
        : undefined;
    };
    const blizzard = {
      ...fireball,
      abilityId: "test_blizzard",
      attackShape: "ground_aoe" as const,
      damageType: "ice" as const,
      castTimeSecs: 0.2,
      hitRadius: 3,
    };

    assert.equal(
      rangedAttackTargetTick(test.env, test.npc, primary, [blizzard], 700)
        .phase,
      "fired"
    );
    assert.equal(
      rangedAttackTargetTick(
        test.env,
        test.npc,
        primary,
        [blizzard],
        test.state.chaseAttack.rangedAttack.impactTime
      ).phase,
      "hit"
    );
    assert.deepEqual(
      test.attacks.map(([targetId]) => targetId).sort(),
      [PLAYER_ID, secondPlayerId].sort()
    );
    assert.deepEqual(
      [...test.state.chaseAttack.rangedAttack.hitTargetIds].sort(),
      [PLAYER_ID, secondPlayerId].sort()
    );
  });

  it("resolves cone geometry without hitting players behind or outside the telegraph", () => {
    const insideId = 91_003 as BiomesId;
    const outsideId = 91_004 as BiomesId;
    const behindId = 91_005 as BiomesId;
    const players = new Map<BiomesId, ReadonlyEntity>([
      [PLAYER_ID, targetAt(8)],
      [
        insideId,
        {
          ...targetAt(7),
          id: insideId,
          position: { v: [7, 0, 1] },
        } as ReadonlyEntity,
      ],
      [
        outsideId,
        {
          ...targetAt(7),
          id: outsideId,
          position: { v: [0, 0, 7] },
        } as ReadonlyEntity,
      ],
      [
        behindId,
        {
          ...targetAt(5),
          id: behindId,
          position: { v: [-5, 0, 0] },
        } as ReadonlyEntity,
      ],
    ]);
    const test = fixture(players.get(PLAYER_ID));
    (test.env as any).ecsMetaIndex.player_selector.scanSphere = () => [
      ...players.keys(),
    ];
    (test.env as any).resources.get = (path: string, id: BiomesId) =>
      path === "/ecs/entity" ? players.get(id) : undefined;
    const cone = {
      ...fireball,
      abilityId: "test_cone",
      attackShape: "cone" as const,
      castTimeSecs: 0.2,
      coneAngleDeg: 60,
    };

    assert.equal(
      rangedAttackTargetTick(
        test.env,
        test.npc,
        players.get(PLAYER_ID),
        [cone],
        800
      ).phase,
      "fired"
    );
    assert.equal(
      rangedAttackTargetTick(
        test.env,
        test.npc,
        players.get(PLAYER_ID),
        [cone],
        test.state.chaseAttack.rangedAttack.impactTime
      ).phase,
      "hit"
    );
    assert.deepEqual(
      test.attacks.map(([targetId]) => targetId).sort(),
      [PLAYER_ID, insideId].sort()
    );
  });

  it("resolves self-area geometry around the caster instead of the original target", () => {
    const nearbyId = 91_003 as BiomesId;
    const players = new Map<BiomesId, ReadonlyEntity>([
      [PLAYER_ID, targetAt(8)],
      [nearbyId, { ...targetAt(1), id: nearbyId } as ReadonlyEntity],
    ]);
    const test = fixture(players.get(PLAYER_ID));
    (test.env as any).ecsMetaIndex.player_selector.scanSphere = () => [
      ...players.keys(),
    ];
    (test.env as any).resources.get = (path: string, id: BiomesId) =>
      path === "/ecs/entity" ? players.get(id) : undefined;
    const selfAoe = {
      ...fireball,
      abilityId: "test_self_aoe",
      attackShape: "self_aoe" as const,
      castTimeSecs: 0.2,
      hitRadius: 3,
    };

    assert.equal(
      rangedAttackTargetTick(
        test.env,
        test.npc,
        players.get(PLAYER_ID),
        [selfAoe],
        900
      ).phase,
      "fired"
    );
    assert.deepEqual(test.state.chaseAttack.rangedAttack.aimPoint, [0, 0, 0]);
    assert.equal(
      rangedAttackTargetTick(
        test.env,
        test.npc,
        players.get(PLAYER_ID),
        [selfAoe],
        test.state.chaseAttack.rangedAttack.impactTime
      ).phase,
      "hit"
    );
    assert.deepEqual(
      test.attacks.map(([targetId]) => targetId),
      [nearbyId]
    );
  });
});
