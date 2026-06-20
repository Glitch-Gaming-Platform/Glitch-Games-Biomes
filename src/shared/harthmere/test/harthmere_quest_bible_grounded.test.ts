// HARTHMERE_QUEST_BIBLE_GROUNDED_TEST
//
// Locks in the patch 02 dialogue rewrite and the cross-system contracts
// the quest catalog is supposed to honour. The single rule for this file:
// if a future quest is added or a future edit drifts off the bible voice
// or off the resolvable-data contracts, this test fails *before* it
// reaches QA — not after.
//
// Contract groups:
//   1. No quest dialogue contains author-meta / placeholder language.
//   2. Every quest dialogue field is non-empty and minimum-length.
//   3. Every quest giverId resolves to a known current/current NPC, or is one of
//      the few authored exceptions (auto-trigger, hidden, boss).
//   4. Every quest's prerequisite quest ids exist in the same catalog.
//   5. Every reward.items entry resolves to either a BikkieIds key, a
//      registered SNAPSHOT_FINAL_BIKKIE_REWARD_IDS reward symbol, or
//      an explicitly-allowed quest-bound item (Bellbinder regalia etc.).
//   6. Q1 -> Q12 main-quest chain follows the bible's hour ordering.
//   7. The Grove starter quests' parallel arrays (objectives, markerIds,
//      triggers) stay length-aligned. (Locks the fix in patch 01.)
//
// This file is referenced from the test runner via the harthmere
// bible coverage current harness.

import {
  HARTHMERE_QUEST_CATALOG,
  validateHarthmereQuestCatalog,
} from "@/shared/harthmere/quest_compendium";
import { HARTHMERE_NAMED_NPCS } from "@/shared/harthmere/npc_compendium";
import {
  HARTHMERE_ALL_NPCS,
} from "@/shared/harthmere/npc_compendium";
import { SNAPSHOT_FINAL_BIKKIE_REWARD_IDS } from "@/shared/harthmere/snapshot_production_port";
import { SNAPSHOT_GROVE_QUESTS } from "@/shared/harthmere/snapshot_grove_content";
import { validateSnapshotGroveTriggerContracts } from "@/shared/harthmere/snapshot_grove_trigger_contract";
import { BikkieIds } from "@/shared/bikkie/ids";

export const HARTHMERE_QUEST_BIBLE_GROUNDED_TEST_VERSION =
  "harthmere-quest-bible-grounded-test" as const;

// ---------------------------------------------------------------------------
// 1. Placeholder / author-meta patterns. Any of these in a dialogue field
// means the current scaffolding text leaked back in.
// ---------------------------------------------------------------------------
const PLACEHOLDER_PATTERNS: ReadonlyArray<RegExp> = [
  /frames\s+"[^"]+"\s+with a clear reason/i,
  /\bactive text for\b/i,
  /\bready-to-complete text for\b/i,
  /\bcompletion text for\b/i,
  /\bfailure text for\b/i,
  /no out-of-world scaffolding language/i,
  /\bplaceholder\b/i,
  /\bTODO\b/,
  /\bFIXME\b/,
  /\bdebug\b/i,
];

const MINIMUM_DIALOGUE_LENGTH_CHARS = 40;

// Quest givers that legitimately are not NPCs in current/current.
const NON_NPC_GIVER_IDS: ReadonlySet<string> = new Set<string>([
  "thaedryn_bellbound", // Q12 boss
]);

// Codes that legitimately have no giver (hidden, auto-trigger).
const NO_GIVER_REQUIRED_CODES: ReadonlySet<string> = new Set<string>([
  "Q8",     // auto-trigger: stair appears after Q7's First Choir is dealt with
  "Q9",     // auto-trigger: triggered after Q8 (bible II.7)
  "Q10",    // auto-trigger: triggered after Q9 (bible II.7)
  "Q2.5",   // auto-injected on well listen
  "SQ-040", // hidden — triggered by stormy-cemetery dig
  "SQ-041", // hidden — twenty-third-look door
  "SQ-042", // hidden — third storm at the Kettle
]);

