import type {
  HarthmereJobsBoardJobKind,
  HarthmereJobsBoardPosting,
  HarthmereJobsBoardRecord,
  HarthmereJobsBoardSnapshot,
  HarthmereJobsBoardStatus,
} from "../../harthmere_jobs_board/jobsBoardLiveAdapter";
import {
  HARTHMERE_BOARD_CURRENCY_IDS,
  HARTHMERE_DOCK_FISHING_BOARD,
  HARTHMERE_REQUEST_BOARDS,
  harthmereBoardRequestRemaining,
  harthmereBoardRequestState,
  harthmereBoardRequestsForEntity,
  harthmereRequestBoardByEntityId,
  harthmereRequestBoardPhysicalPosition,
  type HarthmereBoardCategory,
  type HarthmereBoardRequest,
  type HarthmereBoardRequestProgress,
} from "@/shared/harthmere/native_request_boards";
import { shiftHarthmereAuthoredPositionToWorld } from "@/shared/harthmere/coordinate_transform";
import { HARTHMERE_EXTENSION_FEET_Y } from "@/shared/harthmere/world_extension";
import type { BiomesId } from "@/shared/ids";

/**
 * NATIVE_REQUEST_BOARD_ADAPTER
 *
 * Renders the four original-snapshot request boards through the Jobs Board
 * panel the game already has, instead of inventing a second board UI.
 *
 * `HarthmereJobsBoardPanel` is driven entirely by a
 * `HarthmereJobsBoardSnapshot` plus a `boardId`, and it already scopes itself:
 * `getHarthmereAvailableJobsPanel` filters `openJobs` by `job.boardId ===
 * boardId`. So the whole job here is to project native ECS quest state into
 * that snapshot shape with the right `boardId` on every posting — and the
 * panel's existing filter does the rest.
 *
 * THE SCOPING RULE
 * -----------------------------------------------------------------------
 * A board shows ONLY its own category's requests. That is enforced twice on
 * purpose:
 *
 *   1. `harthmereBoardRequestsForEntity` only ever returns the catalogue for
 *      the board's own category, so nothing else is projected in the first
 *      place;
 *   2. every posting carries that board's `boardId`, so the panel's own filter
 *      would drop a stray one anyway.
 *
 * The belt-and-braces matters because all seven Bling bounties share their
 * trigger ids (see `native_request_boards.ts`). Board identity is the only
 * thing separating a Farming bounty from an Industrial one, so it has to be
 * carried explicitly rather than derived from a leaf.
 *
 * WHAT THIS ADAPTER IS NOT
 * -----------------------------------------------------------------------
 * It is a read-only projection. Accepting and turning in a request happen
 * through the native ECS trigger engine exactly as they do for every other
 * snapshot quest — the player talks to the board entity and the authored
 * `challengeClaimRewards` leaves fire. Nothing here writes state, so the panel
 * cannot drift into becoming a second quest authority.
 */

export const NATIVE_REQUEST_BOARD_ADAPTER_VERSION =
  "native-request-board-adapter-v1" as const;

/** Stable board ids for the panel, distinct from the live jobs boards'. */
export function nativeRequestBoardPanelId(boardId: string) {
  return `native_request_board:${boardId}`;
}

/** The panel's job-kind vocabulary, mapped from a board's category. */
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

export interface NativeRequestBoardProgressLookup {
  /** Quest ids the player has completed. */
  readonly completed: ReadonlySet<number>;
  /** Quest ids the player has picked up and not yet finished. */
  readonly inProgress: ReadonlySet<number>;
  /** Board intro quests the player has completed. */
  readonly introComplete: ReadonlySet<number>;
  /** How many of a request's item the player is carrying. */
  readonly heldCount: (itemId: BiomesId) => number;
}

function progressFor(
  request: HarthmereBoardRequest,
  introQuestId: BiomesId,
  lookup: NativeRequestBoardProgressLookup
): HarthmereBoardRequestProgress {
  return {
    introComplete: lookup.introComplete.has(Number(introQuestId)),
    pickedUp: lookup.inProgress.has(Number(request.questId)),
    heldCount: Math.max(0, lookup.heldCount(request.itemId) || 0),
    turnedIn: lookup.completed.has(Number(request.questId)),
  };
}

/**
 * A request's status in the panel's vocabulary.
 *
 * `locked` has no panel equivalent — a listing the player cannot see yet
 * simply is not on the board — so those are filtered out rather than shown
 * greyed, which is how the authored `unlock` trees already behave.
 */
function postingStatus(
  request: HarthmereBoardRequest,
  progress: HarthmereBoardRequestProgress
): HarthmereJobsBoardStatus | undefined {
  switch (harthmereBoardRequestState(request, progress)) {
    case "locked":
      return undefined;
    case "available":
      return "open";
    case "in_progress":
    case "ready_to_turn_in":
      return "active";
    case "completed":
      return "completed";
  }
}

function requestDescription(
  request: HarthmereBoardRequest,
  progress: HarthmereBoardRequestProgress
): string {
  const state = harthmereBoardRequestState(request, progress);
  if (state === "ready_to_turn_in") {
    return `Ready to hand in. Return ${request.count} to the board to collect ${request.payCount}.`;
  }
  if (state === "in_progress") {
    const remaining = harthmereBoardRequestRemaining(
      request,
      progress.heldCount
    );
    return `${remaining} still needed of ${request.count}.`;
  }
  if (state === "completed") {
    return request.cadence === "daily"
      ? "Filled. This listing is reposted daily."
      : "Filled.";
  }
  return `Wanted: ${request.count}. Pays ${request.payCount}.`;
}

/**
 * Project one board's requests into panel postings.
 *
 * Every posting carries this board's own `boardId`, which is what keeps a
 * Fishing request off the Farming board.
 */
