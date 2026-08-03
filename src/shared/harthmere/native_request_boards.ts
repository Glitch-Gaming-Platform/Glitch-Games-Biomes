import type { BiomesId } from "@/shared/ids";

/**
 * HARTHMERE_REQUEST_BOARDS
 *
 * The four original-snapshot request boards, as one system.
 *
 *   * Fishing Board            6287329661114147 — buy fish
 *   * Collective Research Board  185367347539230 — research requests, paid in tokens
 *   * Farming Bounties          771100601807407 — buy farmed goods
 *   * Industrial Job Board     4532886290096508 — buy raw materials
 *
 * WHAT THESE ARE
 * -----------------------------------------------------------------------
 * A board is a `quest_giver` placeable that offers standing requests: somebody
 * wants N of an item and will pay for it. The player picks the request up at
 * the board, gathers, and turns it in at the same board. The Collective
 * Research Board is the fully-developed example — thirteen categorised
 * requests across fishing, farming, mining, cooking, photography, puzzles and
 * combat, paid in Collective Tokens — and the other three boards are the same
 * machine with a narrower catalogue and a Bling payout.
 *
 * WHY THIS FILE EXISTS
 * -----------------------------------------------------------------------
 * 1. ALL FOUR BOARDS ARE ICED in the restored world, so none of the twenty
 *    requests can be reached at all. This file is the manifest the restore
 *    pass needs, and the contract the tests hold it to.
 *
 * 2. EVERY BOUNTY QUEST SHARES THE SAME TRIGGER IDS. This is the single most
 *    important fact about the system and the easiest way to break it. All
 *    seven Bling bounties use the identical `seq` (8717089019405262), the
 *    identical gather leaf (4571475775082996) and the identical turn-in leaf
 *    (3835519168545347); six of the seven also share the same pick-up leaf
 *    (1396112439007247). It is safe at runtime only because trigger state is
 *    keyed per quest root and `ChallengeClaimRewardsTrigger.findEvent` matches
 *    on `challenge === rootId` as well as `stepId` — so anything that keys on
 *    a trigger id ALONE will cross-wire all seven boards' bounties into one.
 *    `native_combat_quest_routing.ts` already carries a scar from exactly this
 *    hazard on the combat quests. `native_request_boards.test.ts` pins it.
 *
 * 3. Three of the twenty requests cannot be completed as authored. They are
 *    kept — the requests themselves are canon — with an explicit defect tag
 *    and a narrowly scoped repair. See HARTHMERE_BOARD_REQUEST_DEFECTS.
 *
 * 4. Two leaves ship with no authored `name`, so their objective row renders
 *    blank, the same bug the post-Gimme quests had.
 *
 * All prices, counts and ids below are transcribed from the
 * `data-snapshot-2026-05-16` Bikkie tray. Authored values are never
 * "corrected" for balance; only genuinely uncompletable content is repaired.
 */

export const HARTHMERE_REQUEST_BOARDS_VERSION =
  "harthmere-request-boards-v1" as const;

// ---------------------------------------------------------------------------
// Boards
// ---------------------------------------------------------------------------

export type HarthmereBoardCategory =
  | "fishing"
  | "farming"
  | "industrial"
  | "research";

/** What a board pays in. */
export const HARTHMERE_BOARD_CURRENCY_IDS = Object.freeze({
  BLING: 1534621126189715 as BiomesId,
  COLLECTIVE_TOKEN: 5913149476328417 as BiomesId,
});

export interface HarthmereRequestBoard {
  readonly id: string;
  readonly entityId: BiomesId;
  readonly label: string;
  readonly category: HarthmereBoardCategory;
  /** Where the snapshot placed it. All four are currently `iced`. */
  readonly snapshotPosition: readonly [number, number, number];
  /** The "Find the ... Board" quest that unlocks its requests. */
  readonly introQuestId: BiomesId;
  readonly payoutItemId: BiomesId;
  readonly blurb: string;
}

export const HARTHMERE_FISHING_BOARD_ID = 6287329661114147 as BiomesId;
export const HARTHMERE_COLLECTIVE_RESEARCH_BOARD_ID =
  185367347539230 as BiomesId;
