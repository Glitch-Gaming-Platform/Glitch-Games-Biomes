// CHAPTER_1_IDENTITY_LIGHTWEIGHT_IDS
//
// Browser-safe identity, anchor, and flag constants for Chapter 1 ("Identity").
// Deliberately dependency-light (mirrors snapshot_grove_ids.ts) so cutscene
// preview, capture tooling, and map probes can import chapter identity without
// pulling in terrain/quest catalogues. See
// docs/harthmere/CHAPTER_1_IDENTITY_WRITERS_JOURNAL.md.

import type { BiomesId } from "@/shared/ids";
import {
  SNAPSHOT_GROVE_JACKIE_ENTITY_ID,
  SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE,
  SNAPSHOT_GROVE_MUCKED_ROBOT_ENTITY_ID,
} from "@/shared/harthmere/snapshot_grove_ids";

export const CHAPTER_1_VERSION = 1 as const;
export const CHAPTER_1_ID = "ch1_identity" as const;

// ---------------------------------------------------------------------------
// Entity id offsets
//
// 9014/9120/9200/9300/9466/9551/9575/9601/9651/9701/10001/10041 are already
// claimed by existing Harthmere/Grove seeds. Chapter 1 owns 10500..10599.
// ---------------------------------------------------------------------------

export const CH1_NPC_ID_OFFSET_BASE = 10500;
export const CH1_NPC_ID_OFFSET_LIMIT_EXCLUSIVE = 10600;

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
  // Both of these are quest GIVERS and named dialogue targets who had no entity
  // anywhere in the world. `questGiverId()` fell through to `undefined` for
  // them, which happened to auto-start their quests from the challengeComplete
  // unlock — so the chapter worked, but Coretta's twelve accounts and Calla
  // Ashe's "How did you do that?" were addressed to nobody, and Calla's
  // objective resolved via the district fallback to a bare anchor.
  coretta: 10511,
  calla_ashe: 10512,
  // Jackie is an existing Snapshot Grove entity, but Chapter 1 needs a
  // per-player presentation for the road-house and Watch House scenes. Keep a
  // reserved Chapter 1 key and promote the canonical entity instead of
  // creating a duplicate body.
  jackie: 10513,
} as const;

export type Ch1NpcKey = keyof typeof CH1_NPC_ID_OFFSETS;

/**
 * Characters who are an EXISTING world entity rather than a new body.
 *
 * AUGUR-9 is the writer's journal's single most important retcon (§3.1): the
 * Mucked Robot the player repairs in Muck vs. Machine *is* the custodian unit.
 * The first pass implemented that by seeding a second robot at offset 10507,
 * so the retconned character and the character it retcons could stand in the
 * Grove at the same time. That is not a retcon; it is a twin.
 *
 * Chapter 1 therefore claims the snapshot Grove entity instead of creating one.
 * The offset below stays reserved so it can never be handed to a new character,
 * and the prologue keeps targeting the same id under the same ECS display name
 * (the AUGUR-9 presentation is per-player and lives in ch1_staging.ts).
 */
export const CH1_PROMOTED_ENTITY_IDS: Partial<Record<Ch1NpcKey, BiomesId>> =
  Object.freeze({
    augur9: SNAPSHOT_GROVE_MUCKED_ROBOT_ENTITY_ID,
    jackie: SNAPSHOT_GROVE_JACKIE_ENTITY_ID,
  });

export function ch1NpcEntityId(key: Ch1NpcKey): BiomesId {
  const promoted = CH1_PROMOTED_ENTITY_IDS[key];
  if (promoted !== undefined) {
    return promoted;
  }
  return (Number(SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE) +
    CH1_NPC_ID_OFFSETS[key]) as BiomesId;
}

