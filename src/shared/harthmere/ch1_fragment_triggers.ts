// CHAPTER_1_AMBIENT_FRAGMENT_TRIGGERS
//
// The seven trigger classes in the writer's journal (§4.4) were metadata for
// most of Chapter 1's first pass: every fragment actually arrived because a
// quest step completed. That made the ledger a quest reward list rather than a
// memory system, and it made two authored fragments unreachable.
//
// This module is the authored table for the fragments that must arrive OUTSIDE
// the quest chain — standing somewhere, sleeping somewhere, hearing something,
// holding something, seeing a face, doing something your hands know, or nearly
// dying. Delivery is validated SERVER-SIDE against the real player position,
// real inventory, real health, and real story flags. The client only reports
// "I think this trigger fired"; it never decides that one did.
//
// DESIGN RULES
//  1. A trigger may only deliver a fragment whose act the player has reached.
//     A place trigger cannot hand an Act 5 memory to an Act 2 player who
//     wandered too far.
//  2. Trigger delivery obeys ch1FragmentDeliveryEnabled(). The ledger is silent
//     for the back half of Act 4 and that silence is a pacing instrument.
//  3. Nothing here is a quest. Missing every ambient fragment must never block
//     progression, and the linking recipes that consume them are optional.
//  4. Truth never appears in this file. See ch1_fragment_authority.ts.

import {
  CH1_ANCHORS,
  CH1_FLAGS,
  type Ch1AnchorKey,
  type Ch1Vec3,
} from "@/shared/harthmere/ch1_ids";
import {
  ch1Fragment,
  ch1FragmentDeliveryEnabled,
  type Ch1FragmentTrigger,
} from "@/shared/harthmere/ch1_fragment_ledger";
import type { Ch1LatentSkillId } from "@/shared/harthmere/ch1_latent_skills";
import { ch1CurrentAct } from "@/shared/harthmere/ch1_chapter";

export const CH1_FRAGMENT_TRIGGERS_VERSION = 1 as const;

/** Trigger classes that a client is allowed to report at all. */
export const CH1_AMBIENT_TRIGGER_KINDS = [
  "object",
  "place",
  "sound",
  "face",
  "skill",
  "stress",
  "sleep",
] as const;
export type Ch1AmbientTriggerKind = (typeof CH1_AMBIENT_TRIGGER_KINDS)[number];

export interface Ch1AmbientFragmentTrigger {
  fragmentId: string;
  kind: Ch1AmbientTriggerKind;
  /**
   * World anchors the player may be standing near. Any one of them satisfies
   * the trigger; several memories are keyed to more than one place because the
   * Grove has more than one bed and more than one lamp route.
   */
  anchors?: readonly Ch1AnchorKey[];
  /** Metres. Generous: this is atmosphere, not a precision puzzle. */
  radius?: number;
  /** Every one of these story flags must be set. */
  requiresFlags?: readonly string[];
  /** Any one of these blocks delivery. */
  blockedByFlags?: readonly string[];
  /** Must be carrying this Chapter 1 item. */
  requiresItemId?: string;
  /** Must have unlocked this latent skill. */
  requiresLatentSkillId?: Ch1LatentSkillId;
  /**
   * Stress triggers only. Health at or below this fraction of maximum. The
   * journal's number is 15%.
   */
  maxHealthFraction?: number;
  /** Writer-facing. Never shipped. */
  note: string;
}

export const CH1_STRESS_HEALTH_FRACTION = 0.15;

/**
 * Default radius for a place/sound trigger. Wide enough that a player walking
 * a road catches it, tight enough that it belongs to one location.
 */
export const CH1_AMBIENT_TRIGGER_RADIUS = 14;

