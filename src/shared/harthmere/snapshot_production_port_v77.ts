// SNAPSHOT_PRODUCTION_PORT_V77
// Production/local dual-mode snapshot conversion contract.
// This layer does not replace v76 mission tests; it upgrades v76 from a local-dev-only
// bridge into a backend-aware system with concrete Bikkie ids, audio file bindings,
// canonical muck/photo/fishing mutation payloads, Grove player-builder presets, and
// NPC visual bounds audit data.

import { BikkieIds } from "@/shared/bikkie/ids";
import type { BiomesId } from "@/shared/ids";
import type { Vec3 } from "@/shared/math/types";
import {
  SNAPSHOT_GROVE_NPCS_V75,
  SNAPSHOT_GROVE_PLAYER_BUILDER_PRESETS_V75,
} from "@/shared/harthmere/snapshot_grove_content_v75";
import {
  SNAPSHOT_AUDIO_CUES_V76,
  SNAPSHOT_COMPLETE_PORT_VERSION_V76,
} from "@/shared/harthmere/snapshot_complete_port_v76";

export const SNAPSHOT_PRODUCTION_PORT_VERSION_V77 = "snapshot-production-port-v77" as const;
export const SNAPSHOT_DUAL_MODE_STATE_BACKEND_VERSION_V77 =
  "snapshot-dual-mode-state-backend-v77" as const;
export const SNAPSHOT_BIKKIE_BISCUIT_DECODE_VERSION_V77 =
  "snapshot-bikkie-biscuit-decode-v77" as const;
export const SNAPSHOT_FINAL_BIKKIE_REWARD_BINDING_VERSION_V77 =
  "snapshot-final-bikkie-reward-binding-v77" as const;
export const SNAPSHOT_AUDIO_FILE_BINDING_VERSION_V77 =
  "snapshot-audio-file-binding-v77" as const;
export const SNAPSHOT_CANONICAL_MUCK_WORLD_MUTATION_VERSION_V77 =
  "snapshot-canonical-muck-world-mutation-v77" as const;
export const SNAPSHOT_GROVE_PLAYER_BUILDER_UI_VERSION_V77 =
  "snapshot-grove-player-builder-ui-v77" as const;
export const SNAPSHOT_GROVE_NPC_BOUNDS_PASS_VERSION_V77 =
  "snapshot-grove-npc-visual-bounds-pass-v77" as const;

export type SnapshotStateBackendModeV77 =
  | "auto"
  | "local_dev"
  | "production_api"
  | "production_api_with_local_fallback";

export interface SnapshotBackendIdentityV77 {
  installId?: string;
  gameUserId?: string;
  userId?: BiomesId;
  sessionId?: string;
  titleId?: string;
}

export interface SnapshotProgressMutationV77 {
  kind:
    | "sync_state"
    | "accept_mission"
    | "complete_step"
    | "complete_mission"
    | "grant_reward"
    | "clear_muck"
    | "photo_proof"
    | "fishing_catch"
    | "audio_cue";
  missionId?: string;
  stepId?: string;
  markerId?: string;
  rewardId?: string;
  itemSymbols?: string[];
  audioCue?: string;
  proofId?: string;
  catchId?: string;
  position?: Vec3;
  state?: Record<string, unknown>;
  occurredAtMs: number;
}

export interface SnapshotBackendStateV77 {
  version: typeof SNAPSHOT_PRODUCTION_PORT_VERSION_V77;
  v76Version: typeof SNAPSHOT_COMPLETE_PORT_VERSION_V76;
  acceptedMissionIds: string[];
  activeMissionId?: string;
  activeStepIndex: number;
  completedMissionIds: string[];
  completedStepIds: string[];
  grantedRewardIds: string[];
  grantedItemSymbols: string[];
  grantedBikkieItems: SnapshotResolvedBikkieRewardV77[];
  xp: number;
  bling: number;
  audioCueIds: string[];
  photoProofIds: string[];
  fishingCatchIds: string[];
  clearedMuckIds: string[];
  mutations: SnapshotProgressMutationV77[];
  updatedAtMs: number;
}

