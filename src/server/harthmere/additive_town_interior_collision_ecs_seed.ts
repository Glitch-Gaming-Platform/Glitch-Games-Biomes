import type { Change, ProposedChange } from "@/shared/ecs/change";
import {
  Collideable,
  Orientation,
  Position,
  Size,
} from "@/shared/ecs/gen/components";
import type { Entity } from "@/shared/ecs/gen/entities";
import {
  HARTHMERE_ADDITIVE_TOWN_INTERIOR_COLLISION_SEEDS,
  harthmereAdditiveTownInteriorCollisionSeedEntityIds,
  type HarthmereAdditiveTownInteriorCollisionSeed,
} from "@/shared/harthmere/additive_town_interior_collision_seed";
import type { BiomesId } from "@/shared/ids";

function entityForSeed(
  seed: HarthmereAdditiveTownInteriorCollisionSeed
): Entity {
  return {
    id: seed.entityId,
    position: Position.create({ v: seed.position }),
    orientation: Orientation.create({ v: seed.orientation }),
    size: Size.create({ v: seed.size }),
    collideable: Collideable.create(),
  };
}

export function buildHarthmereAdditiveTownInteriorCollisionSeedChanges(input: {
  tick: number;
  existingIds?: ReadonlySet<BiomesId>;
}): Change[] {
  const existingIds = input.existingIds ?? new Set<BiomesId>();
  return HARTHMERE_ADDITIVE_TOWN_INTERIOR_COLLISION_SEEDS.map((seed) => ({
    kind: existingIds.has(seed.entityId) ? "update" : "create",
    tick: input.tick,
    entity: entityForSeed(seed),
  }));
}

export function buildHarthmereAdditiveTownInteriorCollisionSeedProposedChanges(input: {
  existingIds?: ReadonlySet<BiomesId>;
}): ProposedChange[] {
  return buildHarthmereAdditiveTownInteriorCollisionSeedChanges({
    tick: 1,
    existingIds: input.existingIds,
  }).map((change): ProposedChange => {
    if (change.kind === "delete") return { kind: "delete", id: change.id };
    if (change.kind === "create")
      return { kind: "create", entity: change.entity };
    return { kind: "update", entity: change.entity };
  });
}

export { harthmereAdditiveTownInteriorCollisionSeedEntityIds };
