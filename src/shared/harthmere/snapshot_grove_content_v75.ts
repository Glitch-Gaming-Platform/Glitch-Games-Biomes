// SNAPSHOT_GROVE_BIBLE_CONTENT_V75
// Canonical Grove starter-region content from snapshot_grove_harthmere_lore_bible_v1.
// Keep this shared and data-only so the server seeder, HUD, map metadata,
// dialogue, tests, and future towns read the same source of truth.

import type { BiomesId } from "@/shared/ids";
import type { Vec3 } from "@/shared/math/types";

export const SNAPSHOT_GROVE_BIBLE_CONTENT_VERSION_V75 =
  "snapshot-grove-bible-grounded-v75";

export const SNAPSHOT_GROVE_NPC_GROUNDING_VERSION_V75 =
  "snapshot-grove-npc-grounding-v75";

// The authored snapshot bible used y=52/53, but the installed production
// snapshot terrain that the browser actually loads places the visible Grove
// courtyard around y=69/70. The broken-courtyard logs showed the player at
// y=70.5 while seeded Grove NPCs were still at y=53, leaving the mission cast
// buried under the courtyard. Keep the authored constants for source/bible
// comparisons, but use the live constants for ECS seeding, HUD/world markers,
// and live NPC grounding.
export const SNAPSHOT_GROVE_WORLD_GROUND_Y_V75 = 52;
export const SNAPSHOT_GROVE_NPC_FEET_Y_V75 = SNAPSHOT_GROVE_WORLD_GROUND_Y_V75 + 1;
export const SNAPSHOT_GROVE_MARKER_Y_V75 = SNAPSHOT_GROVE_WORLD_GROUND_Y_V75 + 2;

export const SNAPSHOT_GROVE_LIVE_WORLD_GROUND_Y_V83 = 69;
export const SNAPSHOT_GROVE_LIVE_NPC_FEET_Y_V83 =
  SNAPSHOT_GROVE_LIVE_WORLD_GROUND_Y_V83 + 1;
export const SNAPSHOT_GROVE_LIVE_MARKER_Y_V83 =
  SNAPSHOT_GROVE_LIVE_WORLD_GROUND_Y_V83 + 2;

export const SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE_V75 =
  8_810_000_000_010_000 as BiomesId;
export const SNAPSHOT_GROVE_NPC_ID_OFFSET_BASE_V75 = 9300;

export type SnapshotGroveAreaV75 =
  | "the_grove"
  | "old_grove_road"
  | "genesis_crossroads"
  | "lovely_locks"
  | "mosslawn"
  | "shutter_cove"
  | "muck_edges"
  | "harthmere_connector";

export type SnapshotGroveTriggerV75 =
  | "talk_npc"
  | "near_location"
  | "interact"
  | "destroy"
  | "place_voxel"
  | "inventory_change"
  | "open_tab"
  | "jump_run"
  | "photo_post"
  | "craft"
  | "combat"
  | "collect"
  | "choice"
  | "item_grant"
  | "item_use"
  | "item_update"
  | "status_check"
  | "escort"
  | "carry";

export interface SnapshotGroveNpcV75 {
  id: string;
  displayName: string;
  idOffset: number;
  seedServerNpc: boolean;
  homeArea: SnapshotGroveAreaV75;
  role: string;
  authoredPosition: Vec3;
  orientation?: [number, number];
  shortDescription: string;
  background: string;
  motivation: string;
  line: string;
  extraLines: string[];
  likeabilityTags: string[];
  snapshotAsset?: string;
}

export interface SnapshotGroveQuestV75 {
  id: string;
  title: string;
  giverNpcId: string;
  area: string;
  hook: string;
  objectives: string[];
  triggers: SnapshotGroveTriggerV75[];
  markerIds: string[];
  reward: string;
  sampleDialogue: string;
  connectorToHarthmere?: boolean;
}

export interface SnapshotGroveLandmarkV75 {
  id: string;
  label: string;
  position: Vec3;
  kind:
    | "npc"
    | "quest"
    | "interactable"
    | "danger"
    | "safe_zone"
    | "connector"
    | "resource";
  area: SnapshotGroveAreaV75 | "harthmere";
  npcId?: string;
  questIds?: string[];
  visibleOnWorldMap: boolean;
  activeQuestOnly?: boolean;
}

export function snapshotGroveGroundedPositionV75(position: Vec3): Vec3 {
  return [position[0], SNAPSHOT_GROVE_LIVE_NPC_FEET_Y_V83, position[2]];
}

export function snapshotGroveMarkerPositionV75(position: Vec3): Vec3 {
  return [position[0], SNAPSHOT_GROVE_LIVE_MARKER_Y_V83, position[2]];
}

export function snapshotGroveNpcEntityIdV75(npc: Pick<SnapshotGroveNpcV75, "idOffset">): BiomesId {
  return (Number(SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE_V75) + npc.idOffset) as BiomesId;
}

export function snapshotGroveNpcIdFromEntityIdV75(entityId: BiomesId): string | undefined {
  const offset = Number(entityId) - Number(SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE_V75);
  return SNAPSHOT_GROVE_NPCS_V75.find((npc) => npc.idOffset === offset)?.id;
}