export const HARTHMERE_FARMING_BOUNTIES_BOARD_ID = 771100601807407 as BiomesId;
export const HARTHMERE_INDUSTRIAL_JOB_BOARD_ID = 4532886290096508 as BiomesId;

export const HARTHMERE_REQUEST_BOARDS: readonly HarthmereRequestBoard[] = [
  {
    id: "fishing_board",
    entityId: HARTHMERE_FISHING_BOARD_ID,
    label: "Fishing Board",
    category: "fishing",
    snapshotPosition: [1257.898, 53, -79.793],
    introQuestId: 7625557872628557 as BiomesId, // Hooked on Crafting
    payoutItemId: HARTHMERE_BOARD_CURRENCY_IDS.BLING,
    blurb: "Anglers post here for fish they cannot catch themselves.",
  },
  {
    id: "collective_research_board",
    entityId: HARTHMERE_COLLECTIVE_RESEARCH_BOARD_ID,
    label: "Collective Research Board",
    category: "research",
    snapshotPosition: [508.769, 72, -124.44],
    introQuestId: 1433323728101822 as BiomesId, // Spring Research
    payoutItemId: HARTHMERE_BOARD_CURRENCY_IDS.COLLECTIVE_TOKEN,
    blurb:
      "The Collective's standing research listings, paid in Collective Tokens.",
  },
  {
    id: "farming_bounties_board",
    entityId: HARTHMERE_FARMING_BOUNTIES_BOARD_ID,
    label: "Farming Bounties",
    category: "farming",
    snapshotPosition: [106.014, 41, -100.349],
    introQuestId: 3484768313930799 as BiomesId, // Botanical Bounty
    payoutItemId: HARTHMERE_BOARD_CURRENCY_IDS.BLING,
    blurb: "Kitchens and cellars post here for crops and forage.",
  },
  {
    id: "industrial_job_board",
    entityId: HARTHMERE_INDUSTRIAL_JOB_BOARD_ID,
    label: "Industrial Job Board",
    category: "industrial",
    snapshotPosition: [-1066.111, 41, -843.695],
    introQuestId: 4958059722899606 as BiomesId, // The Silver Lining
    payoutItemId: HARTHMERE_BOARD_CURRENCY_IDS.BLING,
    blurb: "Builders and smiths post here for stone, brick and bar.",
  },
] as const;

/**
 * Every board is `iced` in the restored world. Restoring them is what makes
 * all twenty requests reachable, and it is a data operation, not a code one:
 * the entities, their quest_giver components and their quests all survive
 * intact in the snapshot.
 */
export const HARTHMERE_ICED_BOARD_ENTITY_IDS = Object.freeze(
  HARTHMERE_REQUEST_BOARDS.map((board) => board.entityId)
);

export function harthmereRequestBoardByEntityId(id: unknown) {
  return HARTHMERE_REQUEST_BOARDS.find(
    (board) => Number(board.entityId) === Number(id)
  );
}

export function harthmereRequestBoardById(id: string) {
  return HARTHMERE_REQUEST_BOARDS.find((board) => board.id === id);
}

/** Every ECS entity whose legacy placeable mesh is replaced by the dedicated
 * optimized request-board renderer. The entities themselves stay live: their
 * position and quest_giver components remain the native interaction authority.
 */
export const HARTHMERE_REQUEST_BOARD_REPLACED_PLACEABLE_ENTITY_IDS =
  Object.freeze(HARTHMERE_REQUEST_BOARDS.map((board) => board.entityId));

export function isHarthmereRequestBoardEntityId(id: unknown) {
  const numericId = Number(id);
  return (
    HARTHMERE_REQUEST_BOARDS.some(
      (board) => Number(board.entityId) === numericId
    ) || Number(HARTHMERE_DOCK_FISHING_BOARD.entityId) === numericId
  );
}

// ---------------------------------------------------------------------------
// The Harthmere dock board
// ---------------------------------------------------------------------------

