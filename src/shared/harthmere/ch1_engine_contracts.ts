// CHAPTER_1_ENGINE_AUTHORITY_CONTRACTS
//
// Machine-checkable statements of how Chapter 1 is allowed to touch the
// engine. These exist because the repo has a documented history of exactly one
// class of bug: a Harthmere feature quietly projecting a competing copy over a
// native component, or a client system mutating state the server owns.
//
// Sources of truth this file encodes:
//   docs/harthmere/HARTHMERE_BIOMES_ECS_SOURCE_OF_TRUTH.md
//   docs/cutscenes.md ("Engine integration notes")
//   docs/harthmere/HARTHMERE_LIVE_CREATURE_ECS_RENDER.md
//
// ch1_engine_contracts.test.ts asserts every rule below over the authored
// Chapter 1 data.

import { CH1_FRACTURE_GATES } from "@/shared/harthmere/ch1_fracture_gates";
import { CH1_DUNGEONS } from "@/shared/harthmere/ch1_dungeons";
import { CH1_NEW_CAST } from "@/shared/harthmere/ch1_cast";
import { ch1AllScenes } from "@/shared/cutscene/ch1_scenes";
import {
  CH1_ELSEWHEN_SLOTS,
  isInsideCh1ElsewhenBand,
} from "@/shared/harthmere/ch1_elsewhen_region";
import { CH1_ANCHORS } from "@/shared/harthmere/ch1_ids";
import {
  CH1_STAGE_DIRECTIONS,
  ch1ValidateStaging,
  type Ch1StageDirection,
} from "@/shared/harthmere/ch1_staging";
import { ch1ValidateAmbientTriggers } from "@/shared/harthmere/ch1_fragment_triggers";
import { ch1ValidateCastIdentity } from "@/shared/harthmere/ch1_cast";
import { ch1ValidateDocuments } from "@/shared/harthmere/ch1_documents";

export const CH1_ENGINE_CONTRACTS_VERSION = 1 as const;

// ---------------------------------------------------------------------------
// Native ECS
// ---------------------------------------------------------------------------

/**
 * ECS RULE 1 — Biomes ECS is the sole gameplay authority.
 *
 * Everything Chapter 1 adds that is physical or authored has a native home:
 *   * NPCs (Lou, Vane, Rook, Sorrel, Iris, Teak, ...) are real ECS entities
 *     with reserved ids from the 10500 offset band. AUGUR-9 is the exception
 *     and deliberately so: it is the already-seeded snapshot Mucked Robot,
 *     claimed rather than duplicated (ch1_ids.ts, CH1_PROMOTED_ENTITY_IDS).
 *   * Chapter items are Bikkie items in the native Inventory, moved only by
 *     the signed HarthmereInventoryTransactionEvent.
 *   * Quest progress is native Challenges + trigger tree, not Redis.
 *   * Player position inside a dungeon is a native warp.
 *
 * What legitimately lives OUTSIDE native ECS (Harthmere-specific contracts
 * with no ECS model):
 *   * the fragment ledger (a Chapter 1 narrative record)
 *   * disposition tracks
 *   * AUGUR-9 core charge
 *   * the active dungeon run + its start timestamp
 */
export const CH1_NATIVE_ECS_OWNED = Object.freeze([
  "npc entities and transforms",
  "inventory, hotbar, equipment, wallet",
  "health, stamina, death, respawn",
  "authored quest challenges and steps",
  "player position and warps",
  "placeables and containers",
] as const);

export const CH1_NON_ECS_OWNED = Object.freeze([
  "ch1 fragment ledger",
  "ch1 disposition tracks",
  "augur9 core charge",
  "ch1 active dungeon run",
] as const);

/**
 * ECS RULE 2 — a Fracture Gate is NOT an entity.
 *
 * Gates are authored data projected by the client renderer. They have no
 * Health, no NpcMetadata, no inventory; they cannot be attacked, iced, looted,
 * or persisted. Making a gate an entity would put a hittable, killable,
 * server-synchronized object in the world whose destruction would strand a
 * player inside an unreachable region.
 */
export const CH1_GATES_ARE_NOT_ENTITIES = true as const;