export const SNAPSHOT_GROVE_NPCS_V75: SnapshotGroveNpcV75[] = [
  {
    id: "jackie",
    displayName: "Jackie",
    idOffset: 9301,
    // SNAPSHOT_GROVE_VISIBLE_NPCS_V81:
    // Jackie is the first live objective target ("approach Jackie"). Keeping
    // her client/HUD-only leaves the starter objective pointing at an NPC that
    // does not exist in ECS/sync. Seed her as a real server NPC like the rest
    // of the Grove cast.
    seedServerNpc: true,
    homeArea: "the_grove",
    role: "Wayfinder, greeter, and emergency road warden",
    authoredPosition: [425, SNAPSHOT_GROVE_NPC_FEET_Y_V75, -96],
    orientation: [0, 3.15],
    shortDescription: "The Grove wayfinder who holds the starter road together.",
    background:
      "Jackie learned the old road posts by touch and knows how many travelers panic when the signs lie.",
    motivation:
      "Keep arrivals alive long enough to become useful neighbors and make The Grove recognize her work.",
    line: "If the road gives you a choice, pick the one with footprints.",
    extraLines: [
      "That post has told three travelers to walk into a hedge this week. I am starting to think it has opinions.",
      "Do not let Bram scare you. He sounds like a locked door because people keep trying to walk through him.",
    ],
    likeabilityTags: ["wayfinder", "road-ahead", "starter-trust"],
    snapshotAsset: "asset_data/npcs/jackie.db2de25f6ebe6082.glb",
  },
  {
    id: "billy",
    displayName: "Billy",
    idOffset: 9302,
    seedServerNpc: true,
    homeArea: "old_grove_road",
    role: "Runner, errand scout, and missing road-hand",
    authoredPosition: [500, SNAPSHOT_GROVE_NPC_FEET_Y_V75, -140],
    orientation: [0, 2.7],
    shortDescription: "A brave road runner who knows one too many shortcuts.",
    background:
      "Billy repairs markers and carries parcels, but once led a cart into a muck pocket and still calls it scenic.",
    motivation:
      "Become the official bridge-runner between The Grove and Harthmere.",
    line: "I know a shortcut. This time I am ninety percent sure it is a road.",
    extraLines: [
      "Jackie says I overpromise. I say I get there eventually.",
      "If the sign leans left, do not trust it until Taye has seen the paint.",
    ],
    likeabilityTags: ["runner", "road-ahead", "harthmere-bridge"],
  },
  {
    id: "ranger_jane",
    displayName: "Ranger Jane",
    idOffset: 9303,
    seedServerNpc: true,
    homeArea: "mosslawn",
    role: "Scout, animal tracker, and safe-zone boundary keeper",
    authoredPosition: [450, SNAPSHOT_GROVE_NPC_FEET_Y_V75, -260],
    orientation: [0, 1.2],
    shortDescription: "A dry, precise ranger who reads animal behavior before maps.",
    background:
      "Jane learned the Grove by following animals and can identify Mucker movement by how birds stop singing.",
    motivation:
      "Map the muck edges before they reach the Grove hedges and build a ranger cordon to Harthmere.",
    line: "Do not look for the monster first. Look for what stopped behaving normally.",
    extraLines: [
      "Tell the Watch if a deer wanted to invade a town, it would start with the vegetable stalls.",
      "Pawprints lie less than people. They also complain less.",
    ],
    likeabilityTags: ["ranger", "mosslawn", "watch-bridge"],
    snapshotAsset: "asset_data/npcs/ranger_jane.f9f2173e9f087aca.glb",
  },
  {
    id: "luis",
    displayName: "Luis",
    idOffset: 9304,
    seedServerNpc: true,
    homeArea: "genesis_crossroads",
    role: "Cartwright, road mechanic, and practical engineer",
    authoredPosition: [486, SNAPSHOT_GROVE_NPC_FEET_Y_V75, -209],
    orientation: [0, 4.7],
    shortDescription: "The Crossroads mechanic with road bolts and food metaphors.",
    background:
      "Luis fixes everything that moves except people, though he keeps trying that too.",
    motivation:
      "Design a modular road kit that both Grove locals and Harthmere masons will accept.",
    line: "A cart with three wheels is not broken. It is just very committed to circles.",
    extraLines: [
      "The difference between a road and a government is that roads occasionally go somewhere.",
      "Bring me bolts, wood, and patience. Mostly bolts.",
    ],
    likeabilityTags: ["mechanic", "crossroads", "merchant-compact"],
    snapshotAsset: "asset_data/npcs/luis.68619c9e7c2e03be.glb",
  },
  {
    id: "taye",
    displayName: "Taye",
    idOffset: 9305,
    seedServerNpc: true,
    homeArea: "the_grove",
    role: "Painter, sign maker, and keeper of visual memory",
    authoredPosition: [433, SNAPSHOT_GROVE_NPC_FEET_Y_V75, -103],
    orientation: [0, 3.1],
    shortDescription: "A sign painter who treats color as warning, welcome, and navigation.",
    background:
      "Taye paints the road markers and notices muck first because it dulls the warning colors.",
    motivation:
      "Create a shared symbol system for The Grove, Harthmere, and future towns.",
    line: "A good sign does not shout. It waits where your eyes already want to go.",
    extraLines: [
      "Paint is not decoration here. It is kindness left behind for strangers.",
      "If a marker loses color, the road loses memory.",
    ],
    likeabilityTags: ["artist", "signs", "road-language"],
    snapshotAsset: "asset_data/npcs/taye.1e6dfb21820880a1.glb",
  },
  {
    id: "alexis",
    displayName: "Alexis",
    idOffset: 9306,
    seedServerNpc: true,
    homeArea: "lovely_locks",
    role: "Stylist, tailor, and identity mentor",
    authoredPosition: [405, SNAPSHOT_GROVE_NPC_FEET_Y_V75, -128],
    orientation: [0, 2.5],
    shortDescription: "The Lovely Locks mentor who turns cosmetics into road readiness.",
    background:
      "Alexis treats clothing as promises: boots promise travel, gloves promise work, and a clean shirt promises you have not given up.",
    motivation:
      "Prepare travelers with dignity and grow Lovely Locks into a traveling outfitter guild.",
    line: "Style is not vanity on the road. It is a warning label you choose for yourself.",
    extraLines: [
      "The road strips people down. Lovely Locks builds them back up.",
      "You are not leaving The Grove dressed like someone who expects the road to apologize.",
    ],
    likeabilityTags: ["style", "identity", "player-builder"],
    snapshotAsset: "asset_data/npcs/alexis.beb6266445ead789.glb",
  },
  {
    id: "sil",
    displayName: "Sil",
    idOffset: 9307,
    seedServerNpc: true,
    homeArea: "mosslawn",
    role: "Singer, oral historian, and sound-sensitive scout",
    authoredPosition: [462, SNAPSHOT_GROVE_NPC_FEET_Y_V75, -252],
    orientation: [0, 0.5],
    shortDescription: "A singer who maps route warnings by sound.",
    background:
      "Sil keeps road songs because songs carry instructions through fear better than lectures.",
    motivation:
      "Find whether Mosslawn's low tone connects to Harthmere bell lore before the safe paths are forgotten.",
    line: "The ground remembers. Most people only notice when it screams.",
    extraLines: [
      "If the same note lives under both roads, we should learn whether it is calling or answering.",
      "A song is a map you can carry when your hands are full.",
    ],
    likeabilityTags: ["songline", "bell-lore", "mosslawn"],
  },
  {
    id: "dimmi",
    displayName: "Dimmi",
    idOffset: 9308,
    seedServerNpc: true,
    homeArea: "shutter_cove",
    role: "Photographer, fisher, and cove tinkerer",
    authoredPosition: [560, SNAPSHOT_GROVE_NPC_FEET_Y_V75, -182],
    orientation: [0, 4.2],
    shortDescription: "A camera tinkerer trying to prove the cove reflections are real.",
    background:
      "Dimmi repairs cameras and fish traps and now has a lens that caught a stone bridge where no bridge stood.",
    motivation:
      "Build a photo atlas of verified places and prove Shutter Cove is showing something real.",
    line: "If the water is lying, it is doing it with excellent composition.",
    extraLines: [
      "Take the picture first. Panic is allowed after we have evidence.",
      "A good photo is a small anchor against the world changing too fast.",
    ],
    likeabilityTags: ["camera", "shutter-cove", "social"],
    snapshotAsset: "asset_data/npcs/dimmi.6a3be3467087105a.glb",
  },
  {
    id: "doc",
    displayName: "Doc",
    idOffset: 9309,
    seedServerNpc: true,
    homeArea: "muck_edges",
    role: "Field medic and muck researcher",
    authoredPosition: [512, SNAPSHOT_GROVE_NPC_FEET_Y_V75, -152],
    orientation: [0, 3.6],
    shortDescription: "A blunt field medic who treats muck as civic science.",
    background:
      "Doc learned by patching bodies before anyone had time to ask credentials and now studies how muck affects roots, tools, and skin.",
    motivation:
      "Make Harthmere's chapel and engineers treat muck as medicine and ecology, not superstition.",
    line: "Do not lick it. I only say that because someone always thinks science needs enthusiasm.",
    extraLines: [
      "If the priests are right, we learn something. If I am right, we learn something louder.",
      "Bring clean samples and corrupted samples. Science needs both arguments.",
    ],
    likeabilityTags: ["muck", "medicine", "chapel-bridge"],
  },
  {
    id: "old_coop",
    displayName: "Old Coop",
    idOffset: 9310,
    seedServerNpc: true,
    homeArea: "the_grove",
    role: "Retired keeper of hens, keys, and old gossip",
    authoredPosition: [380, SNAPSHOT_GROVE_NPC_FEET_Y_V75, -202],
    orientation: [0, 1.8],
    shortDescription: "A rambling elder whose chickens know the old route better than maps.",
    background:
      "Old Coop has lived long enough to see the road renamed, repainted, and misremembered.",
    motivation:
      "Pass on practical route memory before everyone replaces it with map pins.",
    line: "Never trust a map that has not been approved by poultry.",
    extraLines: [
      "Half my stories are nonsense. The useful half is why I keep telling them.",
      "That hen has found more keys than the Watch has found clues.",
    ],
    likeabilityTags: ["old-route", "farm-edge", "hen"],
    snapshotAsset: "asset_data/npcs/oldCoop.5cf4bd1c55d3c7a2.glb",
  },
  {
    id: "buddy",
    displayName: "Buddy",
    idOffset: 9311,
    seedServerNpc: true,
    homeArea: "genesis_crossroads",
    role: "Friendly service robot with damaged memory",
    authoredPosition: [494, SNAPSHOT_GROVE_NPC_FEET_Y_V75, -213],
    orientation: [0, 5.0],
    shortDescription: "A helper robot that remembers how to serve but not always why.",
    background:
      "Buddy was built to greet, guide, warn, repair, and repeat until muck damaged the order of its routines.",
    motivation:
      "Recover service memory and become more than a maintenance object.",
    line: "I remember helping. I do not remember who asked. This is inefficient but emotionally promising.",
    extraLines: [
      "Route ping failed successfully. I am almost certain that is not ideal.",
      "Please remain calm while I remember why calm was recommended.",
    ],
    likeabilityTags: ["robot", "tower", "navigation"],
    snapshotAsset: "asset_data/npcs/buddy.c97c2b54271b3837.gltf",
  },
  {
    id: "mucked_robot",
    displayName: "Mucked Robot",
    idOffset: 9312,
    seedServerNpc: true,
    homeArea: "muck_edges",
    role: "Corrupted service machine",
    authoredPosition: [524, SNAPSHOT_GROVE_NPC_FEET_Y_V75, -154],
    orientation: [0, 3.14],
    shortDescription: "A warning version of Buddy running obsolete help routines through muck.",
    background:
      "The Mucked Robot is what happens when helpful instructions are trapped in corrupted geography.",
    motivation:
      "Complete obsolete service tasks at any cost until repaired, defeated, or cleansed.",
    line: "Please proceed to the safe marker that is no longer safe.",
    extraLines: [
      "Assistance protocol active. Local geography disagrees.",
      "Repairing road. Dismantling wrong object. Apologies pending.",
    ],
    likeabilityTags: ["robot", "muck", "corrupted-duty"],
    snapshotAsset: "asset_data/npcs/mucked_robot.1092bd24f3722e41.gltf",
  },
  {
    id: "rosalyn",
    displayName: "Rosalyn",
    idOffset: 9314,
    // GROVE_FOUNTAIN_TUTORIALS_V103:
    // Rosalyn must be a real talkable ECS NPC at first spawn. The decorative
    // snapshot copy can be hidden by the production-port pass, but the tutorial
    // cannot depend on an untalkable visual prop. This promotes the existing
    // Rosalyn profile into the live fountain quest-giver set instead of adding
    // a new story character.
    seedServerNpc: true,
    homeArea: "the_grove",
    role: "Fountain steward, welcome-table helper, and calm inventory tutor",
    authoredPosition: [428, SNAPSHOT_GROVE_NPC_FEET_Y_V75, -101],
    orientation: [0, 3.35],
    shortDescription: "A Grove fountain helper who turns first-hour confusion into small, safe habits.",
    background:
      "Rosalyn keeps the fountain table stocked with labels, satchels, and spare road notes so Jackie can handle the road while newcomers learn the town's tools.",
    motivation:
      "Make sure new arrivals understand bags, mail, storage, recovery, map pins, and HUD signals before a simple mistake becomes a lost item or a dangerous walk.",
    line: "Start small. A calm bag, a clear map, and dry socks solve more emergencies than bravery does.",
    extraLines: [
      "Jackie watches the road. I watch what people forget before they reach it.",
      "If you can find your satchel twice, you can find your courage once.",
    ],
    likeabilityTags: ["fountain", "inventory", "mail", "starter-help"],
  },
  {
    id: "guild_clerk_nia",
    displayName: "Nia, Guild Clerk",
    idOffset: 9313,
    seedServerNpc: true,
    homeArea: "the_grove",
    role: "Traveling guild clerk, charter tutor, and Grove-to-Harthmere organizer",
    authoredPosition: [436, SNAPSHOT_GROVE_NPC_FEET_Y_V75, -96],
    orientation: [0, 3.35],
    shortDescription:
      "A practical guild clerk teaching new arrivals that guilds are shared responsibility, not just a tag over your name.",
    background:
      "Nia carries sample charters between The Grove and Harthmere because most new travelers join groups before they understand permissions, banks, dues, or repair duties.",
    motivation:
      "Prevent messy first guilds by teaching charters, ranks, banks, projects, safe-zone rules, and wild-claim risk before players create trouble.",
    line: "A guild is not a hat. If you put one on, someone will ask why the roof is still leaking.",
    extraLines: [
      "Charters are boring until they decide who can empty the bank.",
      "The best guilds know who builds, who scouts, who pays dues, and who is allowed to touch the doors.",
    ],
    likeabilityTags: ["guild", "charter", "shared-projects", "safe-zone-law"],
  },
];