export function nativeRequestBoardPostings(
  boardEntityId: BiomesId,
  lookup: NativeRequestBoardProgressLookup,
  nowMs = Date.now()
): HarthmereJobsBoardPosting[] {
  const board =
    harthmereRequestBoardByEntityId(boardEntityId) ??
    (Number(boardEntityId) === Number(HARTHMERE_DOCK_FISHING_BOARD.entityId)
      ? HARTHMERE_REQUEST_BOARDS.find((entry) => entry.category === "fishing")
      : undefined);
  if (!board) return [];

  const panelBoardId = nativeRequestBoardPanelId(
    Number(boardEntityId) === Number(HARTHMERE_DOCK_FISHING_BOARD.entityId)
      ? HARTHMERE_DOCK_FISHING_BOARD.id
      : board.id
  );

  const postings: HarthmereJobsBoardPosting[] = [];
  for (const request of harthmereBoardRequestsForEntity(boardEntityId)) {
    const progress = progressFor(request, board.introQuestId, lookup);
    const status = postingStatus(request, progress);
    if (status === undefined) continue;
    const isBling = request.payItemId === HARTHMERE_BOARD_CURRENCY_IDS.BLING;
    postings.push({
      jobId: `native_request:${request.questId}`,
      boardId: panelBoardId,
      // These are townsfolk requests, not player postings. `npc` keeps the
      // panel from offering the poster-only controls (cancel, edit escrow).
      issuerKind: "npc",
      issuerId: String(board.entityId),
      title: request.title,
      description: requestDescription(request, progress),
      kind: CATEGORY_JOB_KIND[board.category],
      requirements: [
        {
          itemId: String(request.itemId),
          count: request.count,
        },
      ],
      // The panel's gold column is the Bling payout. Research listings pay in
      // Collective Tokens, which are not gold, so they show zero gold and
      // carry the tokens as a reward item instead of misreporting a currency.
      rewardGold: isBling ? request.payCount : 0,
      escrowGold: 0,
      rewardItems: isBling
        ? undefined
        : [{ itemId: String(request.payItemId), count: request.payCount }],
      status,
      townId: "harthmere",
      regionId: board.id,
      createdAtMs: nowMs,
      // Authored board listings do not expire. Daily ones repost instead, which
      // the description says in words rather than as a countdown.
      deadlineAtMs: Number.POSITIVE_INFINITY,
      acceptedAtMs: progress.pickedUp ? nowMs : undefined,
      requiresFieldWork: true,
      abuseFlags: [],
      logs: [],
    });
  }
  return postings;
}

/** The panel's board record for a native request board. */
export function nativeRequestBoardRecord(
  boardEntityId: BiomesId
): HarthmereJobsBoardRecord | undefined {
  const isQuay =
    Number(boardEntityId) === Number(HARTHMERE_DOCK_FISHING_BOARD.entityId);
  const board = isQuay
    ? HARTHMERE_REQUEST_BOARDS.find((entry) => entry.category === "fishing")
    : harthmereRequestBoardByEntityId(boardEntityId);
  if (!board) return undefined;

  const position = isQuay
    ? (() => {
        const [x, z] = HARTHMERE_DOCK_FISHING_BOARD.authoredPosition;
        const world = shiftHarthmereAuthoredPositionToWorld([
          x,
          HARTHMERE_EXTENSION_FEET_Y,
          z,
        ]);
        return { x: world[0], y: world[1], z: world[2] };
      })()
    : (() => {
        const physical = harthmereRequestBoardPhysicalPosition(board);
        return { x: physical[0], y: physical[1], z: physical[2] };
      })();

  return {
    boardId: nativeRequestBoardPanelId(
      isQuay ? HARTHMERE_DOCK_FISHING_BOARD.id : board.id
    ),
    displayName: board.label,
    townId: "harthmere",
    regionId: board.id,
    markerId: `native_request_board:${isQuay ? HARTHMERE_DOCK_FISHING_BOARD.id : board.id}`,
    location: {
      ...position,
      radius: 6,
      district: CATEGORY_DISTRICT[board.category],
      landmarkId: board.id,
    },
    // A board accepts exactly one kind of work. This is the panel-level half
    // of the scoping rule; the catalogue lookup is the other half.
    acceptedKinds: [CATEGORY_JOB_KIND[board.category]],
    requiresPhysicalInteraction: true,
  };
}

/**
 * A complete panel snapshot for one native request board.
 *
 * Shaped so `HarthmereJobsBoardPanel` and `getHarthmereAvailableJobsPanel` can
 * consume it unchanged. Only this board's postings are present, so even a
 * caller that ignores `boardId` cannot show another board's work.
 */
export function nativeRequestBoardSnapshot(input: {
  boardEntityId: BiomesId;
  actorId: string;
  lookup: NativeRequestBoardProgressLookup;
  nowMs?: number;
}): HarthmereJobsBoardSnapshot | undefined {
  const record = nativeRequestBoardRecord(input.boardEntityId);
  if (!record) return undefined;
  const postings = nativeRequestBoardPostings(
    input.boardEntityId,
    input.lookup,
    input.nowMs
  );
  return {
    version: NATIVE_REQUEST_BOARD_ADAPTER_VERSION,
    actorId: input.actorId,
    boards: { [record.boardId]: record },
    defaultBoardId: record.boardId,
    openJobs: postings.filter((job) => job.status === "open"),
    activeJobs: postings.filter((job) => job.status === "active"),
    // Board listings are authored by townsfolk, never by the player, so the
    // "mine" collections are always empty and the panel hides the poster UI.
    myPostedJobs: [],
    myAcceptedJobs: postings.filter((job) => job.status === "active"),
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
}