export interface SnapshotResolvedBikkieRewardV77 {
  symbol: string;
  bikkieId: BiomesId;
  bikkieName: keyof typeof BikkieIds;
  quantity: number;
  source: "snapshot_static" | "bikkie_ids" | "closest_existing_item";
  note: string;
}

export interface SnapshotAudioFileBindingV77 {
  cueId: string;
  assetKey: string;
  staticPath: string;
  fallbackCueId?: string;
  purpose: string;
}

export interface SnapshotGrovePlayerBuilderPresetV77 {
  id: string;
  label: string;
  description: string;
  sourcePresetId: (typeof SNAPSHOT_GROVE_PLAYER_BUILDER_PRESETS_V75)[number]["id"];
  clothingIds: {
    head?: string;
    torso?: string;
    legs?: string;
    feet?: string;
    hands?: string;
    belt?: string;
    back?: string;
    weapon?: string;
  };
  bodyHints: string[];
  faceHints: string[];
}

export interface SnapshotNpcVisualBoundsV77 {
  npcId: string;
  displayName: string;
  assetNamePattern: string;
  modelMinY: number;
  modelMaxY: number;
  modelHeight: number;
  authoredFeetY: number;
  expectedGroundY: number;
  recommendedWorldYOffset: number;
  decision: "server_grounded_actor" | "hide_raw_decorative_copy" | "asset_origin_ok";
  note: string;
}

export const SNAPSHOT_STATE_ENDPOINT_V77 = "/api/glitch/snapshot_progress" as const;

export const SNAPSHOT_STATE_BACKEND_RULES_V77 = {
  version: SNAPSHOT_DUAL_MODE_STATE_BACKEND_VERSION_V77,
  endpoint: SNAPSHOT_STATE_ENDPOINT_V77,
  localStorageModeKey: "biomes.snapshot.backendMode.v77",
  localDevStateKey: "biomes.localDev.snapshotCompletePortState.v76",
  productionRequiresAny: [
    "GLITCH_INSTALL_ID from URL/localStorage",
    "GLITCH_USER_INSTALL_ID from URL/localStorage",
    "GLITCH_SNAPSHOT_PROGRESS_BACKEND_URL on the server",
  ],
  modeBehavior: {
    local_dev:
      "Use browser/local dev state and also mirror to the local Next API in-memory store for testing.",
    production_api:
      "Write progress/muck/photo/fishing mutations through /api/glitch/snapshot_progress; the API forwards to GLITCH_SNAPSHOT_PROGRESS_BACKEND_URL when configured.",
    production_api_with_local_fallback:
      "Try production API first and keep the v76 local state as a durable-on-client fallback if the configured backend is down.",
  },
} as const;