export function ch1ValidateGatesAreNotEntities(): string[] {
  const errors: string[] = [];
  for (const gate of CH1_FRACTURE_GATES) {
    const anyGate = gate as unknown as Record<string, unknown>;
    for (const forbidden of ["entityId", "health", "npcMetadata", "inventory"]) {
      if (anyGate[forbidden] !== undefined) {
        errors.push(
          `${gate.id}: gates must not carry "${forbidden}" — a gate is ` +
            `authored data, not an ECS entity`
        );
      }
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Anima
// ---------------------------------------------------------------------------

/**
 * ANIMA RULE 1 — Chapter 1 cinematics are clientPuppet.
 *
 * clientPuppet scenes never touch server authority: the ECS entity does not
 * move, so no NPC brain is interrupted, no return-home anchor is disturbed,
 * and no cinematicPauseUntil lease is taken. serverShared mode moves real NPCs
 * for everyone and is reserved for admin/party cinematic tooling; no Chapter 1
 * scene may request it, and inline client definitions cannot request it at all.
 */
export function ch1ValidateCutsceneAnimaSafety(): string[] {
  const errors: string[] = [];
  for (const scene of ch1AllScenes()) {
    if (scene.settings.mode !== "clientPuppet") {
      errors.push(
        `${scene.id}: mode is "${scene.settings.mode}" — Chapter 1 scenes must ` +
          `be clientPuppet so Anima brains and spawn anchors are untouched`
      );
    }
    // clientPuppet end placements must never publish ECS movement.
    for (const placement of scene.onEnd.placements) {
      errors.push(
        `${scene.id}: onEnd placement for role "${placement.role}" would ` +
          `publish an ECS move from a clientPuppet scene`
      );
    }
  }
  return errors;
}

/**
 * ANIMA RULE 2 — flashback actors are ghosts, present-day actors are entities.
 *
 * Ghosts are client-only renderer meshes with negative ids: no ECS entity, no
 * HP, never attackable, never persisted, invisible to Anima. That makes them
 * correct for memories and WRONG for present-day NPCs, where binding a ghost
 * would lose the seeded appearance, Bikkie equipment, and Anima identity.
 */
export function ch1ValidateGhostUsage(): string[] {
  const errors: string[] = [];
  // Scenes that depict memory. Ghosts are expected here.
  const memoryScenes = new Set([
    "ch1-overlay-ive-got-you",
    "ch1-recon-arrival",
    "ch1-recon-corridor",
    "ch1-recon-corridor-revised",
    "ch1-recon-intake",
  ]);
  for (const scene of ch1AllScenes()) {
    for (const role of scene.cast) {
      if (role.binding.kind === "ghost" && !memoryScenes.has(scene.id)) {
        errors.push(
          `${scene.id}/${role.role}: ghost binding in a present-day scene — ` +
            `bind the seeded ECS entity instead (docs/cutscenes.md, "Native ` +
            `NPC action-shot rules")`
        );
      }
    }
  }
  return errors;
}

/**
 * ANIMA RULE 3 — non-combatants are never in an encounter.
 *
 * Several Chapter 1 characters must never appear in a fight: Lou (never raises
 * his voice, is never in an encounter), Rook (does not need to be fought),
 * Iris, Sorrel, Marrow (unkillable, non-negotiable).
 */
export function ch1ValidateNonCombatants(): string[] {
  const errors: string[] = [];
  const nonCombatantNames = new Set(
    CH1_NEW_CAST.filter((c) => !c.combatant).map((c) => c.displayName)
  );
  for (const dungeon of CH1_DUNGEONS) {
    for (const zone of dungeon.zones) {
      for (const encounter of zone.encounters) {
        for (const name of nonCombatantNames) {
          const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
          if (encounter.toLowerCase().includes(slug)) {
            errors.push(
              `${dungeon.id}/${zone.id}: encounter "${encounter}" involves ` +
                `non-combatant "${name}"`
            );
          }
        }
      }
    }
  }
  return errors;
}

/**
 * ANIMA RULE 4 — story staging is a projection, never a move.
 *
 * ch1_staging.ts answers "where should this character be in YOUR story". It
 * must never become an ECS write: Chapter 1 state is per-player and the NPC set
 * is shared, so relocating Rook's entity when one player finishes Act 3 would
 * move him for everyone and would take position authority away from Anima's
 * brain and return-home anchor.
 *
 * The checks below are the machine-readable form of that:
 *   * every character resolves to something in every story state (validated in
 *     ch1_staging.ts itself);
 *   * a staged puppet position is a Grove-side anchor, never inside the
 *     Elsewhen band — a puppet there would be visible to a player who has no
 *     admission and is standing in the ordinary world;
 *   * characters who live inside authored dungeon terrain stay on their seeded
 *     body, because that terrain IS their correct position.
 */
export function ch1ValidateStagingAnimaSafety(): string[] {
  const errors: string[] = [];
  for (const [key, directions] of Object.entries(CH1_STAGE_DIRECTIONS) as Array<
    [string, readonly Ch1StageDirection[]]
  >) {
    for (const direction of directions) {
      if (direction.place.kind !== "anchor") continue;
      const position = CH1_ANCHORS[direction.place.anchor];
      if (isInsideCh1ElsewhenBand(position)) {
        errors.push(
          `${key}: staged at "${direction.place.anchor}", which is inside the ` +
            `Elsewhen band — a puppet there is visible without admission`
        );
      }
      const anyDirection = direction as unknown as Record<string, unknown>;
      for (const forbidden of ["publish", "ecsMove", "entityUpdate"]) {
        if (anyDirection[forbidden] !== undefined) {
          errors.push(
            `${key}: stage direction carries "${forbidden}" — staging is a ` +
              `projection and must never publish an ECS move`
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
 * GAIA RULE 1 — Chapter 1 does not simulate terrain.
 *
 * Nothing in the chapter edits voxels, triggers growth/decay, or advances the
 * world clock. Cutscene `timeOfDay` is a client sky override that is restored
 * afterwards and will not overwrite a newer user or night-vision change. The
 * gate renderer draws an emissive mesh and a ground decal and edits nothing.
 */
export const CH1_GAIA_UNTOUCHED = true as const;

/**
 * GAIA RULE 2 — the Elsewhen void gap must stay empty.
 *
 * The dungeon band's unreachability depends on there being no terrain shard
 * between Harthmere's east edge and the first Elsewhen shard. If the seeder
 * ever generates into the gap, the band stops being warp-only and both
 * dungeons stop being dungeons.
 */
export function ch1ValidateElsewhenIsolation(): string[] {
  const errors: string[] = [];
  for (const slot of CH1_ELSEWHEN_SLOTS) {
    if (!isInsideCh1ElsewhenBand(slot.arrival)) {
      errors.push(`${slot.dungeonId}: arrival is not inside the Elsewhen band`);
    }
    if (!isInsideCh1ElsewhenBand(slot.departure)) {
      errors.push(`${slot.dungeonId}: departure is not inside the Elsewhen band`);
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Server authority
// ---------------------------------------------------------------------------

/**
 * AUTHORITY RULE — three things are server-authoritative and never
 * client-trusted, given this codebase's live-mode write/read history:
 *   1. fragment truth values (never sent to the client at all)
 *   2. dungeon provisioning checks and no-resupply enforcement
 *   3. the chapter ending and all carry-forward flags
 *
 * Additionally, every cutscene commit hook must be idempotent and retryable:
 * /sync reconnects can cancel in-flight publishes and live-mode writes are
 * slow. Visual-first, commit-after, never block a shot on a server ack.
 */
export const CH1_SERVER_AUTHORITATIVE = Object.freeze([
  "fragment truth",
  "dungeon provisioning",
  "no-resupply enforcement",
  "chapter ending and carry-forward flags",
  "Elsewhen band admission",
] as const);

export const CH1_COMMIT_HOOKS = Object.freeze([
  "ch1.begin",
  "ch1.unlockLedger",
  "ch1.recoverFragment",
  "ch1.reviseLedgerEntry",
  "ch1.renameCard",
  "ch1.applyConsolidation",
] as const);

export type Ch1CommitHook = (typeof CH1_COMMIT_HOOKS)[number];

export function ch1ValidateCommitHooks(): string[] {
  const errors: string[] = [];
  const known = new Set<string>(CH1_COMMIT_HOOKS);
  for (const scene of ch1AllScenes()) {
    for (const commit of scene.onEnd.commits) {
      if (!known.has(commit.hook)) {
        errors.push(
          `${scene.id}: unregistered commit hook "${commit.hook}" — add it to ` +
            `CH1_COMMIT_HOOKS and register an idempotent handler`
        );
      }
    }
    for (const shot of scene.shots) {
      for (const action of shot.actions) {
        if (action.kind === "custom" && !known.has(action.hook)) {
          errors.push(
            `${scene.id}/${shot.id}: unregistered custom hook "${action.hook}"`
          );
        }
      }
    }
  }
  return errors;
}

export function ch1ValidateEngineContracts(): string[] {
  return [
    ...ch1ValidateGatesAreNotEntities(),
    ...ch1ValidateCutsceneAnimaSafety(),
    ...ch1ValidateGhostUsage(),
    ...ch1ValidateNonCombatants(),
    ...ch1ValidateElsewhenIsolation(),
    ...ch1ValidateCommitHooks(),
    ...ch1ValidateStagingAnimaSafety(),
    ...ch1ValidateStaging(),
    ...ch1ValidateAmbientTriggers(),
    ...ch1ValidateCastIdentity(),
    ...ch1ValidateDocuments(),
  ];
}
