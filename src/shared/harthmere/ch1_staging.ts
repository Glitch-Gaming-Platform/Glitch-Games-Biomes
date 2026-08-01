// CHAPTER_1_STAGING
//
// Where the cast is standing, as a function of the story.
//
// THE CONSTRAINT THAT SHAPES THIS FILE: Biomes is an MMO, Chapter 1 story state
// is per-player ("your story, their world", ch1_party.ts), and the ECS NPC set
// is shared. So staging CANNOT be "move the ECS entity when a flag flips" —
// that would drag Rook off the bridge for every other player in the world the
// moment one player finished Act 3, and it would fight Anima for authority over
// entity position (ch1_engine_contracts.ts forbids that outright).
//
// Instead this module is the authored STAGE DIRECTION table. It answers, for
// one requesting player's own flags:
//
//     "where should each Chapter 1 character be, and are they here at all?"
//
// The server projects that per player. The seeded ECS body stays where the shim
// put it and Anima keeps owning it; a character whose staged position differs
// from their seeded body is rendered as a client-side chapter puppet at the
// staged position (the same mechanism the cutscene director already uses), and
// a character staged `present: false` is simply not drawn for that player.
//
// This is what closes the audit's "NPCs never move with the story" gap without
// breaking either the shared world or the engine ownership contract.

import { CH1_NEW_CAST } from "@/shared/harthmere/ch1_cast";
import {
  CH1_ANCHORS,
  CH1_ENDINGS,
  CH1_FLAGS,
  type Ch1AnchorKey,
  type Ch1Ending,
  type Ch1NpcKey,
  type Ch1Vec3,
} from "@/shared/harthmere/ch1_ids";

export const CH1_STAGING_VERSION = 1 as const;

/** Somewhere a staged character can be, other than a Grove anchor. */
export type Ch1StagePlace =
  | { kind: "anchor"; anchor: Ch1AnchorKey }
  /** Inside authored dungeon terrain; the seeded body is already correct. */
  | { kind: "seeded" }
  /** Not in the world for this player at all. */
  | { kind: "absent" };

export interface Ch1StageDirection {
  /** All of these flags must be set for the direction to apply. */
  whenAllFlags?: readonly string[];
  /** None of these may be set. */
  whenNoFlags?: readonly string[];
  /** Restrict to one ending. */
  whenEnding?: Ch1Ending;
  /** Restrict to one Hallr outcome. */
  whenHallrChoice?: "let_run" | "hold_stall";
  /** Restrict to one of the currently active authored objective ids. */
  whenActiveStepIds?: readonly string[];
  place: Ch1StagePlace;
  /**
   * Player-facing name at this point in the story. Used so AUGUR-9 can be the
   * Mucked Robot until the chapter starts without needing two ECS bodies.
   */
  presentAs?: string;
  /** One line the character is doing here. Shipped; keep it plain. */
  activity: string;
  /** Writer-facing. Never shipped. */
  note?: string;
}

/**
 * Ordered per character, general to specific. THE LAST MATCHING DIRECTION WINS,
 * so a file reads top-to-bottom as the character's arc.
 */
export const CH1_STAGE_DIRECTIONS: Readonly<
  Record<Ch1NpcKey, readonly Ch1StageDirection[]>
