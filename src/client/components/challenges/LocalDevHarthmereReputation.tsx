import type { TalkDialogStepAction } from "@/client/components/challenges/TalkDialogModalStep";
import React, { useEffect, useMemo, useState } from "react";

const HARTHMERE_REPUTATION_STATE_KEY =
  "biomes.localDev.harthmere.reputation.v1";
const HARTHMERE_REPUTATION_EVENT = "biomes:harthmere-reputation-changed";

export type HarthmereReputationScope = "global" | "harthmere" | "personal";

export interface HarthmereReputationScore {
  likeability: number;
  legal: number;
  notoriety: number;
  notorietyFloor: number;
}

export interface HarthmereReputationRecentEvent {
  id: string;
  at: number;
  label: string;
  detail: string;
  scope: HarthmereReputationScope;
  npcOffset?: number;
  likeability?: number;
  legal?: number;
  notoriety?: number;
}

export interface HarthmereReputationState {
  version: 1;
  global: HarthmereReputationScore;
  regions: {
    harthmere: HarthmereReputationScore;
  };
  personal: Record<number, HarthmereReputationScore>;
  recent: HarthmereReputationRecentEvent[];
}

export interface HarthmereReputationDelta {
  likeability?: number;
  legal?: number;
  notoriety?: number;
  notorietyFloor?: number;
}

interface HarthmereReputationChange {
  label: string;
  detail: string;
  scope?: HarthmereReputationScope;
  npcOffset?: number;
  global?: HarthmereReputationDelta;
  harthmere?: HarthmereReputationDelta;
  personal?: HarthmereReputationDelta;
}

interface TierDefinition {
  min: number;
  max: number;
  rank: string;
  summary: string;
}

const EMPTY_SCORE: HarthmereReputationScore = {
  likeability: 0,
  legal: 0,
  notoriety: 0,
  notorietyFloor: 0,
};

const EMPTY_STATE: HarthmereReputationState = {
  version: 1,
  global: { ...EMPTY_SCORE },
  regions: {
    harthmere: { ...EMPTY_SCORE },
  },
  personal: {},
  recent: [],
};

const LIKEABILITY_TIERS: TierDefinition[] = [
  {
    min: 8000,
    max: 10000,
    rank: "Beloved Hero",
    summary: "NPCs cheer, offer gifts, and trust you deeply.",
  },
  {
    min: 5000,
    max: 7999,
    rank: "Admired",
    summary: "People greet you warmly and give better help.",
  },
  {
    min: 2000,
    max: 4999,
    rank: "Well-Liked",
    summary: "Locals trust you and share more rumors.",
  },
  {
    min: 500,
    max: 1999,
    rank: "Friendly",
    summary: "People are polite and a little more helpful.",
  },
  {
    min: -499,
    max: 499,
    rank: "Neutral",
    summary: "Normal social treatment.",
  },
  {
    min: -1999,
    max: -500,
    rank: "Unpleasant",
    summary: "NPCs are colder and less trusting.",
  },
  {
    min: -4999,
    max: -2000,
    rank: "Disliked",
    summary: "People avoid you, insult you, or raise prices.",
  },
  {
    min: -7999,
    max: -5000,
    rank: "Hated",
    summary: "Shops may refuse you and people report you faster.",
  },
  {
    min: -10000,
    max: -8000,
    rank: "Despised",
    summary: "Crowds fear or hate you and may organize against you.",
  },
];

const LEGAL_TIERS: TierDefinition[] = [
  {
    min: 8000,
    max: 10000,
    rank: "Champion of the Law",
    summary: "Guards salute you and legal quests open.",
  },
  {
    min: 5000,
    max: 7999,
    rank: "Trusted Citizen",
    summary: "Guards help you and reduce minor fines.",
  },
  {
    min: 2000,
    max: 4999,
    rank: "Good Samaritan",
    summary: "Guards are friendly and may ask for help.",
  },
  {
    min: 500,
    max: 1999,
    rank: "Law-Abiding",
    summary: "Generally positive legal treatment.",
  },
  {
    min: -499,
    max: 499,
    rank: "Unremarkable",
    summary: "Standard legal treatment.",
  },
  {
    min: -1999,
    max: -500,
    rank: "Suspicious",
    summary: "Guards watch you more closely.",
  },
  {
    min: -4999,
    max: -2000,
    rank: "Troublemaker",
    summary: "Higher fines, inspections, and legal distrust.",
  },
  {
    min: -7999,
    max: -5000,
    rank: "Outlaw",
    summary: "Wanted posters and arrest-on-sight behavior may begin.",
  },
  {
    min: -10000,
    max: -8000,
    rank: "Public Enemy",
    summary: "Elite guards, bounty hunters, and lockdown responses.",
  },
];

