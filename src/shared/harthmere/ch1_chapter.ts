// CHAPTER_1_PROGRESSION
//
// Assembles the Chapter 1 modules into one progression contract: act gating,
// the dungeon run lifecycle, the ending branches, and the engine-authority
// rules every Chapter 1 system has to obey.
//
// See docs/harthmere/CHAPTER_1_IDENTITY_WRITERS_JOURNAL.md.

import {
  CHAPTER_1_ID,
  CHAPTER_1_VERSION,
  CH1_ENDINGS,
  CH1_ENDING_FLAG,
  CH1_FLAGS,
  CH1_TRACK_DEFAULTS,
  type Ch1Ending,
} from "@/shared/harthmere/ch1_ids";
import {
  ch1EmptyLedger,
  ch1FragmentDeliveryEnabled,
  type Ch1LedgerState,
} from "@/shared/harthmere/ch1_fragment_ledger";
import {
  ch1EmptyLatentSkills,
  type Ch1LatentSkillState,
} from "@/shared/harthmere/ch1_latent_skills";
import {
  ch1CheckProvisioning,
  ch1Gate,
  type Ch1ProvisioningResult,
} from "@/shared/harthmere/ch1_fracture_gates";
import {
  ch1Dungeon,
  ch1DungeonRunComplete,
} from "@/shared/harthmere/ch1_dungeons";
import { ch1ElsewhenSlot } from "@/shared/harthmere/ch1_elsewhen_region";
import {
  ch1ActCloseQuest,
  ch1QuestsForAct,
} from "@/shared/harthmere/ch1_quests";

export const CH1_CHAPTER_VERSION = CHAPTER_1_VERSION;
export const CH1_CHAPTER_ID = CHAPTER_1_ID;
export const CH1_ACT_COUNT = 6;

// ---------------------------------------------------------------------------
// Act gating
// ---------------------------------------------------------------------------

const ACT_ENTRY_FLAG: Readonly<Record<number, string | undefined>> = {
  1: CH1_FLAGS.started,
  2: CH1_FLAGS.act1Complete,
  3: CH1_FLAGS.act2Complete,
  4: CH1_FLAGS.act3Complete,
  5: CH1_FLAGS.act4Complete,
  6: CH1_FLAGS.act5Complete,
};

export function ch1CurrentAct(
  flags: ReadonlySet<string> | readonly string[]
): number {
  const set = flags instanceof Set ? flags : new Set(flags);
  if (!set.has(CH1_FLAGS.started)) {
    return 0;
  }
  for (let act = CH1_ACT_COUNT; act >= 1; act--) {
    const entry = ACT_ENTRY_FLAG[act];
    if (entry && set.has(entry)) {
      return act;
    }
  }
  return 1;
}

export function ch1ActUnlocked(
  act: number,
  flags: ReadonlySet<string> | readonly string[]
): boolean {
  const entry = ACT_ENTRY_FLAG[act];
  if (!entry) {
    return false;
  }
  const set = flags instanceof Set ? flags : new Set(flags);
  return set.has(entry);
}

export function ch1AvailableQuestIds(
  flags: ReadonlySet<string> | readonly string[]
): readonly string[] {
  const set = flags instanceof Set ? flags : new Set(flags);
  const act = ch1CurrentAct(set);
  if (act === 0) {
    return [];
  }
  return ch1QuestsForAct(act)
    .filter((q) => (q.requiresFlags ?? []).every((f) => set.has(f)))
    .map((q) => q.id);
}

