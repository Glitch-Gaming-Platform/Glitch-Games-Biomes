/// <reference types="mocha" />

import assert from "assert";

import {
  HARTHMERE_TOOL_SOURCES,
  harthmereJobItemSourceGuidance,
  harthmereJobMarkerPlan,
  harthmereJobNotification,
  harthmereJobRequiredToolAction,
  harthmereJobToolSourceGuidance,
  harthmereSelectTrackedJob,
  harthmereTrackedJobMarkerPlan,
} from "@/shared/harthmere/harthmere_job_objective";
import { harthmereJobsBoardQuestMarkerPositionForId } from "@/shared/harthmere/jobs_board_quest_marker_positions";

const BOARD = "harthmere_market_posting_board";

describe("HARTHMERE_TOOL_SOURCES — tool vendors resolve to real map positions", () => {
  it("every tool source's vendor marker resolves to a real owner position", () => {
    for (const source of Object.values(HARTHMERE_TOOL_SOURCES)) {
      const marker = harthmereJobsBoardQuestMarkerPositionForId(
        source.vendorMarkerId
      );
      assert.ok(
        marker,
        `tool vendor marker ${source.vendorMarkerId} (${source.action}) must resolve`
      );
      assert.equal(marker?.source, "business_owner");
    }
  });
});

describe("harthmereJobRequiredToolAction — which kinds need a tool", () => {
  it("maps repair/cleanup to their tool action and everything else to none", () => {
    assert.equal(harthmereJobRequiredToolAction("repair"), "repair");
    assert.equal(harthmereJobRequiredToolAction("cleanup"), "cleanup");
    for (const kind of ["hunt", "gather", "delivery", "escort", undefined]) {
      assert.equal(harthmereJobRequiredToolAction(kind), undefined);
    }
  });
});

describe("harthmereJobToolSourceGuidance — where to buy a tool you don't own", () => {
  it("returns vendor guidance for a repair job when the tool is NOT owned", () => {
    const guidance = harthmereJobToolSourceGuidance({
      kind: "repair",
      toolOwned: false,
    });
    assert.ok(guidance);
    assert.equal(guidance!.action, "repair");
    assert.equal(
      guidance!.vendorMarkerId,
      HARTHMERE_TOOL_SOURCES.repair.vendorMarkerId
    );
    assert.ok(guidance!.hint.includes(HARTHMERE_TOOL_SOURCES.repair.toolName));
    assert.ok(
      guidance!.hint.includes(HARTHMERE_TOOL_SOURCES.repair.vendorName)
    );
    // The vendor marker must resolve to a real map position.
    assert.ok(
      harthmereJobsBoardQuestMarkerPositionForId(guidance!.vendorMarkerId)
    );
  });

  it("returns cleanup guidance too, with a muck-specific hint", () => {
    const guidance = harthmereJobToolSourceGuidance({
      kind: "cleanup",
      toolOwned: false,
    });
    assert.ok(guidance);
    assert.equal(guidance!.action, "cleanup");
    assert.ok(/muck/i.test(guidance!.hint));
  });

  it("returns nothing once the player OWNS the tool (sent to the job, not a shop)", () => {
    assert.equal(
      harthmereJobToolSourceGuidance({ kind: "repair", toolOwned: true }),
      undefined
    );
  });

  it("returns nothing when ownership is unknown (no buy redirect unless we KNOW)", () => {
    assert.equal(harthmereJobToolSourceGuidance({ kind: "repair" }), undefined);
  });

  it("returns nothing for a kind that needs no tool", () => {
    assert.equal(
      harthmereJobToolSourceGuidance({ kind: "hunt", toolOwned: false }),
      undefined
    );
  });
});

describe("harthmereJobItemSourceGuidance — where to get missing job items", () => {
  it("returns gather guidance for missing repair materials", () => {
    const guidance = harthmereJobItemSourceGuidance({
      kind: "repair",
      requirements: [{ itemId: "softwood_log", count: 3 }],
      inventoryItems: { softwood_log: 1 },
    });
    assert.ok(guidance);
    assert.equal(guidance!.itemId, "softwood_log");
    assert.equal(guidance!.missingCount, 2);
    assert.equal(guidance!.sourceKind, "gather");
    assert.equal(guidance!.markerId, "harthmere_orchard_softwood");
    assert.deepEqual(guidance!.markerPosition, [468, 53, -118]);
    assert.ok(/Orchard Softwood Branches/i.test(guidance!.hint));
  });

  it("returns no guidance once inventory satisfies all item requirements", () => {
    assert.equal(
      harthmereJobItemSourceGuidance({
        kind: "gather",
        requirements: [{ itemId: "wild_berries", count: 6 }],
        inventoryItems: { wild_berries: 6 },
      }),
      undefined
    );
  });

  it("points pickup deliveries at the pickup marker", () => {
    const guidance = harthmereJobItemSourceGuidance({
      kind: "delivery",
      requirements: [
        {
          itemId: "sealed_package",
          count: 1,
          pickupMarkerId: "harthmere_bridge_center",
        },
      ],
      inventoryItems: {},
    });
    assert.equal(guidance?.sourceKind, "pickup");
    assert.equal(guidance?.markerId, "harthmere_bridge_center");
  });
});

