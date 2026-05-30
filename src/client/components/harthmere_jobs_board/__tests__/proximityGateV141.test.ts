/// <reference types="mocha" />
/// <reference types="node" />
//
// HARTHMERE_JOBS_BOARD_PROXIMITY_GATE_V141 tests.
// Cover:
//   - nearestPhysicalHarthmereJobsBoardIdV141 returns the boardId only when
//     the player is inside the board's radius.
//   - Explicit `nearbyBoardId` takes priority over distance calculations.
//   - Wayfinding hints are sorted by distance and include world position.
//   - When no snapshot is supplied the helpers return safe defaults.
import assert from "assert";
import {
  HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS_V145,
  listHarthmereJobsBoardWayfindingHintsV141,
  nearestHarthmereJobsBoardPhysicalPromptV141,
  nearestPhysicalHarthmereJobsBoardIdV141,
  type HarthmereJobsBoardSnapshotV1,
} from "../jobsBoardLiveAdapter";

const FIXTURE: HarthmereJobsBoardSnapshotV1 = {
  version: "test",
  actorId: "player_a",
  defaultBoardId: "harthmere_grove_market_jobs_board",
  boards: {
    harthmere_grove_market_jobs_board: {
      boardId: "harthmere_grove_market_jobs_board",
      displayName: "Jobs Board",
      townId: "harthmere_grove",
      regionId: "harthmere_grove_region",
      markerId: "harthmere_market_posting_board",
      location: {
        x: 501.99486179104775, y: 70, z: -132.00350672753194, radius: HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS_V145,
        district: "The Grove",
        landmarkId: "harthmere_market_posting_board",
      },
      acceptedKinds: [],
      requiresPhysicalInteraction: true,
    },
    harthmere_town_market_jobs_board: {
      boardId: "harthmere_town_market_jobs_board",
      displayName: "Harthmere Town Jobs Board",
      townId: "harthmere_town",
      regionId: "harthmere_town_region",
      markerId: "harthmere_town_market_posting_board",
      location: {
        x: 1046, y: 65, z: -202, radius: HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS_V145,
        district: "Harthmere Market District",
        landmarkId: "harthmere_town_market_posting_board",
      },
      acceptedKinds: [],
      requiresPhysicalInteraction: true,
    },
  },
  openJobs: [],
  activeJobs: [],
  myPostedJobs: [],
  myAcceptedJobs: [],
  myTodos: [],
  audit: [],
  cooldown: { abuseScore: 0 },
  safety: {
    minRewardGold: 5,
    maxRewardGold: 5000,
    maxActivePostingsPerIssuer: 12,
    maxActiveAcceptedPerSeeker: 6,
    requiresPhysicalBoardInteraction: true,
  },
};

describe("harthmere_jobs_board proximity gate (V141)", () => {
  it("returns the Grove board id when the player is inside its radius", () => {
    const id = nearestPhysicalHarthmereJobsBoardIdV141(FIXTURE, { playerPosition: { x: 503, y: 70, z: -131 } });
    assert.equal(id, "harthmere_grove_market_jobs_board");
  });

  it("returns the Harthmere board id when the player is inside its radius", () => {
    const id = nearestPhysicalHarthmereJobsBoardIdV141(FIXTURE, { playerPosition: { x: 1044, y: 66, z: -204 } });
    assert.equal(id, "harthmere_town_market_jobs_board");
  });

  it("shows the physical F prompt only when the player is next to the board", () => {
    const prompt = nearestHarthmereJobsBoardPhysicalPromptV141({
      x: 503.5,
      y: 70,
      z: -132.00350672753194,
    });
    assert.equal(prompt?.boardId, "harthmere_grove_market_jobs_board");
    assert.equal(prompt?.displayName, "Jobs Board");
  });

  it("does not show the physical prompt from across the fountain", () => {
    const prompt = nearestHarthmereJobsBoardPhysicalPromptV141({
      x: 501.99486179104775 + HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS_V145 + 0.25,
      y: 70,
      z: -132.00350672753194,
    });
    assert.equal(prompt, undefined);
  });

  it("returns undefined when the player is far from every board (the proximity gate refuses)", () => {
    const id = nearestPhysicalHarthmereJobsBoardIdV141(FIXTURE, { playerPosition: { x: -1000, y: 70, z: 0 } });
    assert.equal(id, undefined);
  });

  it("returns undefined when the player position is missing", () => {
    const id = nearestPhysicalHarthmereJobsBoardIdV141(FIXTURE, {});
    assert.equal(id, undefined);
  });

  it("honors an explicit nearbyBoardId regardless of distance", () => {
    const id = nearestPhysicalHarthmereJobsBoardIdV141(FIXTURE, {
      nearbyBoardId: "harthmere_town_market_jobs_board",
      playerPosition: { x: -9999, y: 0, z: 9999 },
    });
    assert.equal(id, "harthmere_town_market_jobs_board");
  });

  it("ignores an unknown nearbyBoardId and falls back to distance", () => {
    const id = nearestPhysicalHarthmereJobsBoardIdV141(FIXTURE, {
      nearbyBoardId: "not_a_board",
      playerPosition: { x: 1046, y: 65, z: -202 },
    });
    assert.equal(id, "harthmere_town_market_jobs_board");
  });

  it("returns undefined when no snapshot is provided", () => {
    const id = nearestPhysicalHarthmereJobsBoardIdV141(undefined, { playerPosition: { x: 501.99486179104775, y: 70, z: -132.00350672753194 } });
    assert.equal(id, undefined);
  });

  it("returns wayfinding hints sorted by distance with world positions for each board", () => {
    const hints = listHarthmereJobsBoardWayfindingHintsV141(FIXTURE, { playerPosition: { x: 0, y: 0, z: 0 } });
    assert.equal(hints.length, 2);
    // Grove is closer to origin than Harthmere.
    assert.equal(hints[0].boardId, "harthmere_grove_market_jobs_board");
    assert.equal(hints[1].boardId, "harthmere_town_market_jobs_board");
    assert.ok(hints[0].approxDistanceMeters < hints[1].approxDistanceMeters);
    assert.deepEqual(hints[0].position, { x: 501.99486179104775, y: 70, z: -132.00350672753194 });
    assert.deepEqual(hints[1].position, { x: 1046, y: 65, z: -202 });
  });

  it("returns hints with Infinity distance when no player position is supplied", () => {
    const hints = listHarthmereJobsBoardWayfindingHintsV141(FIXTURE, {});
    assert.equal(hints.length, 2);
    for (const hint of hints) {
      assert.equal(Number.isFinite(hint.approxDistanceMeters), false);
    }
  });

  it("returns an empty list when no snapshot is provided", () => {
    const hints = listHarthmereJobsBoardWayfindingHintsV141(undefined, { playerPosition: { x: 0, y: 0, z: 0 } });
    assert.deepEqual(hints, []);
  });
});
