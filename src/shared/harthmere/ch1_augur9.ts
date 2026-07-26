// CHAPTER_1_AUGUR9_CORE_CHARGE
//
// AUGUR-9's core is the chapter's quietest tragedy made mechanical: every log
// the player plays costs the robot hours of life, and it should be entirely
// optional whether the player notices.
//
// The audit found this system existed only as constants (CH1_TRACKS.
// auggieCharge, per-fragment chargeCost) with no state machine behind them —
// no spend, no recharge, no death at zero, no lost-log accounting. This module
// is that machine.
//
// AUTHORITY: charge is Harthmere-specific state with no native ECS model, so
// per HARTHMERE_BIOMES_ECS_SOURCE_OF_TRUTH.md it lives in the player's chapter
// record server-side. AUGUR-9 the NPC is a real ECS entity; this module never
// touches its transform, health, or Anima brain — a dead core is expressed as
// the entity's `iced` state by the server, not by deleting it.
//
// See docs/harthmere/CHAPTER_1_IDENTITY_WRITERS_JOURNAL.md §3.2, §8.3.

import {
  CH1_FRAGMENTS,
  ch1Fragment,
} from "@/shared/harthmere/ch1_fragment_ledger";

export const CH1_AUGUR9_VERSION = 1 as const;

/** Starting charge: eleven years of walking a degrading patrol loop. */
export const CH1_AUGUR9_INITIAL_CHARGE = 62;
export const CH1_AUGUR9_MAX_CHARGE = 100;

/** Standard playback cost. Choosing what to remember costs Auggie hours. */
export const CH1_AUGUR9_PLAYBACK_COST = 6;

/** Environmental drain multipliers (journal §8.3, §9.3). */
export const CH1_AUGUR9_HEAT_DRAIN_MULTIPLIER = 3; // the desert
export const CH1_AUGUR9_COLD_DRAIN_MULTIPLIER = 0.5; // the fjord's one mercy

/** Recharge items. */
export const CH1_AUGUR9_RECHARGES: Readonly<Record<string, number>> =
  Object.freeze({
    item_augur9_core_cell: 18,
    // The Gilded Bull's two-hundred-year-old core. Using it means the Bull's
    // death bought Auggie's life. Nobody comments on this.
    item_bulls_core: 48,
  });

export interface Ch1Augur9State {
  charge: number;
  /** Permanently dead. Remaining unplayed logs are lost for the run. */
  shutDown: boolean;
  /** Fragment ids played back so far (idempotency + lost-log accounting). */
  playedLogIds: string[];
}

export function ch1Augur9Initial(): Ch1Augur9State {
  return {
    charge: CH1_AUGUR9_INITIAL_CHARGE,
    shutDown: false,
    playedLogIds: [],
  };
}

export type Ch1PlaybackResult =
  | { ok: true; state: Ch1Augur9State; chargeSpent: number }
  | { ok: false; state: Ch1Augur9State; reason: string };

/**
 * Play a log. Idempotent per fragment: replaying a recovered log is free,
 * because the recording is already in the player's ledger — the cost is
 * retrieval from a dying core, not playback of a saved copy.
 */
export function ch1Augur9PlayLog(
  state: Ch1Augur9State,
  fragmentId: string
): Ch1PlaybackResult {
  const fragment = ch1Fragment(fragmentId);
  if (!fragment) {
    return { ok: false, state, reason: `unknown fragment: ${fragmentId}` };
  }
  if (fragment.type !== "playback") {
    return {
      ok: false,
      state,
      reason: `${fragmentId} is a ${fragment.type}, not an AUGUR-9 log`,
    };
  }
  if (state.playedLogIds.includes(fragmentId)) {
    return { ok: true, state, chargeSpent: 0 };
  }
  if (state.shutDown) {
    return {
      ok: false,
      state,
      reason: "AUGUR-9 has shut down; its remaining logs are lost for this run",
    };
  }
  const cost = fragment.chargeCost ?? CH1_AUGUR9_PLAYBACK_COST;
  if (state.charge < cost) {
    // The player must choose: feed him a cell, or let the memory go.
    return {
      ok: false,
      state,
      reason: `core charge ${state.charge} is below the ${cost} this log costs`,
    };
  }
  const nextCharge = state.charge - cost;
  return {
    ok: true,
    chargeSpent: cost,
    state: {
      charge: nextCharge,
      // Playback can drain him to exactly zero; that final log plays in full.
      // He finishes the sentence. Then he stops.
      shutDown: nextCharge === 0,
      playedLogIds: [...state.playedLogIds, fragmentId],
    },
  };
}

/** Ambient drain from time spent in an environment. Never kills mid-log. */
export function ch1Augur9EnvironmentalDrain(
  state: Ch1Augur9State,
  args: { hours: number; environment: "grove" | "desert" | "winter" }
): Ch1Augur9State {
  if (state.shutDown) {
    return state;
  }
  const baseDrainPerHour = 0.5;
  const multiplier =
    args.environment === "desert"
      ? CH1_AUGUR9_HEAT_DRAIN_MULTIPLIER
      : args.environment === "winter"
        ? CH1_AUGUR9_COLD_DRAIN_MULTIPLIER
        : 1;
  const drained = Math.max(
    0,
    state.charge - args.hours * baseDrainPerHour * multiplier
  );
  return {
    ...state,
    charge: drained,
    shutDown: drained === 0,
  };
}

export function ch1Augur9Recharge(
  state: Ch1Augur9State,
  itemId: string
): Ch1Augur9State {
  const amount = CH1_AUGUR9_RECHARGES[itemId];
  if (amount === undefined) {
    throw new Error(`${itemId} is not an AUGUR-9 recharge item`);
  }
  // A cell can bring him back from shutdown DURING the chapter — the state is
  // "permanent" only in the sense that nothing inside a dungeon can do it.
  const charge = Math.min(CH1_AUGUR9_MAX_CHARGE, state.charge + amount);
  return { ...state, charge, shutDown: charge === 0 };
}

/** Logs that die with him: authored playbacks he never got to play. */
export function ch1Augur9LostLogs(state: Ch1Augur9State): readonly string[] {
  if (!state.shutDown) {
    return [];
  }
  return CH1_FRAGMENTS.filter(
    (f) => f.type === "playback" && !state.playedLogIds.includes(f.id)
  ).map((f) => f.id);
}

/** Carried into Chapter 2: whether the robot survived the chapter. */
export function ch1Augur9Alive(state: Ch1Augur9State): boolean {
  return !state.shutDown;
}

/**
 * Total charge required to play every authored log at least once. The chapter
 * must be AUTHORABLE as a full completion: initial charge plus obtainable
 * recharges must cover every log, or a completionist player hits an
 * impossible wall. Enforced by test.
 */
export function ch1Augur9WorstCaseLogCost(): number {
  return CH1_FRAGMENTS.filter((f) => f.type === "playback").reduce(
    (sum, f) => sum + (f.chargeCost ?? CH1_AUGUR9_PLAYBACK_COST),
    0
  );
}

export function ch1Augur9ObtainableRecharge(): number {
  // One core cell granted in Act 1 plus the Bull's core in Dungeon 1.
  return (
    CH1_AUGUR9_RECHARGES.item_augur9_core_cell +
    CH1_AUGUR9_RECHARGES.item_bulls_core
  );
}
