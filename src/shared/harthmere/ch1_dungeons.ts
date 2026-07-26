// CHAPTER_1_TIME_PORTAL_DUNGEONS
//
// Shared contract for the two Chapter 1 Fracture Gate dungeons. A dungeon is a
// RETRIEVAL, not a clear: something always has to come back with you.
//
// HARD RULES (journal §5.2, enforced by ch1_dungeons.test.ts):
//   * no merchants, no rest nodes, no resupply, in any zone, ever
//   * one-way until the far anchor is reached
//   * an attrition resource is the real health bar
//   * every dungeon must retrieve at least one required item or person
//   * total authored length 2-3 hours
//
// THIS FILE IS THE NARRATIVE LAYER ONLY. The physical dungeon — shard terrain,
// shells, floors, walls, ceilings, stairs, doorways, and water basins — lives
// in ch1_dungeon_terrain.ts, and the interior props live in
// ch1_dungeon_decor.ts, per the snapshot map guide's Rule 3 ("if players can
// stand on it, it must be canonical data") and the building guide's layer
// split (voxels own the shell, runtime props own the furniture).
//
// Every zone id below must have at least one volume in ch1_dungeon_terrain.ts.
// ch1_dungeon_terrain.test.ts enforces that; a zone with no voxels is a zone
// the player cannot stand in.
//
// See docs/harthmere/CHAPTER_1_IDENTITY_WRITERS_JOURNAL.md §8 and §9.

import { CH1_FLAGS } from "@/shared/harthmere/ch1_ids";

export const CH1_DUNGEONS_VERSION = 1 as const;

/** The resource that is really the health bar. Water in the desert, fuel in
 *  the fjord. Both are carried in and cannot be replenished inside. */
export type Ch1AttritionResource = "water" | "fuel";

export interface Ch1DungeonZone {
  id: string;
  name: string;
  /** Authored playtime in minutes. */
  minutes: number;
  /** The zone's defining mechanic, in designer-readable terms. */
  mechanic: string;
  threat: string;
  description: string;
  /** Encounter ids present in this zone. Empty for deliberate quiet zones. */
  encounters: readonly string[];
  /** Fragments recoverable here. */
  fragments: readonly string[];
  /** Latent skills unlocked here. */
  latentSkills: readonly string[];
  /** Items obtainable here. */
  items: readonly string[];
  /** Enforced: always false. Kept explicit so a future edit has to lie on purpose. */
  hasMerchant: false;
  hasRestNode: false;
}

export interface Ch1DungeonRetrieval {
  kind: "item" | "person";
  id: string;
  name: string;
  required: boolean;
  note: string;
}

export interface Ch1DungeonBossPhase {
  id: string;
  name: string;
  description: string;
}

export interface Ch1DungeonBoss {
  id: string;
  name: string;
  phases: readonly Ch1DungeonBossPhase[];
  /** Can the encounter be avoided entirely? */
  stealthBypass: boolean;
  writerNote: string;
}

export interface Ch1DungeonChoice {
  id: string;
  prompt: string;
  options: readonly { id: string; label: string; consequence: string }[];
  /** Scored choices cheapen this. Both answers are defensible. */
  scored: false;
}

export interface Ch1DungeonDef {
  id: string;
  name: string;
  /** What the Grove calls it vs. what Harthmere calls it. */
  harthmereName: string;
  gateId: string;
  era: string;
  biome: string;
  targetMinutes: number;
  attrition: Ch1AttritionResource;
  act: number;
  premise: string;
  zones: readonly Ch1DungeonZone[];
  boss: Ch1DungeonBoss;
  retrievals: readonly Ch1DungeonRetrieval[];
  choice?: Ch1DungeonChoice;
  /** Party sizes the encounters are authored for. */
  partySizes: readonly number[];
  completionFlags: readonly string[];
}

// ===========================================================================
// Dungeon 1 — The Sand That Remembers
// ===========================================================================

