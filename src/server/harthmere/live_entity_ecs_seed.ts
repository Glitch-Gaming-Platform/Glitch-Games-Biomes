import { npcEntity } from "@/server/spawn/spawn_npc";
import type { Change, ProposedChange } from "@/shared/ecs/change";
import {
  EntityDescription,
  Health,
  LockedInPlace,
  NpcMetadata,
  NpcState,
  QuestGiver,
  RobotComponent,
  Size,
  Voice,
} from "@/shared/ecs/gen/components";
import type { BiomesId } from "@/shared/ids";
import {
  HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS,
  HARTHMERE_NATIVE_MUCK_SCARRED_HELIX_SEED,
  HARTHMERE_NATIVE_THAEDRYN_SEED,
  harthmereActiveLiveEntityProductionSeedIds,
  harthmereGroundedCavernMonsterSeeds,
  harthmereGroundedLivestockSeedsInTerritory,
  harthmereGroundedMuckMonsterSeedsInTerritory,
  harthmereLiveEntitySizeForSeed,
  type HarthmereLiveEntityProductionSeed,
} from "@/shared/harthmere/live_entity_production_seed";
import { HARTHMERE_NATIVE_BANDIT_SEEDS } from "@/shared/harthmere/bandit_production_seed";
import { harthmereNativeNpcCombatProfileForSeed } from "@/shared/harthmere/harthmere_native_combat";
import { harthmereVoiceProfileForActor } from "@/shared/harthmere/npc_voice_profiles";
import { harthmereCreatureGroupForSeed } from "@/shared/harthmere/creature_groups";
import {
  assignCreatureLevel,
  buildCreatureProgression,
  scaleCreatureCombatStats,
} from "@/shared/npc/creature_level";
import { serializeNpcCustomState } from "@/shared/npc/serde";

function changeKindForSeed(
  seed: HarthmereLiveEntityProductionSeed,
  existingIds: ReadonlySet<BiomesId>
) {
  return existingIds.has(seed.entityId) ? "update" : "create";
}

function proposedFromChange(change: Change): ProposedChange {
  if (change.kind === "delete") {
    return { kind: "delete", id: change.id };
  }
  if (change.kind === "create") {
    return { kind: "create", entity: change.entity };
  }
  return { kind: "update", entity: change.entity };
}

function exactSpawnMetadata(
  entity: ReturnType<typeof npcEntity>,
  seed: HarthmereLiveEntityProductionSeed
) {
  const metadata = entity.npc_metadata;
  return NpcMetadata.create({
    type_id: metadata?.type_id,
    // Creature respawns must use the same terrain-grounded anchor as the live
    // entity. npcEntity's normal +-4m spawn jitter can land a cow or Mucker on
    // a cliff edge or an old terrain seam after a death/respawn cycle.
    spawn_position: [...seed.position],
    spawn_orientation: metadata?.spawn_orientation
      ? [...metadata.spawn_orientation]
      : undefined,
    created_time: metadata?.created_time,
    spawn_event_id: metadata?.spawn_event_id,
    spawn_event_type_id: metadata?.spawn_event_type_id,
  });
}

/**
 * HARTHMERE_CREATURE_LEVELING: the entity's authoritative level.
 *
 * A seed without `progressionLevel` migrates to level 1, whose multipliers are
 * all exactly 1.0 — so an existing world's creatures keep the stats they already
 * had. Only content that explicitly opts in (today: the four Road to Harthmere
 * groups) ships above level 1.
 */
export function harthmereCreatureProgressionForSeed(
  seed: HarthmereLiveEntityProductionSeed
) {
  if (seed.progressionLevel === undefined) {
    return buildCreatureProgression({ migrate: true });
  }
  return buildCreatureProgression({
    assignment: assignCreatureLevel({ authoredLevel: seed.progressionLevel }),
  });
}

/**
 * The serialized Anima state a freshly seeded creature starts with: its level and
 * its authored group membership. Anima reads both straight off the entity, so
 * there is no registry lookup in the combat hot path and no boot-order coupling.
 */
export function harthmereLiveCreatureNpcState(
  seed: HarthmereLiveEntityProductionSeed
) {
  return NpcState.create({
    data: serializeNpcCustomState({
      creatureProgression: harthmereCreatureProgressionForSeed(seed),
      creatureGroup: harthmereCreatureGroupForSeed(seed),
    }),
  });
}

export function harthmereLiveCreatureDisplayName(
  seed: HarthmereLiveEntityProductionSeed
) {
  if (!seed.bountyTier) return seed.displayName;
  return `${seed.bountyTier === "boss" ? "Boss" : "Elite"} ${seed.displayName}`;
}

