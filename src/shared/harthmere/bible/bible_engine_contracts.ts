// BIBLE_ENGINE_AUTHORITY_CONTRACTS
//
// Machine-checkable statements of how Bible quests are allowed to touch the
// engine, in the style of `ch1_engine_contracts.ts`.
//
// These exist because this repo has a documented history of exactly one class
// of bug: a Harthmere feature quietly projecting a competing copy over a
// native component, or a client system mutating state the server owns. The
// Bible catalog was the largest remaining instance — a full Redis state
// machine with ECS as a mirror.
//
// Sources of truth encoded here:
//   docs/harthmere/BIBLE_TO_CH1_MIGRATION.md
//   docs/harthmere/HARTHMERE_BIOMES_ECS_SOURCE_OF_TRUTH.md
//   docs/harthmere/HARTHMERE_LIVE_CREATURE_ECS_RENDER.md
//   docs/harthmere/TESTING_FASTER.md (section 4.12 — the Y=0 strand)
//
// `bible_engine_contracts.test.ts` asserts every rule below over the authored
// catalog.

import { BIBLE_QUEST_CATALOG } from "@/shared/harthmere/bible/bible_quest_catalog";
import {
  bibleNativeQuestId,
  bibleNativeStepId,
} from "@/shared/harthmere/bible/bible_quest_ids";
import { bibleQuestWorldWaypoints } from "@/shared/harthmere/bible/bible_waypoints";
import {
  bibleQuestGiverId,
  type BibleQuestDef,
} from "@/shared/harthmere/bible/bible_quest_schema";

export const BIBLE_ENGINE_CONTRACTS_VERSION = 1 as const;

// ---------------------------------------------------------------------------
// Native ECS
// ---------------------------------------------------------------------------

/**
 * ECS RULE 1 — Biomes ECS is the sole gameplay authority for Bible quests.
 *
 * Progress is native `Challenges` + `TriggerState`, advanced by the trigger
 * engine from signed `harthmereQuestProgress` evidence. There is exactly one
 * writer. The direct `Challenges`/`TriggerState` write in
 * `native_ecs_drop_materialization.ts` is the second writer this migration
 * removes.
 */
export const BIBLE_NATIVE_ECS_OWNED = Object.freeze([
  "quest availability, progress, and completion",
  "objective step completion",
  "xp, level, and derived stats",
  "item and silver reward grants",
  "quest giver entities and transforms",
  "player position and warps",
] as const);

/**
 * ECS RULE 2 — the residual slice is closed.
 *
 * Anything not on this list belongs in ECS. The list is short on purpose: each
 * entry names something with no ECS component, not something that was
 * inconvenient to move.
 */
export const BIBLE_NON_ECS_OWNED = Object.freeze([
  "faction reputation",
  "daily/weekly cadence stamps",
  "branch choices",
  "story flags from rewards.unlocks",
  "titles",
  "thaedryn boss phase",
] as const);

/**
 * ECS RULE 3 — every authored step is reachable by the signed progress path.
 *
 * `harthmere_quest_progress.ts` rejects any step id not present in the
 * biscuit's trigger tree. A step the projection cannot produce an id for is
 * therefore permanently uncompletable, which is a soft-lock rather than a
 * visible error.
 */
export function bibleValidateEveryStepIsAddressable(): string[] {
  const errors: string[] = [];
  for (const quest of BIBLE_QUEST_CATALOG) {
    if (bibleNativeQuestId(quest.id) === undefined) {
      errors.push(`${quest.id}: no native challenge id`);
    }
    if (quest.steps.length === 0) {
      errors.push(`${quest.id}: no objectives — cannot ever be completed`);
    }
    for (const [index, step] of quest.steps.entries()) {
      if (bibleNativeStepId(quest.id, index) === undefined) {
        errors.push(`${quest.id}/${step.id}: no native step id`);
      }
      if (!step.validation.serverAuthority) {
        errors.push(
          `${quest.id}/${step.id}: client-trusted objective — every Bible ` +
            `step must be server-authoritative`
        );
      }
      if (!step.validation.idempotent) {
        errors.push(
          `${quest.id}/${step.id}: non-idempotent objective — /sync reconnects ` +
            `cancel in-flight publishes, so every step must tolerate a retry`
        );
      }
    }
  }
  return errors;
}

/**
 * ECS RULE 4 — no quest may author a failure transition while `failed` is
 * unmodelled.
 *
 * The retired runtime had `failHarthmereQuest` and a `fail` dialogue state,
 * but no authored quest could reach it: nothing sets `expiresWhen`, and the
 * authored `failureCases` are rejected submissions, not quest failures. The
 * state is dropped. This check makes that a decision rather than a silent
 * omission — if a quest ever authors real failure, this fails and the gate
 * gains one reason.
 */
