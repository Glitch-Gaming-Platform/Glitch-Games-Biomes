// CHAPTER_1_FRAGMENT_LEDGER
//
// The memory-reconstruction system for Chapter 1 ("Identity").
//
// DESIGN CONTRACT — read before editing:
//
//  1. This module is SHARED and therefore reachable from the client. It
//     contains NO truth values. Whether a fragment is true, partial, or a
//     confabulation lives exclusively in
//     src/server/harthmere/ch1_fragment_authority.ts.
//  2. `confidence` is the player-facing number and is deliberately NOT
//     correlated with truth. The Act 3 corridor reconstruction ships at 91.
//  3. Playbacks never lie. Only reconstructions confabulate. Doc states this
//     in plain clinical language in Act 2 — the player is warned.
//  4. A revision may only re-render material already shown. It may not add a
//     shot, a line, or an angle. See ch1_scenes.ts.
//
// See docs/harthmere/CHAPTER_1_IDENTITY_WRITERS_JOURNAL.md §4 and §10.

import { CH1_FLAGS } from "@/shared/harthmere/ch1_ids";

export const CH1_FRAGMENT_LEDGER_VERSION = 1 as const;
export const CH1_FRAGMENT_LEDGER_TAB_ID = "recovered";
export const CH1_FRAGMENT_LEDGER_TAB_LABEL = "Recovered";
export const CH1_FRAGMENT_LEDGER_EMPTY_TEXT = "Nothing yet.";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Echo        — audio only, 3-8s, no visuals. Ambiguous by construction.
 * Overlay     — ghost scene drawn over the live world. Accurate geometry,
 *               unreliable faces.
 * Playback    — a recovered recording (Auggie, the Card, a terminal).
 *               Diegetic, verifiable, incomplete. THESE NEVER LIE.
 * Reconstruction — a playable flashback vignette. Rich, cinematic, and the
 *               only fragment class permitted to confabulate.
 * Derived     — produced by the player linking two fragments in Act 5.
 */
export const CH1_FRAGMENT_TYPES = [
  "echo",
  "overlay",
  "playback",
  "reconstruction",
  "derived",
] as const;
export type Ch1FragmentType = (typeof CH1_FRAGMENT_TYPES)[number];

export const CH1_FRAGMENT_TRIGGERS = [
  "object",
  "place",
  "sound",
  "face",
  "skill",
  "stress",
  "sleep",
  "link",
] as const;
export type Ch1FragmentTrigger = (typeof CH1_FRAGMENT_TRIGGERS)[number];

