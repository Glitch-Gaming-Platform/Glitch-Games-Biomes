import { applyHarthmereReputationChange } from "@/client/components/challenges/LocalDevHarthmereReputation";

export const HARTHMERE_QUEST_ECONOMY_SYSTEM_VERSION = 1;
export const HARTHMERE_QUEST_ECONOMY_STATE_KEY =
  "biomes.localDev.harthmere.questEconomyState.v1";
export const HARTHMERE_ECONOMY_STATE_KEY_FOR_QUESTS =
  "biomes.localDev.harthmere.economyState.v1";
export const HARTHMERE_QUEST_ECONOMY_EVENT =
  "biomes:harthmere-quest-economy-changed";

export interface HarthmereQuestVendorUnlock {
  vendorOffset: number;
  itemId: string;
  reason: string;
}

export interface HarthmereQuestEconomyContract {
  questId: string;
  repeatable: boolean;
  rewardCooldownMs: number;
  grantsGold: boolean;
  grantsFavor: boolean;
  grantsItems: boolean;
  grantsMaterials: boolean;
  grantsKeys: boolean;
  grantsSpells: boolean;
  protectedQuestItems: string[];
  temporaryQuestItems: string[];
  vendorUnlocks: HarthmereQuestVendorUnlock[];
  reputationImpact: { likeability?: number; legal?: number; notoriety?: number };
  townEconomyImpact: { wealth?: number; security?: number; foodSupply?: number; oreSupply?: number; medicineSupply?: number; crimeRate?: number };
}

export interface HarthmereQuestEconomyState {
  version: 1;
  completedRewardClaims: Record<string, number>;
  repeatableCooldowns: Record<string, number>;
  vendorUnlocks: string[];
  recoveredQuestItems: Record<string, number>;
  abandonedQuestCleanup: Array<{ questId: string; itemIds: string[]; at: number }>;
  recent: Array<{ id: string; at: number; action: string; questId: string; detail: string; success: boolean }>;
}