// Quest-bound items that are deliberately not in Bikkie and are produced
// by quest-grant logic at runtime (regalia, story items, persistent buffs).
const QUEST_BOUND_REWARD_SYMBOLS: ReadonlySet<string> = new Set<string>([
  "bridgewalkers_eye_passive",
  "heard_the_well_flag",
  "rat_girls_token",
  "halene_letters_codex",
  "bell_fragment_quest_item",
  "bellbinders_voice_handbell",
  "forge_apprentice_brand_cosmetic",
  "bellbinders_antechamber_lore",
  "cellar_dust_cloak_cosmetic",
  "first_choir_kill_achievement",
  "crone_veil_cosmetic",
  "apprentice_gray_hood_cosmetic",
  "bell_attunement_plus_one",
  "harths_memory_pin_cosmetic",
  "vein_keepers_scale",
  "vyrahel_companion_unlock",
  "bellbinder_stole_regalia",
  "bellbinder_hammer_regalia",
  "bellbinder_tuning_fork_regalia",
  "bellbinder_handbell_regalia",
  "bellbinder_chain_regalia",
  "bellbinder_ring_regalia",
  "founders_seal",
  "tomb_keepers_boon_passive",
  "bellbinders_robe_cosmetic",
  "last_apprentice_laid_to_rest_achievement",
  "bellward_robe_cosmetic",
  "bell_tuned_party_buff",
  "rebound_legendary_title",
  "wyrmslayer_legendary_title",
  "she_who_was_greeted_mythic_title",
  "rebound_set_chest",
  "rebound_set_helm",
  "rebound_set_gloves",
  "dragon_bone_weapon",
  "bellbinders_successor_robe_set",
  "river_horse_mount",
  "armored_warhorse_mount",
  "aldrens_blessing_xp_buff",
  "civic_gratitude_repair_buff",
  "thaedryn_flyover_buff",
  // Bible-named consumables / props from side-quest scenes
  "brams_token_pin",
  "drill_square_emote",
  "night_walker_title",
  "redemption_witness_title",
  "maras_favor_dialogue_unlock",
  "maras_trust_dialogue_unlock",
  "mara_cooking_recipe",
  "copper_kettle_free_room_voucher",
  "quiet_room_achievement",
  "aetherspire_contact_unlock",
  "bard_night_regular_title",
  "bridgekeepers_edge_unique_sword",
  "apprentice_of_osric_title",
  "osric_masters_mark_stamp",
  "candlebearer_title",
  "blessed_candle_consumable",
  "tams_wooden_bell",
  "maelle_main_quest_ally_unlock",
  "hall_companion_outfit_cosmetic",
  "drathmar_contact_unlock",
  "ysabet_anti_corruption_draught",
  "free_apothecary_week_voucher",
  "fishing_rod_upgrade",
  "reed_family_friend_contact",
  "rat_crown_cosmetic",
  "hand_of_the_ward_title",
  "mudden_safehouse_unlock",
  "veska_pellmarra_inscription",
  "pellmarra_contact_unlock",
  "sella_safe_wetland_unlock",
  "charcoal_camp_supply_contract",
  "pilgrims_mark_charm",
  "trackers_eye_passive",
  "moss_marked_passive",
  "vera_harth_lore_unlock",
  "verena_minor_regen_passive",
  "found_what_was_not_meant_title",
  // Repeatable / weekly / starter outputs that are tokens, not items.
  "watch_patrol_chit",
  "watch_bounty_silver",
  "watch_gate_inspection_chit",
  "town_defense_drill_credit",
  "market_writ_chit",
  "cargo_escort_silver",
  "bridge_day_setup_credit",
  "chapel_charity_credit",
  "chapel_vigil_credit",
  "chapel_grave_tending_credit",
  "river_blessing_prep_credit",
  "river_knots_information_credit",
  "river_knots_smuggling_credit",
  "river_knots_cargo_heist_silver",
  "mudden_rat_silver",
  "mudden_food_distribution_credit",
  "mudden_ward_fair_credit",
  "wilds_road_bandit_silver",
  "wilds_resource_route_credit",
  "wilds_lost_traveler_credit",
  "briarfen_witchlight_credit",
  "harthmere_welcome_token",
  "dawnloaf_warm_loaf",
  "merl_voss_modest_silver",
  "tessen_re_temper_voucher",
  "ysabet_fever_tea_credit",
  "kettle_rumor_credit",
  "dawnloaf_bun_basket",
  "tovin_warehouse_silver",
  "gate_ledger_item",
  "watch_tabard_pin",
  "merchant_favor_token",
]);

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function dialogueViolatesPlaceholder(text: string): RegExp | undefined {
  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(text)) return pattern;
  }
  return undefined;
}

