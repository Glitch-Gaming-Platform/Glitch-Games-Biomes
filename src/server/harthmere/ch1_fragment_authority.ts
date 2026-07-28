// CHAPTER_1_FRAGMENT_TRUTH_AUTHORITY  (SERVER ONLY)
//
// Whether a recovered memory is true, partial, or a confabulation lives HERE
// and nowhere else. This module must never be imported from src/client or from
// a shared module that the client bundles.
//
// WHY THIS IS SERVER-ONLY:
//   The entire chapter is a fair-play mystery. A player who opens devtools and
//   reads `truth: false` on the Act 3 corridor reconstruction has had the twist
//   spoiled by our own bundle. The shared catalog (ch1_fragment_ledger.ts)
//   carries player-facing copy and a deliberately uncorrelated `confidence`
//   number; the truth table is only ever used server-side for:
//     * validating that the fair-play rules hold (playbacks never lie)
//     * driving the Act 6 revision set
//     * analytics on how early players solve the chapter
//
// See docs/harthmere/CHAPTER_1_IDENTITY_WRITERS_JOURNAL.md §4.3, §10.

import {
  CH1_CONSOLIDATION_ORDER,
  CH1_FRAGMENTS,
  ch1Fragment,
  type Ch1FragmentType,
} from "@/shared/harthmere/ch1_fragment_ledger";

export const CH1_FRAGMENT_AUTHORITY_VERSION = 1 as const;

/**
 * true    — the fragment is an accurate account of what happened.
 * partial — accurate in every particular, incomplete in a way that misleads.
 * false   — a confabulation: real inputs, wrong assembly.
 */
export type Ch1FragmentTruth = "true" | "partial" | "false";

/**
 * THE TRUTH TABLE. Never serialize this to a client response.
 */
const CH1_FRAGMENT_TRUTH: Readonly<Record<string, Ch1FragmentTruth>> =
  Object.freeze({
    // Act 1
    frag_a1_play_run_it_again: "true",
    frag_a1_play_patrol_loop: "true",
    frag_a1_echo_the_kettle: "true",
    frag_a1_echo_get_back: "true",

    // Act 2
    frag_a2_echo_lamps_out: "true",
    // He really did carry the player out. He carried them out afterwards.
    frag_a2_overlay_ive_got_you: "partial",
    frag_a2_play_the_ninth_signature: "true",
    frag_a2_overlay_the_cove_glass: "true",
    // The player assembles this from twelve true sentences and gets it wrong.
    frag_a2_recon_arrival: "false",

    // Act 3
    frag_a3_play_ninth_paper: "true",
    frag_a3_overlay_the_balance: "true",
    // A reconstruction the player gets RIGHT, because it is not about them.
    frag_a3_recon_the_evacuation: "true",
    frag_a3_echo_cold_to_stand_next_to: "true",
    // THE BIG ONE. Every frame literally happened. The assembly is inverted.
    frag_a3_recon_corridor: "false",

    // Act 4
    frag_a4_echo_the_stones_are_flat: "true",
    frag_a4_overlay_thirty_one_seconds: "true",
    frag_a4_play_twenty_two: "true",
    frag_a4_echo_defends_itself: "true",
    frag_a4_play_the_bibliography: "true",
    frag_a4_echo_ask_me_in_a_month: "true",
    // Accurate to the door, then politely finished by the reconstructor.
    frag_a4_recon_the_hearing: "partial",

    // Act 5
    frag_a5_play_decimal_place: "true",
    frag_a5_overlay_ashfall: "true",
    frag_a5_play_custodian_roll: "true",
    frag_a5_recon_the_gantry: "true",
    frag_a5_echo_the_name: "true",
    frag_a5_link_the_recommendation: "true",
    frag_a5_link_the_walk: "true",
    frag_a5_link_the_custodian: "true",

    // Act 6
    frag_a6_the_intake_window: "true",
  });

/**
 * RULE 5: the ledger must not become a truth oracle by TYPE either.
 *
 * If every reconstruction in the chapter were false, "reconstruction" would be
 * a label meaning "ignore this", and the Act 3 corridor would carry no risk.
 * At least one reconstruction must be true and at least one must be false, and
 * the same must hold for the fragment classes the player is told to trust.
 */
export function ch1TypeIsNotTruth(): string[] {
  const errors: string[] = [];
  const reconstructions = CH1_FRAGMENTS.filter(
    (f) => f.type === "reconstruction"
  );
  if (!reconstructions.some((f) => CH1_FRAGMENT_TRUTH[f.id] === "false")) {
    errors.push(
      "no reconstruction is false; the chapter's central misdirection has no " +
        "delivery mechanism"
    );
  }
  if (!reconstructions.some((f) => CH1_FRAGMENT_TRUTH[f.id] === "true")) {
    errors.push(
      "every reconstruction is unreliable; 'reconstruction' has become a " +
        "label the player can safely ignore"
    );
  }
  return errors;
}

export function ch1FragmentTruth(
  fragmentId: string
): Ch1FragmentTruth | undefined {
  return CH1_FRAGMENT_TRUTH[fragmentId];
}

// ---------------------------------------------------------------------------
// Fair-play rules
// ---------------------------------------------------------------------------

/**
 * RULE 1: Playbacks never lie.
 *
 * A playback is a diegetic recording — from AUGUR-9, the Card, or a terminal.
 * It is the player's evidence baseline. If a playback is ever anything other
 * than "true", the chapter's contract with the player is broken and the
 * mystery becomes unsolvable-by-design rather than hard.
 */
