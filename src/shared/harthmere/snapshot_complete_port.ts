// SNAPSHOT_COMPLETE_PORT
// Final snapshot-content bridge layer for the 2026-05-16 Biomes snapshot conversion.
// This file is deliberately shared/data-first: mission runtime, Harthmere NPC dialogue,
// map checks, grounding checks, reward/audio systems, and regression tests should all
// read this instead of copying coordinates or quest state in separate components.

import type { BiomesId } from "@/shared/ids";
import type { Vec3 } from "@/shared/math/types";
import {
  SNAPSHOT_GROVE_LANDMARKS,
  SNAPSHOT_GROVE_NPCS,
  SNAPSHOT_GROVE_NPC_FEET_Y,
  SNAPSHOT_GROVE_QUESTS,
  SNAPSHOT_GROVE_WORLD_GROUND_Y,
  snapshotGroveLandmarkById,
  snapshotGroveNpcEntityId,
  type SnapshotGroveQuest,
} from "@/shared/harthmere/snapshot_grove_content";

export const SNAPSHOT_COMPLETE_PORT_VERSION = "snapshot-complete-port";
export const SNAPSHOT_CANONICAL_CHALLENGE_EXTRACTION_VERSION =
  "snapshot-canonical-nux-challenge-extraction";
export const SNAPSHOT_SERVER_COMPLETION_STATE_VERSION =
  "snapshot-server-completion-state-contract";
export const SNAPSHOT_MISSION_TEST_MATRIX_VERSION =
  "snapshot-mission-test-matrix";
export const SNAPSHOT_GROVE_FOOT_CLEARANCE_AUDIT_VERSION =
  "snapshot-grove-foot-clearance-audit";
export const SNAPSHOT_HARTHMERE_BIBLE_NPC_UPGRADE_VERSION =
  "snapshot-harthmere-bible-npc-upgrade";

export const SNAPSHOT_GROVE_MAX_FEET_CLEARANCE = 0.25;
export const SNAPSHOT_GROVE_EXPECTED_FEET_Y = SNAPSHOT_GROVE_NPC_FEET_Y;
export const SNAPSHOT_GROVE_EXPECTED_VISUAL_GROUND_Y = SNAPSHOT_GROVE_WORLD_GROUND_Y;

export type SnapshotCanonicalMissionTrigger =
  | "talk_npc"
  | "near_location"
  | "destroy"
  | "place_voxel"
  | "open_tab"
  | "inventory_change"
  | "selection_change"
  | "jump"
  | "photo_post_attempt"
  | "show_post_capture"
  | "craft"
  | "interact"
  | "collect"
  | "combat"
  | "choice"
  | "fishing_catch"
  | "clear_muck";

export interface SnapshotCanonicalChallenge {
  id: string;
  source: "snapshot_nux_state_machine" | "grove_bible" | "harthmere_bridge";
  pairedStepId?: BiomesId;
  title: string;
  objective: string;
  expectedStatusFlow: readonly ["available", "accepted", "active", "complete"];
  trigger: SnapshotCanonicalMissionTrigger;
  markerId: string;
  markerMustAppear: boolean;
  markerMustAutoRemove: boolean;
  rewardIds: readonly string[];
  itemGrantIds: readonly string[];
  audioCueIds: readonly string[];
}

export interface SnapshotStructuredReward {
  id: string;
  questId: string;
  xp: number;
  bling: number;
  items: string[];
  recipes: string[];
  codex: string[];
  reputation: string[];
  audioCue: string;
}

export interface SnapshotMissionTestCase {
  id: string;
  questId: string;
  title: string;
  stepIndex: number;
  objective: string;
  trigger: SnapshotCanonicalMissionTrigger;
  markerId: string;
  expectedMarkerLabel: string;
  expectedMarkerPosition: Vec3;
  expectedMarkerAppears: true;
  expectedMarkerRemovesOnComplete: true;
  expectedStateBefore: "available" | "accepted" | "active";
  expectedStateAfter: "active" | "complete";
  expectedRewardIds: string[];
  expectedInventoryItems: string[];
  expectedAudioCue: string;
}

export interface SnapshotFootClearanceRecord {
  npcId: string;
  displayName: string;
  entityId: BiomesId;
  expectedFeetY: number;
  authoredFeetY: number;
  authoredClearance: number;
  pass: boolean;
  note: string;
}