export const SNAPSHOT_GROVE_LANDMARKS_V75: SnapshotGroveLandmarkV75[] = [
  { id: "the_grove", label: "The Grove", position: snapshotGroveMarkerPositionV75([425, SNAPSHOT_GROVE_MARKER_Y_V75, -96]), kind: "safe_zone", area: "the_grove", visibleOnWorldMap: true },
  ...SNAPSHOT_GROVE_NPCS_V75.map((npc): SnapshotGroveLandmarkV75 => ({
    id: `npc_${npc.id}`,
    label: npc.displayName,
    position: snapshotGroveMarkerPositionV75(npc.authoredPosition),
    kind: npc.id === "mucked_robot" ? "danger" : "npc",
    area: npc.homeArea,
    npcId: npc.id,
    visibleOnWorldMap: npc.id !== "mucked_robot",
  })),
  { id: "grove_fountain_lesson_board", label: "Fountain Lesson Board", position: snapshotGroveMarkerPositionV75([430, SNAPSHOT_GROVE_MARKER_Y_V75, -102]), kind: "interactable", area: "the_grove", questIds: ["fountain_buttons_first", "painted_path_language"], visibleOnWorldMap: true },
  { id: "grove_hud_compass_ring", label: "Compass Practice Ring", position: snapshotGroveMarkerPositionV75([433, SNAPSHOT_GROVE_MARKER_Y_V75, -108]), kind: "interactable", area: "the_grove", questIds: ["fountain_buttons_first", "painted_path_language"], visibleOnWorldMap: true },
  { id: "grove_painted_route_flags", label: "Painted Route Flags", position: snapshotGroveMarkerPositionV75([442, SNAPSHOT_GROVE_MARKER_Y_V75, -112]), kind: "interactable", area: "the_grove", questIds: ["painted_path_language"], visibleOnWorldMap: true },
  { id: "grove_tool_crate", label: "Road Kit Crate", position: snapshotGroveMarkerPositionV75([420, SNAPSHOT_GROVE_MARKER_Y_V75, -112]), kind: "interactable", area: "the_grove", questIds: ["tools_before_treasure"], visibleOnWorldMap: true },
  { id: "grove_resource_basket", label: "Marked Practice Materials", position: snapshotGroveMarkerPositionV75([418, SNAPSHOT_GROVE_MARKER_Y_V75, -119]), kind: "resource", area: "the_grove", questIds: ["tools_before_treasure"], visibleOnWorldMap: true },
  { id: "grove_practice_repair_post", label: "Fountain Repair Post", position: snapshotGroveMarkerPositionV75([426, SNAPSHOT_GROVE_MARKER_Y_V75, -121]), kind: "interactable", area: "the_grove", questIds: ["tools_before_treasure"], visibleOnWorldMap: true },
  { id: "grove_mail_bank_satchel", label: "Mail and Bank Satchel", position: snapshotGroveMarkerPositionV75([412, SNAPSHOT_GROVE_MARKER_Y_V75, -124]), kind: "interactable", area: "the_grove", questIds: ["road_ready_bag_check", "lost_found_and_mail"], visibleOnWorldMap: true },
  { id: "grove_recovery_stone", label: "Lost-and-Found Stone", position: snapshotGroveMarkerPositionV75([429, SNAPSHOT_GROVE_MARKER_Y_V75, -113]), kind: "interactable", area: "the_grove", questIds: ["lost_found_and_mail"], visibleOnWorldMap: true },
  { id: "grove_combat_practice_dummy", label: "Softwood Practice Dummy", position: snapshotGroveMarkerPositionV75([447, SNAPSHOT_GROVE_MARKER_Y_V75, -126]), kind: "interactable", area: "the_grove", questIds: ["safe_sparring_not_pvp"], visibleOnWorldMap: true },
  { id: "grove_sparring_boundary", label: "Consent Sparring Ring", position: snapshotGroveMarkerPositionV75([453, SNAPSHOT_GROVE_MARKER_Y_V75, -128]), kind: "safe_zone", area: "the_grove", questIds: ["safe_sparring_not_pvp"], visibleOnWorldMap: true },
  { id: "grove_party_rope_marker", label: "Party Rope Marker", position: snapshotGroveMarkerPositionV75([458, SNAPSHOT_GROVE_MARKER_Y_V75, -116]), kind: "interactable", area: "the_grove", questIds: ["safe_sparring_not_pvp", "ready_check_at_fountain"], visibleOnWorldMap: true },
  { id: "grove_ready_firefly_ring", label: "Ready Check Fireflies", position: snapshotGroveMarkerPositionV75([464, SNAPSHOT_GROVE_MARKER_Y_V75, -117]), kind: "interactable", area: "the_grove", questIds: ["ready_check_at_fountain"], visibleOnWorldMap: true },
  { id: "old_grove_road_post", label: "Old Grove Road Post", position: snapshotGroveMarkerPositionV75([500, SNAPSHOT_GROVE_MARKER_Y_V75, -140]), kind: "interactable", area: "old_grove_road", visibleOnWorldMap: true },
  { id: "muckwad_patch", label: "Muckwad Patch", position: snapshotGroveMarkerPositionV75([512, SNAPSHOT_GROVE_MARKER_Y_V75, -152]), kind: "resource", area: "muck_edges", visibleOnWorldMap: true },
  { id: "building_practice_spot", label: "Building Practice Spot", position: snapshotGroveMarkerPositionV75([528, SNAPSHOT_GROVE_MARKER_Y_V75, -152]), kind: "interactable", area: "old_grove_road", visibleOnWorldMap: true },
  { id: "road_jump_stretch", label: "Road Jump Stretch", position: snapshotGroveMarkerPositionV75([548, SNAPSHOT_GROVE_MARKER_Y_V75, -170]), kind: "interactable", area: "old_grove_road", visibleOnWorldMap: true },
  { id: "selfie_overlook", label: "Selfie Overlook", position: snapshotGroveMarkerPositionV75([560, SNAPSHOT_GROVE_MARKER_Y_V75, -182]), kind: "interactable", area: "shutter_cove", visibleOnWorldMap: true },
  { id: "paint_pot", label: "Taye's Paint Pot", position: snapshotGroveMarkerPositionV75([440, SNAPSHOT_GROVE_MARKER_Y_V75, -119]), kind: "interactable", area: "the_grove", visibleOnWorldMap: true },
  { id: "luis_cart", label: "Luis's Repair Cart", position: snapshotGroveMarkerPositionV75([490, SNAPSHOT_GROVE_MARKER_Y_V75, -206]), kind: "interactable", area: "genesis_crossroads", visibleOnWorldMap: true },
  { id: "grove_claim_stakes", label: "Grove Practice Claim Stakes", position: [504, SNAPSHOT_GROVE_MARKER_Y_V75, -204], kind: "interactable", area: "genesis_crossroads", questIds: ["build_repair_claim_lesson"], visibleOnWorldMap: true },
  { id: "grove_repair_fence", label: "Broken Safe-Zone Fence", position: [514, SNAPSHOT_GROVE_MARKER_Y_V75, -198], kind: "interactable", area: "genesis_crossroads", questIds: ["build_repair_claim_lesson"], visibleOnWorldMap: true },
  { id: "grove_land_ledger", label: "Practice Land Ledger", position: [492, SNAPSHOT_GROVE_MARKER_Y_V75, -211], kind: "interactable", area: "genesis_crossroads", questIds: ["build_repair_claim_lesson"], visibleOnWorldMap: true },
  { id: "grove_safe_wild_boundary", label: "Safe-Zone Boundary Stones", position: [536, SNAPSHOT_GROVE_MARKER_Y_V75, -218], kind: "safe_zone", area: "old_grove_road", questIds: ["build_repair_claim_lesson", "guilds_are_promises"], visibleOnWorldMap: true },
  { id: "guild_charter_board", label: "Grove Guild Charter Board", position: [454, SNAPSHOT_GROVE_MARKER_Y_V75, -108], kind: "interactable", area: "the_grove", questIds: ["guilds_are_promises"], visibleOnWorldMap: true },
  { id: "guild_bank_crate", label: "Practice Guild Bank Crate", position: [460, SNAPSHOT_GROVE_MARKER_Y_V75, -112], kind: "interactable", area: "the_grove", questIds: ["guilds_are_promises"], visibleOnWorldMap: true },
  { id: "guild_project_table", label: "Guild Project Table", position: [466, SNAPSHOT_GROVE_MARKER_Y_V75, -104], kind: "interactable", area: "the_grove", questIds: ["guilds_are_promises"], visibleOnWorldMap: true },
  { id: "lovely_locks_mirror", label: "Lovely Locks Mirror", position: [407, SNAPSHOT_GROVE_MARKER_Y_V75, -126], kind: "interactable", area: "lovely_locks", visibleOnWorldMap: true },
  { id: "mosslawn_warning_moss", label: "Warning Moss Patch", position: [456, SNAPSHOT_GROVE_MARKER_Y_V75, -260], kind: "interactable", area: "mosslawn", visibleOnWorldMap: true },
  { id: "mosslawn_song_stones", label: "Mosslawn Song Stones", position: [468, SNAPSHOT_GROVE_MARKER_Y_V75, -250], kind: "interactable", area: "mosslawn", visibleOnWorldMap: true },
  { id: "doc_field_table", label: "Doc's Field Table", position: [514, SNAPSHOT_GROVE_MARKER_Y_V75, -150], kind: "interactable", area: "muck_edges", visibleOnWorldMap: true },
  { id: "shutter_cove_marker", label: "Shutter Cove Photo Marker", position: [560, SNAPSHOT_GROVE_MARKER_Y_V75, -182], kind: "interactable", area: "shutter_cove", visibleOnWorldMap: true },
  { id: "coop_supply_box", label: "Old Supply Box", position: [384, SNAPSHOT_GROVE_MARKER_Y_V75, -198], kind: "interactable", area: "the_grove", visibleOnWorldMap: true },
  { id: "service_tower_platform", label: "Crossroads Service Tower", position: [498, SNAPSHOT_GROVE_MARKER_Y_V75, -216], kind: "interactable", area: "genesis_crossroads", visibleOnWorldMap: true },
  { id: "harthmere_connector", label: "Road to Harthmere", position: [640, SNAPSHOT_GROVE_MARKER_Y_V75, -209], kind: "connector", area: "harthmere_connector", visibleOnWorldMap: true },
  { id: "sergeant_bram_holt", label: "Sergeant Bram Holt", position: [998, SNAPSHOT_GROVE_MARKER_Y_V75, -277], kind: "npc", area: "harthmere", npcId: "sergeant_bram_holt", visibleOnWorldMap: true },
  { id: "harthmere_market_office", label: "Harthmere Market Office", position: [1044, SNAPSHOT_GROVE_MARKER_Y_V75, -207], kind: "interactable", area: "harthmere", visibleOnWorldMap: true },
  { id: "harthmere_chapel_stone", label: "Harthmere Chapel Stone", position: [989, SNAPSHOT_GROVE_MARKER_Y_V75, -139], kind: "interactable", area: "harthmere", visibleOnWorldMap: true },
  { id: "harthmere_bridge_center", label: "Harthmere Bridge Center", position: [904, SNAPSHOT_GROVE_MARKER_Y_V75, -209], kind: "connector", area: "harthmere", visibleOnWorldMap: true },
];

