import {
  HARTHMERE_GROUND_SCAN_DOWN_DEFAULT,
  HARTHMERE_GROUND_SCAN_UP_DEFAULT,
} from "@/shared/harthmere/harthmere_entity_grounding";

// HARTHMERE_ENTITY_GROUNDING_MANIFEST
//
// One referenceable place that describes HOW positioned things are kept on the
// ground in Harthmere, WHICH entity types are wired, and the terrain facts the
// system depends on. Code can import the registry/constants below; humans can
// read it as the spec. Keep it in sync when you add a new positioned entity
// type or change the grounding wiring.
//
// THE TWO-FRAME MODEL (see harthmere_entity_grounding.ts and
// world_extension.ts):
//   1. Additive Harthmere owns a known flat terrain band east of X=1792. Its
//      outdoor actors seed authoritatively at feet Y=53 and are clipped inside
//      the extension bounds.
//   2. The original snapshot/Grove map remains hilly. Its outdoor actors use an
//      open-sky terrain probe and its roofed business actors use the nearest
//      indoor floor. The required post-deploy probe repairs ECS position and NPC
//      spawn_position, then reads them back. Client grounding remains a visual
//      streaming safeguard, not the only authority.
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

export const HARTHMERE_ENTITY_GROUNDING_MANIFEST_VERSION =
  "harthmere-entity-grounding-manifest-v2" as const;

// Authored / observed terrain reference frames (world feet-Y). The grounder does
// NOT hardcode these — they are documentation of why a flat hint is unreliable.
export const HARTHMERE_TERRAIN_HEIGHT_FRAMES = {
  // Flat feet plane for the additive Harthmere extension.
  additiveHarthmereFeetY: 53,
  // Live production Grove courtyard the browser actually loads.
  groveLiveFeetY: 70,
  // Historical original-map wilds hint; real hills vary by column.
  wildsFeetY: 54,
  // The seam the old constant "-17" hack tried to bridge.
  groveWildsSeamBlocks: 16,
} as const;

export const HARTHMERE_GROUNDING_SCAN_BUDGET = {
  down: HARTHMERE_GROUND_SCAN_DOWN_DEFAULT,
  up: HARTHMERE_GROUND_SCAN_UP_DEFAULT,
  // Real production elevation spread measured by
  // scripts/harthmere/probe-production-terrain-grounding.cjs. Filled in from
  // the live probe; see HARTHMERE_GROUNDING_PRODUCTION_PROBE below.
} as const;

export type HarthmereGroundingStatus =
  | "extension_flat_grounded" // authoritative flat extension position
  | "terrain_grounded" // production terrain repair + client streaming safeguard
  | "intentional_position" // authored/player position is deliberate; do NOT auto-ground
  | "needs_wiring"; // floats today; render path lacks terrain access

export interface HarthmereGroundedEntityKind {
  kind: string;
  status: HarthmereGroundingStatus;
  where: string;
  notes: string;
}

