import assert from "assert";
import {
  npcGroundSupportForceForLocomotion,
  npcGroundWalkingForceCoefficient,
  selectNpcLocomotion,
} from "@/shared/npc/logic";
import {
  HARTHMERE_BUSINESS_CUSTOMER_BEHAVIOR_VERSION,
  type BusinessCustomerState,
} from "@/shared/npc/behavior/business_customer";
import {
  businessCustomerTick,
  groundedBusinessCustomerSpawnPosition,
  shouldRegroundBusinessCustomer,
  updateBusinessCustomerProgress,
} from "@/shared/npc/behavior/business_customer_tick";
import {
  HARTHMERE_BUSINESS_INTERIORS,
  harthmereBusinessCustomerSpawnPoint,
  harthmereBusinessInteriorInteractionPoints,
} from "@/shared/harthmere/business_interior_runtime";
import { dist } from "@/shared/math/linear";
import {
  deserializeNpcCustomState,
  serializeNpcCustomState,
} from "@/shared/npc/serde";
import { DEFAULT_ENVIRONMENT_PARAMS } from "@/shared/physics/environments";
import {
  forwardWalkingForce,
  horizontalForceForTargetSpeed,
} from "@/shared/physics/forces";
import { moveBodyWithClimbing } from "@/shared/physics/movement";
import type { CollisionIndex } from "@/shared/physics/types";
import { toClimbableIndex } from "@/shared/physics/utils";
import { npcGroundLocomotionAabb } from "@/shared/npc/ground_locomotion";
import type { AABB } from "@/shared/math/types";

function state(phase: BusinessCustomerState["phase"]): BusinessCustomerState {
  return {
    version: HARTHMERE_BUSINESS_CUSTOMER_BEHAVIOR_VERSION,
    sessionId: "session",
    ticketId: "ticket",
    outpostId: "outpost",
    businessType: "courier",
    actorEntityId: 42 as any,
    phase,
    reaction: "neutral",
    entrance: [0, 0, 0],
    queueTarget: [4, 0, 4],
    customer: [4, 0, 4],
    staff: [4, 0, 6],
    departure: [0, 0, -10],
    waypoints: [],
    waypointIndex: 0,
    lastPhaseChangedAtSeconds: 1,
  };
}

function npcFor(customer: BusinessCustomerState) {
  const mutable: any = { businessCustomer: customer };
  return {
    state: mutable,
    position: [4, 0, 4],
    type: { runSpeed: 4.4 },
    mutableState: () => mutable,
  } as any;
}

