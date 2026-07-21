// HARTHMERE_BIBLE_QUEST_LIVE_AUTHORITY (bible-wiring fix, 2026-07-14)
//
// WHY THIS FILE EXISTS
// --------------------
// The 2026-07-14 systems audit found that the 85-quest "bible" catalog
// (`quest_compendium.ts`) and its tested runtime (`quest_runtime.ts`) were
// imported ONLY by a validator and a local-dev debug bridge: no NPC dialogue,
// HUD, or live_mode API path could accept, advance, or complete them. The
// entire Q1–Q12 Bellbound Dragon main arc and all 42 side quests were
// authored, validated, spatially placed — and unreachable by players.
//
// This module is the single server-authoritative seam that closes that gap.
// It is a PURE library (no redis / window / renderer imports) so every branch
// is unit-testable per repo convention. `live_mode_backend.ts` calls the
// `reduceHarthmereBibleQuest*` functions from its `request_quest_state_update`
// handler and applies the returned reward INSTRUCTIONS (xp/gold/item deltas)
// with its own state helpers — this module never mutates inventory directly,
// so the backend keeps one choke point for economy writes (audit finding 9,
// "dual-authority inventory", is not made worse by this feature).
//
// It also owns the Thaedryn (dragon) encounter wiring: the previously
// runtime-orphaned `thaedryn_boss.ts` contract is driven from here, the boss
// is exposed as a live-mode combat entity snapshot (so the proven native
// attack path hits it), and completing the encounter advances/finishes Q12.
//
// REACHABILITY GUARANTEE (user requirement, 2026-07-14)
// -----------------------------------------------------
// The dragon quest, its town anchors, and the arena must ALWAYS be reachable:
//   - The quest catalog authored THREE different Wyrm's Bed locations
//     (quest waypoint 500/-160, quest-space entry 520/-408, renderer dragon
//     chamber ~640/-268). Tests never caught this because each location was
//     only checked against its own file. This module declares ONE canonical
//     arena anchor — the renderer's phase-safe dragon chamber markers at
//     authored (640, -268), which are drawn ON WALKABLE GROUND in the
//     Old Well / Underways district — and everything (boss snapshot, map
//     marker, distance validation) uses it. Because the anchor sits on the
//     town-surface proxy the renderer already draws, no underground digging,
//     ladder, or portal is required: a player can always walk there from the
//     Harthmere connector road.
//   - `harthmereBibleQuestObjectiveWaypointOverride` widens Q12 objective
//     validation to the arena anchor so "player_too_far" can never be caused
//     by the authored-data disagreement above.
//   - `validateHarthmereDragonQuestReachability()` is a contract check (run
//     by tests and the audit scripts) asserting the anchor stays inside the
//     town-registry world bounds and that every Q1–Q12 giver/waypoint
//     resolves to a grounded placement.

import {
  HARTHMERE_QUEST_CATALOG,
  getHarthmereQuestById,
} from "@/shared/harthmere/quest_compendium";
import {
  acceptHarthmereQuest,
  advanceHarthmereQuestObjective,
  completeHarthmereQuest,
  abandonHarthmereQuest,
  retryHarthmereQuest,
  createHarthmereQuestRuntimeContext,
  getHarthmereQuestJournalEntry,
  getHarthmereQuestMapHint,
  getHarthmereQuestResolvedWaypoint,
  type HarthmereQuestRuntimeContext,
  type HarthmereQuestRuntimeRecord,
  type HarthmereQuestRuntimeEvent,
  type HarthmereQuestMapHint,
  type HarthmereQuestJournalEntry,
} from "@/shared/harthmere/quest_runtime";
import {
  createThaedrynBossState,
  applyThaedrynBossEvent,
  resolveThaedrynPath,
  completeThaedrynBoss,
  getThaedrynPhaseForState,
  type HarthmereThaedrynBossState,
  type HarthmereThaedrynPath,
} from "@/shared/harthmere/thaedryn_boss";
import { shiftHarthmereAuthoredPositionToWorld } from "@/shared/harthmere/coordinate_transform";
import { getHarthmereMainQuestSpaceById } from "@/shared/harthmere/main_quest_spaces";

export const HARTHMERE_BIBLE_QUEST_LIVE_AUTHORITY_VERSION =
  "harthmere-bible-quest-live-authority" as const;

// ---------------------------------------------------------------------------
// Operation names. The client posts these as `payload.operation` on a
// `request_quest_state_update` mutation; the backend routes any operation with
// this prefix to `reduceHarthmereBibleQuestOperation`.
// ---------------------------------------------------------------------------
export const HARTHMERE_BIBLE_QUEST_OPERATION_PREFIX = "bible_quest_" as const;
export type HarthmereBibleQuestOperation =
  | "bible_quest_read"
  | "bible_quest_accept"
  | "bible_quest_advance"
  | "bible_quest_complete"
  | "bible_quest_abandon"
  | "bible_quest_retry"
  | "bible_quest_boss_event";

// The journal `source` tag for bible quests mirrored into the shared
// `quests.active` record (what the map/journal adapters read).
export const HARTHMERE_BIBLE_QUEST_ACTIVE_SOURCE = "bible_catalog" as const;

// ---------------------------------------------------------------------------
// Canonical dragon arena anchor (see REACHABILITY GUARANTEE above).
// Authored coordinates; world = authored + the standard +512 X town shift.
// (640, -268) is the center of the renderer's phase-safe Wyrm's Bed dragon
// chamber markers ("bronze-stone snout silhouette", threshold wall, candle
// eye glows at 636–644 / -260..-272) in Old Well / Underways — real, already
// rendered, walkable-surface assets.
// ---------------------------------------------------------------------------
// Y = 64 is the town's flat ground level (HARTHMERE_TOWN_FLATTEN_TARGET_Y in
// town_flatten_terraform.ts — a test asserts they stay equal). The anchor
// must carry a REAL ground Y because combat reach and objective distance are
// 3D: an anchor at Y 0 under ~64-high terrain would put the boss 64 blocks
// "below" every attacker and make the encounter unreachable — exactly the
// class of silent gap this wiring exists to close.
export const HARTHMERE_THAEDRYN_ARENA_AUTHORED_ANCHOR: readonly [
  number,
  number,
  number
] = [640, 64, -268];

export function harthmereThaedrynArenaWorldAnchor(): [number, number, number] {
  return shiftHarthmereAuthoredPositionToWorld(
    HARTHMERE_THAEDRYN_ARENA_AUTHORED_ANCHOR
  ) as [number, number, number];
}

