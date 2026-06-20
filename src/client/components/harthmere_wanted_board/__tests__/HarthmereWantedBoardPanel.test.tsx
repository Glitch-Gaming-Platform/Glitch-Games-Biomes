import assert from "assert";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
  normalizeHarthmereJobsBoardSnapshot,
} from "@/client/components/harthmere_jobs_board/jobsBoardLiveAdapter";
import {
  HarthmereWantedBoardPanel,
  nextHarthmereWantedBoardGridIndexForKey,
  nextHarthmereWantedBoardTabForKey,
} from "../HarthmereWantedBoardPanel";
import { buildHarthmereWantedBoardView } from "../wantedBoardLiveAdapter";

const NOW = 1_800_000_000_000;

function viewFixture() {
  const snapshot = normalizeHarthmereJobsBoardSnapshot({
    version: "harthmere-jobs-board-authority",
    actorId: "panel_actor",
    defaultBoardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
    boards: {
      [HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID]: {
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        displayName: "Jobs Board",
        townId: "harthmere_grove",
        regionId: "harthmere_grove_region",
        markerId: "harthmere_market_posting_board",
        location: {
          x: 0,
          y: 0,
          z: 0,
          radius: 3.25,
          district: "The Grove",
          landmarkId: "harthmere_market_posting_board",
        },
        acceptedKinds: ["hunt"],
        requiresPhysicalInteraction: true,
      },
    },
    openJobs: [
      {
        jobId: "panel_bounty",
        boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
        issuerKind: "town",
        issuerId: "city_guard",
        title: "Elite Mucker Bounty",
        description: "Track the Elite Mucker.",
        kind: "hunt",
        requirements: [{ targetName: "Elite Mucker" }],
        rewardGold: 220,
        escrowGold: 220,
        status: "open",
        townId: "harthmere_grove",
        regionId: "harthmere_grove_region",
        createdAtMs: NOW,
        deadlineAtMs: NOW + 86_400_000,
        requiresFieldWork: true,
        abuseFlags: [],
        logs: [],
      },
    ],
    activeJobs: [],
    myPostedJobs: [],
    myAcceptedJobs: [],
    myTodos: [],
    audit: [],
    cooldown: { abuseScore: 0 },
    safety: { requiresPhysicalBoardInteraction: true },
    lawSummary: {
      actorId: "panel_actor",
      standing: { scopeId: "city_guard", likeability: 1, legal: 2, notoriety: 3 },
      fines: {},
      flags: {},
      activeBounties: [],
      myActiveBounties: [],
      totalBountyGold: 0,
      myTotalBountyGold: 0,
      recentCrimeRecords: [],
    },
  });
  return buildHarthmereWantedBoardView(snapshot, undefined, NOW);
}

describe("HarthmereWantedBoardPanel", () => {
  it("SSR-renders Biomes-style wanted-board chrome and live bounty actions", () => {
    const html = renderToStaticMarkup(
      <HarthmereWantedBoardPanel
        view={viewFixture()}
        statusLine="Live wanted notices"
      />
    );
    assert.ok(html.includes("Wanted Board"));
    assert.ok(html.includes("Elite Mucker Bounty"));
    assert.ok(html.includes("Accept Bounty"));
    assert.ok(html.includes('data-pointer-lock-policy="unlock-while-open"'));
    assert.ok(html.includes('data-mouse-policy="show-while-open"'));
    assert.ok(html.includes('data-keyboard-navigation="tabs-grid-escape"'));
    assert.ok(html.includes("Bounties 1"));
    assert.ok(html.includes("Watch"));
  });

  it("plans tab and grid keyboard movement without wrapping action focus unexpectedly", () => {
    assert.equal(
      nextHarthmereWantedBoardTabForKey("bounties", "ArrowRight"),
      "mine"
    );
    assert.equal(
      nextHarthmereWantedBoardTabForKey("bounties", "ArrowLeft"),
      "law"
    );
    assert.equal(
      nextHarthmereWantedBoardGridIndexForKey({
        key: "ArrowDown",
        currentIndex: 0,
        itemCount: 5,
        columns: 2,
      }),
      2
    );
    assert.equal(
      nextHarthmereWantedBoardGridIndexForKey({
        key: "End",
        currentIndex: 1,
        itemCount: 5,
        columns: 3,
      }),
      4
    );
  });
});

