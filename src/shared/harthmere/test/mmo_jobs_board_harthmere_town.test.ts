/// <reference types="mocha" />
/// <reference types="node" />
//
// HARTHMERE_JOBS_BOARD_HARTHMERE_TOWN tests.
// Cover:
//   - Default state ships both Grove and Harthmere boards.
//   - Each board has a distinct townId, marker, and physical location.
//   - Auto-seeder scoped templates: Grove templates only land on Grove
//     board; Harthmere templates only land on Harthmere board.
//   - Both boards can be seeded in the same tick and produce different jobs.
//   - Harthmere board carries its own monster hunt (Mucker boss tier here).
//   - isActorAtHarthmereJobsBoard recognizes either board by marker or
//     position.
//   - Player postings against the Harthmere board route to that board only.
import assert from "assert";
import {
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
  HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID,
  HARTHMERE_JOBS_BOARD_HARTHMERE_DISPLAY_NAME,
  HARTHMERE_JOBS_BOARD_HARTHMERE_MARKER_ID,
  HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS,
  defaultHarthmereJobsBoardState,
  isActorAtHarthmereJobsBoard,
  reduceHarthmereJobsBoardMutation,
  type HarthmereJobsBoardPosting,
  type HarthmereJobsBoardMutationContext,
  type HarthmereJobsBoardState,
} from "../mmo_jobs_board_authority";
import {
  harthmereJobsBoardQuestMarkerPositionForId,
  unresolvedHarthmereJobsBoardQuestMarkerIds,
} from "../jobs_board_quest_marker_positions";

const NOW = 1_800_000_000_000;

function ctx(overrides: Partial<HarthmereJobsBoardMutationContext> = {}): HarthmereJobsBoardMutationContext {
  return {
    actorGold: 1000,
    actorInventoryItems: {},
    nearbyBoardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
    ...overrides,
  };
}

function seed(state: HarthmereJobsBoardState, boardId: string, nowMs = NOW) {
  return reduceHarthmereJobsBoardMutation(
    state,
    {
      requestId: `seed_${boardId}_${nowMs}`,
      actorId: "economy_seeder",
      nowMs,
      operation: "economy_auto_seed_jobs",
      boardId,
    } as any,
    ctx({ nearbyBoardId: boardId }),
  );
}

