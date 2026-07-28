// CHAPTER_1_PARTY  (MMO multiplayer contract)
//
// Biomes is an MMO. Chapter 1's story is intensely personal — one amnesiac,
// one Card, one betrayal — and two players in the same Grove cannot both be
// "the exiled scientist" without the fiction collapsing. This module is the
// answer to the open question left in journal §13.3 #2.
//
// THE MODEL: "your story, their world."
//
//   * STORY STATE IS PER-PLAYER. Flags, ledger, tracks, endings — every
//     player runs their own Chapter 1 at their own pace, exactly like the
//     existing per-player Bikkie challenge state for Grove/Bible quests. Two
//     players never share a fragment ledger.
//   * THE WORLD IS SHARED. Gates are visible to everyone whose own story has
//     opened them (the client projects per-player, see ch1_fracture_gate.ts;
//     no ECS entity exists to disagree about). NPCs are the same seeded ECS
//     entities for everyone; dialogue content keys off the TALKING player's
//     flags, the same way authored quest givers already do.
//   * NARRATIVE SINGULARITY IS DIEGETIC. Every player is "the" Custodian in
//     their own telling. This is the same convention every quest MMO uses and
//     the same one the existing 85-quest bible catalog already relies on —
//     every player is also "the" bell-binder. We do not fight it; RuneScape
//     never did either.
//   * DUNGEONS ARE PARTY-INSTANCED. A run belongs to a party of 1-4. The
//     Elsewhen slot is one authored terrain, but a run is a logical instance:
//     admission is per-run, loot/retrievals are per-run, and two parties are
//     never admitted to the same slot at the same time (the terrain has one
//     Iris, one Sorrel, one boss).
//
// CUTSCENES in party play stay clientPuppet: each member sees the scene on
// their own client, and members who have already seen a story beat get a
// short "recap" skip affordance instead of a forced rewatch. Nothing here
// moves an ECS NPC, so Anima is untouched (ch1_engine_contracts.ts).

import {
  ch1CheckProvisioning,
  ch1Gate,
} from "@/shared/harthmere/ch1_fracture_gates";
import {
  ch1Dungeon,
  ch1DungeonRunComplete,
} from "@/shared/harthmere/ch1_dungeons";
import { ch1ElsewhenSlot } from "@/shared/harthmere/ch1_elsewhen_region";
import { CH1_FLAGS } from "@/shared/harthmere/ch1_ids";

export const CH1_PARTY_VERSION = 1 as const;

export const CH1_PARTY_MIN_SIZE = 1;
export const CH1_PARTY_MAX_SIZE = 4;
export const CH1_SOLO_OR_WIPE_RECOVERY_MS = 2_000;
export const CH1_PARTY_SELF_RECOVERY_MS = 30_000;

export function ch1DownedRecoveryDelayMs(input: {
  memberCount: number;
  allPresentMembersDown: boolean;
}) {
  return input.memberCount <= 1 || input.allPresentMembersDown
    ? CH1_SOLO_OR_WIPE_RECOVERY_MS
    : CH1_PARTY_SELF_RECOVERY_MS;
}

export interface Ch1PartyMember {
  playerId: string;
  /** The member's OWN story flags. Never shared. */
  flags: readonly string[];
  /** The member's own carried provisions. */
  carried: Readonly<Record<string, number>>;
}

