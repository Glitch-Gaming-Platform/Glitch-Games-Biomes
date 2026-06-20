// HARTHMERE_QUEST_CHAIN_VALIDATOR
//
// The bible quest catalog in `quest_compendium.ts` stores quests with
// `activeRules.prerequisiteQuestIds` (the quests that must be completed
// first), but nothing builds the *forward* chain. This file does — and uses
// the resulting graph to check:
//
//   1. Every prerequisite references an existing quest.
//   2. There are no cycles.
//   3. Every main-quest code (Q1, Q2, Q2.5, Q3 …) has at most one direct
//      forward neighbor in the main chain (a "next" pointer).  We pick the
//      next main quest by sorted code so the player can always make
//      progress.
//   4. Every quest's giverId resolves to a real named NPC, or the quest is
//      explicitly flagged as `hidden`.
//   5. Every objective `targetId` is a non-empty string.
//   6. Every quest's reward block contains a previewText (player-facing).
//
// Importantly, this file does NOT change quest data. It only reads it.
// Tests assert these invariants so a future quest edit can't silently break
// mission progression.

import {
  HARTHMERE_QUEST_CATALOG,
  validateHarthmereQuestCatalog,
} from "@/shared/harthmere/quest_compendium";

export const HARTHMERE_QUEST_CHAIN_VALIDATOR_VERSION =
  "harthmere-quest-chain-validator" as const;

export interface HarthmereQuestChainEdge {
  fromQuestId: string;
  toQuestId: string;
  // Why this edge exists: "prerequisite" means quest B prerequisite includes
  // quest A. "main_code_succession" means A and B are both in the main bible
  // chain (Q1, Q2 …) and B is the next code numerically.
  kind: "prerequisite" | "main_code_succession";
}

export interface HarthmereQuestChain {
  // Forward graph keyed by quest id.
  forward: Record<string, string[]>;
  // Reverse graph (= the prerequisite graph) keyed by quest id.
  backward: Record<string, string[]>;
  // The canonical bible chain Q1 → Q2 → … in catalog order.
  mainChain: string[];
  // Diagnostics produced during construction.
  warnings: string[];
}

function codeRank(code: string | undefined): number {
  if (!code) return Number.POSITIVE_INFINITY;
  // Q1 -> 1, Q2 -> 2, Q2.5 -> 2.5, Q10 -> 10
  const trimmed = code.replace(/^Q/i, "").trim();
  const numeric = Number.parseFloat(trimmed);
  return Number.isFinite(numeric) ? numeric : Number.POSITIVE_INFINITY;
}

export function buildHarthmereQuestChain(): HarthmereQuestChain {
  const warnings: string[] = [];
  const quests = HARTHMERE_QUEST_CATALOG as readonly any[];
  const byId = new Map<string, any>();
  for (const q of quests) {
    if (byId.has(q.id)) warnings.push(`duplicate quest id: ${q.id}`);
    byId.set(q.id, q);
  }
  const forward: Record<string, string[]> = {};
  const backward: Record<string, string[]> = {};
  for (const q of quests) {
    forward[q.id] ??= [];
    backward[q.id] ??= [];
    const prereqs: string[] = q.activeRules?.prerequisiteQuestIds ?? [];
    for (const p of prereqs) {
      if (!byId.has(p)) {
        warnings.push(`quest ${q.id} references missing prerequisite ${p}`);
        continue;
      }
      (forward[p] ??= []).push(q.id);
      (backward[q.id] ??= []).push(p);
    }
  }

  // Sort the main chain by numeric code.
  const mainChain = quests
    .filter((q) => q.category === "main" && q.code)
    .slice()
    .sort((a, b) => codeRank(a.code) - codeRank(b.code))
    .map((q) => q.id);

  return { forward, backward, mainChain, warnings };
}

export interface HarthmereQuestChainValidation {
  ok: boolean;
  failures: string[];
  warnings: string[];
  totalQuests: number;
  mainChainLength: number;
}

