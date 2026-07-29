// HARTHMERE_BIBLE_QUEST_WIRING (bible-wiring fix, 2026-07-14) — client
// adapter for the bible quest catalog.
//
// Everything stateful lives server-side (bible_quest_live_authority.ts via
// live_mode); this file only (1) posts operations, (2) matches a rendered
// NPC's label to a catalog giver, and (3) builds the dialog/journal models
// from the server's quest snapshot. The model builders are pure so they are
// unit-testable without React or a browser.

import {
  HARTHMERE_BIBLE_DRAGON_QUEST_ID,
  buildHarthmereBibleQuestContext,
  harthmereBibleQuestCurrentObjective,
  harthmereBibleQuestOffersForGiver,
  harthmereBibleQuestsByGiver,
  harthmereThaedrynArenaWorldAnchor,
  normalizeHarthmereBibleQuestLiveSlice,
  type HarthmereBibleQuestLiveSlice,
  type HarthmereBibleQuestOffer,
} from "@/shared/harthmere/bible_quest_live_authority";
import { fetchHarthmereLiveWithTimeout } from "@/client/components/harthmere_live_fetch";
import {
  BIBLE_QUEST_CATALOG as HARTHMERE_QUEST_CATALOG,
  bibleQuest as getHarthmereQuestById,
} from "@/shared/harthmere/bible/bible_quest_catalog";
import {
  bibleQuestWorldWaypoint,
  bibleStepWorldWaypoint,
} from "@/shared/harthmere/bible/bible_waypoints";
import { harthmereBibleNativeSnapshotFromMirror } from "@/shared/harthmere/bible_quest_live_authority";
import {
  HARTHMERE_ALL_NPCS,
  harthmereNamedNpcById,
} from "@/shared/harthmere/npc_compendium";
import { bibleQuestGiverId } from "@/shared/harthmere/bible/bible_quest_schema";

export const HARTHMERE_BIBLE_QUEST_CLIENT_VERSION =
  "harthmere-bible-quest-client" as const;

/** Window event fired after every successful bible mutation so open dialogs,
 * the journal, and the encounter HUD refresh without polling. */
export const HARTHMERE_BIBLE_QUEST_EVENT =
  "biomes:harthmere-bible-quest-changed" as const;

// ---------------------------------------------------------------------------
// Label -> giver matching.
//
// Rendered NPCs carry display labels ("Reeve Caldus Merrow", sometimes with
// suffixes like role/district text); quest givers are catalog ids
// ("reeve_caldus_merrow"). We match by the NPC compendium name — every quest
// giver is a compendium NPC (enforced by the bible-grounded checks).
// ---------------------------------------------------------------------------
const giverIdsByNormalizedName: Map<string, string> = (() => {
  const map = new Map<string, string>();
  const givers = Object.keys(harthmereBibleQuestsByGiver());
  for (const giverId of givers) {
    const npc =
      harthmereNamedNpcById(giverId) ??
      (HARTHMERE_ALL_NPCS as readonly any[]).find(
        (candidate) => candidate.id === giverId
      );
    const name = String(npc?.name ?? "")
      .toLowerCase()
      .trim();
    if (name) map.set(name, giverId);
    // The quest catalog's own giverName can differ slightly from the
    // compendium name ("Sergeant Bram Holt" vs "Sergeant Bramwell Holt");
    // index every authored spelling so the shorter snapshot display label
    // (for example "Father Aldren") still resolves to the canonical giver.
    for (const quest of HARTHMERE_QUEST_CATALOG) {
      if (bibleQuestGiverId(quest) !== giverId) continue;
      const catalogName = String(quest.giverName ?? "")
        .toLowerCase()
        .trim();
      if (catalogName) map.set(catalogName, giverId);
    }
    map.set(giverId.replace(/_/g, " "), giverId);
  }
  return map;
})();

