// CHAPTER_1_IDENTITY_LIGHTWEIGHT_IDS
//
// Browser-safe identity, anchor, and flag constants for Chapter 1 ("Identity").
// Deliberately dependency-light (mirrors snapshot_grove_ids.ts) so cutscene
// preview, capture tooling, and map probes can import chapter identity without
// pulling in terrain/quest catalogues. See
// docs/harthmere/CHAPTER_1_IDENTITY_WRITERS_JOURNAL.md.

import type { BiomesId } from "@/shared/ids";
import { SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE } from "@/shared/harthmere/snapshot_grove_ids";

export const CHAPTER_1_VERSION = 1 as const;
export const CHAPTER_1_ID = "ch1_identity" as const;

// ---------------------------------------------------------------------------
// Entity id offsets
//
// 9014/9120/9200/9300/9466/9551/9575/9601/9651/9701/10001/10041 are already
// claimed by existing Harthmere/Grove seeds. Chapter 1 owns 10500..10599.
// ---------------------------------------------------------------------------

export const CH1_NPC_ID_OFFSET_BASE = 10500;

export const CH1_NPC_ID_OFFSETS = {
  lou_ardan: 10501,
  cressa_vane: 10502,
  halden_rook: 10503,
  nadia_sorrel: 10504,
  iris_fen: 10505,
  teak_morrow: 10506,
  augur9: 10507,
  wen_halloway: 10508,
  marrow: 10509,
  hallr_ironmouth: 10510,
} as const;

export type Ch1NpcKey = keyof typeof CH1_NPC_ID_OFFSETS;

export function ch1NpcEntityId(key: Ch1NpcKey): BiomesId {
  return (Number(SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE) +
    CH1_NPC_ID_OFFSETS[key]) as BiomesId;
}

export const CH1_NPC_ENTITY_IDS = Object.freeze(
  Object.fromEntries(
    (Object.keys(CH1_NPC_ID_OFFSETS) as Ch1NpcKey[]).map((k) => [
      k,
      ch1NpcEntityId(k),
    ])
  )
) as Readonly<Record<Ch1NpcKey, BiomesId>>;

// ---------------------------------------------------------------------------
// World anchors
//
// Every anchor below is taken from the generated production terrain placement
// map (src/shared/harthmere/generated/production_terrain_placement_map.ts) so
// Chapter 1 content lands on real, walkable, already-validated ground.
// ---------------------------------------------------------------------------

export type Ch1Vec3 = readonly [number, number, number];

export const CH1_ANCHORS = {
  // --- Grove hub ---
  jackie_post: [496, 71, -126],
  fountain_lesson_board: [494, 71, -129],
  taye_sign_post: [491, 71, -124],
  billy: [500, 71, -140],
  kit_mail_stand: [504, 71, -118],
  grove_wishing_well: [490, 54, -148],
  grove_supply_chest: [496, 54, -138],
  grove_garden_gate: [502, 54, -145],
  old_grove_road_post: [500, 71, -140],
  muckwad_patch: [512, 71, -152],
  broken_safe_zone_fence: [514, 71, -198],
  crossroads_service_tower: [498, 71, -216],
  mosslawn_song_stones: [468, 71, -250],
  ranger_jane: [450, 71, -260],
  shutter_cove_photo_marker: [560, 71, -182],
  lovely_locks_mirror: [407, 71, -126],
  rat_crowns_den: [418, 53, -237],

  // --- Wider map ---
  old_wood_copse_sentinel: [640, 57, -455],
  greenlamp_clinic: [656, 65, -182],
  ashline_containment_works: [674, 67, -44],
  ashline_refinery_intake: [674, 67, -56],
  returnstone_pad_office: [42, 41, -30],
  lanternrest_road_inn: [606, 48, -484],
  muck_scarred_helix: [232, 54, -506],
  harthmere_bridge_center: [904, 71, -209],
  eastgate_portal_office: [1578, 66, -136],
  glassyard_biome_studio: [1183, 46, 138],
  biome_anchor_leak: [766, 63, 27],

  // --- Chapter 1 authored spawns ---
  // Act 1 close: the ninety-second sighting, 50m past the broken fence.
  gate_fence_sighting: [520, 71, -205],
  // Act 2 close: the first persistent gate. Dungeon 1 entrance.
  gate_desert: [648, 57, -462],
  // Act 5: the cold gate at the far edge of the anchor field. Dungeon 2.
  gate_winter: [232, 54, -506],
  // Act 6 epilogue: the gate that does not close.
  gate_prime: [524, 71, -210],
  // Act 6: the watch-house where Jackie is held.
  grove_watch_house: [492, 71, -134],
} as const satisfies Record<string, Ch1Vec3>;