export const CH1_DUNGEON_DESERT: Ch1DungeonDef = {
  id: "ch1_dungeon_desert",
  name: "The Sand That Remembers",
  harthmereName: "the Dry Mouth",
  gateId: "ch1_gate_desert",
  era: "c. 1750 BCE — a river-valley city at the end of a long drought",
  biome: "desert: dune sea, salt flat, buried mudbrick city, deep cisterns",
  targetMinutes: 160,
  attrition: "water",
  act: 3,
  premise:
    "A city dying of thirst on top of a natural Exotic Matter outcrop it has no word for. They call it the Sleeping Weight and have built a temple over it, and they are correct about almost everything: it does not fall, it does not burn, it is not of the world, and it must not be broken. They have also been doing accidental exotic-matter metallurgy for two hundred years, which is why their bronze is the best on Earth for reasons nobody there can articulate. The city is not hostile. The city is GONE — evacuated about six weeks ago, with meals still on tables. What is left is what came after.",
  partySizes: [1, 2, 3, 4],
  zones: [
    {
      id: "d1_z1_dune_threshold",
      name: "Dune Threshold",
      minutes: 15,
      mechanic:
        "Heat and water attrition. No combat. Heat drains stamina, shade restores it, and the player learns the resource bar IS the health bar. AUGUR-9 drains 3x faster in the heat — first real pressure on the 'which logs do I play' economy.",
      threat: "The environment",
      description:
        "Fifteen minutes of no enemies. The player crests a dune and sees a Bronze Age city under a sun that is the wrong colour. This is a flex and it is worth it.",
      encounters: [],
      fragments: [],
      latentSkills: [],
      items: [],
      hasMerchant: false,
      hasRestNode: false,
    },
    {
      id: "d1_z2_salt_market",
      name: "The Salt Market",
      minutes: 25,
      mechanic:
        "Combat introduction in a ruined bazaar with awnings that can be dropped on things. Verticality.",
      threat: "Salt-Cured Muckers",
      description:
        "Muck that came through a much older, much smaller aperture and has been baking here for a century. Slower, harder, and they do not bleed. First proof the Muck is neither local to the Grove nor local to now.",
      encounters: ["enc_d1_salt_cured_muckers", "enc_d1_awning_collapse"],
      fragments: [],
      latentSkills: [],
      items: ["item_iris_button"],
      hasMerchant: false,
      hasRestNode: false,
    },
    {
      id: "d1_z3_cistern_stair",
      name: "The Cistern Stair",
      minutes: 25,
      mechanic:
        "Light management. Torches burn out and the player brought a finite number. Water level changes as ancient sluices fail. There is a shortcut that saves fifteen minutes and requires swimming a section with no air pockets — let the player try it and drown.",
      threat: "Drowning; Lesser Hexers hunting by sound in the dark",
      description:
        "A partly flooded cistern navigated in the dark, from below and from above, as the level moves.",
      encounters: ["enc_d1_cistern_hexers"],
      fragments: [],
      latentSkills: [],
      items: [],
      hasMerchant: false,
      hasRestNode: false,
    },
    {
      id: "d1_z4_hall_of_weights",
      name: "The Hall of Weights",
      minutes: 30,
      mechanic:
        "THE PUZZLE THAT CARRIES THE CHAPTER'S THESIS. A Bronze Age standards vault. To open the Seed Vault the player must produce an exact mass against the temple's own standard — and every modern instrument they carry gives a different answer, drifting by amounts that are small, consistent, and impossible. The solution is to stop trusting instruments and use the temple's balance beam. You cannot measure anything against the present. You can only measure things against each other.",
      threat: "Timed, non-combat",
      description:
        "Reference weights, balance beams, graduated vessels, and the first time the player's hands solve something their head cannot.",
      encounters: [],
      fragments: ["frag_a3_play_ninth_paper"],
      latentSkills: ["ls_field_calibration"],
      items: [],
      hasMerchant: false,
      hasRestNode: false,
    },
    {
      id: "d1_z5_sun_court",
      name: "The Sun Court",
      minutes: 20,
      mechanic: "Mini-boss arena. Pillars are the weapon, not your sword.",
      threat: "The Gilded Bull",
      description:
        "A temple guardian on a two-hundred-year-old directive to keep the unclean out of the Sun Court. Not evil. Not alive.",
      encounters: ["enc_d1_gilded_bull"],
      fragments: [],
      latentSkills: [],
      items: ["item_bulls_core"],
      hasMerchant: false,
      hasRestNode: false,
    },
    {
      id: "d1_z6_seed_vault",
      name: "The Seed Vault",
      minutes: 20,
      mechanic:
        "Discovery. No combat, deliberately. The vault is a granary and a seed library and it is FULL, because the city evacuated without taking its future with it.",
      threat: "None",
      description:
        "In a nest of grain sacks: Iris Fen, eight years old, eleven days in, entirely calm — because the temple's systems read a child as something to preserve. She has also been talking to somebody who comes and goes and is 'cold to stand next to'.",
      encounters: [],
      fragments: [
        "frag_a3_echo_cold_to_stand_next_to",
        "frag_a3_recon_corridor",
      ],
      latentSkills: [],
      items: ["item_first_grain", "item_marrow_collar"],
      hasMerchant: false,
      hasRestNode: false,
    },
    {
      id: "d1_z7_the_long_walk",
      name: "The Long Walk",
      minutes: 25,
      mechanic:
        "Escort under a sandstorm. Iris is slow, Marrow will not be left, and the return aperture is four hundred metres of open flat. No combat encounters — a PURSUIT.",
      threat: "Attrition, and something large moving parallel in the storm",
      description:
        "Something is out there and never quite arrives. The game must never show it. Not in this chapter.",
      encounters: ["enc_d1_the_long_walk_pursuit"],
      fragments: [],
      latentSkills: [],
      items: [],
      hasMerchant: false,
      hasRestNode: false,
    },
  ],
  boss: {
    id: "enc_d1_gilded_bull",
    name: "The Gilded Bull",
    stealthBypass: true,
    phases: [
      {
        id: "patrol",
        name: "Patrol",
        description:
          "It hasn't noticed you. Full stealth bypass is possible and rewards a lore cache.",
      },
      {
        id: "charge",
        name: "Charge",
        description:
          "Straight-line charges through a pillared arena. You break its horns on the architecture, not with your weapon.",
      },
      {
        id: "unbalanced",
        name: "Unbalanced",
        description:
          "Hornless, it fights badly and desperately, and it takes too long to die. That is intentional. The player should feel slightly sick about it.",
      },
    ],
    writerNote:
      "Bronze automaton, exotic-matter cored. It is not evil and it is not alive, and killing it yields the best AUGUR-9 recharge in the chapter. Nobody comments on the trade.",
  },
  retrievals: [
    {
      kind: "item",
      id: "item_first_grain",
      name: "The First Grain",
      required: true,
      note: "Pre-anchor reference mass. The last honest gram on Earth.",
    },
    {
      kind: "person",
      id: "npc_iris_fen",
      name: "Iris Fen",
      required: true,
      note: "Eight years old, eleven days displaced, and fine, which is the disturbing part.",
    },
    {
      kind: "person",
      id: "npc_marrow",
      name: "Marrow",
      required: false,
      note: "Optional and cruel to make optional. MUST BE UNKILLABLE.",
    },
  ],
  // NB: this deliberately does NOT set act3Complete. The act closes on "Three
  // Days" — coming back out, and Jackie reaching for the player, and the
  // player flinching. Setting the act flag here would advance the chapter the
  // instant the player stepped through the aperture, stranding both the
  // dungeon quest and the closing scene in an act they can no longer enter.
  completionFlags: [
    CH1_FLAGS.irisRescued,
    CH1_FLAGS.hasFirstGrain,
    CH1_FLAGS.believesJackieHostile,
  ],
};