export interface SnapshotHarthmereNpcBibleProfile {
  offset: number;
  id: string;
  displayName: string;
  district: string;
  role: string;
  background: string;
  motivation: string;
  groveContrast: string;
  voiceLine: string;
  likeabilityTags: string[];
  questAffinity: string[];
}

// Official source-backed NUX/tutorial chain from the snapshot's state_machines.ts.
// The paired step ids are the hard snapshot ids, not invented local IDs.
export const SNAPSHOT_OFFICIAL_NUX_CHALLENGES: readonly SnapshotCanonicalChallenge[] = [
  {
    id: "road_ahead_meet_up_with_billy",
    source: "snapshot_nux_state_machine",
    pairedStepId: 166072605041642 as BiomesId,
    title: "Road Ahead: Meet Billy / Road Post",
    objective: "Follow Jackie's marker toward the first Old Grove Road post.",
    expectedStatusFlow: ["available", "accepted", "active", "complete"],
    trigger: "near_location",
    markerId: "old_grove_road_post",
    markerMustAppear: true,
    markerMustAutoRemove: true,
    rewardIds: ["road_ahead_map_layer", "xp_35"],
    itemGrantIds: [],
    audioCueIds: ["snapshot.quest.step.complete"],
  },
  {
    id: "road_ahead_collect_muckwad",
    source: "snapshot_nux_state_machine",
    pairedStepId: 3623277001113501 as BiomesId,
    title: "Road Ahead: Collect Muckwad",
    objective: "Break a muckwad or other non-flora terrain block near the road.",
    expectedStatusFlow: ["available", "accepted", "active", "complete"],
    trigger: "destroy",
    markerId: "muckwad_patch",
    markerMustAppear: true,
    markerMustAutoRemove: true,
    rewardIds: ["muck_handling_practice", "xp_35"],
    itemGrantIds: ["muckwad_sample"],
    audioCueIds: ["snapshot.muck.break", "snapshot.quest.step.complete"],
  },
  {
    id: "road_ahead_place_blocks",
    source: "snapshot_nux_state_machine",
    pairedStepId: 5660250530071909 as BiomesId,
    title: "Road Ahead: Place Blocks",
    objective: "Select any block and place it at the road repair practice spot.",
    expectedStatusFlow: ["available", "accepted", "active", "complete"],
    trigger: "place_voxel",
    markerId: "building_practice_spot",
    markerMustAppear: true,
    markerMustAutoRemove: true,
    rewardIds: ["builder_footing_practice", "xp_35"],
    itemGrantIds: ["road_repair_block_bundle"],
    audioCueIds: ["snapshot.build.place", "snapshot.quest.step.complete"],
  },
  {
    id: "road_ahead_wear",
    source: "snapshot_nux_state_machine",
    pairedStepId: 4273096364377975 as BiomesId,
    title: "Road Ahead: Wear Clothing",
    objective: "Equip top and bottoms from inventory.",
    expectedStatusFlow: ["available", "accepted", "active", "complete"],
    trigger: "inventory_change",
    markerId: "lovely_locks_mirror",
    markerMustAppear: true,
    markerMustAutoRemove: true,
    rewardIds: ["prepared_traveler_practice", "xp_35"],
    itemGrantIds: ["grove_travel_top", "grove_travel_bottoms"],
    audioCueIds: ["snapshot.inventory.equip", "snapshot.quest.step.complete"],
  },
  {
    id: "road_ahead_find_bag",
    source: "snapshot_nux_state_machine",
    pairedStepId: 7786806792035454 as BiomesId,
    title: "Road Ahead: Find Bag / Run and Jump",
    objective: "Sprint and jump while moving on the marked stretch of road.",
    expectedStatusFlow: ["available", "accepted", "active", "complete"],
    trigger: "jump",
    markerId: "road_jump_stretch",
    markerMustAppear: true,
    markerMustAutoRemove: true,
    rewardIds: ["movement_practice", "xp_35"],
    itemGrantIds: ["road_snack"],
    audioCueIds: ["snapshot.movement.jump", "snapshot.quest.step.complete"],
  },
  {
    id: "road_ahead_selfie",
    source: "snapshot_nux_state_machine",
    pairedStepId: 8903834562824062 as BiomesId,
    title: "Road Ahead: Selfie",
    objective: "Use the camera flow and attempt to post or save a photo.",
    expectedStatusFlow: ["available", "accepted", "active", "complete"],
    trigger: "photo_post_attempt",
    markerId: "selfie_overlook",
    markerMustAppear: true,
    markerMustAutoRemove: true,
    rewardIds: ["photo_proof_practice", "xp_35"],
    itemGrantIds: ["cove_photo_frame"],
    audioCueIds: ["snapshot.camera.shutter", "snapshot.quest.step.complete"],
  },
  {
    id: "busted_wooden_axe",
    source: "snapshot_nux_state_machine",
    pairedStepId: 4478447552347541 as BiomesId,
    title: "Busted: Wooden Axe",
    objective: "Gather one more breakable block or timber piece for repair material.",
    expectedStatusFlow: ["available", "accepted", "active", "complete"],
    trigger: "destroy",
    markerId: "muckwad_patch",
    markerMustAppear: true,
    markerMustAutoRemove: true,
    rewardIds: ["repair_material_practice", "xp_35"],
    itemGrantIds: ["rough_repair_wood"],
    audioCueIds: ["snapshot.block.break", "snapshot.quest.step.complete"],
  },
  {
    id: "busted_muck_busters",
    source: "snapshot_nux_state_machine",
    pairedStepId: 6113676978673631 as BiomesId,
    title: "Busted: Muck Busters",
    objective: "Craft or obtain a Muck Buster.",
    expectedStatusFlow: ["available", "accepted", "active", "complete"],
    trigger: "craft",
    markerId: "service_tower_platform",
    markerMustAppear: true,
    markerMustAutoRemove: true,
    rewardIds: ["muck_buster_practice", "xp_35", "road_ready_milestone"],
    itemGrantIds: ["practice_muck_buster"],
    audioCueIds: ["snapshot.craft.complete", "snapshot.quest.complete"],
  },
];

