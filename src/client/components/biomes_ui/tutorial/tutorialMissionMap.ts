// tutorialMissionMap — maps a SnapshotMissionStep's (target, trigger)
// pair to a list of UI ids that should blink for the user.
//
// We deliberately keep this as a pure data table so it can be:
//   1. Unit-tested in isolation (no React / no DOM).
//   2. Audited by a static script (scripts/harthmere/check-biomes-ui-tutorial-targets.cjs).
//   3. Extended without touching the runtime — just add a row here when
//      a new mission step lands.

import { UI_IDS } from "../uniqueIds";

export type StepTarget =
  | "jackie"
  | "grove"
  | "road_marker"
  | "muckwad_patch"
  | "building_spot"
  | "wardrobe"
  | "jump_run"
  | "selfie_overlook"
  | "crafting_stop";

export type StepTrigger =
  | "dialog"
  | "location"
  | "destroy"
  | "place_voxel"
  | "wearing"
  | "running_jump"
  | "photo"
  | "craft_muck_buster";

export interface BlinkCue {
  uniqueId: string;
  caption?: string;
  style?: "pulse" | "ring" | "arrow" | "shimmer";
  /** Persistent until the step completes (0 = until cleared) */
  durationMs?: number;
}

export interface MissionHighlightDescriptor {
  target: StepTarget;
  trigger: StepTrigger;
  cues: BlinkCue[];
}

export const MISSION_HIGHLIGHTS: MissionHighlightDescriptor[] = [
  // Talk to Jackie — highlight the map marker + open the map tab.
  {
    target: "jackie", trigger: "dialog",
    cues: [
      { uniqueId: UI_IDS.MAP_MARKER("jackie"), style: "ring", caption: "Speak with Jackie", durationMs: 0 },
      { uniqueId: UI_IDS.TAB_MAP, style: "pulse", caption: "Open map", durationMs: 6000 },
    ],
  },
  // Reach the road marker.
  {
    target: "road_marker", trigger: "location",
    cues: [
      { uniqueId: UI_IDS.MAP_MARKER("road_marker"), style: "ring", caption: "Head here", durationMs: 0 },
      { uniqueId: UI_IDS.TAB_MAP, style: "pulse", durationMs: 4500 },
    ],
  },
  // Break muckwad — flag the hotbar tool you'd use.
  {
    target: "muckwad_patch", trigger: "destroy",
    cues: [
      { uniqueId: UI_IDS.MAP_MARKER("muckwad_patch"), style: "ring", caption: "Break this", durationMs: 0 },
      { uniqueId: UI_IDS.HOTBAR_SLOT(1), style: "pulse", caption: "Use your tool", durationMs: 6000 },
    ],
  },
  // Place a block — highlight the hotbar block slot.
  {
    target: "building_spot", trigger: "place_voxel",
    cues: [
      { uniqueId: UI_IDS.MAP_MARKER("building_spot"), style: "ring", caption: "Place here", durationMs: 0 },
      { uniqueId: UI_IDS.HOTBAR_SLOT(2), style: "pulse", caption: "Equip a block", durationMs: 6000 },
    ],
  },
  // Gear up — open Inventory tab + blink the chest/legs slots.
  {
    target: "wardrobe", trigger: "wearing",
    cues: [
      { uniqueId: UI_IDS.TAB_INVENTORY, style: "pulse", caption: "Open inventory", durationMs: 0 },
      { uniqueId: UI_IDS.INVENTORY_SLOT_CHEST, style: "ring", caption: "Equip a top", durationMs: 0 },
      { uniqueId: UI_IDS.INVENTORY_SLOT_LEGS, style: "ring", caption: "Equip bottoms", durationMs: 0 },
    ],
  },
  // Running jump.
  {
    target: "jump_run", trigger: "running_jump",
    cues: [
      { uniqueId: UI_IDS.CUE_SPRINT, style: "pulse", caption: "Hold Shift to sprint", durationMs: 0 },
      { uniqueId: UI_IDS.CUE_JUMP, style: "pulse", caption: "Press Space to jump", durationMs: 0 },
    ],
  },
  // Selfie.
  {
    target: "selfie_overlook", trigger: "photo",
    cues: [
      { uniqueId: UI_IDS.MAP_MARKER("selfie_overlook"), style: "ring", caption: "Stand here", durationMs: 0 },
      { uniqueId: UI_IDS.CAMERA_BUTTON, style: "pulse", caption: "Open camera", durationMs: 0 },
      { uniqueId: UI_IDS.CAMERA_SELFIE_MODE, style: "ring", caption: "Flip to selfie", durationMs: 0 },
    ],
  },
  // Craft a muck buster — highlight the recipes tab and the specific recipe.
  {
    target: "crafting_stop", trigger: "craft_muck_buster",
    cues: [
      { uniqueId: UI_IDS.RECIPE_LIST, style: "pulse", caption: "Open recipes", durationMs: 0 },
      { uniqueId: UI_IDS.RECIPE_MUCK_BUSTER, style: "ring", caption: "Craft this", durationMs: 0 },
    ],
  },
];

/** Lookup helper used by the runtime director. */
export function cuesForStep(target: StepTarget, trigger: StepTrigger): BlinkCue[] {
  const match = MISSION_HIGHLIGHTS.find(
    (h) => h.target === target && h.trigger === trigger
  );
  return match?.cues ?? [];
}