export const CH1_AMBIENT_FRAGMENT_TRIGGERS: readonly Ch1AmbientFragmentTrigger[] =
  Object.freeze([
    // --- Sleep -----------------------------------------------------------
    {
      fragmentId: "frag_a1_echo_the_kettle",
      kind: "sleep",
      anchors: ["jackie_post", "lanternrest_road_inn"],
      radius: 22,
      requiresFlags: [CH1_FLAGS.started],
      note: "The road-house bed. The first fragment the player receives for doing nothing at all.",
    },

    // --- Face ------------------------------------------------------------
    {
      fragmentId: "frag_a4_echo_ask_me_in_a_month",
      kind: "face",
      anchors: ["jackie_post", "grove_watch_house"],
      radius: 12,
      requiresFlags: [CH1_FLAGS.metLou],
      note: "Her face, in the Grove or through the watch-house bars. She has said this before and the player will file it as a verbal tic.",
    },

    // --- Place -----------------------------------------------------------
    {
      fragmentId: "frag_a2_echo_lamps_out",
      kind: "place",
      anchors: ["old_grove_road_post"],
      requiresFlags: [CH1_FLAGS.started],
      note: "Helsa's lamp route. Previously authored and unreachable — no quest step referenced it.",
    },
    {
      fragmentId: "frag_a2_overlay_the_cove_glass",
      kind: "place",
      anchors: ["shutter_cove_photo_marker"],
      requiresFlags: [CH1_FLAGS.started],
      requiresItemId: "item_grey_card",
      note: "Card-in-hand at the cove. The Card is undroppable, so the item requirement is atmosphere rather than a lock.",
    },
    {
      fragmentId: "frag_a4_recon_the_hearing",
      kind: "place",
      anchors: ["returnstone_pad_office"],
      radius: 20,
      requiresFlags: [CH1_FLAGS.act3Complete],
      note: "Collective architecture triggers a committee room. Partial: it ends at the door because the material does.",
    },
    {
      fragmentId: "frag_a3_recon_the_evacuation",
      kind: "place",
      anchors: ["gate_desert"],
      radius: 24,
      requiresFlags: [CH1_FLAGS.hasFirstGrain],
      note: "Delivered on the way back out of the desert, or on any later visit to the Dry Mouth.",
    },
    {
      fragmentId: "frag_a5_recon_the_gantry",
      kind: "place",
      anchors: ["gate_winter"],
      radius: 24,
      requiresFlags: [CH1_FLAGS.hasLedger],
      note: "The Ashfall reconstruction, keyed to the cold gate rather than to a quest step so a player who never lingers never gets it.",
    },

    // --- Sound -----------------------------------------------------------
    {
      fragmentId: "frag_a3_echo_cold_to_stand_next_to",
      kind: "sound",
      anchors: ["mosslawn_song_stones"],
      requiresFlags: [CH1_FLAGS.irisRescued],
      note: "Iris repeats it at the song stones once she is a Grove resident. Also delivered by the Seed Vault quest step; recovery is idempotent.",
    },

    // --- Object ----------------------------------------------------------
    {
      fragmentId: "frag_a5_play_custodian_roll",
      kind: "object",
      requiresFlags: [CH1_FLAGS.act5Linking],
      requiresItemId: "item_custodian_key_3",
      note: "Two keys held together. A playback, so it lands in availablePlaybackIds and still costs AUGUR-9 charge to hear.",
    },
    {
      fragmentId: "frag_a4_play_the_bibliography",
      kind: "object",
      requiresFlags: [CH1_FLAGS.metLou],
      requiresItemId: "item_lou_case_notes",
      note: "Reading the case notes near AUGUR-9 makes it volunteer the citation list nobody asked for.",
    },
    {
      fragmentId: "frag_a1_play_patrol_loop",
      kind: "object",
      requiresFlags: [CH1_FLAGS.started],
      note: "AUGUR-9's own record. Available from the moment the chassis walks.",
    },

    // --- Skill -----------------------------------------------------------
    {
      fragmentId: "frag_a3_overlay_the_balance",
      kind: "skill",
      requiresLatentSkillId: "ls_field_calibration",
      note: "Fires the first time the Hall of Weights procedure is used anywhere, including outside the dungeon.",
    },

    // --- Stress ----------------------------------------------------------
    {
      fragmentId: "frag_a1_echo_get_back",
      kind: "stress",
      maxHealthFraction: CH1_STRESS_HEALTH_FRACTION,
      requiresFlags: [CH1_FLAGS.started],
      note: "The journal's stress channel: below 15% health. Also delivered by the Act 1 fence-line close, whichever happens first.",
    },
  ]);

const TRIGGERS_BY_FRAGMENT = new Map(
  CH1_AMBIENT_FRAGMENT_TRIGGERS.map((entry) => [entry.fragmentId, entry])
);

export function ch1AmbientTrigger(
  fragmentId: string
): Ch1AmbientFragmentTrigger | undefined {
  return TRIGGERS_BY_FRAGMENT.get(fragmentId);
}

export function ch1AmbientTriggersOfKind(
  kind: Ch1AmbientTriggerKind
): readonly Ch1AmbientFragmentTrigger[] {
  return CH1_AMBIENT_FRAGMENT_TRIGGERS.filter((entry) => entry.kind === kind);
}

export interface Ch1AmbientTriggerContext {
  position?: Ch1Vec3;
  flags: readonly string[];
  itemIds: readonly string[];
  latentSkillIds: readonly string[];
  /** current / maximum, 0..1. Undefined when health is not synchronized. */
  healthFraction?: number;
  /** Fragments already in the ledger. */
  recoveredFragmentIds: readonly string[];
  /** Playbacks already offered by AUGUR-9. */
  availablePlaybackIds: readonly string[];
}

export type Ch1AmbientTriggerEvaluation =
  | { ok: true; trigger: Ch1AmbientFragmentTrigger; alreadyHeld: boolean }
  | { ok: false; reason: string };