// The registry of every positioned thing and its grounding status.
export const HARTHMERE_GROUNDED_ENTITY_REGISTRY: readonly HarthmereGroundedEntityKind[] =
  [
    {
      kind: "additive_harthmere_town_npcs_and_boards",
      status: "extension_flat_grounded",
      where:
        "src/server/shim/main.ts (harthmereGroundedNpcWorldPositionWithClaim + runtime-content grounding v2)",
      notes:
        "All migrated town actors preserve authored X/Z but use feet Y=53. Legacy measured cluster Y values apply only to explicit standalone mode.",
    },
    {
      kind: "original_grove_npcs_and_snapshot_hostiles",
      status: "terrain_grounded",
      where:
        "scripts/harthmere/probe-production-terrain-grounding.cjs plus src/client/game/resources/npcs.ts",
      notes:
        "The deploy probe repairs authoritative ECS/spawn Y from the hilly production terrain; the client repeats the probe when streamed terrain changes.",
    },
    {
      kind: "additive_muckers_hexers_animals_and_robots",
      status: "extension_flat_grounded",
      where:
        "src/shared/harthmere/live_entity_production_seed.ts and world_extension.ts",
      notes:
        "Every outdoor seed is normalized to Y=53 and clipped inside X=1792..2560 and Z=-576..192. Containment radii cannot cross the edge.",
    },
    {
      kind: "business_owner_and_customer_npcs",
      status: "terrain_grounded",
      where:
        "scripts/harthmere/probe-production-terrain-grounding.cjs and src/client/game/resources/npcs.ts (requireOpenSky=false)",
      notes:
        "Owners (9601+), customers (9701+), and seeded crafting stations use the nearest roofed floor. The deploy gate repairs NPCs and objects without moving player-authored placeables.",
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
        "src/client/game/renderers/local_dev/harthmere_quest_object_markers.ts (groundVisibleMarkers)",
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
export interface HarthmereGroundingProbeAreaResult {
  area: string;
  positions: number;
  groundFeetYMin: number | null;
  groundFeetYMax: number | null;
  maxAbsDeltaFromHint: number | null;
  budgetInsufficient: number;
  columnsWithNoTerrainData: number;
}

// Historical measurement of the ORIGINAL hilly map, captured on 2026-06-03.
// It must not be reused as the height model for the additive flat extension.
// The current deployment probe runs against every deterministic family and
// emits live per-family results instead of relying on this frozen sample.
// VERDICT: terrain is very hilly (54-block ground spread across muck areas,
// 42-block across outpost pads). The flat hints were wrong by up to 40 blocks
// (muckers floating) / 10 blocks (owners buried) — which is exactly why this
// system is required. Every one of the 119 positions resolved to real terrain
// and the ±72/56 grounder budget reached the true surface at ALL of them
// (budgetInsufficient = 0), with comfortable margin (worst |delta| 40 < 72 down,
// 10 < 56 up).
export const HARTHMERE_GROUNDING_PRODUCTION_PROBE: {
  measuredAtIso?: string;
  areas: readonly HarthmereGroundingProbeAreaResult[];
} = {
  measuredAtIso: "2026-06-03",
  areas: [
    {
      area: "west_muck_breach",
      positions: 17,
      groundFeetYMin: 14,
      groundFeetYMax: 48,
      maxAbsDeltaFromHint: 40,
      budgetInsufficient: 0,
      columnsWithNoTerrainData: 0,
    },
    {
      area: "watchtower_muck_patch",
      positions: 23,
      groundFeetYMin: 27,
      groundFeetYMax: 53,
      maxAbsDeltaFromHint: 27,
      budgetInsufficient: 0,
      columnsWithNoTerrainData: 0,
    },
    {
      area: "old_wood_muck_patch",
      positions: 21,
      groundFeetYMin: 49,
      groundFeetYMax: 68,
      maxAbsDeltaFromHint: 14,
      budgetInsufficient: 0,
      columnsWithNoTerrainData: 0,
    },
    {
      area: "old_wood_mucker_copse",
      positions: 12,
      groundFeetYMin: 49,
      groundFeetYMax: 64,
      maxAbsDeltaFromHint: 10,
      budgetInsufficient: 0,
      columnsWithNoTerrainData: 0,
    },
    {
      area: "gravewood_pale_muck",
      positions: 16,
      groundFeetYMin: 46,
      groundFeetYMax: 58,
      maxAbsDeltaFromHint: 8,
      budgetInsufficient: 0,
      columnsWithNoTerrainData: 0,
    },
    {
      area: "watchtower_muck_clearing",
      positions: 11,
      groundFeetYMin: 34,
      groundFeetYMax: 47,
      maxAbsDeltaFromHint: 20,
      budgetInsufficient: 0,
      columnsWithNoTerrainData: 0,
    },
    {
      area: "ALL_MUCKERS",
      positions: 100,
      groundFeetYMin: 14,
      groundFeetYMax: 68,
      maxAbsDeltaFromHint: 40,
      budgetInsufficient: 0,
      columnsWithNoTerrainData: 0,
    },
    {
      area: "ALL_BUSINESS_OWNERS",
      positions: 19,
      groundFeetYMin: 33,
      groundFeetYMax: 75,
      maxAbsDeltaFromHint: 10,
      budgetInsufficient: 0,
      columnsWithNoTerrainData: 0,
    },
  ],
};
