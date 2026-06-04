/// <reference types="mocha" />

import assert from "assert";

import {
  HARTHMERE_TOOL_SOURCES_V151,
  harthmereJobMarkerPlanV151,
  harthmereJobNotificationV151,
  harthmereSelectTrackedJobV151,
  harthmereTrackedJobMarkerPlanV151,
} from "@/shared/harthmere/harthmere_job_objective_v151";
import { harthmereJobsBoardQuestMarkerPositionForIdV1 } from "@/shared/harthmere/jobs_board_quest_marker_positions_v1";

const BOARD = "harthmere_market_posting_board";

describe("HARTHMERE_TOOL_SOURCES_V151 — tool vendors resolve to real map positions", () => {
  it("every tool source's vendor marker resolves to a real owner position", () => {
    for (const source of Object.values(HARTHMERE_TOOL_SOURCES_V151)) {
      const marker = harthmereJobsBoardQuestMarkerPositionForIdV1(
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

describe("harthmereJobMarkerPlanV151 — per-kind phase + marker resolution", () => {
  describe("delivery", () => {
    const personReqs = [
      { itemId: "ledger_pouch", count: 1, recipientNpcId: "npc_outpost_brightcart_trader" },
    ];

    it("guides to the recipient person during field phase (parcel granted on accept)", () => {
      const plan = harthmereJobMarkerPlanV151({
        kind: "delivery",
        requirements: personReqs,
        boardMarkerId: BOARD,
        progress: { hasParcel: true },
      });
      assert.equal(plan.phase, "field");
      assert.equal(plan.activeMarkerId, "harthmere_owner:npc_outpost_brightcart_trader");
      assert.equal(plan.objectiveMet, false);
    });

    it("guides to the pickup spot first when the parcel must be collected", () => {
      const plan = harthmereJobMarkerPlanV151({
        kind: "delivery",
        requirements: [
          { itemId: "courier_pouch", count: 1, recipientNpcId: "npc_outpost_stampspur_dispatcher", pickupMarkerId: "harthmere_bridge_center" },
        ],
        boardMarkerId: BOARD,
        progress: { hasParcel: false },
      });
      assert.equal(plan.phase, "pickup");
      assert.equal(plan.activeMarkerId, "harthmere_bridge_center");
    });

    it("after pickup, guides to the recipient", () => {
      const plan = harthmereJobMarkerPlanV151({
        kind: "delivery",
        requirements: [
          { itemId: "courier_pouch", count: 1, recipientNpcId: "npc_outpost_stampspur_dispatcher", pickupMarkerId: "harthmere_bridge_center" },
        ],
        boardMarkerId: BOARD,
        progress: { hasParcel: true },
      });
      assert.equal(plan.phase, "field");
      assert.equal(plan.activeMarkerId, "harthmere_owner:npc_outpost_stampspur_dispatcher");
    });

    it("flips to the board after handoff", () => {
      const plan = harthmereJobMarkerPlanV151({
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
      const plan = harthmereJobMarkerPlanV151({
        kind: "delivery",
        requirements: [{ itemId: "apple_basket", count: 1, mapMarkerId: "grove_mail_bank_satchel" }],
        boardMarkerId: BOARD,
        progress: { hasParcel: true },
      });
      assert.equal(plan.activeMarkerId, "grove_mail_bank_satchel");
    });
  });

  describe("gather", () => {
    const reqs = [{ itemId: "wild_berries", count: 6, mapMarkerId: "grove_garden_edge_berries" }];

    it("guides to the gather spot with a running count", () => {
      const plan = harthmereJobMarkerPlanV151({
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
      const plan = harthmereJobMarkerPlanV151({
        kind: "gather",
        requirements: reqs,
        boardMarkerId: BOARD,
        progress: { gatheredCount: 6 },
      });
      assert.equal(plan.phase, "return_to_board");
      assert.equal(plan.activeMarkerId, BOARD);
    });

    it("uses DISTINCT messaging for the already-have shortcut", () => {
      const plan = harthmereJobMarkerPlanV151({
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
    const reqs = [{ itemId: "muckwad", count: 5, mapMarkerId: "muckwad_patch" }];

    it("guides to the muck spot with a cleaned count", () => {
      const plan = harthmereJobMarkerPlanV151({
        kind: "cleanup",
        requirements: reqs,
        boardMarkerId: BOARD,
        progress: { cleanedCount: 2, toolEquipped: true },
      });
      assert.equal(plan.phase, "field");
      assert.equal(plan.activeMarkerId, "muckwad_patch");
      assert.equal(plan.currentCount, 2);
      assert.equal(plan.requiredCount, 5);
    });

    it("guides the player to BUY a cleanup tool from the marked vendor when missing", () => {
      const plan = harthmereJobMarkerPlanV151({
        kind: "cleanup",
        requirements: reqs,
        boardMarkerId: BOARD,
        progress: { cleanedCount: 0, toolEquipped: false },
      });
      assert.equal(plan.needsToolAction, "cleanup");
      // Marker points at the tool vendor (a real on-map business owner), not the
      // muck spot, so the player is guided to acquire the tool first.
      assert.equal(plan.activeMarkerId, "harthmere_owner:npc_outpost_clearbarrel_boss");
      assert.ok(/buy/i.test(plan.hint), plan.hint);
    });

    it("flips to the board once enough muck is cleared", () => {
      const plan = harthmereJobMarkerPlanV151({
        kind: "cleanup",
        requirements: reqs,
        boardMarkerId: BOARD,
        progress: { cleanedCount: 5, toolEquipped: true },
      });
      assert.equal(plan.phase, "return_to_board");
      assert.equal(plan.activeMarkerId, BOARD);
    });
  });

  describe("repair", () => {
    it("guides the player to BUY a repair tool from the marked vendor when missing", () => {
      const plan = harthmereJobMarkerPlanV151({
        kind: "repair",
        requirements: [{ itemId: "softwood_log", count: 3, mapMarkerId: "grove_repair_fence", requiredToolAction: "repair" }],
        fieldMarkerId: "grove_repair_fence",
        boardMarkerId: BOARD,
        progress: { repaired: false, toolEquipped: false },
      });
      assert.equal(plan.needsToolAction, "repair");
      assert.equal(plan.activeMarkerId, "harthmere_owner:npc_outpost_hingehall_fixer");
      assert.ok(/buy/i.test(plan.hint), plan.hint);
    });

    it("once the tool is equipped, guides back to the structure", () => {
      const plan = harthmereJobMarkerPlanV151({
        kind: "repair",
        requirements: [{ itemId: "softwood_log", count: 3, mapMarkerId: "grove_repair_fence", requiredToolAction: "repair" }],
        fieldMarkerId: "grove_repair_fence",
        boardMarkerId: BOARD,
        progress: { repaired: false, toolEquipped: true },
      });
      assert.equal(plan.needsToolAction, undefined);
      assert.equal(plan.activeMarkerId, "grove_repair_fence");
    });

    it("flips to the board once repaired", () => {
      const plan = harthmereJobMarkerPlanV151({
        kind: "repair",
        requirements: [{ itemId: "softwood_log", count: 3, mapMarkerId: "grove_repair_fence", requiredToolAction: "repair" }],
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
      const plan = harthmereJobMarkerPlanV151({
        kind: "gather",
        requirements: [{ itemId: "wild_berries", count: 6, mapMarkerId: "grove_garden_edge_berries" }],
        boardMarkerId: BOARD,
        progress: { failed: true, gatheredCount: 2 },
      });
      assert.equal(plan.phase, "failed");
      assert.equal(plan.activeMarkerId, undefined);
      assert.equal(plan.objectiveMet, false);
    });

    it("an escort whose NPC was killed fails with no marker", () => {
      const plan = harthmereJobMarkerPlanV151({
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
      const n = harthmereJobNotificationV151({ jobId: "x", jobTitle: "Escort", nowMs: 100, objectiveMet: true, failed: true });
      assert.equal(n?.kind, "failed");
    });
  });

  describe("escort", () => {
    it("guides to the destination while escorting", () => {
      const plan = harthmereJobMarkerPlanV151({
        kind: "escort",
        fieldMarkerId: "old_grove_road_post",
        boardMarkerId: BOARD,
        progress: {},
      });
      assert.equal(plan.phase, "field");
      assert.equal(plan.activeMarkerId, "old_grove_road_post");
    });

    it("flips to the board once the companion arrives", () => {
      const plan = harthmereJobMarkerPlanV151({
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
      { jobId: "a", kind: "gather", acceptedAtMs: 100, fieldMarkerId: "spot_a" },
      { jobId: "b", kind: "repair", acceptedAtMs: 200, fieldMarkerId: "spot_b" },
      { jobId: "c", kind: "delivery", acceptedAtMs: 150, deadlineAtMs: 50, fieldMarkerId: "spot_c" },
    ];

    it("defaults to the most-recently-accepted active job", () => {
      const picked = harthmereSelectTrackedJobV151(jobs, undefined, 1000);
      assert.equal(picked?.jobId, "b");
    });

    it("honors an explicit tracked job", () => {
      const picked = harthmereSelectTrackedJobV151(jobs, "a", 1000);
      assert.equal(picked?.jobId, "a");
    });

    it("never tracks an expired job (falls back to default)", () => {
      const picked = harthmereSelectTrackedJobV151(jobs, "c", 1000);
      assert.equal(picked?.jobId, "b"); // c is past its deadline
    });

    it("resolves the tracked job's marker plan", () => {
      const out = harthmereTrackedJobMarkerPlanV151({
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
      assert.equal(harthmereSelectTrackedJobV151([], undefined, 1000), undefined);
    });
  });

  describe("ready/expiry notifications", () => {
    it("notifies ready-to-turn-in when the objective is met", () => {
      const n = harthmereJobNotificationV151({ jobId: "a", jobTitle: "Fix the fence", nowMs: 100, objectiveMet: true });
      assert.equal(n?.kind, "ready_to_turn_in");
      assert.ok(/ready/i.test(n!.message));
    });

    it("notifies expired (and expiry beats objective-met)", () => {
      const n = harthmereJobNotificationV151({ jobId: "a", deadlineAtMs: 50, nowMs: 100, objectiveMet: true });
      assert.equal(n?.kind, "expired");
    });

    it("returns undefined while the objective is still in progress", () => {
      assert.equal(
        harthmereJobNotificationV151({ jobId: "a", nowMs: 100, objectiveMet: false }),
        undefined
      );
    });
  });

  describe("default kinds (hunt/craft/etc.)", () => {
    it("guides to the field marker until the objective is met", () => {
      const plan = harthmereJobMarkerPlanV151({
        kind: "hunt",
        fieldMarkerId: "elite_mucker_bounty",
        boardMarkerId: BOARD,
        progress: {},
      });
      assert.equal(plan.phase, "field");
      assert.equal(plan.activeMarkerId, "elite_mucker_bounty");
    });

    it("flips to the board when satisfied", () => {
      const plan = harthmereJobMarkerPlanV151({
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
