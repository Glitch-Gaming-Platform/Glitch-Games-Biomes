import { GameEvent } from "@/server/shared/api/game_event";
import { loadVoxeloo } from "@/server/shared/voxeloo";
import {
  addGameUser,
  editEntity,
  getEntitiesWithComponent,
  TestLogicApi,
} from "@/server/test/test_helpers";
import { BikkieRuntime } from "@/shared/bikkie/active";
import {
  Health,
  NpcMetadata,
  NpcState,
  Position,
  RigidBody,
  SelectedItem,
  Size,
  Wearing,
} from "@/shared/ecs/gen/components";
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
  harthmereNativeNpcBiscuit,
  mitigateHarthmereNativeIncomingDamage,
  nativeCombatArmorStats,
  harthmereNativeNpcCombatProfileForSeed,
  readHarthmereNativeCombatProgression,
  writeHarthmereNativeCombatProgression,
} from "@/shared/harthmere/harthmere_native_combat";
import { harthmereNativeLevelStats } from "@/shared/harthmere/harthmere_native_level_stats";
import { addToBag, bagContains, countOf, createBag } from "@/shared/game/items";
import { anItem } from "@/shared/game/item";
import { findItemEquippableSlot } from "@/shared/game/wearables";
import { buildCreatureProgression } from "@/shared/npc/creature_level";
import { serializeNpcCustomState } from "@/shared/npc/serde";
import { readHarthmereJobsBoardNativeKillLedger } from "@/shared/harthmere/jobs_board_native_kill_ledger";
import { readHarthmereNativeSkillTotalXp } from "@/shared/harthmere/harthmere_skill_progression";

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
      "leather_armor",
      "wooden_shield",
    ]) {
      const definition = definitions.find((entry) => entry.itemId === itemId)!;
      const biscuit = harthmereBiscuitForItemDefinition(definition);
      fixtures.set(biscuit.id, biscuit);
    }
    for (const seed of [
      harthmereGroundedMuckMonsterSeedsInTerritory()[0],
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

    assert.equal(logic.world.table.get(target.id)?.health?.hp, 83);
    const attackerState = logic.world.table.get(attacker)?.trigger_state;
    assert.ok(readHarthmereNativeSkillTotalXp(attackerState, "combat") > 0);
    assert.ok(
      readHarthmereNativeSkillTotalXp(attackerState, "melee_combat") > 0
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

    // The same level-2 sword deals 17 in the baseline case above. Level 20's
    // 10% resistance rounds that authoritative damage to 15.
    assert.equal(logic.world.table.get(target.id)?.health?.hp, 85);
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

  it("ignores forged NPC damage and applies native level plus worn armor", async () => {
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
    const expectedDamage = mitigateHarthmereNativeIncomingDamage({
      rawDamage: attacker.profile.attackDamage,
      armor: armor.armor + defenderStats.armor,
      defense: armor.defense + defenderStats.defense,
      evasion: armor.evasion + defenderStats.evasion,
      accuracy: attackerStats.accuracy,
      attackerLevel: attacker.profile.level,
      defenderLevel: 3,
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
            dir: [-1, 0, 0],
          },
        })
      )
    );

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

    const attack = () =>
      logic.publish(
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
          })
        )
      );

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

  it("applies per-entity creature level to authoritative outgoing NPC damage", async () => {
    const player = (
      await addGameUser(logic.world, generateTestId(), {
        position: [1, 0, 0],
      })
    ).id;
    const seed = harthmereGroundedMuckMonsterSeedsInTerritory()[0];
    const levelOne = spawnNativeNpc(seed, [0, 0, 0], undefined, 1);
    const levelFive = spawnNativeNpc(seed, [0, 0, 0], undefined, 5);

    const attackFrom = (attacker: BiomesId) =>
      logic.publish(
        new GameEvent(
          player,
          new UpdatePlayerHealthEvent({
            id: player,
            hpDelta: -999,
            damageSource: { kind: "attack", attacker, dir: [1, 0, 0] },
          })
        )
      );

    await attackFrom(levelOne.id);
    const levelOneDamage =
      100 - (logic.world.table.get(player)?.health?.hp ?? 100);
    editEntity(logic.world, player, (entity) => {
      entity.setHealth(Health.create({ hp: 100, maxHp: 100 }));
    });
    await attackFrom(levelFive.id);
    const levelFiveDamage =
      100 - (logic.world.table.get(player)?.health?.hp ?? 100);

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
    assert.equal(logic.world.table.get(defender)?.health?.hp, 82);
    const attackerState = logic.world.table.get(attacker)?.trigger_state;
    assert.ok(readHarthmereNativeSkillTotalXp(attackerState, "combat") > 0);
    assert.ok(
      readHarthmereNativeSkillTotalXp(attackerState, "melee_combat") > 0
    );
  });
});
