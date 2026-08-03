import assert from "assert";

import {
  HARTHMERE_JOBS_BOARD_LOCATIONS,
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
} from "@/shared/harthmere/mmo_jobs_board_authority";
import {
  HARTHMERE_REQUEST_BOARD_INTERACTION_RADIUS,
  harthmereRequestBoardJobsBoardId,
  harthmereRequestBoardJobsBoardIds,
  harthmereRequestBoardJobsBoardLocations,
  harthmereRequestBoardPhysicalPromptRecords,
  nearestHarthmereRequestBoardPhysicalPrompt,
} from "@/shared/harthmere/native_request_board_locations";
import {
  HARTHMERE_DOCK_FISHING_BOARD,
  HARTHMERE_REQUEST_BOARDS,
} from "@/shared/harthmere/native_request_boards";
import { HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X } from "@/shared/harthmere/world_extension";
import { harthmereRiverContains } from "@/shared/harthmere/harthmere_river";

/**
 * The request boards are physical boards using the game's existing board UI.
 * These assertions cover the registry seam: that they appear alongside the
 * live jobs boards, that each is narrowed to its own single kind of work, and
 * that none of them turns into a player posting queue.
 */
describe("request boards in the jobs-board registry", () => {
  const records = harthmereRequestBoardJobsBoardLocations();

  it("registers all four snapshot boards plus the Harthmere quay board", () => {
    assert.equal(Object.keys(records).length, 5);
    for (const board of HARTHMERE_REQUEST_BOARDS) {
      assert.ok(
        records[harthmereRequestBoardJobsBoardId(board.id)],
        `${board.label} is not registered`
      );
    }
    assert.ok(
      records[harthmereRequestBoardJobsBoardId(HARTHMERE_DOCK_FISHING_BOARD.id)]
    );
  });

  it("appears in the shared registry the panel reads", () => {
    for (const boardId of harthmereRequestBoardJobsBoardIds()) {
      assert.ok(
        HARTHMERE_JOBS_BOARD_LOCATIONS[boardId],
        `${boardId} never reached HARTHMERE_JOBS_BOARD_LOCATIONS`
      );
    }
  });

  it("does not disturb the existing live jobs boards", () => {
    assert.ok(
      HARTHMERE_JOBS_BOARD_LOCATIONS[HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID]
    );
    assert.equal(
      HARTHMERE_JOBS_BOARD_LOCATIONS[HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID]
        .readOnlyRequestBoard,
      undefined,
      "the live Grove board was turned into a request board"
    );
  });

  it("accepts exactly one kind of work per board", () => {
    // This is the authority-level half of "only that board's requests". A
    // board that accepted every kind would be the live jobs board, and that
    // already exists.
    for (const record of Object.values(records)) {
      assert.equal(
        record.acceptedKinds.length,
        1,
        `${record.displayName} accepts ${record.acceptedKinds.length} kinds`
      );
    }
    const research = records[
      harthmereRequestBoardJobsBoardId("collective_research_board")
    ];
    assert.deepEqual(research.acceptedKinds, ["delivery"]);
    for (const id of ["fishing_board", "farming_bounties_board", "industrial_job_board"]) {
      assert.deepEqual(
        records[harthmereRequestBoardJobsBoardId(id)].acceptedKinds,
        ["gather"]
      );
    }
  });

  it("marks every one of them read-only", () => {
    // Players fill these boards; they do not post to them, and nothing is
    // escrowed. Without the flag the live authority would happily accept a
    // player posting onto a townsfolk board.
    for (const record of Object.values(records)) {
      assert.equal(record.readOnlyRequestBoard, true);
      assert.equal(record.requiresPhysicalInteraction, true);
    }
  });

  it("gives every board a distinct id, marker and landmark", () => {
    const ids = Object.values(records).map((r) => r.boardId);
    assert.equal(new Set(ids).size, ids.length);
    const markers = Object.values(records).map((r) => r.markerId);
    assert.equal(new Set(markers).size, markers.length);
    for (const record of Object.values(records)) {
      assert.ok(record.markerId.length > 0);
      assert.ok(record.location.landmarkId.length > 0);
    }
  });

  it("uses one interaction radius, not a second one to learn", () => {
    for (const record of Object.values(records)) {
      assert.equal(
        record.location.radius,
        HARTHMERE_REQUEST_BOARD_INTERACTION_RADIUS
      );
    }
  });

  it("drives the visible renderer and F prompt from the same five anchors", () => {
    const prompts = harthmereRequestBoardPhysicalPromptRecords();
    assert.equal(prompts.length, 5);
    assert.deepEqual(
      prompts.map((prompt) => prompt.boardId).sort(),
      Object.keys(records).sort()
    );
    for (const prompt of prompts) {
      const record = records[prompt.boardId];
      assert.deepEqual(prompt.position, {
        x: record.location.x,
        y: record.location.y,
        z: record.location.z,
      });
      assert.equal(prompt.radius, record.location.radius);
      assert.equal(
        nearestHarthmereRequestBoardPhysicalPrompt(prompt.position)?.boardId,
        prompt.boardId
      );
      assert.equal(
        nearestHarthmereRequestBoardPhysicalPrompt({
          x: prompt.position.x + prompt.radius + 0.01,
          z: prompt.position.z,
        })?.boardId,
        undefined
      );
    }
  });

  it("keeps the snapshot boards on the original map", () => {
    for (const board of HARTHMERE_REQUEST_BOARDS) {
      const record = records[harthmereRequestBoardJobsBoardId(board.id)];
      assert.deepEqual(
        [record.location.x, record.location.y, record.location.z],
        [...board.snapshotPosition],
        `${board.label} drifted from its snapshot position`
      );
    }
  });

  it("shifts the quay board into Harthmere world space", () => {
    const record =
      records[harthmereRequestBoardJobsBoardId(HARTHMERE_DOCK_FISHING_BOARD.id)];
    // Authored X 613 without the additive shift would land on the old map.
    assert.ok(
      record.location.x > HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X,
      `quay board at x=${record.location.x} is on the old map`
    );
    assert.equal(record.townId, "harthmere_town");
    assert.equal(record.location.district, "Harthmere Waterfront");
  });

  it("stands the quay board on dry land within reach of the water", () => {
    const [x, z] = HARTHMERE_DOCK_FISHING_BOARD.authoredPosition;
    assert.equal(harthmereRiverContains(x, z), false);
    let nearest = Infinity;
    for (let dx = -12; dx <= 12; dx += 1) {
      for (let dz = -12; dz <= 12; dz += 1) {
        if (harthmereRiverContains(x + dx, z + dz)) {
          nearest = Math.min(nearest, Math.hypot(dx, dz));
        }
      }
    }
    assert.ok(nearest <= 8, `the quay board is ${nearest.toFixed(1)} from water`);
  });
});
