// SNAPSHOT_GROVE_BIBLE_CONTENT
// Canonical Grove starter-region content from snapshot_grove_harthmere_lore_bible.
// Keep this shared and data-only so the server seeder, HUD, map metadata,
// dialogue, tests, and future towns read the same source of truth.

import type { BiomesId } from "@/shared/ids";
import type { Vec3 } from "@/shared/math/types";
import {
  SNAPSHOT_GROVE_LIVE_MARKER_Y,
  SNAPSHOT_GROVE_LIVE_NPC_FEET_Y,
  SNAPSHOT_GROVE_LIVE_WORLD_GROUND_Y,
  SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE,
  SNAPSHOT_GROVE_NPC_ID_OFFSET_BASE,
} from "@/shared/harthmere/snapshot_grove_ids";
export {
  SNAPSHOT_GROVE_JACKIE_ENTITY_ID,
  SNAPSHOT_GROVE_JACKIE_ID_OFFSET,
  SNAPSHOT_GROVE_LIVE_MARKER_Y,
  SNAPSHOT_GROVE_LIVE_NPC_FEET_Y,
  SNAPSHOT_GROVE_LIVE_WORLD_GROUND_Y,
  SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE,
  SNAPSHOT_GROVE_NPC_ID_OFFSET_BASE,
} from "@/shared/harthmere/snapshot_grove_ids";
import {
  BUILDING_SYSTEM_GROVE_STEWARD_NPC,
  BUILDING_SYSTEM_MIRA_INTRO_QUEST,
} from "@/shared/harthmere/building_system";
import {
  GROVE_ECONOMY_STARTER_LANDMARKS,
  GROVE_ECONOMY_STARTER_NPCS,
  GROVE_ECONOMY_STARTER_QUESTS,
} from "@/shared/harthmere/grove_economy_starter";
import { shiftHarthmereAuthoredPositionToWorld } from "@/shared/harthmere/coordinate_transform";
import { HARTHMERE_EXTENSION_ROAD } from "@/shared/harthmere/world_extension";

export const SNAPSHOT_GROVE_BIBLE_CONTENT_VERSION =
  "snapshot-grove-bible-grounded";

export const SNAPSHOT_GROVE_NPC_GROUNDING_VERSION =
  "snapshot-grove-npc-grounding";

// SNAPSHOT_GROVE_FOUNTAIN_TUTORIAL_IDS:
// Graduation, NPC offer ordering, browser fixtures, and journal grouping must
// all count the exact same fountain lessons. Keep this list in shared content
// instead of reconstructing it from optional categories, because older Grove
// quests intentionally have no category and are not graduation prerequisites.
export const SNAPSHOT_GROVE_FOUNTAIN_TUTORIAL_QUEST_IDS = [
  "fountain_buttons_first",
  "painted_path_language",
  "road_ready_bag_check",
  "tools_before_treasure",
  "safe_sparring_not_pvp",
  "ready_check_at_fountain",
  "lost_found_and_mail",
  "fountain_chat_channels",
  "fountain_food_keeps_you_moving",
  "fountain_first_aid_before_road",
  "fountain_hotbar_and_dropping",
  "fountain_first_recipe_torch",
  "fountain_trade_table_promises",
] as const;

// The authored snapshot bible used y=52/53, but the installed production
// snapshot terrain that the browser actually loads places the visible Grove
// courtyard around y=69/70. The broken-courtyard logs showed the player at
// y=70.5 while seeded Grove NPCs were still at y=53, leaving the mission cast
// buried under the courtyard. Keep the authored constants for source/bible
// comparisons, but use the live constants for ECS seeding, HUD/world markers,
// and live NPC grounding.
export const SNAPSHOT_GROVE_WORLD_GROUND_Y = 52;
export const SNAPSHOT_GROVE_NPC_FEET_Y = SNAPSHOT_GROVE_WORLD_GROUND_Y + 1;
export const SNAPSHOT_GROVE_MARKER_Y = SNAPSHOT_GROVE_WORLD_GROUND_Y + 2;

// SNAPSHOT_GROVE_FOUNTAIN_CLUSTER:
// The current snapshot Grove spawn/fountain area reports the player around
// [496.335, 69.875, -126.737]. Keep the tutorial cast anchored here so
// the first quest NPCs remain visible/talkable around the fountain instead
// of drifting 70+ meters back to the old road test cluster.
export const SNAPSHOT_GROVE_FOUNTAIN_CENTER_X = 496;
export const SNAPSHOT_GROVE_FOUNTAIN_CENTER_Z = -126;

export function snapshotGroveFountainPosition(dx: number, dz: number): Vec3 {
  return [
    SNAPSHOT_GROVE_FOUNTAIN_CENTER_X + dx,
    SNAPSHOT_GROVE_NPC_FEET_Y,
    SNAPSHOT_GROVE_FOUNTAIN_CENTER_Z + dz,
  ];
}

export type SnapshotGroveArea =
  | "the_grove"
  | "old_grove_road"
  | "genesis_crossroads"
  | "lovely_locks"
  | "mosslawn"
  | "shutter_cove"
  | "muck_edges"
  | "harthmere_connector";

export type SnapshotGroveTrigger =
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
  | "open_jobs_board"
  | "item_grant"
  | "item_use"
  | "item_update"
  | "status_check"
  | "escort"
  | "carry";