function questRewardXp(quest: SnapshotGroveQuest): number {
  const match = quest.reward.match(/(\d+)\s*XP/i);
  return match ? Number(match[1]) : quest.connectorToHarthmere ? 90 : 45;
}

function questRewardBling(quest: SnapshotGroveQuest): number {
  const match = quest.reward.match(/(\d+)\s*bling/i);
  return match ? Number(match[1]) : quest.connectorToHarthmere ? 25 : 15;
}

function structuredItemsForQuest(quest: SnapshotGroveQuest): string[] {
  const byQuest: Record<string, string[]> = {
    road_signs_and_small_lies: ["loose_sign_nail", "road_ahead_map_layer"],
    color_that_still_points_home: ["cosmetic_marker_decal"],
    cart_that_forgot_its_wheel: ["road_blocks_x5", "luis_repair_note"],
    road_ready_not_fancy: ["grove_travel_top", "grove_travel_bottoms", "travel_boots"],
    moss_that_went_quiet: ["ranger_token"],
    songline_under_the_lawn: ["mosslawn_songline_recording"],
    sticky_medicine: ["anti_muck_poultice"],
    cove_keeps_pictures: ["cove_photo_frame"],
    coops_key_hen: ["road_snacks", "old_route_clue"],
    tower_with_a_headache: ["buddy_memory_fragment", "navigation_beam_upgrade"],
    letter_for_the_north_gate: ["jackies_sealed_letter", "brams_stamped_pass"],
    antlers_for_the_watch: ["watch_ranger_report"],
    toll_ledger_problem: ["bolt_order", "bolt_crates"],
    samples_for_the_chapel: ["sealed_muck_sample", "chapel_lore_note"],
    tone_beneath_the_road: ["sils_tuning_strip", "black_anvil_marked_strip"],
  };
  return byQuest[quest.id] ?? [];
}

function structuredCodexForQuest(quest: SnapshotGroveQuest): string[] {
  const codex: string[] = [];
  if (quest.id.includes("songline")) codex.push("codex_mosslawn_songline");
  if (quest.id.includes("cove")) codex.push("codex_shutter_cove_reflection");
  if (quest.id.includes("chapel")) codex.push("codex_chapel_muck_resonance");
  if (quest.id.includes("tone")) codex.push("codex_bellbound_hint");
  return codex;
}

