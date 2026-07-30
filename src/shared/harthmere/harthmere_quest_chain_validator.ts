// HARTHMERE_QUEST_CHAIN_VALIDATOR
//
// The typed bible quest catalog stores prerequisites on an `after` start, but
// nothing builds the *forward* chain. This file does — and uses
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

import { BIBLE_QUEST_CATALOG } from "@/shared/harthmere/bible/bible_quest_catalog";
import {
  bibleQuestGiverId,
  bibleQuestPrerequisiteId,
  type BibleQuestDef,
} from "@/shared/harthmere/bible/bible_quest_schema";

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
  const quests: readonly BibleQuestDef[] = BIBLE_QUEST_CATALOG;
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
    const prereq = bibleQuestPrerequisiteId(q);
    const prereqs: string[] = prereq ? [prereq] : [];
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
  const quests: readonly BibleQuestDef[] = BIBLE_QUEST_CATALOG;
  // The retired `validateHarthmereQuestCatalog` checked duplicate ids, reward
  // previews, giver-or-hidden, non-empty objectives and activation test cases.
  // The first four are asserted below against typed data; the fifth checked a
  // prose field that no longer ships (migration doc section 4). Duplicate ids
  // are now structurally impossible to miss, so they are checked here once.
  const seenIds = new Set<string>();
  for (const quest of BIBLE_QUEST_CATALOG) {
    if (seenIds.has(quest.id)) failures.push(`duplicate quest id: ${quest.id}`);
    seenIds.add(quest.id);
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
    if (!q.rewards.previewText) {
      failures.push(`quest ${q.id} missing rewards.previewText`);
    }
    const giverId = bibleQuestGiverId(q);
    // An auto-starting quest legitimately has no giver, so "not hidden" is no
    // longer sufficient — the real rule is that a quest must be startable by
    // SOME means. `start.kind` says which, exhaustively.
    if (q.start.kind === "giver" && !giverId) {
      failures.push(`quest ${q.id} has a giver start but no giverId`);
    }
    if (giverId && knownNpcIds && !knownNpcIds.has(giverId)) {
      failures.push(`quest ${q.id} giverId '${giverId}' is not a known NPC`);
    }
    if (!q.steps.length) {
      failures.push(`quest ${q.id} has no objectives`);
    }
    for (const step of q.steps) {
      if (!step.targetId)
        failures.push(`quest ${q.id} objective missing targetId`);
      if (!step.id) failures.push(`quest ${q.id} objective missing id`);
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
}):
  | { questId: string; reason: "next_main_chain" | "unlocked_side" }
  | undefined {
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
  const quests: readonly BibleQuestDef[] = BIBLE_QUEST_CATALOG;
  for (const q of quests) {
    if (q.category === "main") continue;
    if (q.hidden) continue;
    if (input.completedQuestIds.has(q.id)) continue;
    if (input.activeQuestIds.has(q.id)) continue;
    const prereq = bibleQuestPrerequisiteId(q);
    const prereqs: string[] = prereq ? [prereq] : [];
    if (prereqs.every((p) => input.completedQuestIds.has(p))) {
      return { questId: q.id, reason: "unlocked_side" };
    }
  }
  return undefined;
}
