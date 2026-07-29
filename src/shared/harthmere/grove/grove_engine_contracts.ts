// GROVE_ENGINE_AUTHORITY_CONTRACTS
//
// Machine-checkable statements of how Grove quests may touch the engine, in
// the style of `ch1_engine_contracts.ts` and `bible_engine_contracts.ts`.
//
// Sources encoded here:
//   docs/harthmere/GROVE_TO_CH1_MIGRATION.md
//   docs/harthmere/HARTHMERE_BIOMES_ECS_SOURCE_OF_TRUTH.md
//   docs/harthmere/TESTING_FASTER.md
//   snapshot_grove_content.ts (the courtyard-burial incident)

import {
  GROVE_QUEST_CATALOG,
  GROVE_FOUNTAIN_LESSON_IDS,
  groveQuest,
} from "@/shared/harthmere/grove/grove_quest_catalog";
import {
  groveNativeQuestId,
  groveNativeStepId,
} from "@/shared/harthmere/grove/grove_quest_ids";
import {
  groveLandmark,
  groveQuestWorldWaypoints,
  groveStepWorldWaypoint,
} from "@/shared/harthmere/grove/grove_waypoints";
import { groveQuestIsGateEnforced } from "@/shared/harthmere/grove/grove_native_quests";
import {
  groveQuestGiverId,
  groveStepRequiredCount,
  groveStepTargetMarkerIds,
  type GroveQuestDef,
} from "@/shared/harthmere/grove/grove_quest_schema";
import { SNAPSHOT_GROVE_LIVE_MARKER_Y } from "@/shared/harthmere/snapshot_grove_content";
import type { Vec3 } from "@/shared/math/types";

export const GROVE_ENGINE_CONTRACTS_VERSION = 1 as const;

// ---------------------------------------------------------------------------
// Native ECS
// ---------------------------------------------------------------------------

export const GROVE_NATIVE_ECS_OWNED = Object.freeze([
  "quest availability, progress, and completion",
  "objective step completion",
  "xp and derived stats",
  "item rewards",
  "quest giver entities and transforms",
] as const);

/**
 * State Grove keeps OUTSIDE native ECS today.
 *
 * THIS LIST IS NOT EMPTY, AND SAYING IT WAS WAS WRONG.
 *
 * An earlier version of this file declared `GROVE_NON_ECS_OWNED = []` with a
 * comment claiming onboarding has no state without an ECS model. That describes
 * the intended END STATE, not the code: the live runtime and cloud save still
 * carry `acceptedQuestIds`, `completedQuestIds` and `completedObjectiveIds`
 * alongside native `Challenges`/`TriggerState`
 * (see `harthmere_cloud_save_rehydration.ts`).
 *
 * A contract that asserts an aspiration as though it were reached is worse
 * than no contract — it tells a reader the dual-authority problem is solved
 * when it is the exact thing still outstanding. So the real state is named
 * here and the target is kept separate, below.
 */
// Typed as `readonly string[]`, NOT a frozen tuple. A tuple type lets tsc
// narrow `.length` to a literal and declare the emptiness check below dead
// code — which would delete the very drift detection this exists for.
export const GROVE_NON_ECS_OWNED: readonly string[] = Object.freeze([
  "accepted quest ids (live runtime + cloud save)",
  "completed quest ids (live runtime + cloud save)",
  "completed objective ids (live runtime + cloud save)",
]);

/**
 * What this list should become, and the condition for getting there.
 *
 * Grove genuinely has no state that ECS cannot model — a lesson is either
 * finished or not — so the target really is empty. It becomes true when the
 * live runtime reads challenge/trigger state instead of maintaining its own
 * copy, at which point the entries above are projection, not authority, and
 * can be deleted.
 *
 * Until then `groveValidateNonEcsStateIsDeclared` only checks that the list is
 * HONEST, not that it is empty.
 */
export const GROVE_NON_ECS_TARGET: readonly string[] = Object.freeze([]);

/**
 * ECS RULE 4 — the non-ECS list must describe reality.
 *
 * Passing `true` for `liveRuntimeStillMirrorsQuestState` (which it does today)
 * requires the list to be non-empty. Passing `false` requires it to be empty.
 * Either way the declaration cannot drift away from the code without failing.
 */
