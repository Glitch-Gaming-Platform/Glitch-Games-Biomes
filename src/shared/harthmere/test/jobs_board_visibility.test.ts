/// <reference types="mocha" />
/// <reference types="node" />
//
// HARTHMERE_JOBS_BOARD_VISIBILITY_FIX tests.
//
// Background: the player reported the map pointer told them the Grove jobs
// board was here, but when they walked to the location they saw nothing.
// The cause was a Y-mismatch — the world-map pin (`SNAPSHOT_GROVE_MARKER_Y`
// = 54) and the rendered voxel kiosk (default `GROUND_Y` = 53) were both
// pinned to the authored generator height, while the live installed snapshot
// terrain in The Grove sits at y=69 (`SNAPSHOT_GROVE_LIVE_WORLD_GROUND_Y`).
// The marker, the kiosk, and the player all need to share the same column.
//
// These tests guard the fix at the data layer:
//   1. The Grove jobs board landmark in `SNAPSHOT_GROVE_LANDMARKS` must
//      sit on the live snapshot Y, not the authored one.
//   2. The Harthmere town board must continue to sit on the live marker Y
//      (it was already using `snapshotGroveMarkerPosition`).
//   3. The proximity-gate / authority Y values agree with the marker Y so
//      "Press F to open the board" fires exactly where the pin says.
import assert from "assert";

import {
  SNAPSHOT_GROVE_LANDMARKS,
  SNAPSHOT_GROVE_LIVE_MARKER_Y,
  SNAPSHOT_GROVE_LIVE_WORLD_GROUND_Y,
  SNAPSHOT_GROVE_MARKER_Y,
} from "@/shared/harthmere/snapshot_grove_content";
import {
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
  HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID,
  HARTHMERE_JOBS_BOARD_HARTHMERE_POSITION,
  defaultHarthmereJobsBoardState,
  isActorAtHarthmereJobsBoard,
} from "@/shared/harthmere/mmo_jobs_board_authority";

describe("Harthmere jobs board visibility fix (current)", () => {
  it("places the Grove jobs board landmark on the live snapshot terrain, not the authored generator", () => {
    const marker = SNAPSHOT_GROVE_LANDMARKS.find(
      (m) => m.id === "harthmere_market_posting_board",
    );
    assert.ok(marker, "Grove jobs board landmark must exist in snapshot content");
    // HARTHMERE_JOBS_BOARD_GROVE_RELOCATION: snapped to the player's
    // reported feet position so pin and kiosk share a column.
    assert.equal(marker?.position[0], 501.99486179104775);
    assert.equal(marker?.position[2], -132.00350672753194);
    // Critical: the marker Y must be the LIVE marker Y, not the authored one.
    // Before the fix this was 54 (authored), causing the pin to render
    // underground beneath the y=69 live Grove plaza.
    assert.equal(
      marker?.position[1],
      SNAPSHOT_GROVE_LIVE_MARKER_Y,
      `Grove board marker Y should be ${SNAPSHOT_GROVE_LIVE_MARKER_Y} (live), not ${SNAPSHOT_GROVE_MARKER_Y} (authored)`,
    );
    assert.ok(
      (marker?.position[1] ?? 0) > SNAPSHOT_GROVE_LIVE_WORLD_GROUND_Y,
      "Marker Y must be above live ground so the pin is visible from the surface",
    );
    assert.equal(marker?.kind, "interactable");
    assert.equal(marker?.visibleOnWorldMap, true);
    assert.deepEqual(marker?.questIds, ["read-the-jobs-board"]);
  });

  it("places the Harthmere town jobs board marker above live ground", () => {
    const marker = SNAPSHOT_GROVE_LANDMARKS.find(
      (m) => m.id === "harthmere_town_market_posting_board",
    );
    assert.ok(marker, "Harthmere town jobs board landmark must exist in snapshot content");
    assert.deepEqual(marker?.position, [
      HARTHMERE_JOBS_BOARD_HARTHMERE_POSITION[0],
      marker?.position[1],
      HARTHMERE_JOBS_BOARD_HARTHMERE_POSITION[2],
    ]);
    assert.ok(
      (marker?.position[1] ?? 0) > HARTHMERE_JOBS_BOARD_HARTHMERE_POSITION[1],
      "Harthmere town board map marker must sit above its extension feet position",
    );
    assert.equal(marker?.kind, "interactable");
    assert.equal(marker?.visibleOnWorldMap, true);
  });

  it("keeps both boards interactable from the player's live-terrain feet position", () => {
    const state = defaultHarthmereJobsBoardState(0);
    // A player standing at the Grove board's XZ, with their feet on the live
    // Grove ground (y=70), must register as "at the Grove board".
    assert.equal(
      isActorAtHarthmereJobsBoard(state, {
        actorPosition: {
          x: 501.99486179104775,
          y: SNAPSHOT_GROVE_LIVE_WORLD_GROUND_Y + 1,
          z: -132.00350672753194,
        },
      }),
      true,
      "Player at the rendered Grove kiosk should be inside the proximity gate",
    );
    // And at Harthmere town board.
    assert.equal(
      isActorAtHarthmereJobsBoard(
        state,
        {
          actorPosition: {
            x: HARTHMERE_JOBS_BOARD_HARTHMERE_POSITION[0],
            y: HARTHMERE_JOBS_BOARD_HARTHMERE_POSITION[1],
            z: HARTHMERE_JOBS_BOARD_HARTHMERE_POSITION[2],
          },
        },
        HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID,
      ),
      true,
      "Player at the rendered Harthmere kiosk should be inside the proximity gate",
    );
  });

  it("keeps the Grove board's authority Y aligned with the live snapshot terrain", () => {
    const state = defaultHarthmereJobsBoardState(0);
    const grove = state.boards[HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID];
    assert.ok(grove);
    // The authority's board Y must not regress to the authored generator
    // height. We allow a small live-terrain tolerance window above ground.
    assert.ok(
      grove.location.y >= SNAPSHOT_GROVE_LIVE_WORLD_GROUND_Y,
      `Grove board location.y (${grove.location.y}) must be at or above live ground (${SNAPSHOT_GROVE_LIVE_WORLD_GROUND_Y})`,
    );
  });

  it("uses distinct landmarks for the two boards so they cannot collide on the world map", () => {
    const grove = SNAPSHOT_GROVE_LANDMARKS.find(
      (m) => m.id === "harthmere_market_posting_board",
    );
    const harthmere = SNAPSHOT_GROVE_LANDMARKS.find(
      (m) => m.id === "harthmere_town_market_posting_board",
    );
    assert.ok(grove && harthmere);
    assert.notDeepEqual(
      [grove?.position[0], grove?.position[2]],
      [harthmere?.position[0], harthmere?.position[2]],
    );
  });
});
