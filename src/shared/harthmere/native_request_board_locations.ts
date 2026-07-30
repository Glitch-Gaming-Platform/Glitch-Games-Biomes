import type {
  HarthmereJobsBoardJobKind,
  HarthmereJobsBoardRecord,
} from "@/shared/harthmere/mmo_jobs_board_authority";
import {
  HARTHMERE_DOCK_FISHING_BOARD,
  HARTHMERE_REQUEST_BOARDS,
  type HarthmereBoardCategory,
} from "@/shared/harthmere/native_request_boards";
import { shiftHarthmereAuthoredPositionToWorld } from "@/shared/harthmere/coordinate_transform";
import { HARTHMERE_EXTENSION_FEET_Y } from "@/shared/harthmere/world_extension";

/**
 * HARTHMERE_REQUEST_BOARD_LOCATIONS
 *
 * Physical placement for the four snapshot request boards, plus the Harthmere
 * quay Fishing Board, expressed as ordinary `HarthmereJobsBoardRecord`s.
 *
 * WHY IT LIVES IN ITS OWN FILE
 * -----------------------------------------------------------------------
 * `mmo_jobs_board_authority.ts` owns the live player-posting boards and
 * `native_request_boards.ts` owns the authored request catalogue. This is the
 * one seam between them, and keeping it separate is what stops the two
 * authorities from importing each other in a cycle.
 *
 * WHY REGISTER THEM AT ALL
 * -----------------------------------------------------------------------
 * So they use the board UI the game already has. Registering a record here is
 * what gives a board its interaction radius, its map marker and its
 * `HarthmereJobsBoardPanel`; without it every request board would need its own
 * parallel prompt, marker and panel.
 *
 * TWO THINGS ARE DELIBERATELY NARROWED
 * -----------------------------------------------------------------------
 *   * `acceptedKinds` holds exactly ONE kind per board. That is the
 *     authority-level half of "a board only shows its own type of work"; the
 *     catalogue lookup in `nativeRequestBoardAdapter` is the other half.
 *   * `readOnlyRequestBoard` marks them as carrying authored townsfolk
 *     requests rather than a player posting queue. Players fill these boards;
 *     they do not post to them, and nothing is escrowed.
 */

export const HARTHMERE_REQUEST_BOARD_LOCATIONS_VERSION =
  "harthmere-request-board-locations-v1" as const;

/** Board id used by the jobs-board registry and the panel. */
export function harthmereRequestBoardJobsBoardId(boardId: string) {
  return `native_request_board:${boardId}`;
}

/**
 * One kind per board.
 *
 * The three buying boards are gathering work; the Collective's listings are
 * deliveries against a research programme. Narrow on purpose — a board that
 * accepts every kind is the live jobs board, and that already exists.
 */
const CATEGORY_JOB_KIND: Readonly<
  Record<HarthmereBoardCategory, HarthmereJobsBoardJobKind>
> = Object.freeze({
  fishing: "gather",
  farming: "gather",
  industrial: "gather",
  research: "delivery",
});

const CATEGORY_DISTRICT: Readonly<Record<HarthmereBoardCategory, string>> =
  Object.freeze({
    fishing: "Waterfront",
    farming: "Farmland",
    industrial: "Industrial",
    research: "The Grove",
  });

/**
 * Interaction radius.
 *
 * Matches the live boards' own radius rather than inventing a second one, so a
 * player does not learn two different "close enough" distances.
 */
export const HARTHMERE_REQUEST_BOARD_INTERACTION_RADIUS = 4;

export function harthmereRequestBoardJobsBoardLocations(): Record<
  string,
  HarthmereJobsBoardRecord
> {
  const records: Record<string, HarthmereJobsBoardRecord> = {};

  for (const board of HARTHMERE_REQUEST_BOARDS) {
    const boardId = harthmereRequestBoardJobsBoardId(board.id);
    records[boardId] = {
      boardId,
      displayName: board.label,
      // The four snapshot boards stand on the ORIGINAL map, so they belong to
      // the Grove town scope rather than the additive Harthmere town.
      townId: "harthmere_grove",
      regionId: `${board.id}_region`,
      markerId: boardId,
      location: {
        x: board.snapshotPosition[0],
        y: board.snapshotPosition[1],
        z: board.snapshotPosition[2],
        radius: HARTHMERE_REQUEST_BOARD_INTERACTION_RADIUS,
        district: CATEGORY_DISTRICT[board.category],
        landmarkId: boardId,
      },
      acceptedKinds: [CATEGORY_JOB_KIND[board.category]],
      requiresPhysicalInteraction: true,
      createdAtMs: 0,
      readOnlyRequestBoard: true,
    };
  }

  // The Harthmere quay board. Its authored position is shifted through the
  // shared additive transform, exactly like the town's own jobs board, so the
  // marker, the voxel and the authority cannot drift apart.
  const [quayX, quayZ] = HARTHMERE_DOCK_FISHING_BOARD.authoredPosition;
  const quayWorld = shiftHarthmereAuthoredPositionToWorld([
    quayX,
    HARTHMERE_EXTENSION_FEET_Y,
    quayZ,
  ]);
  const quayBoardId = harthmereRequestBoardJobsBoardId(
    HARTHMERE_DOCK_FISHING_BOARD.id
  );
  records[quayBoardId] = {
    boardId: quayBoardId,
    displayName: HARTHMERE_DOCK_FISHING_BOARD.label,
    townId: "harthmere_town",
    regionId: "harthmere_town_waterfront",
    markerId: quayBoardId,
    location: {
      x: quayWorld[0],
      y: quayWorld[1],
      z: quayWorld[2],
      radius: HARTHMERE_REQUEST_BOARD_INTERACTION_RADIUS,
      district: "Harthmere Waterfront",
      landmarkId: quayBoardId,
    },
    acceptedKinds: [CATEGORY_JOB_KIND[HARTHMERE_DOCK_FISHING_BOARD.category]],
    requiresPhysicalInteraction: true,
    createdAtMs: 0,
    readOnlyRequestBoard: true,
  };

  return records;
}

/** Every request board id, for markers and world-object registration. */
export function harthmereRequestBoardJobsBoardIds(): string[] {
  return Object.keys(harthmereRequestBoardJobsBoardLocations());
}