function allKnownNpcIds(): Set<string> {
  const set = new Set<string>();
  for (const npc of HARTHMERE_NAMED_NPCS) set.add(npc.id);
  for (const npc of HARTHMERE_ALL_NPCS) set.add(npc.id);
  return set;
}

function allKnownRewardSymbols(): Set<string> {
  const set = new Set<string>();
  for (const key of Object.keys(BikkieIds)) set.add(key);
  for (const key of Object.keys(SNAPSHOT_FINAL_BIKKIE_REWARD_IDS)) set.add(key);
  for (const sym of QUEST_BOUND_REWARD_SYMBOLS) set.add(sym);
  return set;
}

// Bible main-quest order. Q2.5 is optional and slots after Q2.
const BIBLE_MAIN_QUEST_ORDER: ReadonlyArray<string> = [
  "Q1", "Q2", "Q2.5", "Q3", "Q4", "Q5", "Q6", "Q7", "Q8", "Q9", "Q10", "Q11", "Q12",
];

// ---------------------------------------------------------------------------
// public summary type — used by the test runner / harness
// ---------------------------------------------------------------------------
export interface HarthmereQuestBibleGroundedReport {
  ok: boolean;
  version: typeof HARTHMERE_QUEST_BIBLE_GROUNDED_TEST_VERSION;
  totalQuests: number;
  failures: string[];
  placeholderDialogues: string[];
  shortDialogues: string[];
  unresolvedGivers: string[];
  unresolvedPrereqs: string[];
  unresolvedRewardItems: string[];
  mainQuestOrderViolations: string[];
  groveQuestArrayLengthViolations: string[];
  groveQuestTriggerViolations: string[];
  groveQuestTriggerCoverageViolations: string[];
  groveQuestMarkerViolations: string[];
  groveQuestObjectiveFixtureViolations: string[];
  groveQuestItemUseViolations: string[];
}