// ===========================================================================
// Dungeon 2 — The Long Winter Mouth
// ===========================================================================

export const CH1_DUNGEON_WINTER: Ch1DungeonDef = {
  id: "ch1_dungeon_winter",
  name: "The Long Winter Mouth",
  harthmereName: "the Long Winter Mouth",
  gateId: "ch1_gate_winter",
  era: "c. 880 CE — a Norse fjord in a winter that has not ended in nine years",
  biome: "snow: sea ice, frozen fjord, drowned longhouse, black pine, ash hall",
  targetMinutes: 190,
  attrition: "fuel",
  act: 5,
  premise:
    "Not a healthy past — a STALLED one. The aperture has leaked into this fjord so long that the local timeline has stopped advancing: the same winter, over and over, for nine years by the inhabitants' count. Nothing grows. Nothing rots. Nobody has aged. Nobody has died either, which sounds like mercy and is not. The desert was empty and sad; the fjord is full and wrong.",
  partySizes: [1, 2, 3, 4],
  zones: [
    {
      id: "d2_z1_ice_shelf_landing",
      name: "The Ice Shelf Landing",
      minutes: 20,
      mechanic:
        "Cold attrition. FUEL replaces water as the clock: fire is finite, carried, and the only thing between the player and a slow stat death. AUGUR-9's core lasts LONGER in the cold — a small mercy, and the only one.",
      threat: "Exposure",
      description:
        "Three men frozen mid-stride on the shelf. Nine years dead. Not decomposed. Not frozen solid. Warm.",
      encounters: [],
      fragments: [],
      latentSkills: [],
      items: [],
      hasMerchant: false,
      hasRestNode: false,
    },
    {
      id: "d2_z2_drowned_longhouse",
      name: "The Drowned Longhouse",
      minutes: 30,
      mechanic:
        "Under-ice navigation with breath as a hard timer. A house navigated from below, with the ceiling as the floor. Wayfinding by furniture. Genuinely claustrophobic — keep it short enough that it stays fun.",
      threat: "Cold, drowning, Hexers",
      description:
        "A hall that flooded and froze with everything still inside it.",
      encounters: ["enc_d2_underice_hexers"],
      fragments: [],
      latentSkills: [],
      items: ["item_hnefatafl_piece"],
      hasMerchant: false,
      hasRestNode: false,
    },
    {
      id: "d2_z3_hanged_wood",
      name: "The Hanged Wood",
      minutes: 30,
      mechanic:
        "Stealth-preferred; sound discipline. They hunt by sound. Combat is possible and expensive.",
      threat: "Things that should not be here",
      description:
        "A black pine wood on the fjord's north face where the aperture leaks worst, and where things from OTHER apertures have accumulated. Not Muck. Not Norse. Things with no era at all. NOTHING IN THIS WOOD IS EXPLAINED IN CHAPTER 1 and nothing in it is ever fought as a boss. It is a wood full of unfinished business.",
      encounters: ["enc_d2_hanged_wood_stalkers"],
      fragments: [],
      latentSkills: [],
      items: [],
      hasMerchant: false,
      hasRestNode: false,
    },
    {
      id: "d2_z4_whale_road",
      name: "The Whale Road",
      minutes: 25,
      mechanic:
        "Ice crossing under load. CARRY WEIGHT BECOMES LETHAL: too much and the ice goes. The player must choose what to leave on the near shore, and whatever they leave is gone, and they make that choice again on the way back with a person added to the load.",
      threat: "Ice failure; pursuit",
      description: "Crossing the frozen fjord with everything you are carrying.",
      encounters: ["enc_d2_ice_failure"],
      fragments: [],
      latentSkills: [],
      items: [],
      hasMerchant: false,
      hasRestNode: false,
    },
    {
      id: "d2_z5_sorrels_camp",
      name: "Sorrel's Camp",
      minutes: 25,
      mechanic:
        "Dialogue. No combat. A barred door and a bar-slot. The scene runs on one engine: she remembers the player and the player does not remember her. Every warm thing she says lands on nothing.",
      threat: "Sorrel herself",
      description:
        "A fortified fisherman's shed, four months of survival engineering, and a wall of charcoal notation that is the most beautiful and most alarming set-dressing in the chapter. She gives up three things in order: the key, the truth about the model, and — last, and only after the player agrees to a condition — the ledger.",
      encounters: [],
      fragments: ["frag_a5_overlay_ashfall"],
      latentSkills: [],
      items: ["item_custodian_key_3", "item_sorrel_field_ledger"],
      hasMerchant: false,
      hasRestNode: false,
    },
    {
      id: "d2_z6_ash_hall",
      name: "The Ash Hall",
      minutes: 35,
      mechanic: "Boss, then a moral choice that is Hallr's and not the player's.",
      threat: "The Ninth Winter",
      description:
        "Jarl Hallr's hall, and the aperture's local wound, and the thing the stall has become.",
      encounters: ["enc_d2_ninth_winter"],
      fragments: [],
      latentSkills: [],
      items: [],
      hasMerchant: false,
      hasRestNode: false,
    },
    {
      id: "d2_z7_the_breaking_year",
      name: "The Breaking Year",
      minutes: 25,
      mechanic:
        "Escort out under a collapsing local timeline, across the Whale Road, with weight that matters, while the fjord runs nine years of weather in twenty minutes. Sorrel talks the entire way.",
      threat: "Everything",
      description:
        "Where the player gets the truth, in pieces, at a run — and where they learn the designation from a woman shouting it over wind, and hate it.",
      encounters: ["enc_d2_collapse_pursuit"],
      fragments: ["frag_a5_echo_the_name"],
      latentSkills: [],
      items: [],
      hasMerchant: false,
      hasRestNode: false,
    },
  ],
  boss: {
    id: "enc_d2_ninth_winter",
    name: "The Ninth Winter",
    stealthBypass: false,
    phases: [
      {
        id: "the_hearth_fails",
        name: "The Hearth Fails",
        description:
          "Fight in darkness with a dying fire the player must feed with their own carried fuel. Every log burned is a log they do not have for the walk out.",
      },
      {
        id: "the_same_day_again",
        name: "The Same Day Again",
        description:
          "The arena resets — literally, a ninety-second loop, with the player's damage persisting and the environment's not. Disorienting on purpose.",
      },
      {
        id: "the_year_breaks",
        name: "The Year Breaks",
        description:
          "Winter ends in the room. Snow turns to rain. Everything the stall was holding up comes due at once.",
      },
    ],
    writerNote:
      "Not a creature: the stalled year itself, given a body by the anchor leak — a slow, vast, cold thing wearing the hall's roof beams and nine years of accumulated unfinished mornings.",
  },
  retrievals: [
    {
      kind: "person",
      id: "npc_nadia_sorrel",
      name: "Dr. Nadia Sorrel",
      required: true,
      note: "Eleven years gone, four months older, and mid-argument.",
    },
    {
      kind: "item",
      id: "item_sorrel_field_ledger",
      name: "The Field Ledger",
      required: true,
      note: "The unredacted original. The thing the player gives away.",
    },
    {
      kind: "item",
      id: "item_custodian_key_3",
      name: "Custodian Key 3",
      required: true,
      note: "Two keys together do something. A Chapter 2 problem.",
    },
  ],
  choice: {
    id: "ch1_hallr_choice",
    scored: false,
    prompt:
      "Hallr has worked out that the winter is not weather. Ending the stall means his people finally get to die on schedule.",
    options: [
      {
        id: "let_run",
        label: "Let the year run",
        consequence:
          "The stall ends. Nine years arrive at once. Most of these people were already dead in 880 and now they get to be. Hallr accepts it. The player watches a settlement age nine years in ninety seconds. The aperture closes cleanly.",
      },
      {
        id: "hold_stall",
        label: "Hold the stall",
        consequence:
          "The wound stays open. The people live — in the same winter, forever — and the leak keeps bleeding into the Grove, and the gates keep opening. Hallr will take this deal if the player argues for it. He should not be judged for it.",
      },
    ],
  },
  // As with the desert: the act closes on "Two Days" — Rook still holding the
  // rope on the near shore, and Lou waiting in the Grove. Not on the exit.
  completionFlags: [
    CH1_FLAGS.knowsDesignation,
    CH1_FLAGS.hasLedger,
    CH1_FLAGS.sorrelOathGiven,
  ],
};

