// CHAPTER_1_MAP_LANDMARKS
//
// World-map pins for the places Chapter 1 sends the player.
//
// WHY THIS EXISTS
// Chapter 1 shipped 31 quests across nine distinct locations and put NONE of
// them on the world map. The Grove's own content is all pinned — 77 landmarks
// flow through `SNAPSHOT_GROVE_LANDMARKS` into /api/world_map/landmarks — but
// Chapter 1 anchors live in `CH1_ANCHORS` and were never exposed, so a player
// told to "go to the Greenlamp Walk-In Clinic" or "walk to Ashline" had a quest
// marker and no map. The chapter compensated with a permanent HUD banner
// printing a metre count, which is the symptom, not the fix.
//
// Positions come straight from CH1_ANCHORS, which is now grounded against the
// production terrain scan (see the header of ch1_ids.ts), so a pin here cannot
// disagree with the objective marker or float over the terrain.
//
// SPOILER DISCIPLINE
// Journal §0: no client-visible string may leak the twist before Act 6. These
// labels are all diegetic names the world already uses out loud. `gate_prime`
// is deliberately absent — it is the Act 6 epilogue aperture and naming it on
// the map before the chapter ends would announce the ending.

import { CH1_ANCHORS, type Ch1Vec3 } from "@/shared/harthmere/ch1_ids";

export const CH1_MAP_LANDMARKS_VERSION = "ch1-map-landmarks-v1" as const;

export interface Ch1MapLandmark {
  /** Stable suffix for the map entity id. Never reorder; append only. */
  slug: string;
  label: string;
  position: Ch1Vec3;
  /** 1 renders at a larger zoom threshold, matching Grove safe zones. */
  importance: 0 | 1;
}

export const CH1_MAP_LANDMARKS: readonly Ch1MapLandmark[] = Object.freeze([
  {
    slug: "grove_roadhouse",
    label: "Grove Road-House",
    position: CH1_ANCHORS.roadhouse_door,
    importance: 1,
  },
  {
    slug: "grove_watch_house",
    label: "Grove Watch House",
    position: CH1_ANCHORS.grove_watch_house,
    importance: 1,
  },
  {
    slug: "coretta_ledger_desk",
    label: "Coretta's Ledger Desk",
    position: CH1_ANCHORS.coretta_ledger_desk,
    importance: 0,
  },
  {
    slug: "greenlamp_clinic",
    label: "Greenlamp Walk-In Clinic",
    position: CH1_ANCHORS.greenlamp_clinic,
    importance: 1,
  },
  {
    slug: "ashline_containment_works",
    label: "Ashline Containment Works",
    position: CH1_ANCHORS.ashline_containment_works,
    importance: 1,
  },
  {
    slug: "returnstone_pad_office",
    label: "Returnstone Pad Office",
    position: CH1_ANCHORS.returnstone_pad_office,
    importance: 1,
  },
  {
    slug: "old_bridge",
    label: "Old Bridge",
    position: CH1_ANCHORS.harthmere_bridge_center,
    importance: 1,
  },
  {
    slug: "old_wood_copse",
    label: "Old Wood Copse",
    position: CH1_ANCHORS.old_wood_copse_sentinel,
    importance: 0,
  },
  {
    slug: "fence_line_seam",
    label: "The Fence Line",
    position: CH1_ANCHORS.gate_fence_sighting,
    importance: 0,
  },
  {
    slug: "old_wood_aperture",
    label: "The Old Wood Aperture",
    position: CH1_ANCHORS.gate_desert,
    importance: 1,
  },
  {
    slug: "cold_gate",
    label: "The Cold Gate",
    position: CH1_ANCHORS.gate_winter,
    importance: 1,
  },
] as const);