const NOTORIETY_TIERS: TierDefinition[] = [
  {
    min: 100000,
    max: Number.POSITIVE_INFINITY,
    rank: "Living Legend",
    summary: "Server-wide recognition and world-event attention.",
  },
  {
    min: 50000,
    max: 99999,
    rank: "Mythic Figure",
    summary: "World leaders and enemies plan around you.",
  },
  {
    min: 25000,
    max: 49999,
    rank: "Legendary",
    summary: "Statues, songs, elite quests, and political influence.",
  },
  {
    min: 10000,
    max: 24999,
    rank: "Renowned",
    summary: "Bards mention you and factions recruit you.",
  },
  {
    min: 5000,
    max: 9999,
    rank: "Famous",
    summary: "Merchants, guards, and quest-givers recognize you.",
  },
  {
    min: 2000,
    max: 4999,
    rank: "Known Adventurer",
    summary: "Regional NPCs know of you.",
  },
  {
    min: 500,
    max: 1999,
    rank: "Local Name",
    summary: "Some locals recognize you.",
  },
  {
    min: 0,
    max: 499,
    rank: "Unknown",
    summary: "Nobody important recognizes you yet.",
  },
];

function isBrowser() {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function clampSignedScore(value: number) {
  return Math.max(-10000, Math.min(10000, Math.round(value)));
}

function clampNotoriety(value: number, floor = 0) {
  return Math.max(0, Math.max(Math.round(value), Math.round(floor)));
}

function normalizeScore(
  score: Partial<HarthmereReputationScore> | undefined,
): HarthmereReputationScore {
  return {
    likeability: clampSignedScore(score?.likeability ?? 0),
    legal: clampSignedScore(score?.legal ?? 0),
    notoriety: clampNotoriety(
      score?.notoriety ?? 0,
      score?.notorietyFloor ?? 0,
    ),
    notorietyFloor: Math.max(0, Math.round(score?.notorietyFloor ?? 0)),
  };
}

function normalizeState(
  parsed: Partial<HarthmereReputationState> | undefined,
): HarthmereReputationState {
  const personal: Record<number, HarthmereReputationScore> = {};
  for (const [offset, score] of Object.entries(parsed?.personal ?? {})) {
    personal[Number(offset)] = normalizeScore(score);
  }

  return {
    version: 1,
    global: normalizeScore(parsed?.global),
    regions: {
      harthmere: normalizeScore(parsed?.regions?.harthmere),
    },
    personal,
    recent: (parsed?.recent ?? []).slice(0, 10),
  };
}

export function readHarthmereReputationState(): HarthmereReputationState {
  if (!isBrowser()) {
    return EMPTY_STATE;
  }
  try {
    const raw = window.localStorage.getItem(HARTHMERE_REPUTATION_STATE_KEY);
    if (!raw) {
      return normalizeState(EMPTY_STATE);
    }
    return normalizeState(JSON.parse(raw));
  } catch {
    return normalizeState(EMPTY_STATE);
  }
}

function writeHarthmereReputationState(state: HarthmereReputationState) {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.setItem(
    HARTHMERE_REPUTATION_STATE_KEY,
    JSON.stringify(state),
  );
  window.dispatchEvent(new CustomEvent(HARTHMERE_REPUTATION_EVENT));
}

function applyDelta(
  score: HarthmereReputationScore,
  delta: HarthmereReputationDelta | undefined,
): HarthmereReputationScore {
  if (!delta) {
    return score;
  }
  const floor = Math.max(
    0,
    Math.round(score.notorietyFloor + (delta.notorietyFloor ?? 0)),
  );
  return {
    likeability: clampSignedScore(score.likeability + (delta.likeability ?? 0)),
    legal: clampSignedScore(score.legal + (delta.legal ?? 0)),
    notoriety: clampNotoriety(score.notoriety + (delta.notoriety ?? 0), floor),
    notorietyFloor: floor,
  };
}

function summarizeDelta(delta: HarthmereReputationDelta | undefined) {
  if (!delta) {
    return {};
  }
  return {
    likeability: delta.likeability,
    legal: delta.legal,
    notoriety: delta.notoriety,
  };
}

export function applyHarthmereReputationChange(
  change: HarthmereReputationChange,
) {
  const state = readHarthmereReputationState();
  const next: HarthmereReputationState = {
    ...state,
    global: applyDelta(state.global, change.global),
    regions: {
      ...state.regions,
      harthmere: applyDelta(state.regions.harthmere, change.harthmere),
    },
    personal: { ...state.personal },
  };

  if (change.npcOffset !== undefined && change.personal) {
    next.personal[change.npcOffset] = applyDelta(
      next.personal[change.npcOffset] ?? EMPTY_SCORE,
      change.personal,
    );
  }

  const scope =
    change.scope ??
    (change.harthmere ? "harthmere" : change.personal ? "personal" : "global");
  const eventDelta =
    scope === "global"
      ? change.global
      : scope === "personal"
        ? change.personal
        : change.harthmere;
  next.recent = [
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      at: Date.now(),
      label: change.label,
      detail: change.detail,
      scope,
      npcOffset: change.npcOffset,
      ...summarizeDelta(eventDelta),
    },
    ...next.recent,
  ].slice(0, 8);

  writeHarthmereReputationState(next);
  return next;
}