export const SNAPSHOT_FINAL_BIKKIE_REWARD_IDS_V77: Record<string, SnapshotResolvedBikkieRewardV77> = {
  road_ahead_map_layer: {
    symbol: "road_ahead_map_layer",
    bikkieId: BikkieIds.smallOakSign,
    bikkieName: "smallOakSign",
    quantity: 1,
    source: "closest_existing_item",
    note: "Map layer is represented by a readable sign/route token until a dedicated map-layer biscuit exists.",
  },
  muckwad_sample: {
    symbol: "muckwad_sample",
    bikkieId: BikkieIds.muckerMeat,
    bikkieName: "muckerMeat",
    quantity: 1,
    source: "closest_existing_item",
    note: "Snapshot has muckwad terrain/static meshes; the closest inventory-safe sample item is muckerMeat.",
  },
  road_repair_block_bundle: {
    symbol: "road_repair_block_bundle",
    bikkieId: BikkieIds.lumber,
    bikkieName: "lumber",
    quantity: 5,
    source: "bikkie_ids",
    note: "Road repair bundle resolves to lumber for production inventory grants.",
  },
  grove_travel_top: {
    symbol: "grove_travel_top",
    bikkieId: BikkieIds.grassyTop,
    bikkieName: "grassyTop",
    quantity: 1,
    source: "bikkie_ids",
    note: "Starter Grove top uses the existing grassy/mucky wearable mesh family.",
  },
  grove_travel_bottoms: {
    symbol: "grove_travel_bottoms",
    bikkieId: BikkieIds.bellBottoms,
    bikkieName: "bellBottoms",
    quantity: 1,
    source: "bikkie_ids",
    note: "Starter Grove bottoms use an existing bottoms wearable so rewards are grantable in production.",
  },
  travel_boots: {
    symbol: "travel_boots",
    bikkieId: BikkieIds.boots,
    bikkieName: "boots",
    quantity: 1,
    source: "bikkie_ids",
    note: "Existing boots biscuit for player-builder and starter clothing grants.",
  },
  road_snack: {
    symbol: "road_snack",
    bikkieId: BikkieIds.bizzyCola,
    bikkieName: "bizzyCola",
    quantity: 1,
    source: "closest_existing_item",
    note: "Temporary food/drink reward mapped to existing consumable.",
  },
  cove_photo_frame: {
    symbol: "cove_photo_frame",
    bikkieId: BikkieIds.oakFrameSmall,
    bikkieName: "oakFrameSmall",
    quantity: 1,
    source: "bikkie_ids",
    note: "Photo proof reward uses a frame item already present in Bikkie.",
  },
  rough_repair_wood: {
    symbol: "rough_repair_wood",
    bikkieId: BikkieIds.oakLog,
    bikkieName: "oakLog",
    quantity: 3,
    source: "bikkie_ids",
    note: "Wooden axe/repair material reward resolves to oak logs.",
  },
  practice_muck_buster: {
    symbol: "practice_muck_buster",
    bikkieId: BikkieIds.muckBuster,
    bikkieName: "muckBuster",
    quantity: 1,
    source: "bikkie_ids",
    note: "Official Muck Buster item id.",
  },
  camera: {
    symbol: "camera",
    bikkieId: BikkieIds.camera,
    bikkieName: "camera",
    quantity: 1,
    source: "bikkie_ids",
    note: "Existing camera item id for Shutter Cove/camera quests.",
  },
  fish: {
    symbol: "fish",
    bikkieId: BikkieIds.fish,
    bikkieName: "fish",
    quantity: 1,
    source: "bikkie_ids",
    note: "Generic fish reward from Shutter Cove catch table.",
  },
  muckwater_fish: {
    symbol: "muckwater_fish",
    bikkieId: BikkieIds.muckwaterFish,
    bikkieName: "muckwaterFish",
    quantity: 1,
    source: "bikkie_ids",
    note: "Muck-tangled catch result.",
  },

  loose_sign_nail: {
    symbol: "loose_sign_nail",
    bikkieId: BikkieIds.smallOakSign,
    bikkieName: "smallOakSign",
    quantity: 1,
    source: "closest_existing_item",
    note: "Small sign token stands in for a recovered nail/sign repair proof until a dedicated nail biscuit exists.",
  },
  cosmetic_marker_decal: {
    symbol: "cosmetic_marker_decal",
    bikkieId: BikkieIds.flowerCrown,
    bikkieName: "flowerCrown",
    quantity: 1,
    source: "closest_existing_item",
    note: "Cosmetic decal reward maps to an existing decorative wearable item.",
  },
  road_blocks_x5: {
    symbol: "road_blocks_x5",
    bikkieId: BikkieIds.lumber,
    bikkieName: "lumber",
    quantity: 5,
    source: "bikkie_ids",
    note: "Road block bundle resolves to lumber in production grants.",
  },
  luis_repair_note: {
    symbol: "luis_repair_note",
    bikkieId: BikkieIds.recipePaper,
    bikkieName: "recipePaper",
    quantity: 1,
    source: "closest_existing_item",
    note: "Repair note is represented as recipe paper until a Grove note biscuit exists.",
  },
  ranger_token: {
    symbol: "ranger_token",
    bikkieId: BikkieIds.poncho,
    bikkieName: "poncho",
    quantity: 1,
    source: "closest_existing_item",
    note: "Ranger token resolves to an outdoors wearable token.",
  },
  mosslawn_songline_recording: {
    symbol: "mosslawn_songline_recording",
    bikkieId: BikkieIds.recordPlayer,
    bikkieName: "recordPlayer",
    quantity: 1,
    source: "closest_existing_item",
    note: "Songline recording maps to the existing record player object.",
  },
  anti_muck_poultice: {
    symbol: "anti_muck_poultice",
    bikkieId: BikkieIds.fertilizer,
    bikkieName: "fertilizer",
    quantity: 1,
    source: "closest_existing_item",
    note: "Poultice maps to fertilizer/plant-care item until a medical sample biscuit exists.",
  },
  road_snacks: {
    symbol: "road_snacks",
    bikkieId: BikkieIds.fruit,
    bikkieName: "fruit",
    quantity: 3,
    source: "closest_existing_item",
    note: "Old Coop's snack reward uses existing fruit item.",
  },
  old_route_clue: {
    symbol: "old_route_clue",
    bikkieId: BikkieIds.recipePaper,
    bikkieName: "recipePaper",
    quantity: 1,
    source: "closest_existing_item",
    note: "Route clue is represented by paper until a clue/codex item exists.",
  },
  buddy_memory_fragment: {
    symbol: "buddy_memory_fragment",
    bikkieId: BikkieIds.robotModule,
    bikkieName: "robotModule",
    quantity: 1,
    source: "bikkie_ids",
    note: "Buddy memory fragment uses the existing robot module item.",
  },
  navigation_beam_upgrade: {
    symbol: "navigation_beam_upgrade",
    bikkieId: BikkieIds.blueprintNetworkTower,
    bikkieName: "blueprintNetworkTower",
    quantity: 1,
    source: "closest_existing_item",
    note: "Navigation upgrade maps to network tower blueprint.",
  },
  jackies_sealed_letter: {
    symbol: "jackies_sealed_letter",
    bikkieId: BikkieIds.parcel,
    bikkieName: "parcel",
    quantity: 1,
    source: "bikkie_ids",
    note: "Jackie's sealed letter resolves to the parcel item.",
  },
  brams_stamped_pass: {
    symbol: "brams_stamped_pass",
    bikkieId: BikkieIds.recipePaper,
    bikkieName: "recipePaper",
    quantity: 1,
    source: "closest_existing_item",
    note: "Bram's pass is represented by paper until a pass biscuit exists.",
  },
  watch_ranger_report: {
    symbol: "watch_ranger_report",
    bikkieId: BikkieIds.recipePaper,
    bikkieName: "recipePaper",
    quantity: 1,
    source: "closest_existing_item",
    note: "Ranger report is represented by paper until a report biscuit exists.",
  },
  bolt_order: {
    symbol: "bolt_order",
    bikkieId: BikkieIds.recipePaper,
    bikkieName: "recipePaper",
    quantity: 1,
    source: "closest_existing_item",
    note: "Market bolt order maps to paper.",
  },
  bolt_crates: {
    symbol: "bolt_crates",
    bikkieId: BikkieIds.woodContainer,
    bikkieName: "woodContainer",
    quantity: 1,
    source: "closest_existing_item",
    note: "Bolt crates map to an existing wood container object.",
  },
  sealed_muck_sample: {
    symbol: "sealed_muck_sample",
    bikkieId: BikkieIds.muckerMeat,
    bikkieName: "muckerMeat",
    quantity: 1,
    source: "closest_existing_item",
    note: "Sealed muck sample uses the same grantable item as muckwad sample.",
  },
  chapel_lore_note: {
    symbol: "chapel_lore_note",
    bikkieId: BikkieIds.recipePaper,
    bikkieName: "recipePaper",
    quantity: 1,
    source: "closest_existing_item",
    note: "Chapel lore note is represented by paper until a codex item exists.",
  },
  sils_tuning_strip: {
    symbol: "sils_tuning_strip",
    bikkieId: BikkieIds.recordPlayer,
    bikkieName: "recordPlayer",
    quantity: 1,
    source: "closest_existing_item",
    note: "Sil's tuning strip maps to audio/music proof through recordPlayer.",
  },
  black_anvil_marked_strip: {
    symbol: "black_anvil_marked_strip",
    bikkieId: BikkieIds.recipePaper,
    bikkieName: "recipePaper",
    quantity: 1,
    source: "closest_existing_item",
    note: "Marked strip maps to paper until a metal-strip biscuit exists.",
  },
  recipe_road_repair_kit: {
    symbol: "recipe_road_repair_kit",
    bikkieId: BikkieIds.recipePaper,
    bikkieName: "recipePaper",
    quantity: 1,
    source: "closest_existing_item",
    note: "Recipe unlock represented by recipePaper until a dedicated road-repair recipe biscuit is created.",
  },
};