/**
 * Resolve the bible giver id for a rendered NPC label, or undefined when the
 * NPC gives no bible quests. Substring match (label may carry decorations),
 * longest-name-first so "Veska Reed" cannot shadow "Sella Reedfoot".
 */
export function harthmereBibleGiverIdForNpcLabel(
  label: string | undefined
): string | undefined {
  const normalized = (label ?? "").toLowerCase().trim();
  if (!normalized) return undefined;
  let best: { name: string; giverId: string } | undefined;
  for (const [name, giverId] of giverIdsByNormalizedName) {
    if (!normalized.includes(name)) continue;
    if (!best || name.length > best.name.length) {
      best = { name, giverId };
    }
  }
  return best?.giverId;
}

// ---------------------------------------------------------------------------
// Live-mode transport. Mirrors the live-entity-helper adapter (same endpoint,
// same install-id passthrough) so glitch/embed sessions keep working.
// ---------------------------------------------------------------------------
function liveModeUrl(search?: string) {
  const rawSearch =
    search ??
    (typeof window !== "undefined" ? window.location?.search ?? "" : "");
  const params = new URLSearchParams(rawSearch);
  const installId = params.get("install_id") ?? params.get("installId");
  const endpoint = "/api/harthmere/live_mode";
  return installId
    ? `${endpoint}?install_id=${encodeURIComponent(installId)}`
    : endpoint;
}

function liveModeQuestStateUrl(search?: string, readGeneration?: number) {
  const rawSearch =
    search ??
    (typeof window !== "undefined" ? window.location?.search ?? "" : "");
  const params = new URLSearchParams(rawSearch);
  const installId = params.get("install_id") ?? params.get("installId");
  const endpoint = "/api/harthmere/live_mode_quest_state";
  const endpointParams = new URLSearchParams();
  if (installId) endpointParams.set("install_id", installId);
  // The shared live-fetch layer deliberately coalesces identical GETs. A
  // forced refresh after fixture invalidation therefore needs a distinct URL
  // or it can inherit the exact pre-reset request we are trying to replace.
  if (readGeneration !== undefined) {
    endpointParams.set("bible_read_generation", String(readGeneration));
  }
  const query = endpointParams.toString();
  return query ? `${endpoint}?${query}` : endpoint;
}

function liveModeHeaders(search?: string) {
  const rawSearch =
    search ??
    (typeof window !== "undefined" ? window.location?.search ?? "" : "");
  const params = new URLSearchParams(rawSearch);
  const installId = params.get("install_id") ?? params.get("installId");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (installId) headers["X-Glitch-Install-Id"] = installId;
  return headers;
}

export interface HarthmereBibleQuestClientSnapshot {
  actorId?: string;
  playerLevel?: number;
  serverNowMs?: number;
  weatherClaim?: string;
  /** quests.active mirror (all sources; bible entries have source tag). */
  active: Record<string, any>;
  completed: Record<string, number>;
  bible: HarthmereBibleQuestLiveSlice;
  warnings: string[];
}


// ---------------------------------------------------------------------------
// Quest state, derived from the native mirrors.
//
// `bible.runtime` is gone: native `Challenges`/`TriggerState` own progress
// after the Chapter 1-shape migration, and the client sees that through the
// `quests.active` / `quests.completed` mirrors it already receives. This
// helper is the ONE place that translates them, so no call site re-invents a
// state enum.
// ---------------------------------------------------------------------------
type BibleClientQuestState =
  | "unknown"
  | "active"
  | "ready_to_complete"
  | "completed";

function bibleClientQuestState(
  snapshot: HarthmereBibleQuestClientSnapshot,
  questId: string
): BibleClientQuestState {
  if (snapshot.completed[questId] !== undefined) return "completed";
  const active = snapshot.active[questId];
  if (active === undefined) return "unknown";
  const quest = getHarthmereQuestById(questId);
  if (!quest) return "active";
  const native = harthmereBibleNativeSnapshotFromMirror({
    questId,
    activeStepId: active?.stepId,
    activeProgress: active?.progress,
    active: true,
    completed: false,
  });
  return native.firedStepIds.length >= quest.steps.length
    ? "ready_to_complete"
    : "active";
}