export function resetHarthmereReputation() {
  writeHarthmereReputationState(normalizeState(EMPTY_STATE));
}

export function useHarthmereReputationState() {
  const [state, setState] = useState<HarthmereReputationState>(() =>
    readHarthmereReputationState(),
  );

  useEffect(() => {
    const refresh = () => setState(readHarthmereReputationState());
    const interval = window.setInterval(refresh, 750);
    window.addEventListener("storage", refresh);
    window.addEventListener(HARTHMERE_REPUTATION_EVENT, refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", refresh);
      window.removeEventListener(HARTHMERE_REPUTATION_EVENT, refresh);
    };
  }, []);

  return state;
}

function tierForScore(value: number, tiers: TierDefinition[]) {
  return (
    tiers.find((tier) => value >= tier.min && value <= tier.max) ??
    tiers[tiers.length - 1]!
  );
}

export function likeabilityTier(value: number) {
  return tierForScore(value, LIKEABILITY_TIERS);
}

export function legalTier(value: number) {
  return tierForScore(value, LEGAL_TIERS);
}

export function notorietyTier(value: number) {
  return tierForScore(value, NOTORIETY_TIERS);
}

export function getHarthmereCombinedPublicTitle(
  state: HarthmereReputationState,
) {
  const h = state.regions.harthmere;
  const like = likeabilityTier(h.likeability).rank;
  const legal = legalTier(h.legal).rank;
  const notoriety = notorietyTier(h.notoriety).rank;

  if (h.likeability >= 5000 && h.legal >= 2000 && h.notoriety >= 2000) {
    return "Beloved Harthmere Hero";
  }
  if (h.likeability >= 2000 && h.legal <= -2000 && h.notoriety >= 2000) {
    return "Beloved Outlaw";
  }
  if (h.likeability <= -2000 && h.legal >= 2000 && h.notoriety >= 2000) {
    return "Lawful but Disliked";
  }
  if (h.likeability <= -2000 && h.legal <= -2000 && h.notoriety >= 2000) {
    return "Feared Troublemaker";
  }
  if (h.notoriety >= 5000) {
    return notoriety;
  }
  if (h.likeability >= 500) {
    return like;
  }
  if (h.legal <= -500) {
    return legal;
  }
  return "New Arrival";
}

const GUARD_OFFSETS = new Set([27, 44]);
const CHAPEL_OFFSETS = new Set([31, 46, 62]);
const MARKET_OFFSETS = new Set([5, 28, 41, 43]);
const DOCK_OFFSETS = new Set([34, 65]);
const MUDDEN_OFFSETS = new Set([33, 70]);
const SMITH_OFFSETS = new Set([7, 29, 67]);
const TAVERN_OFFSETS = new Set([11, 13, 14, 30]);