export const SNAPSHOT_STRUCTURED_REWARDS: readonly SnapshotStructuredReward[] =
  SNAPSHOT_GROVE_QUESTS.map((quest) => ({
    id: `reward_${quest.id}`,
    questId: quest.id,
    xp: questRewardXp(quest),
    bling: questRewardBling(quest),
    items: structuredItemsForQuest(quest),
    recipes: quest.id === "toll_ledger_problem" ? ["recipe_road_repair_kit"] : [],
    codex: structuredCodexForQuest(quest),
    reputation: [quest.connectorToHarthmere ? "harthmere_bridge" : "grove_trust"],
    audioCue: quest.connectorToHarthmere
      ? "snapshot.quest.connector.complete"
      : "snapshot.quest.grove.complete",
  }));

export const SNAPSHOT_FISHING_WATER_CAMERA_SYSTEMS = {
  version: "snapshot-fishing-water-camera-runtime",
  shutterCove: {
    markerId: "shutter_cove_marker",
    waterHint: "Enter the water only after reading the cove marker; the second water entry keeps a softer reminder instead of repeating the whole tutorial.",
    fishingCatchTable: [
      { id: "cove_minifin", weight: 60, reward: "1 fish, 5 bling" },
      { id: "reflection_scale", weight: 25, reward: "photo clue ingredient" },
      { id: "muck_tangled_boot", weight: 15, reward: "muck warning clue" },
    ],
    cameraFallback: {
      eventKinds: ["photo_post_attempt", "photo_post", "show_post_capture"],
      localProofKey: "biomes.localDev.snapshotPhotoProofs",
      backendFallbackLabel: "saved locally when social post backend is unavailable",
    },
  },
} as const;

export const SNAPSHOT_MUCK_PERSISTENCE = {
  version: "snapshot-persistent-muck-cleanup",
  localStateKey: "biomes.localDev.snapshotClearedMuck",
  clearEvents: ["destroy", "clear_muck", "item_use"],
  affectedMarkerIds: ["muckwad_patch", "doc_field_table", "mosslawn_warning_moss"],
  note: "The local-dev bridge records cleared muck by marker and quest id so quest UI, map markers, and debug audit do not re-pin already-cleared objectives.",
} as const;

export const SNAPSHOT_AUDIO_CUES = {
  stepBegin: "snapshot.quest.step.begin",
  stepComplete: "snapshot.quest.step.complete",
  questComplete: "snapshot.quest.complete",
  reward: "snapshot.reward.grant",
  muckBreak: "snapshot.muck.break",
  muckClear: "snapshot.muck.clear",
  muckerHit: "snapshot.mucker.hit",
  muckerDown: "snapshot.mucker.down",
  cameraShutter: "snapshot.camera.shutter",
  fishingCast: "snapshot.fishing.cast",
  fishingCatch: "snapshot.fishing.catch",
  marketBoardActivate: "harthmere.market_board.activate",
} as const;