export function snapshotResolveRewardItemV77(symbol: string): SnapshotResolvedBikkieRewardV77 | undefined {
  return SNAPSHOT_FINAL_BIKKIE_REWARD_IDS_V77[symbol];
}

export function snapshotResolveRewardItemsV77(symbols: readonly string[]): SnapshotResolvedBikkieRewardV77[] {
  return symbols
    .map((symbol) => SNAPSHOT_FINAL_BIKKIE_REWARD_IDS_V77[symbol])
    .filter((entry): entry is SnapshotResolvedBikkieRewardV77 => Boolean(entry));
}

export const SNAPSHOT_AUDIO_FILE_BINDINGS_V77: readonly SnapshotAudioFileBindingV77[] = [
  {
    cueId: SNAPSHOT_AUDIO_CUES_V76.stepBegin,
    assetKey: "challenge_progress",
    staticPath: "/assets/asset_data/audio/challenge-progress.1ce0cc7be90e9e9e9f1a8e3ced664cd6.webm",
    purpose: "Mission step begins or updates.",
  },
  {
    cueId: SNAPSHOT_AUDIO_CUES_V76.stepComplete,
    assetKey: "challenge_progress",
    staticPath: "/assets/asset_data/audio/challenge-progress.1ce0cc7be90e9e9e9f1a8e3ced664cd6.webm",
    purpose: "Mission step completed but full quest is still active.",
  },
  {
    cueId: SNAPSHOT_AUDIO_CUES_V76.questComplete,
    assetKey: "challenge_complete",
    staticPath: "/assets/asset_data/audio/challenge-complete.ee51b1c1b3de622e3c5153c162cc4822.webm",
    purpose: "Quest completed.",
  },
  {
    cueId: SNAPSHOT_AUDIO_CUES_V76.reward,
    assetKey: "bling_collect",
    staticPath: "/assets/asset_data/audio/bling-collect.0b6be4d97d81252dd59f6e7da9939621.webm",
    purpose: "Reward/bling grant.",
  },
  {
    cueId: SNAPSHOT_AUDIO_CUES_V76.muckBreak,
    assetKey: "block_break",
    staticPath: "/assets/asset_data/audio/block-break-1.dcf601f110e3cd338716a98b12310205.webm",
    purpose: "Break muck or road debris.",
  },
  {
    cueId: SNAPSHOT_AUDIO_CUES_V76.muckClear,
    assetKey: "muck_music",
    staticPath: "/assets/asset_data/audio/muck-music-1.cd39f05d603332e894ecebba0d0c988c.webm",
    fallbackCueId: SNAPSHOT_AUDIO_CUES_V76.muckBreak,
    purpose: "Clear a persistent muck objective.",
  },
  {
    cueId: SNAPSHOT_AUDIO_CUES_V76.muckerHit,
    assetKey: "npc_mucker_on_hit",
    staticPath: "/assets/asset_data/audio/npc-mucker-on-hit-1.e30a71f9d051b9c7507854704afef368.webm",
    purpose: "Mucker hit feedback.",
  },
  {
    cueId: SNAPSHOT_AUDIO_CUES_V76.muckerDown,
    assetKey: "npc_mucker_on_death",
    staticPath: "/assets/asset_data/audio/npc-mucker-on-death-1.ad1a7849391ec39ed354dc1e5c59e5ad.webm",
    purpose: "Mucker defeated feedback.",
  },
  {
    cueId: SNAPSHOT_AUDIO_CUES_V76.cameraShutter,
    assetKey: "camera_shutter",
    staticPath: "/assets/asset_data/audio/camera-shutter.036ed4d8ace0ebb321c1108cc9347774.webm",
    purpose: "Shutter Cove camera/photo proof.",
  },
  {
    cueId: SNAPSHOT_AUDIO_CUES_V76.fishingCast,
    assetKey: "fish_cast",
    staticPath: "/assets/asset_data/audio/fish-cast.f680f8a7b49fb492ec65c0cca95c26ea.webm",
    purpose: "Fishing cast.",
  },
  {
    cueId: SNAPSHOT_AUDIO_CUES_V76.fishingCatch,
    assetKey: "fish_reel",
    staticPath: "/assets/asset_data/audio/fish-reel.db4d743aecaea34f19b9af07e816ef9a.webm",
    purpose: "Fishing catch/reel success.",
  },
  {
    cueId: SNAPSHOT_AUDIO_CUES_V76.marketBoardActivate,
    assetKey: "dialog_open",
    staticPath: "/assets/asset_data/audio/dialog-open.d1fd8ab00c7f155a8c1aabef317e7ad1.webm",
    purpose: "Market board quest-router activation.",
  },
] as const;

