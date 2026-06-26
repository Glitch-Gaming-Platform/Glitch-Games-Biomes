import { npcEntity } from "@/server/spawn/spawn_npc";
import { BikkieIds } from "@/shared/bikkie/ids";
import type { Change, ProposedChange } from "@/shared/ecs/change";
import {
  EntityDescription,
  Health,
  RobotComponent,
  Size,
  Voice,
} from "@/shared/ecs/gen/components";
import type { BiomesId } from "@/shared/ids";
import { LOCAL_DEV_HUMAN_NPC_TYPE_ID, isNpcTypeId } from "@/shared/npc/bikkie";
import {
  HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS,
  harthmereActiveLiveEntityProductionSeedIds,
  harthmereCombatHpForLiveEntitySeed,
  harthmereGroundedLivestockSeedsInTerritory,
  harthmereGroundedMuckMonsterSeedsInTerritory,
  harthmereLiveEntitySizeForSeed,
  type HarthmereLiveEntityProductionSeed,
} from "@/shared/harthmere/live_entity_production_seed";
import { harthmereVoiceProfileForActor } from "@/shared/harthmere/npc_voice_profiles";
import { resolveHarthmereProductionMarkerPosition } from "@/shared/harthmere/production_terrain_placement_map";

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

function productionPlacedLiveEntitySeedPosition(
  seed: HarthmereLiveEntityProductionSeed,
  source: "live_muck_monster" | "live_livestock"
) {
  return resolveHarthmereProductionMarkerPosition({
    source,
    markerId: seed.seedId,
    fallback: seed.position,
  });
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
  const monsterTypeId = isNpcTypeId(BikkieIds.dMucker)
    ? BikkieIds.dMucker
    : LOCAL_DEV_HUMAN_NPC_TYPE_ID;
  const robotTypeId = isNpcTypeId(BikkieIds.biomesRobot)
    ? BikkieIds.biomesRobot
    : LOCAL_DEV_HUMAN_NPC_TYPE_ID;

  for (const seed of HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS) {
    const entity = {
      ...npcEntity(
        {
          id: seed.entityId,
          typeId: robotTypeId,
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
    const base = npcEntity(
      {
        id: seed.entityId,
        typeId: monsterTypeId,
        position: productionPlacedLiveEntitySeedPosition(
          seed,
          "live_muck_monster"
        ),
        orientation: seed.orientation,
        velocity: [0, 0, 0],
        displayName: seed.displayName,
      },
      input.nowSeconds
    );
    // HARTHMERE_COMBAT_CREATURE_NOT_TALKABLE: muckers/hexes are hostiles, not
    // conversational NPCs. default_dialog (from the seed dialog or the npc type)
    // is what raises the "F: Talk" prompt, so strip it — you attack them, you
    // don't talk to them.
    delete (base as { default_dialog?: unknown }).default_dialog;
    const combatHp = harthmereCombatHpForLiveEntitySeed(seed);
    const entity = {
      ...base,
      health: Health.create({ hp: combatHp, maxHp: combatHp }),
      size: Size.create({ v: harthmereLiveEntitySizeForSeed(seed) }),
      entity_description: EntityDescription.create({
        text: seed.description,
      }),
    };
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

  // Wildlife (cows, sheep, rabbits) reuse the same damageable NPC type as
  // muckers so they are huntable; their passive (ignore-until-attacked)
  // behaviour is enforced by the live-mode combat reducer, and the client
  // renders the matching animal mesh from the species in the label.
  for (const seed of harthmereGroundedLivestockSeedsInTerritory()) {
    const base = npcEntity(
      {
        id: seed.entityId,
        typeId: monsterTypeId,
        position: productionPlacedLiveEntitySeedPosition(
          seed,
          "live_livestock"
        ),
        orientation: seed.orientation,
        velocity: [0, 0, 0],
        displayName: seed.displayName,
      },
      input.nowSeconds
    );
    // Wildlife are huntable, not conversational — no "F: Talk" prompt.
    delete (base as { default_dialog?: unknown }).default_dialog;
    const combatHp = harthmereCombatHpForLiveEntitySeed(seed);
    const entity = {
      ...base,
      health: Health.create({ hp: combatHp, maxHp: combatHp }),
      size: Size.create({ v: harthmereLiveEntitySizeForSeed(seed) }),
      entity_description: EntityDescription.create({
        text: seed.description,
      }),
    };
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

  return changes;
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