export const SNAPSHOT_HARTHMERE_NPC_BIBLE_PROFILES: readonly SnapshotHarthmereNpcBibleProfile[] = [
  {
    offset: 27,
    id: "sergeant_bram_holt",
    displayName: "Sergeant Bram Holt",
    district: "North Gate",
    role: "Watch sergeant and first Harthmere civic filter",
    background: "Bram treats newcomers like loose gates: useful if hung correctly, dangerous if left swinging.",
    motivation: "Keep the road from turning The Grove's tutorial trouble into Harthmere's civic emergency.",
    groveContrast: "He respects Jackie because she sends prepared travelers, not because he enjoys cheerful road letters.",
    voiceLine: "Jackie sent you with dust on your boots and sense in your head. Good. The market board is south by the fountain; read it before you improvise.",
    likeabilityTags: ["watch", "north_gate", "grove_letter"],
    questAffinity: ["welcome-to-harthmere", "letter_for_the_north_gate", "antlers_for_the_watch"],
  },
  {
    offset: 28,
    id: "mara_thistle",
    displayName: "Mara Thistle",
    district: "Market Square",
    role: "Market guide and practical gossip network",
    background: "Mara knows who needs bread, who needs coin, and who is pretending not to need help.",
    motivation: "Keep the market useful before rumor becomes panic.",
    groveContrast: "She likes Grove travelers when they bring useful eyes instead of tourist questions.",
    voiceLine: "The square tells on everyone eventually. Start with bread, bank, blade, blessing; then decide which trouble deserves your boots.",
    likeabilityTags: ["market", "guide", "gossip"],
    questAffinity: ["welcome-to-harthmere", "toll_ledger_problem"],
  },
  {
    offset: 29,
    id: "master_osric_vale",
    displayName: "Master Osric Vale",
    district: "Craftsman Row",
    role: "Black Anvil master and road-repair realist",
    background: "Osric hears bad work before he sees it: loose hinges, cracked axles, cheap nails, and frightened hammering.",
    motivation: "Make repairs that survive weather, guards, and people who call every emergency temporary.",
    groveContrast: "He distrusts Grove paint until Luis proves the road kit can hold weight.",
    voiceLine: "A road that only looks repaired is a trap with decoration. Bring me the broken part and do not lie about how it broke.",
    likeabilityTags: ["crafter", "black_anvil", "road_kit"],
    questAffinity: ["tone_beneath_the_road", "toll_ledger_problem"],
  },
  {
    offset: 30,
    id: "elowen_pike",
    displayName: "Elowen Pike",
    district: "Copper Kettle",
    role: "Innkeeper and rumor verifier",
    background: "Elowen keeps rooms warm and rumors cooler than the people carrying them.",
    motivation: "Separate travel warnings from panic before both empty the road.",
    groveContrast: "Dimmi's photo proof interests her because it makes gossip measurable.",
    voiceLine: "Bring me a story with a witness, a place, and a reason someone might lie. Then I will decide whether it deserves a room by the fire.",
    likeabilityTags: ["inn", "rumor", "traveler"],
    questAffinity: ["cove_keeps_pictures", "welcome-to-harthmere"],
  },
  {
    offset: 31,
    id: "father_aldren",
    displayName: "Father Aldren",
    district: "Temple Green",
    role: "Chapel keeper and bell-lore guardian",
    background: "Aldren corrects people who say the bell was stolen; what happened was stranger and less comfortable.",
    motivation: "Learn whether muck reacts to resonance before fear turns science and prayer against each other.",
    groveContrast: "Doc's samples worry him because practical medicine may reach the truth before doctrine does.",
    voiceLine: "Set the sample on the listening stone. If it trembles, do not call it a miracle yet. Miracles rarely smell like wet roots.",
    likeabilityTags: ["chapel", "bell", "muck_sample"],
    questAffinity: ["samples_for_the_chapel", "welcome-to-harthmere"],
  },
  {
    offset: 41,
    id: "harthmere_market_board",
    displayName: "Harthmere Market Board",
    district: "Market Square",
    role: "Civic notice board and quest router",
    background: "The board is Harthmere's shared memory: market needs in the center, guard trouble near the top, road warnings around the edge.",
    motivation: "Route the player to real service anchors instead of vague directions.",
    groveContrast: "Where Jackie points with instinct, the board points with ink, stamps, and accountability.",
    voiceLine: "Fresh ink marks the urgent work. Gate north, market here, docks east, farms south-west, chapel north-east. Pick a notice and make it real.",
    likeabilityTags: ["market_board", "quest_router", "map"],
    questAffinity: ["welcome-to-harthmere", "apples-for-dawnloaf", "missing-lockbox"],
  },
  {
    offset: 44,
    id: "drill_instructor_hal",
    displayName: "Drill Instructor Hal",
    district: "Guard Yard",
    role: "Combat trainer and discipline pressure test",
    background: "Hal counts bad footwork as a future injury and believes kindness without standards gets people killed.",
    motivation: "Turn travelers into people who can survive the first wrong swing.",
    groveContrast: "He thinks Ranger Jane is quiet because she is competent, which is his highest compliment.",
    voiceLine: "Do not show me bravery. Show me your feet, your target, and whether you can stop swinging before you hit a friend.",
    likeabilityTags: ["guard_yard", "combat", "training"],
    questAffinity: ["welcome-to-harthmere", "antlers_for_the_watch"],
  },
  {
    offset: 6,
    id: "banker_merl_voss",
    displayName: "Banker Merl Voss",
    district: "Bank",
    role: "Ledger keeper and storage trust gate",
    background: "Merl can forgive panic, bad handwriting, and damp coin, but not missing custody lines.",
    motivation: "Keep Harthmere's storage system trustworthy while the road brings stranger goods every day.",
    groveContrast: "Luis's bolt paperwork offends him less than the idea that the paperwork might be right and the crate still missing.",
    voiceLine: "A missing line in a ledger is not an error. It is a door. The question is who opened it and why.",
    likeabilityTags: ["bank", "ledger", "storage"],
    questAffinity: ["missing-lockbox", "toll_ledger_problem"],
  },
  {
    offset: 63,
    id: "apple_picker_ren",
    displayName: "Apple Picker Ren",
    district: "Farm Edge",
    role: "Orchard hand and road-food supplier",
    background: "Ren judges weather by apple skin, animal noise, and how quickly the road dust sticks to boots.",
    motivation: "Feed the market without letting muck creep into orchard roots.",
    groveContrast: "Old Coop's hen stories sound foolish until Ren checks the scratch marks and finds the clue.",
    voiceLine: "Take clean apples only. If the skin feels sticky before you cut it, that fruit belongs to Doc, not the bakery.",
    likeabilityTags: ["farm", "orchard", "food"],
    questAffinity: ["apples-for-dawnloaf", "coops_key_hen"],
  },
  {
    offset: 69,
    id: "market_guard_sen",
    displayName: "Market Guard Sen",
    district: "Market Square",
    role: "Market crowd watcher and low-drama guard",
    background: "Sen spots trouble by watching who stops watching the stalls.",
    motivation: "Prevent market panic while still listening when Grove travelers bring real warnings.",
    groveContrast: "Taye's sign language interests Sen because crowd control starts before anyone shouts.",
    voiceLine: "If you found a warning sign, show me where it points and who benefits if nobody follows it.",
    likeabilityTags: ["guard", "market", "crowd"],
    questAffinity: ["color_that_still_points_home", "welcome-to-harthmere"],
  },
];