export function snapshotAudioBindingForCueV77(cueId: string): SnapshotAudioFileBindingV77 | undefined {
  return SNAPSHOT_AUDIO_FILE_BINDINGS_V77.find((entry) => entry.cueId === cueId);
}

export const SNAPSHOT_CANONICAL_MUCK_MUTATIONS_V77 = {
  version: SNAPSHOT_CANONICAL_MUCK_WORLD_MUTATION_VERSION_V77,
  mutationKind: "clear_muck",
  endpoint: SNAPSHOT_STATE_ENDPOINT_V77,
  serverPayloadFields: ["installId", "gameUserId", "markerId", "position", "missionId", "stepId", "occurredAtMs"],
  localFallbackKey: "biomes.localDev.snapshotClearedMuck.v76",
  productionRule:
    "In production, clear_muck is sent to the backend first. The v76 localStorage key remains as an offline/local-dev mirror only.",
} as const;

export const SNAPSHOT_GROVE_PLAYER_BUILDER_PRESETS_V77: readonly SnapshotGrovePlayerBuilderPresetV77[] = [
  {
    id: "grove_wayfinder_v77",
    label: "Grove Wayfinder",
    sourcePresetId: "grove_wayfinder",
    description: "Jackie-style road readiness: warm starter colors, backpack, gloves, and practical boots.",
    clothingIds: {
      head: "hunter_cap",
      torso: "forest_tunic",
      legs: "earth_trousers",
      feet: "travel_boots",
      hands: "fingerless_gloves",
      belt: "rope_belt",
      back: "bedroll_pack",
    },
    bodyHints: ["average", "relaxed", "road-ready"],
    faceHints: ["warm", "approachable", "starter-trust"],
  },
  {
    id: "lovely_locks_traveler_v77",
    label: "Lovely Locks Traveler",
    sourcePresetId: "lovely_locks_traveler",
    description: "Alexis/Lovely Locks identity preset: polished colors, social-readiness, clean boots, and a photo-friendly silhouette.",
    clothingIds: {
      head: "noble_cap",
      torso: "merchant_coat",
      legs: "royal_trousers",
      feet: "soft_shoes",
      belt: "ledger_belt",
      back: "merchant_satchel",
    },
    bodyHints: ["upright", "soft", "styled"],
    faceHints: ["expressive", "photo-ready", "self-authored"],
  },
  {
    id: "mosslawn_scout_v77",
    label: "Mosslawn Scout",
    sourcePresetId: "mosslawn_scout",
    description: "Ranger Jane/Mosslawn preset: muted green-brown trail gear, gloves, and field pack.",
    clothingIds: {
      head: "hunter_cap",
      torso: "hunter_jerkin",
      legs: "patched_trousers",
      feet: "travel_boots",
      hands: "fingerless_gloves",
      belt: "rope_belt",
      back: "quiver_and_bedroll",
    },
    bodyHints: ["athletic", "reserved", "trail-readiness"],
    faceHints: ["focused", "dry", "observant"],
  },
  {
    id: "shutter_cove_lenskeeper_v77",
    label: "Shutter Cove Lenskeeper",
    sourcePresetId: "shutter_cove_lenskeeper",
    description: "Dimmi/Shutter Cove preset: camera-social explorer kit with blues, satchel, and soft travel shoes.",
    clothingIds: {
      head: "noble_cap",
      torso: "dock_worker_coat",
      legs: "patched_trousers",
      feet: "soft_shoes",
      belt: "tool_belt",
      back: "merchant_satchel",
    },
    bodyHints: ["slim", "curious", "cove-ready"],
    faceHints: ["skeptical", "bright-eyed", "evidence-first"],
  },
] as const;