function distance3(a: Ch1Vec3, b: Ch1Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/**
 * The whole validation. Called only from server code holding real state; the
 * client's report of "kind" is used to pick the authored row and nothing else.
 */
export function ch1EvaluateAmbientTrigger(args: {
  fragmentId: string;
  kind: Ch1AmbientTriggerKind;
  context: Ch1AmbientTriggerContext;
}): Ch1AmbientTriggerEvaluation {
  const trigger = TRIGGERS_BY_FRAGMENT.get(args.fragmentId);
  if (!trigger) {
    return { ok: false, reason: "That memory has no ambient trigger." };
  }
  if (trigger.kind !== args.kind) {
    return {
      ok: false,
      reason: `That memory is not recovered by ${args.kind}.`,
    };
  }
  const fragment = ch1Fragment(args.fragmentId);
  if (!fragment) {
    return { ok: false, reason: "Unknown Chapter 1 fragment." };
  }

  const flags = new Set(args.context.flags);
  if (!flags.has(CH1_FLAGS.started)) {
    return { ok: false, reason: "Chapter 1 has not started." };
  }
  if (ch1CurrentAct(args.context.flags) < fragment.act) {
    return { ok: false, reason: "That memory belongs to a later act." };
  }
  for (const flag of trigger.requiresFlags ?? []) {
    if (!flags.has(flag)) {
      return { ok: false, reason: "Nothing here means anything yet." };
    }
  }
  for (const flag of trigger.blockedByFlags ?? []) {
    if (flags.has(flag)) {
      return { ok: false, reason: "That moment has already passed." };
    }
  }
  if (!ch1FragmentDeliveryEnabled(args.context.flags)) {
    // The deliberate Act 4 silence. Not an error the player should see as one.
    return { ok: false, reason: "Nothing comes back." };
  }

  if (
    trigger.requiresItemId &&
    !args.context.itemIds.includes(trigger.requiresItemId)
  ) {
    return { ok: false, reason: "You are not carrying what this needs." };
  }
  if (
    trigger.requiresLatentSkillId &&
    !args.context.latentSkillIds.includes(trigger.requiresLatentSkillId)
  ) {
    return { ok: false, reason: "Your hands do not know this yet." };
  }
  if (trigger.anchors && trigger.anchors.length > 0) {
    const position = args.context.position;
    if (!position) {
      return { ok: false, reason: "Your position is not synchronized yet." };
    }
    const radius = trigger.radius ?? CH1_AMBIENT_TRIGGER_RADIUS;
    const near = trigger.anchors.some(
      (anchor) => distance3(position, CH1_ANCHORS[anchor]) <= radius
    );
    if (!near) {
      return { ok: false, reason: "You are not standing where this happened." };
    }
  }
  if (trigger.kind === "stress") {
    const fraction = args.context.healthFraction;
    const threshold = trigger.maxHealthFraction ?? CH1_STRESS_HEALTH_FRACTION;
    if (fraction === undefined || fraction > threshold) {
      return { ok: false, reason: "You are not in enough trouble for this." };
    }
  }

  const alreadyHeld =
    fragment.type === "playback"
      ? args.context.availablePlaybackIds.includes(args.fragmentId)
      : args.context.recoveredFragmentIds.includes(args.fragmentId);
  return { ok: true, trigger, alreadyHeld };
}

/**
 * Structural validation, run by test. Every ambient trigger must reference a
 * real fragment, must not claim a trigger class the fragment does not declare,
 * and must not be reachable before the act that authors it.
 */
export function ch1ValidateAmbientTriggers(): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const trigger of CH1_AMBIENT_FRAGMENT_TRIGGERS) {
    if (seen.has(trigger.fragmentId)) {
      errors.push(`${trigger.fragmentId}: more than one ambient trigger`);
    }
    seen.add(trigger.fragmentId);
    const fragment = ch1Fragment(trigger.fragmentId);
    if (!fragment) {
      errors.push(`${trigger.fragmentId}: no such fragment`);
      continue;
    }
    if ((fragment.trigger as Ch1FragmentTrigger) !== trigger.kind) {
      errors.push(
        `${trigger.fragmentId}: catalog says trigger "${fragment.trigger}" but ` +
          `the ambient table delivers it by "${trigger.kind}"`
      );
    }
    if (trigger.kind === "stress" && trigger.maxHealthFraction === undefined) {
      errors.push(`${trigger.fragmentId}: stress trigger needs a health bound`);
    }
    for (const anchor of trigger.anchors ?? []) {
      if (!(anchor in CH1_ANCHORS)) {
        errors.push(`${trigger.fragmentId}: unknown anchor ${anchor}`);
      }
    }
    // Later-act memories must be locked behind something the player can only
    // have earned. A flag, a plot item, or a latent skill all qualify; a bare
    // place check does not, because places are walkable from act 1.
    const gated =
      (trigger.requiresFlags ?? []).length > 0 ||
      trigger.requiresItemId !== undefined ||
      trigger.requiresLatentSkillId !== undefined;
    if (fragment.act >= 3 && !gated) {
      errors.push(
        `${trigger.fragmentId}: an act-${fragment.act} fragment must be gated ` +
          `by a flag, plot item, or latent skill, or a wandering act-1 player ` +
          `can walk into it`
      );
    }
  }
  return errors;
}