export function buildHarthmereLiveCreatureEntity(
  seed: HarthmereLiveEntityProductionSeed,
  nowSeconds: number
) {
  const combatProfile = harthmereNativeNpcCombatProfileForSeed(seed);
  const progression = harthmereCreatureProgressionForSeed(seed);
  // Max HP is the one scalable stat that is entity-owned, so it is baked in here
  // rather than derived per tick. Damage, cadence, and speed stay type-owned and
  // are scaled at runtime by Anima (see `applyCreatureLevelToChaseAttackParams`).
  const maxHp = scaleCreatureCombatStats(
    {
      maxHp: combatProfile.maxHp,
      attackDamage: combatProfile.attackDamage,
      attackIntervalSecs: combatProfile.attackIntervalSecs,
      walkSpeed: combatProfile.walkSpeed,
      runSpeed: combatProfile.runSpeed,
      killXp: combatProfile.killXp,
    },
    progression.level
  ).maxHp;
  const base = npcEntity(
    {
      id: seed.entityId,
      typeId: combatProfile.id,
      position: seed.position,
      orientation: seed.orientation,
      velocity: [0, 0, 0],
      displayName: harthmereLiveCreatureDisplayName(seed),
    },
    nowSeconds
  );
  // Muckers, Hexes, and wildlife are combat creatures, not talkable NPCs.
  delete (base as { default_dialog?: unknown }).default_dialog;
  return {
    ...base,
    npc_metadata: exactSpawnMetadata(base, seed),
    npc_state: harthmereLiveCreatureNpcState(seed),
    health: Health.create({ hp: maxHp, maxHp }),
    size: Size.create({ v: harthmereLiveEntitySizeForSeed(seed) }),
    entity_description: EntityDescription.create({
      text: seed.description,
    }),
  };
}

export function harthmereLiveEntityProductionSeedIds() {
  // Only the entities that should actually exist (robots + in-territory muckers),
  // so safe-zone-excluded muckers are never treated as required seeds.
  return harthmereActiveLiveEntityProductionSeedIds();
}

export function buildHarthmereLiveEntityProductionSeedChanges(input: {
  tick: number;
  nowSeconds: number;
  existingIds?: ReadonlySet<BiomesId>;
  // HARTHMERE_LIVE_CREATURE_RESPAWN: when a creature was recently killed this
  // returns true for its id, so the reconciler leaves it dead until the 30-60
  // minute respawn window elapses instead of re-creating it next tick. Robots
  // (structural) are never suppressed.
  isRespawnSuppressed?: (id: BiomesId) => boolean;
}) {
  const existingIds = input.existingIds ?? new Set<BiomesId>();
  const isRespawnSuppressed = input.isRespawnSuppressed ?? (() => false);
  const changes: Change[] = [];

  for (const seed of HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS) {
    const combatProfile = harthmereNativeNpcCombatProfileForSeed(seed);
    const entity = {
      ...npcEntity(
        {
          id: seed.entityId,
          typeId: combatProfile.id,
          position: seed.position,
          orientation: seed.orientation,
          velocity: [0, 0, 0],
          displayName: seed.displayName,
          defaultDialog: seed.dialog,
        },
        input.nowSeconds
      ),
      robot_component: RobotComponent.create({
        internal_battery_charge: seed.energy,
        internal_battery_capacity: seed.maxEnergy,
        last_update: input.nowSeconds,
      }),
      entity_description: EntityDescription.create({
        text: seed.description,
      }),
      voice: Voice.create({
        voice: harthmereVoiceProfileForActor({
          source: "live_entity_seed",
          id: seed.seedId,
          entityId: seed.entityId,
          displayName: seed.displayName,
          role: seed.kind,
          kind: seed.kind,
          background: seed.description,
        }).voiceParameterId,
      }),
    };
    changes.push({
      kind: changeKindForSeed(seed, existingIds),
      tick: input.tick,
      entity,
    });
  }

  for (const seed of harthmereGroundedMuckMonsterSeedsInTerritory()) {
    const entity = buildHarthmereLiveCreatureEntity(seed, input.nowSeconds);
    const muckerKind = changeKindForSeed(seed, existingIds);
    // Respawn gate: a recently-killed mucker/hex stays dead until its timer is up.
    if (muckerKind === "create" && isRespawnSuppressed(seed.entityId)) {
      continue;
    }
    changes.push({
      kind: muckerKind,
      tick: input.tick,
      entity,
    });
  }

  // Massive-cavern Indisworms retain their underground authored feet positions.
  // They deliberately bypass the outdoor Muck/open-sky placement map.
  for (const seed of harthmereGroundedCavernMonsterSeeds()) {
    const entity = buildHarthmereLiveCreatureEntity(seed, input.nowSeconds);
    const cavernKind = changeKindForSeed(seed, existingIds);
    if (cavernKind === "create" && isRespawnSuppressed(seed.entityId)) {
      continue;
    }
    changes.push({
      kind: cavernKind,
      tick: input.tick,
      entity,
    });
  }

  // Wildlife use exact passive/retaliating native types. Sharing the hostile
  // dMucker type made animals aggro first and assigned monster drops/triggers.
  for (const seed of harthmereGroundedLivestockSeedsInTerritory()) {
    const entity = buildHarthmereLiveCreatureEntity(seed, input.nowSeconds);
    const livestockKind = changeKindForSeed(seed, existingIds);
    // Respawn gate: a recently-hunted animal stays gone until its timer is up.
    if (livestockKind === "create" && isRespawnSuppressed(seed.entityId)) {
      continue;
    }
    changes.push({
      kind: livestockKind,
      tick: input.tick,
      entity,
    });
  }

  // Authored bandits are ordinary native NPC entities. Anima owns their
  // patrol/meander, aggro, chase, attacks, death, and respawn just like the
  // Muck creatures above. The captured prisoner stays an ECS NPC but carries
  // LockedInPlace so the guard-yard event cannot wander out of its cage.
  for (const seed of HARTHMERE_NATIVE_BANDIT_SEEDS) {
    const base = buildHarthmereLiveCreatureEntity(seed, input.nowSeconds);
    const entity = seed.lockedInPlace
      ? { ...base, locked_in_place: LockedInPlace.create() }
      : base;
    const banditKind = changeKindForSeed(seed, existingIds);
    if (banditKind === "create" && isRespawnSuppressed(seed.entityId)) {
      continue;
    }
    changes.push({
      kind: banditKind,
      tick: input.tick,
      entity,
    });
  }

  return changes;
}

