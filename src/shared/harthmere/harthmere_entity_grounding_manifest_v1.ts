import {
  HARTHMERE_GROUND_SCAN_DOWN_DEFAULT_V1,
  HARTHMERE_GROUND_SCAN_UP_DEFAULT_V1,
} from "@/shared/harthmere/harthmere_entity_grounding_v1";

// HARTHMERE_ENTITY_GROUNDING_MANIFEST_V1
//
// One referenceable place that describes HOW positioned things are kept on the
// ground in Harthmere, WHICH entity types are wired, and the terrain facts the
// system depends on. Code can import the registry/constants below; humans can
// read it as the spec. Keep it in sync when you add a new positioned entity
// type or change the grounding wiring.
//
// THE MODEL (see harthmere_entity_grounding_v1.ts):
//   Entities are SEEDED with a flat/authored hint Y (muck areas ≈ 54, Grove
//   ≈ 70). At RENDER time the client probes the REAL voxel terrain at the
//   entity's (x,z) — via /terrain/pathfinding/human_can_occupy — and rests the
//   entity on the true surface (nearest standable feet-Y to the hint). Because
//   it probes real terrain, hills and the Grove/wilds height seam resolve with
//   no per-zone constants. Grounding lives on the CLIENT because the server seed
//   cannot cheaply read terrain (it is in encoded Redis shards).
//
// EDGE CASES HANDLED:
//   - CAVES: outdoor entities use requireOpenSky=true so they never ground onto a
//     cave floor that sits under solid terrain (the cave ceiling fails the
//     open-sky check). Indoor entities (business owners on a roofed floor) use
//     requireOpenSky=false so they stay on the floor, not the roof.
//   - WATER: the client support sampler treats WATER as standable, so entities
//     rest ON the water surface (water below, air above) and are never dropped
//     onto the lake bed underwater.
//   - Documented residual edges: a cave whose ceiling is taller than the sky
//     clearance, or a tree canopy / enclosed structure shorter than it, can be
//     mis-judged; in practice entity hints sit near the surface so this is rare.

export const HARTHMERE_ENTITY_GROUNDING_MANIFEST_VERSION_V1 =
  "harthmere-entity-grounding-manifest-v1" as const;

// Authored / observed terrain reference frames (world feet-Y). The grounder does
// NOT hardcode these — they are documentation of why a flat hint is unreliable.
export const HARTHMERE_TERRAIN_HEIGHT_FRAMES_V1 = {
  // Live production Grove/Harthmere courtyard the browser actually loads.
  groveLiveFeetY: 70,
  // Wilds / muck floor.
  wildsFeetY: 54,
  // The seam the old constant "-17" hack tried to bridge.
  groveWildsSeamBlocks: 16,
} as const;

export const HARTHMERE_GROUNDING_SCAN_BUDGET_V1 = {
  down: HARTHMERE_GROUND_SCAN_DOWN_DEFAULT_V1,
  up: HARTHMERE_GROUND_SCAN_UP_DEFAULT_V1,
  // Real production elevation spread measured by
  // scripts/harthmere/probe-production-terrain-grounding-v1.cjs. Filled in from
  // the live probe; see HARTHMERE_GROUNDING_PRODUCTION_PROBE_V1 below.
} as const;

export type HarthmereGroundingStatusV1 =
  | "terrain_grounded" // probes real terrain at render
  | "intentional_position" // authored/player position is deliberate; do NOT auto-ground
  | "needs_wiring"; // floats today; render path lacks terrain access

export interface HarthmereGroundedEntityKindV1 {
  kind: string;
  status: HarthmereGroundingStatusV1;
  where: string;
  notes: string;
}

