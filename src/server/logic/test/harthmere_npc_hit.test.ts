import { GameEvent } from "@/server/shared/api/game_event";
import { loadVoxeloo } from "@/server/shared/voxeloo";
import {
  addGameUser,
  editEntity,
  getEntitiesWithComponent,
  TestLogicApi,
} from "@/server/test/test_helpers";
import { BikkieRuntime } from "@/shared/bikkie/active";
import { BikkieIds } from "@/shared/bikkie/ids";
import {
  Health,
  Label,
  MovementState,
  NpcMetadata,
  NpcState,
  Position,
  RigidBody,
  SelectedItem,
  Size,
  Wearing,
} from "@/shared/ecs/gen/components";
import { secondsSinceEpoch } from "@/shared/ecs/config";
import {
  UpdateNpcHealthEvent,
  UpdatePlayerHealthEvent,
} from "@/shared/ecs/gen/events";
import { LOCAL_DEV_HUMAN_NPC_TYPE_ID } from "@/shared/npc/bikkie";
import { generateTestId } from "@/shared/test_helpers";
import type { BiomesId } from "@/shared/ids";
import type { VoxelooModule } from "@/shared/wasm/types";
import assert from "assert";
import {
  HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS,
  HARTHMERE_NATIVE_MUCK_SCARRED_HELIX_SEED,
  harthmereGroundedMuckMonsterSeedsInTerritory,
} from "@/shared/harthmere/live_entity_production_seed";
import { harthmereSharedLiveCreatureRespawnRegistry } from "@/shared/harthmere/live_creature_respawn_registry";
import {
  ensureHarthmereNativeItemCatalogue,
  harthmereBiscuitForItemDefinition,
  harthmereNativeBiomesIdForItemId,
} from "@/shared/harthmere/harthmere_native_bikkie_items";
import {
  applyHarthmereNativeAttackStats,
  harthmereNativeNpcChaseAttackParams,
  harthmereNativeNpcBiscuit,
  harthmereNativeItemCombatProfile,
  mitigateHarthmereNativeIncomingDamage,
  nativeCombatArmorStats,
  harthmereNativeNpcCombatProfileForSeed,
  readHarthmereNativeCombatProgression,
  writeHarthmereNativeCombatProgression,
} from "@/shared/harthmere/harthmere_native_combat";
import { harthmereNativeLevelStats } from "@/shared/harthmere/harthmere_native_level_stats";
import {
  readHarthmereNativeVitals,
  writeHarthmereNativeVitals,
} from "@/shared/harthmere/harthmere_native_vitals";
import { addToBag, bagContains, countOf, createBag } from "@/shared/game/items";
import { anItem } from "@/shared/game/item";
import { findItemEquippableSlot } from "@/shared/game/wearables";
import {
  applyCreatureLevelResistance,
  buildCreatureProgression,
  readCreatureProgression,
  scaleCreatureCombatStats,
} from "@/shared/npc/creature_level";
import {
  deserializeNpcCustomState,
  serializeNpcCustomState,
} from "@/shared/npc/serde";
import { readHarthmereJobsBoardNativeKillLedger } from "@/shared/harthmere/jobs_board_native_kill_ledger";
import { readHarthmereNativeSkillTotalXp } from "@/shared/harthmere/harthmere_skill_progression";
import {
  readHarthmereEnergySecondaryAuthorization,
  readHarthmerePulseCarbineShotCount,
} from "@/shared/harthmere/energy_weapon_native_state";
import { harthmereBossAttacksForLabel } from "@/shared/harthmere/boss_attack_catalog";
import { HARTHMERE_BOSS_VISUAL_ASSETS } from "@/shared/harthmere/boss_visual_assets";
import { harthmereMagicChargeDurationSecs } from "@/shared/harthmere/magic_charge";
import {
  effectiveAttackStrikeDelaySecs,
  enhancedNightMuckerHexCombatParams,
  isNightForNpcAggro,
  NPC_MELEE_STRIKE_GRACE_SECONDS,
} from "@/shared/npc/behavior/chase_attack";
import { sub, yaw } from "@/shared/math/linear";