export const CH1_DUNGEONS: readonly Ch1DungeonDef[] = Object.freeze([
  CH1_DUNGEON_DESERT,
  CH1_DUNGEON_WINTER,
]);

const DUNGEONS_BY_ID = new Map(CH1_DUNGEONS.map((d) => [d.id, d]));

export function ch1Dungeon(id: string): Ch1DungeonDef | undefined {
  return DUNGEONS_BY_ID.get(id);
}

export function ch1DungeonMinutes(dungeon: Ch1DungeonDef): number {
  return dungeon.zones.reduce((n, z) => n + z.minutes, 0);
}

export function ch1DungeonRequiredRetrievals(
  dungeon: Ch1DungeonDef
): readonly Ch1DungeonRetrieval[] {
  return dungeon.retrievals.filter((r) => r.required);
}

/**
 * A dungeon run is only complete when every required retrieval is actually
 * carried back out. Clearing the boss is not completion.
 */
export function ch1DungeonRunComplete(
  dungeonId: string,
  carriedOut: readonly string[]
): boolean {
  const dungeon = DUNGEONS_BY_ID.get(dungeonId);
  if (!dungeon) {
    throw new Error(`unknown chapter 1 dungeon: ${dungeonId}`);
  }
  const have = new Set(carriedOut);
  return ch1DungeonRequiredRetrievals(dungeon).every((r) => have.has(r.id));
}