describe("Anima business customer locomotion", () => {
  it("grounds the Ashline authored spawn to its terrain-aware A* source", () => {
    assert.deepEqual(
      groundedBusinessCustomerSpawnPosition([671.9, 67, -65], [672, 67, -63]),
      [672.5, 67.02, -62.5]
    );
    assert.equal(
      groundedBusinessCustomerSpawnPosition([671.9, 67, -65], [680, 67, -63]),
      undefined
    );
  });

  it("keeps one-time spawn grounding safe for every business route", () => {
    assert.equal(HARTHMERE_BUSINESS_INTERIORS.length, 19);
    for (const record of HARTHMERE_BUSINESS_INTERIORS) {
      const spawn = harthmereBusinessCustomerSpawnPoint(record, 0);
      const sourceNode: [number, number, number] = [
        Math.round(spawn[0]),
        Math.round(spawn[1]),
        Math.round(spawn[2]),
      ];
      const grounded = groundedBusinessCustomerSpawnPosition(spawn, sourceNode);
      assert.ok(grounded, record.outpostId);
      const { staff } = harthmereBusinessInteriorInteractionPoints(record);
      assert.ok(
        dist(grounded, staff) >= 18,
        `${record.outpostId} grounding remains out of view`
      );
    }
  });

  it("gives business routes priority over schedules, meander, and escort", () => {
    assert.equal(
      selectNpcLocomotion({
        swim: false,
        fly: false,
        hasFleeOutput: false,
        isQuestGiver: true,
        hasActiveSchedule: true,
        hasChaseAttack: false,
        hasAttackTarget: false,
        hasBusinessCustomerAssignment: true,
        hasEscortAssignment: true,
        canMeander: true,
        canSocialize: true,
      }),
      "businessCustomer"
    );
    assert.equal(
      selectNpcLocomotion({
        swim: false,
        fly: false,
        hasFleeOutput: false,
        isQuestGiver: false,
        hasActiveSchedule: false,
        hasChaseAttack: true,
        hasAttackTarget: true,
        hasBusinessCustomerAssignment: true,
        canMeander: false,
        canSocialize: false,
      }),
      "chaseAttack"
    );
  });

  it("faces the player while serving and holds the counter position", () => {
    const customer = state("serving");
    const npc = npcFor(customer);
    const result = businessCustomerTick(
      {
        resources: {
          get: () => ({ position: { v: [8, 0, 4] } }),
        },
      } as any,
      npc,
      10
    );
    assert.equal(result.forwardSpeed, 0);
    assert.equal(result.phase, "serving");
    assert.ok(Number.isFinite(npc.state.rotateTarget));
  });

  it("advances an arrived entry route into service without teleporting", () => {
    const customer = state("entering");
    const npc = npcFor(customer);
    const result = businessCustomerTick({ resources: {} } as any, npc, 10);
    assert.equal(result.forwardSpeed, 0);
    assert.equal(result.phase, "serving");
    assert.equal(customer.phase, "serving");
    assert.equal(customer.lastPhaseChangedAtSeconds, 10);
  });

  it("walks a queued follower to its spatial slot before holding position", () => {
    const customer = state("queued");
    customer.queueTarget = [8, 0, 4];
    customer.waypoints = [[8, 0, 4]];
    customer.pathfinding = {
      searchTime: 10,
      position: [4, 0, 4],
      path: {
        nodes: [{ position: [4, 0, 4] }, { position: [8, 0, 4] }],
      },
    };
    const npc = npcFor(customer);
    const moving = businessCustomerTick({ resources: {} } as any, npc, 10);
    assert.ok(moving.forwardSpeed > 0);

    npc.position = [8, 0, 4];
    const settled = businessCustomerTick({ resources: {} } as any, npc, 10);
    assert.equal(settled.forwardSpeed, 0);
    assert.equal(settled.phase, "queued");
  });

  it("converts the authored customer pace into a ground-physics force", () => {
    const forwardSpeed = 4.4 * 0.72;
    assert.equal(
      npcGroundWalkingForceCoefficient({
        locomotion: "businessCustomer",
        fightSpeedBoostEligible: false,
        forwardSpeed,
      }),
      horizontalForceForTargetSpeed(forwardSpeed, DEFAULT_ENVIRONMENT_PARAMS)
    );
    assert(
      npcGroundWalkingForceCoefficient({
        locomotion: "businessCustomer",
        fightSpeedBoostEligible: false,
        forwardSpeed,
      }) > forwardSpeed
    );
  });

  it("supports a grounded customer without disabling downhill gravity", () => {
    assert.deepEqual(
      npcGroundSupportForceForLocomotion({
        locomotion: "businessCustomer",
        isGrounded: true,
        gravity: 30,
      })(0.1, {
        aabb: [
          [0, 0, 0],
          [1, 2, 1],
        ],
        velocity: [0, 0, 0],
      }),
      [0, 3, 0]
    );
    assert.deepEqual(
      npcGroundSupportForceForLocomotion({
        locomotion: "businessCustomer",
        isGrounded: false,
        gravity: 30,
      })(0.1, {
        aabb: [
          [0, 0, 0],
          [1, 2, 1],
        ],
        velocity: [0, 0, 0],
      }),
      [0, 0, 0]
    );
    assert.deepEqual(
      npcGroundSupportForceForLocomotion({
        locomotion: "meander",
        isGrounded: true,
        gravity: 30,
      })(0.1, {
        aabb: [
          [0, 0, 0],
          [1, 2, 1],
        ],
        velocity: [0, 0, 0],
      }),
      [0, 0, 0]
    );
  });

  it("moves diagonally across the Ashline terrain-shard floor seam", () => {
    const floorBoxes: AABB[] = [
      [
        [672, 66, -78],
        [704, 67, -64],
      ],
      [
        [672, 66, -64],
        [704, 67, -55],
      ],
    ];
    const intersects = (a: AABB, b: AABB) =>
      [0, 1, 2].every(
        (axis) => a[0][axis] < b[1][axis] && a[1][axis] > b[0][axis]
      );
    const collisionIndex: CollisionIndex = (query, fn) => {
      for (const box of floorBoxes) {
        if (intersects(query, box) && fn(box)) return;
      }
    };
    const body = {
      aabb: npcGroundLocomotionAabb([672.5, 67.02, -64.5], [0.75, 1.8, 0.75]),
      velocity: [0, 0, 0] as [number, number, number],
    };
    const result = moveBodyWithClimbing(
      0.1,
      body,
      DEFAULT_ENVIRONMENT_PARAMS,
      collisionIndex,
      toClimbableIndex(collisionIndex),
      [
        forwardWalkingForce(38.39616, 3.7578010248543565),
        npcGroundSupportForceForLocomotion({
          locomotion: "businessCustomer",
          isGrounded: true,
          gravity: DEFAULT_ENVIRONMENT_PARAMS.gravity,
        }),
      ],
      []
    );
    assert.ok(result.movement.impulse[0] > 0.2);
    assert.ok(result.movement.impulse[2] > 0.3);
    assert.ok(Math.abs(result.movement.impulse[1]) < 1e-9);
    assert.equal(result.movement.velocity[1], 0);
  });

  it("moves from the observed business terrain source cells as one matrix", () => {
    const cases: Array<{
      name: string;
      position: [number, number, number];
      supports: AABB[];
    }> = [
      {
        name: "north anchor",
        position: [763.9, 63, 17],
        supports: [
          [
            [736, 62, 16],
            [768, 63, 23],
          ],
        ],
      },
      {
        name: "glassyard",
        position: [1181.5, 48.02, 118.5],
        supports: [
          [
            [1157, 47, 118],
            [1182, 48, 119],
          ],
        ],
      },
      {
        name: "eastgate",
        position: [1575.9, 66, -157],
        supports: [],
      },
      {
        name: "southplot",
        position: [1721.5, 49.02, -607.5],
        supports: [
          [
            [1696, 48, -608],
            [1723, 49, -607],
          ],
        ],
      },
      {
        name: "cinderlane",
        position: [1628.5, 41.02, -800.5],
        supports: [
          [
            [1613, 36, -801],
            [1632, 41, -800],
          ],
        ],
      },
    ];
    const intersects = (a: AABB, b: AABB) =>
      [0, 1, 2].every(
        (axis) => a[0][axis] < b[1][axis] && a[1][axis] > b[0][axis]
      );

    for (const testCase of cases) {
      const collisionIndex: CollisionIndex = (query, fn) => {
        for (const box of testCase.supports) {
          if (intersects(query, box) && fn(box)) return;
        }
      };
      const result = moveBodyWithClimbing(
        0.1,
        {
          aabb: npcGroundLocomotionAabb(testCase.position, [0.75, 1.8, 0.75]),
          velocity: [0, 0, 0],
        },
        { ...DEFAULT_ENVIRONMENT_PARAMS, gravity: -9.8 },
        collisionIndex,
        toClimbableIndex(collisionIndex),
        [
          forwardWalkingForce(36.36, 3.4087351744554795),
          npcGroundSupportForceForLocomotion({
            locomotion: "businessCustomer",
            isGrounded: testCase.supports.length > 0,
            gravity: -9.8,
          }),
        ],
        []
      );
      assert.ok(
        Math.hypot(result.movement.impulse[0], result.movement.impulse[2]) >
          0.25,
        `${testCase.name}: ${JSON.stringify(result.movement)}`
      );
    }
  });

  describe("stall detection and re-grounding", () => {
    // Anima authored a valid A* path for every stalled customer in the failed
    // live runs, so path freshness cannot be the liveness signal. These
    // contracts pin the replacement signal: real movement of the authoritative
    // position.
    it("reports no stall while the body is actually moving", () => {
      const tracker: { progressPosition?: any; progressAtSeconds?: number } = {};
      assert.equal(
        updateBusinessCustomerProgress(tracker, [0, 0, 0], 100),
        0,
        "first observation establishes the baseline"
      );
      assert.equal(
        updateBusinessCustomerProgress(tracker, [0, 0, 1], 101),
        0,
        "a metre of progress resets the stall clock"
      );
      assert.equal(tracker.progressAtSeconds, 101);
    });

    it("accumulates stalled time when the body does not progress", () => {
      const tracker: { progressPosition?: any; progressAtSeconds?: number } = {};
      updateBusinessCustomerProgress(tracker, [0, 0, 0], 100);
      // Sub-threshold jitter is not progress; this is exactly what a body
      // wedged against a jamb looks like.
      assert.equal(updateBusinessCustomerProgress(tracker, [0.05, 0, 0], 102), 2);
      assert.equal(updateBusinessCustomerProgress(tracker, [0.1, 0, 0], 105), 5);
    });

    it("only re-grounds a body that is both off-surface and stalled", () => {
      // Walking normally over a doorsill must never be treated as wedged, or
      // the customer teleports mid-stride.
      assert.equal(
        shouldRegroundBusinessCustomer({
          position: [10, 67.02, -60],
          sourceNode: [10, 67, -60],
          stalledSeconds: 30,
        }),
        false,
        "on-surface body is never re-seated"
      );
      assert.equal(
        shouldRegroundBusinessCustomer({
          position: [10, 69, -60],
          sourceNode: [10, 67, -60],
          stalledSeconds: 0.5,
        }),
        false,
        "a body still making progress is never re-seated"
      );
      assert.equal(
        shouldRegroundBusinessCustomer({
          position: [10, 69, -60],
          sourceNode: [10, 67, -60],
          stalledSeconds: 5,
        }),
        true,
        "embedded and stalled is the case that must recover"
      );
    });

    it("re-seats a wedged body only within one voxel", () => {
      // The recovery seats the body on the voxel it is already standing over.
      // Anything further would be the queue-node teleport the design forbids.
      assert.ok(
        groundedBusinessCustomerSpawnPosition([10.4, 69, -60.4], [10, 67, -60], 1.5) ===
          undefined,
        "a body two metres off its voxel is not silently relocated"
      );
      assert.deepEqual(
        groundedBusinessCustomerSpawnPosition([10.5, 67.6, -59.5], [10, 67, -60], 1.5),
        [10.5, 67.02, -59.5]
      );
    });
  });

  it("survives the native npc_state serialization round trip", () => {
    const encoded = serializeNpcCustomState({
      businessCustomer: state("departing"),
    });
    const decoded = deserializeNpcCustomState(encoded).businessCustomer!;
    assert.equal(decoded.phase, "departing");
    assert.equal(decoded.ticketId, "ticket");
    assert.deepEqual(decoded.departure, [0, 0, -10]);
  });
});