function bibleClientFiredStepIds(
  snapshot: HarthmereBibleQuestClientSnapshot,
  questId: string
): ReadonlySet<string> {
  return new Set(
    harthmereBibleNativeSnapshotFromMirror({
      questId,
      activeStepId: snapshot.active[questId]?.stepId,
      activeProgress: snapshot.active[questId]?.progress,
      active: snapshot.active[questId] !== undefined,
      completed: snapshot.completed[questId] !== undefined,
    }).firedStepIds
  );
}

const HARTHMERE_BIBLE_QUEST_READ_CACHE_MS = 14_000;
let cachedBibleQuestSnapshot:
  | { snapshot: HarthmereBibleQuestClientSnapshot; readAtMs: number }
  | undefined;
let bibleQuestSnapshotReadInFlight:
  | Promise<HarthmereBibleQuestClientSnapshot>
  | undefined;
// A reset cannot cancel a fetch that is already inside the browser network
// stack. Track cache generations so an older response can never overwrite a
// newer fixture, mutation response, or poll result after invalidation.
let bibleQuestSnapshotGeneration = 0;

function rememberBibleQuestSnapshot(
  snapshot: HarthmereBibleQuestClientSnapshot,
  nowMs: number = Date.now()
) {
  cachedBibleQuestSnapshot = { snapshot, readAtMs: nowMs };
  return snapshot;
}

export function resetHarthmereBibleQuestReadCacheForTest() {
  bibleQuestSnapshotGeneration += 1;
  cachedBibleQuestSnapshot = undefined;
  bibleQuestSnapshotReadInFlight = undefined;
}

export function harthmereBibleQuestSnapshotFromResponse(
  body: any
): HarthmereBibleQuestClientSnapshot {
  const questState = body?.questState ?? {};
  return {
    actorId:
      typeof questState.actorId === "string" ? questState.actorId : undefined,
    playerLevel: Number.isFinite(Number(questState.playerLevel))
      ? Math.max(1, Math.trunc(Number(questState.playerLevel)))
      : undefined,
    serverNowMs: Number.isFinite(Number(questState.serverNowMs))
      ? Number(questState.serverNowMs)
      : undefined,
    weatherClaim:
      typeof questState.weatherClaim === "string"
        ? questState.weatherClaim
        : undefined,
    active:
      questState.active && typeof questState.active === "object"
        ? questState.active
        : {},
    completed:
      questState.completed && typeof questState.completed === "object"
        ? questState.completed
        : {},
    bible: normalizeHarthmereBibleQuestLiveSlice(questState.bible),
    warnings: Array.isArray(body?.backendMutation?.warnings)
      ? body.backendMutation.warnings.map(String)
      : [],
  };
}

export class HarthmereBibleQuestRejectionError extends Error {
  constructor(public readonly warnings: string[]) {
    super(warnings.join(","));
    this.name = "HarthmereBibleQuestRejectionError";
  }
}

/**
 * POST a bible quest operation. The API layer stamps the true server-side
 * actor position onto the envelope, so objective distance checks cannot be
 * spoofed from here — this function never sends coordinates.
 */