export function validateHarthmereQuestBibleGrounded(): HarthmereQuestBibleGroundedReport {
  const failures: string[] = [];
  const placeholderDialogues: string[] = [];
  const shortDialogues: string[] = [];
  const unresolvedGivers: string[] = [];
  const unresolvedPrereqs: string[] = [];
  const unresolvedRewardItems: string[] = [];
  const mainQuestOrderViolations: string[] = [];
  const groveQuestArrayLengthViolations: string[] = [];
  const groveQuestTriggerViolations: string[] = [];
  const groveQuestTriggerCoverageViolations: string[] = [];
  const groveQuestMarkerViolations: string[] = [];
  const groveQuestObjectiveFixtureViolations: string[] = [];
  const groveQuestItemUseViolations: string[] = [];

  const npcIds = allKnownNpcIds();
  const knownRewardSymbols = allKnownRewardSymbols();
  const allQuestIds = new Set(HARTHMERE_QUEST_CATALOG.map((q) => q.id));

  // Contract 1 + 2: dialogue lines.
  for (const quest of HARTHMERE_QUEST_CATALOG) {
    const dialogue = quest.dialogue ?? {};
    for (const field of ["offer", "active", "ready", "complete", "fail"] as const) {
      const text = dialogue[field];
      if (typeof text !== "string" || text.length === 0) {
        failures.push(`${quest.code}.${field}: missing dialogue`);
        continue;
      }
      const violation = dialogueViolatesPlaceholder(text);
      if (violation) {
        placeholderDialogues.push(`${quest.code}.${field} matches ${violation.source}`);
      }
      if (text.length < MINIMUM_DIALOGUE_LENGTH_CHARS) {
        shortDialogues.push(`${quest.code}.${field} only ${text.length} chars`);
      }
    }
  }

  // Contract 3: givers.
  for (const quest of HARTHMERE_QUEST_CATALOG) {
    if (NO_GIVER_REQUIRED_CODES.has(quest.code)) continue;
    const giverId: string | undefined = quest.giverId;
    if (!giverId) {
      unresolvedGivers.push(`${quest.code}: missing giverId`);
      continue;
    }
    if (NON_NPC_GIVER_IDS.has(giverId)) continue;
    if (!npcIds.has(giverId)) {
      unresolvedGivers.push(`${quest.code}: giver '${giverId}' not in current/current`);
    }
  }

  // Contract 4: prerequisites.
  for (const quest of HARTHMERE_QUEST_CATALOG) {
    const prereqs: ReadonlyArray<string> = quest.activeRules?.prerequisiteQuestIds ?? [];
    for (const prereq of prereqs) {
      if (!allQuestIds.has(prereq)) {
        unresolvedPrereqs.push(`${quest.code}: prerequisite '${prereq}' does not exist`);
      }
    }
  }

  // Contract 5: reward items.
  for (const quest of HARTHMERE_QUEST_CATALOG) {
    const items: ReadonlyArray<string> = quest.rewards?.items ?? [];
    for (const symbol of items) {
      if (!knownRewardSymbols.has(symbol)) {
        unresolvedRewardItems.push(`${quest.code}: reward item '${symbol}' unresolved`);
      }
    }
  }

  // Contract 6: main-quest chain order matches the bible.
  // We do not require every quest to gate the next, but the prerequisite
  // graph must not skip backwards: if Qn lists Qm as prereq, m must come
  // before n in BIBLE_MAIN_QUEST_ORDER.
  const orderIndex = new Map<string, number>();
  BIBLE_MAIN_QUEST_ORDER.forEach((code, i) => orderIndex.set(code, i));
  for (const quest of HARTHMERE_QUEST_CATALOG) {
    if (!orderIndex.has(quest.code)) continue;
    const my = orderIndex.get(quest.code)!;
    const prereqIds: ReadonlyArray<string> = quest.activeRules?.prerequisiteQuestIds ?? [];
    for (const prereqId of prereqIds) {
      const prereq = HARTHMERE_QUEST_CATALOG.find((q) => q.id === prereqId);
      if (!prereq || !orderIndex.has(prereq.code)) continue;
      if (orderIndex.get(prereq.code)! > my) {
        mainQuestOrderViolations.push(
          `${quest.code} requires ${prereq.code} but ${prereq.code} comes later in the bible`,
        );
      }
    }
  }

  // Contract 7: Grove quests' parallel arrays must align.
  //
  // NOTE: 15 existing Grove quests were authored before this contract was
  // enforced and have mismatched objective/trigger/marker array lengths.
  // Until each is re-authored, they are explicitly listed here so the
  // contract enforces alignment for *new* quests without blocking the
  // build. As each id is fixed, remove it from KNOWN_MISALIGNED_GROVE.
  const KNOWN_MISALIGNED_GROVE: ReadonlySet<string> = new Set<string>([
    // All 15 previously-misaligned Grove quests were realigned in patch 05.
    // If a new misalignment appears, the contract above will catch it.
  ]);
  for (const quest of SNAPSHOT_GROVE_QUESTS) {
    if (KNOWN_MISALIGNED_GROVE.has(quest.id)) continue;
    if (quest.objectives.length !== quest.triggers.length) {
      groveQuestArrayLengthViolations.push(
        `${quest.id}: objectives ${quest.objectives.length} != triggers ${quest.triggers.length}`,
      );
    }
    if (quest.objectives.length !== quest.markerIds.length) {
      groveQuestArrayLengthViolations.push(
        `${quest.id}: objectives ${quest.objectives.length} != markerIds ${quest.markerIds.length}`,
      );
    }
  }


  // Contract 8: every Snapshot Grove tutorial objective has a concrete
  // runtime completion trigger, marker, and synthetic fixture. This is the
  // "test every quest step" guard: if any authored objective cannot be
  // completed by a supported runtime event, this file fails.
  const groveTriggerContract = validateSnapshotGroveTriggerContracts(
    SNAPSHOT_GROVE_QUESTS,
  );
  groveQuestTriggerViolations.push(...groveTriggerContract.unsupportedTriggers);
  groveQuestTriggerCoverageViolations.push(...groveTriggerContract.uncoveredTriggers);
  groveQuestMarkerViolations.push(...groveTriggerContract.markerViolations);
  groveQuestObjectiveFixtureViolations.push(...groveTriggerContract.objectiveFixtureViolations);
  groveQuestItemUseViolations.push(...groveTriggerContract.itemUseObjectiveViolations);

  const ok =
    placeholderDialogues.length === 0 &&
    shortDialogues.length === 0 &&
    unresolvedGivers.length === 0 &&
    unresolvedPrereqs.length === 0 &&
    unresolvedRewardItems.length === 0 &&
    mainQuestOrderViolations.length === 0 &&
    groveQuestArrayLengthViolations.length === 0 &&
    groveQuestTriggerViolations.length === 0 &&
    groveQuestTriggerCoverageViolations.length === 0 &&
    groveQuestMarkerViolations.length === 0 &&
    groveQuestObjectiveFixtureViolations.length === 0 &&
    groveQuestItemUseViolations.length === 0 &&
    failures.length === 0;

  return {
    ok,
    version: HARTHMERE_QUEST_BIBLE_GROUNDED_TEST_VERSION,
    totalQuests: HARTHMERE_QUEST_CATALOG.length,
    failures,
    placeholderDialogues,
    shortDialogues,
    unresolvedGivers,
    unresolvedPrereqs,
    unresolvedRewardItems,
    mainQuestOrderViolations,
    groveQuestArrayLengthViolations,
    groveQuestTriggerViolations,
    groveQuestTriggerCoverageViolations,
    groveQuestMarkerViolations,
    groveQuestObjectiveFixtureViolations,
    groveQuestItemUseViolations,
  };
}