// The registry of every positioned thing and its grounding status.
export const HARTHMERE_GROUNDED_ENTITY_REGISTRY_V1: readonly HarthmereGroundedEntityKindV1[] =
  [
    {
      kind: "npcs",
      status: "terrain_grounded",
      where:
        "src/client/game/resources/npcs.ts (sampleHarthmereNpcGroundFeetYV1 -> navigation guard groundYAt)",
      notes:
        "All living NPCs ground to the real surface each frame via the robust probe.",
    },
    {
      kind: "muckers_hexers_quest_monsters",
      status: "terrain_grounded",
      where: "same NPC path (they are NPCs)",
      notes:
        "Replaces the Grove-only constant '-17' hack; the probe bridges the Grove/wilds seam and hills.",
    },
    {
      kind: "business_owner_and_customer_npcs",
      status: "terrain_grounded",
      where:
        "src/client/game/resources/npcs.ts (requireOpenSky=false for owner/customer ids)",
      notes:
        "Owners (id band 9601+) and customers (9701+) stand on a ROOFED building floor, so they ground with requireOpenSky=false (nearest-to-floor) — open-sky mode would push them onto the roof. isHarthmereBusinessOwnerNpcEntityIdV1 / isHarthmereBusinessCustomerNpcEntityIdV1 select them.",
    },
    {
      kind: "quest_items_drops",
      status: "terrain_grounded",
      where: "src/client/game/resources/drops.ts (makeDrop)",
      notes: "Grounded at spawn; falls back to stored Y if terrain not loaded.",
    },
    {
      kind: "quest_markers",
      status: "terrain_grounded",
      where:
        "src/client/game/renderers/local_dev/harthmere_quest_object_markers_v145.ts (groundVisibleMarkersV1)",
      notes:
        "Renderer now receives ClientResources and re-grounds every visible marker to the real surface each frame (cave-safe, water-aware).",
    },
    {
      kind: "placeables",
      status: "intentional_position",
      where: "src/client/game/renderers/placeables.ts",
      notes:
        "Player-placed at deliberate Y (signs on walls, items on tables). Do NOT blanket auto-ground; only ground placeables that are authored/seeded at a flat hint Y.",
    },
  ] as const;

// Filled from the live production terrain probe (script above). Numbers are the
// measured ground-feet-Y spread and the max |trueGround - hint| delta, which
// must stay within the scan budget for the grounder to reach every entity.
export interface HarthmereGroundingProbeAreaResultV1 {
  area: string;
  positions: number;
  groundFeetYMin: number | null;
  groundFeetYMax: number | null;
  maxAbsDeltaFromHint: number | null;
  budgetInsufficient: number;
  columnsWithNoTerrainData: number;
}

// Measured live against production Redis (public host) on 2026-06-03 by
// scripts/harthmere/probe-production-terrain-grounding-v1.cjs over 335,366 keys.
// VERDICT: terrain is very hilly (54-block ground spread across muck areas,
// 42-block across outpost pads). The flat hints were wrong by up to 40 blocks
// (muckers floating) / 10 blocks (owners buried) — which is exactly why this
// system is required. Every one of the 119 positions resolved to real terrain
// and the ±72/56 grounder budget reached the true surface at ALL of them
// (budgetInsufficient = 0), with comfortable margin (worst |delta| 40 < 72 down,
// 10 < 56 up).
export const HARTHMERE_GROUNDING_PRODUCTION_PROBE_V1: {
  measuredAtIso?: string;
  areas: readonly HarthmereGroundingProbeAreaResultV1[];
} = {
  measuredAtIso: "2026-06-03",
  areas: [
    { area: "west_muck_breach", positions: 17, groundFeetYMin: 14, groundFeetYMax: 48, maxAbsDeltaFromHint: 40, budgetInsufficient: 0, columnsWithNoTerrainData: 0 },
    { area: "watchtower_muck_patch", positions: 23, groundFeetYMin: 27, groundFeetYMax: 53, maxAbsDeltaFromHint: 27, budgetInsufficient: 0, columnsWithNoTerrainData: 0 },
    { area: "old_wood_muck_patch", positions: 21, groundFeetYMin: 49, groundFeetYMax: 68, maxAbsDeltaFromHint: 14, budgetInsufficient: 0, columnsWithNoTerrainData: 0 },
    { area: "old_wood_mucker_copse", positions: 12, groundFeetYMin: 49, groundFeetYMax: 64, maxAbsDeltaFromHint: 10, budgetInsufficient: 0, columnsWithNoTerrainData: 0 },
    { area: "gravewood_pale_muck", positions: 16, groundFeetYMin: 46, groundFeetYMax: 58, maxAbsDeltaFromHint: 8, budgetInsufficient: 0, columnsWithNoTerrainData: 0 },
    { area: "watchtower_muck_clearing", positions: 11, groundFeetYMin: 34, groundFeetYMax: 47, maxAbsDeltaFromHint: 20, budgetInsufficient: 0, columnsWithNoTerrainData: 0 },
    { area: "ALL_MUCKERS", positions: 100, groundFeetYMin: 14, groundFeetYMax: 68, maxAbsDeltaFromHint: 40, budgetInsufficient: 0, columnsWithNoTerrainData: 0 },
    { area: "ALL_BUSINESS_OWNERS", positions: 19, groundFeetYMin: 33, groundFeetYMax: 75, maxAbsDeltaFromHint: 10, budgetInsufficient: 0, columnsWithNoTerrainData: 0 },
  ],
};
