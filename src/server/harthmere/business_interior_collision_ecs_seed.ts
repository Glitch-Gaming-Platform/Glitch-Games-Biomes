import type { Change, ProposedChange } from "@/shared/ecs/change";
import {
  Collideable,
  Orientation,
  Position,
  Size,
} from "@/shared/ecs/gen/components";
import type { Entity } from "@/shared/ecs/gen/entities";
import {
  HARTHMERE_BUSINESS_INTERIOR_COLLISION_SEEDS,
  harthmereBusinessInteriorCollisionSeedIds,
  type HarthmereBusinessInteriorCollisionSeed,
} from "@/shared/harthmere/business_interior_collision_seed";
import type { BiomesId } from "@/shared/ids";

// These entities intentionally have no placeable, NPC, label, or render
// component. The normal native collideable selector indexes Position + Size +
// Collideable, so players and Anima NPCs receive authoritative fixture physics
// without rendering white boxes or duplicating the combined interior GLB.
function collisionEntityForSeed(
  seed: HarthmereBusinessInteriorCollisionSeed
): Entity {
  return {
    id: seed.entityId,
    position: Position.create({ v: seed.position }),
    orientation: Orientation.create({ v: seed.orientation }),
    size: Size.create({ v: seed.size }),
    collideable: Collideable.create(),
  };
}

export function harthmereBusinessInteriorCollisionSeedEntityIds() {
  return harthmereBusinessInteriorCollisionSeedIds();
}

export function buildHarthmereBusinessInteriorCollisionSeedChanges(input: {
  tick: number;
  existingIds?: ReadonlySet<BiomesId>;
}): Change[] {
  const existingIds = input.existingIds ?? new Set<BiomesId>();
  return HARTHMERE_BUSINESS_INTERIOR_COLLISION_SEEDS.map((seed) => ({
    kind: existingIds.has(seed.entityId) ? "update" : "create",
    tick: input.tick,
    entity: collisionEntityForSeed(seed),
  }));
}

export function buildHarthmereBusinessInteriorCollisionSeedProposedChanges(input: {
  existingIds?: ReadonlySet<BiomesId>;
}): ProposedChange[] {
  return buildHarthmereBusinessInteriorCollisionSeedChanges({
    tick: 1,
    existingIds: input.existingIds,
  }).map((change): ProposedChange => {
    if (change.kind === "delete") {
      return { kind: "delete", id: change.id };
    }
    if (change.kind === "create") {
      return { kind: "create", entity: change.entity };
    }
    return { kind: "update", entity: change.entity };
  });
}