export function ch1PlaybacksNeverLie(): string[] {
  return CH1_FRAGMENTS.filter((f) => f.type === "playback")
    .filter((f) => CH1_FRAGMENT_TRUTH[f.id] !== "true")
    .map(
      (f) =>
        `${f.id}: playbacks must be truth="true" but is ` +
        `"${CH1_FRAGMENT_TRUTH[f.id]}"`
    );
}

/**
 * RULE 2: Only reconstructions confabulate.
 *
 * Echoes are ambiguous but honest. Overlays have accurate geometry. Derived
 * fragments are the player's own correct deductions. Only a reconstruction —
 * the class Doc explicitly warns about in Act 2 — may be false.
 */
export function ch1OnlyReconstructionsLie(): string[] {
  const allowedToBeFalse: Ch1FragmentType[] = ["reconstruction"];
  return CH1_FRAGMENTS.filter(
    (f) =>
      CH1_FRAGMENT_TRUTH[f.id] === "false" && !allowedToBeFalse.includes(f.type)
  ).map(
    (f) => `${f.id}: type "${f.type}" may not be false; only reconstructions may`
  );
}

/**
 * RULE 3: Confidence is not a truth signal.
 *
 * If a player could reliably sort truth by the visible confidence number, the
 * Act 5 linking screen would hand them the answer. We require that at least
 * one false fragment carries high confidence and at least one true fragment
 * carries low confidence — the inverse correlation that rewards attentive
 * players without being a rule they can mechanically apply.
 */
export function ch1ConfidenceIsNotTruth(): string[] {
  const errors: string[] = [];
  const highConfidenceFalse = CH1_FRAGMENTS.some(
    (f) => CH1_FRAGMENT_TRUTH[f.id] === "false" && f.confidence >= 80
  );
  const lowConfidenceTrue = CH1_FRAGMENTS.some(
    (f) => CH1_FRAGMENT_TRUTH[f.id] === "true" && f.confidence <= 35
  );
  if (!highConfidenceFalse) {
    errors.push(
      "no false fragment carries high confidence; the twist is now guessable " +
        "from the confidence column alone"
    );
  }
  if (!lowConfidenceTrue) {
    errors.push(
      "no true fragment carries low confidence; confidence has become a " +
        "reliable truth oracle"
    );
  }
  return errors;
}

/**
 * RULE 4: Everything the consolidation revises must be something the player
 * actually got wrong (or was only shown half of). Revising a fragment that was
 * already fully true and complete would be the game changing its own story
 * rather than the player's understanding of it.
 */
export function ch1RevisionsOnlyCorrectErrors(): string[] {
  const errors: string[] = [];
  for (const id of CH1_CONSOLIDATION_ORDER) {
    const frag = ch1Fragment(id);
    if (!frag) {
      errors.push(`${id}: consolidation references an unknown fragment`);
      continue;
    }
    // The intake window is recovered BY the consolidation, not revised by it.
    if (id === "frag_a6_the_intake_window") {
      continue;
    }
    const truth = CH1_FRAGMENT_TRUTH[id];
    if (truth === "true" && frag.revisedConfidence === undefined) {
      errors.push(
        `${id}: revised during consolidation but was already fully true and ` +
          `carries no confidence revision`
      );
    }
    if (frag.revisedBody === undefined) {
      errors.push(`${id}: in the consolidation order but has no revisedBody`);
    }
  }
  return errors;
}

/** Every fragment in the catalog must have a truth value, and vice versa. */
export function ch1TruthTableIsComplete(): string[] {
  const errors: string[] = [];
  for (const frag of CH1_FRAGMENTS) {
    if (!CH1_FRAGMENT_TRUTH[frag.id]) {
      errors.push(`${frag.id}: no truth value assigned`);
    }
  }
  const known = new Set(CH1_FRAGMENTS.map((f) => f.id));
  for (const id of Object.keys(CH1_FRAGMENT_TRUTH)) {
    if (!known.has(id)) {
      errors.push(`${id}: truth value for a fragment that does not exist`);
    }
  }
  return errors;
}

export function ch1ValidateFairPlay(): string[] {
  return [
    ...ch1TruthTableIsComplete(),
    ...ch1PlaybacksNeverLie(),
    ...ch1OnlyReconstructionsLie(),
    ...ch1ConfidenceIsNotTruth(),
    ...ch1RevisionsOnlyCorrectErrors(),
    ...ch1TypeIsNotTruth(),
  ];
}

// ---------------------------------------------------------------------------
// Client projection
// ---------------------------------------------------------------------------

export interface Ch1ClientFragmentView {
  fragmentId: string;
  title: string;
  type: Ch1FragmentType;
  body: string;
  /** Only populated once Act 5 linking is unlocked. */
  confidence?: number;
  revised: boolean;
}

/**
 * The ONLY function permitted to build a fragment payload for the wire. It
 * takes the authored fragment plus server state and returns a view object with
 * no truth field on it, by construction — there is no code path that can
 * accidentally include one.
 */
export function ch1ProjectFragmentForClient(args: {
  fragmentId: string;
  revised: boolean;
  linkingUnlocked: boolean;
}): Ch1ClientFragmentView | undefined {
  const frag = ch1Fragment(args.fragmentId);
  if (!frag) {
    return undefined;
  }
  const body =
    args.revised && frag.revisedBody !== undefined ? frag.revisedBody : frag.body;
  const confidence =
    args.revised && frag.revisedConfidence !== undefined
      ? frag.revisedConfidence
      : frag.confidence;
  return {
    fragmentId: frag.id,
    title: frag.title,
    type: frag.type,
    body,
    confidence: args.linkingUnlocked ? confidence : undefined,
    revised: args.revised,
  };
}