const groveNpcByIdV77 = Object.fromEntries(SNAPSHOT_GROVE_NPCS_V75.map((npc) => [npc.id, npc]));

export const SNAPSHOT_GROVE_NPC_VISUAL_BOUNDS_V77: readonly SnapshotNpcVisualBoundsV77[] = [
  ["jackie", "jackie", 0, 15.3],
  ["ranger_jane", "ranger_jane", 0, 15.3],
  ["luis", "luis", 0, 15.3],
  ["taye", "taye", 0, 15.3],
  ["alexis", "alexis", 0, 15.9],
  ["sil", "sil", 0, 15.6],
  ["dimmi", "dimmi", 0, 15.3],
  ["doc", "doc", 0, 15.3],
  ["old_coop", "oldCoop", 0, 15.3],
  ["buddy", "buddy", 0, 18.333333315],
  ["mucked_robot", "mucked_robot", 0, 20.5],
].map(([npcId, pattern, minY, maxY]) => {
  const npc = groveNpcByIdV77[String(npcId)];
  const authoredFeetY = npc?.authoredPosition[1] ?? 53;
  const expectedGroundY = 52;
  return {
    npcId: String(npcId),
    displayName: npc?.displayName ?? String(npcId),
    assetNamePattern: String(pattern),
    modelMinY: Number(minY),
    modelMaxY: Number(maxY),
    modelHeight: Number(maxY) - Number(minY),
    authoredFeetY,
    expectedGroundY,
    recommendedWorldYOffset: expectedGroundY - authoredFeetY,
    decision: npc?.seedServerNpc === false ? "hide_raw_decorative_copy" : "server_grounded_actor",
    note:
      "Bounds pass confirms the raw snapshot GLB/gltf visual origin is at model feet (minY≈0), but those raw decorative copies are large and must not be used as independent floating actors. Use grounded ECS/server NPCs and hide duplicate raw placements.",
  } satisfies SnapshotNpcVisualBoundsV77;
}) as readonly SnapshotNpcVisualBoundsV77[];