function personalScoreFor(
  state: HarthmereReputationState,
  offset: number | undefined,
) {
  if (offset === undefined) {
    return EMPTY_SCORE;
  }
  return state.personal[offset] ?? EMPTY_SCORE;
}

export function getHarthmereNpcReaction(
  offset: number,
  state: HarthmereReputationState,
) {
  const regional = state.regions.harthmere;
  const personal = personalScoreFor(state, offset);

  if (GUARD_OFFSETS.has(offset)) {
    if (regional.legal <= -2000) {
      return "The Watch already has reasons to be wary of you, and this guard does not hide it.";
    }
    if (regional.legal >= 2000) {
      return "The guard recognizes you as someone who has helped keep order here.";
    }
  }

  if (MUDDEN_OFFSETS.has(offset) && regional.likeability >= 500) {
    return "People in the ward seem more willing to talk because of the help you have given common folk.";
  }

  if (DOCK_OFFSETS.has(offset) && regional.legal <= -500) {
    return "The dockfolk notice the Watch has doubts about you; some are wary, and some are curious.";
  }

  if (CHAPEL_OFFSETS.has(offset) && regional.likeability <= -500) {
    return "The chapel keeps its voice gentle, but trust does not come easily today.";
  }

  if (MARKET_OFFSETS.has(offset) && regional.likeability <= -500) {
    return "Market gossip has not been kind to you, and the conversation starts colder than usual.";
  }

  if (personal.likeability >= 100) {
    return "This person remembers you warmly and speaks with less distance than before.";
  }

  if (personal.likeability <= -100) {
    return "This person remembers how you treated them and keeps their guard up.";
  }

  if (regional.notoriety >= 2000) {
    return "Your name has already moved through Harthmere faster than you have.";
  }

  return "They treat you like a traveler whose story is still being written.";
}

function changeAction(
  action: Omit<HarthmereReputationChange, "scope"> & {
    name: string;
    tooltip: string;
    type?: TalkDialogStepAction["type"];
  },
  refresh?: () => void,
): TalkDialogStepAction {
  return {
    name: action.name,
    tooltip: action.tooltip,
    type: action.type,
    onPerformed: () => {
      applyHarthmereReputationChange({
        label: action.label,
        detail: action.detail,
        npcOffset: action.npcOffset,
        global: action.global,
        harthmere: action.harthmere,
        personal: action.personal,
      });
      refresh?.();
    },
  };
}

