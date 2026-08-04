import assert from "assert";
import { readFileSync } from "fs";
import path from "path";
import {
  HARTHMERE_BUSINESS_INTERIORS,
  harthmereBusinessCustomerQueueTarget,
  harthmereBusinessInteriorInteractionPoints,
} from "@/shared/harthmere/business_interior_runtime";
import {
  harthmereBusinessAisleKeepOut,
  harthmereBusinessBlockedAisleForPoint,
  harthmereBusinessPointBlocksAisle,
  harthmereBusinessPostClearOfEveryAisle,
  harthmereBusinessStaffSidePost,
} from "@/shared/harthmere/business_aisle_keep_out";
import { HARTHMERE_BUSINESS_OWNER_NPC_SEEDS } from "@/shared/harthmere/business_owner_npc_seed";
import { HARTHMERE_BUSINESS_INTERIOR_COLLISION_SEEDS } from "@/shared/harthmere/business_interior_collision_seed";
import {
  applyHarthmereBusinessAisleKeepOutToSeedChanges,
  buildHarthmereBusinessAisleNpcSweep,
} from "@/server/harthmere/business_aisle_npc_sweep";
import type { Vec3 } from "@/shared/math/types";

/**
 * The customer aisle is a keep-out volume for every persistent body.
 *
 * A native NPC is a collidable one-metre box; one parked in the lane is
 * physically a wall, and reproduces the exact failure the widened doorway was
 * meant to end — a customer holding a valid A* path that cannot advance. These
 * rows are per business so a single restyled interior fails alone.
 */