export function ch1PromotesExistingEntity(key: Ch1NpcKey): boolean {
  return CH1_PROMOTED_ENTITY_IDS[key] !== undefined;
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
// Every anchor is a MARKER-HEIGHT position: the measured production surface
// feet-Y at that column, plus one. Measurements come from the generated
// production terrain placement map
// (src/shared/harthmere/generated/production_terrain_placement_map.ts).
//
// WHY THE Y VALUES CHANGED (2026-07-30)
// The original table took X/Z from the placement map but NOT the resolved
// surface height, so 25 of 39 anchors were between 2 and 21 blocks off the
// ground the browser actually loads:
//
//   mosslawn_song_stones      71 -> 50   (was 21 blocks in the air)
//   ranger_jane               71 -> 50   (was 21 blocks in the air)
//   gate_winter               54 -> 33   (was 21 blocks in the air)
//   muck_scarred_helix        54 -> 33   (was 21 blocks in the air)
//   harthmere_bridge_center   71 -> 58   (was 13 blocks in the air)
//   grove_supply_chest        54 -> 71   (was 17 blocks underground)
//   grove_wishing_well        54 -> 70   (was 16 blocks underground)
//   grove_garden_gate         54 -> 70   (was 16 blocks underground)
//   broken_safe_zone_fence    71 -> 81   (was 10 blocks underground)
//   gate_fence_sighting       71 -> 81   (was 10 blocks underground)
//   lanternrest_road_inn      48 -> 58   (was 10 blocks underground)
//   eastgate_portal_office    66 -> 76   (was 10 blocks underground)
//   ...and fourteen more between 3 and 7 blocks out.
//
// This is the Chapter 1 instance of exactly the bug grove_waypoints.ts exists
// to fix: "a marker 17 blocks under the floor is a browser test that walks
// forever". It is also why Chapter 1 looked wrong in the world — Halden Rook
// was seeded 13 blocks above the bridge, Arbiter Vane 6 under the Returnstone
// pad, and Dr. Ardan 6 under the Greenlamp clinic floor.
//
// ch1_anchor_grounding.test.ts asserts every anchor stays within 2 blocks of
// the nearest measured surface, so this cannot drift again silently.
// ---------------------------------------------------------------------------

export type Ch1Vec3 = readonly [number, number, number];

export const CH1_ANCHORS = {
  // --- Grove hub ---
  jackie_post: [496, 71, -126],
  fountain_lesson_board: [494, 71, -129],
  taye_sign_post: [491, 71, -124],
  billy: [500, 71, -140],
  kit_mail_stand: [504, 71, -118],
  gus_baker: [486, 70, -126],
  fern_grower: [496, 70, -118],
  carlo_cook: [498, 70, -133],
  rin_forager: [510, 70, -155],
  mel_handyman: [488, 64, -218],
  luis_repair_cart: [486, 64, -209],
  grove_wishing_well: [490, 70, -148],
  grove_supply_chest: [496, 71, -138],
  grove_garden_gate: [502, 70, -145],
  old_grove_road_post: [500, 71, -140],
  muckwad_patch: [512, 71, -152],
  broken_safe_zone_fence: [514, 81, -198],
  crossroads_service_tower: [498, 65, -216],
  mosslawn_song_stones: [468, 50, -250],
  ranger_jane: [450, 50, -260],
  shutter_cove_photo_marker: [560, 74, -182],
  lovely_locks_mirror: [407, 75, -126],
  rat_crowns_den: [418, 56, -237],

  // --- Wider map ---
  old_wood_copse_sentinel: [640, 58, -455],
  // Roofed businesses use their canonical entrance/interior floor records,
  // never the nearest open-sky surface. The previous values were roof tops.
  greenlamp_clinic: [656, 65, -193],
  ashline_containment_works: [674, 67, -56],
  ashline_refinery_intake: [674, 67, -52],
  returnstone_pad_office: [42, 41, -41],
  lanternrest_road_inn: [606, 48, -496],
  muck_scarred_helix: [232, 33, -506],
  harthmere_bridge_center: [904, 58, -209],
  eastgate_portal_office: [1578, 76, -136],
  glassyard_biome_studio: [1183, 52, 138],
  biome_anchor_leak: [766, 70, 27],

  // --- The Grove road-house (Act 1 / Act 4 / Act 5 domestic beats) ---
  //
  // WHY THESE EXIST
  // Every Act 1 interior beat — waking, breakfast, the tea, the kit check, and
  // later the kettle, the tin and sleeping alone — used to alias to
  // `jackie_post`, which is the town FOUNTAIN CENTRE (496/-126). So "get out of
  // bed" and "watch Jackie make the tea" both resolved to a public plaza with
  // no bed, no kettle and no room, and the chapter opened by asking the player
  // to do domestic things in the middle of a square.
  //
  // The canonical voxel road-house occupies x=468..479, z=-137..-124. Ground
  // floor feet are Y=70 and the enclosed spare room above is Y=74. These are
  // interaction/feet positions, not open-sky roof samples.
  roadhouse_door: [474, 70, -137],
  // Building identification belongs beside the façade, never inside the
  // two-block-tall walkable entrance aperture.
  roadhouse_sign: [481, 70, -136],
  roadhouse_table: [474, 70, -129],
  roadhouse_hearth: [471, 70, -126],
  roadhouse_bed: [476, 74, -126],
  roadhouse_opening_spawn: [474, 74, -126],
  roadhouse_stores: [470, 70, -125],
  coretta_ledger_desk: [478, 70, -129],
  // Shared reconstruction set: the clear ground-floor aisle spans the full
  // road-house depth, so the authored -4m door and +9m running figure both
  // remain inside a real enclosed voxel interior. It is a memory set, not a
  // player-facing map landmark.
  memory_corridor_stage: [474, 70, -133],

  // Act 2 testimony route. These are twelve distinct, meaningful locations;
  // the next uncollected account becomes the active target and map aid.
  testimony_alva: [500, 70, -140],
  testimony_helsa: [483, 70, -133],
  testimony_grover: [486, 70, -143],
  testimony_coretta: [478, 70, -129],
  testimony_emily: [407, 74, -126],
  testimony_patsy: [498, 64, -216],
  testimony_richard: [486, 64, -209],
  testimony_runna: [548, 71, -170],
  testimony_drona: [468, 49, -250],
  testimony_gizela: [560, 73, -182],
  testimony_davi: [492, 64, -216],
  testimony_allix: [475, 70, -129],

  // Ashline. Calla Ashe runs the containment floor; the works anchor is the
  // building's own marker, so she stands two metres off it on the same measured
  // 72-feet surface rather than inside the marker.
  ashline_foreman_post: [672, 67, -54],

  // --- Chapter 1 authored spawns ---
  // Act 1 close: the ninety-second sighting at the open boundary-stones shelf.
  // The former [520,81,-205] column is a multi-level occupied building in the
  // production snapshot (roof Y=83, floors Y=79/72), so the gate, camera and
  // player were staged inside it. This is the measured grass feet-Y on the
  // open shelf seven metres east of the wall; keep the full hilly coordinate.
  gate_fence_sighting: [543, 69, -221],
  // Act 2 close: the first persistent gate. Dungeon 1 entrance.
  gate_desert: [648, 54, -462],
  // Act 5: the cold gate at the far edge of the anchor field. Dungeon 2.
  gate_winter: [232, 33, -506],
  // Act 6 epilogue: the gate that does not close. Shares the fence ridge with
  // gate_fence_sighting six metres away, so it shares its height.
  gate_prime: [524, 81, -210],
  // Act 6: a separate enclosed watch house south-west of the road-house.
  grove_watch_house_door: [473, 70, -152],
  grove_watch_house: [473, 70, -148],
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
  jackieReported: "ch1_jackie_reported",
  jackieStatementWithheld: "ch1_jackie_statement_withheld",
  dosingStopped: "ch1_dosing_stopped",
  dosingResumed: "ch1_dosing_resumed",
  teakDetained: "ch1_teak_detained",
  // Hidden: set by Calla Ashe's incident report, never surfaced to the player.
  collectiveConfirmedIdentity: "ch1_collective_confirmed_identity",

  act5Linking: "ch1_act5_linking",
  sorrelLetterRead: "ch1_sorrel_letter_read",
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