> = Object.freeze({
  augur9: [
    {
      place: { kind: "seeded" },
      presentAs: "Mucked Robot",
      activity: "Walking an obsolete service route through the muck edge.",
      note: "Before ch1_started this is exactly the prologue prop, under its prologue name. Same entity. No second robot.",
    },
    {
      whenAllFlags: [CH1_FLAGS.started],
      place: { kind: "seeded" },
      presentAs: "AUGUR-9",
      activity: "Following you, and calling you Custodian, and not stopping.",
      note: "THE RETCON, done by renaming the presentation rather than spawning a duplicate.",
    },
  ],

  lou_ardan: [
    {
      place: { kind: "absent" },
      activity: "—",
      note: "Lou is not in the Grove until the clinic invites a visiting specialist.",
    },
    {
      whenActiveStepIds: ["the_examination"],
      place: { kind: "anchor", anchor: "greenlamp_clinic" },
      activity: "Preparing the clean room for an examination.",
    },
    {
      whenAllFlags: [CH1_FLAGS.metLou],
      place: { kind: "anchor", anchor: "greenlamp_clinic" },
      activity: "Consulting on the Grove's memory-sickness cases.",
    },
    {
      whenAllFlags: [CH1_FLAGS.act5Complete],
      place: { kind: "anchor", anchor: "returnstone_pad_office" },
      activity: "Waiting beside a Collective medical transport. Unhurried.",
      note: "The transport has been parked here since the day after Ashline. He does not mention that.",
    },
    {
      whenAllFlags: [CH1_FLAGS.ledgerSurrendered],
      place: { kind: "absent" },
      activity: "—",
      note: "He leaves. Nobody runs. There is no chase in this chapter.",
    },
    {
      whenActiveStepIds: [
        "give_the_ledger",
        "give_her_location",
        "the_word",
        "watch_him_go",
      ],
      place: { kind: "anchor", anchor: "returnstone_pad_office" },
      activity:
        "Standing beside the Collective transport, waiting without hurry.",
    },
  ],

  cressa_vane: [
    {
      place: { kind: "absent" },
      activity: "—",
    },
    {
      whenAllFlags: [CH1_FLAGS.gatePersistentOpen],
      place: { kind: "anchor", anchor: "returnstone_pad_office" },
      activity:
        "Presenting the cost of every option, in numbers, without threatening anyone.",
    },
    {
      whenAllFlags: [CH1_FLAGS.ledgerSurrendered],
      whenNoFlags: [CH1_FLAGS.complete],
      place: { kind: "anchor", anchor: "returnstone_pad_office" },
      activity: "Signing for the ledger.",
    },
    {
      whenEnding: "bargain",
      place: { kind: "anchor", anchor: "returnstone_pad_office" },
      activity:
        "Holding a credential, a lab assignment, and a seat at the table.",
    },
  ],

  halden_rook: [
    {
      place: { kind: "anchor", anchor: "harthmere_bridge_center" },
      activity: "Holding a bridge that does not open in this chapter.",
    },
    // ROOK RETURNS TO THE BRIDGE BETWEEN HIS BEATS.
    //
    // These two directions used to have no end condition, so once
    // `gatePersistentOpen` was set at the close of Act 2 Rook stood at the Old
    // Wood aperture for the WHOLE of Acts 3 and 4, and once `act4Complete` was
    // set he stood at the Cold Gate for the whole of Acts 5 and 6 — including
    // the Grove finale. A staging sweep found him parked on a Mouth for 55 of
    // the chapter's 80 objectives.
    //
    // That is wrong on its own (he is a Harthmere gate-warden, not a fixture),
    // and it is also what made the gate/story prompt collision so pervasive:
    // any objective that took the player near either aperture found Rook there
    // with an enterable Mouth underneath him.
    {
      whenAllFlags: [CH1_FLAGS.gatePersistentOpen],
      whenNoFlags: [CH1_FLAGS.act3Complete],
      place: { kind: "anchor", anchor: "gate_desert" },
      activity:
        "Standing at the treeline looking at footprints, waiting for someone to say the obvious sentence.",
      note: "He crossed a bridge he is not supposed to cross. That is the measure of how bad the footprints are.",
    },
    {
      whenAllFlags: [CH1_FLAGS.act3Complete],
      whenNoFlags: [CH1_FLAGS.act4Complete],
      place: { kind: "anchor", anchor: "harthmere_bridge_center" },
      activity:
        "Back at the bridge, and noticeably less certain about which side of it is the dangerous one.",
    },
    {
      whenAllFlags: [CH1_FLAGS.act4Complete],
      whenNoFlags: [CH1_FLAGS.act5Complete],
      place: { kind: "anchor", anchor: "gate_winter" },
      activity:
        "Holding the near side with a coil of Harthmere rope and no explanation.",
      note: "He will not go in. A Mouth with nobody watching it is how towns end.",
    },
    {
      whenAllFlags: [CH1_FLAGS.act5Complete],
      place: { kind: "anchor", anchor: "harthmere_bridge_center" },
      activity: "Back at the bridge, having held a Mouth for two days.",
    },
    // Per-beat directions come last so they win over the act-level placements
    // above. These are the moments the scene genuinely happens at an aperture.
    {
      whenActiveStepIds: ["the_footprints", "say_the_sentence"],
      place: { kind: "anchor", anchor: "gate_desert" },
      activity:
        "Holding the treeline and waiting for the answer nobody wants to say aloud.",
    },
    {
      whenActiveStepIds: ["the_three_answers"],
      place: { kind: "anchor", anchor: "gate_desert" },
      activity: "Arguing, calmly, that the thing should be collapsed.",
    },
    {
      // "You do it to the second, in front of him" only works at a Mouth he can
      // watch close. Act 4 otherwise has him back at the bridge.
      whenActiveStepIds: ["call_the_collapse", "take_the_token"],
      place: { kind: "anchor", anchor: "gate_desert" },
      activity:
        "Watching an aperture he has failed to predict for two years, and timing it against you.",
    },
    {
      whenActiveStepIds: ["rooks_rope"],
      place: { kind: "anchor", anchor: "gate_winter" },
      activity: "Holding the near side with a coil of Harthmere rope.",
    },
    {
      // Act 5 closes in the Grove: Rook has come across to see Sorrel out.
      whenActiveStepIds: ["come_out"],
      place: { kind: "anchor", anchor: "grove_watch_house" },
      activity:
        "In the Grove, looking at a woman in a coat he recognises from before.",
    },
    {
      whenAllFlags: [CH1_FLAGS.complete],
      place: { kind: "anchor", anchor: "harthmere_bridge_center" },
      activity:
        "Back at the bridge. Proved right, and enjoying it less than he expected.",
    },
    {
      whenEnding: "confess",
      place: { kind: "anchor", anchor: "harthmere_bridge_center" },
      activity: "Standing beside an open gate for the first time in two years.",
      note: "Confess is the only ending where Rook opens a door.",
    },
  ],

  nadia_sorrel: [
    {
      place: { kind: "seeded" },
      activity:
        "Behind a barred door in a fjord that has had the same winter nine times.",
    },
    {
      whenAllFlags: [CH1_FLAGS.act5Complete],
      place: { kind: "anchor", anchor: "greenlamp_clinic" },
      activity: "In Doc's care, arguing with him about her own chart.",
      note: "One scene of Grove-side Sorrel, deliberately short. She must not be alone with the player for long before the handover.",
    },
    {
      whenAllFlags: [CH1_FLAGS.ledgerSurrendered],
      place: { kind: "absent" },
      activity: "—",
      note: "Collected two hours later, for her own safety. She goes without a struggle because she is not stupid either.",
    },
  ],

  iris_fen: [
    {
      place: { kind: "seeded" },
      activity:
        "Living in a granary that has decided a child is worth preserving.",
    },
    {
      whenAllFlags: [CH1_FLAGS.irisRescued],
      place: { kind: "anchor", anchor: "lovely_locks_mirror" },
      activity:
        "A Grove resident now. Entirely calm, which is still the disturbing part.",
    },
  ],

  marrow: [
    {
      place: { kind: "seeded" },
      activity: "Following Iris. Unkillable, by decree.",
    },
    {
      whenAllFlags: [CH1_FLAGS.marrowSaved],
      place: { kind: "anchor", anchor: "lovely_locks_mirror" },
      activity: "Asleep in the sun near Iris. Non-negotiable.",
    },
  ],

  teak_morrow: [
    {
      place: { kind: "anchor", anchor: "rat_crowns_den" },
      activity:
        "Running messages for an organisation he thinks is being stupid about this.",
    },
    {
      whenAllFlags: [CH1_FLAGS.teakDetained],
      place: { kind: "anchor", anchor: "grove_watch_house" },
      activity:
        "Detained with Take Terra materials on him, refusing to confirm the only thing that would help.",
    },
    {
      whenEnding: "contain",
      place: { kind: "absent" },
      activity: "—",
      note: "Contain gets him out the same night as Jackie, quietly, and nobody in the Grove is told.",
    },
  ],

  wen_halloway: [
    {
      place: { kind: "absent" },
      activity: "—",
    },
    {
      whenAllFlags: [CH1_FLAGS.act3Complete],
      place: { kind: "anchor", anchor: "ashline_containment_works" },
      activity: "Clerking a refinery shift and not asking after her sister.",
    },
  ],

  coretta: [
    {
      place: { kind: "seeded" },
      activity: "At the day-book, writing the morning in before it gets away.",
    },
  ],

  calla_ashe: [
    {
      place: { kind: "seeded" },
      activity: "Walking the containment floor between shift changes.",
    },
    {
      whenAllFlags: [CH1_FLAGS.collectiveConfirmedIdentity],
      place: { kind: "seeded" },
      activity:
        "Back on shift, and still filing the report she was required to file.",
      note: "She never learns what her incident report set in motion. Do not let her apologise for it.",
    },
  ],

  hallr_ironmouth: [
    {
      place: { kind: "seeded" },
      activity: "Keeping a settlement alive through a year that will not end.",
    },
    {
      whenHallrChoice: "let_run",
      place: { kind: "absent" },
      activity: "—",
      note: "The year ran. He was already dead in 880 and now he gets to be.",
    },
    {
      whenHallrChoice: "hold_stall",
      place: { kind: "seeded" },
      activity:
        "Still keeping them alive. Still in the same winter. Still tired.",
    },
  ],

  jackie: [
    {
      place: { kind: "anchor", anchor: "roadhouse_jackie_post" },
      activity: "Keeping the road-house running and watching the stairs.",
    },
    {
      whenActiveStepIds: ["walk_with_jackie"],
      place: { kind: "anchor", anchor: "broken_safe_zone_fence" },
      activity: "Walking the broken fence line with you at dusk.",
    },
    {
      whenActiveStepIds: ["the_seam", "not_this_small"],
      place: { kind: "anchor", anchor: "gate_fence_sighting" },
      activity: "Standing beside the seam, watching your face instead of it.",
    },
    {
      whenActiveStepIds: ["the_flinch"],
      place: { kind: "anchor", anchor: "gate_desert" },
      activity: "Waiting at the return aperture after three sleepless days.",
    },
    {
      whenAllFlags: [CH1_FLAGS.jackieReported],
      place: { kind: "anchor", anchor: "grove_watch_house" },
      activity: "Sitting in the watch-house without offering a defence.",
    },
    {
      whenActiveStepIds: [
        "did_he_take_it",
        "the_whole_plan",
        "the_final_choice",
      ],
      place: { kind: "anchor", anchor: "grove_watch_house" },
      activity: "Waiting in the watch-house, practical even now.",
    },
    {
      whenEnding: "contain",
      place: { kind: "absent" },
      activity: "—",
      note: "Contain gets Jackie out quietly before the Grove is told.",
    },
    {
      whenEnding: "confess",
      place: { kind: "anchor", anchor: "roadhouse_jackie_post" },
      activity:
        "Back at the road-house while the Grove decides what to do with the truth.",
    },
  ],
});

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