/** Sanity: every act must have exactly one quest that closes it. */
export function ch1ValidateActStructure(): string[] {
  const errors: string[] = [];
  for (let act = 1; act <= CH1_ACT_COUNT; act++) {
    const quests = ch1QuestsForAct(act);
    if (quests.length === 0) {
      errors.push(`act ${act}: has no quests`);
    }
    const closers = quests.filter((q) => q.actClose);
    if (closers.length !== 1) {
      errors.push(
        `act ${act}: expected exactly one actClose quest, found ${closers.length}`
      );
    }
    const closer = ch1ActCloseQuest(act);
    const expected = ACT_ENTRY_FLAG[act + 1];
    if (closer && expected && !(closer.setsFlags ?? []).includes(expected)) {
      errors.push(
        `act ${act}: closing quest "${closer.id}" does not set "${expected}", ` +
          `so act ${act + 1} can never unlock`
      );
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Player chapter state
// ---------------------------------------------------------------------------

export interface Ch1PlayerState {
  flags: string[];
  tracks: Record<string, number>;
  ledger: Ch1LedgerState;
  latentSkills: Ch1LatentSkillState;
  testimonies: string[];
  /** The dungeon the player is currently inside, if any. */
  activeDungeonRunId?: string;
  /** Wall-clock ms the current run started. Drives the time-dilation reveal. */
  activeRunStartedMs?: number;
  ending?: Ch1Ending;
}

export function ch1InitialPlayerState(): Ch1PlayerState {
  return {
    flags: [],
    tracks: { ...CH1_TRACK_DEFAULTS },
    ledger: ch1EmptyLedger(),
    latentSkills: ch1EmptyLatentSkills(),
    testimonies: [],
  };
}

export function ch1HasFlag(state: Ch1PlayerState, flag: string): boolean {
  return state.flags.includes(flag);
}

export function ch1SetFlag(
  state: Ch1PlayerState,
  flag: string
): Ch1PlayerState {
  if (state.flags.includes(flag)) {
    return state;
  }
  return { ...state, flags: [...state.flags, flag] };
}

export function ch1AdjustTrack(
  state: Ch1PlayerState,
  track: string,
  delta: number
): Ch1PlayerState {
  const current = state.tracks[track] ?? 0;
  const next = Math.max(0, Math.min(100, current + delta));
  return { ...state, tracks: { ...state.tracks, [track]: next } };
}

export function ch1CanReceiveFragments(state: Ch1PlayerState): boolean {
  return ch1FragmentDeliveryEnabled(state.flags);
}

// ---------------------------------------------------------------------------
// Dungeon run lifecycle
// ---------------------------------------------------------------------------

export type Ch1EnterGateResult =
  | {
      ok: true;
      dungeonId: string;
      /** Server-side warp destination inside the unreachable Elsewhen band. */
      arrival: readonly [number, number, number];
    }
  | { ok: false; reason: string; provisioning?: Ch1ProvisioningResult };

/**
 * The only sanctioned way into a dungeon. Entry is a validated server warp,
 * never a collision volume — the Elsewhen band has no walkable connection to
 * the rest of the world (see ch1_elsewhen_region.ts).
 */
export function ch1EnterGate(args: {
  state: Ch1PlayerState;
  gateId: string;
  carried: Readonly<Record<string, number>>;
}): Ch1EnterGateResult {
  const gate = ch1Gate(args.gateId);
  if (!gate) {
    return { ok: false, reason: `unknown gate: ${args.gateId}` };
  }
  if (!gate.enterable || !gate.dungeonId) {
    return { ok: false, reason: "this gate cannot be entered" };
  }
  if (gate.requiresFlag && !ch1HasFlag(args.state, gate.requiresFlag)) {
    return { ok: false, reason: "this gate is not open yet" };
  }
  if (args.state.activeDungeonRunId) {
    return { ok: false, reason: "already inside a gate" };
  }

  // Hard block. There are no shops in there and this cannot be waived.
  const provisioning = ch1CheckProvisioning(args.gateId, args.carried);
  if (!provisioning.ok) {
    return { ok: false, reason: "under-provisioned", provisioning };
  }

  const slot = ch1ElsewhenSlot(gate.dungeonId);
  if (!slot) {
    return {
      ok: false,
      reason: "no Elsewhen slot is reserved for this dungeon",
    };
  }

  return { ok: true, dungeonId: gate.dungeonId, arrival: slot.arrival };
}

export type Ch1ExitGateResult =
  | {
      ok: true;
      /** Grove-side milliseconds that passed. Revealed on exit, never before. */
      groveElapsedMs: number;
      completionFlags: readonly string[];
    }
  | { ok: false; reason: string };

export function ch1ExitGate(args: {
  state: Ch1PlayerState;
  carriedOut: readonly string[];
  nowMs: number;
}): Ch1ExitGateResult {
  const runId = args.state.activeDungeonRunId;
  if (!runId) {
    return { ok: false, reason: "not inside a gate" };
  }
  const dungeon = ch1Dungeon(runId);
  if (!dungeon) {
    return { ok: false, reason: `unknown dungeon: ${runId}` };
  }
  if (!ch1DungeonRunComplete(runId, args.carriedOut)) {
    const missing = dungeon.retrievals
      .filter((r) => r.required && !args.carriedOut.includes(r.id))
      .map((r) => r.name);
    return {
      ok: false,
      reason: `a dungeon is a retrieval, not a clear. Still inside: ${missing.join(
        ", "
      )}`,
    };
  }
  const gate = ch1Gate(dungeon.gateId);
  // NB: `activeRunStartedMs` of 0 is a legitimate timestamp (and the value the
  // tests use). Checking truthiness here silently zeroed every run's elapsed
  // time, which killed the time-dilation reveal — the whole point of the exit.
  const insideMs =
    args.state.activeRunStartedMs !== undefined
      ? Math.max(0, args.nowMs - args.state.activeRunStartedMs)
      : 0;
  return {
    ok: true,
    groveElapsedMs: insideMs * (gate?.timeDilation ?? 1),
    completionFlags: dungeon.completionFlags,
  };
}

// ---------------------------------------------------------------------------
// Endings
// ---------------------------------------------------------------------------

export interface Ch1EndingDef {
  id: Ch1Ending;
  label: string;
  action: string;
  immediateCost: string;
  chapter2: string;
}

export const CH1_ENDING_DEFS: readonly Ch1EndingDef[] = Object.freeze([
  {
    id: "confess",
    label: "Confess",
    action:
      "Stand up in front of the Grove and tell them everything: who you are, what you built, and what you just gave away.",
    immediateCost:
      "The Grove's safety. The Collective now has a public target and the Grove is it. Some people leave.",
    chapter2:
      "The Grove becomes a faction with a stake. Jackie freed publicly. Rook opens a door. Highest long-term trust, highest exposure.",
  },
  {
    id: "contain",
    label: "Contain",
    action:
      "Say nothing publicly. Get Jackie out quietly. Go after the transport with Take Terra.",
    immediateCost:
      "The Grove never learns what happened, and you keep lying to people who love you.",
    chapter2:
      "TT alignment. Fast start on the pursuit. The Grove is safe and you are alone in it.",
  },
  {
    id: "bargain",
    label: "Bargain",
    action:
      "Go to Vane and take the offer: credentials, a lab, resources, and a seat at the table where the shutdown gets planned.",
    immediateCost:
      "Jackie stays in the watch-house. Sorrel stays in Collective custody. You become the thing you were trying to expose.",
    chapter2:
      "Inside access and real ability to shape the shutdown. Every ally earned in Chapter 1 becomes a liability or an enemy.",
  },
]);

/** None of these is the good ending. Do not mark one as canon. */
export const CH1_CANON_ENDING = undefined;

export function ch1ChooseEnding(
  state: Ch1PlayerState,
  ending: Ch1Ending
): Ch1PlayerState {
  if (!CH1_ENDINGS.includes(ending)) {
    throw new Error(`unknown Chapter 1 ending: ${ending}`);
  }
  return {
    ...ch1SetFlag(state, CH1_FLAGS.complete),
    ending,
  };
}

// ---------------------------------------------------------------------------
// Hallr's choice
//
// Audit fix: ch1_hallr_choice appeared in the carry-forward list and in the
// dungeon's choice definition, but nothing ever recorded it — Chapter 2 would
// have read an empty value for the chapter's second-biggest decision.
// ---------------------------------------------------------------------------

export type Ch1HallrChoice = "let_run" | "hold_stall";
export const CH1_HALLR_CHOICE_FLAGS: Readonly<Record<Ch1HallrChoice, string>> =
  Object.freeze({
    let_run: "ch1_hallr_let_run",
    hold_stall: "ch1_hallr_hold_stall",
  });

export function ch1RecordHallrChoice(
  state: Ch1PlayerState,
  choice: Ch1HallrChoice
): Ch1PlayerState {
  const flag = CH1_HALLR_CHOICE_FLAGS[choice];
  if (!flag) {
    throw new Error(`unknown Hallr choice: ${choice}`);
  }
  // The choice is made once; a second answer does not overwrite the first.
  // Neither option is scored (ch1_dungeons.ts) and neither is revocable.
  const already = Object.values(CH1_HALLR_CHOICE_FLAGS).some((f) =>
    state.flags.includes(f)
  );
  if (already) {
    return state;
  }
  return ch1SetFlag(state, flag);
}

export function ch1HallrChoiceMade(
  state: Ch1PlayerState
): Ch1HallrChoice | undefined {
  for (const [choice, flag] of Object.entries(CH1_HALLR_CHOICE_FLAGS)) {
    if (state.flags.includes(flag)) {
      return choice as Ch1HallrChoice;
    }
  }
  return undefined;
}

export const CH1_CARRY_FORWARD_KEYS: readonly string[] = Object.freeze([
  CH1_ENDING_FLAG,
  "ch1_hallr_choice",
  CH1_FLAGS.irisRescued,
  CH1_FLAGS.marrowSaved,
  CH1_FLAGS.rookToken,
  CH1_FLAGS.jackieReported,
  CH1_FLAGS.jackieStatementWithheld,
  "ch1_jackie_trust",
  "ch1_lou_trust",
  "augur9_alive",
  "ch1_testimonies_collected",
]);
