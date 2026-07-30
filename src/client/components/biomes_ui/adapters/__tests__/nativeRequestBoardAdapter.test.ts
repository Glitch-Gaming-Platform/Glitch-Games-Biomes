import assert from "assert";

import { getHarthmereAvailableJobsPanel } from "../../../harthmere_jobs_board/jobsBoardLiveAdapter";
import {
  nativeRequestBoardPanelId,
  nativeRequestBoardPostings,
  nativeRequestBoardRecord,
  nativeRequestBoardSnapshot,
  type NativeRequestBoardProgressLookup,
} from "../nativeRequestBoardAdapter";
import {
  HARTHMERE_BOARD_CURRENCY_IDS,
  HARTHMERE_DOCK_FISHING_BOARD,
  HARTHMERE_REQUEST_BOARDS,
  harthmereBoardRequestsFor,
} from "@/shared/harthmere/native_request_boards";
import type { BiomesId } from "@/shared/ids";

/**
 * The four request boards render through the Jobs Board panel the game already
 * has. The property that matters most, and the one these tests exist for, is
 * that a board shows ONLY its own kind of work — all seven Bling bounties share
 * their trigger ids, so board identity is the only thing separating a Farming
 * request from an Industrial one.
 */

function lookup(
  overrides: Partial<{
    completed: number[];
    inProgress: number[];
    introComplete: number[];
    held: number;
  }> = {}
): NativeRequestBoardProgressLookup {
  return {
    completed: new Set(overrides.completed ?? []),
    inProgress: new Set(overrides.inProgress ?? []),
    introComplete: new Set(
      overrides.introComplete ??
        HARTHMERE_REQUEST_BOARDS.map((b) => Number(b.introQuestId))
    ),
    heldCount: () => overrides.held ?? 0,
  };
}

const FISHING = HARTHMERE_REQUEST_BOARDS.find((b) => b.category === "fishing")!;
const FARMING = HARTHMERE_REQUEST_BOARDS.find((b) => b.category === "farming")!;
const INDUSTRIAL = HARTHMERE_REQUEST_BOARDS.find(
  (b) => b.category === "industrial"
)!;
const RESEARCH = HARTHMERE_REQUEST_BOARDS.find(
  (b) => b.category === "research"
)!;

