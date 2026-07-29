// GROVE_QUEST_SCHEMA
//
// Types for the Snapshot Grove onboarding catalog, restructured to match the
// Chapter 1 / Bible shape so all three quest systems share one vocabulary.
// See docs/harthmere/BIBLE_TO_CH1_MIGRATION.md and
// docs/harthmere/GROVE_TO_CH1_MIGRATION.md.
//
// DATA-FREE and DEPENDENCY-FREE: only `type`-position imports, so it erases at
// compile time and loads under `.mocharc.fast.json` with no bootstrap.
//
// THE STRUCTURAL PROBLEM THIS FIXES
// ---------------------------------
// The retired `SnapshotGroveQuest` stored an objective as THREE PARALLEL
// ARRAYS — `objectives: string[]`, `triggers: Trigger[]`, `markerIds:
// string[]` — indexed positionally. Nothing in the type system tied index 2 of
// one array to index 2 of the others; a separate hand-written test existed
// solely to assert the three lengths matched, and inserting an objective meant
// editing three places in lockstep.
//
// Here an objective is one object, so the invariant is structural rather than
// asserted, and inserting one is a single edit.

import type { Vec3 } from "@/shared/math/types";

export const GROVE_QUEST_SCHEMA_VERSION = 1 as const;

// ---------------------------------------------------------------------------
// Closed unions.
// ---------------------------------------------------------------------------

export type GroveQuestArc =
  | "fountain"
  | "graduation"
  | "neighbor"
  | "story"
  | "economy";

export type GroveQuestCategory =
  | "fountain_lesson"
  | "road_graduation"
  | "road_neighbor"
  | "road_story";

export type GroveArea =
  | "the_grove"
  | "old_grove_road"
  | "genesis_crossroads"
  | "lovely_locks"
  | "mosslawn"
  | "shutter_cove"
  | "muck_edges"
  | "harthmere_connector";

/**
 * Objective trigger kinds.
 *
 * Retained verbatim from the retired `SnapshotGroveTrigger`. Grove triggers
 * are deliberately COARSER than Bible step types: a Grove objective says "a
 * craft happened", not "this exact item was crafted". That looseness is the
 * tutorial's design — any craft should satisfy "try crafting" — so it is
 * preserved rather than tightened, and `grove_trigger_events.ts` keeps the
 * mapping from each kind to the client events that satisfy it.
 */
export type GroveTrigger =
  | "talk_npc"
  | "near_location"
  | "interact"
  | "destroy"
  | "place_voxel"
  | "inventory_change"
  | "open_tab"
  | "jump_run"
  | "photo_post"
  | "craft"
  | "combat"
  | "collect"
  | "choice"
  | "open_jobs_board"
  | "item_grant"
  | "item_use"
  | "item_update"
  | "status_check"
  | "escort"
  | "carry";

// ---------------------------------------------------------------------------
// Unlock.
//
// Grove's three prerequisite kinds, unchanged in meaning. Only
// `quest_completed` maps onto a native `challengeComplete` unlock; the other
// two are evaluated by the gate because native `Challenges` cannot express
// "any N of this set" or "started but not finished".
// ---------------------------------------------------------------------------

export type GroveQuestStart =
  /** Offered by an NPC with no prerequisite. */
  | { readonly kind: "giver"; readonly giverNpcId: string }
  /** Gated on one completed quest. Projects to `challengeComplete`. */
  | {
      readonly kind: "after";
      readonly questId: string;
      readonly giverNpcId: string;
    }
  /**
   * Gated on finishing N fountain lessons. This is the road-graduation chain:
   * the fountain hub stops dumping every quest on a brand-new player and
   * starts gating road-neighbour introductions behind real progress.
   */
  | {
      readonly kind: "after_fountain_lessons";
      readonly minCompleted: number;
      readonly giverNpcId: string;
    }
  /** Gated on another quest merely being ACCEPTED, not completed. */
  | {
      readonly kind: "after_accepted";
      readonly questId: string;
      readonly giverNpcId: string;
    };

// ---------------------------------------------------------------------------
// Steps.
// ---------------------------------------------------------------------------

/** Exact recipe a `craft` objective demands. */
export interface GroveStepCraftRequirement {
  readonly recipeId: string;
  readonly outputItemId: string;
}

/** Exact item a delivery/hand-in objective demands. */
export interface GroveStepInventoryRequirement {
  readonly itemId: string;
  readonly count: number;
  readonly consumeOnComplete: boolean;
}

export interface GroveQuestStep {
  /** Stable authored id, `<questId>_obj_<NN>`. */
  readonly id: string;
  /**
   * Frozen position in the authored order.
   *
   * Native step ids are pinned by INDEX (`grove:<questId>:objective:<n>` in
   * the manifest), not by authored id, so the index is load-bearing identity
   * and reordering is a migration. Carried explicitly rather than inferred so
   * a reorder is visible in review.
   */
  readonly index: number;
  readonly label: string;
  readonly trigger: GroveTrigger;
  /** Landmark id this objective points at. Resolved by `grove_waypoints.ts`. */
  readonly markerId: string;