describe("harthmereJobMarkerPlan — per-kind phase + marker resolution", () => {
  describe("delivery", () => {
    const personReqs = [
      {
        itemId: "ledger_pouch",
        count: 1,
        recipientNpcId: "npc_outpost_brightcart_trader",
      },
    ];

    it("guides to the recipient person during field phase (parcel granted on accept)", () => {
      const plan = harthmereJobMarkerPlan({
        kind: "delivery",
        requirements: personReqs,
        boardMarkerId: BOARD,
        progress: { hasParcel: true },
      });
      assert.equal(plan.phase, "field");
      assert.equal(
        plan.activeMarkerId,
        "harthmere_owner:npc_outpost_brightcart_trader"
      );
      assert.equal(plan.objectiveMet, false);
    });

    it("guides to the pickup spot first when the parcel must be collected", () => {
      const plan = harthmereJobMarkerPlan({
        kind: "delivery",
        requirements: [
          {
            itemId: "courier_pouch",
            count: 1,
            recipientNpcId: "npc_outpost_stampspur_dispatcher",
            pickupMarkerId: "harthmere_bridge_center",
          },
        ],
        boardMarkerId: BOARD,
        progress: { hasParcel: false },
      });
      assert.equal(plan.phase, "pickup");
      assert.equal(plan.activeMarkerId, "harthmere_bridge_center");
    });

    it("after pickup, guides to the recipient", () => {
      const plan = harthmereJobMarkerPlan({
        kind: "delivery",
        requirements: [
          {
            itemId: "courier_pouch",
            count: 1,
            recipientNpcId: "npc_outpost_stampspur_dispatcher",
            pickupMarkerId: "harthmere_bridge_center",
          },
        ],
        boardMarkerId: BOARD,
        progress: { hasParcel: true },
      });
      assert.equal(plan.phase, "field");
      assert.equal(
        plan.activeMarkerId,
        "harthmere_owner:npc_outpost_stampspur_dispatcher"
      );
    });

    it("flips to the board after handoff", () => {
      const plan = harthmereJobMarkerPlan({
        kind: "delivery",
        requirements: personReqs,
        boardMarkerId: BOARD,
        progress: { deliveredToRecipient: true },
      });
      assert.equal(plan.phase, "return_to_board");
      assert.equal(plan.activeMarkerId, BOARD);
      assert.equal(plan.objectiveMet, true);
    });

    it("place recipient points at the drop-off marker", () => {
      const plan = harthmereJobMarkerPlan({
        kind: "delivery",
        requirements: [
          {
            itemId: "apple_basket",
            count: 1,
            mapMarkerId: "grove_mail_bank_satchel",
          },
        ],
        boardMarkerId: BOARD,
        progress: { hasParcel: true },
      });
      assert.equal(plan.activeMarkerId, "grove_mail_bank_satchel");
    });
  });

  describe("gather", () => {
    const reqs = [
      {
        itemId: "wild_berries",
        count: 6,
        mapMarkerId: "grove_garden_edge_berries",
      },
    ];

    it("guides to the gather spot with a running count", () => {
      const plan = harthmereJobMarkerPlan({
        kind: "gather",
        requirements: reqs,
        boardMarkerId: BOARD,
        progress: { gatheredCount: 2 },
      });
      assert.equal(plan.phase, "field");
      assert.equal(plan.activeMarkerId, "grove_garden_edge_berries");
      assert.equal(plan.requiredCount, 6);
      assert.equal(plan.currentCount, 2);
    });

    it("flips to the board once the count is reached", () => {
      const plan = harthmereJobMarkerPlan({
        kind: "gather",
        requirements: reqs,
        boardMarkerId: BOARD,
        progress: { gatheredCount: 6 },
      });
      assert.equal(plan.phase, "return_to_board");
      assert.equal(plan.activeMarkerId, BOARD);
    });

    it("uses DISTINCT messaging for the already-have shortcut", () => {
      const plan = harthmereJobMarkerPlan({
        kind: "gather",
        requirements: reqs,
        boardMarkerId: BOARD,
        progress: { gatheredCount: 6, satisfiedOnAccept: true },
      });
      assert.equal(plan.phase, "return_to_board");
      assert.ok(/already have/i.test(plan.hint), plan.hint);
      assert.ok(/no gathering needed/i.test(plan.hint), plan.hint);
    });
  });

  describe("cleanup", () => {
    const reqs = [
      { itemId: "muckwad", count: 5, mapMarkerId: "muckwad_patch" },
    ];

    it("guides to the muck spot with a cleaned count", () => {
      const plan = harthmereJobMarkerPlan({
        kind: "cleanup",
        requirements: reqs,
        boardMarkerId: BOARD,
        progress: { cleanedCount: 2, toolOwned: true },
      });
      assert.equal(plan.phase, "field");
      assert.equal(plan.activeMarkerId, "muckwad_patch");
      assert.equal(plan.currentCount, 2);
      assert.equal(plan.requiredCount, 5);
    });

    it("guides the player to BUY a cleanup tool from the marked vendor when missing", () => {
      const plan = harthmereJobMarkerPlan({
        kind: "cleanup",
        requirements: reqs,
        boardMarkerId: BOARD,
        progress: { cleanedCount: 0, toolOwned: false },
      });
      assert.equal(plan.needsToolAction, "cleanup");
      // Marker points at the tool vendor (a real on-map business owner), not the
      // muck spot, so the player is guided to acquire the tool first.
      assert.equal(
        plan.activeMarkerId,
        "harthmere_owner:npc_outpost_clearbarrel_boss"
      );
      assert.ok(/buy/i.test(plan.hint), plan.hint);
    });

    it("flips to the board once enough muck is cleared", () => {
      const plan = harthmereJobMarkerPlan({
        kind: "cleanup",
        requirements: reqs,
        boardMarkerId: BOARD,
        progress: { cleanedCount: 5, toolOwned: true },
      });
      assert.equal(plan.phase, "return_to_board");
      assert.equal(plan.activeMarkerId, BOARD);
    });
  });

  describe("repair", () => {
    it("guides the player to BUY a repair tool from the marked vendor when missing", () => {
      const plan = harthmereJobMarkerPlan({
        kind: "repair",
        requirements: [
          {
            itemId: "softwood_log",
            count: 3,
            mapMarkerId: "grove_repair_fence",
            requiredToolAction: "repair",
          },
        ],
        fieldMarkerId: "grove_repair_fence",
        boardMarkerId: BOARD,
        progress: { repaired: false, toolOwned: false },
      });
      assert.equal(plan.needsToolAction, "repair");
      assert.equal(
        plan.activeMarkerId,
        "harthmere_owner:npc_outpost_hingehall_fixer"
      );
      assert.ok(/buy/i.test(plan.hint), plan.hint);
    });

    it("once the player owns the tool, guides back to the structure", () => {
      const plan = harthmereJobMarkerPlan({
        kind: "repair",
        requirements: [
          {
            itemId: "softwood_log",
            count: 3,
            mapMarkerId: "grove_repair_fence",
            requiredToolAction: "repair",
          },
        ],
        fieldMarkerId: "grove_repair_fence",
        boardMarkerId: BOARD,
        progress: { repaired: false, toolOwned: true },
      });
      assert.equal(plan.needsToolAction, undefined);
      assert.equal(plan.activeMarkerId, "grove_repair_fence");
    });

    it("flips to the board once repaired", () => {
      const plan = harthmereJobMarkerPlan({
        kind: "repair",
        requirements: [
          {
            itemId: "softwood_log",
            count: 3,
            mapMarkerId: "grove_repair_fence",
            requiredToolAction: "repair",
          },
        ],
        fieldMarkerId: "grove_repair_fence",
        boardMarkerId: BOARD,
        progress: { repaired: true },
      });
      assert.equal(plan.phase, "return_to_board");
      assert.equal(plan.activeMarkerId, BOARD);
    });
  });

  describe("failed quests drop their markers", () => {
    it("a failed job has no active marker and a failed phase", () => {
      const plan = harthmereJobMarkerPlan({
        kind: "gather",
        requirements: [
          {
            itemId: "wild_berries",
            count: 6,
            mapMarkerId: "grove_garden_edge_berries",
          },
        ],
        boardMarkerId: BOARD,
        progress: { failed: true, gatheredCount: 2 },
      });
      assert.equal(plan.phase, "failed");
      assert.equal(plan.activeMarkerId, undefined);
      assert.equal(plan.objectiveMet, false);
    });

    it("an escort whose NPC was killed fails with no marker", () => {
      const plan = harthmereJobMarkerPlan({
        kind: "escort",
        fieldMarkerId: "old_grove_road_post",
        boardMarkerId: BOARD,
        progress: { escortFailed: true },
      });
      assert.equal(plan.phase, "failed");
      assert.equal(plan.activeMarkerId, undefined);
      assert.ok(/companion/i.test(plan.hint));
    });

    it("notifies failed (over expired/ready)", () => {
      const n = harthmereJobNotification({
        jobId: "x",
        jobTitle: "Escort",
        nowMs: 100,
        objectiveMet: true,
        failed: true,
      });
      assert.equal(n?.kind, "failed");
    });
  });

  describe("escort", () => {
    it("guides to the destination while escorting", () => {
      const plan = harthmereJobMarkerPlan({
        kind: "escort",
        fieldMarkerId: "old_grove_road_post",
        boardMarkerId: BOARD,
        progress: {},
      });
      assert.equal(plan.phase, "field");
      assert.equal(plan.activeMarkerId, "old_grove_road_post");
    });

    it("flips to the board once the companion arrives", () => {
      const plan = harthmereJobMarkerPlan({
        kind: "escort",
        fieldMarkerId: "old_grove_road_post",
        boardMarkerId: BOARD,
        progress: { escortArrived: true },
      });
      assert.equal(plan.phase, "return_to_board");
      assert.equal(plan.activeMarkerId, BOARD);
    });
  });

  describe("track-job selector (multiple active jobs)", () => {
    const jobs = [
      {
        jobId: "a",
        kind: "gather",
        acceptedAtMs: 100,
        fieldMarkerId: "spot_a",
      },
      {
        jobId: "b",
        kind: "repair",
        acceptedAtMs: 200,
        fieldMarkerId: "spot_b",
      },
      {
        jobId: "c",
        kind: "delivery",
        acceptedAtMs: 150,
        deadlineAtMs: 50,
        fieldMarkerId: "spot_c",
      },
    ];

    it("defaults to the most-recently-accepted active job", () => {
      const picked = harthmereSelectTrackedJob(jobs, undefined, 1000);
      assert.equal(picked?.jobId, "b");
    });

    it("honors an explicit tracked job", () => {
      const picked = harthmereSelectTrackedJob(jobs, "a", 1000);
      assert.equal(picked?.jobId, "a");
    });

    it("never tracks an expired job (falls back to default)", () => {
      const picked = harthmereSelectTrackedJob(jobs, "c", 1000);
      assert.equal(picked?.jobId, "b"); // c is past its deadline
    });

    it("resolves the tracked job's marker plan", () => {
      const out = harthmereTrackedJobMarkerPlan({
        jobs,
        trackedJobId: "a",
        boardMarkerId: BOARD,
        nowMs: 1000,
      });
      assert.equal(out?.jobId, "a");
      assert.equal(out?.plan.kind, "gather");
      assert.equal(out?.plan.activeMarkerId, "spot_a");
    });

    it("returns undefined when there are no active jobs", () => {
      assert.equal(harthmereSelectTrackedJob([], undefined, 1000), undefined);
    });
  });

  describe("ready/expiry notifications", () => {
    it("notifies ready-to-turn-in when the objective is met", () => {
      const n = harthmereJobNotification({
        jobId: "a",
        jobTitle: "Fix the fence",
        nowMs: 100,
        objectiveMet: true,
      });
      assert.equal(n?.kind, "ready_to_turn_in");
      assert.ok(/ready/i.test(n!.message));
    });

    it("notifies expired (and expiry beats objective-met)", () => {
      const n = harthmereJobNotification({
        jobId: "a",
        deadlineAtMs: 50,
        nowMs: 100,
        objectiveMet: true,
      });
      assert.equal(n?.kind, "expired");
    });

    it("returns undefined while the objective is still in progress", () => {
      assert.equal(
        harthmereJobNotification({
          jobId: "a",
          nowMs: 100,
          objectiveMet: false,
        }),
        undefined
      );
    });
  });

  describe("default kinds (hunt/craft/etc.)", () => {
    it("guides to the field marker until the objective is met", () => {
      const plan = harthmereJobMarkerPlan({
        kind: "hunt",
        fieldMarkerId: "elite_mucker_bounty",
        boardMarkerId: BOARD,
        progress: {},
      });
      assert.equal(plan.phase, "field");
      assert.equal(plan.activeMarkerId, "elite_mucker_bounty");
    });

    it("flips to the board when satisfied", () => {
      const plan = harthmereJobMarkerPlan({
        kind: "hunt",
        fieldMarkerId: "elite_mucker_bounty",
        boardMarkerId: BOARD,
        progress: { satisfiedOnAccept: true },
      });
      assert.equal(plan.phase, "return_to_board");
      assert.equal(plan.activeMarkerId, BOARD);
    });
  });
});