describe("harthmere business aisle keep-out", () => {
  it("covers all nineteen audited businesses", () => {
    assert.equal(HARTHMERE_BUSINESS_INTERIORS.length, 19);
    assert.equal(HARTHMERE_BUSINESS_OWNER_NPC_SEEDS.length, 19);
  });

  for (const record of HARTHMERE_BUSINESS_INTERIORS) {
    describe(record.outpostId, () => {
      const seed = HARTHMERE_BUSINESS_OWNER_NPC_SEEDS.find(
        (candidate) => candidate.outpostId === record.outpostId
      )!;

      it("keeps the shop owner out of its own customer aisle", () => {
        // Every owner used to stand at the footprint centre, which is the middle
        // of the lane its own customers walk.
        assert.equal(
          harthmereBusinessPointBlocksAisle(record, seed.position as Vec3),
          false,
          `${record.outpostId} owner at ${seed.position.join(",")} blocks the aisle`
        );
      });

      it("keeps the shop owner inside its own shell", () => {
        // Relocation must not solve the aisle by pushing the owner into a wall
        // or out of the building.
        const [minX, , minZ] = record.shellOrigin;
        assert.ok(
          seed.position[0] > minX &&
            seed.position[0] < minX + record.footprint.width &&
            seed.position[2] > minZ &&
            seed.position[2] < minZ + record.footprint.depth,
          `${record.outpostId} owner at ${seed.position.join(",")} is outside the shell`
        );
      });

      it("treats the whole customer route as keep-out", () => {
        // The route anchors are the points that must stay walkable; each of them
        // must be reported as keep-out so nothing is ever authored onto them.
        const points = harthmereBusinessInteriorInteractionPoints(record);
        for (const [label, point] of Object.entries(points)) {
          if (label === "queueStart") continue;
          assert.ok(
            harthmereBusinessPointBlocksAisle(record, point as Vec3),
            `${record.outpostId} ${label} is not protected`
          );
        }
        for (let queueIndex = 0; queueIndex < 3; queueIndex += 1) {
          const target = harthmereBusinessCustomerQueueTarget(
            record,
            queueIndex
          );
          assert.ok(
            harthmereBusinessPointBlocksAisle(record, target),
            `${record.outpostId} queue slot ${queueIndex} is not protected`
          );
        }
      });

      it("relocates a body authored in the middle of the lane", () => {
        const keepOut = harthmereBusinessAisleKeepOut(record);
        const points = harthmereBusinessInteriorInteractionPoints(record);
        const middleOfLane: Vec3 = [
          (keepOut.xMin + keepOut.xMax) / 2,
          points.customer[1],
          (keepOut.zMin + keepOut.zMax) / 2,
        ];
        assert.ok(harthmereBusinessPointBlocksAisle(record, middleOfLane));
        const moved = harthmereBusinessPostClearOfEveryAisle(middleOfLane);
        assert.equal(
          harthmereBusinessBlockedAisleForPoint(moved),
          undefined,
          `${record.outpostId} relocated body still blocks an aisle at ${moved.join(",")}`
        );
        assert.equal(
          moved[2],
          middleOfLane[2],
          "relocation is lateral so authored depth staging is preserved"
        );
      });

      it("keeps seeded collision proxies out of the lane", () => {
        // The asset pipeline already proves zero fixture intrusions in local
        // manifest space. This checks the same thing after the world-space
        // conversion and after the crafting stations were re-anchored, because
        // a proxy in the lane is just as impassable as an NPC and would not be
        // caught by the manifest-space validator.
        //
        // The service counter is the deliberate exception: it is supposed to sit
        // between the customer and staff points. That is asserted separately
        // below rather than waived.
        for (const proxy of HARTHMERE_BUSINESS_INTERIOR_COLLISION_SEEDS.filter(
          (candidate) =>
            candidate.outpostId === record.outpostId &&
            candidate.role !== "service_counter" &&
            candidate.role !== "floor"
        )) {
          const standing: Vec3 = [
            proxy.position[0],
            proxy.position[1] + proxy.size[1] / 2,
            proxy.position[2],
          ];
          assert.equal(
            harthmereBusinessPointBlocksAisle(record, standing),
            false,
            `${record.outpostId} collision proxy "${proxy.label}" blocks the aisle`
          );
        }
      });

      it("puts a collidable counter between the customer and staff points", () => {
        // The handoff requires customer and staff on opposite sides of a
        // genuinely collidable counter. With real collision proxies seeded, that
        // is now checkable: the counter must exist, and the two service points
        // must fall on opposite sides of it along the room's depth axis.
        const counters = HARTHMERE_BUSINESS_INTERIOR_COLLISION_SEEDS.filter(
          (candidate) =>
            candidate.outpostId === record.outpostId &&
            candidate.role === "service_counter"
        );
        assert.ok(
          counters.length >= 1,
          `${record.outpostId} has no collidable service counter`
        );
        const points = harthmereBusinessInteriorInteractionPoints(record);
        const counter = counters[0];
        const halfDepth = counter.size[2] / 2;
        assert.ok(
          points.customer[2] < counter.position[2] - halfDepth + 0.001 &&
            points.staff[2] > counter.position[2] + halfDepth - 0.001,
          `${record.outpostId} customer ${points.customer[2]} and staff ${points.staff[2]} are not on opposite sides of the counter at ${counter.position[2]}`
        );
      });

      it("offers a staff-side post clear of the lane", () => {
        const post = harthmereBusinessStaffSidePost(record.outpostId)!;
        assert.ok(post, `${record.outpostId} has no staff-side post`);
        assert.equal(harthmereBusinessBlockedAisleForPoint(post), undefined);
      });
    });
  }

  describe("reconciliation sweep", () => {
    const record = HARTHMERE_BUSINESS_INTERIORS[0];
    const points = harthmereBusinessInteriorInteractionPoints(record);
    const inLane: Vec3 = [
      points.customer[0],
      points.customer[1],
      points.customer[2],
    ];

    it("relocates a persistent NPC standing in the lane", () => {
      const result = buildHarthmereBusinessAisleNpcSweep({
        candidates: [{ id: 5150 as any, position: inLane }],
      });
      assert.equal(result.relocations.length, 1);
      assert.equal(result.relocations[0].outpostId, record.outpostId);
      assert.equal(result.unresolved.length, 0);
      assert.equal(
        harthmereBusinessBlockedAisleForPoint(result.relocations[0].to),
        undefined
      );
    });

    it("moves the home anchor with the body", () => {
      // spawn_position drives return-home and meander. A body relocated by
      // position alone walks straight back into the lane on its next tick, and
      // the reconciliation looks like it silently did nothing.
      const result = buildHarthmereBusinessAisleNpcSweep({
        candidates: [
          {
            id: 5151 as any,
            position: inLane,
            npcMetadata: {
              npc_type_id: 1 as any,
              created_time: 0,
              spawn_position: inLane,
            },
          },
        ],
      });
      assert.equal(result.relocations[0].movedHomeAnchor, true);
      const change = result.changes[0] as any;
      assert.deepEqual(
        change.entity.npc_metadata.spawn_position,
        change.entity.position.v
      );
    });

    it("leaves session-only business customers alone", () => {
      // Customers are supposed to be in the aisle; that is the whole feature.
      const result = buildHarthmereBusinessAisleNpcSweep({
        candidates: [{ id: 5152 as any, position: inLane }],
        exemptIds: new Set([5152 as any]),
      });
      assert.deepEqual(result.relocations, []);
      assert.deepEqual(result.changes, []);
    });

    it("ignores bodies that are already clear", () => {
      const post = harthmereBusinessStaffSidePost(record.outpostId)!;
      const result = buildHarthmereBusinessAisleNpcSweep({
        candidates: [{ id: 5153 as any, position: post }],
      });
      assert.deepEqual(result.changes, []);
    });

    it("resolves every owner seed as already clear", () => {
      // The authored fix and the reconciliation sweep must agree, or every
      // startup would rewrite all nineteen owners forever.
      const result = buildHarthmereBusinessAisleNpcSweep({
        candidates: HARTHMERE_BUSINESS_OWNER_NPC_SEEDS.map((owner) => ({
          id: owner.entityId,
          position: owner.position as Vec3,
        })),
      });
      assert.deepEqual(result.relocations, []);
      assert.deepEqual(result.unresolved, []);
    });

    it("corrects a real seed change and its return-home anchor together", () => {
      const result = applyHarthmereBusinessAisleKeepOutToSeedChanges([
        {
          kind: "update",
          entity: {
            id: 5154 as any,
            position: { v: inLane },
            npc_metadata: {
              npc_type_id: 1 as any,
              created_time: 0,
              spawn_position: inLane,
            },
          },
        },
      ]);
      assert.deepEqual(result.correctedIds, [5154]);
      const entity = (result.changes[0] as any).entity;
      assert.equal(
        harthmereBusinessBlockedAisleForPoint(entity.position.v),
        undefined
      );
      assert.deepEqual(entity.npc_metadata.spawn_position, entity.position.v);
    });

    it("wires the sweep and its version into warm runtime reconciliation", () => {
      const shim = readFileSync(
        path.join(process.cwd(), "src/server/shim/main.ts"),
        "utf8"
      );
      assert.ok(
        /businessAisleNpcSweepVersion:\s*HARTHMERE_BUSINESS_AISLE_NPC_SWEEP_VERSION/.test(
          shim
        ),
        "runtime-content fingerprint must change when the aisle sweep changes"
      );
      const start = shim.indexOf(
        "async function reconcileLocalDevRuntimeContent("
      );
      const end = shim.indexOf(
        "function allExpectedLocalDevSeedIdsExist(",
        start
      );
      assert.ok(start >= 0 && end > start, "warm reconciliation body missing");
      const reconcile = shim.slice(start, end);
      assert.ok(
        /const candidateNpcChanges\s*=\s*applyHarthmereBusinessAisleKeepOutToSeedChanges/.test(
          reconcile
        ),
        "warm candidate discovery must use aisle-corrected NPC changes"
      );
      assert.ok(
        /const runtimeNpcSeedChanges\s*=\s*applyHarthmereBusinessAisleKeepOutToSeedChanges/.test(
          reconcile
        ),
        "warm writes must use aisle-corrected NPC changes"
      );
      assert.ok(
        reconcile.includes("...runtimeNpcSeedChanges.changes"),
        "warm reconciliation must write the corrected changes"
      );
    });
  });
});