  // -------------------------------------------------------------------------
  // EXACT REQUIREMENTS
  //
  // `trigger` alone is deliberately coarse — "a craft happened", not "this
  // recipe". That looseness suits most of the tutorial, but 21 objectives DO
  // have exact requirements, and those used to live in four separate tables in
  // `snapshot_grove_trigger_contract.ts` keyed by `${questId}:${index}`.
  //
  // That was a FOURTH positional index. Collapsing objectives/triggers/markers
  // into one object fixed three of four dimensions and left this one outside
  // the type, which is the same coupling wearing a different hat: inserting an
  // objective silently re-pointed every override after it.
  //
  // They now live on the step. Absent means "no exact requirement", which is
  // the common case, so the data stays readable.
  // -------------------------------------------------------------------------

  /**
   * How many the objective needs. Defaults to 1.
   *
   * TWO MEANINGS, decided by whether the step is multi-target:
   *
   *   single target  a QUANTITY gathered from one place —
   *                  "Gather two practice sticks from the marked basket"
   *                  (fountain_first_recipe_torch, cart_that_forgot_its_wheel)
   *   multi target   how many DISTINCT markers must be visited —
   *                  three warning-moss patches, three song stones
   *
   * Conflating them is easy and was worth writing down: a contract asserting
   * `requiredCount <= targetMarkerIds.length` looks obviously right and
   * immediately flagged both quantity objectives as unsatisfiable.
   */
  readonly requiredCount?: number;
  /**
   * Markers that satisfy this objective, when it is not simply `markerId`.
   *
   * Four objectives are multi-target (three warning-moss patches, three song
   * stones, three track rubbings, two pigment clumps). For those, `markerId`
   * is only the FIRST target — which is why nothing may treat `markerId` as
   * the authoritative target list.
   */
  readonly targetMarkerIds?: readonly string[];
  readonly craft?: GroveStepCraftRequirement;
  readonly inventory?: GroveStepInventoryRequirement;
}

// ---------------------------------------------------------------------------
// The quest.
// ---------------------------------------------------------------------------

export interface GroveQuestDef {
  readonly id: string;
  readonly title: string;
  readonly arc: GroveQuestArc;
  readonly category: GroveQuestCategory;
  /** Free-text authored area label, e.g. "The Grove Fountain". */
  readonly area: string;
  readonly hook: string;
  readonly start: GroveQuestStart;
  readonly steps: readonly GroveQuestStep[];
  /** Authored prose reward, e.g. "25 XP, Grove tracker confidence". */
  readonly reward: string;
  readonly sampleDialogue: string;
  /** True for the quests that hand the player over to Harthmere. */
  readonly connectorToHarthmere: boolean;
  /** True when this quest counts toward the graduation lesson total. */
  readonly countsAsFountainLesson: boolean;
}

// ---------------------------------------------------------------------------
// Narrow accessors, so call sites never reach for `any`.
// ---------------------------------------------------------------------------

/** The NPC who offers this quest. Present for every Grove start kind. */
export function groveQuestGiverId(quest: GroveQuestDef): string {
  return quest.start.giverNpcId;
}

/** The single quest that must be COMPLETED first, if any. */
export function groveQuestPrerequisiteId(
  quest: GroveQuestDef
): string | undefined {
  return quest.start.kind === "after" ? quest.start.questId : undefined;
}

/** The quest that must be ACCEPTED first, if any. */
export function groveQuestAcceptedPrerequisiteId(
  quest: GroveQuestDef
): string | undefined {
  return quest.start.kind === "after_accepted" ? quest.start.questId : undefined;
}

export function groveQuestRequiredFountainLessons(
  quest: GroveQuestDef
): number {
  return quest.start.kind === "after_fountain_lessons"
    ? quest.start.minCompleted
    : 0;
}

export function groveQuestStepByIndex(
  quest: GroveQuestDef,
  index: number
): GroveQuestStep | undefined {
  return quest.steps[index];
}

/** Marker ids this quest can put on the map, in step order. */
export function groveQuestMarkerIds(quest: GroveQuestDef): string[] {
  return quest.steps.map((step) => step.markerId);
}

/**
 * Every marker that satisfies a step.
 *
 * Use this, not `step.markerId`, wherever "did the player reach the target"
 * is being decided: four objectives have several targets and `markerId` names
 * only the first.
 */
export function groveStepTargetMarkerIds(
  step: GroveQuestStep
): readonly string[] {
  return step.targetMarkerIds?.length
    ? step.targetMarkerIds
    : [step.markerId];
}

/** How many targets a step needs. Defaults to 1. */
export function groveStepRequiredCount(step: GroveQuestStep): number {
  return step.requiredCount ?? 1;
}

export type { Vec3 };