export interface SnapshotGroveNpc {
  id: string;
  displayName: string;
  idOffset: number;
  seedServerNpc: boolean;
  homeArea: SnapshotGroveArea;
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

export interface SnapshotGroveQuest {
  id: string;
  title: string;
  giverNpcId: string;
  area: string;
  hook: string;
  objectives: string[];
  triggers: SnapshotGroveTrigger[];
  markerIds: string[];
  reward: string;
  sampleDialogue: string;
  connectorToHarthmere?: boolean;
  // SNAPSHOT_GROVE_GRADUATION_CHAIN:
  // Optional unlock predicate. If omitted, the quest is always available. Used
  // by the road-graduation chain so the fountain hub stops dumping every quest
  // on a brand-new player and starts gating the road-neighbor introductions
  // behind real progress.
  unlockedBy?: SnapshotGroveQuestPrerequisite;
  // Quest category for journal/HUD grouping. Defaults to "fountain_lesson"
  // when in the fountain set, "road_story" otherwise, but the explicit value
  // lets the new "road_graduation" and "road_neighbor" groups render in their
  // own section.
  category?: SnapshotGroveQuestCategory;
}

export type SnapshotGroveQuestCategory =
  | "fountain_lesson"
  | "road_graduation"
  | "road_neighbor"
  | "road_story";

export type SnapshotGroveQuestPrerequisite =
  | {
      kind: "fountain_completion_count";
      minCompletedFountainLessons: number;
    }
  | {
      kind: "quest_accepted";
      questId: string;
    }
  | {
      kind: "quest_completed";
      questId: string;
    };

export interface SnapshotGroveLandmark {
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
  area: SnapshotGroveArea | "harthmere";
  npcId?: string;
  questIds?: string[];
  visibleOnWorldMap: boolean;
  activeQuestOnly?: boolean;
}

export function snapshotGroveGroundedPosition(position: Vec3): Vec3 {
  return [position[0], SNAPSHOT_GROVE_LIVE_NPC_FEET_Y, position[2]];
}

export function snapshotGroveMarkerPosition(position: Vec3): Vec3 {
  return [position[0], SNAPSHOT_GROVE_LIVE_MARKER_Y, position[2]];
}

export function snapshotHarthmereAuthoredMarkerPosition(position: Vec3): Vec3 {
  // Harthmere markers use the town's authored Y=52/53/54 plane and only take
  // the shared XZ transform. Reusing the raised Grove marker helper would put
  // town interactions seventeen blocks above the generated extension ground.
  return shiftHarthmereAuthoredPositionToWorld(position);
}

export function snapshotGroveNpcEntityId(
  npc: Pick<SnapshotGroveNpc, "idOffset">
): BiomesId {
  return (Number(SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE) + npc.idOffset) as BiomesId;
}

export function snapshotGroveNpcIdFromEntityId(
  entityId: BiomesId
): string | undefined {
  const offset = Number(entityId) - Number(SNAPSHOT_GROVE_LOCAL_DEV_NPC_BASE);
  return SNAPSHOT_GROVE_NPCS.find((npc) => npc.idOffset === offset)?.id;
}

export const SNAPSHOT_GROVE_NPC_ROUTE_VERSION =
  "snapshot-grove-npc-routes" as const;
export const SNAPSHOT_GROVE_NPC_ROUTE_SPEED_MULTIPLIER = 1.35;

export interface SnapshotGroveNpcRouteProfile {
  points: Vec3[];
  speedMetersPerSecond: number;
  phaseOffsetSeconds?: number;
}

const GROVE_ROUTE_Y = SNAPSHOT_GROVE_LIVE_NPC_FEET_Y;

export const SNAPSHOT_GROVE_NPC_ROUTE_PROFILES: Record<
  string,
  SnapshotGroveNpcRouteProfile
> = {
  billy: {
    speedMetersPerSecond: 0.72,
    phaseOffsetSeconds: 0,
    points: [
      [500, GROVE_ROUTE_Y, -140],
      [507, GROVE_ROUTE_Y, -136],
      [504, GROVE_ROUTE_Y, -126],
      [494, GROVE_ROUTE_Y, -130],
    ],
  },
  doc: {
    speedMetersPerSecond: 0.48,
    phaseOffsetSeconds: 11,
    points: [
      [512, GROVE_ROUTE_Y, -152],
      [518, GROVE_ROUTE_Y, -149],
      [514, GROVE_ROUTE_Y, -143],
      [506, GROVE_ROUTE_Y, -148],
    ],
  },
  mucked_robot: {
    speedMetersPerSecond: 0.32,
    phaseOffsetSeconds: 19,
    points: [
      [524, GROVE_ROUTE_Y, -154],
      [529, GROVE_ROUTE_Y, -156],
      [526, GROVE_ROUTE_Y, -163],
      [519, GROVE_ROUTE_Y, -160],
    ],
  },
  buddy: {
    speedMetersPerSecond: 0.36,
    phaseOffsetSeconds: 5,
    points: [
      [486, GROVE_ROUTE_Y, -209],
      [492, GROVE_ROUTE_Y, -207],
      [490, GROVE_ROUTE_Y, -215],
      [483, GROVE_ROUTE_Y, -216],
    ],
  },
  rosalyn: {
    speedMetersPerSecond: 0.5,
    phaseOffsetSeconds: 7,
    points: [
      [495, GROVE_ROUTE_Y, -132],
      [503, GROVE_ROUTE_Y, -133],
      [504, GROVE_ROUTE_Y, -123],
      [493, GROVE_ROUTE_Y, -122],
    ],
  },
  nia_guild_clerk: {
    speedMetersPerSecond: 0.42,
    phaseOffsetSeconds: 17,
    points: [
      [489, GROVE_ROUTE_Y, -137],
      [485, GROVE_ROUTE_Y, -142],
      [478, GROVE_ROUTE_Y, -138],
      [483, GROVE_ROUTE_Y, -131],
    ],
  },
  grove_banker_merl: {
    speedMetersPerSecond: 0.38,
    phaseOffsetSeconds: 23,
    points: [
      [506, GROVE_ROUTE_Y, -119],
      [511, GROVE_ROUTE_Y, -122],
      [508, GROVE_ROUTE_Y, -130],
      [501, GROVE_ROUTE_Y, -126],
    ],
  },
  mira_thatch: {
    speedMetersPerSecond: 0.45,
    phaseOffsetSeconds: 29,
    points: [
      [493, GROVE_ROUTE_Y, -121],
      [488, GROVE_ROUTE_Y, -116],
      [481, GROVE_ROUTE_Y, -119],
      [486, GROVE_ROUTE_Y, -128],
    ],
  },
  carlo_the_cook: {
    speedMetersPerSecond: 0.46,
    phaseOffsetSeconds: 31,
    points: [
      [503, GROVE_ROUTE_Y, -120],
      [510, GROVE_ROUTE_Y, -116],
      [515, GROVE_ROUTE_Y, -123],
      [507, GROVE_ROUTE_Y, -129],
    ],
  },
  gus_the_baker: {
    speedMetersPerSecond: 0.42,
    phaseOffsetSeconds: 37,
    points: [
      [486, GROVE_ROUTE_Y, -126],
      [480, GROVE_ROUTE_Y, -123],
      [476, GROVE_ROUTE_Y, -129],
      [483, GROVE_ROUTE_Y, -134],
    ],
  },
  fern_repair: {
    speedMetersPerSecond: 0.44,
    phaseOffsetSeconds: 41,
    points: [
      [508, GROVE_ROUTE_Y, -134],
      [515, GROVE_ROUTE_Y, -136],
      [516, GROVE_ROUTE_Y, -145],
      [507, GROVE_ROUTE_Y, -143],
    ],
  },
  kit_courier: {
    speedMetersPerSecond: 0.75,
    phaseOffsetSeconds: 43,
    points: [
      [489, GROVE_ROUTE_Y, -119],
      [502, GROVE_ROUTE_Y, -116],
      [512, GROVE_ROUTE_Y, -127],
      [498, GROVE_ROUTE_Y, -137],
    ],
  },
  mel_market: {
    speedMetersPerSecond: 0.4,
    phaseOffsetSeconds: 47,
    points: [
      [500, GROVE_ROUTE_Y, -135],
      [506, GROVE_ROUTE_Y, -139],
      [501, GROVE_ROUTE_Y, -145],
      [493, GROVE_ROUTE_Y, -139],
    ],
  },
  rin_forager: {
    speedMetersPerSecond: 0.5,
    phaseOffsetSeconds: 53,
    points: [
      [484, GROVE_ROUTE_Y, -135],
      [475, GROVE_ROUTE_Y, -136],
      [472, GROVE_ROUTE_Y, -128],
      [481, GROVE_ROUTE_Y, -123],
    ],
  },
};

function snapshotGroveNpcRouteProfileKey(input: {
  entityId?: BiomesId | number;
  label?: string;
}) {
  if (input.entityId !== undefined) {
    const npcId = snapshotGroveNpcIdFromEntityId(input.entityId as BiomesId);
    if (npcId && SNAPSHOT_GROVE_NPC_ROUTE_PROFILES[npcId]) {
      return npcId;
    }
  }
  const label = (input.label ?? "").trim().toLowerCase();
  if (!label) {
    return undefined;
  }
  if (/^billy\b/.test(label)) return "billy";
  if (/^doc\b/.test(label)) return "doc";
  if (/mucked robot/.test(label)) return "mucked_robot";
  if (/^buddy\b/.test(label)) return "buddy";
  if (/rosalyn/.test(label)) return "rosalyn";
  if (/nia.*guild clerk|guild clerk.*nia/.test(label)) return "nia_guild_clerk";
  if (/merl|banker/.test(label)) return "grove_banker_merl";
  if (/mira.*thatch|land steward/.test(label)) return "mira_thatch";
  if (/carlo.*cook/.test(label)) return "carlo_the_cook";
  if (/gus.*baker/.test(label)) return "gus_the_baker";
  if (/fern.*repair/.test(label)) return "fern_repair";
  if (/kit.*courier/.test(label)) return "kit_courier";
  if (/mel.*market/.test(label)) return "mel_market";
  if (/rin.*forager/.test(label)) return "rin_forager";
  return undefined;
}

function snapshotGroveRouteDistance(from: Vec3, to: Vec3) {
  return Math.hypot(to[0] - from[0], to[2] - from[2]);
}

function snapshotGroveRoutePointAtDistance(
  profile: SnapshotGroveNpcRouteProfile,
  distance: number
): Vec3 {
  const points = profile.points;
  if (points.length === 0) {
    return [0, GROVE_ROUTE_Y, 0];
  }
  if (points.length === 1) {
    return [...points[0]] as Vec3;
  }
  const segmentLengths = points.map((point, index) =>
    snapshotGroveRouteDistance(point, points[(index + 1) % points.length])
  );
  const total = segmentLengths.reduce((sum, value) => sum + value, 0);
  if (total <= 0.0001) {
    return [...points[0]] as Vec3;
  }
  let remaining = ((distance % total) + total) % total;
  for (let index = 0; index < points.length; index += 1) {
    const segment = segmentLengths[index];
    if (remaining <= segment || index === points.length - 1) {
      const start = points[index];
      const end = points[(index + 1) % points.length];
      const t = segment > 0 ? remaining / segment : 0;
      return [
        start[0] + (end[0] - start[0]) * t,
        start[1] + (end[1] - start[1]) * t,
        start[2] + (end[2] - start[2]) * t,
      ];
    }
    remaining -= segment;
  }
  return [...points[0]] as Vec3;
}

export function snapshotGroveNpcRouteMotion(input: {
  entityId?: BiomesId | number;
  label?: string;
  secondsSinceEpoch: number;
}):
  | {
      routeId: string;
      position: Vec3;
      nextPosition: Vec3;
      speedMetersPerSecond: number;
    }
  | undefined {
  const routeId = snapshotGroveNpcRouteProfileKey(input);
  if (!routeId) {
    return undefined;
  }
  const profile = SNAPSHOT_GROVE_NPC_ROUTE_PROFILES[routeId];
  if (!profile || profile.points.length < 2) {
    return undefined;
  }
  const speed = Math.max(
    0.1,
    profile.speedMetersPerSecond * SNAPSHOT_GROVE_NPC_ROUTE_SPEED_MULTIPLIER
  );
  const distance =
    (input.secondsSinceEpoch + (profile.phaseOffsetSeconds ?? 0)) * speed;
  return {
    routeId,
    position: snapshotGroveRoutePointAtDistance(profile, distance),
    nextPosition: snapshotGroveRoutePointAtDistance(profile, distance + 0.65),
    speedMetersPerSecond: speed,
  };
}

export const SNAPSHOT_GROVE_NPCS: SnapshotGroveNpc[] = [
  {
    id: "jackie",
    displayName: "Jackie",
    idOffset: 9301,
    // SNAPSHOT_GROVE_VISIBLE_NPCS:
    // Jackie is the first live objective target ("approach Jackie"). Keeping
    // her client/HUD-only leaves the starter objective pointing at an NPC that
    // does not exist in ECS/sync. Seed her as a real server NPC like the rest
    // of the Grove cast.
    seedServerNpc: true,
    homeArea: "the_grove",
    role: "Wayfinder, greeter, and emergency road warden",
    // Jackie has one canonical body. Her original Snapshot Grove entity now
    // lives at the road-house post used by Chapter 1 instead of leaving an old
    // copy at the fountain while a per-player story projection stands indoors.
    authoredPosition: [476, SNAPSHOT_GROVE_NPC_FEET_Y, -129],
    orientation: [0, 3.15],
    shortDescription:
      "The Grove wayfinder who holds the starter road together.",
    background:
      "Jackie learned the old road posts by touch and knows how many travelers panic when the signs lie.",
    motivation:
      "Keep arrivals alive long enough to become useful neighbors and make The Grove recognize her work.",
    // GROVE_DIALOGUE_DIRECTNESS:
    // Tell the player who I am, what I help with, and exactly what to do next.
    line: "I'm Jackie, the Grove wayfinder. Talk to me to start the Road Ahead lessons — I'll pin the first safe road marker on your map so you always know where to go next.",
    extraLines: [
      "Pick the Road Ahead lesson when you're ready. Each step puts a new marker on your map: go there, do the task, come back to me.",
      "If the map marker is on me, that means it's your turn to report back. Talk to me and I'll mark the next stop.",
    ],
    likeabilityTags: ["wayfinder", "road-ahead", "starter-trust"],
    snapshotAsset:
      "asset_data/npcs/jackie.db2de25c1a8e8e8bf5afd846618c17b2.glb",
  },
  {
    id: "billy",
    displayName: "Billy",
    idOffset: 9302,
    seedServerNpc: true,
    homeArea: "old_grove_road",
    role: "Runner, errand scout, and missing road-hand",
    authoredPosition: [500, SNAPSHOT_GROVE_NPC_FEET_Y, -140],
    orientation: [0, 2.7],
    shortDescription: "A brave road runner who knows one too many shortcuts.",
    background:
      "Billy repairs markers and carries parcels, but once led a cart into a muck pocket and still calls it scenic.",
    motivation:
      "Become the official bridge-runner between The Grove and Harthmere.",
    line: "I'm Billy. I run parcels and messages between the Grove and Harthmere. If a Road Ahead step says 'find Billy', come straight to me — I'll hand off whatever the lesson needs.",
    extraLines: [
      "Jackie marks the route. I move the things along it. If you ever need something delivered to Harthmere, ask me.",
      "If a marker says I have something for you, that's a real item — it lands in your bag when I hand it over.",
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
    authoredPosition: [450, SNAPSHOT_GROVE_NPC_FEET_Y, -260],
    orientation: [0, 1.2],
    shortDescription:
      "A dry, precise ranger who reads animal behavior before maps.",
    background:
      "Jane learned the Grove by following animals and can identify Mucker movement by how birds stop singing.",
    motivation:
      "Map the muck edges before they reach the Grove hedges and build a ranger cordon to Harthmere.",
    line: "I'm Ranger Jane. I track muck, dangerous animals, and the Grove's safe-zone edge. Take my Mosslawn lesson if you want to learn which paths are safe before you head out past the lamps.",
    extraLines: [
      "If the marker leads you to Mosslawn, crouch past the skittish animals and inspect the warning moss patches — that's the real task.",
      "The safe-zone boundary is on your map. Past it, my warnings stop and your own caution starts.",
    ],
    likeabilityTags: ["ranger", "mosslawn", "watch-bridge"],
    snapshotAsset:
      "asset_data/npcs/ranger_jane.f73490ebc9f495fd4b93180b6e3be420.glb",
  },
  {
    id: "luis",
    displayName: "Luis",
    idOffset: 9304,
    seedServerNpc: true,
    homeArea: "genesis_crossroads",
    role: "Cartwright, road mechanic, and practical engineer",
    authoredPosition: [486, SNAPSHOT_GROVE_NPC_FEET_Y, -209],
    orientation: [0, 4.7],
    shortDescription:
      "The Crossroads mechanic with road bolts and food metaphors.",
    background:
      "Luis fixes everything that moves except people, though he keeps trying that too.",
    motivation:
      "Design a modular road kit that both Grove locals and Harthmere masons will accept.",
    line: "I'm Luis, the Crossroads mechanic. Take my Patch, Claim, Build lesson — I'll show you how to break rubble, place blocks, repair a fence, and claim safe land. Start here if you want to build anything.",
    extraLines: [
      "Building goes: gather material → place blocks on a claimed plot → repair the broken piece. The marker walks you through each step.",
      "Always claim land inside the Grove or Harthmere safe-zone before building. Wild claims are a different lesson and a much bigger risk.",
    ],
    likeabilityTags: ["mechanic", "crossroads", "merchant-compact"],
    snapshotAsset: "asset_data/npcs/luis.4ba3043804f17aee072b28d40f90454b.glb",
  },
  {
    id: "taye",
    displayName: "Taye",
    idOffset: 9305,
    seedServerNpc: true,
    homeArea: "the_grove",
    role: "Painter, sign maker, and keeper of visual memory",
    authoredPosition: snapshotGroveFountainPosition(-5, 2),
    orientation: [0, 3.1],
    shortDescription:
      "A sign painter who treats color as warning, welcome, and navigation.",
    background:
      "Taye paints the road markers and notices muck first because it dulls the warning colors.",
    motivation:
      "Create a shared symbol system for The Grove, Harthmere, and future towns.",
    line: "I'm Taye. I paint the Grove's route signs. Take my Paint Knows Where Eyes Go lesson to learn what each color means and how the route flags, map pins, and HUD highlights line up.",
    extraLines: [
      "Bright red means warning. Green means welcome. Yellow means work in progress. The map uses the same code.",
      "Follow the painted flags to the compass ring, pin it, and the HUD will highlight the next stop. That's the whole lesson.",
    ],
    likeabilityTags: ["artist", "signs", "road-language"],
    snapshotAsset: "asset_data/npcs/taye.142130690a1eef1e19d8be4a4a18afa3.glb",
  },
  {
    id: "alexis",
    displayName: "Alexis",
    idOffset: 9306,
    seedServerNpc: true,
    homeArea: "lovely_locks",
    role: "Stylist, tailor, and identity mentor",
    authoredPosition: [405, SNAPSHOT_GROVE_NPC_FEET_Y, -128],
    orientation: [0, 2.5],
    shortDescription:
      "The Lovely Locks mentor who turns cosmetics into road readiness.",
    background:
      "Alexis treats clothing as promises: boots promise travel, gloves promise work, and a clean shirt promises you have not given up.",
    motivation:
      "Prepare travelers with dignity and grow Lovely Locks into a traveling outfitter guild.",
    line: "I'm Alexis at Lovely Locks. Open your Inventory and equip a travel top and bottoms — the Gear Up lesson completes the moment both slots are filled.",
    extraLines: [
      "Use the mirror beside me to check what you have on. The lesson cares about the equipped slots, not how you look.",
      "If you already have a top and bottoms on, the lesson finishes automatically as soon as you talk to me.",
    ],
    likeabilityTags: ["style", "identity", "player-builder"],
    snapshotAsset:
      "asset_data/npcs/alexis.6c11f07c0990f7844ccf50e8e856f2fb.glb",
  },
  {
    id: "sil",
    displayName: "Sil",
    idOffset: 9307,
    seedServerNpc: true,
    homeArea: "mosslawn",
    role: "Singer, oral historian, and sound-sensitive scout",
    authoredPosition: [462, SNAPSHOT_GROVE_NPC_FEET_Y, -252],
    orientation: [0, 0.5],
    shortDescription: "A singer who maps route warnings by sound.",
    background:
      "Sil keeps road songs because songs carry instructions through fear better than lectures.",
    motivation:
      "Find whether Mosslawn's low tone connects to Harthmere bell lore before the safe paths are forgotten.",
    line: "I'm Sil. I track route songs around Mosslawn. Take my Songline lesson — stand on three moss stones in order, record the pattern at my song board, and pick what the tone sounds like.",
    extraLines: [
      "The marker will move from stone to stone. Just walk to whichever stone the map shows next.",
      "When the lesson finishes, you unlock the Harthmere bell dialogue branch later. That's the actual payoff.",
    ],
    likeabilityTags: ["songline", "bell-lore", "mosslawn"],
    snapshotAsset: "asset_data/npcs/sil.7886deea1c6e6d571fac40f226a8c5a7.glb",
  },
  {
    id: "dimmi",
    displayName: "Dimmi",
    idOffset: 9308,
    seedServerNpc: true,
    homeArea: "shutter_cove",
    role: "Photographer, fisher, and cove tinkerer",
    authoredPosition: [560, SNAPSHOT_GROVE_NPC_FEET_Y, -182],
    orientation: [0, 4.2],
    shortDescription:
      "A camera tinkerer trying to prove the cove reflections are real.",
    background:
      "Dimmi repairs cameras and fish traps and now has a lens that caught a stone bridge where no bridge stood.",
    motivation:
      "Build a photo atlas of verified places and prove Shutter Cove is showing something real.",
    line: "I'm Dimmi at Shutter Cove. I teach the camera: equip it, switch to selfie or scenic mode, and post a photo. The lesson completes the moment you post.",
    extraLines: [
      "If a lesson step says 'take a photo', it's the post action that counts, not the snapshot. Hit post when you're framed up.",
      "I'll loan you a camera if you don't have one — just talk to me when the marker is on me.",
    ],
    likeabilityTags: ["camera", "shutter-cove", "social"],
    snapshotAsset: "asset_data/npcs/dimmi.3c8a6df18decedd92a1a96e4b57f023a.glb",
  },
  {
    id: "doc",
    displayName: "Doc",
    idOffset: 9309,
    seedServerNpc: true,
    homeArea: "muck_edges",
    role: "Field medic and muck researcher",
    authoredPosition: [512, SNAPSHOT_GROVE_NPC_FEET_Y, -152],
    orientation: [0, 3.6],
    shortDescription: "A blunt field medic who treats muck as civic science.",
    background:
      "Doc learned by patching bodies before anyone had time to ask credentials and now studies how muck affects roots, tools, and skin.",
    motivation:
      "Make Harthmere's chapel and engineers treat muck as medicine and ecology, not superstition.",
    line: "I'm Doc. I study muck. Take my Sticky Medicine lesson: bring me one clean root sample and one mucked root sample, and don't stand in heavy muck for more than a few seconds.",
    extraLines: [
      "The map will mark the muck edge first (clean sample) and then deeper in (mucked sample). Watch your status bar.",
      "Both samples drop into your bag when you collect them. Bring them back to my field table to finish the lesson.",
    ],
    likeabilityTags: ["muck", "medicine", "chapel-bridge"],
    snapshotAsset: "asset_data/npcs/doc.7afe55b0b202ff84d700e9906754a319.glb",
  },
  {
    id: "old_coop",
    displayName: "Old Coop",
    idOffset: 9310,
    seedServerNpc: true,
    homeArea: "the_grove",
    role: "Retired keeper of hens, keys, and old gossip",
    authoredPosition: [380, SNAPSHOT_GROVE_NPC_FEET_Y, -202],
    orientation: [0, 1.8],
    shortDescription:
      "A rambling elder whose chickens know the old route better than maps.",
    background:
      "Old Coop has lived long enough to see the road renamed, repainted, and misremembered.",
    motivation:
      "Pass on practical route memory before everyone replaces it with map pins.",
    line: "I'm Old Coop. I remember the original Grove paths from before the new signs. Ask me about the old route if a map marker leads you somewhere that no longer feels right.",
    extraLines: [
      "I'm here for backup directions. If you're stuck, talk to me and I'll point you at a route the maps forgot.",
      "Bring me anything strange you found near the hen yard — half the time my chickens dig up lost keys.",
    ],
    likeabilityTags: ["old-route", "farm-edge", "hen"],
    snapshotAsset:
      "asset_data/npcs/oldCoop.7092e4566d691958f05eca393643ff95.glb",
  },
  {
    id: "buddy",
    displayName: "Buddy",
    idOffset: 9311,
    seedServerNpc: true,
    homeArea: "genesis_crossroads",
    role: "Friendly service robot with damaged memory",
    authoredPosition: [494, SNAPSHOT_GROVE_NPC_FEET_Y, -213],
    orientation: [0, 5.0],
    shortDescription:
      "A helper robot that remembers how to serve but not always why.",
    background:
      "Buddy was built to greet, guide, warn, repair, and repeat until muck damaged the order of its routines.",
    motivation:
      "Recover service memory and become more than a maintenance object.",
    line: "I'm Buddy, a help robot. I can repeat any Grove tutorial step you missed. Ask me to repeat a lesson and I'll re-pin the marker for you.",
    extraLines: [
      "If a lesson disappeared from your map, talk to me and I'll restore the marker.",
      "I forget things, but I always remember how to point you at the next step.",
    ],
    likeabilityTags: ["robot", "tower", "navigation"],
    snapshotAsset:
      "asset_data/npcs/buddy.26e75e1b35cfd6353805c0fe3d62c739.gltf",
  },
  {
    id: "mucked_robot",
    displayName: "Mucked Robot",
    idOffset: 9312,
    seedServerNpc: true,
    homeArea: "muck_edges",
    role: "Corrupted service machine",
    authoredPosition: [524, SNAPSHOT_GROVE_NPC_FEET_Y, -154],
    orientation: [0, 3.14],
    shortDescription:
      "A warning version of Buddy running obsolete help routines through muck.",
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
    snapshotAsset:
      "asset_data/npcs/mucked_robot.8acc469f3490a33c56b3f2bedded5fc9.gltf",
  },
  {
    id: "rosalyn",
    displayName: "Rosalyn",
    idOffset: 9314,
    // GROVE_FOUNTAIN_TUTORIALS:
    // Rosalyn must be a real talkable ECS NPC at first spawn. The decorative
    // snapshot copy can be hidden by the production-port pass, but the tutorial
    // cannot depend on an untalkable visual prop. This promotes the existing
    // Rosalyn profile into the live fountain quest-giver set instead of adding
    // a new story character.
    seedServerNpc: true,
    homeArea: "the_grove",
    role: "Fountain steward, welcome-table helper, and calm inventory tutor",
    authoredPosition: snapshotGroveFountainPosition(3, -2),
    orientation: [0, 3.35],
    shortDescription:
      "A Grove fountain helper who turns first-hour confusion into small, safe habits.",
    background:
      "Rosalyn keeps the fountain table stocked with labels, satchels, and spare road notes so Jackie can handle the road while newcomers learn the town's tools.",
    motivation:
      "Make sure new arrivals understand bags, mail, storage, recovery, map pins, and HUD signals before a simple mistake becomes a lost item or a dangerous walk.",
    line: "I'm Rosalyn at the fountain. I teach inventory, mail, storage, and lost-and-found so you don't lose items. Take my Road-Ready Bag Check or Nothing Useful Stays Lost lesson.",
    extraLines: [
      "Open the inventory panel from the HUD. The lesson watches that panel, so it completes the moment you actually open it.",
      "Use the Lost-and-Found Stone if a quest item ever disappears. It will recover anything the game still tracks.",
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
    authoredPosition: snapshotGroveFountainPosition(6, 3),
    orientation: [0, 3.35],
    shortDescription:
      "A practical guild clerk teaching new arrivals that guilds are shared responsibility, not just a tag over your name.",
    background:
      "Nia carries sample charters between The Grove and Harthmere because most new travelers join groups before they understand permissions, banks, dues, or repair duties.",
    motivation:
      "Prevent messy first guilds by teaching charters, ranks, banks, projects, safe-zone rules, and wild-claim risk before players create trouble.",
    line: "I'm Nia, the Grove guild clerk. I teach charters, ranks, banks, and shared projects. Take my Guilds Are Promises lesson before you join or start a guild.",
    extraLines: [
      "The lesson walks you through: read the sample charter, assign ranks, deposit into the guild bank, and start a tiny shared project.",
      "I also run the Ready Check drill and the Safe Sparring lesson. All three teach a different group habit.",
    ],
    likeabilityTags: ["guild", "charter", "shared-projects", "safe-zone-law"],
  },
  {
    id: "grove_banker_merl",
    displayName: "Merl Voss, Grove Banker",
    idOffset: 9316,
    seedServerNpc: true,
    homeArea: "the_grove",
    role: "Grove banker, vault clerk, material-storage tutor, and loan officer",
    authoredPosition: snapshotGroveFountainPosition(-6, 6),
    orientation: [0, 2.35],
    shortDescription:
      "A careful banker who teaches personal vaults, shared account vaults, material storage, carry weight, loans, and repayment consequences.",
    background:
      "Merl was sent from Harthmere with a locking ledger and a hard rule: newcomers should learn banking before their bags teach them through panic.",
    motivation:
      "Keep the Grove economy honest by teaching storage limits, house/store storage, material deposits, account vaults, and responsible borrowing before players lose goods or take careless debt.",
    line: "I'm Merl, the Grove banker. I teach personal vaults, account vaults, material storage, and loans. Ask me 'What can I store here?' to start the banking primer.",
    extraLines: [
      "Personal vault: ordinary items. Account vault: shared across your characters. Material storage: wood, stone, ore, herbs.",
      "Loans grow interest by the day, not by story time. Pay early. Ask me 'What happens if I do not repay?' before you borrow.",
    ],
    likeabilityTags: ["bank", "vault", "materials", "loans", "carry-weight"],
  },
  {
    id: BUILDING_SYSTEM_GROVE_STEWARD_NPC.id,
    displayName: BUILDING_SYSTEM_GROVE_STEWARD_NPC.displayName,
    idOffset: BUILDING_SYSTEM_GROVE_STEWARD_NPC.idOffset,
    seedServerNpc: true,
    homeArea: "the_grove",
    role: BUILDING_SYSTEM_GROVE_STEWARD_NPC.role,
    authoredPosition: snapshotGroveFountainPosition(5, -6),
    orientation: [0, 3.35],
    shortDescription:
      "The Grove land steward who sells muck-edge plots and permits voxel-only buildings.",
    background:
      "Mira keeps purchase boundaries, safe-zone flags, and construction permits aligned so a claimed Grove plot turns from muck risk into usable land.",
    motivation:
      "Make the Building System honest: buy land, clear muck, place solid voxel buildings, and keep homes, businesses, and guild halls from blocking the road.",
    line: BUILDING_SYSTEM_GROVE_STEWARD_NPC.line,
    extraLines: [
      "A house needs a floor that can hold you, not a pretty shell that forgets your feet.",
      "Homes, shops, workshops, and guild halls use different permits, but all of them need real voxel foundations.",
    ],
    likeabilityTags: ["land", "building", "muck-safe", "property"],
  },
  // GROVE_ECONOMY_STARTER: six economy townsfolk that pay starter cash.
  ...(GROVE_ECONOMY_STARTER_NPCS as unknown as SnapshotGroveNpc[]),
];

export const SNAPSHOT_GROVE_LANDMARKS: SnapshotGroveLandmark[] = [
  {
    id: "the_grove",
    label: "The Grove",
    position: snapshotGroveMarkerPosition(snapshotGroveFountainPosition(0, 0)),
    kind: "safe_zone",
    area: "the_grove",
    visibleOnWorldMap: true,
  },
  ...SNAPSHOT_GROVE_NPCS.map(
    (npc): SnapshotGroveLandmark => ({
      id: `npc_${npc.id}`,
      label: npc.displayName,
      position: snapshotGroveMarkerPosition(npc.authoredPosition),
      kind: npc.id === "mucked_robot" ? "danger" : "npc",
      area: npc.homeArea,
      npcId: npc.id,
      visibleOnWorldMap: npc.id !== "mucked_robot",
    })
  ),
  {
    id: "grove_jackie_sealed_letter",
    label: "Jackie's Sealed Letter",
    position: snapshotGroveMarkerPosition(snapshotGroveFountainPosition(2, 1)),
    kind: "resource",
    area: "the_grove",
    questIds: ["letter_for_the_north_gate"],
    visibleOnWorldMap: true,
  },
  {
    id: "grove_coop_dropped_feed",
    label: "Coop's Dropped Feed",
    position: snapshotGroveMarkerPosition([
      382,
      SNAPSHOT_GROVE_NPC_FEET_Y,
      -202,
    ]),
    kind: "resource",
    area: "the_grove",
    questIds: ["coops_key_hen"],
    visibleOnWorldMap: true,
  },
  {
    id: "grove_luis_bolt_order",
    label: "Luis's Bolt Order",
    position: snapshotGroveMarkerPosition([
      488,
      SNAPSHOT_GROVE_NPC_FEET_Y,
      -208,
    ]),
    kind: "resource",
    area: "genesis_crossroads",
    questIds: ["toll_ledger_problem"],
    visibleOnWorldMap: true,
  },
  {
    id: "mosslawn_sil_tuning_strip",
    label: "Sil's Tuning Strip",
    position: snapshotGroveMarkerPosition([
      464,
      SNAPSHOT_GROVE_NPC_FEET_Y,
      -251,
    ]),
    kind: "resource",
    area: "mosslawn",
    questIds: ["tone_beneath_the_road"],
    visibleOnWorldMap: true,
  },
  {
    id: "grove_fountain_lesson_board",
    label: "Fountain Lesson Board",
    position: snapshotGroveMarkerPosition(
      snapshotGroveFountainPosition(-2, -3)
    ),
    kind: "interactable",
    area: "the_grove",
    questIds: ["fountain_buttons_first", "painted_path_language"],
    visibleOnWorldMap: true,
  },
  {
    id: "grove_hud_compass_ring",
    label: "Compass Practice Ring",
    position: snapshotGroveMarkerPosition(snapshotGroveFountainPosition(0, -5)),
    kind: "interactable",
    area: "the_grove",
    questIds: ["fountain_buttons_first", "painted_path_language"],
    visibleOnWorldMap: true,
  },
  {
    id: "grove_painted_route_flags",
    label: "Painted Route Flags",
    position: snapshotGroveMarkerPosition(snapshotGroveFountainPosition(5, -5)),
    kind: "interactable",
    area: "the_grove",
    questIds: ["painted_path_language"],
    visibleOnWorldMap: true,
  },
  {
    id: "grove_tool_crate",
    label: "Road Kit Crate",
    position: snapshotGroveMarkerPosition(
      snapshotGroveFountainPosition(-6, -2)
    ),
    kind: "interactable",
    area: "the_grove",
    questIds: ["tools_before_treasure"],
    visibleOnWorldMap: true,
  },
  {
    id: "grove_resource_basket",
    label: "Marked Practice Materials",
    position: snapshotGroveMarkerPosition(snapshotGroveFountainPosition(-7, 1)),
    kind: "resource",
    area: "the_grove",
    questIds: ["tools_before_treasure"],
    visibleOnWorldMap: true,
  },
  {
    id: "grove_garden_edge_berries",
    label: "Garden Edge Berries",
    position: snapshotGroveMarkerPosition(
      snapshotGroveFountainPosition(-10, 6)
    ),
    kind: "resource",
    area: "the_grove",
    questIds: ["color_that_still_points_home"],
    visibleOnWorldMap: true,
  },
  {
    id: "grove_practice_repair_post",
    label: "Fountain Repair Post",
    position: snapshotGroveMarkerPosition(snapshotGroveFountainPosition(-3, 4)),
    kind: "interactable",
    area: "the_grove",
    questIds: ["tools_before_treasure"],
    visibleOnWorldMap: true,
  },
  {
    id: "grove_mail_bank_satchel",
    label: "Mail and Bank Satchel",
    position: snapshotGroveMarkerPosition(snapshotGroveFountainPosition(-8, 4)),
    kind: "interactable",
    area: "the_grove",
    questIds: ["road_ready_bag_check", "lost_found_and_mail"],
    visibleOnWorldMap: true,
  },
  {
    id: "grove_recovery_stone",
    label: "Lost-and-Found Stone",
    position: snapshotGroveMarkerPosition(snapshotGroveFountainPosition(-1, 5)),
    kind: "interactable",
    area: "the_grove",
    questIds: ["lost_found_and_mail"],
    visibleOnWorldMap: true,
  },
  {
    id: "grove_combat_practice_dummy",
    label: "Softwood Practice Dummy",
    position: snapshotGroveMarkerPosition(snapshotGroveFountainPosition(8, 4)),
    kind: "interactable",
    area: "the_grove",
    questIds: ["safe_sparring_not_pvp"],
    visibleOnWorldMap: true,
  },
  {
    id: "grove_sparring_boundary",
    label: "Consent Sparring Ring",
    position: snapshotGroveMarkerPosition(snapshotGroveFountainPosition(10, 5)),
    kind: "safe_zone",
    area: "the_grove",
    questIds: ["safe_sparring_not_pvp"],
    visibleOnWorldMap: true,
  },
  {
    id: "grove_party_rope_marker",
    label: "Party Rope Marker",
    position: snapshotGroveMarkerPosition(snapshotGroveFountainPosition(7, 0)),
    kind: "interactable",
    area: "the_grove",
    questIds: ["safe_sparring_not_pvp", "ready_check_at_fountain"],
    visibleOnWorldMap: true,
  },
  {
    id: "grove_ready_firefly_ring",
    label: "Ready Check Fireflies",
    position: snapshotGroveMarkerPosition(snapshotGroveFountainPosition(9, -2)),
    kind: "interactable",
    area: "the_grove",
    questIds: ["ready_check_at_fountain"],
    visibleOnWorldMap: true,
  },
  // HARTHMERE_JOBS_BOARD_GROVE_PLACEMENT:
  // Physical Jobs Board landmark. Sits just east of the fountain on a
  // voxel kiosk tile so the starter "Read the Jobs Board" autostart quest has
  // a real in-world target inside The Grove (not in Harthmere market). The
  // marker id is the same id the live backend stores so the marker / map pin
  // / live state line up across client, world map API, and live_mode backend.
  // HARTHMERE_JOBS_BOARD_VISIBILITY_FIX: previously authored at
  // SNAPSHOT_GROVE_MARKER_Y (=54) which is ~17 blocks under the live
  // Grove terrain (y=69). Use `snapshotGroveMarkerPosition` so the pin
  // sits on the same column the player and the rendered voxel kiosk do.
  // HARTHMERE_JOBS_BOARD_GROVE_RELOCATION: pin moved to (501.99486179104775, _, -132.00350672753194)
  // so the world-map marker, the runtime nav-aid pin, the live backend marker,
  // and the rendered voxel kiosk all share a single column.
  {
    id: "harthmere_market_posting_board",
    label: "Jobs Board",
    position: snapshotGroveMarkerPosition([
      501.99486179104775,
      SNAPSHOT_GROVE_MARKER_Y,
      -132.00350672753194,
    ]),
    kind: "interactable",
    area: "the_grove",
    questIds: ["read-the-jobs-board"],
    visibleOnWorldMap: true,
  },
  // HARTHMERE_JOBS_BOARD_HARTHMERE_TOWN:
  // Second jobs board landmark for Harthmere's market district. Same kiosk
  // asset, planted right next to the Harthmere Market Office landmark so
  // the proximity check and the visible voxel building line up.
  {
    id: "harthmere_town_market_posting_board",
    label: "Harthmere Town Jobs Board",
    position: snapshotHarthmereAuthoredMarkerPosition([
      534,
      SNAPSHOT_GROVE_MARKER_Y,
      -202,
    ]),
    kind: "interactable",
    area: "harthmere",
    visibleOnWorldMap: true,
  },
  {
    id: "old_grove_road_post",
    label: "Old Grove Road Post",
    position: snapshotGroveMarkerPosition([500, SNAPSHOT_GROVE_MARKER_Y, -140]),
    kind: "interactable",
    area: "old_grove_road",
    visibleOnWorldMap: true,
  },
  {
    id: "muckwad_patch",
    label: "Muckwad Patch",
    position: snapshotGroveMarkerPosition([512, SNAPSHOT_GROVE_MARKER_Y, -152]),
    kind: "resource",
    area: "muck_edges",
    visibleOnWorldMap: true,
  },
  {
    id: "muckwad_pigment_clump_west",
    label: "West Pigment Muck Clump",
    position: snapshotGroveMarkerPosition([509, SNAPSHOT_GROVE_MARKER_Y, -151]),
    kind: "resource",
    area: "muck_edges",
    questIds: ["color_that_still_points_home"],
    visibleOnWorldMap: false,
    activeQuestOnly: true,
  },
  {
    id: "muckwad_pigment_clump_east",
    label: "East Pigment Muck Clump",
    position: snapshotGroveMarkerPosition([515, SNAPSHOT_GROVE_MARKER_Y, -154]),
    kind: "resource",
    area: "muck_edges",
    questIds: ["color_that_still_points_home"],
    visibleOnWorldMap: false,
    activeQuestOnly: true,
  },
  {
    id: "building_practice_spot",
    label: "Building Practice Spot",
    position: snapshotGroveMarkerPosition([528, SNAPSHOT_GROVE_MARKER_Y, -152]),
    kind: "interactable",
    area: "old_grove_road",
    visibleOnWorldMap: true,
  },
  {
    id: "road_jump_stretch",
    label: "Road Jump Stretch",
    position: snapshotGroveMarkerPosition([548, SNAPSHOT_GROVE_MARKER_Y, -170]),
    kind: "interactable",
    area: "old_grove_road",
    visibleOnWorldMap: true,
  },
  {
    id: "selfie_overlook",
    label: "Selfie Overlook",
    position: snapshotGroveMarkerPosition([560, SNAPSHOT_GROVE_MARKER_Y, -182]),
    kind: "interactable",
    area: "shutter_cove",
    visibleOnWorldMap: true,
  },
  {
    id: "paint_pot",
    label: "Taye's Paint Pot",
    position: snapshotGroveMarkerPosition(snapshotGroveFountainPosition(-4, 4)),
    kind: "interactable",
    area: "the_grove",
    visibleOnWorldMap: true,
  },
  {
    id: "luis_cart",
    label: "Luis's Repair Cart",
    position: snapshotGroveMarkerPosition([490, SNAPSHOT_GROVE_MARKER_Y, -206]),
    kind: "interactable",
    area: "genesis_crossroads",
    visibleOnWorldMap: true,
  },
  {
    id: "grove_claim_stakes",
    label: "Grove Practice Claim Stakes",
    position: snapshotGroveMarkerPosition([504, SNAPSHOT_GROVE_MARKER_Y, -204]),
    kind: "interactable",
    area: "genesis_crossroads",
    questIds: ["build_repair_claim_lesson"],
    visibleOnWorldMap: true,
  },
  {
    id: "grove_repair_fence",
    label: "Broken Safe-Zone Fence",
    position: snapshotGroveMarkerPosition([514, SNAPSHOT_GROVE_MARKER_Y, -198]),
    kind: "interactable",
    area: "genesis_crossroads",
    questIds: ["build_repair_claim_lesson"],
    visibleOnWorldMap: true,
  },
  {
    id: "grove_land_ledger",
    label: "Practice Land Ledger",
    position: snapshotGroveMarkerPosition([492, SNAPSHOT_GROVE_MARKER_Y, -211]),
    kind: "interactable",
    area: "genesis_crossroads",
    questIds: ["build_repair_claim_lesson"],
    visibleOnWorldMap: true,
  },
  {
    id: "grove_safe_wild_boundary",
    label: "Safe-Zone Boundary Stones",
    position: snapshotGroveMarkerPosition([536, SNAPSHOT_GROVE_MARKER_Y, -218]),
    kind: "safe_zone",
    area: "old_grove_road",
    questIds: ["build_repair_claim_lesson", "guilds_are_promises"],
    visibleOnWorldMap: true,
  },
  {
    id: "guild_charter_board",
    label: "Grove Guild Charter Board",
    position: snapshotGroveMarkerPosition(snapshotGroveFountainPosition(6, -4)),
    kind: "interactable",
    area: "the_grove",
    questIds: ["guilds_are_promises"],
    visibleOnWorldMap: true,
  },
  {
    id: "guild_bank_crate",
    label: "Practice Guild Bank Crate",
    position: snapshotGroveMarkerPosition(snapshotGroveFountainPosition(8, -5)),
    kind: "interactable",
    area: "the_grove",
    questIds: ["guilds_are_promises"],
    visibleOnWorldMap: true,
  },
  {
    id: "guild_project_table",
    label: "Guild Project Table",
    position: snapshotGroveMarkerPosition(snapshotGroveFountainPosition(9, -1)),
    kind: "interactable",
    area: "the_grove",
    questIds: ["guilds_are_promises"],
    visibleOnWorldMap: true,
  },
  {
    id: "lovely_locks_mirror",
    label: "Lovely Locks Mirror",
    position: snapshotGroveMarkerPosition([407, SNAPSHOT_GROVE_MARKER_Y, -126]),
    kind: "interactable",
    area: "lovely_locks",
    visibleOnWorldMap: true,
  },
  {
    id: "mosslawn_warning_moss",
    label: "Warning Moss Patch",
    position: snapshotGroveMarkerPosition([456, SNAPSHOT_GROVE_MARKER_Y, -260]),
    kind: "interactable",
    area: "mosslawn",
    visibleOnWorldMap: true,
  },
  {
    id: "mosslawn_warning_moss_west",
    label: "West Warning Moss Patch",
    position: snapshotGroveMarkerPosition([451, SNAPSHOT_GROVE_MARKER_Y, -258]),
    kind: "interactable",
    area: "mosslawn",
    questIds: ["moss_that_went_quiet"],
    visibleOnWorldMap: false,
    activeQuestOnly: true,
  },
  {
    id: "mosslawn_warning_moss_center",
    label: "Center Warning Moss Patch",
    position: snapshotGroveMarkerPosition([456, SNAPSHOT_GROVE_MARKER_Y, -260]),
    kind: "interactable",
    area: "mosslawn",
    questIds: ["moss_that_went_quiet"],
    visibleOnWorldMap: false,
    activeQuestOnly: true,
  },
  {
    id: "mosslawn_warning_moss_east",
    label: "Silent Warning Moss Patch",
    position: snapshotGroveMarkerPosition([461, SNAPSHOT_GROVE_MARKER_Y, -263]),
    kind: "interactable",
    area: "mosslawn",
    questIds: ["moss_that_went_quiet"],
    visibleOnWorldMap: false,
    activeQuestOnly: true,
  },
  {
    id: "mosslawn_silent_muckling_nest",
    label: "Silent Moss Muckling Nest",
    // Production-grounded muckling nest revealed by the silent warning moss. The
    // original marker pointed at the Mucked Robot, which neither identified the
    // nest nor put the player near an enemy. Since the 2026-07-28 Muck pack
    // relocation this column is held by the 14-strong Watchtower Muckling pack —
    // the one pack left in the clearing — rather than by whichever Road Muckwads
    // the old map-wide pooling happened to scatter here.
    position: snapshotGroveMarkerPosition([334.621, 35, -394.393]),
    kind: "danger",
    area: "mosslawn",
    questIds: ["moss_that_went_quiet"],
    visibleOnWorldMap: true,
    activeQuestOnly: true,
  },
  {
    id: "mosslawn_song_stones",
    label: "Mosslawn Song Stones",
    position: snapshotGroveMarkerPosition([468, SNAPSHOT_GROVE_MARKER_Y, -250]),
    kind: "interactable",
    area: "mosslawn",
    visibleOnWorldMap: true,
  },
  {
    id: "mosslawn_song_stone_low",
    label: "Low Moss Song Stone",
    position: snapshotGroveMarkerPosition([464, SNAPSHOT_GROVE_MARKER_Y, -252]),
    kind: "interactable",
    area: "mosslawn",
    questIds: ["songline_under_the_lawn"],
    visibleOnWorldMap: false,
    activeQuestOnly: true,
  },
  {
    id: "mosslawn_song_stone_middle",
    label: "Middle Moss Song Stone",
    position: snapshotGroveMarkerPosition([468, SNAPSHOT_GROVE_MARKER_Y, -250]),
    kind: "interactable",
    area: "mosslawn",
    questIds: ["songline_under_the_lawn"],
    visibleOnWorldMap: false,
    activeQuestOnly: true,
  },
  {
    id: "mosslawn_song_stone_high",
    label: "High Moss Song Stone",
    position: snapshotGroveMarkerPosition([472, SNAPSHOT_GROVE_MARKER_Y, -247]),
    kind: "interactable",
    area: "mosslawn",
    questIds: ["songline_under_the_lawn"],
    visibleOnWorldMap: false,
    activeQuestOnly: true,
  },
  {
    id: "mosslawn_track_rubbing_hoof",
    label: "Hoof Track Rubbing",
    position: snapshotGroveMarkerPosition([448, SNAPSHOT_GROVE_MARKER_Y, -266]),
    kind: "interactable",
    area: "mosslawn",
    questIds: ["antlers_for_the_watch"],
    visibleOnWorldMap: false,
    activeQuestOnly: true,
  },
  {
    id: "mosslawn_track_rubbing_antler",
    label: "Antler Track Rubbing",
    position: snapshotGroveMarkerPosition([454, SNAPSHOT_GROVE_MARKER_Y, -270]),
    kind: "interactable",
    area: "mosslawn",
    questIds: ["antlers_for_the_watch"],
    visibleOnWorldMap: false,
    activeQuestOnly: true,
  },
  {
    id: "mosslawn_track_rubbing_claw",
    label: "Claw Track Rubbing",
    position: snapshotGroveMarkerPosition([460, SNAPSHOT_GROVE_MARKER_Y, -274]),
    kind: "interactable",
    area: "mosslawn",
    questIds: ["antlers_for_the_watch"],
    visibleOnWorldMap: false,
    activeQuestOnly: true,
  },
  {
    id: "doc_field_table",
    label: "Doc's Field Table",
    position: snapshotGroveMarkerPosition([514, SNAPSHOT_GROVE_MARKER_Y, -150]),
    kind: "interactable",
    area: "muck_edges",
    visibleOnWorldMap: true,
  },
  {
    id: "shutter_cove_marker",
    label: "Shutter Cove Photo Marker",
    position: snapshotGroveMarkerPosition([560, SNAPSHOT_GROVE_MARKER_Y, -182]),
    kind: "interactable",
    area: "shutter_cove",
    visibleOnWorldMap: true,
  },
  {
    id: "coop_supply_box",
    label: "Old Supply Box",
    position: snapshotGroveMarkerPosition([384, SNAPSHOT_GROVE_MARKER_Y, -198]),
    kind: "interactable",
    area: "the_grove",
    visibleOnWorldMap: true,
  },
  {
    id: "service_tower_platform",
    label: "Crossroads Service Tower",
    position: snapshotGroveMarkerPosition([498, SNAPSHOT_GROVE_MARKER_Y, -216]),
    kind: "interactable",
    area: "genesis_crossroads",
    visibleOnWorldMap: true,
  },
  {
    id: "harthmere_connector",
    label: "Road to Harthmere",
    position: snapshotHarthmereAuthoredMarkerPosition([
      HARTHMERE_EXTENSION_ROAD.authoredStart[0],
      SNAPSHOT_GROVE_MARKER_Y,
      HARTHMERE_EXTENSION_ROAD.authoredStart[1],
    ]),
    kind: "connector",
    area: "harthmere_connector",
    visibleOnWorldMap: true,
  },
  {
    id: "sergeant_bram_holt",
    label: "Sergeant Bram Holt",
    position: snapshotHarthmereAuthoredMarkerPosition([
      486,
      SNAPSHOT_GROVE_MARKER_Y,
      -277,
    ]),
    kind: "npc",
    area: "harthmere",
    npcId: "sergeant_bram_holt",
    visibleOnWorldMap: true,
  },
  {
    id: "harthmere_market_office",
    label: "Harthmere Market Office",
    position: snapshotHarthmereAuthoredMarkerPosition([
      532,
      SNAPSHOT_GROVE_MARKER_Y,
      -207,
    ]),
    kind: "interactable",
    area: "harthmere",
    visibleOnWorldMap: true,
  },
  {
    id: "harthmere_market_bolt_materials",
    label: "Marked Bolt Materials",
    position: snapshotHarthmereAuthoredMarkerPosition([
      534,
      SNAPSHOT_GROVE_MARKER_Y,
      -207,
    ]),
    kind: "resource",
    area: "harthmere",
    questIds: ["toll_ledger_problem"],
    visibleOnWorldMap: true,
    activeQuestOnly: true,
  },
  {
    id: "harthmere_chapel_stone",
    label: "Harthmere Chapel Stone",
    position: snapshotHarthmereAuthoredMarkerPosition([
      477,
      SNAPSHOT_GROVE_MARKER_Y,
      -139,
    ]),
    kind: "interactable",
    area: "harthmere",
    visibleOnWorldMap: true,
  },
  {
    id: "harthmere_bridge_center",
    label: "Harthmere Bridge Center",
    position: snapshotHarthmereAuthoredMarkerPosition([
      392,
      SNAPSHOT_GROVE_MARKER_Y,
      -209,
    ]),
    kind: "connector",
    area: "harthmere",
    visibleOnWorldMap: true,
  },
  // GROVE_FOUNTAIN_TUTORIAL_LANDMARKS.
  // These landmarks back the new fountain tutorial quests (chat channels,
  // food & stamina, first aid, hotbar/drop, first crafting recipe, and trade
  // table). All positions are inside the Grove fountain square so existing
  // bounds tests still pass.
  {
    id: "grove_chat_practice_board",
    label: "Chat Practice Board",
    position: snapshotGroveMarkerPosition(
      snapshotGroveFountainPosition(-4, -1)
    ),
    kind: "interactable",
    area: "the_grove",
    questIds: ["fountain_chat_channels"],
    visibleOnWorldMap: true,
  },
  {
    id: "grove_food_satchel",
    label: "Fountain Food Satchel",
    position: snapshotGroveMarkerPosition(snapshotGroveFountainPosition(-5, 0)),
    kind: "interactable",
    area: "the_grove",
    questIds: ["fountain_food_keeps_you_moving"],
    visibleOnWorldMap: true,
  },
  {
    id: "grove_first_aid_bin",
    label: "First-Aid Bin",
    position: snapshotGroveMarkerPosition(snapshotGroveFountainPosition(-3, 1)),
    kind: "interactable",
    area: "the_grove",
    questIds: ["fountain_first_aid_before_road"],
    visibleOnWorldMap: true,
  },
  {
    id: "grove_practice_scratch_post",
    label: "Practice Scratch Post",
    position: snapshotGroveMarkerPosition(snapshotGroveFountainPosition(-6, 2)),
    kind: "interactable",
    area: "the_grove",
    questIds: ["fountain_first_aid_before_road"],
    visibleOnWorldMap: true,
  },
  {
    id: "grove_drop_practice_stones",
    label: "Practice Drop Stones",
    position: snapshotGroveMarkerPosition(
      snapshotGroveFountainPosition(-6, -3)
    ),
    kind: "interactable",
    area: "the_grove",
    questIds: ["fountain_hotbar_and_dropping"],
    visibleOnWorldMap: true,
  },
  {
    id: "grove_fountain_workbench",
    label: "Fountain Workbench",
    position: snapshotGroveMarkerPosition(snapshotGroveFountainPosition(1, -3)),
    kind: "interactable",
    area: "the_grove",
    questIds: ["fountain_first_recipe_torch"],
    visibleOnWorldMap: true,
  },
  {
    id: "grove_dim_corner",
    label: "Fountain Dim Corner",
    position: snapshotGroveMarkerPosition(snapshotGroveFountainPosition(4, -5)),
    kind: "interactable",
    area: "the_grove",
    questIds: ["fountain_first_recipe_torch"],
    visibleOnWorldMap: true,
  },
  {
    id: "grove_trade_desk",
    label: "Charter Trade Desk",
    position: snapshotGroveMarkerPosition(snapshotGroveFountainPosition(6, -1)),
    kind: "interactable",
    area: "the_grove",
    questIds: ["fountain_trade_table_promises"],
    visibleOnWorldMap: true,
  },
  // GROVE_ECONOMY_STARTER: workspots referenced by the new economy quests.
  ...GROVE_ECONOMY_STARTER_LANDMARKS,
  // Dedicated connector endpoint pins are appended after all legacy entries so
  // the index-derived numeric ids of existing world-map landmarks stay stable.
  {
    id: "harthmere_road_grove_trailhead",
    label: "Harthmere Road — Grove Trailhead",
    position: snapshotGroveMarkerPosition([560, SNAPSHOT_GROVE_MARKER_Y, -182]),
    kind: "connector",
    area: "harthmere_connector",
    visibleOnWorldMap: true,
  },
  {
    id: "harthmere_road_west_gate",
    label: "Harthmere Road — West Gate",
    position: snapshotHarthmereAuthoredMarkerPosition([
      HARTHMERE_EXTENSION_ROAD.authoredWestGate[0],
      SNAPSHOT_GROVE_MARKER_Y,
      HARTHMERE_EXTENSION_ROAD.authoredWestGate[1],
    ]),
    kind: "connector",
    area: "harthmere",
    visibleOnWorldMap: true,
  },
  {
    id: "harthmere_extension_road_start",
    label: "Harthmere Extension Road — Map Boundary Start",
    position: [
      HARTHMERE_EXTENSION_ROAD.worldStart[0],
      SNAPSHOT_GROVE_MARKER_Y,
      HARTHMERE_EXTENSION_ROAD.worldStart[1],
    ],
    kind: "connector",
    area: "harthmere_connector",
    visibleOnWorldMap: true,
  },
  {
    id: "harthmere_extension_north_gate",
    label: "Harthmere North Gate — Road End",
    position: [
      HARTHMERE_EXTENSION_ROAD.worldNorthGate[0],
      SNAPSHOT_GROVE_MARKER_Y,
      HARTHMERE_EXTENSION_ROAD.worldNorthGate[1],
    ],
    kind: "connector",
    area: "harthmere",
    visibleOnWorldMap: true,
  },
];

export function snapshotGroveLandmarkById(id: string) {
  return SNAPSHOT_GROVE_LANDMARKS.find((landmark) => landmark.id === id);
}

const SNAPSHOT_GROVE_QUESTS_WITHOUT_REQUIRED_TURN_INS: SnapshotGroveQuest[] = [
  {
    id: "read-the-jobs-board",
    title: "Read the Jobs Board",
    giverNpcId: "jackie",
    area: "The Grove · Jobs Board",
    hook: "Find the Jobs Board so new players understand where public work, seeker tasks, and business requests live.",
    objectives: ["Read the Jobs Board."],
    triggers: ["open_jobs_board"],
    markerIds: ["harthmere_market_posting_board"],
    reward: "Jobs Board unlocked, public work routing, and first-job guidance.",
    sampleDialogue:
      "The board is where Harthmere posts real work. Read it, pick a job in person, and the map will track the task.",
  },
  {
    id: BUILDING_SYSTEM_MIRA_INTRO_QUEST.questId,
    title: BUILDING_SYSTEM_MIRA_INTRO_QUEST.displayName,
    giverNpcId: BUILDING_SYSTEM_GROVE_STEWARD_NPC.id,
    area: "The Grove · Building System",
    hook: "Mira introduces new players to safe land claims, voxel-only building rules, property permissions, taxes, and why muck land must be claimed before construction.",
    objectives: [BUILDING_SYSTEM_MIRA_INTRO_QUEST.objective],
    triggers: ["talk_npc"],
    markerIds: [`npc_${BUILDING_SYSTEM_GROVE_STEWARD_NPC.id}`],
    reward: "Building System unlocked, Grove land marker, safe-plot guidance.",
    sampleDialogue: BUILDING_SYSTEM_GROVE_STEWARD_NPC.line,
  },
  {
    id: "fountain_buttons_first",
    title: "Buttons Before the Road",
    giverNpcId: "jackie",
    area: "The Grove Fountain",
    hook: "Jackie makes sure the player can read the Grove tracker, pin a stop, open the map, and find the quest journal before the road starts changing on them.",
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
      "First lesson: learn the HUD. Pin the Fountain Lesson Board, open the map, open the quest journal, then come back to me. The marker moves to each stop as you finish it.",
  },
  {
    id: "painted_path_language",
    title: "Paint Knows Where Eyes Go",
    giverNpcId: "taye",
    area: "The Grove Fountain",
    hook: "Taye teaches the player how colors, route flags, map markers, and HUD highlights work together so navigation feels like world language instead of menu noise.",
    objectives: [
      "Ask Taye why the route flags are painted in different colors.",
      "Inspect Taye's paint pot without standing on the fountain crowd.",
      "Follow the painted route flags to the compass practice ring.",
      "Pin the compass ring and watch the HUD highlight the next stop.",
      "Choose what the brightest paint should mean: warning, welcome, or work site.",
      "Return to Taye with the answer you would trust on a dark road.",
    ],
    triggers: [
      "talk_npc",
      "interact",
      "near_location",
      "open_tab",
      "choice",
      "talk_npc",
    ],
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
      "Follow the painted flags to the compass ring, pin it, then pick what the brightest paint should mean. Come back to me with your answer.",
  },
  {
    id: "road_ready_bag_check",
    title: "Road-Ready Bag Check",
    giverNpcId: "rosalyn",
    area: "The Grove Fountain / Lovely Locks",
    hook: "Rosalyn turns the first inventory lesson into a calm fountain check: equipment, clothing, health, stamina, and the bottom HUD all need to be understood before the player leaves the safe crowd.",
    objectives: [
      "Talk to Rosalyn and let her look over your road kit.",
      "Open the inventory panel from the HUD.",
      "Equip or confirm one road-ready clothing piece.",
      "Use the Lovely Locks mirror to check your silhouette from the front.",
      "Inspect the HUD compass ring and confirm health, stamina, and quick-action bars are visible.",
      "Return to Rosalyn for one final adjustment.",
    ],
    triggers: [
      "talk_npc",
      "open_tab",
      "inventory_change",
      "interact",
      "interact",
      "talk_npc",
    ],
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
      "Open Inventory, equip a top, check the mirror, then check your health/stamina/quick-action bars. The lesson watches each panel — open them in order and finish back at me.",
  },
  {
    id: "tools_before_treasure",
    title: "Tools Before Treasure",
    giverNpcId: "jackie",
    area: "The Grove Fountain",
    hook: "Jackie hands out a careful first repair job so players learn legal gathering, marked practice materials, road repair, and why owned things are not free loot.",
    objectives: [
      "Ask Jackie for the fountain road kit.",
      "Inspect the Road Kit Crate before touching nearby supplies.",
      "Collect only from the marked practice materials basket.",
      "Place or use one repair piece on the Fountain Repair Post.",
      "Inspect the safe-zone boundary stones so you know what belongs to the town.",
      "Choose the rule you will follow: ask, claim, or gather only from marked nodes.",
      "Return to Jackie with the kit intact.",
    ],
    triggers: [
      "talk_npc",
      "interact",
      "collect",
      "place_voxel",
      "interact",
      "choice",
      "talk_npc",
    ],
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
      "Inspect the Road Kit Crate, collect from the marked practice basket only, place a repair piece on the Fountain Repair Post, then come back. Marker walks you through each step.",
  },
  {
    id: "safe_sparring_not_pvp",
    title: "Sparring Is a Promise",
    giverNpcId: "guild_clerk_nia",
    area: "The Grove Fountain / Charter Table",
    hook: "Nia teaches combat safety, duel consent, safe-zone rules, PvP opt-in language, and the difference between a practice dummy and another player.",
    objectives: [
      "Talk to Nia at the charter table.",
      "Read the charter board before drawing a weapon near anyone.",
      "Step into the consent sparring ring and check that it is clearly marked.",
      "Strike the softwood practice dummy or complete the safe combat prompt.",
      "Open the group or combat panel and find where duel consent belongs.",
      "Choose the PvP rule Nia should stamp first: consent, safe zones, or no farming.",
      "Return to Nia before leaving the ring.",
    ],
    triggers: [
      "talk_npc",
      "interact",
      "near_location",
      "combat",
      "open_tab",
      "choice",
      "talk_npc",
    ],
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
      "Read the charter board, step into the consent sparring ring, hit the practice dummy, then choose the PvP rule I should stamp first. Marker moves with you.",
  },
  {
    id: "ready_check_at_fountain",
    title: "Ready Check at the Fountain",
    giverNpcId: "guild_clerk_nia",
    area: "The Grove Fountain / Charter Table",
    hook: "Nia uses a tiny party drill to teach ready checks, group roles, guild storage, and why players should not pull danger while someone is still reading the map.",
    objectives: [
      "Ask Nia to run the fountain ready check.",
      "Stand by the Party Rope Marker where everyone can see you.",
      "Open the guild or party panel from the HUD.",
      "Interact with the firefly ring to mark yourself ready.",
      "Inspect the practice guild bank crate without taking everything from it.",
      "Choose a first group role: scout, builder, fighter, healer, or quartermaster.",
      "Return to Nia so she can clear the drill.",
    ],
    triggers: [
      "talk_npc",
      "near_location",
      "open_tab",
      "interact",
      "interact",
      "choice",
      "talk_npc",
    ],
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
      "Stand by the Party Rope Marker, open the guild/party panel, mark yourself ready at the firefly ring, then pick your group role. Return here when the drill is done.",
  },
  {
    id: "lost_found_and_mail",
    title: "Nothing Useful Stays Lost",
    giverNpcId: "rosalyn",
    area: "The Grove Fountain / Lovely Locks",
    hook: "Rosalyn teaches mail, storage, recovery, and calm inventory habits so a new player knows where important items go when panic makes pockets mysterious.",
    objectives: [
      "Talk to Rosalyn about where important items go when your bag is full.",
      "Open the storage, mail, or recovery panel from the HUD.",
      "Inspect the Mail and Bank Satchel by the fountain.",
      "Use the Lost-and-Found Stone to recover or confirm a practice item.",
      "Store or organize one item instead of carrying everything loose.",
      "Return to Rosalyn with your bag less dramatic than before.",
    ],
    triggers: [
      "talk_npc",
      "open_tab",
      "interact",
      "item_grant",
      "inventory_change",
      "talk_npc",
    ],
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
      "Open the storage/mail panel, inspect the Mail and Bank Satchel, use the Lost-and-Found Stone, then store one item. Marker moves through each stop and ends back at me.",
  },
  {
    id: "road_signs_and_small_lies",
    title: "Road Signs and Small Lies",
    giverNpcId: "jackie",
    area: "The Grove / Old Grove Road",
    hook: "Jackie admits one road sign is pointing the wrong way, but only because the road has been difficult lately.",
    objectives: [
      "Talk to Jackie about the bent road sign.",
      "Reach the Old Grove Road Post.",
      "Inspect and straighten the bent sign, pocketing the loose nail.",
      "Return the nail to Jackie.",
    ],
    triggers: ["talk_npc", "near_location", "interact", "talk_npc"],
    markerIds: [
      "npc_jackie",
      "old_grove_road_post",
      "old_grove_road_post",
      "npc_jackie",
    ],
    reward: "35 XP, 20 bling, Road Ahead map layer unlocked.",
    sampleDialogue:
      "That post has told three travelers to walk into a hedge this week. I am starting to think it has opinions.",
  },
  {
    id: "build_repair_claim_lesson",
    title: "Patch, Claim, Build",
    giverNpcId: "luis",
    area: "Genesis Crossroads / Grove Safe-Zone Edge",
    hook: "Luis turns a broken cart repair into a real building lesson: patch the road, read the claim stakes, and learn why safe-zone land works differently from wild claims.",
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
    triggers: [
      "talk_npc",
      "near_location",
      "destroy",
      "place_voxel",
      "interact",
      "open_tab",
      "choice",
      "talk_npc",
    ],
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
      "Inspect the claim stakes, break some rubble, place a block inside the marked claim, repair the fence, and read the land ledger. Each marker step shows exactly what to do.",
  },
  {
    id: "guilds_are_promises",
    title: "Guilds Are Promises",
    giverNpcId: "guild_clerk_nia",
    area: "The Grove / Guild Charter Table",
    hook: "Nia uses a fake guild charter to teach what guilds actually do: roles, permissions, banks, dues, projects, halls, and safe-zone law before players risk a real guild.",
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
    triggers: [
      "talk_npc",
      "choice",
      "choice",
      "item_grant",
      "interact",
      "near_location",
      "choice",
      "talk_npc",
    ],
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
      "Read the sample charter, pick a guild focus, assign practice ranks, deposit a practice item in the guild bank, start a tiny shared project, then return to me. Marker shows each stop.",
  },
  {
    id: "color_that_still_points_home",
    title: "Color That Still Points Home",
    giverNpcId: "taye",
    area: "The Grove",
    hook: "Taye needs fresh paint for road markers, but muck has dulled the warning colors.",
    objectives: [
      "Collect bright berries near the garden edge.",
      "Break 2 dull muck-stained clumps for pigment.",
      "Use the paint pot at Taye's table.",
      "Apply the fresh paint at the painted route flags.",
    ],
    triggers: ["collect", "destroy", "interact", "interact"],
    markerIds: [
      "grove_garden_edge_berries",
      "muckwad_patch",
      "paint_pot",
      "grove_painted_route_flags",
    ],
    reward: "40 XP, Sign Painter reputation, cosmetic marker decal.",
    sampleDialogue:
      "A good sign does not shout. It waits where your eyes already want to go.",
  },
  {
    id: "cart_that_forgot_its_wheel",
    title: "The Cart That Forgot Its Wheel",
    giverNpcId: "luis",
    area: "Genesis Crossroads",
    hook: "Luis's repair cart broke down in the middle of the Crossroads, blocking the tutorial road.",
    objectives: [
      "Find the missing wheel near the hedges.",
      "Gather 3 wood scraps from the marked basket.",
      "Place a block under the axle.",
      "Help Luis push the cart clear.",
    ],
    triggers: ["near_location", "collect", "place_voxel", "interact"],
    markerIds: [
      "luis_cart",
      "grove_resource_basket",
      "building_practice_spot",
      "luis_cart",
    ],
    reward: "45 XP, 25 bling, 5 road blocks, Luis friendship flag.",
    sampleDialogue:
      "A cart with three wheels is not broken. It is just very committed to circles.",
  },
  {
    id: "road_ready_not_fancy",
    title: "Road-Ready, Not Fancy",
    giverNpcId: "alexis",
    area: "Lovely Locks",
    hook: "Alexis refuses to let the player leave The Grove dressed like someone who expects the road to apologize.",
    objectives: [
      "Talk to Alexis at Lovely Locks and open your inventory.",
      "Equip a travel top.",
      "Equip travel bottoms.",
      "Take a mirror check at Lovely Locks before stepping out.",
    ],
    triggers: ["open_tab", "inventory_change", "inventory_change", "interact"],
    markerIds: [
      "npc_alexis",
      "lovely_locks_mirror",
      "lovely_locks_mirror",
      "lovely_locks_mirror",
    ],
    reward: "35 XP, starter travel outfit, Lovely Locks discount flag.",
    sampleDialogue:
      "Style is not vanity on the road. It is a warning label you choose for yourself.",
  },
  {
    id: "moss_that_went_quiet",
    title: "The Moss That Went Quiet",
    giverNpcId: "ranger_jane",
    area: "Mosslawn",
    hook: "A patch of warning moss has stopped reacting to footsteps.",
    objectives: [
      "Follow Ranger Jane's trail markers into Mosslawn.",
      "Crouch-walk past skittish animals on the path.",
      "Inspect three moss patches and note which has gone silent.",
      "Clear a small seedy muckling nest the silent moss was hiding.",
    ],
    triggers: ["near_location", "near_location", "interact", "combat"],
    markerIds: [
      "mosslawn_warning_moss",
      "mosslawn_warning_moss",
      "mosslawn_warning_moss",
      "mosslawn_silent_muckling_nest",
    ],
    reward: "60 XP, ranger token, Mosslawn danger zone revealed.",
    sampleDialogue:
      "Do not look for the monster first. Look for what stopped behaving normally.",
  },
  {
    id: "songline_under_the_lawn",
    title: "Songline Under the Lawn",
    giverNpcId: "sil",
    area: "Mosslawn",
    hook: "Sil hears a low tone beneath Mosslawn after rain and asks the player to stand on old stones while they sing the route pattern.",
    objectives: [
      "Stand at three moss stones in the order Sil sings.",
      "Listen for the low tone beneath the lawn.",
      "Record the pattern at Sil's song board.",
      "Choose whether it sounds like road, water, or bell.",
    ],
    triggers: ["near_location", "interact", "interact", "choice"],
    markerIds: [
      "mosslawn_song_stones",
      "mosslawn_song_stones",
      "mosslawn_sil_tuning_strip",
      "npc_sil",
    ],
    reward:
      "45 XP, lore codex: Mosslawn Songline, unlocks Harthmere bell dialogue branch later.",
    sampleDialogue:
      "The ground remembers. Most people only notice when it screams.",
  },
  {
    id: "sticky_medicine",
    title: "Sticky Medicine",
    giverNpcId: "doc",
    area: "Muck Edges",
    hook: "Doc needs clean and corrupted samples from the same plant to prove muck is a condition, not a creature type.",
    objectives: [
      "Collect one clean root sample at the muck edge.",
      "Collect one mucked root sample further in.",
      "Return along the safe edge to Doc's field table without lingering in heavy muck.",
      "Bring both samples to Doc's field table.",
    ],
    triggers: ["collect", "collect", "near_location", "interact"],
    markerIds: [
      "doc_field_table",
      "muckwad_patch",
      "muckwad_patch",
      "doc_field_table",
    ],
    reward: "55 XP, anti-muck poultice, Doc sample flag.",
    sampleDialogue:
      "Do not lick it. I only say that because someone always thinks science needs enthusiasm.",
  },
  {
    id: "cove_keeps_pictures",
    title: "The Cove Keeps Pictures",
    giverNpcId: "dimmi",
    area: "Shutter Cove",
    hook: "Dimmi's camera caught a reflection of a stone town where only water should be.",
    objectives: [
      "Equip the camera Dimmi loans you.",
      "Switch to selfie or scenic mode at the cove marker.",
      "Take a photo at the cove marker.",
      "Post or save the photo from the overlook.",
      "Show Dimmi the image.",
    ],
    triggers: [
      "inventory_change",
      "open_tab",
      "photo_post",
      "photo_post",
      "talk_npc",
    ],
    markerIds: [
      "npc_dimmi",
      "shutter_cove_marker",
      "shutter_cove_marker",
      "selfie_overlook",
      "npc_dimmi",
    ],
    reward: "50 XP, cove photo frame, Shutter Cove map note.",
    sampleDialogue:
      "If the water is lying, it is doing it with excellent composition.",
  },
  {
    id: "coops_key_hen",
    title: "Coop's Key Hen",
    giverNpcId: "old_coop",
    area: "Grove Farm Edge",
    hook: "Old Coop's favorite hen has found a key, swallowed a ribbon, and led three people into the wrong garden.",
    objectives: [
      "Follow the hen's marked trail to the dropped feed without sprinting.",
      "Collect dropped feed along the chase.",
      "Dig at the scratch mark the hen left.",
      "Use the recovered key on the old supply box.",
    ],
    triggers: ["near_location", "collect", "interact", "item_use"],
    markerIds: [
      "grove_coop_dropped_feed",
      "grove_coop_dropped_feed",
      "coop_supply_box",
      "coop_supply_box",
    ],
    reward: "40 XP, road snacks, old route clue pointing toward Billy.",
    sampleDialogue: "Never trust a map that has not been approved by poultry.",
  },
  {
    id: "tower_with_a_headache",
    title: "Tower With a Headache",
    giverNpcId: "buddy",
    area: "Genesis Crossroads",
    hook: "Buddy's service tower pings every route except the one the player needs.",
    objectives: [
      "Climb or reach Buddy's service platform.",
      "Replace a loose coil on the platform console.",
      "Clear one mucked cable node beside the tower.",
      "Ping the Old Grove Road marker from the console.",
    ],
    triggers: ["near_location", "item_use", "destroy", "interact"],
    markerIds: [
      "service_tower_platform",
      "service_tower_platform",
      "muckwad_patch",
      "old_grove_road_post",
    ],
    reward: "55 XP, temporary navigation beam upgrade, Buddy memory fragment.",
    sampleDialogue:
      "I remember helping. I do not remember who asked. This is inefficient but emotionally promising.",
  },
  {
    id: "letter_for_the_north_gate",
    title: "Letter for the North Gate",
    giverNpcId: "jackie",
    area: "The Grove -> Harthmere",
    hook: "Jackie sends a sealed note to Sergeant Bram Holt because the road signs are changing faster than Grove locals can repair them.",
    objectives: [
      "Receive Jackie's sealed letter at the fountain.",
      "Follow the Harthmere Road Connector.",
      "Speak to Sergeant Bram Holt at the North Gate.",
      "Return to Jackie with Bram's stamped pass.",
    ],
    triggers: ["item_grant", "near_location", "talk_npc", "talk_npc"],
    markerIds: [
      "grove_jackie_sealed_letter",
      "harthmere_connector",
      "sergeant_bram_holt",
      "npc_jackie",
    ],
    reward: "80 XP, Harthmere access reputation, North Gate fast marker.",
    sampleDialogue:
      "Do not let Bram scare you. He sounds like a locked door because people keep trying to walk through him.",
    connectorToHarthmere: true,
  },
  {
    id: "antlers_for_the_watch",
    title: "Antlers for the Watch",
    giverNpcId: "ranger_jane",
    area: "Mosslawn -> Harthmere Wilds",
    hook: "Jane wants Harthmere's Watch to stop mistaking natural animal panic for bandit movement.",
    objectives: [
      "Collect three track rubbings in Mosslawn.",
      "Travel the Harthmere Road Connector to the North Gate.",
      "Deliver the report to Sergeant Bram Holt's Watch table.",
      "Compare one Harthmere Wilds track with Jane's notes and return.",
    ],
    triggers: ["interact", "near_location", "talk_npc", "choice"],
    markerIds: [
      "mosslawn_warning_moss",
      "harthmere_connector",
      "sergeant_bram_holt",
      "npc_ranger_jane",
    ],
    reward:
      "90 XP, Watch/Ranger bridge reputation, Wilds animal-safe marker unlocked.",
    sampleDialogue:
      "Tell them if a deer wanted to invade a town, it would start with the vegetable stalls.",
    connectorToHarthmere: true,
  },
  {
    id: "toll_ledger_problem",
    title: "The Toll Ledger Problem",
    giverNpcId: "luis",
    area: "Genesis Crossroads -> Harthmere Market",
    hook: "Luis has a shipment of road bolts stuck behind Harthmere paperwork.",
    objectives: [
      "Pick up Luis's bolt order from the cart.",
      "Speak with the Harthmere toll clerk at the market office.",
      "Pick up the bolt crates after the clerk finds the missing ledger line.",
      "Carry the bolt crates back to Luis for road repairs.",
    ],
    triggers: ["item_grant", "talk_npc", "collect", "near_location"],
    markerIds: [
      "grove_luis_bolt_order",
      "harthmere_market_office",
      "harthmere_market_bolt_materials",
      "npc_luis",
    ],
    reward: "85 XP, road repair kit recipe, Merchant Compact intro flag.",
    sampleDialogue:
      "The difference between a road and a government is that roads occasionally go somewhere.",
    connectorToHarthmere: true,
  },
  {
    id: "samples_for_the_chapel",
    title: "Samples for the Chapel",
    giverNpcId: "doc",
    area: "Muck Edges -> Harthmere Chapel",
    hook: "Doc sends a sealed muck sample to Harthmere's chapel to test whether muck reacts to bell-resonant stone.",
    objectives: [
      "Collect a sealed muck sample at the muck edge.",
      "Bring it to Father Aldren or a chapel NPC at the Harthmere chapel.",
      "Place it on the chapel listening stone.",
      "Record whether it trembles, darkens, or stays still — and return to Doc.",
    ],
    triggers: ["collect", "talk_npc", "interact", "choice"],
    markerIds: [
      "muckwad_patch",
      "harthmere_chapel_stone",
      "harthmere_chapel_stone",
      "npc_doc",
    ],
    reward: "95 XP, chapel lore codex, unlocks Bell/Muck theory branch.",
    sampleDialogue:
      "If the priests are right, we learn something. If I am right, we learn something louder.",
    connectorToHarthmere: true,
  },
  {
    id: "tone_beneath_the_road",
    title: "The Tone Beneath the Road",
    giverNpcId: "sil",
    area: "Mosslawn -> Harthmere Bridge",
    hook: "Sil asks the player to test whether the tone under Mosslawn also lives beneath the Harthmere road.",
    objectives: [
      "Take Sil's tuning strip from the song board.",
      "Stand at the Harthmere bridge center.",
      "Ask a Black Anvil crafter to mark the strip with bell-resonant ink.",
      "Report the marked result to Sil at Mosslawn.",
    ],
    triggers: ["item_grant", "near_location", "talk_npc", "talk_npc"],
    markerIds: [
      "mosslawn_sil_tuning_strip",
      "harthmere_bridge_center",
      "harthmere_bridge_center",
      "npc_sil",
    ],
    reward: "110 XP, Bellbound hint, unlocks future main quest breadcrumb.",
    sampleDialogue:
      "If the same note lives under both roads, we should learn whether it is calling or answering.",
    connectorToHarthmere: true,
  },
  {
    id: "fountain_chat_channels",
    title: "Words Find the Right Ear",
    giverNpcId: "taye",
    area: "The Grove Fountain",
    hook: "Taye teaches new arrivals that words have channels: say is the room, party is your friends, and whisper is for one ear only — and that picking the wrong one is how strangers learn things they should not.",
    objectives: [
      "Talk to Taye at her paint table about who hears your words.",
      "Open the chat panel from the HUD.",
      "Send a 'say' message inside the fountain square so Taye can read it back to you.",
      "Try a quiet whisper directly to Taye.",
      "Choose your default channel: say, party, or whisper.",
      "Return to Taye with the channel you picked.",
    ],
    triggers: [
      "talk_npc",
      "open_tab",
      "interact",
      "interact",
      "choice",
      "talk_npc",
    ],
    markerIds: [
      "npc_taye",
      "grove_chat_practice_board",
      "grove_chat_practice_board",
      "npc_taye",
      "grove_chat_practice_board",
      "npc_taye",
    ],
    reward: "30 XP, chat channel primer, whisper habit flag.",
    sampleDialogue:
      "Say is the room, party is your friends, whisper is one ear only. Pick wrong and a stranger hears the wrong part of your day.",
  },
  {
    id: "fountain_food_keeps_you_moving",
    title: "Food Keeps You Moving",
    giverNpcId: "rosalyn",
    area: "The Grove Fountain",
    hook: "Rosalyn turns the first hunger lesson into a calm fountain drill: stamina, rations, and why nobody walks the Old Grove Road on an empty bag.",
    objectives: [
      "Talk to Rosalyn about traveler's stamina.",
      "Take a starter ration from the fountain food satchel.",
      "Eat the ration and watch your stamina settle.",
      "Jog the short fountain loop until your stamina drops once.",
      "Eat one more ration to recover before leaving the safe zone.",
      "Return to Rosalyn so she can pack you a road kit.",
    ],
    triggers: [
      "talk_npc",
      "interact",
      "item_use",
      "near_location",
      "item_use",
      "talk_npc",
    ],
    markerIds: [
      "npc_rosalyn",
      "grove_food_satchel",
      "grove_food_satchel",
      "grove_hud_compass_ring",
      "grove_food_satchel",
      "npc_rosalyn",
    ],
    reward: "35 XP, two starter rations, calm-stamina habit flag.",
    sampleDialogue:
      "A full bag and a tired body still lose the road. Eat first. Walk second. Brag third, if ever.",
  },
  {
    id: "fountain_first_aid_before_road",
    title: "First Aid Before the Road",
    giverNpcId: "rosalyn",
    area: "The Grove Fountain",
    hook: "Rosalyn teaches the bandage habit before the player meets a fight: out-of-combat heal, when to use it, when to save it, and why a clean bandage is cheaper than a confident sprint.",
    objectives: [
      "Talk to Rosalyn about minor road injuries.",
      "Take one practice bandage from the first-aid bin.",
      "Walk to the practice scratch post and tap it to simulate a small wound.",
      "Apply the bandage and watch the health bar tick back up.",
      "Choose whether you would carry one bandage, three, or a full roll on the road.",
      "Return to Rosalyn to confirm the lesson.",
    ],
    triggers: [
      "talk_npc",
      "interact",
      "near_location",
      "item_use",
      "choice",
      "talk_npc",
    ],
    markerIds: [
      "npc_rosalyn",
      "grove_first_aid_bin",
      "grove_practice_scratch_post",
      "grove_practice_scratch_post",
      "grove_first_aid_bin",
      "npc_rosalyn",
    ],
    reward: "40 XP, two practice bandages, first-aid habit flag.",
    sampleDialogue:
      "Bandage first, brag later. A clean strip and a quiet minute save more travelers than every potion I have ever weighed.",
  },
  {
    id: "fountain_hotbar_and_dropping",
    title: "Hands That Know the Hotbar",
    giverNpcId: "jackie",
    area: "The Grove Fountain",
    hook: "Jackie shows newcomers how to bind tools to the hotbar, drop a stack on purpose, and pick it back up — so panic never costs them their only torch.",
    objectives: [
      "Talk to Jackie at the fountain about hands-free habits.",
      "Open the inventory and drag a practice stone onto the hotbar.",
      "Press the bound hotbar slot to hold the practice stone.",
      "Drop the practice stone stack on the fountain stones on purpose.",
      "Pick the stack back up to prove dropped items are not lost.",
      "Return to Jackie with the stack in your hand.",
    ],
    triggers: [
      "talk_npc",
      "open_tab",
      "item_use",
      "place_voxel",
      "collect",
      "talk_npc",
    ],
    markerIds: [
      "npc_jackie",
      "grove_fountain_lesson_board",
      "grove_fountain_lesson_board",
      "grove_drop_practice_stones",
      "grove_drop_practice_stones",
      "npc_jackie",
    ],
    reward: "35 XP, hotbar habit flag, drop-and-recover note.",
    sampleDialogue:
      "Your hands are slower than your panic. Bind the tool you would die without, and trust the rest to your bag.",
  },
  {
    id: "fountain_first_recipe_torch",
    title: "Your First Real Recipe",
    giverNpcId: "jackie",
    area: "The Grove Fountain",
    hook: "Jackie walks the player through their first real crafted item — a small road torch — so the recipe panel, workbench, and lit-light habit all click before the road goes dark.",
    objectives: [
      "Talk to Jackie about her tinder kit.",
      "Gather two practice sticks from the marked basket.",
      "Open the recipe panel and find the road torch recipe.",
      "Craft one road torch at the fountain workbench.",
      "Light the torch and stand in the dim corner of the courtyard until it catches.",
      "Return to Jackie with the lit torch.",
    ],
    triggers: [
      "talk_npc",
      "collect",
      "open_tab",
      "craft",
      "interact",
      "talk_npc",
    ],
    markerIds: [
      "npc_jackie",
      "grove_resource_basket",
      "grove_fountain_workbench",
      "grove_fountain_workbench",
      "grove_dim_corner",
      "npc_jackie",
    ],
    reward: "50 XP, one road torch, first-recipe flag.",
    sampleDialogue:
      "A recipe is a promise to your future self. Make the small thing now while it is safe, so your hands remember the shape when it is not.",
  },
  {
    id: "fountain_trade_table_promises",
    title: "Trade Is a Promise You Both Sign",
    giverNpcId: "guild_clerk_nia",
    area: "The Grove Fountain / Charter Table",
    hook: "Nia walks the player through a real trade at the practice table — both sides confirm, both sides accept — so a first trade with a stranger does not become a first scam.",
    objectives: [
      "Talk to Nia at the charter table about safe trading.",
      "Open the trade window at the practice trade desk.",
      "Place one practice item into your side of the trade slot.",
      "Inspect the clerk's side of the trade desk before you confirm.",
      "Choose the trade rule worth keeping: equal value, confirmed both sides, or no rushed accepts.",
      "Return to Nia to stamp the trade habit into your charter.",
    ],
    triggers: [
      "talk_npc",
      "interact",
      "item_grant",
      "interact",
      "choice",
      "talk_npc",
    ],
    markerIds: [
      "npc_guild_clerk_nia",
      "grove_trade_desk",
      "grove_trade_desk",
      "grove_trade_desk",
      "guild_charter_board",
      "npc_guild_clerk_nia",
    ],
    reward: "45 XP, trade-safety flag, first guild charter clause.",
    sampleDialogue:
      "A trade is a promise both sides sign. If one side is in a hurry, the other side should not be.",
  },
  // SNAPSHOT_GROVE_GRADUATION_CHAIN:
  // Once the player has finished a handful of fountain lessons, Jackie offers
  // a single short "tour" quest that walks them through the three closest
  // out-of-fountain regions (Lovely Locks west, Genesis Crossroads south,
  // and the Mosslawn boundary southwest). Accepting that tour unlocks one
  // short introduction quest per neighbor, each pinned to a different region
  // so the player actually explores the world to complete them.
  {
    id: "grove_road_graduation",
    title: "Where the Road Asks for You",
    giverNpcId: "jackie",
    area: "The Grove Fountain · Road Tour",
    category: "road_graduation",
    unlockedBy: {
      kind: "fountain_completion_count",
      minCompletedFountainLessons: 5,
    },
    hook: "Jackie has watched you complete enough fountain lessons that the road is the next teacher. Three Grove neighbors live on it. Walk to each of them once so the road learns your boots.",
    objectives: [
      "Tell Jackie you are ready to step beyond the fountain.",
      "Walk west to Lovely Locks and find Alexis at her fitting room.",
      "Walk south to the Genesis Crossroads and find Luis at his repair cart.",
      "Walk to the Mosslawn boundary and find Ranger Jane on the quiet edge.",
      "Return to Jackie at the fountain when all three neighbors have been met.",
    ],
    triggers: [
      "talk_npc",
      "near_location",
      "near_location",
      "near_location",
      "talk_npc",
    ],
    markerIds: [
      "npc_jackie",
      "npc_alexis",
      "npc_luis",
      "npc_ranger_jane",
      "npc_jackie",
    ],
    reward:
      "120 XP, Grove graduation badge, three road-neighbor lessons unlocked, fountain compass habit closed out.",
    sampleDialogue:
      "You have done the fountain lessons. The road wants the rest of the work now. Three of our neighbors live on it. Meet each one once and tell me which one made the most sense.",
  },
  {
    id: "intro_alexis_lovely_locks",
    title: "First Mirror Outside the Fountain",
    giverNpcId: "alexis",
    area: "Lovely Locks",
    category: "road_neighbor",
    unlockedBy: { kind: "quest_accepted", questId: "grove_road_graduation" },
    hook: "Alexis runs the Lovely Locks fitting room and gives every new road-walker one calm look in the mirror before they go further. A travel kit is a promise the road can read.",
    objectives: [
      "Walk to Alexis at the Lovely Locks fitting room.",
      "Stand at the Lovely Locks mirror so Alexis can look you over.",
      "Equip or confirm one travel-ready clothing piece while you are at the mirror.",
      "Pick the road-promise your clothes should make: warm, light, or work-ready.",
      "Tell Alexis which promise you chose.",
    ],
    triggers: [
      "near_location",
      "interact",
      "inventory_change",
      "choice",
      "talk_npc",
    ],
    markerIds: [
      "npc_alexis",
      "lovely_locks_mirror",
      "lovely_locks_mirror",
      "lovely_locks_mirror",
      "npc_alexis",
    ],
    reward:
      "55 XP, Lovely Locks discount flag, road outfit habit, Alexis trust opened.",
    sampleDialogue:
      "The road takes more from people who arrive at it surprised. Let me see what you are wearing before the road sees it first.",
  },
  {
    id: "intro_luis_crossroads_cart",
    title: "Three Wheels, One Road",
    giverNpcId: "luis",
    area: "Genesis Crossroads",
    category: "road_neighbor",
    unlockedBy: { kind: "quest_accepted", questId: "grove_road_graduation" },
    hook: "Luis's repair cart is the Crossroads' shortest lesson in road problems. Anyone who can talk to Luis once knows where to bring a broken wheel later — and where to find the best gossip about which road is lying this week.",
    objectives: [
      "Walk to Luis's repair cart at the Crossroads.",
      "Inspect Luis's cart and find what broke first.",
      "Pick the repair Luis should try first: wheel, axle, or load.",
      "Take a sample road bolt from the cart for your kit.",
      "Tell Luis which lesson stuck with you.",
    ],
    triggers: ["near_location", "interact", "choice", "item_grant", "talk_npc"],
    markerIds: ["npc_luis", "luis_cart", "luis_cart", "luis_cart", "npc_luis"],
    reward:
      "65 XP, Crossroads road-bolt sample, repair habit, Luis merchant-compact intro flag.",
    sampleDialogue:
      "I am not the smith. I am the one who keeps the road from eating his customers. Come look at this cart before it has to keep telling its story alone.",
  },
  {
    id: "intro_jane_mosslawn_edge",
    title: "The Path That Listens Back",
    giverNpcId: "ranger_jane",
    area: "Mosslawn Boundary",
    category: "road_neighbor",
    unlockedBy: { kind: "quest_accepted", questId: "grove_road_graduation" },
    hook: "Jane teaches new road-walkers to listen to Mosslawn before walking it. Warning moss, animal silence, and the right edge of the safe path are the first three things she shows you.",
    objectives: [
      "Walk to Ranger Jane at the Mosslawn boundary.",
      "Inspect a warning moss patch with Jane standing next to you.",
      "Walk the marked stretch quietly to the song stones without sprinting.",
      "Pick a road-sense rule worth carrying: watch animals, watch moss, or watch the wind.",
      "Tell Ranger Jane which rule you chose.",
    ],
    triggers: [
      "near_location",
      "interact",
      "near_location",
      "choice",
      "talk_npc",
    ],
    markerIds: [
      "npc_ranger_jane",
      "mosslawn_warning_moss",
      "mosslawn_song_stones",
      "mosslawn_warning_moss",
      "npc_ranger_jane",
    ],
    reward:
      "70 XP, Ranger trail badge, Mosslawn safe-edge note, animal-sense flag.",
    sampleDialogue:
      "If the road were polite, the animals would tell us. They are not polite. They go quiet. Let me show you which quiet is the helpful kind.",
  },
  // GROVE_ECONOMY_STARTER: 15 starter-cash quests to bootstrap the player
  // into the futuristic-society business economy (Courier / Trader / Hunter /
  // Farming / Cook / Guide / Repair Person archetypes).
  ...GROVE_ECONOMY_STARTER_QUESTS,
];

function snapshotGroveRequiredTurnInMarkerId(quest: SnapshotGroveQuest) {
  return (
    SNAPSHOT_GROVE_LANDMARKS.find(
      (landmark) =>
        landmark.kind === "npc" && landmark.npcId === quest.giverNpcId
    )?.id ?? `npc_${quest.giverNpcId}`
  );
}

function withRequiredSnapshotGroveTurnIn(
  quest: SnapshotGroveQuest
): SnapshotGroveQuest {
  if (quest.triggers[quest.triggers.length - 1] === "talk_npc") {
    return quest;
  }
  const giver = SNAPSHOT_GROVE_NPCS.find(
    (npc) => npc.id === quest.giverNpcId
  )?.displayName;
  return {
    ...quest,
    objectives: [
      ...quest.objectives,
      `Return to ${
        giver ?? "the quest giver"
      } to report the result and collect the reward.`,
    ],
    triggers: [...quest.triggers, "talk_npc"],
    markerIds: [...quest.markerIds, snapshotGroveRequiredTurnInMarkerId(quest)],
  };
}

// Every Grove quest closes through the same visible conversation/reward path.
// Keeping this normalization at the catalog boundary avoids thirteen bespoke
// completion branches in the client, backend, native quest biscuit, and E2E.
export const SNAPSHOT_GROVE_QUESTS: SnapshotGroveQuest[] =
  SNAPSHOT_GROVE_QUESTS_WITHOUT_REQUIRED_TURN_INS.map(
    withRequiredSnapshotGroveTurnIn
  );

export const SNAPSHOT_GROVE_PLAYER_BUILDER_PRESETS = [
  {
    id: "grove_wayfinder",
    label: "Grove Wayfinder",
    description:
      "Soft starter clothes, strong route-readiness, and Jackie-style road confidence.",
    clothingTags: ["travel_top", "travel_bottoms", "boots", "warm_colors"],
  },
  {
    id: "lovely_locks_traveler",
    label: "Lovely Locks Traveler",
    description:
      "Identity-forward outfit choices that make clothing part of player story, not only cosmetics.",
    clothingTags: ["styled_top", "scarf", "clean_boots", "photo_ready"],
  },
  {
    id: "mosslawn_scout",
    label: "Mosslawn Scout",
    description:
      "Muted trail colors and practical boots for players who want the ranger path.",
    clothingTags: ["ranger", "green", "brown", "trail_boots"],
  },
  {
    id: "shutter_cove_lenskeeper",
    label: "Shutter Cove Lenskeeper",
    description:
      "Camera/social starter identity for players who want photo proof and exploration notes.",
    clothingTags: ["camera", "blue", "cove", "social"],
  },
] as const;

export const SNAPSHOT_GROVE_STATIC_ASSET_PORTS = [
  "asset_data/npcs/jackie.db2de25c1a8e8e8bf5afd846618c17b2.glb",
  "asset_data/npcs/ranger_jane.f73490ebc9f495fd4b93180b6e3be420.glb",
  "asset_data/npcs/luis.4ba3043804f17aee072b28d40f90454b.glb",
  "asset_data/npcs/taye.142130690a1eef1e19d8be4a4a18afa3.glb",
  "asset_data/npcs/alexis.6c11f07c0990f7844ccf50e8e856f2fb.glb",
  "asset_data/npcs/dimmi.3c8a6df18decedd92a1a96e4b57f023a.glb",
  "asset_data/npcs/oldCoop.7092e4566d691958f05eca393643ff95.glb",
  "asset_data/npcs/buddy.26e75e1b35cfd6353805c0fe3d62c739.gltf",
  "asset_data/npcs/mucked_robot.8acc469f3490a33c56b3f2bedded5fc9.gltf",
] as const;