export function reputationActionsForHarthmereNpc(
  offset: number,
  refresh?: () => void,
): TalkDialogStepAction[] {
  if (offset === 41) {
    return [
      {
        name: "Reset Harthmere reputation",
        tooltip:
          "Clears only the local-dev Harthmere reputation state stored in this browser.",
        onPerformed: () => {
          resetHarthmereReputation();
          refresh?.();
        },
      },
    ];
  }

  const actions: TalkDialogStepAction[] = [];

  if (GUARD_OFFSETS.has(offset)) {
    actions.push(
      changeAction(
        {
          name: "Report trouble to the Watch",
          tooltip:
            "Give the Watch useful information. Lawful NPCs will remember that you helped keep order.",
          label: "Reported trouble to the Watch",
          detail:
            "You gave the Watch useful information instead of ignoring it.",
          npcOffset: offset,
          harthmere: { legal: 90, likeability: 12, notoriety: 15 },
          personal: { likeability: 18, legal: 10 },
        },
        refresh,
      ),
    );
  } else if (CHAPEL_OFFSETS.has(offset)) {
    actions.push(
      changeAction(
        {
          name: "Donate candles and medicine",
          tooltip:
            "Give practical supplies to the chapel. Clergy and vulnerable locals will remember the help.",
          label: "Donated chapel supplies",
          detail:
            "You gave candles and medicine where people could see it helped.",
          npcOffset: offset,
          harthmere: { likeability: 55, legal: 8, notoriety: 12 },
          personal: { likeability: 35 },
        },
        refresh,
      ),
    );
  } else if (MUDDEN_OFFSETS.has(offset)) {
    actions.push(
      changeAction(
        {
          name: "Share food quietly",
          tooltip:
            "Share food quietly with people who need it. The ward remembers kindness even when nobody makes a speech.",
          label: "Shared food in Mudden Ward",
          detail: "You helped people who needed it without demanding payment.",
          npcOffset: offset,
          harthmere: { likeability: 65, notoriety: 8 },
          personal: { likeability: 45 },
        },
        refresh,
      ),
    );
  } else if (DOCK_OFFSETS.has(offset)) {
    actions.push(
      changeAction(
        {
          name: "Help move cargo legally",
          tooltip:
            "Help cargo move through the proper ledger. Dock workers and the Watch both notice honest work.",
          label: "Moved lawful dock cargo",
          detail: "You helped clear cargo through the proper ledger.",
          npcOffset: offset,
          harthmere: { likeability: 25, legal: 40, notoriety: 12 },
          personal: { likeability: 25 },
        },
        refresh,
      ),
    );
    actions.push(
      changeAction(
        {
          name: "Look the other way",
          tooltip:
            "Ignore suspicious cargo. River contacts may appreciate it, but lawful eyes will not.",
          label: "Ignored suspicious dock cargo",
          detail:
            "You chose not to tell the Watch about suspicious river work.",
          npcOffset: offset,
          harthmere: { likeability: 20, legal: -80, notoriety: 20 },
          personal: { likeability: 35, legal: -20 },
        },
        refresh,
      ),
    );
  } else if (SMITH_OFFSETS.has(offset)) {
    actions.push(
      changeAction(
        {
          name: "Sort repair tools",
          tooltip:
            "Help the smithy prepare tools for town repairs and guard work.",
          label: "Sorted smithy repair tools",
          detail: "You helped the Black Anvil prepare tools for guard repairs.",
          npcOffset: offset,
          harthmere: { likeability: 30, legal: 20, notoriety: 8 },
          personal: { likeability: 28 },
        },
        refresh,
      ),
    );
  } else if (TAVERN_OFFSETS.has(offset)) {
    actions.push(
      changeAction(
        {
          name: "Buy a round for the room",
          tooltip:
            "Buy a round for the room. People remember public generosity, especially in a tavern.",
          label: "Bought a tavern round",
          detail: "The Copper Kettle heard your name in a warmer tone tonight.",
          npcOffset: offset,
          harthmere: { likeability: 40, notoriety: 30 },
          personal: { likeability: 25 },
        },
        refresh,
      ),
    );
  } else {
    actions.push(
      changeAction(
        {
          name: "Compliment their work",
          tooltip:
            "Offer a sincere compliment. Small kindness changes the tone of future conversations.",
          label: "Offered a sincere compliment",
          detail:
            "A small polite action made this person slightly warmer to you.",
          npcOffset: offset,
          harthmere: { likeability: 3 },
          personal: { likeability: 8 },
        },
        refresh,
      ),
    );
  }

  actions.push(
    changeAction(
      {
        name: "Threaten them",
        tooltip:
          "Use intimidation. The person, nearby witnesses, and the town may remember cruelty.",
        label: "Threatened a local",
        detail:
          "You chose intimidation, and witnesses will not treat it as harmless.",
        npcOffset: offset,
        harthmere: { likeability: -15, legal: -35, notoriety: 5 },
        personal: { likeability: -35, legal: -10 },
      },
      refresh,
    ),
  );

  return actions.slice(0, 3);
}

const QUEST_REPUTATION: Record<
  string,
  {
    progress: HarthmereReputationDelta;
    complete: HarthmereReputationDelta;
    label: string;
    completeDetail: string;
  }