export function groveValidateNonEcsStateIsDeclared(
  liveRuntimeStillMirrorsQuestState: boolean
): string[] {
  const errors: string[] = [];
  if (liveRuntimeStillMirrorsQuestState && GROVE_NON_ECS_OWNED.length === 0) {
    errors.push(
      "GROVE_NON_ECS_OWNED is empty, but the live runtime still mirrors quest " +
        "state outside ECS — the contract is claiming an unreached end state"
    );
  }
  if (!liveRuntimeStillMirrorsQuestState && GROVE_NON_ECS_OWNED.length > 0) {
    errors.push(
      "the live runtime no longer mirrors quest state, so GROVE_NON_ECS_OWNED " +
        "should now be empty and match GROVE_NON_ECS_TARGET"
    );
  }
  return errors;
}

/**
 * ECS RULE 1 — every authored step is addressable by the signed progress path.
 *
 * `harthmere_quest_progress.ts` rejects any step id absent from the biscuit's
 * trigger tree, so an unaddressable step is a permanent soft-lock rather than
 * a visible error.
 */
export function groveValidateEveryStepIsAddressable(): string[] {
  const errors: string[] = [];
  for (const quest of GROVE_QUEST_CATALOG) {
    if (groveNativeQuestId(quest.id) === undefined) {
      errors.push(`${quest.id}: no native challenge id`);
    }
    if (quest.steps.length === 0) {
      errors.push(`${quest.id}: no objectives — can never be completed`);
    }
    for (const step of quest.steps) {
      if (groveNativeStepId(quest.id, step.index) === undefined) {
        errors.push(`${quest.id}/${step.index}: no native step id`);
      }
    }
  }
  return errors;
}

/**
 * ECS RULE 2 — step index is identity.
 *
 * Grove native step ids are pinned by position, because the retired shape had
 * no per-objective ids. A step whose `index` disagrees with its position in
 * the array would resolve to a different pinned id than the trigger tree
 * built, and the objective would silently never complete.
 */
export function groveValidateStepIndexesMatchPosition(): string[] {
  const errors: string[] = [];
  for (const quest of GROVE_QUEST_CATALOG) {
    for (const [position, step] of quest.steps.entries()) {
      if (step.index !== position) {
        errors.push(
          `${quest.id}/${step.id}: index ${step.index} but position ${position} ` +
            `— native step ids are pinned by position`
        );
      }
    }
  }
  return errors;
}

/**
 * ECS RULE 3 — a gate-enforced quest must actually be gate-checked.
 *
 * `after_fountain_lessons` and `after_accepted` are deliberately NOT projected
 * as native unlocks, so the native challenge is available and only the gate
 * stops it being offered. If such a quest ever loses its gate condition it
 * becomes silently open from the first second of the game.
 */