export const HARTHMERE_QUEST_ECONOMY_CONTRACTS: Record<string, HarthmereQuestEconomyContract> = {
  "welcome-to-harthmere": questContract("welcome-to-harthmere", {
    grantsGold: true,
    grantsFavor: true,
    grantsItems: true,
    vendorUnlocks: [
      { vendorOffset: 6, itemId: "repair_voucher", reason: "Banker trusts the newcomer route completion." },
    ],
    reputationImpact: { likeability: 20, legal: 8, notoriety: 4 },
    townEconomyImpact: { wealth: 2, security: 1 },
  }),
  "apples-for-dawnloaf": questContract("apples-for-dawnloaf", {
    grantsGold: true,
    grantsFavor: true,
    grantsItems: true,
    vendorUnlocks: [
      { vendorOffset: 5, itemId: "apple_tart", reason: "Bakery restocked with clean orchard apples." },
      { vendorOffset: 63, itemId: "golden_carrot", reason: "Farm stand trusts you with better produce." },
    ],
    reputationImpact: { likeability: 28, notoriety: 2 },
    townEconomyImpact: { foodSupply: 4, wealth: 1 },
  }),
  "missing-lockbox": questContract("missing-lockbox", {
    grantsGold: true,
    grantsFavor: true,
    grantsKeys: true,
    protectedQuestItems: ["bank_seal", "missing_lockbox"],
    temporaryQuestItems: ["bank_seal", "missing_lockbox"],
    vendorUnlocks: [
      { vendorOffset: 6, itemId: "iron_key_blank", reason: "Bank recovered enough trust to sell key blanks." },
    ],
    reputationImpact: { likeability: 18, legal: 22, notoriety: 4 },
    townEconomyImpact: { wealth: 2, security: 2, crimeRate: -1 },
  }),
  "cold-iron-hot-temper": questContract("cold-iron-hot-temper", {
    grantsGold: true,
    grantsFavor: true,
    grantsItems: true,
    grantsMaterials: true,
    vendorUnlocks: [
      { vendorOffset: 7, itemId: "two_handed_sword", reason: "Guard training order proves the weapon counter can stock heavy blades." },
      { vendorOffset: 29, itemId: "two_handed_sword", reason: "Black Anvil has the cold iron workflow stable enough for heavy blades." },
    ],
    reputationImpact: { likeability: 14, legal: 8, notoriety: 4 },
    townEconomyImpact: { oreSupply: 3, security: 2, wealth: 2 },
  }),
  "fever-tea": questContract("fever-tea", {
    grantsGold: true,
    grantsFavor: true,
    grantsItems: true,
    grantsSpells: true,
    vendorUnlocks: [
      { vendorOffset: 8, itemId: "field_revival_scroll", reason: "The healer trusts you after the fever-tea delivery." },
      { vendorOffset: 31, itemId: "field_revival_scroll", reason: "Temple stores open emergency revival stock after you help the sick." },
      { vendorOffset: 47, itemId: "field_revival_scroll", reason: "Ysabet will sell stronger field medicine after the fever-tea work." },
    ],
    reputationImpact: { likeability: 30, legal: 4, notoriety: 5 },
    townEconomyImpact: { medicineSupply: 5, wealth: 1 },
  }),
  "rumor-has-it": questContract("rumor-has-it", {
    grantsGold: true,
    grantsFavor: true,
    grantsItems: true,
    vendorUnlocks: [
      { vendorOffset: 11, itemId: "copper_kettle_token", reason: "Tavern rumor work earns token access." },
      { vendorOffset: 30, itemId: "copper_kettle_token", reason: "Innkeeper trusts you with regulars' token trade." },
    ],
    reputationImpact: { likeability: 10, notoriety: 8 },
    townEconomyImpact: { wealth: 1 },
  }),
  "loose-chickens": questContract("loose-chickens", {
    repeatable: true,
    rewardCooldownMs: 12 * 60 * 60 * 1000,
    grantsGold: true,
    grantsFavor: true,
    grantsItems: true,
    vendorUnlocks: [
      { vendorOffset: 5, itemId: "fresh_egg", reason: "Chicken yard work keeps the bakery's egg supply moving." },
    ],
    reputationImpact: { likeability: 8, notoriety: 1 },
    townEconomyImpact: { foodSupply: 2 },
  }),
  "whispering-crate": questContract("whispering-crate", {
    grantsGold: true,
    grantsFavor: true,
    grantsItems: true,
    protectedQuestItems: ["river_knot_marker"],
    temporaryQuestItems: ["whispering_crate_manifest"],
    vendorUnlocks: [
      { vendorOffset: 34, itemId: "river_knot_marker", reason: "Dock clue work makes the marker available through dock supply." },
      { vendorOffset: 65, itemId: "river_knot_marker", reason: "River Knots accept you as someone who knows the crate story." },
    ],
    reputationImpact: { likeability: 8, legal: 5, notoriety: 12 },
    townEconomyImpact: { security: 1, crimeRate: -1 },
  }),
  "the-missing-bell": questContract("the-missing-bell", {
    grantsGold: true,
    grantsFavor: true,
    grantsItems: true,
    protectedQuestItems: ["bell_fragment"],
    temporaryQuestItems: ["bell_fragment", "old_bronze_rubbing"],
    vendorUnlocks: [
      { vendorOffset: 9, itemId: "field_revival_scroll", reason: "Magic shop opens emergency scroll stock after the Underways clue." },
    ],
    reputationImpact: { likeability: 18, legal: 8, notoriety: 30 },
    townEconomyImpact: { security: 3, wealth: 2 },
  }),
};

function questContract(
  questId: string,
  input: Partial<Omit<HarthmereQuestEconomyContract, "questId">>,
): HarthmereQuestEconomyContract {
  return {
    questId,
    repeatable: input.repeatable ?? false,
    rewardCooldownMs: input.rewardCooldownMs ?? 0,
    grantsGold: input.grantsGold ?? false,
    grantsFavor: input.grantsFavor ?? false,
    grantsItems: input.grantsItems ?? false,
    grantsMaterials: input.grantsMaterials ?? false,
    grantsKeys: input.grantsKeys ?? false,
    grantsSpells: input.grantsSpells ?? false,
    protectedQuestItems: input.protectedQuestItems ?? [],
    temporaryQuestItems: input.temporaryQuestItems ?? [],
    vendorUnlocks: input.vendorUnlocks ?? [],
    reputationImpact: input.reputationImpact ?? {},
    townEconomyImpact: input.townEconomyImpact ?? {},
  };
}

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function event() {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent(HARTHMERE_QUEST_ECONOMY_EVENT));
}