export interface Ch1PartyRun {
  runId: string;
  dungeonId: string;
  leaderId: string;
  memberIds: readonly string[];
  startedMs: number;
  /** Members who have died and are waiting at the arrival anchor. */
  downedIds: readonly string[];
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

export type Ch1PartyEntryResult =
  | { ok: true; run: Ch1PartyRun }
  | {
      ok: false;
      reason: string;
      /** Which members blocked entry, and why. All of them, not the first. */
      blockers: Array<{ playerId: string; problem: string }>;
    };

/**
 * Party entry rules — every one exists to close a real multiplayer exploit or
 * soft-lock:
 *
 *  1. EVERY member's own story must have the gate open. Otherwise a level-1
 *     friend gets carried into Act 5 content, sees Sorrel, and has the twist
 *     spoiled for their own run. (Same rule the bible quests use for hidden
 *     content.)
 *  2. EVERY member must pass provisioning individually. Pooled provisioning
 *     would let three empty-handed players ride one mule, and the dungeon's
 *     attrition design assumes per-person supplies.
 *  3. Nobody may already be in a run.
 *  4. The slot must be free: the authored terrain has one Iris and one boss.
 *     A second party waits at the mouth (or the server spins a queue).
 */
export function ch1PartyEnterGate(args: {
  gateId: string;
  members: readonly Ch1PartyMember[];
  leaderId: string;
  activeRunsByPlayer: Readonly<Record<string, string | undefined>>;
  slotOccupiedByRunId?: string;
  nowMs: number;
  runId: string;
}): Ch1PartyEntryResult {
  const gate = ch1Gate(args.gateId);
  if (!gate?.dungeonId || !gate.enterable) {
    return {
      ok: false,
      reason: "this gate cannot be entered",
      blockers: [],
    };
  }
  if (
    args.members.length < CH1_PARTY_MIN_SIZE ||
    args.members.length > CH1_PARTY_MAX_SIZE
  ) {
    return {
      ok: false,
      reason: `party size ${args.members.length} is outside 1..4`,
      blockers: [],
    };
  }
  if (!args.members.some((m) => m.playerId === args.leaderId)) {
    return { ok: false, reason: "leader is not in the party", blockers: [] };
  }
  const dungeon = ch1Dungeon(gate.dungeonId);
  if (!dungeon) {
    return { ok: false, reason: "gate has no dungeon", blockers: [] };
  }
  if (!dungeon.partySizes.includes(args.members.length)) {
    return {
      ok: false,
      reason: `${dungeon.id} is not authored for a party of ${args.members.length}`,
      blockers: [],
    };
  }
  if (args.slotOccupiedByRunId) {
    return {
      ok: false,
      reason:
        "another party is inside; the aperture will not open onto an occupied past",
      blockers: [],
    };
  }

  const blockers: Array<{ playerId: string; problem: string }> = [];
  for (const member of args.members) {
    const flags = new Set(member.flags);
    if (gate.requiresFlag && !flags.has(gate.requiresFlag)) {
      blockers.push({
        playerId: member.playerId,
        problem:
          "this gate is not open in their story yet; carrying them through " +
          "would spoil their own chapter",
      });
    }
    const provisioning = ch1CheckProvisioning(args.gateId, member.carried);
    if (!provisioning.ok) {
      blockers.push({
        playerId: member.playerId,
        problem: `under-provisioned: missing ${provisioning.missing
          .map((m) => m.label)
          .join(", ")}`,
      });
    }
    if (args.activeRunsByPlayer[member.playerId]) {
      blockers.push({
        playerId: member.playerId,
        problem: "already inside a gate",
      });
    }
  }
  if (blockers.length > 0) {
    return { ok: false, reason: "party members blocked entry", blockers };
  }

  return {
    ok: true,
    run: {
      runId: args.runId,
      dungeonId: gate.dungeonId,
      leaderId: args.leaderId,
      memberIds: args.members.map((m) => m.playerId),
      startedMs: args.nowMs,
      downedIds: [],
    },
  };
}

// ---------------------------------------------------------------------------
// Inside the run
// ---------------------------------------------------------------------------

/**
 * Death inside a one-way dungeon cannot be a respawn-in-the-Grove, or the
 * death IS an exit and the one-way rule dies with it. A downed member wakes at
 * the run's arrival anchor, keeps their inventory, and walks back. Solo, that
 * walk of shame is the death penalty. In a party, being revived where you fell
 * is the reason to bring friends.
 */
export function ch1PartyMemberDowned(
  run: Ch1PartyRun,
  playerId: string
): Ch1PartyRun {
  if (!run.memberIds.includes(playerId)) {
    throw new Error(`${playerId} is not in run ${run.runId}`);
  }
  if (run.downedIds.includes(playerId)) {
    return run;
  }
  return { ...run, downedIds: [...run.downedIds, playerId] };
}

export function ch1PartyMemberRevived(
  run: Ch1PartyRun,
  playerId: string
): Ch1PartyRun {
  return { ...run, downedIds: run.downedIds.filter((id) => id !== playerId) };
}

/** A full party wipe resets everyone to the arrival anchor. Not an exit. */
export function ch1PartyWiped(run: Ch1PartyRun): boolean {
  return run.downedIds.length === run.memberIds.length;
}

export type Ch1PartyLeaveResult =
  | { kind: "run_continues"; run: Ch1PartyRun; newLeaderId: string }
  | { kind: "run_ends"; evictedIds: readonly string[] };

/**
 * Disconnect / leave. The run survives as long as anyone remains; leadership
 * transfers. The LAST member leaving ends the run, and the server evicts any
 * lingering bodies to the Grove-side gate mouth — nobody gets to log out
 * inside the past and squat the slot forever. A disconnected player who
 * reconnects while the run lives rejoins at the arrival anchor.
 */
export function ch1PartyMemberLeaves(
  run: Ch1PartyRun,
  playerId: string
): Ch1PartyLeaveResult {
  const remaining = run.memberIds.filter((id) => id !== playerId);
  if (remaining.length === 0) {
    return { kind: "run_ends", evictedIds: [playerId] };
  }
  return {
    kind: "run_continues",
    newLeaderId: run.leaderId === playerId ? remaining[0] : run.leaderId,
    run: {
      ...run,
      memberIds: remaining,
      leaderId: run.leaderId === playerId ? remaining[0] : run.leaderId,
      downedIds: run.downedIds.filter((id) => id !== playerId),
    },
  };
}

// ---------------------------------------------------------------------------
// Exit and story credit
// ---------------------------------------------------------------------------

export interface Ch1PartyExitOutcome {
  ok: boolean;
  reason?: string;
  /**
   * Per-member story consequences. Retrieval flags are PARTY-WIDE (Iris is
   * carried out once, by somebody); act/oath/knowledge flags are only granted
   * to members whose own story is at the right point to receive them.
   */
  memberFlags: Readonly<Record<string, readonly string[]>>;
}

/** Flags every member of a successful run receives, story-position permitting. */
const PARTY_SHARED_COMPLETION_FLAGS: Readonly<
  Record<string, readonly string[]>
> = {
  ch1_dungeon_desert: [
    CH1_FLAGS.irisRescued,
    CH1_FLAGS.hasFirstGrain,
    CH1_FLAGS.believesJackieHostile,
  ],
  ch1_dungeon_winter: [
    CH1_FLAGS.knowsDesignation,
    CH1_FLAGS.hasLedger,
    CH1_FLAGS.sorrelOathGiven,
  ],
};

export function ch1PartyExitGate(args: {
  run: Ch1PartyRun;
  members: readonly Ch1PartyMember[];
  carriedOut: readonly string[];
}): Ch1PartyExitOutcome {
  const dungeon = ch1Dungeon(args.run.dungeonId);
  if (!dungeon) {
    return { ok: false, reason: "unknown dungeon", memberFlags: {} };
  }
  if (!ch1DungeonRunComplete(args.run.dungeonId, args.carriedOut)) {
    return {
      ok: false,
      reason: "required retrievals are still inside",
      memberFlags: {},
    };
  }

  const gate = ch1Gate(dungeon.gateId);
  const memberFlags: Record<string, readonly string[]> = {};
  for (const member of args.members) {
    if (!args.run.memberIds.includes(member.playerId)) {
      continue;
    }
    const flags = new Set(member.flags);
    // Story credit only lands on players whose own chapter has the gate open.
    // A member who somehow slipped in ahead of their story (admin warp, a
    // future matchmaking bug) gets NOTHING — their own run must earn it.
    const eligible = !gate?.requiresFlag || flags.has(gate.requiresFlag);
    memberFlags[member.playerId] = eligible
      ? PARTY_SHARED_COMPLETION_FLAGS[dungeon.id] ?? []
      : [];
  }
  return { ok: true, memberFlags };
}

// ---------------------------------------------------------------------------
// Story-critical singletons
// ---------------------------------------------------------------------------

/**
 * Beats that must be experienced ALONE even in a party run. The rest of the
 * party holds position (the client shows them a "the aperture shivers" wait
 * state) while one member is in the scene. Sorrel's bar-slot conversation is
 * the load-bearing one: she works out that the player does not remember her,
 * and that discovery cannot happen to four people at once.
 */
export const CH1_SOLO_BEATS: readonly string[] = Object.freeze([
  "ch1-sorrel-door",
  "ch1-recon-corridor",
  "ch1-consolidation-revision",
  "ch1-recon-intake",
  "ch1-the-watch-house",
]);

export function ch1BeatIsSolo(cutsceneId: string): boolean {
  return CH1_SOLO_BEATS.includes(cutsceneId);
}
