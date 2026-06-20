import type { ClientContextSubset } from "@/client/game/context";
import type { ClientTable } from "@/client/game/game";
import type { Player } from "@/client/game/resources/players";
import type { ClientRuleSet } from "@/server/shared/minigames/ruleset/client_types";
import type { TweakableConfig } from "@/server/shared/minigames/ruleset/tweaks";
import type { ReadonlyEntity } from "@/shared/ecs/gen/entities";
import {
  CollideableSelector,
  NpcMetadataSelector,
} from "@/shared/ecs/gen/selectors";
import { isEntryDomainAabb } from "@/shared/ecs/spatial/types";
import { getAabbForEntity } from "@/shared/game/entity_sizes";
import type { EntityHit } from "@/shared/game/spatial";
import { isPlayer } from "@/shared/game/players";
import type { BiomesId } from "@/shared/ids";
import { isHarthmereNonLivingObjectLabel } from "@/shared/harthmere/object_interaction_semantics";
import {
  add,
  frustumBoundingSphere,
  frustumToConvexPolytope,
  intersectRayAabb,
  intersectConvexPolytopeAABB,
  makeOrthoProjection,
  makeTranslation,
  makeXRotate,
  makeYRotate,
  mulm4,
  pointInConvexPolytope,
  scale,
} from "@/shared/math/linear";
import type {
  ConvexPolytope,
  Mat4,
  ReadonlyVec3,
  Sphere,
} from "@/shared/math/types";
import { getNpcBehavior, maybeIdToNpcType } from "@/shared/npc/bikkie";
import * as THREE from "three";