function emptyState(): HarthmereQuestEconomyState {
  return {
    version: 1,
    completedRewardClaims: {},
    repeatableCooldowns: {},
    vendorUnlocks: [],
    recoveredQuestItems: {},
    abandonedQuestCleanup: [],
    recent: [],
  };
}

function normalizeState(raw?: Partial<HarthmereQuestEconomyState>): HarthmereQuestEconomyState {
  return {
    version: 1,
    completedRewardClaims: raw?.completedRewardClaims ?? {},
    repeatableCooldowns: raw?.repeatableCooldowns ?? {},
    vendorUnlocks: Array.from(new Set(raw?.vendorUnlocks ?? [])),
    recoveredQuestItems: raw?.recoveredQuestItems ?? {},
    abandonedQuestCleanup: (raw?.abandonedQuestCleanup ?? []).slice(0, 40),
    recent: (raw?.recent ?? []).slice(0, 40),
  };
}

export function readHarthmereQuestEconomyState() {
  if (!isBrowser()) return emptyState();
  try {
    const raw = window.localStorage.getItem(HARTHMERE_QUEST_ECONOMY_STATE_KEY);
    return raw ? normalizeState(JSON.parse(raw) as Partial<HarthmereQuestEconomyState>) : emptyState();
  } catch {
    return emptyState();
  }
}

export function writeHarthmereQuestEconomyState(state: HarthmereQuestEconomyState) {
  if (!isBrowser()) return;
  window.localStorage.setItem(HARTHMERE_QUEST_ECONOMY_STATE_KEY, JSON.stringify(normalizeState(state)));
  event();
}

function appendLog(
  state: HarthmereQuestEconomyState,
  action: string,
  questId: string,
  detail: string,
  success = true,
): HarthmereQuestEconomyState {
  return {
    ...state,
    recent: [
      { id: `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`, at: Date.now(), action, questId, detail, success },
      ...state.recent,
    ].slice(0, 40),
  };
}

export function getHarthmereQuestEconomyContract(questId: string) {
  return HARTHMERE_QUEST_ECONOMY_CONTRACTS[questId];
}

export function claimHarthmereQuestEconomyReward(questId: string, questTitle: string) {
  const state = readHarthmereQuestEconomyState();
  const contract = getHarthmereQuestEconomyContract(questId);
  const alreadyClaimedAt = state.completedRewardClaims[questId];
  if (alreadyClaimedAt && !contract?.repeatable) {
    writeHarthmereQuestEconomyState(
      appendLog(state, "Reward Duplicate Blocked", questId, `${questTitle} reward was already claimed.`, false),
    );
    return false;
  }
  if (contract?.repeatable && !isHarthmereRepeatableQuestAvailable(questId)) {
    writeHarthmereQuestEconomyState(
      appendLog(state, "Repeatable Reward Cooldown", questId, `${questTitle} is still on reward cooldown.`, false),
    );
    return false;
  }
  const at = Date.now();
  writeHarthmereQuestEconomyState(
    appendLog(
      {
        ...state,
        completedRewardClaims: { ...state.completedRewardClaims, [questId]: at },
        repeatableCooldowns: contract?.repeatable
          ? { ...state.repeatableCooldowns, [questId]: at + Math.max(1, contract.rewardCooldownMs) }
          : state.repeatableCooldowns,
      },
      "Reward Claim Recorded",
      questId,
      `${questTitle} reward claim recorded before inventory payout.`,
      true,
    ),
  );
  return true;
}

export function isHarthmereRepeatableQuestAvailable(questId: string, nowAt = Date.now()) {
  const contract = getHarthmereQuestEconomyContract(questId);
  if (!contract?.repeatable) return true;
  const state = readHarthmereQuestEconomyState();
  const readyAt = state.repeatableCooldowns[questId] ?? 0;
  return nowAt >= readyAt;
}

