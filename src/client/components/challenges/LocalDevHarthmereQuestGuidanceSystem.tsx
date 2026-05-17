
import React from "react";

export const HARTHMERE_QUEST_GUIDANCE_VERSION = "harthmere-quest-guidance-depth-v1";

export type HarthmereQuestStatus = "unavailable" | "available" | "accepted" | "in_progress" | "objective_complete" | "ready_to_turn_in" | "completed" | "failed" | "abandoned" | "expired" | "locked" | "blocked" | "repeatable_available" | "repeatable_completed" | "paused";
export type HarthmereQuestType = "main" | "side" | "faction" | "daily" | "weekly" | "profession" | "dungeon" | "raid" | "pvp" | "bounty";
export type HarthmereQuestMarkerType = "exact_location" | "search_area" | "route" | "turn_in" | "quest_giver" | "objective_item" | "enemy_spawn_zone" | "dungeon_entrance" | "escort_route" | "patrol_zone" | "hidden_clue";

export type HarthmereQuestGuidanceEntry = {
  questId: string;
  title: string;
  type: HarthmereQuestType;
  status: HarthmereQuestStatus;
  level: number;
  currentObjective: string;
  progressText: string;
  giver: string;
  turnIn?: string;
  distanceMeters: number;
  location: string;
  rewardsPreview: string[];
  blockedReason?: string;
  failureConditions: string[];
  marker: { type: HarthmereQuestMarkerType; x: number; y: number; z: number; radiusMeters?: number; heightHint?: "above" | "below" | "same" };
  hintChain: string[];
  typeRequirements: string[];
};

export const HARTHMERE_QUEST_ICON_BY_STATUS_AND_TYPE: Record<string, string> = {
  "main:available": "gold_exclamation",
  "side:available": "blue_exclamation",
  "profession:available": "green_exclamation",
  "bounty:available": "red_exclamation",
  "faction:available": "purple_exclamation",
  "main:ready_to_turn_in": "gold_question",
  "side:ready_to_turn_in": "blue_question",
  "blocked": "gray_exclamation",
  "timed": "clock",
  "party": "group",
  "dangerous": "skull",
  "dungeon": "dungeon_door",
};

export const HARTHMERE_QUEST_JOURNAL_SECTIONS = ["Tracked Quests", "Main Story", "Side Quests", "Faction Quests", "Daily / Weekly Quests", "Profession Quests", "Dungeon Quests", "Raid Quests", "PvP Quests", "Completed Quests", "Failed Quests", "Nearby Available Quests", "Recommended Next Quests"];

export const HARTHMERE_NOTICE_BOARD_QUESTS = [
  { boardId: "market_notice_board", questIds: ["rats-in-the-cellar", "wolves-at-the-north-fence"], refreshHours: 24 },
  { boardId: "guard_bounty_board", questIds: ["mudden-pickpocket-ring", "road-bandit-contract"], refreshHours: 24 },
  { boardId: "crafting_order_board", questIds: ["cold-iron-hot-temper"], refreshHours: 12 },
];

export const HARTHMERE_QUEST_TYPE_CONTRACTS: Record<HarthmereQuestType, string[]> = {
  main: ["clear objective", "map marker", "journal summary", "turn-in target", "story consequence"],
  side: ["giver", "objective", "reward preview", "abandon/restart rule"],
  faction: ["faction requirement", "reputation reward", "hostile faction consequence"],
  daily: ["cooldown", "reward cap", "repeatable status"],
  weekly: ["weekly reset", "reward cap", "repeatable status"],
  profession: ["skill requirement", "material objective", "crafting station"],
  dungeon: ["entrance marker", "group warning", "boss objective"],
  raid: ["raid size", "lockout", "loot eligibility"],
  pvp: ["opt-in", "risk warning", "anti-farming rule"],
  bounty: ["target", "legal authority", "proof of completion"],
};

export const SAMPLE_HARTHMERE_QUEST_GUIDANCE: HarthmereQuestGuidanceEntry[] = [
  { questId: "apples-for-dawnloaf", title: "Apples for Dawnloaf", type: "side", status: "in_progress", level: 1, currentObjective: "Bring apple baskets to the bakery.", progressText: "Apple baskets: 1 / 3", giver: "Dawn Loaf Baker", turnIn: "Dawn Loaf Baker", distanceMeters: 42, location: "Market Square", rewardsPreview: ["12 gold", "+10 Harthmere Favor", "Apple Tart"], failureConditions: ["Quest item abandoned"], marker: { type: "exact_location", x: 18, y: 54, z: -12, heightHint: "same" }, hintChain: ["Look near the market stalls.", "The baskets are beside the produce stall.", "Stand next to the apple baskets and interact."], typeRequirements: HARTHMERE_QUEST_TYPE_CONTRACTS.side },
  { questId: "the-missing-bell", title: "The Missing Bell", type: "main", status: "blocked", level: 4, currentObjective: "Find a way into the sealed undercroft.", progressText: "Blocked", giver: "Sister Maelle", turnIn: "Father Aldren", distanceMeters: 160, location: "Old Well / Underways", rewardsPreview: ["30 gold", "+20 Harthmere Favor", "Bell Shard"], blockedReason: "The undercroft gate opens after the chapel archive clue is read.", failureConditions: ["Protected witness killed"], marker: { type: "search_area", x: 92, y: 54, z: -88, radiusMeters: 18, heightHint: "below" }, hintChain: ["The old bell records mention the undercroft.", "Search the chapel archive first.", "Read the Founder annals on the archive table."], typeRequirements: HARTHMERE_QUEST_TYPE_CONTRACTS.main },
];