export const SNAPSHOT_NON_NUX_BIKKIE_DECODE_TARGETS_V77 = {
  version: SNAPSHOT_BIKKIE_BISCUIT_DECODE_VERSION_V77,
  directories: [
    "public/buckets/biomes-bikkie",
    "public/buckets/biomes-static",
    "public/assets/biomes-static",
    "tmp/snapshot-challenge-extraction-v76.json",
    "src/shared/triggers/state_machines.ts",
  ],
  terms: ["challenge", "quest", "mission", "task", "trigger", "pairedStep", "Road Ahead", "Busted", "Muck Buster"],
  knownNuxPairedStepCount: 9,
  output: "tmp/snapshot-bikkie-challenge-decode-v77.json",
  rule:
    "Keep readable NUX state-machine steps as source of truth unless this decoder finds richer biscuits with explicit player-facing challenge/quest semantics.",
} as const;

export const SNAPSHOT_REMAINING_AFTER_V77 = [
  "Create dedicated Grove/Harthmere Bikkie biscuits for any reward symbols currently mapped to closest existing items.",
  "Replace the generic snapshot_progress forwarding URL with the final Glitch production endpoint name if the backend team chooses a different route.",
  "Run the v77 bounds audit against the exact installed public/buckets/biomes-static directory after every snapshot refresh.",
  "Move v77 in-memory API store to the selected production database/table for permanent server-side saves.",
] as const;