export type Ch1AnchorKey = keyof typeof CH1_ANCHORS;

export function ch1Anchor(key: Ch1AnchorKey): Ch1Vec3 {
  return CH1_ANCHORS[key];
}

/**
 * Harthmere refuses Exotic Matter, therefore has no anchors, therefore has no
 * Mouths. Every Fracture Gate must spawn west of the bridge. This is a
 * story-critical invariant, not a soft guideline — see §11.2 of the journal.
 */
export const CH1_HARTHMERE_BRIDGE_X = CH1_ANCHORS.harthmere_bridge_center[0];

export function isCh1LegalGatePosition(position: Ch1Vec3): boolean {
  return position[0] < CH1_HARTHMERE_BRIDGE_X;
}

// ---------------------------------------------------------------------------
// Flags
//
// The chapter's whole progression is flag-driven. Spoiler-bearing flags are
// listed here but must never be *named* in client-visible copy.
// ---------------------------------------------------------------------------

export const CH1_FLAGS = {
  started: "ch1_started",
  act1Complete: "ch1_act1_complete",
  act2Complete: "ch1_act2_complete",
  act3Complete: "ch1_act3_complete",
  act4Complete: "ch1_act4_complete",
  act5Complete: "ch1_act5_complete",
  act6TruthKnown: "ch1_act6_truth_known",
  complete: "ch1_complete",

  seenFirstGate: "ch1_seen_first_gate",
  gatePersistentOpen: "ch1_gate_persistent_open",
  metLou: "ch1_met_lou",
  metRook: "ch1_met_rook",
  rookToken: "ch1_rook_token",

  irisRescued: "ch1_iris_rescued",
  marrowSaved: "ch1_marrow_saved",
  hasFirstGrain: "ch1_has_first_grain",
  believesJackieHostile: "ch1_believes_jackie_hostile",

  jackieExpelled: "ch1_jackie_expelled",
  dosingStopped: "ch1_dosing_stopped",
  dosingResumed: "ch1_dosing_resumed",
  teakDetained: "ch1_teak_detained",
  // Hidden: set by Calla Ashe's incident report, never surfaced to the player.
  collectiveConfirmedIdentity: "ch1_collective_confirmed_identity",

  act5Linking: "ch1_act5_linking",
  sorrelOathGiven: "ch1_sorrel_oath_given",
  knowsDesignation: "ch1_knows_designation_seven",
  hasLedger: "ch1_has_ledger",
  ledgerSurrendered: "ch1_ledger_surrendered",
  jackieTrueIdentityKnown: "ch1_jackie_true_identity_known",
} as const;

export type Ch1Flag = (typeof CH1_FLAGS)[keyof typeof CH1_FLAGS];

// ---------------------------------------------------------------------------
// Disposition tracks
// ---------------------------------------------------------------------------

export const CH1_TRACKS = {
  jackieTrust: "ch1_jackie_trust",
  louTrust: "ch1_lou_trust",
  auggieCharge: "augur9_core_charge",
} as const;

export const CH1_TRACK_DEFAULTS: Readonly<Record<string, number>> =
  Object.freeze({
    [CH1_TRACKS.jackieTrust]: 55,
    [CH1_TRACKS.louTrust]: 40,
    [CH1_TRACKS.auggieCharge]: 62,
  });

// ---------------------------------------------------------------------------
// Endings
// ---------------------------------------------------------------------------

export const CH1_ENDINGS = ["confess", "contain", "bargain"] as const;
export type Ch1Ending = (typeof CH1_ENDINGS)[number];
export const CH1_ENDING_FLAG = "ch1_ending";

// ---------------------------------------------------------------------------
// Client-visible naming discipline
//
// Journal §0: no client-visible string may leak the twist before Act 6.
// ---------------------------------------------------------------------------

export const CH1_FORBIDDEN_PRE_ACT6_SUBSTRINGS = [
  "stillwater",
  "riverbed",
  "seven",
  "anchor zero",
  "anchor_zero",
  "ardan_betrayal",
] as const;

/**
 * Returns the forbidden substrings present in a string that is shipped to the
 * client before Act 6. Used by tests over every authored quest/item/fragment
 * copy field.
 */
export function ch1ForbiddenSubstrings(text: string): string[] {
  const lowered = text.toLowerCase();
  return CH1_FORBIDDEN_PRE_ACT6_SUBSTRINGS.filter((s) => lowered.includes(s));
}