/** Exact native entity id for the quest-gated Thaedryn NPC. */
export const HARTHMERE_NATIVE_THAEDRYN_ENTITY_ID = 8_810_000_000_019_120;
/** Compatibility key used by legacy snapshot maps and the visible target. */
export const HARTHMERE_THAEDRYN_COMBAT_ENTITY_ID = "8810000000019120" as const;

export const HARTHMERE_BIBLE_DRAGON_QUEST_ID =
  "bellbound_q12_thaedryn_bellbound" as const;

// Q12 objective ids, in catalog order. Objective 1 (enter) completes on
// proximity to the arena anchor; objective 2 (survive the encounter)
// completes when the boss state machine resolves; objectives 3 and 4 are the
// path choice + aftermath and complete from the boss resolution too.
export const HARTHMERE_Q12_OBJECTIVE_IDS = {
  enter: "bellbound_q12_thaedryn_bellbound_obj_01",
  survive: "bellbound_q12_thaedryn_bellbound_obj_02",
  choosePath: "bellbound_q12_thaedryn_bellbound_obj_03",
  aftermath: "bellbound_q12_thaedryn_bellbound_obj_04",
} as const;

// ---------------------------------------------------------------------------
// Per-player live-state slice. Stored under `state.quests.bible` in the
// live_mode backend state blob (normalized below so old blobs deserialize).
// ---------------------------------------------------------------------------
export interface HarthmereBibleQuestLiveSlice {
  /** quest_runtime records, keyed by quest id. */
  runtime: Record<string, HarthmereQuestRuntimeRecord>;
  /** Reward-grant idempotency ledger (quest_runtime grant ids). */
  grantedRewardIds: string[];
  /**
   * World/story flags earned from quest `rewards.unlocks` (e.g.
   * `post_main_harthmere_state`). Also consumed by activation rules via
   * `requiredFlags`.
   */
  flags: string[];
  /** Completion timestamps (ms) for completed bible quests. */
  completedAtMs: Record<string, number>;
  /** Titles granted by quest rewards (display-only, additive). */
  titles: string[];
  /** The Thaedryn encounter state machine, present while Q12 is in flight. */
  thaedryn?: HarthmereThaedrynBossState;
  /** Post-encounter town phase (from the chosen path), once resolved. */
  townPhase?: string;
}

export function defaultHarthmereBibleQuestLiveSlice(): HarthmereBibleQuestLiveSlice {
  return {
    runtime: {},
    grantedRewardIds: [],
    flags: [],
    completedAtMs: {},
    titles: [],
  };
}

/**
 * Defensive deserializer: old state blobs (written before this feature) have
 * no `quests.bible` key, and a hostile/buggy client could post garbage into
 * it. Every field is re-validated to its expected shape.
 */
export function normalizeHarthmereBibleQuestLiveSlice(
  raw: unknown
): HarthmereBibleQuestLiveSlice {
  const defaults = defaultHarthmereBibleQuestLiveSlice();
  if (!raw || typeof raw !== "object") return defaults;
  const record = raw as Record<string, unknown>;
  const runtime: Record<string, HarthmereQuestRuntimeRecord> = {};
  if (record.runtime && typeof record.runtime === "object") {
    for (const [questId, value] of Object.entries(
      record.runtime as Record<string, unknown>
    )) {
      // Only keep records for quests that still exist in the catalog — a
      // renamed/deleted quest must not leave an orphan that blocks re-accept.
      if (!getHarthmereQuestById(questId)) continue;
      if (!value || typeof value !== "object") continue;
      runtime[questId] = value as HarthmereQuestRuntimeRecord;
    }
  }
  const stringArray = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  const completedAtMs: Record<string, number> = {};
  if (record.completedAtMs && typeof record.completedAtMs === "object") {
    for (const [questId, atMs] of Object.entries(
      record.completedAtMs as Record<string, unknown>
    )) {
      const numeric = Number(atMs);
      if (Number.isFinite(numeric)) completedAtMs[questId] = numeric;
    }
  }
  return {
    runtime,
    grantedRewardIds: stringArray(record.grantedRewardIds),
    flags: stringArray(record.flags),
    completedAtMs,
    titles: stringArray(record.titles),
    thaedryn:
      record.thaedryn && typeof record.thaedryn === "object"
        ? (record.thaedryn as HarthmereThaedrynBossState)
        : undefined,
    townPhase:
      typeof record.townPhase === "string" ? record.townPhase : undefined,
  };
}

// ---------------------------------------------------------------------------
// Starter-quest twins. The 9 bible `starter_*` quests were mirrored into the
// always-playable client quest list long before this wiring, under kebab-case
// ids. Offering the bible copies too would double-list them in dialogue and
// journal, and completing one copy would not complete the other. We therefore:
//   1. NEVER offer bible `starter` category quests from NPC dialogue (the
//      client twins own that surface), and
//   2. translate a completed client twin into its bible id when building the
//      prerequisite context, so any future bible quest gated on a starter
//      unlocks no matter which copy the player finished.
// ---------------------------------------------------------------------------
export const HARTHMERE_BIBLE_STARTER_TWIN_CLIENT_IDS: Readonly<
  Record<string, string>
> = Object.fromEntries(
  (HARTHMERE_QUEST_CATALOG as readonly any[])
    .filter((quest) => quest.category === "starter")
    .map((quest) => [
      quest.id,
      // starter_welcome_to_harthmere -> welcome-to-harthmere
      String(quest.id)
        .replace(/^starter_/, "")
        .replace(/_/g, "-"),
    ])
);

/**
 * Translate the live-mode `quests.completed` key set (which contains client
 * quest ids, jobs-board ids, helper ids AND bible ids) into the bible-id
 * space used by `activeRules.prerequisiteQuestIds`.
 */
export function harthmereBibleCompletedQuestIds(
  completed: Record<string, number> | undefined
): string[] {
  const ids = new Set<string>();
  const twinToBible = new Map(
    Object.entries(HARTHMERE_BIBLE_STARTER_TWIN_CLIENT_IDS).map(
      ([bibleId, clientId]) => [clientId, bibleId]
    )
  );
  for (const key of Object.keys(completed ?? {})) {
    ids.add(key);
    const bibleTwin = twinToBible.get(key);
    if (bibleTwin) ids.add(bibleTwin);
  }
  return [...ids];
}