export function snapshotHarthmereBibleProfileByOffset(offset: number) {
  return SNAPSHOT_HARTHMERE_NPC_BIBLE_PROFILES.find(
    (profile) => profile.offset === offset,
  );
}

export function snapshotHarthmereBibleLines(offset: number): string[] {
  const profile = snapshotHarthmereBibleProfileByOffset(offset);
  if (!profile) {
    return [];
  }
  return [
    profile.voiceLine,
    profile.background,
    profile.groveContrast,
  ];
}

function triggerForGroveQuest(
  quest: SnapshotGroveQuest,
  stepIndex: number,
): SnapshotCanonicalMissionTrigger {
  const trigger = quest.triggers[Math.min(stepIndex, quest.triggers.length - 1)] ?? quest.triggers[0];
  switch (trigger) {
    case "talk_npc":
      return "talk_npc";
    case "near_location":
      return "near_location";
    case "destroy":
      return "destroy";
    case "place_voxel":
      return "place_voxel";
    case "inventory_change":
      return "inventory_change";
    case "open_tab":
      return "open_tab";
    case "jump_run":
      return "jump";
    case "photo_post":
      return "photo_post_attempt";
    case "craft":
      return "craft";
    case "combat":
      return "combat";
    case "collect":
      return "collect";
    case "choice":
      return "choice";
    default:
      return "interact";
  }
}

function fallbackMarkerForQuestStep(quest: SnapshotGroveQuest, stepIndex: number) {
  const markerId = quest.markerIds[Math.min(stepIndex, quest.markerIds.length - 1)] ?? quest.markerIds[0] ?? "the_grove";
  return snapshotGroveLandmarkById(markerId) ?? SNAPSHOT_GROVE_LANDMARKS[0];
}