export function getHarthmereQuestAvailabilityIcon(quest: HarthmereQuestGuidanceEntry) {
  return HARTHMERE_QUEST_ICON_BY_STATUS_AND_TYPE[`${quest.type}:${quest.status}`] ?? HARTHMERE_QUEST_ICON_BY_STATUS_AND_TYPE[quest.status] ?? "gray_exclamation";
}

export function getNearbyHarthmereQuestHelper(quests: HarthmereQuestGuidanceEntry[], maxDistance = 250) {
  return quests.filter((quest) => ["available", "accepted", "in_progress", "ready_to_turn_in", "blocked"].includes(quest.status)).filter((quest) => quest.distanceMeters <= maxDistance).sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, 5).map((quest) => ({ questId: quest.questId, label: `${quest.title}: ${quest.currentObjective}`, distanceMeters: quest.distanceMeters, icon: getHarthmereQuestAvailabilityIcon(quest) }));
}

export function getRecommendedHarthmereNextQuests(quests: HarthmereQuestGuidanceEntry[], playerLevel: number, location: string) {
  return quests.filter((quest) => quest.status !== "completed" && quest.status !== "failed").sort((a, b) => {
    const locA = a.location === location ? -50 : 0;
    const locB = b.location === location ? -50 : 0;
    return Math.abs(a.level - playerLevel) + a.distanceMeters / 100 + locA - (Math.abs(b.level - playerLevel) + b.distanceMeters / 100 + locB);
  }).slice(0, 3);
}

export function autoSwitchHarthmereQuestTracker(quests: HarthmereQuestGuidanceEntry[], enteredLocation: string) {
  return quests.filter((quest) => quest.location === enteredLocation && ["in_progress", "ready_to_turn_in", "blocked"].includes(quest.status)).slice(0, 5).map((quest) => quest.questId);
}

export function getHarthmereQuestMapMarker(quest: HarthmereQuestGuidanceEntry) {
  return { questId: quest.questId, markerType: quest.marker.type, x: quest.marker.x, y: quest.marker.y, z: quest.marker.z, radiusMeters: quest.marker.radiusMeters ?? 0, heightHint: quest.marker.heightHint ?? "same", compassLabel: `${quest.title} · ${quest.distanceMeters}m` };
}

export function getHarthmereQuestHintEscalation(quest: HarthmereQuestGuidanceEntry, stuckMs: number, repeatedFailures = 0) {
  if (repeatedFailures > 0) return { level: "recovery", hint: "Try better gear, a party, or a different quest first." };
  if (stuckMs >= 10 * 60_000) return { level: "exact", hint: quest.hintChain[2] ?? quest.hintChain.at(-1) ?? quest.currentObjective };
  if (stuckMs >= 5 * 60_000) return { level: "clear", hint: quest.hintChain[1] ?? quest.hintChain[0] ?? quest.currentObjective };
  if (stuckMs >= 2 * 60_000) return { level: "subtle", hint: quest.hintChain[0] ?? quest.currentObjective };
  return { level: "none", hint: "" };
}

export function getHarthmereQuestStatusNotification(quest: HarthmereQuestGuidanceEntry) {
  if (quest.status === "blocked") return `Quest blocked: ${quest.blockedReason ?? "progress condition missing"}`;
  if (quest.status === "ready_to_turn_in") return `Ready to turn in: return to ${quest.turnIn ?? quest.giver}.`;
  if (quest.status === "failed") return `Quest failed. Check the journal for restart or consequence rules.`;
  return `${quest.title}: ${quest.progressText}`;
}

export function getHarthmereQuestAnalyticsDebug(quest: HarthmereQuestGuidanceEntry) {
  return { questId: quest.questId, status: quest.status, objective: quest.currentObjective, markerType: quest.marker.type, blockedReason: quest.blockedReason, failureConditions: quest.failureConditions, hasRewardPreview: quest.rewardsPreview.length > 0, hasGuidance: quest.hintChain.length > 0 };
}

export const HarthmereQuestGuidancePanel: React.FunctionComponent<{}> = () => (
  <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs" data-harthmere-quest-guidance="v1">
    <div className="text-sm font-bold text-emerald-100">Quest Guidance</div>
    <div>Journal sections: {HARTHMERE_QUEST_JOURNAL_SECTIONS.length}</div>
    <div>Nearby: {getNearbyHarthmereQuestHelper(SAMPLE_HARTHMERE_QUEST_GUIDANCE).map((q) => q.label).join(" | ")}</div>
    <div>Notice boards: {HARTHMERE_NOTICE_BOARD_QUESTS.map((board) => board.boardId).join(", ")}</div>
  </div>
);