function unlockKey(unlock: HarthmereQuestVendorUnlock) {
  return `${unlock.vendorOffset}:${unlock.itemId}`;
}

export function isHarthmereVendorStockUnlocked(vendorOffset: number, itemId: string) {
  const matchingUnlocks = Object.values(HARTHMERE_QUEST_ECONOMY_CONTRACTS).flatMap((contract) =>
    contract.vendorUnlocks.filter((unlock) => unlock.vendorOffset === vendorOffset && unlock.itemId === itemId),
  );
  if (!matchingUnlocks.length) return true;
  const state = readHarthmereQuestEconomyState();
  return matchingUnlocks.some((unlock) => state.vendorUnlocks.includes(unlockKey(unlock)));
}

function applyTownEconomyImpact(contract: HarthmereQuestEconomyContract) {
  if (!isBrowser()) return;
  try {
    const raw = window.localStorage.getItem(HARTHMERE_ECONOMY_STATE_KEY_FOR_QUESTS);
    if (!raw) return;
    const economy = JSON.parse(raw) as { town?: Record<string, unknown>; recent?: unknown[] };
    const town = { ...(economy.town ?? {}) } as Record<string, unknown>;
    for (const [key, delta] of Object.entries(contract.townEconomyImpact)) {
      town[key] = Math.max(0, Math.round(Number(town[key] ?? 0) + Number(delta ?? 0)));
    }
    const recent = [
      {
        id: `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
        at: Date.now(),
        system: "economy",
        actorId: "local-player",
        type: "source",
        label: "Quest Economy Impact",
        detail: `${contract.questId} updated town economy: ${Object.keys(contract.townEconomyImpact).join(", ")}.`,
        reason: "quest_completion",
        success: true,
      },
      ...((economy.recent as unknown[]) ?? []),
    ].slice(0, 16);
    window.localStorage.setItem(
      HARTHMERE_ECONOMY_STATE_KEY_FOR_QUESTS,
      JSON.stringify({ ...economy, town, recent }),
    );
    window.dispatchEvent(new CustomEvent("biomes:harthmere-economy-changed"));
  } catch {
    // Local-dev state can be malformed; economy hardening will rebuild it later.
  }
}

export function recordHarthmereQuestEconomyCompletion(questId: string, questTitle: string) {
  const contract = getHarthmereQuestEconomyContract(questId);
  if (!contract) return;
  const state = readHarthmereQuestEconomyState();
  const unlocks = contract.vendorUnlocks.map(unlockKey);
  writeHarthmereQuestEconomyState(
    appendLog(
      {
        ...state,
        vendorUnlocks: Array.from(new Set([...state.vendorUnlocks, ...unlocks])),
      },
      "Quest Economy Completion",
      questId,
      `${questTitle} updated quest economy, vendor unlocks, and cooldown rules.`,
      true,
    ),
  );
  if (Object.keys(contract.reputationImpact).length) {
    applyHarthmereReputationChange({
      label: "Quest economy reputation",
      detail: `${questTitle} changed local trust, law, or notoriety through its economic outcome.`,
      harthmere: contract.reputationImpact,
    });
  }
  applyTownEconomyImpact(contract);
}

export function recordHarthmereQuestItemRecovered(questId: string, itemId: string) {
  const state = readHarthmereQuestEconomyState();
  writeHarthmereQuestEconomyState(
    appendLog(
      {
        ...state,
        recoveredQuestItems: { ...state.recoveredQuestItems, [`${questId}:${itemId}`]: Date.now() },
      },
      "Quest Item Recovery",
      questId,
      `${itemId} recovered for ${questId}.`,
      true,
    ),
  );
}

export function cleanupHarthmereTemporaryQuestItemsForQuest(questId: string, itemIds: string[]) {
  const state = readHarthmereQuestEconomyState();
  writeHarthmereQuestEconomyState(
    appendLog(
      {
        ...state,
        abandonedQuestCleanup: [
          { questId, itemIds, at: Date.now() },
          ...state.abandonedQuestCleanup,
        ].slice(0, 40),
      },
      "Temporary Quest Items Cleaned",
      questId,
      `${itemIds.join(", ") || "no temporary items"} cleaned up after quest abandon/failure.`,
      true,
    ),
  );
}