describe("mmo_jobs_board_authority — second Harthmere board (current)", () => {
  it("registers both Grove and Harthmere boards in the default state", () => {
    const state = defaultHarthmereJobsBoardState(NOW);
    const grove = state.boards[HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID];
    const harthmere = state.boards[HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID];
    assert.ok(grove, "Grove board should exist");
    assert.ok(harthmere, "Harthmere board should exist");

    assert.equal(grove.displayName, "Jobs Board");
    assert.equal(harthmere.displayName, HARTHMERE_JOBS_BOARD_HARTHMERE_DISPLAY_NAME);
    assert.equal(harthmere.markerId, HARTHMERE_JOBS_BOARD_HARTHMERE_MARKER_ID);
    assert.equal(harthmere.townId, "harthmere_town");
    assert.equal(harthmere.regionId, "harthmere_town_region");

    // The two boards must sit at distinct physical positions.
    assert.notDeepEqual(
      [grove.location.x, grove.location.z],
      [harthmere.location.x, harthmere.location.z],
    );
    assert.equal(harthmere.location.x, 1046);
    assert.equal(harthmere.location.z, -202);
    assert.equal(grove.location.radius, HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS);
    assert.equal(harthmere.location.radius, HARTHMERE_JOBS_BOARD_INTERACTION_RADIUS);
    assert.equal(harthmere.location.district, "Harthmere Market District");
  });

  it("recognizes either board via marker id or actor position", () => {
    const state = defaultHarthmereJobsBoardState(NOW);
    // Grove (default board id)
    assert.equal(isActorAtHarthmereJobsBoard(state, { nearbyBoardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID }), true);
    assert.equal(isActorAtHarthmereJobsBoard(state, { actorPosition: { x: 501.99486179104775, y: 70, z: -132.00350672753194 } }), true);
    // Harthmere (board id passed explicitly)
    assert.equal(
      isActorAtHarthmereJobsBoard(state, { nearbyBoardId: HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID }, HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID),
      true,
    );
    assert.equal(
      isActorAtHarthmereJobsBoard(state, { actorPosition: { x: 1046, y: 65, z: -202 } }, HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID),
      true,
    );
    // Far away — neither board.
    assert.equal(isActorAtHarthmereJobsBoard(state, { actorPosition: { x: -1000, y: 70, z: 0 } }), false);
    assert.equal(
      isActorAtHarthmereJobsBoard(state, { actorPosition: { x: -1000, y: 70, z: 0 } }, HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID),
      false,
    );
  });

  it("auto-seeds Grove templates only on the Grove board and Harthmere templates only on the Harthmere board", () => {
    let state = defaultHarthmereJobsBoardState(NOW);
    for (let i = 0; i < 30; i += 1) {
      state = seed(state, HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID, NOW + i * 1000).jobsBoard;
      state = seed(state, HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID, NOW + i * 1000).jobsBoard;
    }
    const groveJobs = Object.values(state.postings).filter((j) => j.boardId === HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID);
    const harthmereJobs = Object.values(state.postings).filter((j) => j.boardId === HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID);
    assert.ok(groveJobs.length > 0, "expected Grove board to receive jobs");
    assert.ok(harthmereJobs.length > 0, "expected Harthmere board to receive jobs");

    // Grove-internal markers (grove_*, muckwad_patch, old_grove_road_post) must
    // not appear on the Harthmere board. Mosslawn is borderlands and IS shared
    // between the two boards' hunt templates intentionally.
    for (const job of harthmereJobs) {
      if (job.mapMarkerId) {
        assert.ok(
          !/^grove_|^old_grove_road_post$|^muckwad_patch$/.test(job.mapMarkerId),
          `Harthmere board has a Grove-internal marker: ${job.mapMarkerId}`,
        );
      }
    }
    for (const job of groveJobs) {
      if (job.mapMarkerId) {
        assert.ok(
          !/^harthmere_market_office$|^harthmere_chapel_stone$|^harthmere_bridge_center$/.test(job.mapMarkerId),
          `Grove board has a Harthmere-internal marker: ${job.mapMarkerId}`,
        );
      }
    }
  });

  it("the same tick across both boards produces different job ids and titles", () => {
    const a = seed(defaultHarthmereJobsBoardState(NOW), HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID, NOW);
    const b = seed(a.jobsBoard, HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID, NOW);
    const groveTitles = new Set(Object.values(a.jobsBoard.postings).map((j) => j.title));
    const harthmereTitles = new Set(
      Object.values(b.jobsBoard.postings)
        .filter((j) => j.boardId === HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID)
        .map((j) => j.title),
    );
    // Sanity: at least one board produced jobs.
    assert.ok(groveTitles.size > 0);
    assert.ok(harthmereTitles.size > 0);
    // Boards should not surface the same template's title — scopes are
    // disjoint. (Set intersection should be empty.)
    for (const title of groveTitles) {
      assert.equal(harthmereTitles.has(title), false, `title leaked across boards: ${title}`);
    }
  });

  it("auto-seeds at least one Mucker hunt on the Harthmere board with party flag and elevated reward", () => {
    const hunts: HarthmereJobsBoardPosting[] = [];
    for (let i = 0; i < 120 && hunts.length === 0; i += 1) {
      const state = seed(
        defaultHarthmereJobsBoardState(NOW + i * 1000),
        HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID,
        NOW + i * 1000,
      ).jobsBoard;
      hunts.push(
        ...Object.values(state.postings).filter(
          (j) => j.kind === "hunt" && j.boardId === HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID,
        ),
      );
    }
    assert.ok(hunts.length > 0, "Harthmere board should auto-seed at least one hunt");
    for (const hunt of hunts) {
      assert.equal(hunt.partyRecommended, true);
      assert.ok((hunt.partyMinSize ?? 0) >= 3);
      assert.ok(hunt.rewardGold >= 1500, `Harthmere hunt should pay >= 1500 gold, got ${hunt.rewardGold}`);
      assert.ok(["mucker", "hex"].includes(String(hunt.monsterId)));
      assert.ok(
        harthmereJobsBoardQuestMarkerPositionForId(hunt.mapMarkerId),
        `Harthmere hunt marker should resolve: ${hunt.mapMarkerId}`,
      );
    }
  });

  it("resolves every Harthmere auto-seeded field-work marker to a world coordinate", () => {
    let state = defaultHarthmereJobsBoardState(NOW);
    for (let i = 0; i < 40; i += 1) {
      state = seed(
        state,
        HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID,
        NOW + i * 1000,
      ).jobsBoard;
    }
    const markerIds = Object.values(state.postings)
      .filter(
        (job) => job.boardId === HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID,
      )
      .map((job) => job.mapMarkerId)
      .filter((markerId): markerId is string => Boolean(markerId));
    assert.deepEqual(unresolvedHarthmereJobsBoardQuestMarkerIds(markerIds), []);
    for (const markerId of markerIds) {
      const marker = harthmereJobsBoardQuestMarkerPositionForId(markerId);
      assert.ok(marker, `expected marker ${markerId} to resolve`);
      assert.notDeepEqual(
        marker!.position,
        [482, 66, -198],
        `Harthmere marker ${markerId} must not use the old placeholder`,
      );
    }
  });

  it("player-posted jobs against the Harthmere board are scoped to that board only", () => {
    const result = reduceHarthmereJobsBoardMutation(
      defaultHarthmereJobsBoardState(NOW),
      {
        requestId: "player_post_harthmere",
        actorId: "poster",
        nowMs: NOW,
        operation: "create_job_posting",
        boardId: HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID,
        title: "Mason needed for chapel stone",
        description: "Need a steady hand for a quick repair.",
        kind: "repair",
        requirements: [{ itemId: "rough_stone", count: 2, mapMarkerId: "harthmere_chapel_stone" }],
        rewardGold: 90,
        deadlineAtMs: NOW + 24 * 60 * 60 * 1000,
        requiresFieldWork: true,
      } as any,
      ctx({ nearbyBoardId: HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID }),
    );
    const job = Object.values(result.jobsBoard.postings)[0];
    assert.ok(job);
    assert.equal(job.boardId, HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID);
    assert.equal(job.townId, "harthmere_town");
    assert.equal(job.regionId, "harthmere_town_region");
  });

  it("client snapshot exposes both boards for physical-board routing", () => {
    const seeded = seed(
      seed(defaultHarthmereJobsBoardState(NOW), HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID, NOW).jobsBoard,
      HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID,
      NOW,
    );
    const boards = Object.values(seeded.jobsBoard.boards);
    assert.ok(boards.length >= 2, "snapshot should carry both boards");
    const boardIds = new Set(boards.map((b) => b.boardId));
    assert.ok(boardIds.has(HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID));
    assert.ok(boardIds.has(HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID));
  });
});