export function bibleValidateNoUnmodelledFailure(): string[] {
  const errors: string[] = [];
  const rejectionOnly = new Set([
    "player_too_far",
    "wrong_phase",
    "duplicate_submission",
  ]);
  for (const quest of BIBLE_QUEST_CATALOG) {
    for (const step of quest.steps) {
      for (const failure of step.failureCases) {
        if (!rejectionOnly.has(failure)) {
          errors.push(
            `${quest.id}/${step.id}: failure case "${failure}" is a real quest ` +
              `failure, but the failed state is not modelled — see migration ` +
              `doc section 9.3`
          );
        }
      }
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Gaia
// ---------------------------------------------------------------------------

/**
 * GAIA RULE 1 — Bible quests do not simulate terrain.
 *
 * No quest edits voxels, triggers growth or decay, or advances the world
 * clock. The 9 time-gated and 2 weather-gated quests READ the world clock for
 * activation; they never drive it. A quest that wrote the clock would change
 * time for every player on the shard.
 */
export const BIBLE_GAIA_UNTOUCHED = true as const;

/**
 * GAIA RULE 2 — every shipped waypoint is grounded.
 *
 * 312 of 340 authored waypoints carry Y=0, which is an authoring convention
 * meaning "on the ground", not a height. TESTING_FASTER section 4.12 records
 * the consequence of shipping one: the player is stranded below terrain and
 * the row burns a three-minute movement timeout.
 *
 * This is the highest-value assertion in the suite. It runs in about a second
 * and covers a failure that costs three minutes per affected row in a browser.
 */
export function bibleValidateWaypointsAreGrounded(): string[] {
  const errors: string[] = [];
  for (const quest of BIBLE_QUEST_CATALOG) {
    for (const [index, position] of bibleQuestWorldWaypoints(quest).entries()) {
      const label = index === 0 ? "quest marker" : quest.steps[index - 1].id;
      if (position[1] === 0) {
        errors.push(
          `${quest.id}/${label}: resolved waypoint has Y=0 — this strands the ` +
            `player below terrain (TESTING_FASTER section 4.12)`
        );
      }
      if (!Number.isFinite(position[0] + position[1] + position[2])) {
        errors.push(`${quest.id}/${label}: non-finite resolved waypoint`);
      }
    }
  }
  return errors;
}

/**
 * GAIA RULE 3 — authored Y is never read outside the resolver.
 *
 * Enforced structurally: `authoredWaypoint` is only consumed by
 * `bible_waypoints.ts`. The companion test reads the import graph rather than
 * trusting this comment.
 */
export const BIBLE_AUTHORED_WAYPOINT_READERS = Object.freeze([
  "src/shared/harthmere/bible/bible_waypoints.ts",
] as const);

// ---------------------------------------------------------------------------
// Anima
// ---------------------------------------------------------------------------

/**
 * ANIMA RULE 1 — givers resolve by id, never by display name.
 *
 * The retired client adapter matched a rendered NPC's label against a
 * lowercased compendium name, so a label gaining a role or district suffix
 * silently orphaned its giver. The same class of bug already cost 13 of 21
 * givers once, via the hand-written `HARTHMERE_QUEST_DIALOGUE_LINKS`.
 */
export function bibleValidateGiversResolve(
  resolveGiver: (giverId: string) => unknown
): string[] {
  const errors: string[] = [];
  for (const quest of BIBLE_QUEST_CATALOG) {
    const giverId = bibleQuestGiverId(quest);
    if (!giverId) continue;
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
 * ANIMA RULE 2 — quest givers are never combat targets.
 *
 * A `combat` step naming an NPC that any quest lists as a giver would let a
 * player delete a quest giver for everyone on a shared shard.
 */
export function bibleValidateGiversAreNotCombatTargets(): string[] {
  const errors: string[] = [];
  const giverIds = new Set(
    BIBLE_QUEST_CATALOG.map(bibleQuestGiverId).filter(
      (id): id is string => id !== undefined
    )
  );
  for (const quest of BIBLE_QUEST_CATALOG) {
    for (const step of quest.steps) {
      if (step.type === "combat" && giverIds.has(step.targetId)) {
        errors.push(
          `${quest.id}/${step.id}: combat objective targets quest giver ` +
            `"${step.targetId}"`
        );
      }
    }
  }
  return errors;
}

/**
 * ANIMA RULE 3 — quest state never moves an NPC.
 *
 * Bible progress is per-player; the NPC set is shared. Relocating a giver when
 * one player advances would move them for everyone and take position authority
 * away from Anima's brain and return-home anchor. Mirrors Chapter 1's staging
 * rule.
 */
export function bibleValidateNoEcsMovesAuthored(): string[] {
  const errors: string[] = [];
  const forbidden = ["publish", "ecsMove", "entityUpdate", "teleport"];
  for (const quest of BIBLE_QUEST_CATALOG) {
    const rows: Array<[string, Record<string, unknown>]> = [
      [quest.id, quest as unknown as Record<string, unknown>],
      ...quest.steps.map(
        (step) =>
          [`${quest.id}/${step.id}`, step as unknown as Record<string, unknown>] as [
            string,
            Record<string, unknown>
          ]
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

/**
 * ANIMA RULE 4 — exactly one Bible combat entity is a boss.
 *
 * Thaedryn is the only quest-gated encounter entity, at one canonical anchor.
 * Any second boss would need its own per-player phase state and its own
 * reachability guarantee.
 */
export const BIBLE_BOSS_ENTITY_COUNT = 1 as const;

// ---------------------------------------------------------------------------
// Aggregate
// ---------------------------------------------------------------------------

export function bibleValidateEngineContracts(options?: {
  resolveGiver?: (giverId: string) => unknown;
}): string[] {
  return [
    ...bibleValidateEveryStepIsAddressable(),
    ...bibleValidateNoUnmodelledFailure(),
    ...bibleValidateWaypointsAreGrounded(),
    ...bibleValidateGiversAreNotCombatTargets(),
    ...bibleValidateNoEcsMovesAuthored(),
    ...(options?.resolveGiver
      ? bibleValidateGiversResolve(options.resolveGiver)
      : []),
  ];
}

export function bibleQuestsMissingSteps(): BibleQuestDef[] {
  return BIBLE_QUEST_CATALOG.filter((quest) => quest.steps.length === 0);
}