export interface Ch1StagingInput {
  flags: readonly string[];
  ending?: Ch1Ending;
  hallrChoice?: "let_run" | "hold_stall";
  activeQuestId?: string;
  activeStepId?: string;
}

export interface Ch1StagedNpc {
  key: Ch1NpcKey;
  entityId: number;
  /** Name to show this player right now. */
  displayName: string;
  present: boolean;
  /** Undefined when the seeded ECS body is already in the right place. */
  position?: Ch1Vec3;
  /** True when the seeded body is correct and no puppet is required. */
  useSeededBody: boolean;
  activity: string;
}

function directionApplies(
  direction: Ch1StageDirection,
  input: Ch1StagingInput,
  flags: ReadonlySet<string>
): boolean {
  if (direction.whenEnding && direction.whenEnding !== input.ending) {
    return false;
  }
  if (
    direction.whenHallrChoice &&
    direction.whenHallrChoice !== input.hallrChoice
  ) {
    return false;
  }
  if (
    direction.whenActiveStepIds?.length &&
    (!input.activeStepId ||
      !direction.whenActiveStepIds.includes(input.activeStepId))
  ) {
    return false;
  }
  for (const flag of direction.whenAllFlags ?? []) {
    if (!flags.has(flag)) return false;
  }
  for (const flag of direction.whenNoFlags ?? []) {
    if (flags.has(flag)) return false;
  }
  return true;
}