/** Structural validation. Run over every dungeon by test. */
export function ch1ValidateDungeon(dungeon: Ch1DungeonDef): string[] {
  const errors: string[] = [];
  const minutes = ch1DungeonMinutes(dungeon);
  if (minutes < 120 || minutes > 180 + 30) {
    errors.push(
      `${dungeon.id}: authored length ${minutes}m is outside the 2-3.5 hour band`
    );
  }
  if (Math.abs(minutes - dungeon.targetMinutes) > 15) {
    errors.push(
      `${dungeon.id}: zone total ${minutes}m disagrees with targetMinutes ` +
        `${dungeon.targetMinutes}m`
    );
  }
  for (const zone of dungeon.zones) {
    if (zone.hasMerchant) {
      errors.push(`${dungeon.id}/${zone.id}: dungeons have no merchants`);
    }
    if (zone.hasRestNode) {
      errors.push(`${dungeon.id}/${zone.id}: dungeons have no rest nodes`);
    }
    if (zone.minutes <= 0) {
      errors.push(`${dungeon.id}/${zone.id}: zone needs a positive length`);
    }
  }
  if (ch1DungeonRequiredRetrievals(dungeon).length === 0) {
    errors.push(
      `${dungeon.id}: a dungeon is a retrieval, not a clear — needs at least ` +
        `one required retrieval`
    );
  }
  if (dungeon.zones.length !== 7) {
    errors.push(`${dungeon.id}: authored for 7 zones, found ${dungeon.zones.length}`);
  }
  if (dungeon.boss.phases.length < 3) {
    errors.push(`${dungeon.id}: boss needs at least three phases`);
  }
  return errors;
}

export function ch1ValidateAllDungeons(): string[] {
  return CH1_DUNGEONS.flatMap(ch1ValidateDungeon);
}