> = {
  "welcome-to-harthmere": {
    progress: { likeability: 8, legal: 4, notoriety: 5 },
    complete: { likeability: 60, legal: 20, notoriety: 100 },
    label: "Completed Welcome to Harthmere",
    completeDetail:
      "You learned the town route and became a recognizable new arrival.",
  },
  "apples-for-dawnloaf": {
    progress: { likeability: 12, notoriety: 4 },
    complete: { likeability: 120, legal: 10, notoriety: 40 },
    label: "Restocked Dawn Loaf apples",
    completeDetail:
      "The bakery can feed travelers and guards because you helped.",
  },
  "missing-lockbox": {
    progress: { likeability: 8, legal: 18, notoriety: 8 },
    complete: { likeability: 70, legal: 140, notoriety: 60 },
    label: "Helped recover the lockbox trail",
    completeDetail:
      "The bank and courier desk trust you more after the investigation.",
  },
  "cold-iron-hot-temper": {
    progress: { likeability: 10, legal: 12, notoriety: 5 },
    complete: { likeability: 70, legal: 120, notoriety: 45 },
    label: "Supplied guard training gear",
    completeDetail:
      "The Black Anvil and Guard Yard know you helped keep order.",
  },
  "fever-tea": {
    progress: { likeability: 18, legal: 5, notoriety: 5 },
    complete: { likeability: 150, legal: 25, notoriety: 45 },
    label: "Delivered fever tea",
    completeDetail:
      "Healers and chapel workers saw you care for the vulnerable.",
  },
  "rumor-has-it": {
    progress: { likeability: 8, notoriety: 12 },
    complete: { likeability: 45, notoriety: 90 },
    label: "Found a useful tavern rumor",
    completeDetail: "The Copper Kettle now treats you as someone who listens.",
  },
  "loose-chickens": {
    progress: { likeability: 10, notoriety: 2 },
    complete: { likeability: 65, notoriety: 20 },
    label: "Helped count the chicken yard",
    completeDetail:
      "Farmfolk appreciate practical help, even when the job is small.",
  },
  "whispering-crate": {
    progress: { likeability: 6, legal: 4, notoriety: 18 },
    complete: { likeability: 35, legal: 25, notoriety: 120 },
    label: "Investigated the whispering crate",
    completeDetail:
      "Dock rumors now include your name next to the strange crate.",
  },
  "the-missing-bell": {
    progress: { likeability: 20, legal: 5, notoriety: 45 },
    complete: {
      likeability: 180,
      legal: 40,
      notoriety: 350,
      notorietyFloor: 100,
    },
    label: "Advanced the Missing Bell mystery",
    completeDetail: "The chapel and old well stories now remember your part.",
  },
};

export function recordHarthmereQuestAccepted(
  _questId: string,
  title: string,
  npcOffset: number,
) {
  applyHarthmereReputationChange({
    label: `Accepted ${title}`,
    detail: "Taking local work makes people slightly more aware of you.",
    npcOffset,
    harthmere: { notoriety: 5 },
    personal: { likeability: 4 },
  });
}

export function recordHarthmereQuestStepCompleted(
  questId: string,
  title: string,
  npcOffset: number,
  completedQuest: boolean,
) {
  const config = QUEST_REPUTATION[questId];
  const delta = completedQuest
    ? (config?.complete ?? { likeability: 50, legal: 10, notoriety: 25 })
    : (config?.progress ?? { likeability: 8, legal: 2, notoriety: 4 });
  applyHarthmereReputationChange({
    label: completedQuest
      ? (config?.label ?? `Completed ${title}`)
      : `Progressed ${title}`,
    detail: completedQuest
      ? (config?.completeDetail ??
        "People noticed you followed through on a local job.")
      : "A small witnessed step changed how this person and town view you.",
    npcOffset,
    global: completedQuest
      ? { notoriety: Math.max(1, Math.floor((delta.notoriety ?? 0) / 4)) }
      : undefined,
    harthmere: delta,
    personal: {
      likeability: Math.max(5, Math.floor((delta.likeability ?? 0) / 3)),
    },
  });
}

function ScorePill({
  label,
  value,
  tier,
}: {
  label: string;
  value: number;
  tier: TierDefinition;
}) {
  return (
    <div className="rounded border border-white/10 bg-white/5 px-2 py-1">
      <div className="text-[10px] uppercase tracking-wide text-white/60">
        {label}
      </div>
      <div className="text-xs font-semibold text-white">{tier.rank}</div>
      <div className="text-[11px] text-white/70">{value.toLocaleString()}</div>
    </div>
  );
}

