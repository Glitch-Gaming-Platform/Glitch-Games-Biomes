// CHAPTER_1_LATENT_SKILLS
//
// "Recognition before recall": the player's hands know things their head does
// not. Latent skills are the Act 4 power fantasy and they are deliberately
// placed in the act where the player's judgement is at its worst.
//
// DESIGN CONTRACT:
//  1. Latent skills are NOT earned with XP and are NOT on a tree. They unlock
//     from recognition triggers and arrive ALREADY MASTERED — full expertise
//     UI, no tutorial, no practice curve.
//  2. Every skill ships with an explanation-failure line set. The player can
//     never explain any of them to an NPC. This is the whole joke and the
//     whole tragedy.
//  3. The Ashline containment sequence CANNOT BE FAILED. On timeout the
//     player's hands finish it and the player watches. That is the point.
//
// See docs/harthmere/CHAPTER_1_IDENTITY_WRITERS_JOURNAL.md §7 (Act 4).

export const CH1_LATENT_SKILLS_VERSION = 1 as const;

export const CH1_LATENT_SKILL_IDS = [
  "ls_containment_triage",
  "ls_anchor_read",
  "ls_field_calibration",
  "ls_gate_timing",
] as const;
export type Ch1LatentSkillId = (typeof CH1_LATENT_SKILL_IDS)[number];

export interface Ch1LatentSkillDef {
  id: Ch1LatentSkillId;
  name: string;
  /** Always this. The tooltip never explains, because the player cannot. */
  tooltip: string;
  description: string;
  /** Designer-readable unlock condition. */
  unlockedBy: string;
  /** The quest that grants it. */
  questId: string;
  act: number;
  /**
   * Dialogue options offered when an NPC asks the player how they did it.
   * ALL of them are "I don't know". This is enforced by test.
   */
  explanationFailures: readonly string[];
}

const CANNOT_EXPLAIN = "You know how to do this.";

export const CH1_LATENT_SKILLS: readonly Ch1LatentSkillDef[] = Object.freeze([
  {
    id: "ls_anchor_read",
    name: "Anchor Read",
    tooltip: CANNOT_EXPLAIN,
    description:
      "You can see where the ground is carrying a load it was never built for. It shows up as a stress overlay on the world, and it has always been there, and you have simply started noticing.",
    unlockedBy:
      "Correcting Sil's song stones at Mosslawn — flat by half a tone for a year, because of what is under them.",
    questId: "ch1_a4_q01_the_stones_are_flat",
    act: 4,
    explanationFailures: [
      "I don't know. I heard it and I knew.",
      "I couldn't tell you. I'm sorry.",
      "Ask me something I can answer.",
      "...I don't know.",
    ],
  },
  {
    id: "ls_containment_triage",
    name: "Containment Triage",
    tooltip: CANNOT_EXPLAIN,
    description:
      "You can read an Exotic Matter containment fault and stabilise it. Not carefully. Quickly. The interface is labelled in a notation nobody at the works uses and you never have to look twice.",
    unlockedBy:
      "The runaway core at Ashline Containment Works. Thirty-one seconds.",
    questId: "ch1_a4_q02_thirty_one_seconds",
    act: 4,
    explanationFailures: [
      "I don't know how I did that.",
      "I was going to ask you the same thing.",
      "It was just — there. In my hands.",
      "I don't know. I don't know. I'm sorry.",
    ],
  },
  {
    id: "ls_field_calibration",
    name: "Field Calibration",
    tooltip: CANNOT_EXPLAIN,
    description:
      "Comparative measurement against a local reference, because you do not trust a single absolute instrument built after the anchors went up. You cannot yet say why you don't trust them.",
    unlockedBy: "The Hall of Weights, in a room two thousand years older than the problem.",
    questId: "ch1_a3_d1_hall_of_weights",
    act: 3,
    explanationFailures: [
      "I don't know. It's just how you'd do it.",
      "Doesn't everyone check things against each other?",
      "I can't explain it. It isn't clever, it's just correct.",
      "I don't know.",
    ],
  },
  {
    id: "ls_gate_timing",
    name: "Gate Timing",
    tooltip: CANNOT_EXPLAIN,
    description:
      "You can call a Fracture Gate's collapse window to within about twenty seconds. Harthmere has been trying to do this for two years with instruments and prayer.",
    unlockedBy:
      "Calling a collapse to the second in front of Halden Rook, at the bridge.",
    questId: "ch1_a4_q03_what_the_devils_know",
    act: 4,
    explanationFailures: [
      "I don't know how I knew that.",
      "I'd rather not have been right.",
      "I can't teach you. I would if I could.",
      "I don't know.",
    ],
  },
]);

const SKILLS_BY_ID = new Map(CH1_LATENT_SKILLS.map((s) => [s.id, s]));

export function ch1LatentSkill(
  id: Ch1LatentSkillId
): Ch1LatentSkillDef | undefined {
  return SKILLS_BY_ID.get(id);
}

export function ch1LatentSkillsForAct(
  act: number
): readonly Ch1LatentSkillDef[] {
  return CH1_LATENT_SKILLS.filter((s) => s.act === act);
}

// ---------------------------------------------------------------------------
// The Ashline containment sequence
// ---------------------------------------------------------------------------

export interface Ch1ContainmentStage {
  id: string;
  /** Expert-UI label. Deliberately unglossed — the UI *is* the knowledge. */
  label: string;
  /** Seconds of the 45s budget this stage nominally consumes. */
  nominalSeconds: number;
}

export const CH1_CONTAINMENT_TIMER_SECONDS = 45;

/**
 * The player completes this in ~31 seconds. Calla Ashe has forty seconds of
 * procedure and needs four minutes.
 */
export const CH1_CONTAINMENT_STAGES: readonly Ch1ContainmentStage[] =
  Object.freeze([
    {
      id: "vent_the_secondary",
      label: "Vent secondary — hold to 0.4 and stop",
      nominalSeconds: 7,
    },
    {
      id: "invert_the_lattice",
      label: "Invert lattice phase — third ring, not the second",
      nominalSeconds: 9,
    },
    {
      id: "bleed_the_anchor",
      label: "Bleed anchor pressure across the intake, not the stack",
      nominalSeconds: 8,
    },
    {
      id: "reseat",
      label: "Reseat and walk away before it finishes settling",
      nominalSeconds: 7,
    },
  ]);

/**
 * There is no fail state. On timeout the player's hands complete the
 * procedure automatically and the player watches themselves do it.
 */
export const CH1_CONTAINMENT_CAN_FAIL = false;

export function ch1ContainmentNominalSeconds(): number {
  return CH1_CONTAINMENT_STAGES.reduce((n, s) => n + s.nominalSeconds, 0);
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface Ch1LatentSkillState {
  unlocked: Ch1LatentSkillId[];
}

export function ch1EmptyLatentSkills(): Ch1LatentSkillState {
  return { unlocked: [] };
}

export function ch1UnlockLatentSkill(
  state: Ch1LatentSkillState,
  id: Ch1LatentSkillId
): Ch1LatentSkillState {
  if (!SKILLS_BY_ID.has(id)) {
    throw new Error(`unknown chapter 1 latent skill: ${id}`);
  }
  if (state.unlocked.includes(id)) {
    return state;
  }
  return { unlocked: [...state.unlocked, id] };
}

export function ch1HasLatentSkill(
  state: Ch1LatentSkillState,
  id: Ch1LatentSkillId
): boolean {
  return state.unlocked.includes(id);
}