export function snapshotMissionTestCases(): SnapshotMissionTestCase[] {
  const roadAhead = SNAPSHOT_OFFICIAL_NUX_CHALLENGES.map((challenge, index): SnapshotMissionTestCase => {
    const marker = snapshotGroveLandmarkById(challenge.markerId) ?? SNAPSHOT_GROVE_LANDMARKS[0];
    return {
      id: `road_ahead_${index}_${challenge.id}`,
      questId: "snapshot_road_ahead_full_chain",
      title: challenge.title,
      stepIndex: index,
      objective: challenge.objective,
      trigger: challenge.trigger,
      markerId: challenge.markerId,
      expectedMarkerLabel: marker.label,
      expectedMarkerPosition: marker.position,
      expectedMarkerAppears: true,
      expectedMarkerRemovesOnComplete: true,
      expectedStateBefore: index === 0 ? "accepted" : "active",
      expectedStateAfter: index + 1 >= SNAPSHOT_OFFICIAL_NUX_CHALLENGES.length ? "complete" : "active",
      expectedRewardIds: [...challenge.rewardIds],
      expectedInventoryItems: [...challenge.itemGrantIds],
      expectedAudioCue: challenge.audioCueIds[challenge.audioCueIds.length - 1] ?? SNAPSHOT_AUDIO_CUES.stepComplete,
    };
  });

  const grove = SNAPSHOT_GROVE_QUESTS.flatMap((quest) =>
    quest.objectives.map((objective, stepIndex): SnapshotMissionTestCase => {
      const marker = fallbackMarkerForQuestStep(quest, stepIndex);
      const reward = SNAPSHOT_STRUCTURED_REWARDS.find((item) => item.questId === quest.id);
      return {
        id: `${quest.id}_${stepIndex}`,
        questId: quest.id,
        title: quest.title,
        stepIndex,
        objective,
        trigger: triggerForGroveQuest(quest, stepIndex),
        markerId: marker.id,
        expectedMarkerLabel: marker.label,
        expectedMarkerPosition: marker.position,
        expectedMarkerAppears: true,
        expectedMarkerRemovesOnComplete: true,
        expectedStateBefore: stepIndex === 0 ? "accepted" : "active",
        expectedStateAfter: stepIndex + 1 >= quest.objectives.length ? "complete" : "active",
        expectedRewardIds: reward ? [reward.id] : [],
        expectedInventoryItems: reward?.items ?? [],
        expectedAudioCue: reward?.audioCue ?? SNAPSHOT_AUDIO_CUES.stepComplete,
      };
    }),
  );

  return [...roadAhead, ...grove];
}

export function snapshotGroveFootClearanceAudit(
  runtimePositions?: Record<string, Vec3 | undefined>,
): SnapshotFootClearanceRecord[] {
  return SNAPSHOT_GROVE_NPCS.map((npc) => {
    const runtime = runtimePositions?.[npc.id];
    const feetY = runtime?.[1] ?? npc.authoredPosition[1];
    const clearance = Math.abs(feetY - SNAPSHOT_GROVE_EXPECTED_FEET_Y);
    return {
      npcId: npc.id,
      displayName: npc.displayName,
      entityId: npc.seedServerNpc ? snapshotGroveNpcEntityId(npc) : (8997551883502307 as BiomesId),
      expectedFeetY: SNAPSHOT_GROVE_EXPECTED_FEET_Y,
      authoredFeetY: feetY,
      authoredClearance: Number(clearance.toFixed(3)),
      pass: clearance <= SNAPSHOT_GROVE_MAX_FEET_CLEARANCE,
      note: clearance <= SNAPSHOT_GROVE_MAX_FEET_CLEARANCE
        ? "feet within tolerance"
        : "feet are outside tolerance; check duplicate raw snapshot actor or bad visual offset",
    };
  });
}

export const SNAPSHOT_RAW_FLOATING_NPC_ASSET_PATTERNS = [
  "asset_data/npcs/jackie",
  "asset_data/npcs/ranger_jane",
  "asset_data/npcs/luis",
  "asset_data/npcs/taye",
  "asset_data/npcs/alexis",
  "asset_data/npcs/dimmi",
  "asset_data/npcs/oldCoop",
  "asset_data/npcs/buddy",
  "asset_data/npcs/mucked_robot",
] as const;

export function snapshotRemainingUnimplementedAfter() {
  return [
    "Replace local-dev completion persistence with real production backend writes once the production challenge service endpoint is chosen.",
    "Decode any non-NUX Bikkie challenge biscuits if a richer challenge export exists outside the readable state_machines.ts chain.",
    "Replace structured fallback item ids with real Bikkie item ids where the item exists in biscuit data.",
    "Bind actual audio files to the current cue ids when the final sound pack names are confirmed.",
    "Replace local muck-cleared persistence with canonical world mutation/server saved terrain cleanup.",
    "Wire the Grove player-builder presets into the actual first-login character builder UI, not only shared preset data.",
    "Add visual artist pass for exact foot-contact bounding boxes on imported GLB NPC assets if model origins are not at feet.",
  ];
}