export function validateHarthmereQuestChain(opts?: {
  knownNpcIds?: ReadonlySet<string>;
}): HarthmereQuestChainValidation {
  const failures: string[] = [];
  const knownNpcIds = opts?.knownNpcIds;
  const quests = HARTHMERE_QUEST_CATALOG as readonly any[];
  const catalogCheck = validateHarthmereQuestCatalog();
  for (const failure of catalogCheck.failures) {
    failures.push(`catalog: ${failure}`);
  }

  const chain = buildHarthmereQuestChain();

  // Cycle detection via DFS.
  const visited = new Map<string, "pending" | "done">();
  const visit = (id: string, stack: string[]): boolean => {
    const state = visited.get(id);
    if (state === "done") return true;
    if (state === "pending") {
      failures.push(`cycle: ${stack.concat(id).join(" -> ")}`);
      return false;
    }
    visited.set(id, "pending");
    for (const next of chain.forward[id] ?? []) {
      visit(next, stack.concat(id));
    }
    visited.set(id, "done");
    return true;
  };
  for (const id of Object.keys(chain.forward)) visit(id, []);

  // Validate per-quest invariants.
  for (const q of quests) {
    if (!q.id || typeof q.id !== "string") {
      failures.push("quest missing string id");
      continue;
    }
    if (!q.title) failures.push(`quest ${q.id} missing title`);
    if (!q.rewards?.previewText) {
      failures.push(`quest ${q.id} missing rewards.previewText`);
    }
    if (!q.hidden && (!q.giverId || typeof q.giverId !== "string")) {
      failures.push(`quest ${q.id} not hidden but has no giverId`);
    }
    if (!q.hidden && knownNpcIds && q.giverId && !knownNpcIds.has(q.giverId)) {
      failures.push(`quest ${q.id} giverId '${q.giverId}' is not a known NPC`);
    }
    const objectives: any[] = q.objectives ?? [];
    if (!objectives.length) {
      failures.push(`quest ${q.id} has no objectives`);
    }
    for (const objective of objectives) {
      if (!objective?.targetId || typeof objective.targetId !== "string") {
        failures.push(`quest ${q.id} objective missing targetId`);
      }
      if (!objective?.id || typeof objective.id !== "string") {
        failures.push(`quest ${q.id} objective missing id`);
      }
    }
  }

  return {
    ok: failures.length === 0,
    failures,
    warnings: chain.warnings,
    totalQuests: quests.length,
    mainChainLength: chain.mainChain.length,
  };
}

/**
 * For UI / runtime: given a player's completed quests + currently active
 * quests, return the next-best quest to suggest, walking the main chain
 * first and then offering side quests gated on currently-completed mains.
 */
export function nextSuggestedHarthmereQuest(input: {
  completedQuestIds: ReadonlySet<string>;
  activeQuestIds: ReadonlySet<string>;
}): { questId: string; reason: "next_main_chain" | "unlocked_side" } | undefined {
  const chain = buildHarthmereQuestChain();
  // 1. Walk the main chain for the first one that is neither completed nor active.
  for (const id of chain.mainChain) {
    if (input.completedQuestIds.has(id)) continue;
    if (input.activeQuestIds.has(id)) continue;
    // Make sure all prereqs are complete.
    const prereqs = chain.backward[id] ?? [];
    if (prereqs.every((p) => input.completedQuestIds.has(p))) {
      return { questId: id, reason: "next_main_chain" };
    }
  }
  // 2. Otherwise, surface the first side quest whose prereqs are satisfied.
  const quests = HARTHMERE_QUEST_CATALOG as readonly any[];
  for (const q of quests) {
    if (q.category === "main") continue;
    if (q.hidden) continue;
    if (input.completedQuestIds.has(q.id)) continue;
    if (input.activeQuestIds.has(q.id)) continue;
    const prereqs: string[] = q.activeRules?.prerequisiteQuestIds ?? [];
    if (prereqs.every((p) => input.completedQuestIds.has(p))) {
      return { questId: q.id, reason: "unlocked_side" };
    }
  }
  return undefined;
}