// ---------------------------------------------------------------------------
// Giver -> quests map, derived from the catalog itself.
//
// GAP FIX (found in the 2026-07-14 code review, not by any test): the
// hand-written `HARTHMERE_QUEST_DIALOGUE_LINKS` in quest_runtime.ts maps only
// 8 of the catalog's 21 givers, so 13 NPCs could never surface their quests
// even after wiring. This builder derives the full map from quest data, so a
// future quest edit can't silently orphan a giver again.
// ---------------------------------------------------------------------------
export function harthmereBibleQuestsByGiver(): Record<string, string[]> {
  const byGiver: Record<string, string[]> = {};
  for (const quest of HARTHMERE_QUEST_CATALOG as readonly any[]) {
    if (quest.hidden) continue; // hidden quests use world triggers, not givers
    if (quest.category === "starter") continue; // client twins own starters
    if (!quest.giverId) continue;
    (byGiver[quest.giverId] ??= []).push(quest.id);
  }
  return byGiver;
}

// ---------------------------------------------------------------------------
// Context building.
//
// The backend has no world weather service; the two storm-gated hidden side
// quests accept a client-claimed weather (consistent with the backend's
// existing clientClaims patterns — documented trust tradeoff). The game hour
// derives from the server clock so a client cannot claim an arbitrary hour.
// ---------------------------------------------------------------------------
export function harthmereBibleGameHourFromMs(nowMs: number): number {
  // One real day maps to one game day; UTC hour keeps every server replica
  // in agreement (state is shared through redis, so replicas must not
  // disagree about "what hour it is" or activation becomes racy).
  return new Date(nowMs).getUTCHours();
}

export function harthmereBibleTimeOfDayForHour(
  hour: number
): "dawn" | "day" | "dusk" | "night" {
  if (hour >= 5 && hour < 8) return "dawn";
  if (hour >= 8 && hour < 18) return "day";
  if (hour >= 18 && hour < 21) return "dusk";
  return "night";
}

export interface HarthmereBibleQuestContextInput {
  actorId: string;
  /** `classMagic.skills.character_level.level`, defaulting to 1. */
  playerLevel: number;
  /** The live-mode `quests.completed` record (mixed id spaces — translated). */
  completedQuests: Record<string, number> | undefined;
  slice: HarthmereBibleQuestLiveSlice;
  nowMs: number;
  /** Optional client-claimed weather (see note above). */
  weatherClaim?: string;
}

export function buildHarthmereBibleQuestContext(
  input: HarthmereBibleQuestContextInput
): HarthmereQuestRuntimeContext {
  const hour = harthmereBibleGameHourFromMs(input.nowMs);
  const completedQuestIds = harthmereBibleCompletedQuestIds(
    input.completedQuests
  );
  // Also count the slice's own completions (belt and braces: `quests.completed`
  // is mirrored on completion, but a partially-failed mirror must not lock the
  // player out of the next quest in the chain).
  for (const questId of Object.keys(input.slice.completedAtMs)) {
    if (!completedQuestIds.includes(questId)) completedQuestIds.push(questId);
  }
  const questStates: Record<string, any> = {};
  for (const [questId, record] of Object.entries(input.slice.runtime)) {
    questStates[questId] = record.state;
  }
  for (const questId of completedQuestIds) {
    if (getHarthmereQuestById(questId)) questStates[questId] = "completed";
  }
  const validWeather = ["clear", "rain", "storm", "fog", "snow"];
  return createHarthmereQuestRuntimeContext({
    playerId: input.actorId,
    playerLevel: Math.max(1, Math.trunc(input.playerLevel || 1)),
    hour,
    timeOfDay: harthmereBibleTimeOfDayForHour(hour),
    weather: validWeather.includes(input.weatherClaim ?? "")
      ? (input.weatherClaim as any)
      : "clear",
    tick: input.nowMs,
    flags: [...input.slice.flags],
    completedQuestIds,
    inventoryFreeSlots: 20,
    questStates,
    runtimeRecords: input.slice.runtime,
    grantedRewardIds: input.slice.grantedRewardIds,
    authority: "server",
  });
}

// ---------------------------------------------------------------------------
// Offers: which quests should an NPC's dialogue present right now?
// ---------------------------------------------------------------------------
export interface HarthmereBibleQuestOffer {
  questId: string;
  title: string;
  code?: string;
  category: string;
  state: "available" | "active" | "ready_to_complete" | "locked" | "completed";
  offerText: string;
  rewardPreview: string;
  lockedReasons?: string[];
}

export function harthmereBibleQuestOffersForGiver(
  giverId: string,
  context: HarthmereQuestRuntimeContext
): HarthmereBibleQuestOffer[] {
  const questIds = harthmereBibleQuestsByGiver()[giverId] ?? [];
  const offers: HarthmereBibleQuestOffer[] = [];
  for (const questId of questIds) {
    const quest = getHarthmereQuestById(questId) as any;
    if (!quest) continue;
    const record = context.runtimeRecords[questId];
    if (record?.state === "active" || record?.state === "ready_to_complete") {
      offers.push({
        questId,
        title: quest.title,
        code: quest.code,
        category: quest.category,
        state: record.state,
        offerText: quest.dialogue?.active ?? quest.dialogue?.offer ?? "",
        rewardPreview: quest.rewards?.previewText ?? "",
      });
      continue;
    }
    const completedOnce =
      context.completedQuestIds.includes(questId) &&
      (quest.repeatability ?? "once") === "once";
    if (completedOnce) continue; // nothing to offer, keep dialogue clean
    // Re-use the runtime's own accept validation for availability so the
    // dialogue can never offer a quest the accept mutation would then reject.
    const probe = acceptHarthmereQuest(
      // IMPORTANT: probe on a DEEP-ENOUGH copy — acceptance mutates records.
      {
        ...context,
        runtimeRecords: { ...context.runtimeRecords },
        questStates: { ...context.questStates },
        completedQuestIds: [...context.completedQuestIds],
        grantedRewardIds: [...context.grantedRewardIds],
      },
      questId
    );
    offers.push({
      questId,
      title: quest.title,
      code: quest.code,
      category: quest.category,
      state: probe.ok ? "available" : "locked",
      offerText: quest.dialogue?.offer ?? "",
      rewardPreview: quest.rewards?.previewText ?? "",
      lockedReasons: probe.ok ? undefined : probe.reasons,
    });
  }
  return offers;
}