export function ch1StageDirectionFor(
  key: Ch1NpcKey,
  input: Ch1StagingInput
): Ch1StageDirection | undefined {
  const flags = new Set(input.flags);
  const directions = CH1_STAGE_DIRECTIONS[key] ?? [];
  let winner: Ch1StageDirection | undefined;
  for (const direction of directions) {
    if (directionApplies(direction, input, flags)) {
      winner = direction;
    }
  }
  return winner;
}

export function ch1StageDirections(input: Ch1StagingInput): Ch1StagedNpc[] {
  return CH1_NEW_CAST.map((member) => {
    const direction = ch1StageDirectionFor(member.key, input);
    const place = direction?.place ?? { kind: "seeded" as const };
    const present = place.kind !== "absent";
    return {
      key: member.key,
      entityId: Number(member.entityId),
      displayName: direction?.presentAs ?? member.displayName,
      present,
      position:
        place.kind === "anchor" ? [...CH1_ANCHORS[place.anchor]] : undefined,
      useSeededBody: place.kind === "seeded",
      activity: direction?.activity ?? "—",
    };
  });
}

// ---------------------------------------------------------------------------
// World phase — consequences that are not a person standing somewhere
// ---------------------------------------------------------------------------

export const CH1_WORLD_PHASE_EFFECT_IDS = [
  "collective_transport_parked",
  "watch_house_occupied",
  "watch_house_emptied_publicly",
  "watch_house_emptied_quietly",
  "grove_residents_departed",
  "grove_exposed_to_collective",
  "grove_kept_ignorant",
  "harthmere_door_open",
  "pursuit_underway",
  "player_inside_the_directorate",
  "winter_wound_still_bleeding",
  "winter_wound_closed",
  "epilogue_gate_open",
] as const;
export type Ch1WorldPhaseEffectId = (typeof CH1_WORLD_PHASE_EFFECT_IDS)[number];