function entityLabelText(x: ReadonlyEntity): string {
  const record = x as unknown as Record<string, unknown>;
  const label = (record.label ?? {}) as Record<string, unknown>;
  return [
    label.text,
    label.label,
    record.name,
    record.entity_kind,
    record.species,
    record.kind,
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
}

function isAttackableLiveEntityWithoutNpcMetadata(x: ReadonlyEntity): boolean {
  const record = x as unknown as Record<string, unknown>;
  const label = entityLabelText(x);
  if (
    x.player_status ||
    record.placeable_component ||
    record.blueprint_component ||
    record.protection ||
    isHarthmereNonLivingObjectLabel({ label })
  ) {
    return false;
  }
  if (typeof record.isAttackable === "boolean") {
    return record.isAttackable;
  }
  if (typeof record.attackable === "boolean") {
    return record.attackable;
  }
  return Boolean(
    x.health &&
      (record.robot_component ||
        /muck|mucker|muckling|mux|hex|hexer|animal|livestock|wolf|bear|boar|deer|snake|rat|fox|horse|cow|goat|sheep|pig|chicken|undead|zombie|corpse|monster|creature|boss/.test(
          label
        ))
  );
}

export function canAttackFilter(
  ruleset: ClientRuleSet,
  aclAllowsPlayers: boolean,
  source: ReadonlyEntity | undefined,
  x: ReadonlyEntity
): boolean {
  if (!x.health || x.health.hp <= 0) {
    return false;
  }

  if (
    source &&
    isPlayer(x) &&
    ruleset.canAttackPlayer(aclAllowsPlayers, source, x)
  ) {
    return true;
  }

  const npcTypeId = x.npc_metadata?.type_id;
  const harthmereLiveAttackable = isAttackableLiveEntityWithoutNpcMetadata(x);
  if (npcTypeId === undefined) {
    return harthmereLiveAttackable;
  }

  // SNAPSHOT_NPC_ATTACK_FILTER_COMPAT:
  // Snapshot imports can contain legacy NPC metadata whose type item is present
  // but does not satisfy the newer Glitch NPC schema. Cursor hit-testing runs
  // every frame, so invalid/legacy NPC types must fail soft instead of throwing.
  const npcType = maybeIdToNpcType(npcTypeId);
  if (!npcType) {
    return harthmereLiveAttackable;
  }
  // HARTHMERE_LIVE_NPC_ATTACKABLE_OVERRIDE:
  // The Harthmere live creatures are seeded as real NPCs but reuse legacy NPC
  // types like dMucker/biomesRobot whose Bikkie behavior has
  // damageable.attackable=false. If we return that false directly, the cursor
  // omits a perfectly real, collideable, health-backed mucker/hex/animal before
  // AttackDestroyDelegate can publish UpdateNpcHealthEvent. Let explicit
  // Harthmere live-target semantics win for those labels/components while
  // keeping ordinary non-combat NPCs filtered out.
  return getNpcBehavior(npcType).damageable?.attackable === true
    ? true
    : harthmereLiveAttackable;
}

// HARTHMERE_VOXEL_REACH_ATTACK:
// Pure decision for whether the entity currently under the crosshair should be
// added to the melee attack set. The narrow melee cone
// (combat.meleeAttackRegion.far) only catches point-blank targets, but a left
// click is also the "break/change voxel" action which reaches
// building.changeRadius (~8.78). Aligning the aimed-target attack reach with the
// voxel reach is what makes "the same swing that breaks the block also hits the
// creature it's aimed at" true. Extracted as a pure function so the reach/dedup/
// self-hit branches can be unit-tested without a DOM, table, or renderer.
export function shouldAddCrosshairMeleeTarget(input: {
  hasEntityHit: boolean;
  distance: number;
  reach: number;
  targetId: BiomesId;
  playerId: BiomesId;
  alreadyIncludedIds: ReadonlyArray<BiomesId>;
  canAttack: boolean;
}): boolean {
  if (!input.hasEntityHit || !input.canAttack) {
    return false;
  }
  if (!Number.isFinite(input.distance) || input.distance > input.reach) {
    return false;
  }
  if (input.targetId === input.playerId) {
    return false;
  }
  return !input.alreadyIncludedIds.includes(input.targetId);
}

export function traceNpcMetadataCursorHits(
  table: ClientTable,
  from: ReadonlyVec3,
  dir: ReadonlyVec3,
  params: {
    maxDistance: number;
    entityFilter?: (entity: ReadonlyEntity) => boolean;
    excludeIds?: ReadonlySet<BiomesId>;
  }
): EntityHit[] {
  const entityHits: EntityHit[] = [];
  const halfDistance = params.maxDistance * 0.5;
  const rayMidpoint = add(from, scale(halfDistance, dir));

  for (const entity of table.scan(
    NpcMetadataSelector.query.spatial.inSphere({
      center: rayMidpoint,
      radius: halfDistance,
    })
  )) {
    if (params.excludeIds?.has(entity.id)) {
      continue;
    }
    if (params.entityFilter && !params.entityFilter(entity)) {
      continue;
    }
    const aabb = getAabbForEntity(entity);
    if (!aabb) {
      continue;
    }
    const maybeHit = intersectRayAabb(from, dir, aabb);
    if (maybeHit && maybeHit.distance <= params.maxDistance) {
      entityHits.push({
        kind: "entity",
        entity,
        distance: maybeHit.distance,
        pos: maybeHit.pos,
      });
    }
  }

  entityHits.sort((a, b) => b.distance - a.distance);
  return entityHits;
}

export function attackableEntitiesInAttackRegion(
  deps: ClientContextSubset<"table" | "resources" | "permissionsManager">,
  owningPlayerId: BiomesId
): ReadonlyEntity[] {
  const attackRegion = deps.resources.get(
    "/player/melee_attack_region",
    owningPlayerId
  );
  const aclAllowsPlayers = deps.permissionsManager.clientActionAllowedAt(
    "pvp",
    attackRegion.boundingSphere.center
  );

  const ruleSet = deps.resources.get("/ruleset/current");
  const me = deps.resources.get("/ecs/entity", owningPlayerId);

  return entitiesInAttackRegion(
    deps.table,
    attackRegion,
    (x) => x.id !== owningPlayerId
  ).filter((e) => canAttackFilter(ruleSet, aclAllowsPlayers, me, e));
}

// The 🤘cone of attack🤘.
export interface MeleeAttackRegion {
  frustum: Mat4;
  region: ConvexPolytope;
  boundingSphere: Sphere;
}

export function meleeAttackRegionTemplate(tweaks: TweakableConfig): Mat4 {
  const near = tweaks.combat.meleeAttackRegion.near;
  const far = Math.max(near + 0.01, tweaks.combat.meleeAttackRegion.far);
  const left = tweaks.combat.meleeAttackRegion.left;
  const right = Math.max(left + 0.01, tweaks.combat.meleeAttackRegion.right);
  const bottom = tweaks.combat.meleeAttackRegion.bottom;
  const top = Math.max(bottom + 0.01, tweaks.combat.meleeAttackRegion.top);

  return makeOrthoProjection(near, far, left, right, top, bottom);
}

// Essentially transforms the static MeleeAttackRegion over to in front of the
// player.
export function getPlayerMeleeAttackRegion(
  player: Player,
  template: Mat4
): MeleeAttackRegion {
  const playerWorld = mulm4(
    makeTranslation(player.position),
    mulm4(
      makeYRotate(player.orientation[1]),
      makeXRotate(player.orientation[0])
    )
  );
  // Almost avoided THREE.js...  Didn't want to write a Matrix inverse function
  // though.
  const playerView = new THREE.Matrix4()
    .fromArray(playerWorld)
    .invert()
    .toArray();
  const attackRegion = mulm4(template, playerView);

  return {
    frustum: attackRegion,
    region: frustumToConvexPolytope(attackRegion),
    boundingSphere: frustumBoundingSphere(attackRegion),
  };
}

export function entitiesInAttackRegion(
  table: ClientTable,
  attackRegion: MeleeAttackRegion,
  filter: (x: ReadonlyEntity) => boolean
): ReadonlyEntity[] {
  const { region, boundingSphere } = attackRegion;

  const entities: ReadonlyEntity[] = [];
  for (const entity of table.scan(
    CollideableSelector.query.spatial.inSphere(boundingSphere, {
      refine: (domain) => {
        if (isEntryDomainAabb(domain)) {
          return intersectConvexPolytopeAABB(region, domain);
        } else {
          return pointInConvexPolytope(region, domain);
        }
      },
    })
  )) {
    if (!filter(entity)) {
      continue;
    }
    entities.push(entity);
  }

  return entities;
}
