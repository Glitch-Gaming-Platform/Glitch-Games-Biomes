import type { ReadonlyWorldMetadata } from "@/shared/ecs/gen/components";
import type { ReadonlyEntity } from "@/shared/ecs/gen/entities";
import { getAabbForEntity } from "@/shared/game/entity_sizes";
import { anItem } from "@/shared/game/item";
import * as Shards from "@/shared/game/shard";
import type { SpatialTable } from "@/shared/game/spatial";
import { add, shiftAABB, sizeAABB, sub } from "@/shared/math/linear";
import type { AABB, ReadonlyVec3, Vec3 } from "@/shared/math/types";
import { ok } from "assert";

export interface Boxes {
  intersect(aabb: AABB, fn: (hit: AABB) => boolean | void): void;
}

export type BoxesIndex = (shardId: Shards.ShardId) => Boxes | undefined;

export type CollisionCallback = (
  hit: AABB,
  entity?: ReadonlyEntity
) => boolean | void;

export class CollisionHelper {
  private constructor() {}

  static intersectAABB(index: BoxesIndex, aabb: AABB, fn: CollisionCallback) {
    const shards = Shards.shardsForAABB(...aabb);
    for (const shard of shards) {
      const boxes = index(shard);
      if (boxes) {
        boxes.intersect(aabb, (aabb) => fn(aabb));
      }
    }
  }

  static intersectAnyAABB(index: BoxesIndex, aabb: AABB) {
    let ret = false;
    this.intersectAABB(index, aabb, () => {
      ret = true;
      return true;
    });
    return ret;
  }

  static pointInAABB(index: BoxesIndex, point: ReadonlyVec3) {
    const epsilon: Vec3 = [1e-2, 1e-2, 1e-2];
    return this.intersectAnyAABB(index, [
      sub(point, epsilon),
      add(point, epsilon),
    ]);
  }

  static intersectEntities(
    table: SpatialTable,
    aabb: AABB,
    fn: CollisionCallback
  ) {
    for (const id of table.metaIndex.collideable_selector.scanAabb(aabb)) {
      const entity = table.get(id)!;
      if (isCollidable(entity)) {
        const aabb = getAabbForEntity(entity, { extentsType: "collidable" });
        ok(aabb);
        fn(aabb, entity);
      }
    }
  }

  static intersectWorldBounds(
    worldMetadata: ReadonlyWorldMetadata,
    aabb: AABB,
    fn: CollisionCallback
  ) {
    // HARTHMERE_POLISH_V1_WORLD_BOUNDS_FIX
    // Previous implementation created phantom collision boxes by shifting the
    // entire world AABB by its own size. That worked while the player was
    // _exactly_ adjacent to one wall, but at corners or after a long step
    // outside the world the phantom box no longer contained the player and
    // the collision solver flapped between two near-misses, producing the
    // "I cannot stop walking at the edge of the map" feedback loop.
    //
    // Solid half-space walls fix this: each breached axis emits a giant
    // box that fills the entire outside region for that axis, regardless
    // of how far past the edge the entity is.
    const v0 = worldMetadata.aabb.v0;
    const v1 = worldMetadata.aabb.v1;
    const FAR = 1_000_000; // engineering "infinity" — larger than any world
    const wallNegX: AABB = [[-FAR, -FAR, -FAR], [v0[0], FAR, FAR]];
    const wallPosX: AABB = [[v1[0], -FAR, -FAR], [FAR, FAR, FAR]];
    const wallNegY: AABB = [[-FAR, -FAR, -FAR], [FAR, v0[1], FAR]];
    const wallPosY: AABB = [[-FAR, v1[1], -FAR], [FAR, FAR, FAR]];
    const wallNegZ: AABB = [[-FAR, -FAR, -FAR], [FAR, FAR, v0[2]]];
    const wallPosZ: AABB = [[-FAR, -FAR, v1[2]], [FAR, FAR, FAR]];
    if (aabb[0][0] < v0[0]) fn(wallNegX);
    if (aabb[1][0] > v1[0]) fn(wallPosX);
    if (aabb[0][1] < v0[1]) fn(wallNegY);
    if (aabb[1][1] > v1[1]) fn(wallPosY);
    if (aabb[0][2] < v0[2]) fn(wallNegZ);
    if (aabb[1][2] > v1[2]) fn(wallPosZ);
  }

  // Does a general AABB intersection test against the terrain and entities.
  static intersect(
    boxes: BoxesIndex,
    table: SpatialTable,
    worldMetadata: ReadonlyWorldMetadata,
    aabb: AABB,
    fn: CollisionCallback
  ) {
    // Test if the box intersects any of the terrain shards.
    CollisionHelper.intersectAABB(boxes, aabb, fn);
    // Test if the box intersects any entities.
    CollisionHelper.intersectEntities(table, aabb, fn);
    // Also test against the world boundaries.
    CollisionHelper.intersectWorldBounds(worldMetadata, aabb, fn);
  }
}

export function isCollidable(entity: ReadonlyEntity): boolean {
  if (entity.health && entity.health.hp <= 0) {
    // Dead entities don't cause collisions.
    return false;
  }

  if (
    entity.placeable_component &&
    anItem(entity.placeable_component.item_id).isUncollideable
  ) {
    return false;
  }

  if (entity.blueprint_component) {
    // Blueprints are interactable (e.g. respond to the player's cursor), but
    // not actually collidable. So we mark them with the `collidable` component,
    // so they register with the cursor raycasting, but leave them out of
    // intersection tests.
    return false;
  }

  return !!entity.collideable;
}