/**
 * A second Fishing Board, on the Harthmere river quay.
 *
 * The snapshot's Fishing Board sits at [1258, 53, -80] on the original map,
 * nowhere near Harthmere. Now that the Brell runs under the east bridge past
 * `river_dock_supply` and `dock_warehouse`, the town has a working waterfront
 * and no way to trade what comes out of it. This board stands on the quay
 * between the warehouse and the water.
 *
 * It is a distinct ENTITY offering the SAME requests: the fishing catalogue is
 * keyed by board category, not by entity, so a request picked up here can be
 * turned in at either board and vice versa. That is the "all boards are
 * connected" rule applied to the two halves of one map.
 *
 * Authored coordinates, like the rest of the Harthmere generators.
 */
export const HARTHMERE_DOCK_FISHING_BOARD = Object.freeze({
  id: "harthmere_dock_fishing_board",
  entityId: 8810000002000001 as BiomesId,
  label: "Fishing Board",
  category: "fishing" as HarthmereBoardCategory,
  /**
   * On the quay east of `dock_warehouse` (574..600, -170..-150): six voxels
   * from the Brell's centreline, so it stands on the bank at the water's edge,
   * and fourteen from the warehouse wall.
   */
  authoredPosition: [613, -174] as const,
  sharesCatalogueWith: HARTHMERE_FISHING_BOARD_ID,
});

/**
 * The quay board is a second physical interaction anchor for the canonical
 * Fishing Board catalogue. Native request leaves are authored against the
 * original board entity id, so both client dialogue matching and server claim
 * validation use this equivalence contract before publishing the canonical
 * original id to the trigger engine.
 */