/** Build the quest-gated boss as the same native ECS entity used in combat. */
export function buildHarthmereNativeMuckScarredHelixEntity(nowSeconds: number) {
  const seed = HARTHMERE_NATIVE_MUCK_SCARRED_HELIX_SEED;
  const combatProfile = harthmereNativeNpcCombatProfileForSeed(seed);
  const entity = {
    ...npcEntity(
      {
        id: seed.entityId,
        typeId: combatProfile.id,
        position: seed.position,
        orientation: seed.orientation,
        velocity: [0, 0, 0],
        displayName: seed.displayName,
      },
      nowSeconds
    ),
    health: Health.create({
      hp: combatProfile.maxHp,
      maxHp: combatProfile.maxHp,
    }),
    size: Size.create({ v: harthmereLiveEntitySizeForSeed(seed) }),
    entity_description: EntityDescription.create({ text: seed.description }),
  };
  delete (entity as { default_dialog?: unknown }).default_dialog;
  return entity;
}

/** Build Q12's native boss/giver at the exact visible encounter entity id. */
export function buildHarthmereNativeThaedrynEntity(nowSeconds: number) {
  const seed = HARTHMERE_NATIVE_THAEDRYN_SEED;
  const combatProfile = harthmereNativeNpcCombatProfileForSeed(seed);
  const entity = {
    ...npcEntity(
      {
        id: seed.entityId,
        typeId: combatProfile.id,
        position: seed.position,
        orientation: seed.orientation,
        velocity: [0, 0, 0],
        displayName: seed.displayName,
      },
      nowSeconds
    ),
    health: Health.create({
      hp: combatProfile.maxHp,
      maxHp: combatProfile.maxHp,
    }),
    // Keep the native collision/render dimensions on the same lore-sized
    // contract as the bespoke boss mesh. Thaedryn is roughly two hundred feet
    // long; the former 7x5x10 placeholder silently shrank the rebuilt dragon.
    size: Size.create({ v: harthmereLiveEntitySizeForSeed(seed) }),
    entity_description: EntityDescription.create({ text: seed.description }),
    quest_giver: QuestGiver.create({ concurrent_quests: 1 }),
  };
  delete (entity as { default_dialog?: unknown }).default_dialog;
  return entity;
}

export function buildHarthmereLiveEntityProductionSeedProposedChanges(input: {
  nowSeconds: number;
  existingIds?: ReadonlySet<BiomesId>;
}) {
  return buildHarthmereLiveEntityProductionSeedChanges({
    tick: 1,
    nowSeconds: input.nowSeconds,
    existingIds: input.existingIds,
  }).map(proposedFromChange);
}