// Native NPC health is the one combat authority for Harthmere seeds. The handler
// also verifies melee reach so a voxel interaction or forged client event cannot
// damage an NPC from outside combat range.
describe("Harthmere mucker hit (updateNpcHealthEvent)", () => {
  let voxeloo!: VoxelooModule;
  before(async () => {
    voxeloo = await loadVoxeloo();
    const definitions = ensureHarthmereNativeItemCatalogue();
    const fixtures = new Map();
    for (const itemId of [
      "iron_longsword",
      "hunter_bow",
      "steel_dart",
      "crystal_focus",
      "smoke_bomb",
      "photon_sidearm",
      "pulse_carbine",
      "helix_projector",
      "nova_cannon",
      "singularity_lance",
      "leather_armor",
      "wooden_shield",
    ]) {
      const definition = definitions.find((entry) => entry.itemId === itemId)!;
      const biscuit = harthmereBiscuitForItemDefinition(definition);
      fixtures.set(biscuit.id, biscuit);
    }
    const monsterSeeds = harthmereGroundedMuckMonsterSeedsInTerritory();
    for (const seed of [
      monsterSeeds[0],
      monsterSeeds.find(({ combatKind }) => combatKind === "hex")!,
      HARTHMERE_NATIVE_MUCK_SCARRED_HELIX_SEED,
    ]) {
      const profile = harthmereNativeNpcCombatProfileForSeed(seed);
      fixtures.set(profile.id, harthmereNativeNpcBiscuit(profile));
    }
    BikkieRuntime.get().registerBiscuits(fixtures);
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

  function equipNativeItem(playerId: BiomesId, itemId: string, level = 1) {
    const nativeId = harthmereNativeBiomesIdForItemId(itemId)!;
    editEntity(logic.world, playerId, (player) => {
      const inventory = player.mutableInventory();
      inventory.hotbar[0] = countOf(nativeId, 1n);
      inventory.selected = { kind: "hotbar", idx: 0 };
      player.setSelectedItem(
        SelectedItem.create({ item: inventory.hotbar[0] })
      );
      writeHarthmereNativeCombatProgression(player.mutableTriggerState(), {
        level,
        migrationVersion: 1,
      });
    });
  }

  function spawnNativeNpc(
    seed: Parameters<typeof harthmereNativeNpcCombatProfileForSeed>[0],
    position: [number, number, number],
    hp?: number,
    progressionLevel?: number
  ) {
    const profile = harthmereNativeNpcCombatProfileForSeed(seed);
    const id = generateTestId();
    const maxHp = hp ?? profile.maxHp;
    logic.world.writeableTable.apply([
      {
        kind: "create",
        tick: logic.world.table.tick,
        entity: {
          id,
          position: Position.create({ v: position }),
          rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
          size: Size.create({ v: [1, 2, 1] }),
          health: Health.create({ hp: maxHp, maxHp }),
          npc_state:
            progressionLevel === undefined
              ? NpcState.create()
              : NpcState.create({
                  data: serializeNpcCustomState({
                    creatureProgression: buildCreatureProgression({
                      assignment: {
                        level: progressionLevel,
                        levelSource: "authored",
                      },
                    }),
                  }),
                }),
          npc_metadata: NpcMetadata.create({
            type_id: profile.id,
            created_time: 0,
            spawn_position: position,
            spawn_orientation: [0, 0],
          }),
        },
      },
    ]);
    return { id, profile };
  }

  function stageNativeMeleeReceipt(
    attacker: ReturnType<typeof spawnNativeNpc>,
    playerId: BiomesId,
    overrides?: {
      castYaw?: number;
      targetId?: BiomesId;
      result?: "hit" | "miss" | "cancelled";
      resolvedAt?: number;
    }
  ) {
    const attackerEntity = logic.world.table.get(attacker.id)!;
    const playerEntity = logic.world.table.get(playerId)!;
    const attackerPosition = attackerEntity.position!.v;
    const playerPosition = playerEntity.position!.v;
    const playerHeight = playerEntity.size?.v[1] ?? 1.8;
    const now = secondsSinceEpoch();
    const base = harthmereNativeNpcChaseAttackParams(attacker.profile)!;
    const effective =
      enhancedNightMuckerHexCombatParams(
        attackerEntity.label?.text ?? attacker.profile.displayName,
        isNightForNpcAggro(now),
        base,
        base
      ) ?? base;
    const existingState = deserializeNpcCustomState(
      attackerEntity.npc_state?.data
    );
    const progression = readCreatureProgression(existingState);
    const scaled = scaleCreatureCombatStats(
      {
        maxHp: attacker.profile.maxHp,
        attackDamage: effective.attackDamage,
        attackIntervalSecs: effective.attackIntervalSecs,
        walkSpeed: attacker.profile.walkSpeed,
        runSpeed: attacker.profile.runSpeed,
        killXp: attacker.profile.killXp,
      },
      progression.level
    );
    const strikeDelay = effectiveAttackStrikeDelaySecs({
      attackStrikeMomentSecs: effective.attackStrikeMomentSecs,
      attackAnimationMultiplier: effective.attackAnimationMultiplier,
      attackIntervalSecs: scaled.attackIntervalSecs,
    });
    const attackTime = now - strikeDelay - 0.01;
    const impactTime = attackTime + strikeDelay;
    const impactPoint: [number, number, number] = [
      playerPosition[0],
      playerPosition[1] + playerHeight * 0.5,
      playerPosition[2],
    ];
    const targetId = overrides?.targetId ?? playerId;
    editEntity(logic.world, attacker.id, (entity) => {
      entity.setNpcState(
        NpcState.create({
          data: serializeNpcCustomState({
            ...existingState,
            chaseAttack: {
              ...existingState.chaseAttack,
              attackTarget: targetId,
              attackTime,
              strikeTime: now,
              meleeAttack: {
                targetId,
                attackTime,
                impactTime,
                expiresAt: impactTime + NPC_MELEE_STRIKE_GRACE_SECONDS,
                originPoint: [...attackerPosition],
                impactPoint,
                castYaw:
                  overrides?.castYaw ??
                  yaw(sub(playerPosition, attackerPosition)),
                attackDistance: effective.attackDistance,
                attackFovDeg: effective.attackFovDeg,
                verticalReach: 1,
                attackDamage: scaled.attackDamage,
                lineOfSightAtImpact: true,
                result: overrides?.result ?? "hit",
                resolvedAt: overrides?.resolvedAt ?? now,
              },
            },
          }),
        })
      );
    });
    return {
      damage: scaled.attackDamage,
      event: new UpdatePlayerHealthEvent({
        id: playerId,
        hpDelta: -999,
        damageSource: {
          kind: "attack",
          attacker: attacker.id,
          dir: [1, 0, 0],
        },
        attackTime,
        impactPoint,
      }),
    };
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

  it("ignores attack damage during an NPC evade iframe", async () => {
    const attacker = (
      await addGameUser(logic.world, generateTestId(), {
        position: [0, 0, 0],
      })
    ).id;
    const muckerId = spawnMucker([2, 0, 0]);
    const now = secondsSinceEpoch();
    editEntity(logic.world, muckerId, (npc) => {
      npc.setMovementState(
        MovementState.create({
          action: "evade",
          action_start_time: now - 0.11,
          action_expiry_time: now + 0.39,
          invulnerability_expiry_time: now + 0.19,
          cooldown_expiry_time: now + 3,
          direction: [1, 0, 0],
        })
      );
    });

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
    assert.equal(logic.world.table.get(muckerId)?.health?.hp, 100);

    editEntity(logic.world, muckerId, (npc) => {
      npc.setMovementState(
        MovementState.create({
          ...MovementState.clone(npc.movementState()),
          action_expiry_time: now - 1,
          invulnerability_expiry_time: now - 1,
        })
      );
    });
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
    assert.equal(logic.world.table.get(muckerId)?.health?.hp, 90);
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

  it("lets two players damage the same native NPC health component", async () => {
    const attackerA = (
      await addGameUser(logic.world, generateTestId(), {
        position: [0, 0, 0],
      })
    ).id;
    const attackerB = (
      await addGameUser(logic.world, generateTestId(), {
        position: [0, 0, 1],
      })
    ).id;
    equipNativeItem(attackerA, "iron_longsword", 5);
    equipNativeItem(attackerB, "iron_longsword", 5);
    const { id: targetId } = spawnNativeNpc(
      harthmereGroundedMuckMonsterSeedsInTerritory()[0],
      [2, 0, 0],
      200
    );

    await logic.publish(
      new GameEvent(
        attackerA,
        new UpdateNpcHealthEvent({
          id: targetId,
          hp: -999,
          damageSource: { kind: "attack", attacker: attackerA, dir: [1, 0, 0] },
        })
      )
    );
    const hpAfterA = logic.world.table.get(targetId)!.health!.hp;
    assert.ok(hpAfterA < 200);

    await logic.publish(
      new GameEvent(
        attackerB,
        new UpdateNpcHealthEvent({
          id: targetId,
          hp: -999,
          damageSource: { kind: "attack", attacker: attackerB, dir: [1, 0, 0] },
        })
      )
    );
    const hpAfterB = logic.world.table.get(targetId)!.health!.hp;
    assert.ok(hpAfterB < hpAfterA);
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

  it("ignores forged client hp and computes damage from the ECS-selected sword", async () => {
    const attacker = (
      await addGameUser(logic.world, generateTestId(), {
        position: [0, 0, 0],
      })
    ).id;
    equipNativeItem(attacker, "iron_longsword", 2);
    const seed = harthmereGroundedMuckMonsterSeedsInTerritory()[0];
    const target = spawnNativeNpc(seed, [2, 0, 0], 100);
    const itemId = harthmereNativeBiomesIdForItemId("iron_longsword")!;
    const itemProfile = harthmereNativeItemCombatProfile(anItem(itemId))!;
    const attackerProgression = readHarthmereNativeCombatProgression(
      logic.world.table.get(attacker)?.trigger_state
    );
    const targetProfile = harthmereNativeNpcCombatProfileForSeed(seed);
    const attackerStats = harthmereNativeLevelStats(attackerProgression.level);
    const targetStats = harthmereNativeLevelStats(targetProfile.level);
    const statDamage = applyHarthmereNativeAttackStats({
      baseDamage: itemProfile.damagePerHit,
      kind: itemProfile.kind,
      stats: attackerStats,
      targetEvasion: targetStats.evasion,
      criticalSeed: [
        attacker,
        target.id,
        attackerProgression.lastAttackMs,
        itemId,
      ],
    });
    const levelFactor = Math.max(
      0.65,
      Math.min(
        1.75,
        1 + (attackerProgression.level - targetProfile.level) * 0.04
      )
    );
    const expectedDamage = Math.max(
      1,
      Math.round(statDamage.damage * levelFactor)
    );

    await logic.publish(
      new GameEvent(
        attacker,
        new UpdateNpcHealthEvent({
          id: target.id,
          hp: -999,
          damageSource: { kind: "attack", attacker, dir: [1, 0, 0] },
        })
      )
    );

    assert.equal(
      logic.world.table.get(target.id)?.health?.hp,
      100 - expectedDamage
    );
    const attackerState = logic.world.table.get(attacker)?.trigger_state;
    assert.equal(readHarthmereNativeVitals(attackerState).stamina, 100);
    assert.ok(readHarthmereNativeSkillTotalXp(attackerState, "combat") > 0);
    assert.ok(
      readHarthmereNativeSkillTotalXp(attackerState, "melee_combat") > 0
    );
  });

  it("allows ordinary attacks at zero movement stamina without spending it", async () => {
    const attacker = (
      await addGameUser(logic.world, generateTestId(), {
        position: [0, 0, 0],
      })
    ).id;
    equipNativeItem(attacker, "iron_longsword", 2);
    editEntity(logic.world, attacker, (player) => {
      writeHarthmereNativeVitals(player.mutableTriggerState(), {
        stamina: 0,
      });
    });
    const target = spawnNativeNpc(
      harthmereGroundedMuckMonsterSeedsInTerritory()[0],
      [2, 0, 0],
      100
    );

    await logic.publish(
      new GameEvent(
        attacker,
        new UpdateNpcHealthEvent({
          id: target.id,
          hp: -999,
          damageSource: { kind: "attack", attacker, dir: [1, 0, 0] },
        })
      )
    );

    assert.ok((logic.world.table.get(target.id)?.health?.hp ?? 100) < 100);
    assert.equal(
      readHarthmereNativeVitals(logic.world.table.get(attacker)?.trigger_state)
        .stamina,
      0
    );
  });

  it("applies creature-level resistance in the authoritative NPC damage transaction", async () => {
    const attacker = (
      await addGameUser(logic.world, generateTestId(), {
        position: [0, 0, 0],
      })
    ).id;
    equipNativeItem(attacker, "iron_longsword", 2);
    const target = spawnNativeNpc(
      harthmereGroundedMuckMonsterSeedsInTerritory()[0],
      [2, 0, 0],
      100,
      20
    );
    const itemId = harthmereNativeBiomesIdForItemId("iron_longsword")!;
    const itemProfile = harthmereNativeItemCombatProfile(anItem(itemId))!;
    const attackerProgression = readHarthmereNativeCombatProgression(
      logic.world.table.get(attacker)?.trigger_state
    );
    const attackerStats = harthmereNativeLevelStats(attackerProgression.level);
    const targetStats = harthmereNativeLevelStats(target.profile.level);
    const statDamage = applyHarthmereNativeAttackStats({
      baseDamage: itemProfile.damagePerHit,
      kind: itemProfile.kind,
      stats: attackerStats,
      targetEvasion: targetStats.evasion,
      criticalSeed: [
        attacker,
        target.id,
        attackerProgression.lastAttackMs,
        itemId,
      ],
    });
    const levelFactor = Math.max(
      0.65,
      Math.min(
        1.75,
        1 + (attackerProgression.level - target.profile.level) * 0.04
      )
    );
    const rawDamage = Math.max(1, Math.round(statDamage.damage * levelFactor));
    const expectedDamage = applyCreatureLevelResistance(rawDamage, 20);

    await logic.publish(
      new GameEvent(
        attacker,
        new UpdateNpcHealthEvent({
          id: target.id,
          hp: -999,
          damageSource: { kind: "attack", attacker, dir: [1, 0, 0] },
        })
      )
    );

    assert.equal(
      logic.world.table.get(target.id)?.health?.hp,
      100 - expectedDamage
    );
  });

  it("rejects non-combat hotbar items and under-level weapons", async () => {
    const attacker = (
      await addGameUser(logic.world, generateTestId(), {
        position: [0, 0, 0],
      })
    ).id;
    const seed = harthmereGroundedMuckMonsterSeedsInTerritory()[0];
    const first = spawnNativeNpc(seed, [2, 0, 0], 100);
    equipNativeItem(attacker, "muckwad", 10);
    await logic.publish(
      new GameEvent(
        attacker,
        new UpdateNpcHealthEvent({
          id: first.id,
          hp: -999,
          damageSource: { kind: "attack", attacker, dir: [1, 0, 0] },
        })
      )
    );
    assert.equal(logic.world.table.get(first.id)?.health?.hp, 100);

    const second = spawnNativeNpc(seed, [2, 0, 1], 100);
    equipNativeItem(attacker, "iron_longsword", 1);
    await logic.publish(
      new GameEvent(
        attacker,
        new UpdateNpcHealthEvent({
          id: second.id,
          hp: -999,
          damageSource: { kind: "attack", attacker, dir: [1, 0, 0] },
        })
      )
    );
    assert.equal(logic.world.table.get(second.id)?.health?.hp, 100);
  });

  it("enforces protected sentinels and dead attackers on the server", async () => {
    const attacker = (
      await addGameUser(logic.world, generateTestId(), {
        position: [0, 0, 0],
      })
    ).id;
    equipNativeItem(attacker, "iron_longsword", 10);
    const sentinel = spawnNativeNpc(
      HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS[0],
      [2, 0, 0],
      1
    );

    const attack = (targetId: BiomesId) =>
      logic.publish(
        new GameEvent(
          attacker,
          new UpdateNpcHealthEvent({
            id: targetId,
            hp: -999,
            damageSource: { kind: "attack", attacker, dir: [1, 0, 0] },
          })
        )
      );
    await attack(sentinel.id);
    assert.equal(logic.world.table.get(sentinel.id)?.health?.hp, 1);

    const mucker = spawnNativeNpc(
      harthmereGroundedMuckMonsterSeedsInTerritory()[0],
      [2, 0, 1],
      100
    );
    editEntity(logic.world, attacker, (entity) => {
      entity.mutableHealth().hp = 0;
    });
    await attack(mucker.id);
    assert.equal(logic.world.table.get(mucker.id)?.health?.hp, 100);
  });

  it("supports authoritative ranged reach and consumes weapon durability", async () => {
    const attacker = (
      await addGameUser(logic.world, generateTestId(), {
        position: [0, 0, 0],
      })
    ).id;
    equipNativeItem(attacker, "hunter_bow", 1);
    const before =
      logic.world.table.get(attacker)?.inventory?.hotbar[0]?.item
        .lifetimeDurabilityMs;
    const target = spawnNativeNpc(
      harthmereGroundedMuckMonsterSeedsInTerritory()[0],
      [20, 0, 0],
      100
    );

    await logic.publish(
      new GameEvent(
        attacker,
        new UpdateNpcHealthEvent({
          id: target.id,
          hp: -999,
          damageSource: { kind: "attack", attacker, dir: [1, 0, 0] },
        })
      )
    );

    assert.equal(logic.world.table.get(target.id)?.health?.hp, 93);
    const after =
      logic.world.table.get(attacker)?.inventory?.hotbar[0]?.item
        .lifetimeDurabilityMs;
    assert.ok(before && after && after < before);
    const attackerState = logic.world.table.get(attacker)?.trigger_state;
    assert.ok(readHarthmereNativeSkillTotalXp(attackerState, "combat") > 0);
    assert.ok(
      readHarthmereNativeSkillTotalXp(attackerState, "ranged_combat") > 0
    );
    assert.ok(readHarthmereNativeSkillTotalXp(attackerState, "archery") > 0);
  });

  it("uses authored thrown and magic profiles for native range, damage, and skills", async () => {
    for (const [itemId, level, skillId] of [
      ["steel_dart", 1, "ranged_combat"],
      ["smoke_bomb", 1, "ranged_combat"],
      ["crystal_focus", 5, "fire_magic"],
    ] as const) {
      const attacker = (
        await addGameUser(logic.world, generateTestId(), {
          position: [0, 0, 0],
        })
      ).id;
      equipNativeItem(attacker, itemId, level);
      const target = spawnNativeNpc(
        harthmereGroundedMuckMonsterSeedsInTerritory()[0],
        [15, 0, 0],
        100
      );

      await logic.publish(
        new GameEvent(
          attacker,
          new UpdateNpcHealthEvent({
            id: target.id,
            hp: -999,
            damageSource: { kind: "attack", attacker, dir: [1, 0, 0] },
          })
        )
      );

      assert.ok(
        (logic.world.table.get(target.id)?.health?.hp ?? 100) < 100,
        itemId
      );
      assert.ok(
        readHarthmereNativeSkillTotalXp(
          logic.world.table.get(attacker)?.trigger_state,
          skillId
        ) > 0,
        `${itemId}:${skillId}`
      );
    }
  });

  it("enforces energy falloff, increasing cooldown authority, and infinite durability", async () => {
    const attacker = (
      await addGameUser(logic.world, generateTestId(), {
        position: [0, 0, 0],
      })
    ).id;
    equipNativeItem(attacker, "photon_sidearm", 1);
    const target = spawnNativeNpc(
      harthmereGroundedMuckMonsterSeedsInTerritory()[0],
      [14, 0, 0],
      100
    );
    const event = new UpdateNpcHealthEvent({
      id: target.id,
      hp: -999,
      damageSource: { kind: "attack", attacker, dir: [1, 0, 0] },
    });

    await logic.publish(new GameEvent(attacker, event));
    const afterFirst = logic.world.table.get(target.id)?.health?.hp ?? 100;
    assert.ok(afterFirst < 100 && afterFirst > 88);
    await logic.publish(new GameEvent(attacker, event));
    assert.equal(logic.world.table.get(target.id)?.health?.hp, afterFirst);
    assert.equal(
      logic.world.table.get(attacker)?.inventory?.hotbar[0]?.item
        .lifetimeDurabilityMs,
      undefined
    );
  });

  it("authorizes the Helix penetration target once and persists Anima Energy Burn", async () => {
    const attacker = (
      await addGameUser(logic.world, generateTestId(), {
        position: [0, 0, 0],
      })
    ).id;
    equipNativeItem(attacker, "helix_projector", 18);
    const seed = harthmereGroundedMuckMonsterSeedsInTerritory()[0];
    const primary = spawnNativeNpc(seed, [10, 0, 0], 150);
    const penetrated = spawnNativeNpc(seed, [12, 0, 0], 150);
    const attack = (id: BiomesId) =>
      logic.publish(
        new GameEvent(
          attacker,
          new UpdateNpcHealthEvent({
            id,
            hp: -999,
            damageSource: { kind: "attack", attacker, dir: [1, 0, 0] },
          })
        )
      );

    await attack(primary.id);
    const primaryState = deserializeNpcCustomState(
      logic.world.table.get(primary.id)?.npc_state?.data
    );
    assert.equal(primaryState.energyWeapon?.burn?.ticksRemaining, 4);
    assert.equal(
      readHarthmereEnergySecondaryAuthorization(
        logic.world.table.get(attacker)?.trigger_state
      )?.mode,
      "penetration"
    );
    await attack(penetrated.id);
    const afterPenetration =
      logic.world.table.get(penetrated.id)?.health?.hp ?? 150;
    assert.ok(afterPenetration < 150);
    await attack(penetrated.id);
    assert.equal(
      logic.world.table.get(penetrated.id)?.health?.hp,
      afterPenetration
    );
  });

  it("applies Nova death splash and Singularity pull through validated secondary targets", async () => {
    const seed = harthmereGroundedMuckMonsterSeedsInTerritory()[0];
    const novaAttacker = (
      await addGameUser(logic.world, generateTestId(), {
        position: [0, 0, 0],
      })
    ).id;
    equipNativeItem(novaAttacker, "nova_cannon", 30);
    const novaPrimary = spawnNativeNpc(seed, [10, 0, 0], 1);
    const novaSecondary = spawnNativeNpc(seed, [12, 0, 0], 200);
    const novaSource = {
      kind: "attack" as const,
      attacker: novaAttacker,
      dir: [1, 0, 0] as [number, number, number],
    };
    await logic.publish(
      new GameEvent(
        novaAttacker,
        new UpdateNpcHealthEvent({
          id: novaPrimary.id,
          hp: -999,
          damageSource: novaSource,
        })
      )
    );
    await logic.publish(
      new GameEvent(
        novaAttacker,
        new UpdateNpcHealthEvent({
          id: novaSecondary.id,
          hp: -1,
          damageSource: novaSource,
        })
      )
    );
    assert.equal(logic.world.table.get(novaPrimary.id)?.health?.hp, 0);
    assert.ok(
      (logic.world.table.get(novaSecondary.id)?.health?.hp ?? 200) < 170
    );
    assert.equal(
      deserializeNpcCustomState(
        logic.world.table.get(novaPrimary.id)?.npc_state?.data
      ).energyWeapon?.lastEffect?.id,
      "nova_cannon_mini_nova"
    );

    const lanceAttacker = (
      await addGameUser(logic.world, generateTestId(), {
        position: [0, 0, 0],
      })
    ).id;
    equipNativeItem(lanceAttacker, "singularity_lance", 45);
    const lancePrimary = spawnNativeNpc(seed, [10, 0, 0], 500);
    const lanceSecondary = spawnNativeNpc(seed, [13, 0, 0], 500);
    const lanceSource = {
      kind: "attack" as const,
      attacker: lanceAttacker,
      dir: [1, 0, 0] as [number, number, number],
    };
    await logic.publish(
      new GameEvent(
        lanceAttacker,
        new UpdateNpcHealthEvent({
          id: lancePrimary.id,
          hp: -999,
          damageSource: lanceSource,
        })
      )
    );
    await logic.publish(
      new GameEvent(
        lanceAttacker,
        new UpdateNpcHealthEvent({
          id: lanceSecondary.id,
          hp: -1,
          damageSource: lanceSource,
        })
      )
    );
    assert.ok(
      (logic.world.table.get(lanceSecondary.id)?.health?.hp ?? 500) < 500
    );
    assert.ok(
      (logic.world.table.get(lanceSecondary.id)?.rigid_body?.velocity[0] ?? 0) <
        0
    );
  });

  it("counts only accepted Pulse Carbine shots and overcharges the tenth", async () => {
    const attacker = (
      await addGameUser(logic.world, generateTestId(), {
        position: [0, 0, 0],
      })
    ).id;
    equipNativeItem(attacker, "pulse_carbine", 8);
    const seed = harthmereGroundedMuckMonsterSeedsInTerritory()[0];
    const damages: number[] = [];
    for (let shot = 1; shot <= 10; shot += 1) {
      editEntity(logic.world, attacker, (player) => {
        writeHarthmereNativeCombatProgression(player.mutableTriggerState(), {
          lastAttackMs: 0,
        });
        writeHarthmereNativeVitals(player.mutableTriggerState(), {
          stamina: 100,
        });
      });
      const target = spawnNativeNpc(seed, [8, 0, 0], 200);
      await logic.publish(
        new GameEvent(
          attacker,
          new UpdateNpcHealthEvent({
            id: target.id,
            hp: -999,
            damageSource: { kind: "attack", attacker, dir: [1, 0, 0] },
          })
        )
      );
      damages.push(200 - (logic.world.table.get(target.id)?.health?.hp ?? 200));
    }
    assert.equal(
      readHarthmerePulseCarbineShotCount(
        logic.world.table.get(attacker)?.trigger_state
      ),
      10
    );
    assert.ok(damages[9] > damages[8]);
  });

  it("awards native XP and boss credit in the same death transaction", async () => {
    const attacker = (
      await addGameUser(logic.world, generateTestId(), {
        position: [0, 0, 0],
      })
    ).id;
    equipNativeItem(attacker, "iron_longsword", 5);
    const boss = spawnNativeNpc(
      HARTHMERE_NATIVE_MUCK_SCARRED_HELIX_SEED,
      [2, 0, 0],
      1
    );

    await logic.publish(
      new GameEvent(
        attacker,
        new UpdateNpcHealthEvent({
          id: boss.id,
          hp: -999,
          damageSource: { kind: "attack", attacker, dir: [1, 0, 0] },
        })
      )
    );

    assert.equal(logic.world.table.get(boss.id)?.health?.hp, 0);
    const bossHealth = logic.world.table.get(boss.id)?.health;
    assert.equal(bossHealth?.lastDamageSource?.kind, "attack");
    if (bossHealth?.lastDamageSource?.kind === "attack") {
      assert.equal(bossHealth.lastDamageSource.attacker, attacker);
    }
    const progression = readHarthmereNativeCombatProgression(
      logic.world.table.get(attacker)?.trigger_state
    );
    assert.equal(progression.bossKills, 1);
    assert.ok(progression.xp > 0 || progression.level > 5);
    assert.ok(
      readHarthmereJobsBoardNativeKillLedger(
        logic.world.table.get(attacker)?.trigger_state
      )[String(boss.id)] > 0,
      "the exact killed NPC entity must be recorded for bounty completion"
    );

    const dropped = createBag();
    for (const entity of getEntitiesWithComponent(logic.world, "grab_bag")) {
      addToBag(dropped, entity.grab_bag.slots);
    }
    assert.ok(
      bagContains(
        dropped,
        countOf(harthmereNativeBiomesIdForItemId("muckwad")!, 8n)
      )
    );
    assert.ok(
      bagContains(
        dropped,
        countOf(harthmereNativeBiomesIdForItemId("mana_essence")!, 4n)
      )
    );
  });

  it("requires one receipt-backed impact and applies native level plus worn armor", async () => {
    const player = (
      await addGameUser(logic.world, generateTestId(), {
        position: [0, 0, 0],
      })
    ).id;
    const leather = anItem(harthmereNativeBiomesIdForItemId("leather_armor")!);
    const shield = anItem(harthmereNativeBiomesIdForItemId("wooden_shield")!);
    editEntity(logic.world, player, (entity) => {
      const wearing = Wearing.clone(entity.wearing());
      wearing.items.set(findItemEquippableSlot(leather)!, leather);
      wearing.items.set(findItemEquippableSlot(shield)!, shield);
      entity.setWearing(wearing);
      writeHarthmereNativeCombatProgression(entity.mutableTriggerState(), {
        level: 3,
        migrationVersion: 1,
      });
    });
    const attacker = spawnNativeNpc(
      harthmereGroundedMuckMonsterSeedsInTerritory()[0],
      [2, 0, 0]
    );
    const armor = nativeCombatArmorStats([leather, shield]);
    const defenderStats = harthmereNativeLevelStats(3);
    const attackerStats = harthmereNativeLevelStats(attacker.profile.level);

    // A client-provided NPC id and hpDelta are not an attack receipt.
    await logic.publish(
      new GameEvent(
        player,
        new UpdatePlayerHealthEvent({
          id: player,
          hpDelta: -999,
          damageSource: {
            kind: "attack",
            attacker: attacker.id,
            dir: [-1, 0, 0],
          },
        })
      )
    );
    assert.equal(logic.world.table.get(player)?.health?.hp, 100);

    const receipt = stageNativeMeleeReceipt(attacker, player);
    const expectedDamage = mitigateHarthmereNativeIncomingDamage({
      rawDamage: receipt.damage,
      armor: armor.armor + defenderStats.armor,
      defense: armor.defense + defenderStats.defense,
      evasion: armor.evasion + defenderStats.evasion,
      accuracy: attackerStats.accuracy,
      attackerLevel: attacker.profile.level,
      defenderLevel: 3,
    });

    await logic.publish(new GameEvent(player, receipt.event));

    assert.equal(
      logic.world.table.get(player)?.health?.hp,
      100 - expectedDamage
    );
    assert.ok(
      readHarthmereNativeSkillTotalXp(
        logic.world.table.get(player)?.trigger_state,
        "shield_mastery"
      ) > 0
    );
    const worn = [
      ...(logic.world.table.get(player)?.wearing?.items.values() ?? []),
    ];
    assert.ok(
      worn.some(
        (item) =>
          item.id === leather.id &&
          (item.lifetimeDurabilityMs ?? 0) < (leather.lifetimeDurabilityMs ?? 0)
      )
    );

    const hpAfterHit = logic.world.table.get(player)?.health?.hp;
    await logic.publish(new GameEvent(player, receipt.event));
    assert.equal(logic.world.table.get(player)?.health?.hp, hpAfterHit);
  });

  it("uses the same body-aware vertical melee reach as Anima", async () => {
    const player = (
      await addGameUser(logic.world, generateTestId(), {
        position: [0.65, 2, 0],
      })
    ).id;
    const attacker = spawnNativeNpc(
      harthmereGroundedMuckMonsterSeedsInTerritory()[0],
      [0, 0, 0]
    );
    editEntity(logic.world, attacker.id, (entity) => {
      entity.setSize(Size.create({ v: [1, 1.2, 1] }));
    });

    const attack = () => {
      const receipt = stageNativeMeleeReceipt(attacker, player);
      return logic.publish(new GameEvent(player, receipt.event));
    };

    // Feet differ by 2 m, but the 1.2 m attacker body leaves only a 0.8 m
    // vertical gap. This is the reachable ledge case Anima already accepts.
    await attack();
    assert.ok((logic.world.table.get(player)?.health?.hp ?? 100) < 100);

    editEntity(logic.world, player, (entity) => {
      entity.setPosition(Position.create({ v: [0.65, 3, 0] }));
      entity.setHealth(Health.create({ hp: 100, maxHp: 100 }));
    });
    // A 3 m feet offset leaves 1.8 m of empty vertical space and must remain
    // unhittable through the floor/ledge.
    await attack();
    assert.equal(logic.world.table.get(player)?.health?.hp, 100);
  });

  it("rejects a directional boss melee receipt when the player is riding its back", async () => {
    const player = (
      await addGameUser(logic.world, generateTestId(), {
        position: [0, 10, 0],
      })
    ).id;
    const attacker = spawnNativeNpc(
      harthmereGroundedMuckMonsterSeedsInTerritory()[0],
      [0, 0, 0]
    );
    editEntity(logic.world, attacker.id, (entity) => {
      entity.setSize(Size.create({ v: [20, 14, 12] }));
    });

    const receipt = stageNativeMeleeReceipt(attacker, player);
    await logic.publish(new GameEvent(player, receipt.event));

    assert.equal(logic.world.table.get(player)?.health?.hp, 100);
  });

  it("rejects a receipt whose impact facing no longer contains the player", async () => {
    const player = (
      await addGameUser(logic.world, generateTestId(), {
        position: [1, 0, 0],
      })
    ).id;
    const attacker = spawnNativeNpc(
      harthmereGroundedMuckMonsterSeedsInTerritory()[0],
      [0, 0, 0]
    );
    const backwards = stageNativeMeleeReceipt(attacker, player, {
      castYaw: yaw([-1, 0, 0]),
    });
    await logic.publish(new GameEvent(player, backwards.event));
    assert.equal(logic.world.table.get(player)?.health?.hp, 100);
  });

  it("accepts one authoritative Hex Fireball hit and rejects its replay", async () => {
    const player = (
      await addGameUser(logic.world, generateTestId(), {
        position: [8, 0, 0],
      })
    ).id;
    const hexSeed = harthmereGroundedMuckMonsterSeedsInTerritory().find(
      ({ combatKind }) => combatKind === "hex"
    )!;
    const attacker = spawnNativeNpc(hexSeed, [0, 0, 0]);
    const fireball = attacker.profile.rangedAttacks?.find(
      ({ abilityId }) => abilityId === "fireball"
    );
    assert.ok(fireball);
    const now = secondsSinceEpoch();
    const chargeTimeSecs = harthmereMagicChargeDurationSecs({
      damageType: fireball.damageType,
      projectileVisualId: fireball.projectileVisualId,
      attackDamage: fireball.attackDamage,
      cooldownSecs: fireball.cooldownSecs,
      attackShape: fireball.attackShape,
    });
    const releaseTime = now - fireball.castTimeSecs;
    const castTime = releaseTime - chargeTimeSecs;
    const impactPoint: [number, number, number] = [8, 1, 0];
    editEntity(logic.world, attacker.id, (entity) => {
      entity.setNpcState(
        NpcState.create({
          data: serializeNpcCustomState({
            chaseAttack: {
              attackTarget: player,
              rangedAttack: {
                abilityId: "fireball",
                projectileVisualId: "fireball",
                targetId: player,
                castTime,
                chargeTimeSecs,
                releaseTime,
                impactTime: now - 0.01,
                cooldownUntil: releaseTime + fireball.cooldownSecs,
                aimPoint: impactPoint,
                result: "hit",
                resolvedAt: now,
              },
            },
          }),
        })
      );
    });
    const event = new UpdatePlayerHealthEvent({
      id: player,
      hpDelta: -999,
      damageSource: {
        kind: "attack",
        attacker: attacker.id,
        dir: [1, 0, 0],
      },
      attackAbilityId: "fireball",
      attackTime: releaseTime,
      impactPoint,
    });

    await logic.publish(
      new GameEvent(
        player,
        new UpdatePlayerHealthEvent({
          ...event,
          attackTime: castTime,
        })
      )
    );
    assert.equal(logic.world.table.get(player)?.health?.hp, 100);

    await logic.publish(new GameEvent(player, event));
    const hpAfterHit = logic.world.table.get(player)?.health?.hp ?? 100;
    assert.ok(hpAfterHit < 100);

    await logic.publish(new GameEvent(player, event));
    assert.equal(logic.world.table.get(player)?.health?.hp, hpAfterHit);
  });

  it("rejects a Hex Fireball whose fixed aim point misses the target", async () => {
    const player = (
      await addGameUser(logic.world, generateTestId(), {
        position: [8, 0, 0],
      })
    ).id;
    const hexSeed = harthmereGroundedMuckMonsterSeedsInTerritory().find(
      ({ combatKind }) => combatKind === "hex"
    )!;
    const attacker = spawnNativeNpc(hexSeed, [0, 0, 0]);
    const fireball = attacker.profile.rangedAttacks?.find(
      ({ abilityId }) => abilityId === "fireball"
    );
    assert.ok(fireball);
    const now = secondsSinceEpoch();
    const chargeTimeSecs = harthmereMagicChargeDurationSecs({
      damageType: fireball.damageType,
      projectileVisualId: fireball.projectileVisualId,
      attackDamage: fireball.attackDamage,
      cooldownSecs: fireball.cooldownSecs,
      attackShape: fireball.attackShape,
    });
    const releaseTime = now - fireball.castTimeSecs;
    const castTime = releaseTime - chargeTimeSecs;
    const missedPoint: [number, number, number] = [8, 1, 3];
    editEntity(logic.world, attacker.id, (entity) => {
      entity.setNpcState(
        NpcState.create({
          data: serializeNpcCustomState({
            chaseAttack: {
              attackTarget: player,
              rangedAttack: {
                abilityId: "fireball",
                projectileVisualId: "fireball",
                targetId: player,
                castTime,
                chargeTimeSecs,
                releaseTime,
                impactTime: now - 0.01,
                cooldownUntil: releaseTime + fireball.cooldownSecs,
                aimPoint: missedPoint,
                result: "miss",
                resolvedAt: now,
              },
            },
          }),
        })
      );
    });

    await logic.publish(
      new GameEvent(
        player,
        new UpdatePlayerHealthEvent({
          id: player,
          hpDelta: -999,
          damageSource: {
            kind: "attack",
            attacker: attacker.id,
            dir: [1, 0, 0],
          },
          attackAbilityId: "fireball",
          attackTime: releaseTime,
          impactPoint: missedPoint,
        })
      )
    );
    assert.equal(logic.world.table.get(player)?.health?.hp, 100);
  });

  it("validates a label-routed boss ground spell once for every recorded ECS target", async () => {
    const firstPlayer = (
      await addGameUser(logic.world, generateTestId(), {
        position: [4, 0, 0],
      })
    ).id;
    const secondPlayer = (
      await addGameUser(logic.world, generateTestId(), {
        position: [5, 0, 0],
      })
    ).id;
    const bossId = generateTestId();
    const attack = harthmereBossAttacksForLabel("The Gilded Bull")?.find(
      ({ abilityId }) => abilityId === "bull_pillar_crash"
    );
    assert.ok(attack);
    const now = secondsSinceEpoch();
    const chargeTimeSecs = harthmereMagicChargeDurationSecs({
      damageType: attack.damageType,
      projectileVisualId: attack.projectileVisualId,
      attackDamage: attack.attackDamage,
      cooldownSecs: attack.cooldownSecs,
      attackShape: attack.attackShape,
    });
    const releaseTime = now - attack.castTimeSecs;
    const castTime = releaseTime - chargeTimeSecs;
    const impactPoint: [number, number, number] = [4.5, 1, 0];
    logic.world.writeableTable.apply([
      {
        kind: "create",
        tick: logic.world.table.tick,
        entity: {
          id: bossId,
          label: Label.create({ text: "The Gilded Bull" }),
          position: Position.create({ v: [0, 0, 0] }),
          rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
          size: Size.create({ v: [3.9, 2.7, 5.6] }),
          health: Health.create({ hp: 420, maxHp: 420 }),
          npc_metadata: NpcMetadata.create({
            type_id: BikkieIds.dMucker,
            created_time: 0,
            spawn_position: [0, 0, 0],
            spawn_orientation: [0, 0],
          }),
          npc_state: NpcState.create({
            data: serializeNpcCustomState({
              chaseAttack: {
                attackTarget: firstPlayer,
                rangedAttack: {
                  abilityId: attack.abilityId,
                  projectileVisualId: attack.projectileVisualId,
                  targetId: firstPlayer,
                  castTime,
                  chargeTimeSecs,
                  releaseTime,
                  impactTime: now - 0.01,
                  cooldownUntil: releaseTime + attack.cooldownSecs,
                  originPoint: [0, 0, 0],
                  aimPoint: impactPoint,
                  hitTargetIds: [firstPlayer, secondPlayer],
                  result: "hit",
                  resolvedAt: now,
                },
              },
            }),
          }),
        },
      },
    ]);

    for (const playerId of [firstPlayer, secondPlayer]) {
      await logic.publish(
        new GameEvent(
          playerId,
          new UpdatePlayerHealthEvent({
            id: playerId,
            hpDelta: -999,
            damageSource: {
              kind: "attack",
              attacker: bossId,
              dir: [1, 0, 0],
            },
            attackAbilityId: attack.abilityId,
            attackTime: releaseTime,
            impactPoint,
          })
        )
      );
      assert.ok((logic.world.table.get(playerId)?.health?.hp ?? 100) < 100);
    }
  });

  it("accepts authoritative player damage receipts for all 55 live boss attacks", async () => {
    const player = (
      await addGameUser(logic.world, generateTestId(), {
        position: [4, 0, 0],
      })
    ).id;
    let acceptedAttacks = 0;

    for (const visual of HARTHMERE_BOSS_VISUAL_ASSETS) {
      const attacks = harthmereBossAttacksForLabel(visual.displayName);
      assert.ok(attacks, visual.displayName);
      assert.equal(attacks.length, 5, visual.displayName);
      const bossId = (visual.entityIds?.[0] ?? generateTestId()) as BiomesId;
      const label =
        visual.id === "alpha_mucker"
          ? "Old Wood Mucker 1"
          : visual.id === "hex_wraith"
            ? "Gravewood Pale Hexer 7"
            : visual.displayName;
      logic.world.writeableTable.apply([
        {
          kind: "create",
          tick: logic.world.table.tick,
          entity: {
            id: bossId,
            label: Label.create({ text: label }),
            position: Position.create({ v: [0, 0, 0] }),
            rigid_body: RigidBody.create({ velocity: [0, 0, 0] }),
            size: Size.create({ v: [...visual.worldSize] }),
            health: Health.create({ hp: 10_000, maxHp: 10_000 }),
            npc_metadata: NpcMetadata.create({
              type_id: BikkieIds.dMucker,
              created_time: 0,
              spawn_position: [0, 0, 0],
              spawn_orientation: [0, 0],
            }),
            npc_state: NpcState.create(),
          },
        },
      ]);

      for (const attack of attacks) {
        acceptedAttacks += 1;
        const shape = attack.attackShape ?? "projectile";
        const maximumHitDistance =
          shape === "self_aoe"
            ? Math.min(attack.attackDistance, attack.hitRadius * 0.7)
            : attack.attackDistance;
        const targetDistance = Math.max(
          attack.minimumDistance + 0.2,
          Math.min(maximumHitDistance - 0.2, 6)
        );
        const playerPosition: [number, number, number] = [targetDistance, 0, 0];
        const impactPoint: [number, number, number] =
          shape === "self_aoe" ? [0, 0, 0] : [targetDistance, 1, 0];
        editEntity(logic.world, player, (entity) => {
          entity.setPosition(Position.create({ v: playerPosition }));
          entity.setHealth(Health.create({ hp: 100, maxHp: 100 }));
        });
        const now = secondsSinceEpoch();
        const chargeTimeSecs = harthmereMagicChargeDurationSecs({
          damageType: attack.damageType,
          projectileVisualId: attack.projectileVisualId,
          attackDamage: attack.attackDamage,
          cooldownSecs: attack.cooldownSecs,
          attackShape: attack.attackShape,
        });
        const releaseTime = now - attack.castTimeSecs;
        const castTime = releaseTime - chargeTimeSecs;
        editEntity(logic.world, bossId, (entity) => {
          entity.setNpcState(
            NpcState.create({
              data: serializeNpcCustomState({
                chaseAttack: {
                  attackTarget: player,
                  rangedAttack: {
                    abilityId: attack.abilityId,
                    projectileVisualId: attack.projectileVisualId,
                    targetId: player,
                    castTime,
                    chargeTimeSecs,
                    releaseTime,
                    impactTime: now - 0.01,
                    cooldownUntil: releaseTime + attack.cooldownSecs,
                    originPoint: [0, 0, 0],
                    aimPoint: impactPoint,
                    hitTargetIds: [player],
                    result: "hit",
                    resolvedAt: now,
                  },
                },
              }),
            })
          );
        });
        const event = new UpdatePlayerHealthEvent({
          id: player,
          hpDelta: -999,
          damageSource: {
            kind: "attack",
            attacker: bossId,
            dir: [1, 0, 0],
          },
          attackAbilityId: attack.abilityId,
          attackTime: releaseTime,
          impactPoint,
        });

        await logic.publish(new GameEvent(player, event));
        const hpAfterHit = logic.world.table.get(player)?.health?.hp ?? 100;
        assert.ok(
          hpAfterHit < 100,
          `${visual.displayName}: ${attack.displayName} did not damage player health`
        );
        await logic.publish(new GameEvent(player, event));
        assert.equal(
          logic.world.table.get(player)?.health?.hp,
          hpAfterHit,
          `${visual.displayName}: ${attack.displayName} replay was accepted`
        );
      }
    }
    assert.equal(acceptedAttacks, 55);
  });

  it("applies per-entity creature level to authoritative outgoing NPC damage", async () => {
    const player = (
      await addGameUser(logic.world, generateTestId(), {
        position: [1, 0, 0],
      })
    ).id;
    const seed = harthmereGroundedMuckMonsterSeedsInTerritory()[0];
    const levelOne = spawnNativeNpc(seed, [0, 0, 0], undefined, 1);
    const levelFive = spawnNativeNpc(seed, [0, 0, 0], undefined, 5);
    editEntity(logic.world, player, (entity) => {
      entity.setHealth(Health.create({ hp: 500, maxHp: 500 }));
    });

    const attackFrom = (attacker: ReturnType<typeof spawnNativeNpc>) => {
      const receipt = stageNativeMeleeReceipt(attacker, player);
      return logic.publish(new GameEvent(player, receipt.event));
    };

    await attackFrom(levelOne);
    const levelOneDamage =
      500 - (logic.world.table.get(player)?.health?.hp ?? 500);
    editEntity(logic.world, player, (entity) => {
      entity.setHealth(Health.create({ hp: 500, maxHp: 500 }));
    });
    await attackFrom(levelFive);
    const levelFiveDamage =
      500 - (logic.world.table.get(player)?.health?.hp ?? 500);

    assert.ok(levelOneDamage > 0);
    assert.ok(levelFiveDamage > levelOneDamage);
  });

  it("uses the same selected weapon, level, range, and cooldown authority for PvP", async () => {
    const attacker = (
      await addGameUser(logic.world, generateTestId(), {
        position: [0, 0, 0],
      })
    ).id;
    const defender = (
      await addGameUser(logic.world, generateTestId(), {
        position: [2, 0, 0],
      })
    ).id;
    equipNativeItem(attacker, "iron_longsword", 2);
    editEntity(logic.world, defender, (entity) => {
      writeHarthmereNativeCombatProgression(entity.mutableTriggerState(), {
        level: 2,
        migrationVersion: 1,
      });
    });
    const itemId = harthmereNativeBiomesIdForItemId("iron_longsword")!;
    const itemProfile = harthmereNativeItemCombatProfile(anItem(itemId))!;
    const attackerProgression = readHarthmereNativeCombatProgression(
      logic.world.table.get(attacker)?.trigger_state
    );
    const defenderProgression = readHarthmereNativeCombatProgression(
      logic.world.table.get(defender)?.trigger_state
    );
    const attackerStats = harthmereNativeLevelStats(attackerProgression.level);
    const defenderStats = harthmereNativeLevelStats(defenderProgression.level);
    const statDamage = applyHarthmereNativeAttackStats({
      baseDamage: itemProfile.damagePerHit,
      kind: itemProfile.kind,
      stats: attackerStats,
      criticalSeed: [
        attacker,
        defender,
        attackerProgression.lastAttackMs,
        itemId,
      ],
    });
    const expectedDamage = mitigateHarthmereNativeIncomingDamage({
      rawDamage: statDamage.damage,
      armor: defenderStats.armor,
      defense: defenderStats.defense,
      evasion: defenderStats.evasion,
      accuracy: attackerStats.accuracy,
      attackerLevel: attackerProgression.level,
      defenderLevel: defenderProgression.level,
    });

    const attack = () =>
      logic.publish(
        new GameEvent(
          attacker,
          new UpdatePlayerHealthEvent({
            id: defender,
            hpDelta: -999,
            damageSource: {
              kind: "attack",
              attacker,
              dir: [1, 0, 0],
            },
          })
        )
      );
    await attack();
    await attack();

    // The forged -999 is ignored and the immediate replay is cooldown-blocked.
    assert.equal(
      logic.world.table.get(defender)?.health?.hp,
      100 - expectedDamage
    );
    const attackerState = logic.world.table.get(attacker)?.trigger_state;
    assert.ok(readHarthmereNativeSkillTotalXp(attackerState, "combat") > 0);
    assert.ok(
      readHarthmereNativeSkillTotalXp(attackerState, "melee_combat") > 0
    );
  });
});