export function groveValidateGateEnforcedQuestsHaveConditions(): string[] {
  const errors: string[] = [];
  for (const quest of GROVE_QUEST_CATALOG) {
    if (!groveQuestIsGateEnforced(quest)) continue;
    if (quest.start.kind === "after_fountain_lessons") {
      if (quest.start.minCompleted <= 0) {
        errors.push(
          `${quest.id}: gate-enforced but requires ${quest.start.minCompleted} ` +
            `lessons — it is open from the start`
        );
      }
      if (quest.start.minCompleted > GROVE_FOUNTAIN_LESSON_IDS.length) {
        errors.push(
          `${quest.id}: requires ${quest.start.minCompleted} lessons but only ` +
            `${GROVE_FOUNTAIN_LESSON_IDS.length} exist — unreachable`
        );
      }
    }
    if (quest.start.kind === "after_accepted" && !quest.start.questId) {
      errors.push(`${quest.id}: gate-enforced on acceptance of nothing`);
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Gaia
// ---------------------------------------------------------------------------

/** GAIA RULE 1 — Grove quests do not simulate terrain. */
export const GROVE_GAIA_UNTOUCHED = true as const;

/**
 * GAIA RULE 2 — no shipped waypoint may sit in the retired coordinate space.
 *
 * The landmark table mixes two vertical datums. `snapshot_grove_content.ts`
 * records the consequence directly: "the broken-courtyard logs showed the
 * player at y=70.5 while seeded Grove NPCs were still at y=53, leaving the
 * mission cast buried under the courtyard." A marker 17 blocks under the floor
 * is a browser test that walks forever.
 */
export function groveValidateWaypointsAreLive(): string[] {
  const errors: string[] = [];
  for (const quest of GROVE_QUEST_CATALOG) {
    for (const step of quest.steps) {
      const position = groveStepWorldWaypoint(step);
      if (!position) {
        errors.push(
          `${quest.id}/${step.id}: marker "${step.markerId}" has no landmark`
        );
        continue;
      }
      if (position[1] === 0) {
        errors.push(`${quest.id}/${step.id}: waypoint has Y=0`);
      }
      if (!Number.isFinite(position[0] + position[1] + position[2])) {
        errors.push(`${quest.id}/${step.id}: non-finite waypoint`);
      }
    }
  }
  return errors;
}

/**
 * GAIA RULE 3 — every objective marker resolves to a real landmark.
 *
 * A marker id with no landmark produces a quest step the map cannot point at,
 * which in a browser looks identical to "the objective is broken".
 */
export function groveValidateMarkersResolve(): string[] {
  const errors: string[] = [];
  for (const quest of GROVE_QUEST_CATALOG) {
    for (const step of quest.steps) {
      if (!groveLandmark(step.markerId)) {
        errors.push(
          `${quest.id}/${step.id}: unknown marker "${step.markerId}"`
        );
      }
    }
  }
  return errors;
}

/** Grove-area waypoints that the resolver had to lift out of retired space. */
export function groveLiftedWaypointCount(): number {
  let lifted = 0;
  for (const quest of GROVE_QUEST_CATALOG) {
    for (const position of groveQuestWorldWaypoints(quest)) {
      if (position[1] === SNAPSHOT_GROVE_LIVE_MARKER_Y) lifted += 1;
    }
  }
  return lifted;
}

// ---------------------------------------------------------------------------
// Anima
// ---------------------------------------------------------------------------

/**
 * ANIMA RULE 1 — givers resolve by id, never by display name.
 */
export function groveValidateGiversResolve(
  resolveGiver: (giverId: string) => unknown
): string[] {
  const errors: string[] = [];
  for (const quest of GROVE_QUEST_CATALOG) {
    const giverId = groveQuestGiverId(quest);
    if (!resolveGiver(giverId)) {
      errors.push(
        `${quest.id}: giver "${giverId}" does not resolve to a seeded entity ` +
          `— the quest would be permanently unofferable`
      );
    }
  }
  return errors;
}

/**
 * ANIMA RULE 2 — a giver must stand where their quest happens.
 *
 * AREA IS NOT ENOUGH, and this rule exists because an area-only version of it
 * passed while being wrong. Old Coop and the fountain are both `the_grove`,
 * but he stands 139 blocks away; every other fountain NPC is within 11. An
 * area check called that fine and would have turned the game's first tutorial
 * into a long round trip.
 *
 * The alternative — relocating an NPC to suit a quest — is forbidden: Grove
 * quest state is per-player while the NPC set is SHARED, so moving them moves
 * them for everyone and takes position authority away from Anima's brain and
 * return-home anchor. So the giver must ALREADY be in place, and "in place"
 * has to mean a distance, not a label.
 */
export const GROVE_GIVER_MAX_DISTANCE_FROM_QUEST_OPENING = 32;

export function groveValidateGiverIsNearQuestOpening(
  giverPosition: (giverId: string) => Vec3 | undefined
): string[] {
  const errors: string[] = [];
  for (const quest of GROVE_QUEST_CATALOG) {
    // Connector quests deliberately hand the player from one place to another.
    if (quest.connectorToHarthmere) continue;
    const giverId = groveQuestGiverId(quest);
    const from = giverPosition(giverId);
    const opening = quest.steps[0]
      ? groveStepWorldWaypoint(quest.steps[0])
      : undefined;
    if (!from || !opening) continue;
    const distance = Math.hypot(from[0] - opening[0], from[2] - opening[2]);
    if (distance > GROVE_GIVER_MAX_DISTANCE_FROM_QUEST_OPENING) {
      errors.push(
        `${quest.id}: giver "${giverId}" stands ${Math.round(distance)} blocks ` +
          `from where the quest opens (limit ` +
          `${GROVE_GIVER_MAX_DISTANCE_FROM_QUEST_OPENING}) — reassigning here ` +
          `would need a shared NPC to be relocated`
      );
    }
  }
  return errors;
}

/**
 * ANIMA RULE 2b — a "talk to the giver" objective must point at THAT giver.
 *
 * Reassigning a quest is not an id swap. The authored objectives carry the
 * giver's own map marker, so a reassignment that updates `start.giverNpcId`
 * and leaves the marker behind produces a quest one NPC offers while the map
 * arrow sends the player to a different one. That reads as a broken quest, not
 * a reassigned one, and nothing else in the stack would have caught it.
 */
export function groveValidateTalkStepsPointAtTheirGiver(
  markerNpcId: (markerId: string) => string | undefined
): string[] {
  const errors: string[] = [];
  for (const quest of GROVE_QUEST_CATALOG) {
    const giverId = groveQuestGiverId(quest);
    for (const step of quest.steps) {
      if (step.trigger !== "talk_npc") continue;
      const target = markerNpcId(step.markerId);
      // A later talk step may legitimately name a DIFFERENT npc (a delivery, a
      // referral) or a PLACE where the conversation happens — three connector
      // quests point at `harthmere_market_office`, `harthmere_chapel_stone`
      // and `harthmere_bridge_center`, which are real locations, not people.
      // Only the OPENING step is constrained, because that is the one the
      // player follows straight from the quest offer.
      if (step.index === 0 && target !== undefined && target !== giverId) {
        errors.push(
          `${quest.id}/${step.id}: the OPENING talk objective points at ` +
            `"${target}" but the quest is given by "${giverId}"`
        );
      }
    }
  }
  return errors;
}

/**
 * ANIMA RULE 3 — quest data never publishes an ECS move.
 */
export function groveValidateNoEcsMovesAuthored(): string[] {
  const errors: string[] = [];
  const forbidden = ["publish", "ecsMove", "entityUpdate", "teleport"];
  for (const quest of GROVE_QUEST_CATALOG) {
    const rows: Array<[string, Record<string, unknown>]> = [
      [quest.id, quest as unknown as Record<string, unknown>],
      ...quest.steps.map(
        (step) =>
          [
            `${quest.id}/${step.id}`,
            step as unknown as Record<string, unknown>,
          ] as [string, Record<string, unknown>]
      ),
    ];
    for (const [label, row] of rows) {
      for (const key of forbidden) {
        if (row[key] !== undefined) {
          errors.push(
            `${label}: carries "${key}" — quest data is a projection and must ` +
              `never publish an ECS move`
          );
        }
      }
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Protected native chain
// ---------------------------------------------------------------------------

/**
 * The four original-snapshot quests that are NOT Grove quests and must never
 * be reachable from this catalog.
 *
 * They are Bikkie biscuits baked into `snapshot_backup.json` with their own
 * ids and their own engine-native trigger leaves (`npcKilled`, `inspect`,
 * `collect`). The Grove catalog cannot express them and must never claim to:
 * a Grove quest that reused one of these ids would overwrite a shipped quest
 * tree in every live player's Challenges.
 */
export const GROVE_PROTECTED_NATIVE_QUEST_IDS = Object.freeze({
  roadAhead: 6193612340426932,
  busted: 7405046529843322,
  getTheMuckOut: 817959262145055,
  muckVsMachine: 5739496793885069,
} as const);

export function groveValidateProtectedChainUntouched(): string[] {
  const errors: string[] = [];
  const protectedIds = new Set<number>(
    Object.values(GROVE_PROTECTED_NATIVE_QUEST_IDS)
  );
  for (const quest of GROVE_QUEST_CATALOG) {
    const nativeId = Number(groveNativeQuestId(quest.id));
    if (protectedIds.has(nativeId)) {
      errors.push(
        `${quest.id}: claims protected native quest id ${nativeId} — this ` +
          `would overwrite a shipped snapshot quest tree`
      );
    }
    for (const step of quest.steps) {
      const stepId = Number(groveNativeStepId(quest.id, step.index));
      if (protectedIds.has(stepId)) {
        errors.push(`${quest.id}/${step.id}: claims protected id ${stepId}`);
      }
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Aggregate
// ---------------------------------------------------------------------------

export function groveValidateEngineContracts(options?: {
  resolveGiver?: (giverId: string) => unknown;
  giverPosition?: (giverId: string) => Vec3 | undefined;
  markerNpcId?: (markerId: string) => string | undefined;
}): string[] {
  return [
    ...groveValidateEveryStepIsAddressable(),
    ...groveValidateStepIndexesMatchPosition(),
    ...groveValidateGateEnforcedQuestsHaveConditions(),
    ...groveValidateWaypointsAreLive(),
    ...groveValidateMarkersResolve(),
    ...groveValidateNoEcsMovesAuthored(),
    ...groveValidateProtectedChainUntouched(),
    ...groveValidateStepRequirements(),
    ...(options?.resolveGiver
      ? groveValidateGiversResolve(options.resolveGiver)
      : []),
    ...(options?.giverPosition
      ? groveValidateGiverIsNearQuestOpening(options.giverPosition)
      : []),
    ...(options?.markerNpcId
      ? groveValidateTalkStepsPointAtTheirGiver(options.markerNpcId)
      : []),
  ];
}

export function groveQuestsMissingSteps(): GroveQuestDef[] {
  return GROVE_QUEST_CATALOG.filter((quest) => quest.steps.length === 0);
}

export { groveQuest };

// ---------------------------------------------------------------------------
// Exact objective requirements
// ---------------------------------------------------------------------------

/**
 * ECS RULE 5 — an exact requirement must belong to a real step.
 *
 * The recipe, item, count and multi-target data used to live in four tables in
 * `snapshot_grove_trigger_contract.ts` keyed by `${questId}:${objectiveIndex}`.
 * That was a FOURTH positional index outside the quest type: inserting an
 * objective silently re-pointed every override after it, and an override for a
 * step that no longer existed simply stopped applying — no error, no log, just
 * a delivery quest that accepts any item.
 *
 * They now live on the step, so an orphan is impossible by construction. This
 * check guards the properties that construction alone does not give:
 * requirements must be internally coherent, and must sit on a step whose
 * trigger can actually satisfy them.
 */
export function groveValidateStepRequirements(): string[] {
  const errors: string[] = [];
  for (const quest of GROVE_QUEST_CATALOG) {
    for (const step of quest.steps) {
      const targets = groveStepTargetMarkerIds(step);
      const required = groveStepRequiredCount(step);

      if (required < 1) {
        errors.push(`${quest.id}/${step.id}: requiredCount ${required} < 1`);
      }
      // Only MULTI-TARGET steps count markers. On a single-target step
      // `requiredCount` is a quantity gathered from one place ("Gather two
      // practice sticks from the marked basket"), so comparing it to the
      // marker count would call every quantity objective unsatisfiable — as
      // the first version of this rule did, for two of them.
      if (targets.length > 1 && required > targets.length) {
        errors.push(
          `${quest.id}/${step.id}: needs ${required} distinct markers but ` +
            `only ${targets.length} are listed — unsatisfiable`
        );
      }
      for (const markerId of targets) {
        if (!groveLandmark(markerId)) {
          errors.push(
            `${quest.id}/${step.id}: target marker "${markerId}" has no landmark`
          );
        }
      }
      // A craft requirement on a non-craft step would never be consulted.
      if (step.craft && step.trigger !== "craft") {
        errors.push(
          `${quest.id}/${step.id}: has a craft requirement but trigger is ` +
            `"${step.trigger}" — it would never be checked`
        );
      }
      if (step.craft && (!step.craft.recipeId || !step.craft.outputItemId)) {
        errors.push(`${quest.id}/${step.id}: incomplete craft requirement`);
      }
      if (step.inventory) {
        if (!step.inventory.itemId) {
          errors.push(`${quest.id}/${step.id}: inventory requirement has no item`);
        }
        if (step.inventory.count < 1) {
          errors.push(
            `${quest.id}/${step.id}: inventory count ${step.inventory.count} < 1`
          );
        }
      }
    }
  }
  return errors;
}

/**
 * ECS RULE 6 — `markerId` is not the target list.
 *
 * Four objectives are multi-target. Anything deciding "did the player reach
 * the target" must use `groveStepTargetMarkerIds`, or those objectives
 * complete on the first of three moss patches.
 */
export function groveMultiTargetSteps(): Array<{
  questId: string;
  stepId: string;
  targets: readonly string[];
  required: number;
}> {
  const rows: Array<{
    questId: string;
    stepId: string;
    targets: readonly string[];
    required: number;
  }> = [];
  for (const quest of GROVE_QUEST_CATALOG) {
    for (const step of quest.steps) {
      const targets = groveStepTargetMarkerIds(step);
      if (targets.length > 1) {
        rows.push({
          questId: quest.id,
          stepId: step.id,
          targets,
          required: groveStepRequiredCount(step),
        });
      }
    }
  }
  return rows;
}