export async function submitHarthmereBibleQuestOperation(
  payload: Record<string, unknown>,
  options: { fetchImpl?: typeof fetch; locationSearch?: string } = {}
): Promise<HarthmereBibleQuestClientSnapshot> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const requestId = `bible_quest_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;
  const response = await fetchHarthmereLiveWithTimeout(
    fetchImpl,
    liveModeUrl(options.locationSearch),
    {
      method: "POST",
      credentials: "same-origin",
      headers: liveModeHeaders(options.locationSearch),
      body: JSON.stringify({
        requestId,
        idempotencyKey: requestId,
        actionKind: "request_quest_state_update",
        subsystem: "quest",
        actorEntityVersion: 1,
        zoneId: "harthmere",
        clientSentAtMs: Date.now(),
        payload,
        clientClaims: {},
      }),
    }
  );
  const body = await response.json();
  const snapshot = harthmereBibleQuestSnapshotFromResponse(body);
  if (!response.ok || body?.ok === false) {
    throw new Error(
      body?.error ??
        body?.validation?.errors?.join(",") ??
        "bible_quest_request_failed"
    );
  }
  const rejections = snapshot.warnings.filter(
    (warning) =>
      warning.startsWith("bible_quest_rejected") ||
      warning.startsWith("thaedryn_rejected")
  );
  if (rejections.length) {
    throw new HarthmereBibleQuestRejectionError(rejections);
  }
  // The mutation response is newer than every GET already in flight. Advance
  // the generation before remembering it so a slower read cannot restore the
  // pre-action quest list after accept, objective, or turn-in succeeds.
  bibleQuestSnapshotGeneration += 1;
  bibleQuestSnapshotReadInFlight = undefined;
  rememberBibleQuestSnapshot(snapshot);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(HARTHMERE_BIBLE_QUEST_EVENT));
  }
  return snapshot;
}

export async function readHarthmereBibleQuestSnapshot(
  options: {
    fetchImpl?: typeof fetch;
    locationSearch?: string;
    maxAgeMs?: number;
    nowMs?: number;
  } = {}
) {
  const nowMs = options.nowMs ?? Date.now();
  const maxAgeMs = options.maxAgeMs ?? HARTHMERE_BIBLE_QUEST_READ_CACHE_MS;
  if (
    cachedBibleQuestSnapshot &&
    nowMs - cachedBibleQuestSnapshot.readAtMs < maxAgeMs
  ) {
    return cachedBibleQuestSnapshot.snapshot;
  }
  if (bibleQuestSnapshotReadInFlight) {
    return bibleQuestSnapshotReadInFlight;
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const requestGeneration = bibleQuestSnapshotGeneration;
  const request = (async () => {
    const response = await fetchHarthmereLiveWithTimeout(
      fetchImpl,
      liveModeQuestStateUrl(
        options.locationSearch,
        maxAgeMs <= 0 ? requestGeneration : undefined
      ),
      {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: liveModeHeaders(options.locationSearch),
      }
    );
    const body = await response.json();
    if (!response.ok || body?.ok === false) {
      throw new Error(body?.error ?? "bible_quest_read_failed");
    }
    return harthmereBibleQuestSnapshotFromResponse(body);
  })();
  bibleQuestSnapshotReadInFlight = request;
  try {
    const snapshot = await request;
    if (requestGeneration !== bibleQuestSnapshotGeneration) {
      // A newer generation owns the cache. Consumers awaiting this older
      // promise must also receive the newest snapshot; returning the stale
      // body would still let a React hook temporarily erase current actions.
      if (cachedBibleQuestSnapshot) {
        return cachedBibleQuestSnapshot.snapshot;
      }
      if (bibleQuestSnapshotReadInFlight === request) {
        bibleQuestSnapshotReadInFlight = undefined;
      }
      return readHarthmereBibleQuestSnapshot({
        ...options,
        maxAgeMs: 0,
      });
    }
    return rememberBibleQuestSnapshot(
      snapshot,
      options.nowMs ?? Date.now()
    );
  } finally {
    if (bibleQuestSnapshotReadInFlight === request) {
      bibleQuestSnapshotReadInFlight = undefined;
    }
  }
}

// ---------------------------------------------------------------------------
// Dialog model. Pure: snapshot in, actions out.
// ---------------------------------------------------------------------------
export interface HarthmereBibleDialogAction {
  kind: "accept" | "objective" | "turn_in";
  questId: string;
  objectiveId?: string;
  /** Button label shown in the talk dialog. */
  name: string;
  /** Dialogue text shown after the action succeeds. */
  followUpText: string;
  tooltip?: string;
  /** For choice objectives: the choice value the server revalidates. */
  choice?: string;
  /** Combat objectives must carry server-revalidated encounter evidence. */
  combatResult?: "encounter_cleared";
}

export interface HarthmereBibleDialogModel {
  giverId: string;
  /** Flavor line prepended to the NPC's normal dialog when quests exist. */
  introText?: string;
  actions: HarthmereBibleDialogAction[];
  offers: Array<
    HarthmereBibleQuestOffer & {
      state: "available" | "active" | "ready_to_complete" | "locked";
    }
  >;
}

/**
 * Build the talk-dialog model for an NPC. Covers the full loop:
 *   available  -> "Accept: <title>"
 *   active     -> current objective as an action (every objective of a bible
 *                 quest shares the quest's waypoint, where the giver stands,
 *                 so advancing from the giver's dialog is always in range)
 *   ready      -> "Complete: <title>" turn-in
 */
export function harthmereBibleDialogModelForGiver(input: {
  giverId: string;
  snapshot: HarthmereBibleQuestClientSnapshot;
  actorId?: string;
  playerLevel?: number;
  nowMs?: number;
}): HarthmereBibleDialogModel {
  const nowMs = input.nowMs ?? input.snapshot.serverNowMs ?? Date.now();
  const context = buildHarthmereBibleQuestContext({
    actorId: input.actorId ?? input.snapshot.actorId ?? "local-player",
    playerLevel: input.playerLevel ?? input.snapshot.playerLevel ?? 1,
    completedQuests: input.snapshot.completed,
    slice: input.snapshot.bible,
    nowMs,
    weatherClaim: input.snapshot.weatherClaim,
  });
  const inProgressQuestIds = new Set(
    Object.keys(input.snapshot.active).filter(
      (questId) => input.snapshot.active[questId]?.source === "bible_catalog"
    )
  );
  const availableOffers = harthmereBibleQuestOffersForGiver({
    giverId: input.giverId,
    context,
    inProgressQuestIds,
  });
  const offers: HarthmereBibleDialogModel["offers"] = availableOffers.map(
    (offer) => ({
      ...offer,
      state: offer.blockedReasons?.length ? "locked" : "available",
    })
  );
  for (const questId of harthmereBibleQuestsByGiver()[input.giverId] ?? []) {
    const state = bibleClientQuestState(input.snapshot, questId);
    if (state !== "active" && state !== "ready_to_complete") continue;
    const quest = getHarthmereQuestById(questId);
    if (!quest) continue;
    offers.push({
      questId,
      title: quest.title,
      premise: quest.premise,
      offerText: quest.dialogue.offer,
      rewardPreview: quest.rewards.previewText,
      levelBand: { ...quest.gate.levelBand },
      estimatedMinutes: quest.estimatedMinutes,
      state,
    });
  }
  const actions: HarthmereBibleDialogAction[] = [];
  for (const offer of offers) {
    const quest = getHarthmereQuestById(offer.questId) as any;
    if (!quest) continue;
    if (offer.state === "available") {
      actions.push({
        kind: "accept",
        questId: offer.questId,
        name: `Accept: ${offer.title}`,
        followUpText: quest.dialogue?.offer ?? "",
        tooltip: offer.rewardPreview,
      });
      continue;
    }
    if (offer.state === "active") {
      // Active objective mutations belong at their server-validated world
      // waypoint, not in the giver's dialog. Many authored objective sites are
      // tens or hundreds of metres from the giver; exposing the action here
      // made the visible button deterministically fail with player_too_far.
      // HarthmereBibleQuestRuntimeController renders the shared contextual
      // world panel for these active objectives instead.
      continue;
    }
    if (offer.state === "ready_to_complete") {
      actions.push({
        kind: "turn_in",
        questId: offer.questId,
        name: `Complete: ${offer.title}`,
        followUpText: quest.dialogue?.complete ?? "",
        tooltip: offer.rewardPreview,
      });
    }
  }
  return {
    giverId: input.giverId,
    introText: actions.length
      ? undefined
      : offers.some((offer) => offer.state === "locked")
      ? "They have more to ask of you — but not yet."
      : undefined,
    actions,
    offers,
  };
}

/** Live-mode payload for a dialog action (posted on click). */
export function harthmereBibleOperationPayloadForAction(
  action: HarthmereBibleDialogAction
): Record<string, unknown> {
  if (action.kind === "accept") {
    return { operation: "bible_quest_accept", questId: action.questId };
  }
  if (action.kind === "turn_in") {
    return { operation: "bible_quest_complete", questId: action.questId };
  }
  return {
    operation: "bible_quest_advance",
    questId: action.questId,
    objectiveId: action.objectiveId,
    choice: action.choice,
    combatResult: action.combatResult,
  };
}

export interface HarthmereBibleQuestInteractionModel {
  questId: string;
  title: string;
  objective?: string;
  nearObjective: boolean;
  hidden: boolean;
  action?: HarthmereBibleDialogAction;
}

function harthmereBibleQuestInteractionCandidates(input: {
  snapshot: HarthmereBibleQuestClientSnapshot;
  playerPosition: readonly [number, number, number] | undefined;
  hiddenOnly?: boolean;
}): Array<HarthmereBibleQuestInteractionModel & { distance: number }> {
  const candidates: Array<
    HarthmereBibleQuestInteractionModel & { distance: number }
  > = [];
  for (const active of HARTHMERE_QUEST_CATALOG) {
    const state = bibleClientQuestState(input.snapshot, active.id);
    if (input.hiddenOnly && !active.hidden) continue;
    // Q12 owns a dedicated encounter HUD while active, but after resolution
    // it still needs the ordinary giver-less completion button.
    if (
      active.id === HARTHMERE_BIBLE_DRAGON_QUEST_ID &&
      state !== "ready_to_complete"
    ) {
      continue;
    }
    if (
      state !== "active" &&
      !(active.hidden && state === "ready_to_complete")
    ) {
      continue;
    }

    const objective = harthmereBibleQuestCurrentObjective(
      active.id,
      bibleClientFiredStepIds(input.snapshot, active.id)
    );
    // Grounded. The authored Y is 0 on 312 of 340 steps and would put this
    // proximity check underground.
    const waypoint = objective
      ? bibleStepWorldWaypoint(active, objective)
      : bibleQuestWorldWaypoint(active);
    const maxDistance = Math.max(
      active.hidden ? HARTHMERE_BIBLE_HIDDEN_TRIGGER_RADIUS : 0,
      objective?.validation.maxDistance ?? 6
    );
    const distance =
      input.playerPosition && waypoint
        ? Math.hypot(
            input.playerPosition[0] - waypoint[0],
            input.playerPosition[2] - waypoint[2]
          )
        : Number.POSITIVE_INFINITY;
    const action: HarthmereBibleDialogAction | undefined =
      state === "ready_to_complete"
        ? {
            kind: "turn_in",
            questId: active.id,
            name: `Complete: ${active.title}`,
            followUpText: active.dialogue.complete,
            tooltip: active.rewards.previewText,
          }
        : objective
        ? {
            kind: "objective",
            questId: active.id,
            objectiveId: objective.id,
            name: objective.label,
            followUpText: active.dialogue.active,
            tooltip: `Objective ${objective.id.slice(-2)} of ${active.steps.length}`,
            choice:
              objective.type === "choice" ? objective.targetId : undefined,
            combatResult:
              objective.type === "combat" ? "encounter_cleared" : undefined,
          }
        : undefined;
    candidates.push({
      questId: active.id,
      title: active.title,
      objective: objective?.label,
      nearObjective: distance <= maxDistance,
      hidden: Boolean(active.hidden),
      action,
      distance,
    });
  }
  return candidates.sort((left, right) => left.distance - right.distance);
}

/**
 * Every active Bible objective is completed at its server-validated world
 * waypoint. Hidden quests additionally use this surface for giver-less turn-in.
 */
export function harthmereBibleQuestInteractionModel(input: {
  snapshot: HarthmereBibleQuestClientSnapshot;
  playerPosition: readonly [number, number, number] | undefined;
}): HarthmereBibleQuestInteractionModel | undefined {
  const candidate = harthmereBibleQuestInteractionCandidates(input)[0];
  if (!candidate) return undefined;
  const { distance: _distance, ...model } = candidate;
  return model;
}

/** Compatibility helper retained for callers/tests specifically auditing the
 * three giver-less hidden quests. */
export function harthmereBibleHiddenQuestInteractionModel(input: {
  snapshot: HarthmereBibleQuestClientSnapshot;
  playerPosition: readonly [number, number, number] | undefined;
}): HarthmereBibleQuestInteractionModel | undefined {
  const candidate = harthmereBibleQuestInteractionCandidates({
    ...input,
    hiddenOnly: true,
  })[0];
  if (!candidate) return undefined;
  const { distance: _distance, ...model } = candidate;
  return model;
}

// ---------------------------------------------------------------------------
// Journal / map model. Appended by mapLiveAdapter.getTrackableQuests.
// ---------------------------------------------------------------------------
export function bibleQuestTrackableQuestsForBiomesUI(snapshot: {
  active?: Record<string, any>;
  completed?: Record<string, number>;
}): Array<Record<string, unknown>> {
  const entries: Array<Record<string, unknown>> = [];
  for (const [questId, activeEntry] of Object.entries(snapshot.active ?? {})) {
    if ((activeEntry as any)?.source !== "bible_catalog") continue;
    const quest = getHarthmereQuestById(questId);
    if (!quest) continue;
    const objectives = quest.steps.map((step) => step.label);
    const progress = Number((activeEntry as any)?.progress ?? 0);
    entries.push({
      questId,
      title: quest.title,
      area: quest.district ?? "Harthmere",
      status: "active",
      // Marker: the backend mirrors the resolved waypoint into giverPosition.
      markerWorldPosition: (activeEntry as any)?.giverPosition,
      firstMarkerId: `bible_quest_marker:${questId}`,
      reward: quest.rewards?.previewText ?? "",
      kind: quest.category === "main" ? "main_story" : "bible_side_quest",
      kindLabel: quest.category === "main" ? "Main Story" : "Side Quest",
      objective:
        objectives[Math.min(progress, Math.max(0, objectives.length - 1))],
      objectives,
      description: quest.premise ?? quest.dialogue.active,
    });
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Hidden quests (world triggers): the 3 side_hidden quests have no giver.
// The runtime controller polls player position; when the player stands within
// the trigger radius and activation rules pass (e.g. the storm-gated ones),
// it auto-accepts so the journal starts guiding. Pure helper below picks the
// quest to trigger.
// ---------------------------------------------------------------------------
export const HARTHMERE_BIBLE_HIDDEN_TRIGGER_RADIUS = 8;

export function harthmereBibleHiddenQuestToTrigger(input: {
  playerPosition: readonly [number, number, number] | undefined;
  snapshot: HarthmereBibleQuestClientSnapshot;
  nowMs?: number;
}): string | undefined {
  if (!input.playerPosition) return undefined;
  for (const quest of HARTHMERE_QUEST_CATALOG) {
    if (!quest.hidden) continue;
    // already known
    if (bibleClientQuestState(input.snapshot, quest.id) !== "unknown") continue;
    if (input.snapshot.completed[quest.id]) continue;
    const waypoint = quest.steps[0]
      ? bibleStepWorldWaypoint(quest, quest.steps[0])
      : bibleQuestWorldWaypoint(quest);
    if (!waypoint) continue;
    const dx = input.playerPosition[0] - waypoint[0];
    const dz = input.playerPosition[2] - waypoint[2];
    if (Math.hypot(dx, dz) <= HARTHMERE_BIBLE_HIDDEN_TRIGGER_RADIUS) {
      return quest.id;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Thaedryn encounter HUD model (client side of the boss loop).
// ---------------------------------------------------------------------------
export interface HarthmereThaedrynEncounterModel {
  active: boolean;
  nearArena: boolean;
  phaseId?: string;
  healthPct?: number;
  chainsRemaining?: number;
  chosenPath?: string;
  ringCycles?: number;
  completed?: boolean;
  actions: Array<{
    id: string;
    label: string;
    payload: Record<string, unknown>;
    disabled?: boolean;
    tooltip?: string;
  }>;
}

export const HARTHMERE_THAEDRYN_ENCOUNTER_UI_RADIUS = 40;

export function harthmereThaedrynEncounterModel(input: {
  snapshot: HarthmereBibleQuestClientSnapshot;
  playerPosition: readonly [number, number, number] | undefined;
}): HarthmereThaedrynEncounterModel {
  const dragonState = bibleClientQuestState(
    input.snapshot,
    HARTHMERE_BIBLE_DRAGON_QUEST_ID
  );
  const machine = input.snapshot.bible.thaedryn;
  const anchor = harthmereThaedrynArenaWorldAnchor();
  const nearArena = input.playerPosition
    ? Math.hypot(
        input.playerPosition[0] - anchor[0],
        input.playerPosition[2] - anchor[2]
      ) <= HARTHMERE_THAEDRYN_ENCOUNTER_UI_RADIUS
    : false;
  const active = dragonState === "active" && !!machine && !machine.completed;
  if (!active || !nearArena) {
    return { active, nearArena, actions: [] };
  }
  const boss = (
    bossEventType: string,
    extra: Record<string, unknown> = {}
  ) => ({
    operation: "bible_quest_boss_event",
    // The backend needs the quest id to materialize Q12's resolved objectives
    // into native ECS. Omitting it let the live boss machine finish while the
    // synchronized native challenge remained active.
    questId: HARTHMERE_BIBLE_DRAGON_QUEST_ID,
    bossEventType,
    ...extra,
  });
  const chains = machine!.chainsRemaining;
  const path = machine!.chosenPath;
  return {
    active,
    nearArena,
    phaseId: machine!.phaseId,
    healthPct: machine!.healthPct,
    chainsRemaining: chains,
    chosenPath: path,
    ringCycles: machine!.rebindRingCyclesCompleted,
    completed: machine!.completed,
    actions: [
      {
        id: "break_chain",
        label: `Break Bell-Chain Anchor (${chains} left)`,
        payload: boss("break_chain"),
        disabled: chains <= 0,
        tooltip:
          "Strike a chain anchor. Each broken chain pushes the encounter a phase deeper.",
      },
      {
        id: "ring_cycle",
        label: `Ring the Fallen Bell (${machine!.rebindRingCyclesCompleted}/3)`,
        payload: boss("rebind_ring_cycle"),
        tooltip:
          "Rebind path: complete three ring cycles, keep the dragon alive.",
      },
      {
        id: "choose_rebind",
        label: "Commit: Rebind Thaedryn",
        payload: boss("choose_path", { bossEventPath: "rebind" }),
        disabled: path === "rebind",
      },
      {
        id: "choose_slay",
        label: "Commit: Slay Thaedryn",
        payload: boss("choose_path", { bossEventPath: "slay" }),
        disabled: path === "slay",
      },
      {
        id: "choose_wake",
        label: "Commit: Wake Thaedryn (hold fire)",
        payload: boss("choose_path", { bossEventPath: "wake" }),
        disabled: path === "wake",
      },
      {
        id: "resolve",
        label: "Resolve the Encounter",
        payload: boss("resolve"),
        disabled: !path,
        tooltip:
          "Finish along the committed path. The server validates the path's requirements (chains, health, ring cycles, restraint).",
      },
    ],
  };
}