export function snapshotGroveLandmarkByIdV75(id: string) {
  return SNAPSHOT_GROVE_LANDMARKS_V75.find((landmark) => landmark.id === id);
}

export const SNAPSHOT_GROVE_QUESTS_V75: SnapshotGroveQuestV75[] = [
  {
    id: "fountain_buttons_first",
    title: "Buttons Before the Road",
    giverNpcId: "jackie",
    area: "The Grove Fountain",
    hook:
      "Jackie makes sure the player can read the Grove tracker, pin a stop, open the map, and find the quest journal before the road starts changing on them.",
    objectives: [
      "Talk with Jackie by the fountain and accept the first lesson.",
      "Use the Grove tracker to pin the Fountain Lesson Board.",
      "Open the map and confirm the Grove marker is visible.",
      "Open the quest journal and read the active objective.",
      "Return to Jackie so she knows the HUD is helping instead of shouting.",
    ],
    triggers: ["talk_npc", "interact", "open_tab", "open_tab", "talk_npc"],
    markerIds: [
      "npc_jackie",
      "grove_fountain_lesson_board",
      "the_grove",
      "grove_hud_compass_ring",
      "npc_jackie",
    ],
    reward: "25 XP, Grove tracker confidence, first map pin habit.",
    sampleDialogue:
      "Before I send you anywhere dangerous, I want you able to find your way back while the road is still pretending to be polite.",
  },
  {
    id: "painted_path_language",
    title: "Paint Knows Where Eyes Go",
    giverNpcId: "taye",
    area: "The Grove Fountain",
    hook:
      "Taye teaches the player how colors, route flags, map markers, and HUD highlights work together so navigation feels like world language instead of menu noise.",
    objectives: [
      "Ask Taye why the route flags are painted in different colors.",
      "Inspect Taye's paint pot without standing on the fountain crowd.",
      "Follow the painted route flags to the compass practice ring.",
      "Pin the compass ring and watch the HUD highlight the next stop.",
      "Choose what the brightest paint should mean: warning, welcome, or work site.",
      "Return to Taye with the answer you would trust on a dark road.",
    ],
    triggers: ["talk_npc", "interact", "near_location", "open_tab", "choice", "talk_npc"],
    markerIds: [
      "npc_taye",
      "paint_pot",
      "grove_painted_route_flags",
      "grove_hud_compass_ring",
      "grove_painted_route_flags",
      "npc_taye",
    ],
    reward: "35 XP, route-color note, safer map-reading habit.",
    sampleDialogue:
      "A marker should meet your eyes halfway. If you have to hunt for it, I painted it wrong.",
  },
  {
    id: "road_ready_bag_check",
    title: "Road-Ready Bag Check",
    giverNpcId: "rosalyn",
    area: "The Grove Fountain / Lovely Locks",
    hook:
      "Rosalyn turns the first inventory lesson into a calm fountain check: equipment, clothing, health, stamina, and the bottom HUD all need to be understood before the player leaves the safe crowd.",
    objectives: [
      "Talk to Rosalyn and let her look over your road kit.",
      "Open the inventory panel from the HUD.",
      "Equip or confirm one road-ready clothing piece.",
      "Use the Lovely Locks mirror to check your silhouette from the front.",
      "Check the health, stamina, and quick-action bars before walking away.",
      "Return to Rosalyn for one final adjustment.",
    ],
    triggers: ["talk_npc", "open_tab", "inventory_change", "interact", "status_check", "talk_npc"],
    markerIds: [
      "npc_rosalyn",
      "grove_mail_bank_satchel",
      "lovely_locks_mirror",
      "lovely_locks_mirror",
      "grove_hud_compass_ring",
      "npc_rosalyn",
    ],
    reward: "35 XP, road-ready outfit habit, quick-bar awareness.",
    sampleDialogue:
      "You do not need to look expensive. You need to look like the road is not about to win an argument with your shoes.",
  },
  {
    id: "tools_before_treasure",
    title: "Tools Before Treasure",
    giverNpcId: "jackie",
    area: "The Grove Fountain",
    hook:
      "Jackie hands out a careful first repair job so players learn legal gathering, marked practice materials, road repair, and why owned things are not free loot.",
    objectives: [
      "Ask Jackie for the fountain road kit.",
      "Inspect the Road Kit Crate before touching nearby supplies.",
      "Collect only from the marked practice materials basket.",
      "Place or use one repair piece on the Fountain Repair Post.",
      "Check the safe-zone marker so you know what belongs to the town.",
      "Choose the rule you will follow: ask, claim, or gather only from marked nodes.",
      "Return to Jackie with the kit intact.",
    ],
    triggers: ["talk_npc", "interact", "collect", "place_voxel", "status_check", "choice", "talk_npc"],
    markerIds: [
      "npc_jackie",
      "grove_tool_crate",
      "grove_resource_basket",
      "grove_practice_repair_post",
      "grove_safe_wild_boundary",
      "grove_tool_crate",
      "npc_jackie",
    ],
    reward: "45 XP, practice repair credit, legal gathering reminder.",
    sampleDialogue:
      "The first lesson about treasure is boring on purpose: if it has an owner, it is not treasure yet.",
  },
  {
    id: "safe_sparring_not_pvp",
    title: "Sparring Is a Promise",
    giverNpcId: "guild_clerk_nia",
    area: "The Grove Fountain / Charter Table",
    hook:
      "Nia teaches combat safety, duel consent, safe-zone rules, PvP opt-in language, and the difference between a practice dummy and another player.",
    objectives: [
      "Talk to Nia at the charter table.",
      "Read the charter board before drawing a weapon near anyone.",
      "Step into the consent sparring ring and check that it is clearly marked.",
      "Strike the softwood practice dummy or complete the safe combat prompt.",
      "Open the group or combat panel and find where duel consent belongs.",
      "Choose the PvP rule Nia should stamp first: consent, safe zones, or no farming.",
      "Return to Nia before leaving the ring.",
    ],
    triggers: ["talk_npc", "interact", "near_location", "combat", "open_tab", "choice", "talk_npc"],
    markerIds: [
      "npc_guild_clerk_nia",
      "guild_charter_board",
      "grove_sparring_boundary",
      "grove_combat_practice_dummy",
      "grove_party_rope_marker",
      "grove_safe_wild_boundary",
      "npc_guild_clerk_nia",
    ],
    reward: "50 XP, sparring consent flag, PvP safety note.",
    sampleDialogue:
      "A duel without a clear yes is not a duel. It is paperwork with bruises.",
  },
  {
    id: "ready_check_at_fountain",
    title: "Ready Check at the Fountain",
    giverNpcId: "guild_clerk_nia",
    area: "The Grove Fountain / Charter Table",
    hook:
      "Nia uses a tiny party drill to teach ready checks, group roles, guild storage, and why players should not pull danger while someone is still reading the map.",
    objectives: [
      "Ask Nia to run the fountain ready check.",
      "Stand by the Party Rope Marker where everyone can see you.",
      "Open the guild or party panel from the HUD.",
      "Mark yourself ready at the firefly ring.",
      "Inspect the practice guild bank crate without taking everything from it.",
      "Choose a first group role: scout, builder, fighter, healer, or quartermaster.",
      "Return to Nia so she can clear the drill.",
    ],
    triggers: ["talk_npc", "near_location", "open_tab", "status_check", "interact", "choice", "talk_npc"],
    markerIds: [
      "npc_guild_clerk_nia",
      "grove_party_rope_marker",
      "guild_charter_board",
      "grove_ready_firefly_ring",
      "guild_bank_crate",
      "guild_project_table",
      "npc_guild_clerk_nia",
    ],
    reward: "45 XP, group-readiness habit, guild role note.",
    sampleDialogue:
      "The best party is not the loudest one. It is the one that waits until everyone says they are ready.",
  },
  {
    id: "lost_found_and_mail",
    title: "Nothing Useful Stays Lost",
    giverNpcId: "rosalyn",
    area: "The Grove Fountain / Lovely Locks",
    hook:
      "Rosalyn teaches mail, storage, recovery, and calm inventory habits so a new player knows where important items go when panic makes pockets mysterious.",
    objectives: [
      "Talk to Rosalyn about where important items go when your bag is full.",
      "Open the storage, mail, or recovery panel from the HUD.",
      "Inspect the Mail and Bank Satchel by the fountain.",
      "Use the Lost-and-Found Stone to recover or confirm a practice item.",
      "Store or organize one item instead of carrying everything loose.",
      "Return to Rosalyn with your bag less dramatic than before.",
    ],
    triggers: ["talk_npc", "open_tab", "interact", "item_grant", "inventory_change", "talk_npc"],
    markerIds: [
      "npc_rosalyn",
      "grove_mail_bank_satchel",
      "grove_mail_bank_satchel",
      "grove_recovery_stone",
      "guild_bank_crate",
      "npc_rosalyn",
    ],
    reward: "35 XP, storage recovery habit, starter mail note.",
    sampleDialogue:
      "A full bag is not a personality. Let the town help you remember where things belong.",
  },
  {
    id: "road_signs_and_small_lies",
    title: "Road Signs and Small Lies",
    giverNpcId: "jackie",
    area: "The Grove / Old Grove Road",
    hook: "Jackie admits one road sign is pointing the wrong way, but only because the road has been difficult lately.",
    objectives: ["Talk to Jackie.", "Reach the Old Grove Road Post.", "Inspect the bent sign and straighten it.", "Return to Jackie with the loose sign nail."],
    triggers: ["talk_npc", "near_location", "interact", "item_grant", "talk_npc"],
    markerIds: ["npc_jackie", "old_grove_road_post"],
    reward: "35 XP, 20 bling, Road Ahead map layer unlocked.",
    sampleDialogue: "That post has told three travelers to walk into a hedge this week. I am starting to think it has opinions.",
  },
  {
    id: "build_repair_claim_lesson",
    title: "Patch, Claim, Build",
    giverNpcId: "luis",
    area: "Genesis Crossroads / Grove Safe-Zone Edge",
    hook:
      "Luis turns a broken cart repair into a real building lesson: patch the road, read the claim stakes, and learn why safe-zone land works differently from wild claims.",
    objectives: [
      "Talk to Luis at the Crossroads repair cart.",
      "Inspect the Grove Practice Claim Stakes beside the safe road.",
      "Gather or break loose repair material near the practice lot.",
      "Place one block inside the marked practice claim so the foundation is visible.",
      "Repair the broken safe-zone fence post and check that the road stays passable.",
      "Read the Practice Land Ledger to compare personal lots, rented stalls, guild halls, and wild claims.",
      "Choose the safer first claim: protected Grove/Harthmere lot before any non-safe-zone wilderness claim.",
      "Return to Luis so he can stamp the lesson complete.",
    ],
    triggers: ["talk_npc", "near_location", "destroy", "place_voxel", "interact", "open_tab", "choice", "talk_npc"],
    markerIds: [
      "npc_luis",
      "grove_claim_stakes",
      "muckwad_patch",
      "building_practice_spot",
      "grove_repair_fence",
      "grove_land_ledger",
      "grove_safe_wild_boundary",
      "npc_luis",
    ],
    reward:
      "75 XP, Builder basics flag, safe-zone land note, repair kit recipe hint, and first-lot guidance.",
    sampleDialogue:
      "Buying land is easy. Keeping neighbors, roads, and permissions from eating each other is the skill.",
  },
  {
    id: "guilds_are_promises",
    title: "Guilds Are Promises",
    giverNpcId: "guild_clerk_nia",
    area: "The Grove / Guild Charter Table",
    hook:
      "Nia uses a fake guild charter to teach what guilds actually do: roles, permissions, banks, dues, projects, halls, and safe-zone law before players risk a real guild.",
    objectives: [
      "Talk to Nia at the Grove Guild Charter Board.",
      "Read the sample charter and pick a guild focus: crafting, gathering, PvE, PvP, trade, social, or building.",
      "Assign practice ranks for leader, officer, builder, treasurer, scout, and member.",
      "Deposit a harmless practice item into the guild bank crate and review who may withdraw it.",
      "Start a tiny guild project at the project table: repair a sign, fund a bridge plank, or stock a shared kit.",
      "Walk to the safe-zone boundary stones and learn which guild actions are protected in town versus risky in the Wilds.",
      "Choose a first guild rule that prevents drama: bank limits, build permissions, tax rate, or war permissions.",
      "Report back to Nia and receive the charter primer.",
    ],
    triggers: ["talk_npc", "choice", "choice", "item_grant", "interact", "near_location", "choice", "talk_npc"],
    markerIds: [
      "npc_guild_clerk_nia",
      "guild_charter_board",
      "guild_charter_board",
      "guild_bank_crate",
      "guild_project_table",
      "grove_safe_wild_boundary",
      "guild_charter_board",
      "npc_guild_clerk_nia",
    ],
    reward:
      "80 XP, Guild charter primer, guild-bank caution flag, and safe-zone/wild-claim rules codex.",
    sampleDialogue:
      "A guild is a promise with a bank tab. Make the promise clear before anyone touches the bank.",
  },
  {
    id: "color_that_still_points_home",
    title: "Color That Still Points Home",
    giverNpcId: "taye",
    area: "The Grove",
    hook: "Taye needs fresh paint for road markers, but muck has dulled the warning colors.",
    objectives: ["Collect bright berries near the garden edge.", "Break 2 dull muck-stained clumps.", "Use the paint pot at Taye's table.", "Apply paint to two Grove signposts."],
    triggers: ["collect", "destroy", "interact"],
    markerIds: ["npc_taye", "paint_pot", "muckwad_patch"],
    reward: "40 XP, Sign Painter reputation, cosmetic marker decal.",
    sampleDialogue: "A good sign does not shout. It waits where your eyes already want to go.",
  },
  {
    id: "cart_that_forgot_its_wheel",
    title: "The Cart That Forgot Its Wheel",
    giverNpcId: "luis",
    area: "Genesis Crossroads",
    hook: "Luis's repair cart broke down in the middle of the Crossroads, blocking the tutorial road.",
    objectives: ["Find the missing wheel near the hedges.", "Gather 3 wood scraps.", "Place a block under the axle.", "Help Luis push the cart clear."],
    triggers: ["near_location", "collect", "place_voxel", "interact"],
    markerIds: ["npc_luis", "luis_cart", "building_practice_spot"],
    reward: "45 XP, 25 bling, 5 road blocks, Luis friendship flag.",
    sampleDialogue: "A cart with three wheels is not broken. It is just very committed to circles.",
  },
  {
    id: "road_ready_not_fancy",
    title: "Road-Ready, Not Fancy",
    giverNpcId: "alexis",
    area: "Lovely Locks",
    hook: "Alexis refuses to let the player leave The Grove dressed like someone who expects the road to apologize.",
    objectives: ["Open the inventory.", "Equip a travel top.", "Equip travel bottoms.", "Take a mirror check at Lovely Locks."],
    triggers: ["open_tab", "inventory_change", "interact"],
    markerIds: ["npc_alexis", "lovely_locks_mirror"],
    reward: "35 XP, starter travel outfit, Lovely Locks discount flag.",
    sampleDialogue: "Style is not vanity on the road. It is a warning label you choose for yourself.",
  },
  {
    id: "moss_that_went_quiet",
    title: "The Moss That Went Quiet",
    giverNpcId: "ranger_jane",
    area: "Mosslawn",
    hook: "A patch of warning moss has stopped reacting to footsteps.",
    objectives: ["Follow Ranger Jane's trail markers.", "Crouch-walk past skittish animals.", "Inspect three moss patches.", "Clear a small seedy muckling nest."],
    triggers: ["near_location", "interact", "combat"],
    markerIds: ["npc_ranger_jane", "mosslawn_warning_moss", "npc_mucked_robot"],
    reward: "60 XP, ranger token, Mosslawn danger zone revealed.",
    sampleDialogue: "Do not look for the monster first. Look for what stopped behaving normally.",
  },
  {
    id: "songline_under_the_lawn",
    title: "Songline Under the Lawn",
    giverNpcId: "sil",
    area: "Mosslawn",
    hook: "Sil hears a low tone beneath Mosslawn after rain and asks the player to stand on old stones while they sing the route pattern.",
    objectives: ["Stand at three moss stones in order.", "Listen for the low tone.", "Record the pattern at Sil's song board.", "Choose whether it sounds like road, water, or bell."],
    triggers: ["near_location", "interact", "choice"],
    markerIds: ["npc_sil", "mosslawn_song_stones"],
    reward: "45 XP, lore codex: Mosslawn Songline, unlocks Harthmere bell dialogue branch later.",
    sampleDialogue: "The ground remembers. Most people only notice when it screams.",
  },
  {
    id: "sticky_medicine",
    title: "Sticky Medicine",
    giverNpcId: "doc",
    area: "Muck Edges",
    hook: "Doc needs clean and corrupted samples from the same plant to prove muck is a condition, not a creature type.",
    objectives: ["Collect one clean root sample.", "Collect one mucked root sample.", "Avoid standing in heavy muck for more than a few seconds.", "Bring both samples to Doc's field table."],
    triggers: ["collect", "status_check", "interact"],
    markerIds: ["npc_doc", "doc_field_table", "muckwad_patch"],
    reward: "55 XP, anti-muck poultice, Doc sample flag.",
    sampleDialogue: "Do not lick it. I only say that because someone always thinks science needs enthusiasm.",
  },
  {
    id: "cove_keeps_pictures",
    title: "The Cove Keeps Pictures",
    giverNpcId: "dimmi",
    area: "Shutter Cove",
    hook: "Dimmi's camera caught a reflection of a stone town where only water should be.",
    objectives: ["Equip the camera.", "Switch to selfie or scenic mode.", "Take a photo at the cove marker.", "Post or save the photo.", "Show Dimmi the image."],
    triggers: ["photo_post", "talk_npc"],
    markerIds: ["npc_dimmi", "shutter_cove_marker", "selfie_overlook"],
    reward: "50 XP, cove photo frame, Shutter Cove map note.",
    sampleDialogue: "If the water is lying, it is doing it with excellent composition.",
  },
  {
    id: "coops_key_hen",
    title: "Coop's Key Hen",
    giverNpcId: "old_coop",
    area: "Grove Farm Edge",
    hook: "Old Coop's favorite hen has found a key, swallowed a ribbon, and led three people into the wrong garden.",
    objectives: ["Follow the hen without sprinting.", "Collect dropped feed.", "Dig at the scratch mark.", "Use the key on the old supply box."],
    triggers: ["escort", "collect", "interact"],
    markerIds: ["npc_old_coop", "coop_supply_box"],
    reward: "40 XP, road snacks, old route clue pointing toward Billy.",
    sampleDialogue: "Never trust a map that has not been approved by poultry.",
  },
  {
    id: "tower_with_a_headache",
    title: "Tower With a Headache",
    giverNpcId: "buddy",
    area: "Genesis Crossroads",
    hook: "Buddy's service tower pings every route except the one the player needs.",
    objectives: ["Climb or reach the service platform.", "Replace a loose coil.", "Clear one mucked cable node.", "Ping the Old Grove Road marker."],
    triggers: ["near_location", "item_use", "destroy", "interact"],
    markerIds: ["npc_buddy", "service_tower_platform", "old_grove_road_post"],
    reward: "55 XP, temporary navigation beam upgrade, Buddy memory fragment.",
    sampleDialogue: "I remember helping. I do not remember who asked. This is inefficient but emotionally promising.",
  },
  {
    id: "letter_for_the_north_gate",
    title: "Letter for the North Gate",
    giverNpcId: "jackie",
    area: "The Grove -> Harthmere",
    hook: "Jackie sends a sealed note to Sergeant Bram Holt because the road signs are changing faster than Grove locals can repair them.",
    objectives: ["Receive Jackie's sealed letter.", "Follow the Harthmere Road Connector.", "Speak to Sergeant Bram Holt at the North Gate.", "Return with Bram's stamped pass."],
    triggers: ["item_grant", "near_location", "talk_npc", "item_grant"],
    markerIds: ["npc_jackie", "harthmere_connector", "sergeant_bram_holt"],
    reward: "80 XP, Harthmere access reputation, North Gate fast marker.",
    sampleDialogue: "Do not let Bram scare you. He sounds like a locked door because people keep trying to walk through him.",
    connectorToHarthmere: true,
  },
  {
    id: "antlers_for_the_watch",
    title: "Antlers for the Watch",
    giverNpcId: "ranger_jane",
    area: "Mosslawn -> Harthmere Wilds",
    hook: "Jane wants Harthmere's Watch to stop mistaking natural animal panic for bandit movement.",
    objectives: ["Collect three track rubbings in Mosslawn.", "Travel to Harthmere's North Gate.", "Deliver the report to the Watch.", "Compare one Harthmere Wilds track with Jane's notes."],
    triggers: ["interact", "talk_npc", "near_location", "choice"],
    markerIds: ["npc_ranger_jane", "mosslawn_warning_moss", "sergeant_bram_holt"],
    reward: "90 XP, Watch/Ranger bridge reputation, Wilds animal-safe marker unlocked.",
    sampleDialogue: "Tell them if a deer wanted to invade a town, it would start with the vegetable stalls.",
    connectorToHarthmere: true,
  },
  {
    id: "toll_ledger_problem",
    title: "The Toll Ledger Problem",
    giverNpcId: "luis",
    area: "Genesis Crossroads -> Harthmere Market",
    hook: "Luis has a shipment of road bolts stuck behind Harthmere paperwork.",
    objectives: ["Pick up Luis's bolt order.", "Speak with the Harthmere toll clerk.", "Find the missing ledger line in the market office.", "Return with bolt crates for road repairs."],
    triggers: ["item_grant", "talk_npc", "interact", "carry"],
    markerIds: ["npc_luis", "harthmere_market_office"],
    reward: "85 XP, road repair kit recipe, Merchant Compact intro flag.",
    sampleDialogue: "The difference between a road and a government is that roads occasionally go somewhere.",
    connectorToHarthmere: true,
  },
  {
    id: "samples_for_the_chapel",
    title: "Samples for the Chapel",
    giverNpcId: "doc",
    area: "Muck Edges -> Harthmere Chapel",
    hook: "Doc sends a sealed muck sample to Harthmere's chapel to test whether muck reacts to bell-resonant stone.",
    objectives: ["Collect a sealed muck sample.", "Bring it to Father Aldren or a chapel NPC.", "Place it on the listening stone.", "Record whether it trembles, darkens, or stays still."],
    triggers: ["collect", "talk_npc", "interact", "choice"],
    markerIds: ["npc_doc", "harthmere_chapel_stone"],
    reward: "95 XP, chapel lore codex, unlocks Bell/Muck theory branch.",
    sampleDialogue: "If the priests are right, we learn something. If I am right, we learn something louder.",
    connectorToHarthmere: true,
  },
  {
    id: "tone_beneath_the_road",
    title: "The Tone Beneath the Road",
    giverNpcId: "sil",
    area: "Mosslawn -> Harthmere Bridge",
    hook: "Sil asks the player to test whether the tone under Mosslawn also lives beneath the Harthmere road.",
    objectives: ["Take Sil's tuning strip.", "Stand at the Harthmere bridge center.", "Ask a Black Anvil crafter to mark the strip.", "Report the result to Sil."],
    triggers: ["item_grant", "near_location", "talk_npc", "item_update"],
    markerIds: ["npc_sil", "harthmere_bridge_center"],
    reward: "110 XP, Bellbound hint, unlocks future main quest breadcrumb.",
    sampleDialogue: "If the same note lives under both roads, we should learn whether it is calling or answering.",
    connectorToHarthmere: true,
  },
];