describe("native request board -> BiomesUI jobs board panel", () => {
  describe("board scoping", () => {
    it("shows each board only its own requests", () => {
      for (const board of HARTHMERE_REQUEST_BOARDS) {
        const postings = nativeRequestBoardPostings(board.entityId, lookup());
        const expected = harthmereBoardRequestsFor(board.id).map((r) =>
          Number(r.questId)
        );
        assert.deepEqual(
          postings.map((p) => Number(p.jobId.split(":")[1])).sort(),
          expected.sort(),
          `${board.label} is showing the wrong catalogue`
        );
      }
    });

    it("never leaks a request from one board onto another", () => {
      const seen = new Map<string, string>();
      for (const board of HARTHMERE_REQUEST_BOARDS) {
        for (const posting of nativeRequestBoardPostings(
          board.entityId,
          lookup()
        )) {
          const previous = seen.get(posting.jobId);
          assert.equal(
            previous,
            undefined,
            `${posting.jobId} appears on both ${previous} and ${board.label}`
          );
          seen.set(posting.jobId, board.label);
        }
      }
    });

    it("tags every posting with its own board id", () => {
      for (const board of HARTHMERE_REQUEST_BOARDS) {
        const panelId = nativeRequestBoardPanelId(board.id);
        for (const posting of nativeRequestBoardPostings(
          board.entityId,
          lookup()
        )) {
          assert.equal(posting.boardId, panelId);
        }
      }
    });

    it("survives the panel's own board filter", () => {
      // getHarthmereAvailableJobsPanel filters openJobs by boardId. If the
      // adapter ever mis-tagged a posting, the panel would silently show an
      // empty board rather than the wrong one — so assert both directions.
      for (const board of HARTHMERE_REQUEST_BOARDS) {
        const snapshot = nativeRequestBoardSnapshot({
          boardEntityId: board.entityId,
          actorId: "player",
          lookup: lookup(),
        })!;
        const rows = getHarthmereAvailableJobsPanel(
          snapshot,
          snapshot.defaultBoardId
        );
        assert.equal(
          rows.length,
          snapshot.openJobs.length,
          `${board.label} lost postings to the panel filter`
        );
        assert.ok(rows.length > 0, `${board.label} rendered empty`);
        // A different board's id must yield nothing from this snapshot.
        const other = HARTHMERE_REQUEST_BOARDS.find((b) => b.id !== board.id)!;
        assert.equal(
          getHarthmereAvailableJobsPanel(
            snapshot,
            nativeRequestBoardPanelId(other.id)
          ).length,
          0
        );
      }
    });

    it("accepts exactly one kind of work per board", () => {
      for (const board of HARTHMERE_REQUEST_BOARDS) {
        const record = nativeRequestBoardRecord(board.entityId)!;
        assert.equal(record.acceptedKinds.length, 1);
        assert.equal(record.requiresPhysicalInteraction, true);
      }
      // The three gathering boards share a kind; research is a delivery board.
      assert.equal(
        nativeRequestBoardRecord(RESEARCH.entityId)!.acceptedKinds[0],
        "delivery"
      );
      for (const board of [FISHING, FARMING, INDUSTRIAL]) {
        assert.equal(
          nativeRequestBoardRecord(board.entityId)!.acceptedKinds[0],
          "gather"
        );
      }
    });

    it("returns nothing at all for an unknown entity", () => {
      assert.deepEqual(
        nativeRequestBoardPostings(12345 as BiomesId, lookup()),
        []
      );
      assert.equal(nativeRequestBoardRecord(12345 as BiomesId), undefined);
      assert.equal(
        nativeRequestBoardSnapshot({
          boardEntityId: 12345 as BiomesId,
          actorId: "player",
          lookup: lookup(),
        }),
        undefined
      );
    });
  });

  describe("status projection", () => {
    it("hides listings whose board intro is not done", () => {
      const postings = nativeRequestBoardPostings(
        FARMING.entityId,
        lookup({ introComplete: [] })
      );
      assert.equal(postings.length, 0, "locked listings are on the board");
    });

    it("opens a listing the player has not picked up", () => {
      const postings = nativeRequestBoardPostings(FARMING.entityId, lookup());
      assert.ok(postings.length > 0);
      for (const posting of postings) {
        assert.equal(posting.status, "open");
        assert.equal(posting.acceptedAtMs, undefined);
      }
    });

    it("activates a listing in progress and counts what is left", () => {
      const wheat = harthmereBoardRequestsFor(FARMING.id).find(
        (r) => r.title === "Bounty: Wheat"
      )!;
      const postings = nativeRequestBoardPostings(FARMING.entityId, {
        ...lookup({ inProgress: [Number(wheat.questId)] }),
        heldCount: () => 4,
      });
      const posting = postings.find((p) =>
        p.jobId.endsWith(String(wheat.questId))
      )!;
      assert.equal(posting.status, "active");
      assert.match(posting.description, /6 still needed of 10/);
    });

    it("says when a listing is ready to hand in", () => {
      const wheat = harthmereBoardRequestsFor(FARMING.id).find(
        (r) => r.title === "Bounty: Wheat"
      )!;
      const postings = nativeRequestBoardPostings(FARMING.entityId, {
        ...lookup({ inProgress: [Number(wheat.questId)] }),
        heldCount: () => wheat.count,
      });
      const posting = postings.find((p) =>
        p.jobId.endsWith(String(wheat.questId))
      )!;
      assert.equal(posting.status, "active");
      assert.match(posting.description, /Ready to hand in/);
    });

    it("marks a filled daily listing as reposting", () => {
      const wheat = harthmereBoardRequestsFor(FARMING.id).find(
        (r) => r.title === "Bounty: Wheat"
      )!;
      const postings = nativeRequestBoardPostings(
        FARMING.entityId,
        lookup({ completed: [Number(wheat.questId)] })
      );
      const posting = postings.find((p) =>
        p.jobId.endsWith(String(wheat.questId))
      )!;
      assert.equal(posting.status, "completed");
      assert.match(posting.description, /reposted daily/);
    });

    it("keeps completed listings out of the open column", () => {
      const wheat = harthmereBoardRequestsFor(FARMING.id).find(
        (r) => r.title === "Bounty: Wheat"
      )!;
      const snapshot = nativeRequestBoardSnapshot({
        boardEntityId: FARMING.entityId,
        actorId: "player",
        lookup: lookup({ completed: [Number(wheat.questId)] }),
      })!;
      assert.ok(
        !snapshot.openJobs.some((j) => j.jobId.endsWith(String(wheat.questId)))
      );
      assert.ok(
        !snapshot.activeJobs.some((j) =>
          j.jobId.endsWith(String(wheat.questId))
        )
      );
    });
  });

  describe("payment display", () => {
    it("shows Bling bounties as gold", () => {
      for (const board of [FISHING, FARMING, INDUSTRIAL]) {
        for (const posting of nativeRequestBoardPostings(
          board.entityId,
          lookup()
        )) {
          assert.ok(posting.rewardGold > 0, `${posting.title} pays no gold`);
          assert.equal(posting.rewardItems, undefined);
        }
      }
    });

    it("does not pass Collective Tokens off as gold", () => {
      // Research pays in tokens, which are not currency. Reporting them in the
      // gold column would tell the player they are earning Bling.
      for (const posting of nativeRequestBoardPostings(
        RESEARCH.entityId,
        lookup()
      )) {
        assert.equal(posting.rewardGold, 0);
        assert.equal(posting.rewardItems?.length, 1);
        assert.equal(
          posting.rewardItems![0].itemId,
          String(HARTHMERE_BOARD_CURRENCY_IDS.COLLECTIVE_TOKEN)
        );
      }
    });

    it("never escrows anything, because the player is not the poster", () => {
      for (const board of HARTHMERE_REQUEST_BOARDS) {
        for (const posting of nativeRequestBoardPostings(
          board.entityId,
          lookup()
        )) {
          assert.equal(posting.escrowGold, 0);
          assert.equal(posting.issuerKind, "npc");
        }
      }
    });

    it("leaves the player's own posting collections empty", () => {
      const snapshot = nativeRequestBoardSnapshot({
        boardEntityId: FISHING.entityId,
        actorId: "player",
        lookup: lookup(),
      })!;
      assert.deepEqual(snapshot.myPostedJobs, []);
      assert.equal(snapshot.cooldown.abuseScore, 0);
    });
  });

  describe("the Harthmere quay board", () => {
    it("renders the fishing catalogue under its own panel id", () => {
      const quay = nativeRequestBoardPostings(
        HARTHMERE_DOCK_FISHING_BOARD.entityId,
        lookup()
      );
      const original = nativeRequestBoardPostings(FISHING.entityId, lookup());
      assert.deepEqual(
        quay.map((p) => p.jobId),
        original.map((p) => p.jobId)
      );
      assert.notEqual(quay[0].boardId, original[0].boardId);
      assert.equal(
        quay[0].boardId,
        nativeRequestBoardPanelId(HARTHMERE_DOCK_FISHING_BOARD.id)
      );
    });

    it("locates itself in Harthmere world space, not authored space", () => {
      const record = nativeRequestBoardRecord(
        HARTHMERE_DOCK_FISHING_BOARD.entityId
      )!;
      // The additive town is shifted +1600 on X; an unshifted authored X would
      // put the board on the original map.
      assert.ok(
        record.location.x > 1792,
        `quay board at x=${record.location.x} is on the old map`
      );
      assert.equal(record.location.district, "Waterfront");
    });

    it("is still a fishing board", () => {
      const record = nativeRequestBoardRecord(
        HARTHMERE_DOCK_FISHING_BOARD.entityId
      )!;
      assert.deepEqual(record.acceptedKinds, ["gather"]);
      assert.equal(record.displayName, "Fishing Board");
    });
  });

  describe("snapshot shape", () => {
    it("carries exactly one board record", () => {
      for (const board of HARTHMERE_REQUEST_BOARDS) {
        const snapshot = nativeRequestBoardSnapshot({
          boardEntityId: board.entityId,
          actorId: "player",
          lookup: lookup(),
        })!;
        assert.equal(Object.keys(snapshot.boards).length, 1);
        assert.ok(snapshot.boards[snapshot.defaultBoardId]);
      }
    });

    it("splits open and active without losing or duplicating a posting", () => {
      const requests = harthmereBoardRequestsFor(INDUSTRIAL.id);
      const snapshot = nativeRequestBoardSnapshot({
        boardEntityId: INDUSTRIAL.entityId,
        actorId: "player",
        lookup: lookup({ inProgress: [Number(requests[0].questId)] }),
      })!;
      assert.equal(snapshot.activeJobs.length, 1);
      assert.equal(snapshot.openJobs.length, requests.length - 1);
      const ids = [...snapshot.openJobs, ...snapshot.activeJobs].map(
        (j) => j.jobId
      );
      assert.equal(new Set(ids).size, requests.length);
    });
  });
});