export interface Ch1WorldPhaseEffect {
  id: Ch1WorldPhaseEffectId;
  /** One line the player can be shown. Plain, never triumphant. */
  summary: string;
}

/**
 * The audit's "endings persist as flags but nothing happens" gap. Each branch
 * below names the thing the world does about it, and the Hallr rows give that
 * choice the Grove-visible consequence journal §13.3 #4 asks for.
 */
export function ch1WorldPhaseEffects(
  input: Ch1StagingInput
): readonly Ch1WorldPhaseEffect[] {
  const flags = new Set(input.flags);
  const effects: Ch1WorldPhaseEffect[] = [];
  const add = (id: Ch1WorldPhaseEffectId, summary: string) =>
    effects.push({ id, summary });

  if (flags.has(CH1_FLAGS.act5Complete)) {
    add(
      "collective_transport_parked",
      "A Collective medical transport is on the Returnstone pad. It has been there for days."
    );
  }
  if (flags.has(CH1_FLAGS.jackieReported) && !input.ending) {
    add(
      "watch_house_occupied",
      "Jackie is in the Grove watch-house and has not spoken."
    );
  }
  if (flags.has(CH1_FLAGS.complete)) {
    add(
      "epilogue_gate_open",
      "Three hundred metres past the fence, a Mouth wider than either of the ones you walked through. It does not close."
    );
  }

  switch (input.ending) {
    case "confess":
      add(
        "watch_house_emptied_publicly",
        "Jackie walked out of the watch-house in daylight, in front of everyone."
      );
      add(
        "grove_residents_departed",
        "Some people packed. The Grove is a smaller town this week than it was last week."
      );
      add(
        "grove_exposed_to_collective",
        "The Grove is now a place with a name on a Collective list."
      );
      add("harthmere_door_open", "Rook is standing beside an open gate.");
      break;
    case "contain":
      add(
        "watch_house_emptied_quietly",
        "Jackie is out. The lock was not broken and the ledger was not amended."
      );
      add(
        "grove_kept_ignorant",
        "Nobody in the Grove knows what happened. You will have to keep it that way."
      );
      add(
        "pursuit_underway",
        "Take Terra is moving on the transport route. You are two days behind it."
      );
      break;
    case "bargain":
      add(
        "watch_house_occupied",
        "Jackie is still in the watch-house. You did not ask about her."
      );
      add(
        "player_inside_the_directorate",
        "You have credentials, a lab, and a seat at the table where the shutdown gets planned."
      );
      break;
    default:
      break;
  }

  if (input.hallrChoice === "hold_stall") {
    add(
      "winter_wound_still_bleeding",
      "The cold gate is still open and still leaking. The song stones have gone flat again."
    );
  } else if (input.hallrChoice === "let_run") {
    add(
      "winter_wound_closed",
      "The cold gate closed cleanly behind you. Nothing has come out of it since."
    );
  }

  return effects;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Structural validation, run by test. */
export function ch1ValidateStaging(): string[] {
  const errors: string[] = [];
  const castKeys = new Set(CH1_NEW_CAST.map((member) => member.key));
  for (const key of Object.keys(CH1_STAGE_DIRECTIONS) as Ch1NpcKey[]) {
    if (!castKeys.has(key)) {
      errors.push(`${key}: stage directions for a character that is not cast`);
    }
  }
  for (const member of CH1_NEW_CAST) {
    const directions = CH1_STAGE_DIRECTIONS[member.key];
    if (!directions || directions.length === 0) {
      errors.push(`${member.key}: has no stage directions`);
      continue;
    }
    const base = directions[0];
    if (
      base.whenAllFlags?.length ||
      base.whenNoFlags?.length ||
      base.whenEnding ||
      base.whenHallrChoice ||
      base.whenActiveStepIds?.length
    ) {
      errors.push(
        `${member.key}: the first stage direction must be unconditional so ` +
          `every story state resolves to something`
      );
    }
    for (const direction of directions) {
      if (
        direction.place.kind === "anchor" &&
        !(direction.place.anchor in CH1_ANCHORS)
      ) {
        errors.push(`${member.key}: unknown anchor ${direction.place.anchor}`);
      }
      if (direction.activity.trim().length === 0) {
        errors.push(`${member.key}: a stage direction has no activity line`);
      }
    }
  }

  // Every ending must actually change the world, or the choice is decoration.
  for (const ending of CH1_ENDINGS) {
    const effects = ch1WorldPhaseEffects({
      flags: [CH1_FLAGS.complete, CH1_FLAGS.ledgerSurrendered],
      ending,
    });
    if (effects.length < 3) {
      errors.push(`ending "${ending}" produces fewer than three world effects`);
    }
  }
  for (const choice of ["let_run", "hold_stall"] as const) {
    const effects = ch1WorldPhaseEffects({ flags: [], hallrChoice: choice });
    if (effects.length === 0) {
      errors.push(`Hallr choice "${choice}" has no world consequence`);
    }
  }
  return errors;
}