// ---------------------------------------------------------------------------
// Reward instructions. The reducer returns these; the backend applies them.
// ---------------------------------------------------------------------------
export interface HarthmereBibleQuestRewardInstructions {
  questId: string;
  rewardGrantId: string;
  xpDelta: number;
  goldDelta: number;
  items: Array<{ itemId: string; count: number; displayName: string }>;
  titles: string[];
  unlockFlags: string[];
  previewText: string;
}

/** Humanize a reward item id ("rat_crown_cosmetic" -> "Rat Crown Cosmetic"). */
export function harthmereBibleRewardItemDisplayName(itemId: string): string {
  return itemId
    .split(/[_-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * GAP FIX (2026-07-14 code review): the catalog's 72 distinct reward item ids
 * exist in NO item catalogue, so a naive `items[itemId] += 1` would create
 * inventory rows the UI cannot name. The backend must register a definition
 * for each granted item; this helper produces the registration payload
 * (`isQuestItem`, non-tradeable, stack 1 — they are keepsakes/tokens).
 */
export function harthmereBibleRewardItemDefinition(itemId: string) {
  return {
    itemId,
    displayName: harthmereBibleRewardItemDisplayName(itemId),
    description: "A keepsake earned in service of Harthmere.",
    maxStackSize: 99,
    baseValue: 0,
    // "quest" binding (HarthmereItemBinding): reward keepsakes are bound —
    // not tradeable, not vendorable — matching every other quest item.
    binding: "quest" as const,
    isQuestItem: true,
    isCurrency: false,
    isConsumable: false,
    isCraftingMaterial: false,
    isSpellTome: false,
    levelRequirement: 1,
    classRestriction: [] as string[],
    stats: {},
    tradeable: false,
  };
}

function rewardInstructionsForQuest(
  quest: any,
  rewardGrantId: string
): HarthmereBibleQuestRewardInstructions {
  const rewards = quest.rewards ?? {};
  const items = (Array.isArray(rewards.items) ? rewards.items : [])
    .filter((entry: unknown) => typeof entry === "string" && entry)
    .map((itemId: string) => ({
      itemId,
      count: 1,
      displayName: harthmereBibleRewardItemDisplayName(itemId),
    }));
  return {
    questId: quest.id,
    rewardGrantId,
    // xp/silver are authored as plain numbers on bible quests ("silver" is the
    // player-facing name of the live-mode gold wallet).
    xpDelta: Math.max(0, Math.trunc(Number(rewards.xp ?? 0) || 0)),
    goldDelta: Math.max(0, Math.trunc(Number(rewards.silver ?? 0) || 0)),
    items,
    titles: (Array.isArray(rewards.titles) ? rewards.titles : []).filter(
      (title: unknown): title is string => typeof title === "string"
    ),
    unlockFlags: (Array.isArray(rewards.unlocks) ? rewards.unlocks : []).filter(
      (flag: unknown): flag is string => typeof flag === "string"
    ),
    previewText: rewards.previewText ?? "",
  };
}

// ---------------------------------------------------------------------------
// The reducer. One entry point per operation; all pure against the slice.
// ---------------------------------------------------------------------------
export interface HarthmereBibleQuestReduceInput {
  slice: HarthmereBibleQuestLiveSlice;
  actorId: string;
  playerLevel: number;
  completedQuests: Record<string, number> | undefined;
  nowMs: number;
  operation: string;
  questId?: string;
  objectiveId?: string;
  /** Actor world position (for objective distance validation). */
  actorPosition?: [number, number, number];
  /** Choice objectives: the selected choice value. */
  choice?: string;
  /** Combat objectives: result claim (validated by the runtime rules). */
  combatResult?: "damage" | "kill" | "encounter_cleared" | "practice_hit";
  /** Idempotency: the mutation requestId namespaces objective events. */
  requestId: string;
  weatherClaim?: string;
  /** Boss events (bible_quest_boss_event). */
  bossEventType?: string;
  bossEventAmount?: number;
  bossEventPath?: string;
  /** Solo vs group tuning for the encounter, chosen at Q12 accept. */
  bossMode?: "solo_story" | "group";
}

export interface HarthmereBibleQuestReduceResult {
  ok: boolean;
  warnings: string[];
  /** New slice (input slice is never mutated). */
  slice: HarthmereBibleQuestLiveSlice;
  /** Reward instructions to apply, when a completion granted them. */
  rewards?: HarthmereBibleQuestRewardInstructions;
  /** Server-created proof item for collect/gather/recover objectives. */
  objectiveItemGrant?: {
    itemId: string;
    count: number;
    displayName: string;
  };
  /** Journal/map data for the client response. */
  journal?: HarthmereQuestJournalEntry;
  mapHint?: HarthmereQuestMapHint;
  /**
   * Mirror instructions for the shared `quests.active`/`quests.completed`
   * records the journal adapters already read. The backend applies these.
   */
  activeMirror?: {
    questId: string;
    remove?: boolean;
    entry?: {
      stepId?: string;
      progress: number;
      source: string;
      title?: string;
      questKind?: string;
      giverName?: string;
      giverPosition?: [number, number, number];
    };
  };
  completedMirrorQuestId?: string;
  /** Thaedryn combat-snapshot sync instruction (see backend integration). */
  thaedrynSnapshot?: "seed" | "sync" | "remove";
}

function cloneSlice(
  slice: HarthmereBibleQuestLiveSlice
): HarthmereBibleQuestLiveSlice {
  return JSON.parse(JSON.stringify(slice)) as HarthmereBibleQuestLiveSlice;
}

/** First not-yet-completed objective of an active record, in catalog order. */
export function harthmereBibleQuestCurrentObjective(
  questId: string,
  record: HarthmereQuestRuntimeRecord | undefined
): any | undefined {
  const quest = getHarthmereQuestById(questId) as any;
  if (!quest || !record) return undefined;
  return (quest.objectives ?? []).find(
    (objective: any) => !record.objectiveProgress[objective.id]?.completed
  );
}

/**
 * Q12's authored waypoints disagree with the arena assets (see header). For
 * Q12 objectives we validate distance against the canonical arena anchor
 * instead of the authored waypoint, so the quest can never soft-lock on
 * "player_too_far" at a location where nothing is rendered.
 */
export function harthmereBibleQuestObjectiveWaypointOverride(
  questId: string
): [number, number, number] | undefined {
  if (questId === HARTHMERE_BIBLE_DRAGON_QUEST_ID) {
    return harthmereThaedrynArenaWorldAnchor();
  }
  return undefined;
}

function bibleObjectiveCollectsItem(objective: any) {
  return /^(collect|gather|recover|retrieve|obtain|take|pick up)\b/i.test(
    String(objective?.label ?? "")
  );
}

function bibleObjectiveItemCount(objective: any) {
  const label = String(objective?.label ?? "").toLowerCase();
  const numeric = label.match(/\b(\d+)\b/)?.[1];
  if (numeric) return Math.max(1, Math.trunc(Number(numeric)));
  const words: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
  };
  for (const [word, count] of Object.entries(words)) {
    if (new RegExp(`\\b${word}\\b`).test(label)) return count;
  }
  return Math.max(1, Math.trunc(Number(objective?.count ?? 1) || 1));
}

function bibleObjectiveProofItem(questId: string, objective: any) {
  const itemId = `quest_objective_item:${questId}:${objective.id}`;
  return {
    itemId,
    count: bibleObjectiveItemCount(objective),
    displayName: String(
      objective?.targetName ?? objective?.label ?? "Quest Item"
    )
      .replace(/^(collect|gather|recover|retrieve|obtain|take|pick up)\s+/i, "")
      .trim(),
  };
}

export function harthmereBibleObjectiveItemDefinition(input: {
  itemId: string;
  displayName: string;
}) {
  return {
    itemId: input.itemId,
    displayName: input.displayName || "Quest Item",
    description:
      "Objective proof collected from the quest's marked world location.",
    maxStackSize: 99,
    baseValue: 0,
    binding: "quest" as const,
    isQuestItem: true,
    isCurrency: false,
    isConsumable: false,
    isCraftingMaterial: false,
    isSpellTome: false,
    levelRequirement: 1,
    classRestriction: [] as string[],
    stats: {},
    tradeable: false,
    category: "quest_item",
  };
}

export function reduceHarthmereBibleQuestOperation(
  input: HarthmereBibleQuestReduceInput
): HarthmereBibleQuestReduceResult {
  const warnings: string[] = [];
  const slice = cloneSlice(input.slice);
  const context = buildHarthmereBibleQuestContext({
    actorId: input.actorId,
    playerLevel: input.playerLevel,
    completedQuests: input.completedQuests,
    slice,
    nowMs: input.nowMs,
    weatherClaim: input.weatherClaim,
  });
  const fail = (...reasons: string[]): HarthmereBibleQuestReduceResult => ({
    ok: false,
    warnings: [...warnings, ...reasons.map((r) => `bible_quest_rejected:${r}`)],
    slice: input.slice, // rejected ops leave the slice untouched
  });

  switch (input.operation) {
    case "bible_quest_read": {
      // Pure read: journal for every in-flight quest is assembled by the
      // backend response builder from the slice; nothing to do here.
      return { ok: true, warnings, slice };
    }

    case "bible_quest_accept": {
      if (!input.questId) return fail("quest_required");
      const quest = getHarthmereQuestById(input.questId) as any;
      if (!quest) return fail("missing_quest");
      // Starter twins are owned by the always-on client quest list.
      if (quest.category === "starter") {
        return fail("starter_quests_use_client_twins");
      }
      const result = acceptHarthmereQuest(
        context,
        input.questId,
        `${input.questId}:accept:${input.requestId}`
      );
      if (!result.ok) {
        return fail(...result.reasons);
      }
      // Q12: entering the dragon quest arms the encounter state machine and
      // asks the backend to seed the boss combat snapshot.
      let thaedrynSnapshot: HarthmereBibleQuestReduceResult["thaedrynSnapshot"];
      if (input.questId === HARTHMERE_BIBLE_DRAGON_QUEST_ID) {
        slice.thaedryn = createThaedrynBossState(input.bossMode ?? "group");
        thaedrynSnapshot = "seed";
      }
      const waypoint =
        harthmereBibleQuestObjectiveWaypointOverride(input.questId) ??
        getHarthmereQuestResolvedWaypoint(input.questId, quest.objectives?.[0]);
      return {
        ok: true,
        warnings,
        slice,
        journal: result.journal,
        mapHint: result.mapHint,
        thaedrynSnapshot,
        activeMirror: {
          questId: input.questId,
          entry: {
            stepId: quest.objectives?.[0]?.id,
            progress: 0,
            source: HARTHMERE_BIBLE_QUEST_ACTIVE_SOURCE,
            title: quest.title,
            questKind: quest.category,
            giverName: quest.giverName,
            giverPosition: waypoint,
          },
        },
      };
    }

    case "bible_quest_advance": {
      if (!input.questId) return fail("quest_required");
      const quest = getHarthmereQuestById(input.questId) as any;
      if (!quest) return fail("missing_quest");
      const record = slice.runtime[input.questId];
      if (!record) return fail("quest_not_active");
      const objective = input.objectiveId
        ? (quest.objectives ?? []).find(
            (candidate: any) => candidate.id === input.objectiveId
          )
        : harthmereBibleQuestCurrentObjective(input.questId, record);
      if (!objective) return fail("missing_objective");
      // Q12 waypoint override: validate against the canonical arena anchor.
      const override = harthmereBibleQuestObjectiveWaypointOverride(
        input.questId
      );
      let actorPosition = input.actorPosition;
      if (override && actorPosition) {
        // Translate the actor's real distance-to-anchor into a synthetic
        // position the same distance from the AUTHORED waypoint, preserving
        // the runtime's max-distance semantics without forking its validator.
        const dx = actorPosition[0] - override[0];
        const dy = actorPosition[1] - override[1];
        const dz = actorPosition[2] - override[2];
        const authored = getHarthmereQuestResolvedWaypoint(
          input.questId,
          objective
        );
        if (authored) {
          actorPosition = [
            authored[0] + dx,
            authored[1] + dy,
            authored[2] + dz,
          ];
        }
      }
      const event: HarthmereQuestRuntimeEvent = {
        eventId: `${input.questId}:${objective.id}:${input.requestId}`,
        questId: input.questId,
        objectiveId: objective.id,
        type: objective.type,
        actorId: input.actorId,
        targetId: objective.targetId,
        authority: "server",
        tick: input.nowMs,
        actorPosition,
        // Talk/inspect LoS: the caller stands next to the target; live-mode
        // interactions are proximity-gated client-side and distance-gated
        // here, matching the trust level of every other live-mode claim.
        lineOfSight: true,
        revalidatedChoice:
          objective.type === "choice"
            ? input.choice ?? objective.targetId
            : undefined,
        combatResult:
          objective.type === "combat"
            ? input.combatResult ?? undefined
            : undefined,
        inventoryStateChanged: bibleObjectiveCollectsItem(objective)
          ? true
          : undefined,
      };
      const wasCompleted = Boolean(
        record.objectiveProgress[objective.id]?.completed
      );
      const result = advanceHarthmereQuestObjective(context, event);
      if (!result.ok) return fail(...result.reasons);
      const nextObjective = harthmereBibleQuestCurrentObjective(
        input.questId,
        slice.runtime[input.questId]
      );
      return {
        ok: true,
        warnings,
        slice,
        journal: result.journal,
        mapHint: result.mapHint,
        objectiveItemGrant:
          !wasCompleted && bibleObjectiveCollectsItem(objective)
            ? bibleObjectiveProofItem(input.questId, objective)
            : undefined,
        activeMirror: {
          questId: input.questId,
          entry: {
            stepId: nextObjective?.id ?? objective.id,
            progress: Object.values(
              slice.runtime[input.questId]?.objectiveProgress ?? {}
            ).filter((progress) => progress.completed).length,
            source: HARTHMERE_BIBLE_QUEST_ACTIVE_SOURCE,
            title: quest.title,
            questKind: quest.category,
            giverName: quest.giverName,
            giverPosition:
              harthmereBibleQuestObjectiveWaypointOverride(input.questId) ??
              getHarthmereQuestResolvedWaypoint(input.questId, nextObjective),
          },
        },
      };
    }

    case "bible_quest_complete": {
      if (!input.questId) return fail("quest_required");
      const quest = getHarthmereQuestById(input.questId) as any;
      if (!quest) return fail("missing_quest");
      const result = completeHarthmereQuest(
        context,
        input.questId,
        `${input.questId}:complete:${input.requestId}`
      );
      if (!result.ok) return fail(...result.reasons);
      const record = slice.runtime[input.questId];
      slice.completedAtMs[input.questId] = input.nowMs;
      const rewards = rewardInstructionsForQuest(
        quest,
        record?.rewardGrantId ?? `reward:${input.questId}`
      );
      // Persist earned titles and unlock flags on the slice itself, so
      // activation rules (`requiredFlags`) and the profile UI can read them.
      for (const title of rewards.titles) {
        if (!slice.titles.includes(title)) slice.titles.push(title);
      }
      for (const flag of rewards.unlockFlags) {
        if (!slice.flags.includes(flag)) slice.flags.push(flag);
      }
      // Q12 cleanup: encounter is over regardless of path.
      let thaedrynSnapshot: HarthmereBibleQuestReduceResult["thaedrynSnapshot"];
      if (input.questId === HARTHMERE_BIBLE_DRAGON_QUEST_ID) {
        thaedrynSnapshot = "remove";
      }
      return {
        ok: true,
        warnings,
        slice,
        rewards,
        thaedrynSnapshot,
        activeMirror: { questId: input.questId, remove: true },
        completedMirrorQuestId: input.questId,
      };
    }

    case "bible_quest_abandon": {
      if (!input.questId) return fail("quest_required");
      const result = abandonHarthmereQuest(context, input.questId);
      if (!result.ok) return fail(...result.reasons);
      const thaedrynSnapshot =
        input.questId === HARTHMERE_BIBLE_DRAGON_QUEST_ID
          ? ("remove" as const)
          : undefined;
      if (thaedrynSnapshot) slice.thaedryn = undefined;
      return {
        ok: true,
        warnings,
        slice,
        thaedrynSnapshot,
        activeMirror: { questId: input.questId, remove: true },
      };
    }

    case "bible_quest_retry": {
      if (!input.questId) return fail("quest_required");
      const result = retryHarthmereQuest(context, input.questId);
      if (!result.ok) return fail(...result.reasons);
      const quest = getHarthmereQuestById(input.questId) as any;
      let thaedrynSnapshot: HarthmereBibleQuestReduceResult["thaedrynSnapshot"];
      if (input.questId === HARTHMERE_BIBLE_DRAGON_QUEST_ID) {
        // A retry re-arms the encounter from phase 1 (wipe recovery per the
        // arena's accessibility contract).
        slice.thaedryn = createThaedrynBossState(
          slice.thaedryn?.mode ?? input.bossMode ?? "group"
        );
        thaedrynSnapshot = "seed";
      }
      return {
        ok: true,
        warnings,
        slice,
        thaedrynSnapshot,
        activeMirror: {
          questId: input.questId,
          entry: {
            stepId: quest?.objectives?.[0]?.id,
            progress: 0,
            source: HARTHMERE_BIBLE_QUEST_ACTIVE_SOURCE,
            title: quest?.title,
            questKind: quest?.category,
            giverName: quest?.giverName,
            giverPosition:
              harthmereBibleQuestObjectiveWaypointOverride(input.questId) ??
              getHarthmereQuestResolvedWaypoint(
                input.questId,
                quest?.objectives?.[0]
              ),
          },
        },
      };
    }

    case "bible_quest_boss_event": {
      return reduceHarthmereThaedrynBossEvent(input, slice, context, warnings);
    }

    default:
      return fail("unknown_operation");
  }
}

// ---------------------------------------------------------------------------
// Thaedryn encounter driving.
//
// The boss is BOTH a combat entity snapshot (so native attacks hit it and the
// HUD shows a health bar) and this state machine. The backend forwards:
//   - player attacks on HARTHMERE_THAEDRYN_COMBAT_ENTITY_ID as
//     `damage` events (amount = % of max HP, computed by the backend), and
//   - explicit interactions (chain anchors, handbell, fallen bell, path
//     choice) as `bible_quest_boss_event` operations from the client.
// When the machine resolves a path, Q12's remaining objectives complete and
// the path rewards are granted ON TOP of the quest's own rewards.
// ---------------------------------------------------------------------------
export const HARTHMERE_THAEDRYN_BOSS_EVENT_TYPES = [
  "damage",
  "break_chain",
  "attack_after_third_chain",
  "rebind_ring_cycle",
  "party_wipe",
  "choose_path",
  "resolve",
] as const;

function reduceHarthmereThaedrynBossEvent(
  input: HarthmereBibleQuestReduceInput,
  slice: HarthmereBibleQuestLiveSlice,
  context: HarthmereQuestRuntimeContext,
  warnings: string[]
): HarthmereBibleQuestReduceResult {
  const fail = (...reasons: string[]): HarthmereBibleQuestReduceResult => ({
    ok: false,
    warnings: [...warnings, ...reasons.map((r) => `thaedryn_rejected:${r}`)],
    slice,
  });
  const record = slice.runtime[HARTHMERE_BIBLE_DRAGON_QUEST_ID];
  if (!record || record.state !== "active") {
    return fail("q12_not_active");
  }
  if (!slice.thaedryn) {
    // Defensive re-arm: a state blob from before a deploy could hold an
    // active Q12 without the machine. Never soft-lock; re-create it.
    slice.thaedryn = createThaedrynBossState(input.bossMode ?? "group");
  }
  const eventType = input.bossEventType ?? "";
  if (
    !HARTHMERE_THAEDRYN_BOSS_EVENT_TYPES.includes(
      eventType as (typeof HARTHMERE_THAEDRYN_BOSS_EVENT_TYPES)[number]
    )
  ) {
    return fail("unknown_boss_event");
  }

  if (eventType !== "resolve") {
    slice.thaedryn = applyThaedrynBossEvent(slice.thaedryn, {
      type: eventType,
      amount: input.bossEventAmount,
      path: input.bossEventPath as HarthmereThaedrynPath | undefined,
    });
    // Attacking after the third chain silently arms the wake-collapse rule —
    // surface the phase so the client HUD can telegraph it.
    return {
      ok: true,
      warnings,
      slice,
      thaedrynSnapshot: "sync",
    };
  }

  // "resolve": attempt to finish the encounter along the chosen path.
  const resolution = completeThaedrynBoss(slice.thaedryn);
  if (!resolution.ok) {
    return fail(...resolution.reasons);
  }
  slice.thaedryn = resolution.state as HarthmereThaedrynBossState;
  slice.townPhase = resolution.townPhase;

  // Auto-complete Q12's remaining objectives. Objectives 2–4 are "survive the
  // encounter", "execute the resolution", "apply the path state" — all three
  // are, by definition, satisfied the moment the machine resolves. We drive
  // them through the runtime (not by poking progress records) so ordering,
  // idempotency, and telemetry stay consistent.
  const quest = getHarthmereQuestById(HARTHMERE_BIBLE_DRAGON_QUEST_ID) as any;
  const anchor = harthmereThaedrynArenaWorldAnchor();
  for (const objective of quest.objectives ?? []) {
    if (record.objectiveProgress[objective.id]?.completed) continue;
    const advance = advanceHarthmereQuestObjective(context, {
      eventId: `${quest.id}:${objective.id}:${input.requestId}:resolve`,
      questId: quest.id,
      objectiveId: objective.id,
      type: objective.type,
      actorId: input.actorId,
      targetId: objective.targetId,
      authority: "server",
      tick: input.nowMs,
      // The resolver runs AT the arena: use a synthetic on-waypoint position
      // (the player just fought here; Q12 waypoints are overridden anyway).
      actorPosition: getHarthmereQuestResolvedWaypoint(quest.id, objective) ?? [
        anchor[0],
        anchor[1],
        anchor[2],
      ],
      lineOfSight: true,
      revalidatedChoice:
        objective.type === "choice"
          ? slice.thaedryn.chosenPath ?? "resolved"
          : undefined,
      combatResult:
        objective.type === "combat" ? "encounter_cleared" : undefined,
    });
    if (!advance.ok) {
      warnings.push(
        `thaedryn_resolution_objective_warning:${
          objective.id
        }:${advance.reasons.join("|")}`
      );
    }
  }

  // Path rewards are granted immediately (the quest's own rewards come from
  // the explicit `bible_quest_complete` turn-in that follows).
  const pathRewards = resolution.rewards ?? {};
  const rewardGrantId = `reward:${quest.id}:path:${slice.thaedryn.chosenPath}`;
  let rewards: HarthmereBibleQuestRewardInstructions | undefined;
  if (!slice.grantedRewardIds.includes(rewardGrantId)) {
    slice.grantedRewardIds.push(rewardGrantId);
    rewards = {
      questId: quest.id,
      rewardGrantId,
      xpDelta: Math.max(0, Math.trunc(Number(pathRewards.xp ?? 0) || 0)),
      goldDelta: Math.max(0, Math.trunc(Number(pathRewards.silver ?? 0) || 0)),
      items: (Array.isArray(pathRewards.items) ? pathRewards.items : []).map(
        (name: string) => ({
          // Path reward items are authored as display names ("Thaedryn's
          // Tooth"); slugify for the inventory key, keep the name for the UI.
          itemId: name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_+|_+$/g, ""),
          count: 1,
          displayName: name,
        })
      ),
      titles: (Array.isArray(pathRewards.titles)
        ? pathRewards.titles
        : []
      ).filter((title: unknown): title is string => typeof title === "string"),
      unlockFlags: (Array.isArray(pathRewards.unlocks)
        ? pathRewards.unlocks
        : []
      ).map((unlock: string) =>
        unlock.toLowerCase().replace(/[^a-z0-9]+/g, "_")
      ),
      previewText: resolution.path?.cinematic ?? "",
    };
    for (const title of rewards.titles) {
      if (!slice.titles.includes(title)) slice.titles.push(title);
    }
    for (const flag of rewards.unlockFlags) {
      if (!slice.flags.includes(flag)) slice.flags.push(flag);
    }
  }

  const nextRecord = slice.runtime[HARTHMERE_BIBLE_DRAGON_QUEST_ID];
  return {
    ok: true,
    warnings,
    slice,
    rewards,
    thaedrynSnapshot: "sync",
    activeMirror: {
      questId: quest.id,
      entry: {
        stepId: undefined,
        progress: Object.values(nextRecord?.objectiveProgress ?? {}).filter(
          (progress) => progress.completed
        ).length,
        source: HARTHMERE_BIBLE_QUEST_ACTIVE_SOURCE,
        title: quest.title,
        questKind: quest.category,
        giverName: quest.giverName,
        giverPosition: anchor,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Thaedryn combat entity snapshot.
//
// The dragon's HP pool maps 1:1 to the state machine's healthPct (100 pct =
// HARTHMERE_THAEDRYN_MAX_HP). The backend seeds this snapshot when Q12 goes
// active, syncs hp/phase after every boss event, and forwards attack damage
// into the machine. `retaliatesWhenAttacked` + aggro keep the existing NPC AI
// loop animating it between events.
// ---------------------------------------------------------------------------
export const HARTHMERE_THAEDRYN_MAX_HP = 4000;
export const HARTHMERE_THAEDRYN_LEVEL = 30;

export function harthmereThaedrynCombatSnapshot(
  state: HarthmereThaedrynBossState | undefined,
  nowMs: number
) {
  const anchor = harthmereThaedrynArenaWorldAnchor();
  const healthPct = Math.max(0, Math.min(100, state?.healthPct ?? 100));
  const hp = Math.round((healthPct / 100) * HARTHMERE_THAEDRYN_MAX_HP);
  const phase = state ? getThaedrynPhaseForState(state) : undefined;
  const resolved = state?.completed === true;
  return {
    hp,
    maxHp: HARTHMERE_THAEDRYN_MAX_HP,
    position: { x: anchor[0], y: anchor[1], z: anchor[2] },
    homePosition: { x: anchor[0], y: anchor[1], z: anchor[2] },
    // The Sleeper does not hunt the town: hostile only once engaged, and
    // leashed hard to the arena so the fight cannot be dragged into streets.
    isHostile: false,
    isAlive: !resolved && hp > 0,
    isAttackable: !resolved,
    isLivestock: false,
    species: "dragon",
    level: HARTHMERE_THAEDRYN_LEVEL,
    // "monster" is the closest member of HarthmereLiveEntityKind (there is no
    // dedicated boss kind); the render family + label carry the dragon flavor
    // and `bossQuestId` marks it as the Q12 encounter entity.
    entityKind: "monster",
    movementSpeed: 0, // bound by the bell chains — the dragon does not chase
    bodyRadius: 4.5,
    patrolRadius: 0,
    aggroRange: 10,
    leashRange: 24,
    requiresLineOfSight: true,
    aiEnabled: true,
    retaliatesWhenAttacked: true,
    animationState: "idle",
    animationStartedAtMs: nowMs,
    animationMoving: false,
    facingYaw: Math.PI, // faces the threshold wall / approaching players
    attackRange: 8,
    attackDamage: 14,
    killXp: 0, // XP comes from the path resolution, not a generic kill grant
    displayName: "Thaedryn the Bellbound",
    bossPhaseId: phase?.id,
    bossQuestId: HARTHMERE_BIBLE_DRAGON_QUEST_ID,
  };
}

/**
 * Convert raw attack damage on the Thaedryn snapshot into a state-machine
 * damage event (percent of max HP), plus the wake-collapse tracking event
 * when attacks land after the third chain is broken.
 */
export function harthmereThaedrynDamageEventsForAttack(
  state: HarthmereThaedrynBossState,
  damage: number
): Array<{ type: string; amount?: number }> {
  const pct = Math.max(0, (damage / HARTHMERE_THAEDRYN_MAX_HP) * 100);
  const events: Array<{ type: string; amount?: number }> = [
    { type: "damage", amount: pct },
  ];
  if (state.chainsRemaining <= 1) {
    events.push({ type: "attack_after_third_chain" });
  }
  return events;
}

// ---------------------------------------------------------------------------
// Reachability contract (see header). Kept pure so both mocha tests and the
// plain-node audit scripts can call it.
// ---------------------------------------------------------------------------
export interface HarthmereDragonQuestReachabilityReport {
  ok: boolean;
  failures: string[];
  arenaWorldAnchor: [number, number, number];
  mainChainQuestIds: string[];
}

export function validateHarthmereDragonQuestReachability(): HarthmereDragonQuestReachabilityReport {
  const failures: string[] = [];
  const anchor = harthmereThaedrynArenaWorldAnchor();

  // 1. The arena anchor must sit inside the connected-town world envelope
  //    (authored town + wilds strip; generous bounds chosen from the district
  //    layout and the connector road so a regression is loud, not flaky).
  const authored = HARTHMERE_THAEDRYN_ARENA_AUTHORED_ANCHOR;
  if (
    authored[0] < 300 ||
    authored[0] > 800 ||
    authored[2] < -500 ||
    authored[2] > 0
  ) {
    failures.push(
      `arena anchor ${authored.join(",")} left the Harthmere town envelope`
    );
  }

  // 2. Every main-chain quest must exist, be reachable through prerequisites
  //    (no quest may depend on a missing/hidden-forever quest), and resolve a
  //    waypoint.
  const mainChain = (HARTHMERE_QUEST_CATALOG as readonly any[])
    .filter((quest) => quest.category === "main")
    .map((quest) => quest.id);
  for (const questId of mainChain) {
    const quest = getHarthmereQuestById(questId) as any;
    if (!quest) {
      failures.push(`main quest ${questId} missing from catalog`);
      continue;
    }
    for (const prerequisite of quest.activeRules?.prerequisiteQuestIds ?? []) {
      if (!getHarthmereQuestById(prerequisite)) {
        failures.push(
          `main quest ${questId} depends on missing quest ${prerequisite}`
        );
      }
    }
    const waypoint =
      harthmereBibleQuestObjectiveWaypointOverride(questId) ??
      getHarthmereQuestResolvedWaypoint(questId, quest.objectives?.[0]);
    if (!waypoint) {
      failures.push(`main quest ${questId} resolves no waypoint`);
    }
  }

  // 3. Every main-chain giver must be offerable: either hidden (world
  //    trigger) or present in the derived giver map.
  const byGiver = harthmereBibleQuestsByGiver();
  for (const questId of mainChain) {
    const quest = getHarthmereQuestById(questId) as any;
    if (quest?.hidden) continue;
    if (!quest?.giverId || !byGiver[quest.giverId]?.includes(questId)) {
      failures.push(`main quest ${questId} has no offering giver`);
    }
  }

  // 4. The arena quest-space contract must still exist with its encounter.
  const space = getHarthmereMainQuestSpaceById("wyrms_bed_thaedryn_arena");
  if (!space) {
    failures.push("wyrms_bed_thaedryn_arena quest space missing");
  } else if (!(space.encounters ?? []).includes("thaedryn_the_bellbound")) {
    failures.push("arena space lost its thaedryn_the_bellbound encounter");
  }

  return {
    ok: failures.length === 0,
    failures,
    arenaWorldAnchor: anchor,
    mainChainQuestIds: mainChain,
  };
}