export const SNAPSHOT_GROVE_PLAYER_BUILDER_PRESETS_V75 = [
  {
    id: "grove_wayfinder",
    label: "Grove Wayfinder",
    description: "Soft starter clothes, strong route-readiness, and Jackie-style road confidence.",
    clothingTags: ["travel_top", "travel_bottoms", "boots", "warm_colors"],
  },
  {
    id: "lovely_locks_traveler",
    label: "Lovely Locks Traveler",
    description: "Identity-forward outfit choices that make clothing part of player story, not only cosmetics.",
    clothingTags: ["styled_top", "scarf", "clean_boots", "photo_ready"],
  },
  {
    id: "mosslawn_scout",
    label: "Mosslawn Scout",
    description: "Muted trail colors and practical boots for players who want the ranger path.",
    clothingTags: ["ranger", "green", "brown", "trail_boots"],
  },
  {
    id: "shutter_cove_lenskeeper",
    label: "Shutter Cove Lenskeeper",
    description: "Camera/social starter identity for players who want photo proof and exploration notes.",
    clothingTags: ["camera", "blue", "cove", "social"],
  },
] as const;

export const SNAPSHOT_GROVE_STATIC_ASSET_PORTS_V75 = [
  "asset_data/npcs/jackie.db2de25f6ebe6082.glb",
  "asset_data/npcs/ranger_jane.f9f2173e9f087aca.glb",
  "asset_data/npcs/luis.68619c9e7c2e03be.glb",
  "asset_data/npcs/taye.1e6dfb21820880a1.glb",
  "asset_data/npcs/alexis.beb6266445ead789.glb",
  "asset_data/npcs/dimmi.6a3be3467087105a.glb",
  "asset_data/npcs/oldCoop.5cf4bd1c55d3c7a2.glb",
  "asset_data/npcs/buddy.c97c2b54271b3837.gltf",
  "asset_data/npcs/mucked_robot.1092bd24f3722e41.gltf",
] as const;
