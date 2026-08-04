import assert from "assert";
import { readFileSync } from "fs";
import { resolve } from "path";

import {
  buildHarthmereBusinessInteriorCollisionSeedChanges,
  buildHarthmereBusinessInteriorCollisionSeedProposedChanges,
  harthmereBusinessInteriorCollisionSeedEntityIds,
} from "@/server/harthmere/business_interior_collision_ecs_seed";
import { getAabbForEntity } from "@/shared/game/entity_sizes";
import {
  HARTHMERE_BUSINESS_INTERIOR_FLOOR_THICKNESS_METERS,
  HARTHMERE_BUSINESS_INTERIOR_COLLISION_SEEDS,
  validateHarthmereBusinessInteriorCollisionSeeds,
} from "@/shared/harthmere/business_interior_collision_seed";
import { HARTHMERE_BUSINESS_INTERIORS } from "@/shared/harthmere/business_interior_runtime";

describe("business interior collision ECS seed", () => {
  it("materializes all 178 manifest proxies and 19 floors as invisible native collision", () => {
    assert.deepEqual(validateHarthmereBusinessInteriorCollisionSeeds(), []);
    assert.equal(HARTHMERE_BUSINESS_INTERIORS.length, 19);
    assert.equal(HARTHMERE_BUSINESS_INTERIOR_COLLISION_SEEDS.length, 197);
    const changes = buildHarthmereBusinessInteriorCollisionSeedChanges({
      tick: 7,
    });
    assert.equal(changes.length, 197);

    for (const change of changes) {
      assert.equal(change.kind, "create");
      if (change.kind !== "create") {
        assert.fail(`unexpected ${change.kind} collision seed`);
      }
      const entity = change.entity;
      assert.ok(entity.position);
      assert.ok(entity.orientation);
      assert.ok(entity.size);
      assert.ok(entity.collideable);
      assert.equal(entity.placeable_component, undefined);
      assert.equal(entity.npc_metadata, undefined);
      assert.equal(entity.label, undefined);
      assert.ok(
        getAabbForEntity(entity, { extentsType: "collidable" }),
        `proxy ${entity.id} should expose a collidable AABB`
      );
    }
  });

  it("preserves exact manifest center/size axis conversion for every proxy", () => {
    for (const seed of HARTHMERE_BUSINESS_INTERIOR_COLLISION_SEEDS.filter(
      (candidate) => candidate.role !== "floor"
    )) {
      const record = HARTHMERE_BUSINESS_INTERIORS.find(
        (candidate) => candidate.outpostId === seed.outpostId
      )!;
      const box = record.collisionBoxes[seed.sourceCollisionIndex!];
      assert.ok(box, seed.collisionSeedId);
      assert.deepEqual(seed.size, [box.size[0], box.size[2], box.size[1]]);
      assert.deepEqual(seed.position, [
        record.assetWorldAnchor[0] + box.center[0],
        record.assetWorldAnchor[1] + box.center[2] - box.size[2] / 2,
        record.assetWorldAnchor[2] + box.center[1],
      ]);
    }
  });

  it("places one full-footprint floor at each authored standing height", () => {
    const floors = HARTHMERE_BUSINESS_INTERIOR_COLLISION_SEEDS.filter(
      (seed) => seed.role === "floor"
    );
    assert.equal(floors.length, 19);
    for (const record of HARTHMERE_BUSINESS_INTERIORS) {
      const floor = floors.find((seed) => seed.outpostId === record.outpostId);
      assert.ok(floor, `${record.outpostId} floor missing`);
      assert.equal(floor!.sourceCollisionIndex, undefined);
      assert.deepEqual(floor!.size, [
        record.footprint.width,
        HARTHMERE_BUSINESS_INTERIOR_FLOOR_THICKNESS_METERS,
        record.footprint.depth,
      ]);
      assert.deepEqual(floor!.position, [
        record.assetWorldAnchor[0] + record.footprint.width / 2,
        record.assetWorldAnchor[1] -
          HARTHMERE_BUSINESS_INTERIOR_FLOOR_THICKNESS_METERS,
        record.assetWorldAnchor[2] + record.footprint.depth / 2,
      ]);
      assert.equal(
        floor!.position[1] + floor!.size[1],
        record.assetWorldAnchor[1]
      );
    }
  });

  it("uses stable unique ids and updates already-present proxies", () => {
    const ids = harthmereBusinessInteriorCollisionSeedEntityIds();
    assert.equal(new Set(ids.map(Number)).size, 197);
    const existingIds = new Set([ids[0], ids[196]]);
    const changes = buildHarthmereBusinessInteriorCollisionSeedChanges({
      tick: 8,
      existingIds,
    });
    assert.equal(changes[0].kind, "update");
    assert.equal(changes[196].kind, "update");
    assert.equal(changes[1].kind, "create");
    assert.equal(
      buildHarthmereBusinessInteriorCollisionSeedProposedChanges({
        existingIds,
      }).length,
      197
    );
  });

  it("is wired into warm reconciliation and keeps interaction anchors non-rendering", () => {
    const root = process.cwd();
    const shim = readFileSync(resolve(root, "src/server/shim/main.ts"), "utf8");
    const reconcile = readFileSync(
      resolve(root, "scripts/harthmere/reconcile-production-world-sync.cjs"),
      "utf8"
    );
    const renderer = readFileSync(
      resolve(root, "src/client/game/renderers/placeables.ts"),
      "utf8"
    );
    assert.ok(
      shim.includes("buildHarthmereBusinessInteriorCollisionSeedChanges")
    );
    assert.ok(
      reconcile.includes(
        "buildHarthmereBusinessInteriorCollisionSeedProposedChanges"
      )
    );
    assert.ok(
      renderer.includes("isHarthmereBusinessCraftingStationEntityId(entity.id)")
    );
  });
});