export function harthmereRequestBoardEntityIdsEquivalent(
  expectedId: unknown,
  actualId: unknown
) {
  if (Number(expectedId) === Number(actualId)) return true;
  return (
    (Number(expectedId) === Number(HARTHMERE_FISHING_BOARD_ID) &&
      Number(actualId) === Number(HARTHMERE_DOCK_FISHING_BOARD.entityId)) ||
    (Number(actualId) === Number(HARTHMERE_FISHING_BOARD_ID) &&
      Number(expectedId) === Number(HARTHMERE_DOCK_FISHING_BOARD.entityId))
  );
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export type HarthmereBoardRequestDefect =
  /** The turn-in leaf has no `rewardsList`: the request pays nothing. */
  | "no_payout"
  /** `itemsToTake` names an item the player was never asked to gather. */
  | "take_item_mismatch";

export interface HarthmereBoardRequest {
  readonly questId: BiomesId;
  readonly boardId: string;
  readonly title: string;
  /** Item the request asks for. */
  readonly itemId: BiomesId;
  readonly count: number;
  /** Item taken on turn-in. Equals `itemId` for every well-formed request. */
  readonly takeItemId: BiomesId;
  readonly takeCount: number;
  readonly payItemId: BiomesId;
  readonly payCount: number;
  readonly cadence: "daily" | "never";
  /** Authored leaf ids. Shared across boards — see the file header. */
  readonly steps: {
    readonly pickUp: BiomesId;
    readonly gather: BiomesId;
    readonly turnIn: BiomesId;
  };
  readonly defect?: HarthmereBoardRequestDefect;
}

/** The shared leaf ids used by every Bling bounty. */
const BOUNTY_STEPS = Object.freeze({
  pickUp: 1396112439007247 as BiomesId,
  gather: 4571475775082996 as BiomesId,
  turnIn: 3835519168545347 as BiomesId,
});
/** The Fishing Board's pick-up leaf is the one that differs. */
const FISHING_BOUNTY_STEPS = Object.freeze({
  ...BOUNTY_STEPS,
  pickUp: 3017559906408843 as BiomesId,
});

/**
 * Collective listings share a pick-up and a hand-over leaf across the whole
 * board; only the gather leaf differs, and it differs by discipline.
 */
const COLLECTIVE_PICK_UP = 3176741531979582 as BiomesId;
const COLLECTIVE_TURN_IN = 4603174280607801 as BiomesId;
const COLLECTIVE_FARMING_STEPS = Object.freeze({
  pickUp: COLLECTIVE_PICK_UP,
  gather: 4595594203199431 as BiomesId,
  turnIn: COLLECTIVE_TURN_IN,
});
const COLLECTIVE_CRAFT_STEPS = Object.freeze({
  pickUp: COLLECTIVE_PICK_UP,
  gather: 5269531994579950 as BiomesId,
  turnIn: COLLECTIVE_TURN_IN,
});
const COLLECTIVE_FISHING_STEPS = Object.freeze({
  pickUp: COLLECTIVE_PICK_UP,
  gather: 4962883408522467 as BiomesId,
  turnIn: COLLECTIVE_TURN_IN,
});

const BLING = HARTHMERE_BOARD_CURRENCY_IDS.BLING;
const TOKEN = HARTHMERE_BOARD_CURRENCY_IDS.COLLECTIVE_TOKEN;

/**
 * Every request the four boards offer, transcribed from the snapshot.
 *
 * The Collective's thirteen are deliberately left exactly as authored,
 * including their odd payouts — they are the example the other boards follow,
 * and the brief was to keep them. The only interventions are the three defect
 * tags below, each of which marks content that cannot complete at all.
 */
export const HARTHMERE_BOARD_REQUESTS: readonly HarthmereBoardRequest[] = [
  // --- Fishing Board -------------------------------------------------------
  {
    questId: 1404381614361788 as BiomesId,
    boardId: "fishing_board",
    title: "Bounty: Stunkfish",
    itemId: 1534621126189265 as BiomesId, // Stunkfish
    count: 5,
    takeItemId: 1534621126189265 as BiomesId,
    takeCount: 5,
    payItemId: BLING,
    payCount: 75,
    cadence: "daily",
    steps: FISHING_BOUNTY_STEPS,
  },

  // --- Farming Bounties ----------------------------------------------------
  {
    questId: 6720772269271927 as BiomesId,
    boardId: "farming_bounties_board",
    title: "Bounty: Mushrooms",
    itemId: 1534621126189838 as BiomesId, // Red Mushroom
    count: 20,
    takeItemId: 1534621126189838 as BiomesId,
    takeCount: 20,
    payItemId: BLING,
    payCount: 100,
    cadence: "daily",
    steps: BOUNTY_STEPS,
  },
  {
    questId: 4501876882517394 as BiomesId,
    boardId: "farming_bounties_board",
    title: "Bounty: Carrots",
    itemId: 4938764980403185 as BiomesId, // Carrot
    count: 15,
    takeItemId: 4938764980403185 as BiomesId,
    takeCount: 15,
    payItemId: BLING,
    payCount: 75,
    cadence: "daily",
    steps: BOUNTY_STEPS,
  },
  {
    questId: 4589392321684603 as BiomesId,
    boardId: "farming_bounties_board",
    title: "Bounty: Wheat",
    itemId: 4647276549161506 as BiomesId, // Wheat
    count: 10,
    takeItemId: 4647276549161506 as BiomesId,
    takeCount: 10,
    payItemId: BLING,
    payCount: 50,
    cadence: "daily",
    steps: BOUNTY_STEPS,
  },

  // --- Industrial Job Board ------------------------------------------------
  {
    questId: 1006083001460253 as BiomesId,
    boardId: "industrial_job_board",
    title: "Bounty: Silver Bars",
    itemId: 1534621126189610 as BiomesId, // Silver Bar
    count: 2,
    takeItemId: 1534621126189610 as BiomesId,
    takeCount: 2,
    payItemId: BLING,
    payCount: 100,
    cadence: "daily",
    steps: BOUNTY_STEPS,
  },
  {
    questId: 3750760121162678 as BiomesId,
    boardId: "industrial_job_board",
    title: "Bounty: Limestone Bricks",
    itemId: 4537020877770009 as BiomesId, // Limestone Brick
    count: 64,
    takeItemId: 4537020877770009 as BiomesId,
    takeCount: 64,
    payItemId: BLING,
    payCount: 10,
    cadence: "daily",
    steps: BOUNTY_STEPS,
  },
  {
    questId: 7193493460362756 as BiomesId,
    boardId: "industrial_job_board",
    title: "Bounty: Stone",
    itemId: 7539420629350510 as BiomesId, // Stone
    count: 50,
    takeItemId: 7539420629350510 as BiomesId,
    takeCount: 50,
    payItemId: BLING,
    payCount: 50,
    cadence: "daily",
    steps: BOUNTY_STEPS,
  },

  // --- Collective Research Board -------------------------------------------
  // Item-delivery research listings. Like the Bling bounties, every one of
  // these shares its pick-up leaf (3176741531979582) and its hand-over leaf
  // (4603174280607801); only the gather leaf varies, and it varies by
  // DISCIPLINE rather than by listing — farming, mining/cooking and fishing
  // each have one. So three different listings can be mid-flight on the same
  // gather id at once, and only the quest root tells them apart.
  //
  // The remaining Collective listings are satisfied by an event rather than a
  // delivery; see HARTHMERE_COLLECTIVE_EVENT_REQUESTS.
  {
    questId: 3115411814768521 as BiomesId,
    boardId: "collective_research_board",
    title: "Farming \u00b7 Shredded Wheat",
    itemId: 4647276549161506 as BiomesId, // Wheat
    count: 20,
    takeItemId: 4647276549161506 as BiomesId,
    takeCount: 20,
    payItemId: TOKEN,
    payCount: 10,
    cadence: "never",
    steps: COLLECTIVE_FARMING_STEPS,
  },
  {
    questId: 2158254767500408 as BiomesId,
    boardId: "collective_research_board",
    title: "Mining \u00b7 Limelight",
    itemId: 7539420629350339 as BiomesId, // Limestone
    count: 24,
    takeItemId: 7539420629350339 as BiomesId,
    takeCount: 24,
    payItemId: TOKEN,
    payCount: 10,
    cadence: "never",
    steps: COLLECTIVE_CRAFT_STEPS,
  },
  {
    questId: 6399652626343596 as BiomesId,
    boardId: "collective_research_board",
    title: "Mining \u00b7 Silver Spoon",
    itemId: 1534621126189610 as BiomesId, // Silver Bar
    count: 1,
    takeItemId: 1534621126189610 as BiomesId,
    takeCount: 1,
    payItemId: TOKEN,
    payCount: 20,
    cadence: "never",
    steps: COLLECTIVE_CRAFT_STEPS,
  },
  {
    questId: 1201097720233432 as BiomesId,
    boardId: "collective_research_board",
    title: "Cooking \u00b7 Minced Meat",
    itemId: 1534621126189376 as BiomesId, // Minced Mucker Meat
    count: 4,
    takeItemId: 1534621126189376 as BiomesId,
    takeCount: 4,
    payItemId: TOKEN,
    payCount: 10,
    cadence: "never",
    steps: COLLECTIVE_CRAFT_STEPS,
  },
  {
    questId: 6685628274015553 as BiomesId,
    boardId: "collective_research_board",
    title: "Cooking \u00b7 Roasted",
    itemId: 1902599429459579 as BiomesId, // Roasted Carrot
    count: 4,
    takeItemId: 1902599429459579 as BiomesId,
    takeCount: 4,
    payItemId: TOKEN,
    payCount: 10,
    cadence: "never",
    steps: COLLECTIVE_CRAFT_STEPS,
  },
  {
    questId: 4879502557032659 as BiomesId,
    boardId: "collective_research_board",
    title: "Fishing \u00b7 Punk'd",
    itemId: 409324180050748 as BiomesId, // Punkfish
    count: 4,
    takeItemId: 409324180050748 as BiomesId,
    takeCount: 4,
    payItemId: TOKEN,
    // AUTHORING DEFECT: the snapshot's reward leaf carries `rewardsList: []`,
    // an EMPTY array. `ChallengeClaimRewardsTrigger` indexes it and gets
    // undefined, so the listing confiscates four Punkfish and pays nothing at
    // all. Repaired to the Collective's standard four-item rate rather than
    // deleted, because the listing itself is canon.
    payCount: 10,
    cadence: "never",
    steps: COLLECTIVE_FISHING_STEPS,
    defect: "no_payout",
  },
  {
    questId: 214309461279408 as BiomesId,
    boardId: "collective_research_board",
    title: "Fishing \u00b7 Royal Flush",
    itemId: 409324180050748 as BiomesId, // Punkfish - what it asks for
    count: 4,
    // AUTHORING DEFECT: the snapshot takes one Royal Gramma
    // (4537020877769682), an item the player is never asked to bring and is
    // given no way to learn about. As authored the listing cannot complete
    // unless the player happens to be carrying one. The take is repaired to
    // match the ask.
    takeItemId: 409324180050748 as BiomesId,
    takeCount: 4,
    payItemId: TOKEN,
    payCount: 20,
    cadence: "never",
    steps: COLLECTIVE_FISHING_STEPS,
    defect: "take_item_mismatch",
  },
] as const;

/** What the snapshot actually takes on Royal Flush, kept for the record. */
export const HARTHMERE_ROYAL_FLUSH_AUTHORED_TAKE_ITEM_ID =
  4537020877769682 as BiomesId;

/**
 * Collective listings that are satisfied by an event rather than a delivery.
 * They are part of the board and are listed so board UI and tests can see the
 * complete catalogue, but they have no item/price contract.
 */
export const HARTHMERE_COLLECTIVE_EVENT_REQUESTS: readonly {
  readonly questId: BiomesId;
  readonly title: string;
  readonly eventKind: string;
  readonly count: number;
  readonly payCount: number;
}[] = [
  {
    questId: 6257698449427345 as BiomesId,
    title: "Combat · Juggment Day",
    eventKind: "npcKilled",
    count: 1,
    payCount: 20,
  },
  {
    questId: 7039135520414527 as BiomesId,
    title: "Combat · Seedy Sappers",
    eventKind: "npcKilled",
    count: 4,
    payCount: 10,
  },
  {
    questId: 5395636918734952 as BiomesId,
    title: "Puzzle · Grove A-Go-Go",
    eventKind: "minigame_simple_race_finish",
    count: 1,
    payCount: 10,
  },
  {
    questId: 7363700653073401 as BiomesId,
    title: "Puzzle · High Low Silo",
    eventKind: "minigame_simple_race_finish",
    count: 1,
    payCount: 20,
  },
  {
    questId: 8910036444339370 as BiomesId,
    title: "Photography · Groupie",
    eventKind: "postPhoto",
    count: 1,
    payCount: 10,
  },
  {
    questId: 5730538520586241 as BiomesId,
    title: "Photography · Like Whoa",
    eventKind: "receiveLike",
    count: 8,
    payCount: 20,
  },
] as const;

export const HARTHMERE_BOARD_REQUEST_DEFECTS = Object.freeze(
  HARTHMERE_BOARD_REQUESTS.filter((request) => request.defect !== undefined)
);

export function harthmereBoardRequestsFor(boardId: string) {
  return HARTHMERE_BOARD_REQUESTS.filter(
    (request) => request.boardId === boardId
  );
}

export function harthmereBoardRequestByQuestId(questId: unknown) {
  return HARTHMERE_BOARD_REQUESTS.find(
    (request) => Number(request.questId) === Number(questId)
  );
}

/**
 * Requests reachable from a board ENTITY.
 *
 * Boards of the same category share a catalogue, which is what lets the
 * Harthmere quay board offer the same fishing requests as the original one.
 */
export function harthmereBoardRequestsForEntity(entityId: unknown) {
  if (Number(entityId) === Number(HARTHMERE_DOCK_FISHING_BOARD.entityId)) {
    return harthmereBoardRequestsFor("fishing_board");
  }
  const board = harthmereRequestBoardByEntityId(entityId);
  return board ? harthmereBoardRequestsFor(board.id) : [];
}

// ---------------------------------------------------------------------------
// Category rules
// ---------------------------------------------------------------------------

/**
 * Attributes that make an item legal for a board.
 *
 * Expressed as biscuit attribute names so the check can be run against a real
 * Biscuit without this module depending on the Bikkie runtime. `research`
 * accepts anything: the Collective studies whatever it likes, and its own
 * catalogue already spans fish, crops, ore and cooked food.
 */
export const HARTHMERE_BOARD_CATEGORY_ITEM_ATTRIBUTES: Readonly<
  Record<HarthmereBoardCategory, readonly string[] | "any">
> = Object.freeze({
  fishing: ["isFish"],
  farming: ["isFruit", "isVegetable", "isSeed"],
  industrial: ["isBlock", "isAnyStone", "isOre", "isBar", "isIngot"],
  research: "any",
});

/**
 * Does this item belong on this board?
 *
 * Takes a plain attribute bag rather than a Biscuit so it is callable from the
 * server, the client and a unit test without a Bikkie tray. An item with no
 * recognised attribute fails every board except research — which is the
 * conservative answer, because a board that accepts anything is a board with
 * no identity.
 */
export function harthmereBoardAcceptsItem(
  category: HarthmereBoardCategory,
  itemAttributes: Readonly<Record<string, unknown>>
): boolean {
  const allowed = HARTHMERE_BOARD_CATEGORY_ITEM_ATTRIBUTES[category];
  if (allowed === "any") return true;
  return allowed.some((attribute) => Boolean(itemAttributes[attribute]));
}

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

/**
 * Suggested Bling for a NEW request.
 *
 * Authored prices are never recomputed — the snapshot's numbers are canon even
 * where they are strange (sixty-four Limestone Bricks for ten Bling is a bad
 * deal, and it is the deal the snapshot offers). This exists so any request
 * added later is priced in the same currency of effort rather than by feel.
 *
 * The shape is deliberately simple and legible: a board multiplier over the
 * item's own sell price, with a floor so a cheap-but-tedious stack is still
 * worth walking to the board for.
 */
export const HARTHMERE_BOARD_PRICE_MULTIPLIERS: Readonly<
  Record<HarthmereBoardCategory, number>
> = Object.freeze({
  // Fish need a rod, bait and a bite timer, so they carry the best rate.
  fishing: 3,
  // Crops need land, water and a real-time grow.
  farming: 2.5,
  // Raw material is the most plentiful and the least gated.
  industrial: 1.5,
  research: 1,
});

export const HARTHMERE_BOARD_MINIMUM_PAYOUT = 10;

export function harthmereBoardSuggestedPayout(input: {
  category: HarthmereBoardCategory;
  count: number;
  itemSellPrice?: number;
}): number {
  const unit = Number.isFinite(input.itemSellPrice)
    ? Math.max(0, Number(input.itemSellPrice))
    : 1;
  const multiplier = HARTHMERE_BOARD_PRICE_MULTIPLIERS[input.category];
  const raw = Math.round(unit * Math.max(0, input.count) * multiplier);
  return Math.max(HARTHMERE_BOARD_MINIMUM_PAYOUT, raw);
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export type HarthmereBoardRequestState =
  /** The board's intro quest has not been done, so nothing is listed. */
  | "locked"
  /** Listed on the board and not yet picked up. */
  | "available"
  /** Picked up; the player is gathering. */
  | "in_progress"
  /** Gathered in full; ready to hand over at the board. */
  | "ready_to_turn_in"
  /** Paid. Daily requests relist on the next reset. */
  | "completed";

export interface HarthmereBoardRequestProgress {
  readonly introComplete: boolean;
  readonly pickedUp: boolean;
  readonly heldCount: number;
  readonly turnedIn: boolean;
}

/**
 * Single source of truth for what a request looks like right now.
 *
 * The server's trigger engine remains authoritative — this mirrors its
 * semantics so board UI, map markers and tests all agree, exactly as
 * `nativeQuestMapAdapter` mirrors the engine's active-leaf rules.
 */
export function harthmereBoardRequestState(
  request: HarthmereBoardRequest,
  progress: HarthmereBoardRequestProgress
): HarthmereBoardRequestState {
  if (progress.turnedIn) return "completed";
  if (!progress.introComplete) return "locked";
  if (!progress.pickedUp) return "available";
  return progress.heldCount >= request.count
    ? "ready_to_turn_in"
    : "in_progress";
}

/** Items still owed. Never negative, and never more than the ask. */
export function harthmereBoardRequestRemaining(
  request: HarthmereBoardRequest,
  heldCount: number
): number {
  const held = Number.isFinite(heldCount) ? Math.max(0, heldCount) : 0;
  return Math.max(0, request.count - held);
}

/**
 * Can this turn-in be honoured?
 *
 * The gather leaf is `inventoryHas`, which only checks a total — so a player
 * can reach the turn-in and then drop the goods before handing them over. The
 * server's `itemsToTake` would fail and the leaf would silently not fire, so
 * this is the check that lets the client say why.
 */
export function harthmereBoardRequestCanTurnIn(
  request: HarthmereBoardRequest,
  progress: HarthmereBoardRequestProgress
): boolean {
  return (
    harthmereBoardRequestState(request, progress) === "ready_to_turn_in" &&
    progress.heldCount >= request.takeCount
  );
}

/**
 * Daily requests relist at the next UTC midnight after they were started.
 *
 * Mirrors `QuestExecutor.canRepeat`'s "daily" branch exactly, rather than
 * inventing a second reset clock.
 */
export function harthmereBoardRequestResetsAt(
  request: HarthmereBoardRequest,
  startedAtMs: number
): number | undefined {
  if (request.cadence !== "daily") return undefined;
  const started = new Date(startedAtMs);
  const reset = new Date(started);
  reset.setUTCHours(0, 0, 0, 0);
  reset.setUTCDate(started.getUTCDate() + 1);
  return reset.getTime();
}

// ---------------------------------------------------------------------------
// Connection between boards
// ---------------------------------------------------------------------------

/**
 * Standing earned across every board.
 *
 * The four boards are one institution's noticeboards, not four unrelated
 * props, so a player's record with them is shared. Bling bounties count for
 * one point of standing each and Collective research for its token value,
 * which keeps research the prestigious board without making the other three
 * pointless.
 */
export const HARTHMERE_BOARD_STANDING_PER_BOUNTY = 1;

export function harthmereBoardStanding(
  completedQuestIds: Iterable<unknown>
): number {
  const completed = new Set(
    [...completedQuestIds].map((id) => Number(id))
  );
  let standing = 0;
  for (const request of HARTHMERE_BOARD_REQUESTS) {
    if (!completed.has(Number(request.questId))) continue;
    standing +=
      request.payItemId === HARTHMERE_BOARD_CURRENCY_IDS.COLLECTIVE_TOKEN
        ? request.payCount
        : HARTHMERE_BOARD_STANDING_PER_BOUNTY;
  }
  for (const request of HARTHMERE_COLLECTIVE_EVENT_REQUESTS) {
    if (completed.has(Number(request.questId))) standing += request.payCount;
  }
  return standing;
}

/** Which other boards a given board should point the player at. */
export function harthmereOtherBoards(boardId: string) {
  return HARTHMERE_REQUEST_BOARDS.filter((board) => board.id !== boardId);
}

// ---------------------------------------------------------------------------
// Restored-world projections
// ---------------------------------------------------------------------------

/**
 * Objective text for board leaves the snapshot left unnamed.
 *
 * `Bounty: Wheat`, `Bounty: Stone`, `Bounty: Mushrooms`, `Bounty: Carrots`,
 * `Bounty: Silver Bars` and `Bounty: Limestone Bricks` all share pick-up leaf
 * 1396112439007247, and that leaf carries only a `description` — no `name`. So
 * the journal, map row and HUD all render an empty objective on the first step
 * of every one of them.
 *
 * Because the id is shared, one projection fixes all six at once, and it has
 * to be generic wording for the same reason.
 */
const HARTHMERE_BOARD_PROJECTED_TRIGGER_NAMES = new Map<number, string>([
  [Number(BOUNTY_STEPS.pickUp), "Pick up the bounty from the board"],
  [Number(FISHING_BOUNTY_STEPS.pickUp), "Pick up the bounty from the board"],
]);

export function harthmereBoardProjectedTriggerName(stepId: unknown) {
  return HARTHMERE_BOARD_PROJECTED_TRIGGER_NAMES.get(Number(stepId));
}

/**
 * Guard against the shared-trigger-id hazard described in the file header.
 *
 * Anything routing board behaviour must key on the quest AND the leaf, never
 * the leaf alone. This helper is the only supported way to ask "is this leaf,
 * on this quest, a board request step?".
 */
export function harthmereBoardRequestStepKind(
  questId: unknown,
  stepId: unknown
): "pickUp" | "gather" | "turnIn" | undefined {
  const request = harthmereBoardRequestByQuestId(questId);
  if (!request) return undefined;
  if (Number(stepId) === Number(request.steps.pickUp)) return "pickUp";
  if (Number(stepId) === Number(request.steps.gather)) return "gather";
  if (Number(stepId) === Number(request.steps.turnIn)) return "turnIn";
  return undefined;
}