export interface Ch1FragmentDef {
  id: string;
  /** Player-facing ledger title. */
  title: string;
  type: Ch1FragmentType;
  trigger: Ch1FragmentTrigger;
  /** Act in which this fragment can first be recovered (1..6). */
  act: number;
  /**
   * Player-facing confidence, 0..100. Visible only once Act 5 linking is
   * unlocked. Not a truth signal.
   */
  confidence: number;
  /** Ledger body copy shown to the player. */
  body: string;
  /** Optional cutscene id rendered when the fragment is recovered. */
  cutsceneId?: string;
  /** What causes recovery, in designer-readable terms. */
  triggerNote: string;
  /** Auggie core-charge cost. Playbacks cost the robot's remaining life. */
  chargeCost?: number;
  /** Fragments this one revises during the Act 6 consolidation sequence. */
  revises?: readonly string[];
  /** Confidence this fragment is rewritten to during consolidation. */
  revisedConfidence?: number;
  /** Ledger body after revision. Only set on entries the climax rewrites. */
  revisedBody?: string;
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export const CH1_FRAGMENTS: readonly Ch1FragmentDef[] = Object.freeze([
  // --- Act 1 -------------------------------------------------------------
  {
    id: "frag_a1_play_run_it_again",
    title: "Run It Again",
    type: "playback",
    trigger: "object",
    act: 1,
    confidence: 88,
    chargeCost: 6,
    body: 'Twenty-two seconds off the robot. A voice reading a measurement aloud, sounding bored. Then it stops. A long pause. Then, quietly: "Run it again."\n\nIt is your voice. You are certain of that and nothing else.',
    triggerNote:
      "First AUGUR-9 log playback, offered by Luis once the chassis walks.",
  },
  {
    id: "frag_a1_play_patrol_loop",
    title: "Eleven Years Of Tuesdays",
    type: "playback",
    trigger: "object",
    act: 1,
    confidence: 84,
    chargeCost: 6,
    body: "A patrol log. The same circuit, timestamped, unbroken, for eleven years.\n\nThere is no entry anywhere in it for being given the route, and no entry anywhere in it for being told to stop.",
    triggerNote:
      "AUGUR-9's own record rather than the player's. Establishes the eleven years before the player has any way to date themselves.",
  },
  {
    id: "frag_a1_echo_the_kettle",
    title: "Twice, In The Same Room",
    type: "echo",
    trigger: "sleep",
    act: 1,
    confidence: 24,
    body: "Water coming to the boil. Then, a little later, water coming to the boil again, in the same room, with nobody saying anything in between.\n\nIt is the most ordinary sound in the world and you wake up with your jaw aching.",
    triggerNote:
      "The scheduled sleep channel. Deliberately worthless on first hearing. It is Jackie making a second pot because the first one went cold while she waited to see whether you would drink it.",
  },
  {
    id: "frag_a1_echo_get_back",
    title: "Get Back From It",
    type: "echo",
    trigger: "stress",
    act: 1,
    confidence: 90,
    body: 'A woman\'s voice, from a long way off, urgent enough to crack:\n\n"—get back from it—"\n\nNo picture. No room. Just the shape of someone running.',
    triggerNote:
      "Fires the instant the first Fracture Gate closes at the fence line.",
    revisedConfidence: 100,
    revisedBody:
      "A woman's voice, from a long way off, urgent enough to crack. You know the corridor now. You know the smoke. You know she was four minutes late and running anyway.\n\nIt is Jackie.",
  },

  // --- Act 2 -------------------------------------------------------------
  {
    id: "frag_a2_echo_lamps_out",
    title: "Not Down. Out.",
    type: "echo",
    trigger: "place",
    act: 2,
    confidence: 44,
    body: "Rain on a road. Someone asking, twice, for the lamps to be put out rather than turned down.",
    triggerNote: "Recovered from Helsa's testimony on the night lamp route.",
  },
  {
    id: "frag_a2_overlay_ive_got_you",
    title: "I've Got You",
    type: "overlay",
    trigger: "face",
    act: 2,
    confidence: 71,
    cutsceneId: "ch1-overlay-ive-got-you",
    body: "A corridor drawn over the clinic wall. Smoke along the ceiling. A hand closing on your shoulder from behind, and a voice, level and kind:\n\n\"I've got you. I've got you. Walk.\"\n\nWhoever it was, they got you out.",
    triggerNote:
      "Face trigger: fires within seconds of first meeting the visiting doctor.",
    revisedConfidence: 99,
    revisedBody:
      "The same corridor. The same hand. The same three words, in the same order, in the same voice you have been hearing across the Grove for weeks.\n\nHe did get you out. He got you out afterwards.",
  },
  {
    id: "frag_a2_play_the_ninth_signature",
    title: "The Ninth Signature",
    type: "playback",
    trigger: "object",
    act: 2,
    confidence: 82,
    chargeCost: 6,
    body: "A charter being read aloud, badly, by someone in a hurry. Names and numbers. The recording cuts before the list is finished.",
    triggerNote: "AUGUR-9 log, available once the ledger tab opens.",
  },
  {
    id: "frag_a2_overlay_the_cove_glass",
    title: "What The Water Gives",
    type: "overlay",
    trigger: "place",
    act: 2,
    confidence: 49,
    body: "Shutter Cove, with a second cove drawn faintly over it: the same waterline, the same shelf of returned junk, and a lattice of thin warm lines running through both of them and out to sea.\n\nDimmi has been collecting the places where the lines cross. She calls it luck.",
    triggerNote:
      "Place trigger at the cove. First evidence the Card is instrumentation rather than jewellery, delivered by a side character about junk on a beach.",
  },
  {
    id: "frag_a2_recon_arrival",
    title: "The Night You Came",
    type: "reconstruction",
    trigger: "link",
    act: 2,
    confidence: 84,
    cutsceneId: "ch1-recon-arrival",
    body: "You assembled this yourself, out of twelve people's half-memories.\n\nA woman carries you up the Grove road in the rain. She does not stop to rest. She takes the way with no windows on it. She asks for the lamps to be put out. She does not write you into the ledger for nine days.\n\nShe was not bringing you somewhere safe. She was making sure nobody could find you.",
    triggerNote:
      "Awarded on collecting all twelve testimonies. The player builds this one themselves — nobody lied to them.",
    revisedConfidence: 19,
    revisedBody:
      "The same twelve sentences. Nothing added. Reassembled.\n\nShe did not stop to rest because stopping would have killed you. She took the way with no windows because windows have people behind them. She asked for the lamps to be put out because light travels. She waited nine days to write you in because a name in a ledger is a name someone can read.\n\nShe was not hiding a victim. She was hiding a survivor.",
  },

  // --- Act 3 -------------------------------------------------------------
  {
    id: "frag_a3_play_ninth_paper",
    title: "Your Ninth Paper",
    type: "playback",
    trigger: "skill",
    act: 3,
    confidence: 95,
    chargeCost: 6,
    body: "AUGUR-9 reads a citation. The calibration procedure you just performed in a two-thousand-year-old room, without being taught it, is attributed to you.\n\nYou wrote it. You have no memory of writing it.",
    triggerNote: "Hall of Weights, after the balance solution.",
  },
  {
    id: "frag_a3_overlay_the_balance",
    title: "Two Standards",
    type: "overlay",
    trigger: "skill",
    act: 3,
    confidence: 68,
    body: "A modern calibration lattice drawn over a bronze balance beam, and the two of them agreeing perfectly.\n\nEverything you carried in here disagrees with everything else you carried in here. The beam does not disagree with anything. It only compares.",
    triggerNote:
      "Skill trigger, Hall of Weights. States the chapter's thesis in one image: you cannot measure anything against the present.",
  },
  {
    id: "frag_a3_recon_the_evacuation",
    title: "They Left The Seed",
    type: "reconstruction",
    trigger: "place",
    act: 3,
    confidence: 54,
    body: "You walk the city out, six weeks late, and your head fills in the rest without being asked.\n\nThe meals on the tables. The doors left open. The vault behind you still full, because whoever gave the order believed they were coming back before planting.\n\nThis one is a reconstruction and it is not about you at all, which is possibly why it is one of the few you get right the first time.",
    triggerNote:
      "A TRUE reconstruction, and the only demonstration in the chapter that the reconstructor works fine on evidence it has no stake in. Fair play: it teaches the mechanism without teaching the answer.",
  },
  {
    id: "frag_a3_echo_cold_to_stand_next_to",
    title: "Cold To Stand Next To",
    type: "echo",
    trigger: "sound",
    act: 3,
    confidence: 31,
    body: 'A child describing a woman who comes and goes and never stays long. "Cold to stand next to." She has been visiting the grain vault for weeks. She is not from here.',
    triggerNote:
      "Iris Fen, in the Seed Vault. Sets up Act 5 without naming it.",
  },
  {
    id: "frag_a3_recon_corridor",
    title: "The Corridor",
    type: "reconstruction",
    trigger: "object",
    act: 3,
    confidence: 91,
    cutsceneId: "ch1-recon-corridor",
    body: "Smoke along the ceiling. An alarm you can feel in your teeth. You cannot move.\n\nA woman is coming down the corridor toward you at a dead run, and there is a syringe in her hand.\n\nBehind you a man's voice: \"I've got you, walk, don't look at her, walk—\" and hands pull you backwards through a door.\n\nYou know that walk. Trained. Quiet. No trail.",
    triggerNote:
      "Fires on taking the First Grain. THE major misdirection of the chapter.",
    revisedConfidence: 12,
    revisedBody:
      "Every frame of this is true and you assembled all of it wrong.\n\nThe woman running toward you is Jackie. What is in her hand is the vial — the one you had analysed, the one you reported her for. She had already stolen it. She was four minutes late.\n\nThe hands pulling you backwards belong to the man who dosed you eleven minutes earlier and was removing a patient from a fire he had arranged.\n\nNothing was added to this memory. It was only ever pointed the wrong way.",
  },

  // --- Act 4 -------------------------------------------------------------
  {
    id: "frag_a4_echo_the_stones_are_flat",
    title: "Half A Tone",
    type: "echo",
    trigger: "sound",
    act: 4,
    confidence: 66,
    body: "You heard it before you understood it. The song stones have been flat for about a year, and the reason is underneath them, and you know what the reason is.",
    triggerNote: "Mosslawn. Unlocks ls_anchor_read.",
  },
  {
    id: "frag_a4_overlay_thirty_one_seconds",
    title: "Thirty-One Seconds",
    type: "overlay",
    trigger: "skill",
    act: 4,
    confidence: 77,
    cutsceneId: "ch1-overlay-containment",
    body: "A containment lattice drawn over the Ashline floor in a notation nobody at Ashline uses. Your hands are already moving. You are four steps ahead of a procedure you have never read.\n\nAsked how, you have nothing. Not modesty. Nothing.",
    triggerNote: "Ashline runaway core. Unlocks ls_containment_triage.",
  },
  {
    id: "frag_a4_play_twenty_two",
    title: "Twenty-Two",
    type: "playback",
    trigger: "object",
    act: 4,
    confidence: 92,
    chargeCost: 6,
    body: "AUGUR-9 records everything, because that is what a custodian unit does.\n\nTwenty-two vials. Roughly one a fortnight, for eleven months. The dates are exact and there is not one gap in them.",
    triggerNote:
      "Available after the tin is found. Reads as a dosing schedule. It is a treatment schedule.",
  },
  {
    id: "frag_a4_echo_defends_itself",
    title: "It Defends Itself",
    type: "echo",
    trigger: "place",
    act: 4,
    confidence: 28,
    body: "A clinician, somewhere, explaining patiently that a sequestrant of this class will defend itself: tell the patient plainly what has been taken, and the compound turns the telling into panic.\n\nYou cannot place the room. You cannot place the voice.",
    triggerNote:
      "Seeded quietly. This is the fair-play key to why Jackie cannot simply explain. Doc says the same thing out loud in Act 2.",
  },
  {
    id: "frag_a4_play_the_bibliography",
    title: "Nine Papers",
    type: "playback",
    trigger: "object",
    act: 4,
    confidence: 90,
    chargeCost: 6,
    body: "AUGUR-9 reads a citation list in a flat voice. Nine papers, in order, by year.\n\nThe ninth has no journal beside it. The record says withdrawn, and the record does not say by whom.",
    triggerNote:
      "The bibliography behind the Hall of Weights citation. Sets up the Act 5 link without naming anyone.",
  },
  {
    id: "frag_a4_echo_ask_me_in_a_month",
    title: "Ask Me In A Month",
    type: "echo",
    trigger: "face",
    act: 4,
    confidence: 33,
    body: "Four words, in a room you cannot place, in a voice you can.\n\nYou have heard her say this before today. You have heard her say it before the Grove.",
    triggerNote:
      "TRUE and low confidence, on purpose. She said it to him, eleven years ago, at the door of a facility. The player will file it as a verbal tic.",
  },
  {
    id: "frag_a4_recon_the_hearing",
    title: "Thank You. Wait Outside.",
    type: "reconstruction",
    trigger: "place",
    act: 4,
    confidence: 79,
    body: "A committee room. You present the model. Nobody argues with the arithmetic, which is how you know how bad it is.\n\nThey thank you. They ask you to wait outside while they discuss it. You wait, and the corridor is long and warm, and eventually somebody comes out and tells you it will be handled.\n\nYou remember believing them, which is the part you would like to take back.",
    triggerNote:
      "PARTIAL. Every frame happened. It ends at the door because that is where the material ends, and the reconstructor supplies a polite ending rather than admitting the gap. Nobody came out. Nobody told you anything.",
  },

  // --- Act 5 -------------------------------------------------------------
  {
    id: "frag_a5_play_decimal_place",
    title: "A Decimal Place",
    type: "playback",
    trigger: "object",
    act: 5,
    confidence: 96,
    chargeCost: 6,
    body: "Two voices arguing about a decimal place. One of them is yours. The other one is laughing.\n\nAUGUR-9 offers a name for the second voice and you do not recognise it.",
    triggerNote: "Fires on reading Sorrel's letter.",
  },
  {
    id: "frag_a5_overlay_ashfall",
    title: "The Ashfall Test",
    type: "overlay",
    trigger: "place",
    act: 5,
    confidence: 58,
    body: "A test gantry drawn over the ice. Someone walks into an aperture on purpose, with a bag packed, because the alternative was letting somebody else do it.",
    triggerNote: "Sorrel's camp, on the wall of charcoal notation.",
  },
  {
    id: "frag_a5_play_custodian_roll",
    title: "The Custodian Roll",
    type: "playback",
    trigger: "object",
    act: 5,
    confidence: 93,
    chargeCost: 6,
    body: "A key register, read out by an administrator who is plainly reading it for the last time.\n\nNine keys. Six returned. Three signed out and never signed back in, and one of those three is the thing in your pocket.",
    triggerNote:
      "Card + Custodian Key 3. Confirms the Card is instrumentation the player was ISSUED, not something they found.",
  },
  {
    id: "frag_a5_recon_the_gantry",
    title: "Four Minutes At The Gantry",
    type: "reconstruction",
    trigger: "place",
    act: 5,
    confidence: 72,
    body: "Her charcoal wall gives you the numbers and your own head gives you the rest.\n\nThe Ashfall test gantry. A packed bag, which is the detail that tells you it was not an accident. An argument you were losing before you started, conducted quietly because there were technicians nearby.\n\nShe went in on purpose so that the person who went in would be someone who understood what they were looking at. You said that was a stupid reason. She agreed and went anyway.",
    triggerNote:
      "TRUE. The player reconstructs the last four minutes before Sorrel stepped through. It hurts because it is accurate.",
  },
  {
    id: "frag_a5_echo_the_name",
    title: "The Attending",
    type: "echo",
    trigger: "sound",
    act: 5,
    confidence: 18,
    body: 'Shouted over wind, at a run, on ice that is coming apart. A surname. Three syllables at most. The weather takes most of it.\n\n"—the attending was a man named—"',
    triggerNote:
      "MIX NOTE: audible on headphones at volume; ~10-15% catch rate is the target. Never subtitle this line in full before Act 6.",
    revisedConfidence: 100,
    revisedBody:
      'Cleaned up and played back at full clarity, with nothing added:\n\n"—the attending was a man named Ardan—"\n\nYou were told. You were told two days ago, at a run, on the ice.',
  },
  {
    id: "frag_a5_link_the_recommendation",
    title: "The Recommendation",
    type: "derived",
    trigger: "link",
    act: 5,
    confidence: 87,
    body: "Linked from the charter reading, your ninth paper, and the decimal-place argument.\n\nThe model was yours. The load was cumulative and it was not local. The recommendation was not to regulate. It was to stop.\n\nThey did not kill you for it. That is the part that does not fit yet.",
    triggerNote:
      "First derived fragment. Awarded for correctly linking three entries.",
  },
  {
    id: "frag_a5_link_the_walk",
    title: "The Same Woman",
    type: "derived",
    trigger: "link",
    act: 5,
    confidence: 64,
    body: "Linked from the lamps, the night you came, and the corridor.\n\nThe woman on the Grove road and the woman in the corridor are one person. Same build. Same trained, trailless walk. Same refusal to be seen.\n\nThe link tells you who. It does not tell you which side of the door she was trying to reach, and you should notice that it does not.",
    triggerNote:
      "Second derived fragment, and the chapter's fairest single sentence. Correct deduction, deliberately silent on the thing the player has already decided.",
  },
  {
    id: "frag_a5_link_the_custodian",
    title: "Whose Custodian",
    type: "derived",
    trigger: "link",
    act: 5,
    confidence: 88,
    body: "Linked from the patrol log, the bibliography, and the key register.\n\nThe robot was not wandering. It was assigned. The papers were not read; they were written. The key was not found; it was issued.\n\nYou were not a patient who used to be somebody. You were somebody who was made into a patient.",
    triggerNote:
      "Third derived fragment. This is the one that makes the Act 6 handover a tragedy rather than a mistake: the player already knows this much and gives the ledger away anyway.",
  },

  // --- Act 6 -------------------------------------------------------------
  {
    id: "frag_a6_the_intake_window",
    title: "Fourteen Hours",
    type: "reconstruction",
    trigger: "face",
    act: 6,
    confidence: 100,
    cutsceneId: "ch1-recon-intake",
    body: 'The fourteen hours that were never in his case notes. Recovered whole, in order, at the worst possible moment.\n\nThe room. The consent form you did not sign. The argument, which you lost. The needle. The alarm that was not a fire.\n\nAnd his face, and his voice, exactly as gentle as it has been every single day since:\n\n"I\'m sorry. This is the kind version."',
    triggerNote:
      "The final revision entry. Fires on the word 'Seven' during the handover.",
  },
]);

export const CH1_FRAGMENT_IDS: readonly string[] = Object.freeze(
  CH1_FRAGMENTS.map((f) => f.id)
);

const FRAGMENTS_BY_ID = new Map(CH1_FRAGMENTS.map((f) => [f.id, f]));

export function ch1Fragment(id: string): Ch1FragmentDef | undefined {
  return FRAGMENTS_BY_ID.get(id);
}

export function ch1FragmentsForAct(act: number): readonly Ch1FragmentDef[] {
  return CH1_FRAGMENTS.filter((f) => f.act === act);
}

export function ch1FragmentsWithTrigger(
  trigger: Ch1FragmentTrigger
): readonly Ch1FragmentDef[] {
  return CH1_FRAGMENTS.filter((f) => f.trigger === trigger);
}

// ---------------------------------------------------------------------------
// The Act 6 consolidation sequence
//
// Six entries rewrite themselves in front of the player, in this order, with
// no input accepted. This ordering is dramatic, not chronological: the
// personal betrayal lands before the documentary proof.
// ---------------------------------------------------------------------------

export const CH1_CONSOLIDATION_ORDER: readonly string[] = Object.freeze([
  "frag_a2_overlay_ive_got_you",
  "frag_a3_recon_corridor",
  "frag_a2_recon_arrival",
  "frag_a5_echo_the_name",
  "frag_a1_echo_get_back",
  "frag_a6_the_intake_window",
]);

export const CH1_CONSOLIDATION_ENTRY_SECONDS = 4.5;

export function ch1ConsolidationFragments(): readonly Ch1FragmentDef[] {
  return CH1_CONSOLIDATION_ORDER.map((id) => {
    const frag = FRAGMENTS_BY_ID.get(id);
    if (!frag) {
      throw new Error(`consolidation references unknown fragment: ${id}`);
    }
    return frag;
  });
}

// ---------------------------------------------------------------------------
// Ledger state
// ---------------------------------------------------------------------------

export interface Ch1LedgerEntry {
  fragmentId: string;
  recoveredAtMs: number;
  revised: boolean;
}

export interface Ch1LedgerState {
  entries: Ch1LedgerEntry[];
  /** Correct player-made links, as sorted id pairs. */
  links: Array<readonly [string, string]>;
  linkingUnlocked: boolean;
  consolidated: boolean;
}

export function ch1EmptyLedger(): Ch1LedgerState {
  return {
    entries: [],
    links: [],
    linkingUnlocked: false,
    consolidated: false,
  };
}

export function ch1HasFragment(
  state: Ch1LedgerState,
  fragmentId: string
): boolean {
  return state.entries.some((e) => e.fragmentId === fragmentId);
}

/** Idempotent: recovering a fragment twice is a no-op, never a duplicate row. */
export function ch1RecoverFragment(
  state: Ch1LedgerState,
  fragmentId: string,
  nowMs: number
): Ch1LedgerState {
  if (!FRAGMENTS_BY_ID.has(fragmentId)) {
    throw new Error(`unknown chapter 1 fragment: ${fragmentId}`);
  }
  if (ch1HasFragment(state, fragmentId)) {
    return state;
  }
  return {
    ...state,
    entries: [
      ...state.entries,
      { fragmentId, recoveredAtMs: nowMs, revised: false },
    ],
  };
}

/**
 * Confidence is hidden until Act 5 linking is unlocked. Before that the ledger
 * is a flat, newest-first, deliberately unhelpful list — it mirrors the
 * player's state.
 */
export function ch1VisibleConfidence(
  state: Ch1LedgerState,
  fragmentId: string
): number | undefined {
  if (!state.linkingUnlocked) {
    return undefined;
  }
  const frag = FRAGMENTS_BY_ID.get(fragmentId);
  if (!frag) {
    return undefined;
  }
  const entry = state.entries.find((e) => e.fragmentId === fragmentId);
  if (entry?.revised && frag.revisedConfidence !== undefined) {
    return frag.revisedConfidence;
  }
  return frag.confidence;
}

export function ch1VisibleBody(
  state: Ch1LedgerState,
  fragmentId: string
): string | undefined {
  const frag = FRAGMENTS_BY_ID.get(fragmentId);
  if (!frag) {
    return undefined;
  }
  const entry = state.entries.find((e) => e.fragmentId === fragmentId);
  if (entry?.revised && frag.revisedBody !== undefined) {
    return frag.revisedBody;
  }
  return frag.body;
}

/** Newest first. Deliberate: the ledger never helps the player order anything. */
export function ch1LedgerDisplayOrder(
  state: Ch1LedgerState
): readonly Ch1LedgerEntry[] {
  return [...state.entries].sort((a, b) => b.recoveredAtMs - a.recoveredAtMs);
}

// ---------------------------------------------------------------------------
// Linking (Act 5)
// ---------------------------------------------------------------------------

export interface Ch1LinkRecipe {
  /** Sorted source fragment ids. */
  sources: readonly string[];
  /** The derived fragment awarded when the link is made. */
  derives: string;
  xp: number;
}

export const CH1_LINK_RECIPES: readonly Ch1LinkRecipe[] = Object.freeze([
  {
    sources: [
      "frag_a2_play_the_ninth_signature",
      "frag_a3_play_ninth_paper",
      "frag_a5_play_decimal_place",
    ],
    derives: "frag_a5_link_the_recommendation",
    xp: 250,
  },
  {
    // Two reconstructions plus the echo that dates them. The deduction is
    // correct and says nothing about intent, which is the whole trick.
    sources: [
      "frag_a2_echo_lamps_out",
      "frag_a2_recon_arrival",
      "frag_a3_recon_corridor",
    ],
    derives: "frag_a5_link_the_walk",
    xp: 200,
  },
  {
    // Three playbacks. Playbacks never lie, so this link is unimpeachable —
    // and it is still not enough to point at the right person.
    sources: [
      "frag_a1_play_patrol_loop",
      "frag_a4_play_the_bibliography",
      "frag_a5_play_custodian_roll",
    ],
    derives: "frag_a5_link_the_custodian",
    xp: 300,
  },
]);

/**
 * Every recipe whose sources the player already holds. The Act 5 screen offers
 * these as buildable timelines; a recipe whose derived fragment is already in
 * the ledger is not offered again.
 */
export function ch1AvailableLinkRecipes(
  state: Ch1LedgerState
): readonly Ch1LinkRecipe[] {
  if (!state.linkingUnlocked) {
    return [];
  }
  const held = new Set(state.entries.map((entry) => entry.fragmentId));
  return CH1_LINK_RECIPES.filter(
    (recipe) =>
      !held.has(recipe.derives) &&
      recipe.sources.every((fragmentId) => held.has(fragmentId))
  );
}

export function ch1LinkRecipeFor(
  fragmentIds: readonly string[]
): Ch1LinkRecipe | undefined {
  const key = [...fragmentIds].sort().join("|");
  return CH1_LINK_RECIPES.find((r) => [...r.sources].sort().join("|") === key);
}

// ---------------------------------------------------------------------------
// Delivery gating
// ---------------------------------------------------------------------------

/**
 * Fragment delivery is a pacing instrument. It goes to ZERO for the back half
 * of Act 4 — the moment the player stops taking the tea, the ledger goes
 * quiet, and they have to work out why themselves. See journal §12.
 */
export function ch1FragmentDeliveryEnabled(
  flags: ReadonlySet<string> | readonly string[]
): boolean {
  const set = flags instanceof Set ? flags : new Set(flags);
  if (!set.has(CH1_FLAGS.started)) {
    return false;
  }
  if (set.has(CH1_FLAGS.dosingStopped) && !set.has(CH1_FLAGS.dosingResumed)) {
    return false;
  }
  return true;
}

/** Applies the Act 6 consolidation to a ledger. Idempotent. */
export function ch1ApplyConsolidation(state: Ch1LedgerState): Ch1LedgerState {
  if (state.consolidated) {
    return state;
  }
  const revisedIds = new Set(CH1_CONSOLIDATION_ORDER);
  const entries = state.entries.map((e) =>
    revisedIds.has(e.fragmentId) ? { ...e, revised: true } : e
  );
  // The intake window is recovered *by* the consolidation, not before it.
  const intake = "frag_a6_the_intake_window";
  if (!entries.some((e) => e.fragmentId === intake)) {
    const latest = entries.reduce((m, e) => Math.max(m, e.recoveredAtMs), 0);
    entries.push({
      fragmentId: intake,
      recoveredAtMs: latest + 1,
      revised: true,
    });
  }
  return { ...state, entries, consolidated: true };
}