export const HarthmereReputationHUD: React.FunctionComponent<{}> = () => {
  const state = useHarthmereReputationState();
  const regional = state.regions.harthmere;
  const title = getHarthmereCombinedPublicTitle(state);
  return (
    <div
      className="pointer-events-none w-[21rem] rounded-lg border border-white/20 bg-black/70 p-2 text-white shadow-lg"
      style={{ textShadow: "0 1px 2px rgba(0,0,0,0.85)" }}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-emerald-200">
            Harthmere Standing
          </div>
          <div className="text-xs text-white/80">{title}</div>
        </div>
        <div className="rounded bg-emerald-300/20 px-1.5 py-0.5 text-xs font-semibold text-emerald-100">
          Local
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1">
        <ScorePill
          label="Like"
          value={regional.likeability}
          tier={likeabilityTier(regional.likeability)}
        />
        <ScorePill
          label="Law"
          value={regional.legal}
          tier={legalTier(regional.legal)}
        />
        <ScorePill
          label="Known"
          value={regional.notoriety}
          tier={notorietyTier(regional.notoriety)}
        />
      </div>
      {state.recent[0] && (
        <div className="mt-1 text-[11px] leading-snug text-white/80">
          Latest: <span className="text-white">{state.recent[0].label}</span>
        </div>
      )}
    </div>
  );
};

function RecentChange({ event }: { event: HarthmereReputationRecentEvent }) {
  const deltas = [
    event.likeability
      ? `${event.likeability > 0 ? "+" : ""}${event.likeability} Like`
      : undefined,
    event.legal ? `${event.legal > 0 ? "+" : ""}${event.legal} Law` : undefined,
    event.notoriety
      ? `${event.notoriety > 0 ? "+" : ""}${event.notoriety} Known`
      : undefined,
  ].filter(Boolean);

  return (
    <div className="rounded border border-white/10 bg-black/20 p-2 text-xs">
      <div className="font-semibold text-white">{event.label}</div>
      <div className="text-white/70">{event.detail}</div>
      {!!deltas.length && (
        <div className="mt-1 text-emerald-100">{deltas.join(" · ")}</div>
      )}
    </div>
  );
}

export const HarthmereReputationMenuPanel: React.FunctionComponent<{}> = () => {
  const state = useHarthmereReputationState();
  const regional = state.regions.harthmere;
  const title = useMemo(() => getHarthmereCombinedPublicTitle(state), [state]);

  return (
    <div className="pointer-events-auto max-h-[70vh] w-[26rem] overflow-y-auto rounded-lg border border-white/20 bg-black/75 p-3 text-white shadow-xl">
      <div className="mb-2">
        <div className="text-base font-bold text-emerald-200">
          Harthmere Reputation
        </div>
        <div className="text-xs text-white/75">
          Public label:{" "}
          <span className="font-semibold text-white">{title}</span>
        </div>
      </div>

      <div className="mb-2 grid grid-cols-3 gap-2">
        <ScorePill
          label="Likeability"
          value={regional.likeability}
          tier={likeabilityTier(regional.likeability)}
        />
        <ScorePill
          label="Good / Outlaw"
          value={regional.legal}
          tier={legalTier(regional.legal)}
        />
        <ScorePill
          label="Notoriety"
          value={regional.notoriety}
          tier={notorietyTier(regional.notoriety)}
        />
      </div>

      <div className="space-y-2 text-xs leading-snug text-white/80">
        <p>
          <span className="font-semibold text-white">Likeability</span> is how
          people emotionally feel about you. Kindness, cruelty, donations,
          insults, and betrayal move this score.
        </p>
        <p>
          <span className="font-semibold text-white">
            Good Samaritan / Outlaw
          </span>{" "}
          is legal standing. Helping guards raises it; threats, smuggling,
          theft, and crimes lower it.
        </p>
        <p>
          <span className="font-semibold text-white">Notoriety</span> is fame.
          It is not good or bad by itself. Heroic deeds, public crimes,
          mysteries, and major quests make people know your name.
        </p>
        <p>
          Harthmere uses layered reputation: global fame, local town standing,
          and personal NPC feelings. NPCs can now greet, trust, warn, or
          distrust you based on these values.
        </p>
      </div>

      <div className="mt-3">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-white/60">
          Recent reputation events
        </div>
        <div className="space-y-1.5">
          {state.recent.length ? (
            state.recent
              .slice(0, 5)
              .map((event) => <RecentChange key={event.id} event={event} />)
          ) : (
            <div className="rounded border border-white/10 bg-black/20 p-2 text-xs text-white/70">
              No reputation events yet. Accept a job, complete a task, donate,
              report trouble, help someone, or threaten someone to see changes.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