// ---------------------------------------------------------------------------
// Jest / vitest entry — co-located so the harthmere bible coverage runner
// can discover it without a new harness file.
// ---------------------------------------------------------------------------
// (Wrapped in a typeof guard so importing this file from a non-test
// runtime — e.g. for an admin diagnostics page — does not crash.)
declare const describe: unknown;
declare const test: unknown;
declare const expect: unknown;

if (typeof (describe as any) === "function" && typeof (test as any) === "function") {
  (describe as any)("harthmere quest bible-grounded contract current", () => {
    const report = validateHarthmereQuestBibleGrounded();

    (test as any)("catalog itself validates current contract", () => {
      const baseline = validateHarthmereQuestCatalog();
      (expect as any)(baseline.ok).toBe(true);
    });

    (test as any)("no quest dialogue contains author-meta placeholder text", () => {
      (expect as any)(report.placeholderDialogues).toEqual([]);
    });

    (test as any)("every quest dialogue field is long enough to be in-character", () => {
      (expect as any)(report.shortDialogues).toEqual([]);
    });

    (test as any)("every giverId resolves to a known NPC or authored exception", () => {
      (expect as any)(report.unresolvedGivers).toEqual([]);
    });

    (test as any)("every prerequisite quest id exists in the catalog", () => {
      (expect as any)(report.unresolvedPrereqs).toEqual([]);
    });

    (test as any)("every reward item resolves to a known symbol", () => {
      (expect as any)(report.unresolvedRewardItems).toEqual([]);
    });

    (test as any)("main quest prerequisites respect bible hour ordering", () => {
      (expect as any)(report.mainQuestOrderViolations).toEqual([]);
    });

    (test as any)("Grove quest objectives/markers/triggers are length-aligned", () => {
      (expect as any)(report.groveQuestArrayLengthViolations).toEqual([]);
    });



    (test as any)("every Grove quest objective uses a runtime-supported trigger", () => {
      (expect as any)(report.groveQuestTriggerViolations).toEqual([]);
    });

    (test as any)("every Grove quest objective trigger has completion event coverage", () => {
      (expect as any)(report.groveQuestTriggerCoverageViolations).toEqual([]);
    });

    (test as any)("every Grove quest objective has a marker id", () => {
      (expect as any)(report.groveQuestMarkerViolations).toEqual([]);
    });

    (test as any)("every Grove quest objective has a synthetic completion fixture", () => {
      (expect as any)(report.groveQuestObjectiveFixtureViolations).toEqual([]);
    });

    (test as any)("every Grove item-use objective identifies a resolvable usable item", () => {
      (expect as any)(report.groveQuestItemUseViolations).toEqual([]);
    });

    (test as any)("report.ok summary is true", () => {
      (expect as any)(report.ok).toBe(true);
    });
  });
}
