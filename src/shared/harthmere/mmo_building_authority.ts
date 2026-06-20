/*
 * mmo_building_authority.ts
 *
 * Server-authoritative building placement validation for Harthmere MMO.
 *
 * The rules say placement MUST validate (server-side, never trust client):
 *   - terrain type (buildable vs water/lava/road/dungeon)
 *   - slope (maximum allowed degrees per structure tier)
 *   - foundation (solid voxel support underneath)
 *   - clipping (no overlap with existing structures, terrain features, NPCs)
 *   - entrance / path access (player, NPC, mount, cart must be able to reach)
 *   - roads / stairs / bridges / quest areas / NPC routes must remain clear
 *   - plot bounds (structure must be within the owned plot polygon)
 *   - height / size limits per zone and plot type
 *   - spacing between structures for players / NPCs / mounts / carts
 */

export const MMO_BUILDING_AUTHORITY_VERSION = "mmo-building-authority";

// ---------------------------------------------------------------------------
// Terrain types
// ---------------------------------------------------------------------------

export type HarthmereTerrainType =
  | "grass"
  | "dirt"
  | "stone"
  | "sand"
  | "snow"
  | "marsh"
  | "water"
  | "lava"
  | "road"
  | "bridge"
  | "dungeon_floor"
  | "quest_zone"
  | "npc_route"
  | "protected";

/** Terrain types that can never have buildings placed on them */
const UNBUILDABLE_TERRAIN: ReadonlySet<HarthmereTerrainType> = new Set([
  "water",
  "lava",
  "road",
  "bridge",
  "dungeon_floor",
  "quest_zone",
  "npc_route",
  "protected",
]);

// ---------------------------------------------------------------------------
// Structure definitions (server catalogue)
// ---------------------------------------------------------------------------

export type HarthmereStructureType =
  | "small_house"
  | "medium_house"
  | "large_house"
  | "shop"
  | "workshop"
  | "warehouse"
  | "market_stall"
  | "canopy"
  | "fixture"
  | "utility_station"
  | "farm_utility"
  | "signal_tower"
  | "farm_plot"
  | "guild_hall"
  | "watchtower"
  | "fence"
  | "wall_segment"
  | "gate"
  | "stairs"
  | "bridge_segment";

export interface HarthmereStructureDefinition {
  structureTypeId: HarthmereStructureType;
  displayName: string;
  /** Footprint in voxels: { width (x), depth (z), height (y) } */
  footprint: { width: number; depth: number; height: number };
  /** Maximum slope in degrees the foundation can tolerate */
  maxSlopeDegrees: number;
  /** Foundation solid-voxel support required: number of foundation voxels underneath */
  requiredFoundationVoxels: number;
  /** Minimum horizontal spacing from the outer wall of another structure (voxels) */
  minSpacingToStructureVoxels: number;
  /** Minimum space between entrance and nearest obstruction (voxels) */
  minEntranceClearanceVoxels: number;
  /** Whether this structure has a defined entrance tile */
  hasEntrance: boolean;
  /** Whether this structure requires a road or path connection */
  requiresRoadAccess: boolean;
  /** Allowed terrain types for the base */
  allowedTerrainTypes: HarthmereTerrainType[];
  /** Maximum height above ground in voxels */
  maxHeightAboveGround: number;
  /** Required plot type */
  requiredPlotType?: HarthmerePlotType;
  /** Minimum plot size in voxels (area) */
  minPlotAreaVoxels: number;
}

// ---------------------------------------------------------------------------
// Plot types
// ---------------------------------------------------------------------------

export type HarthmerePlotType =
  | "residential"
  | "commercial"
  | "crafting"
  | "farm"
  | "guild"
  | "public"
  | "wilderness";

export interface HarthmerePlotDefinition {
  plotId: string;
  ownerId: string;
  plotType: HarthmerePlotType;
  /** Bounding polygon in world coordinates (XZ plane) */
  boundaryPolygon: Array<{ x: number; z: number }>;
  /** Maximum total structure height in voxels for this plot */
  maxStructureHeight: number;
  /** Maximum total covered area as fraction of plot area (0–1) */
  maxCoveredAreaFraction: number;
  /** Already covered area in voxels */
  currentCoveredAreaVoxels: number;
  /** Total plot area in voxels */
  totalAreaVoxels: number;
  /** Whether the plot is currently taxed/active */
  active: boolean;
}

// ---------------------------------------------------------------------------
// World geometry snapshot (server-owned; never trust client)
// ---------------------------------------------------------------------------

export interface HarthmereBuildingPlacementContext {
  /** 2D terrain map for the footprint area; one entry per voxel column */
  terrainColumns: Array<{
    x: number;
    z: number;
    terrainType: HarthmereTerrainType;
    groundHeight: number;
    /** Slope in degrees from adjacent columns */
    slopeDegrees: number;
    /** Whether this column has solid foundation voxels */
    hasFoundationSupport: boolean;
  }>;
  /** Bounding boxes of nearby structures */
  nearbyStructures: Array<{
    structureId: string;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
    /** Is this an NPC route / quest structure that must stay clear? */
    isProtectedInfrastructure: boolean;
  }>;
  /** NPC patrol waypoints within the build zone */
  npcRouteWaypoints: Array<{ x: number; z: number; clearanceRadiusVoxels: number }>;
  /** Quest trigger areas within the build zone */
  questTriggerAreas: Array<{
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  }>;
  /** Whether a road/path is accessible within minRoadDistanceVoxels */
  hasRoadAccess: boolean;
  minRoadDistanceVoxels: number;
  /** Current plot definition */
  plot?: HarthmerePlotDefinition;
}

// ---------------------------------------------------------------------------
// Placement request / result
// ---------------------------------------------------------------------------

export interface HarthmereBuildingPlacementRequest {
  requestId: string;
  actorId: string;
  structureTypeId: HarthmereStructureType;
  /** Proposed origin (lower-NW corner) in world voxel coordinates */
  origin: { x: number; y: number; z: number };
  /** Rotation: 0, 90, 180, 270 degrees (clockwise Y-axis) */
  rotationDegrees: 0 | 90 | 180 | 270;
  plotId?: string;
  nowMs: number;
}

export interface HarthmereBuildingPlacementResult {
  ok: boolean;
  requestId: string;
  actorId: string;
  structureTypeId: HarthmereStructureType;
  errors: string[];
  warnings: string[];
  /** Server-resolved origin after snapping (may differ from client suggestion) */
  resolvedOrigin?: { x: number; y: number; z: number };
  /** Resolved rotation */
  resolvedRotationDegrees?: 0 | 90 | 180 | 270;
  auditTags: string[];
}

// ---------------------------------------------------------------------------
// Structure catalogue registry
// ---------------------------------------------------------------------------

const _structureRegistry = new Map<HarthmereStructureType, HarthmereStructureDefinition>();

export function registerHarthmereStructureDefinition(
  def: HarthmereStructureDefinition
) {
  _structureRegistry.set(def.structureTypeId, def);
}

export function getHarthmereStructureDefinition(
  typeId: HarthmereStructureType
): HarthmereStructureDefinition | undefined {
  return _structureRegistry.get(typeId);
}

// Register built-in structure types with sensible defaults
(function seedBuiltinStructures() {
  const defaults: HarthmereStructureDefinition[] = [
    {
      structureTypeId: "small_house",
      displayName: "Small House",
      footprint: { width: 5, depth: 5, height: 4 },
      maxSlopeDegrees: 15,
      requiredFoundationVoxels: 25,
      minSpacingToStructureVoxels: 2,
      minEntranceClearanceVoxels: 3,
      hasEntrance: true,
      requiresRoadAccess: false,
      allowedTerrainTypes: ["grass", "dirt", "stone"],
      maxHeightAboveGround: 6,
      requiredPlotType: "residential",
      minPlotAreaVoxels: 36,
    },
    {
      structureTypeId: "medium_house",
      displayName: "Medium House",
      footprint: { width: 8, depth: 8, height: 6 },
      maxSlopeDegrees: 10,
      requiredFoundationVoxels: 64,
      minSpacingToStructureVoxels: 3,
      minEntranceClearanceVoxels: 4,
      hasEntrance: true,
      requiresRoadAccess: true,
      allowedTerrainTypes: ["grass", "dirt", "stone"],
      maxHeightAboveGround: 10,
      requiredPlotType: "residential",
      minPlotAreaVoxels: 100,
    },
    {
      structureTypeId: "shop",
      displayName: "Shop",
      footprint: { width: 6, depth: 6, height: 4 },
      maxSlopeDegrees: 5,
      requiredFoundationVoxels: 36,
      minSpacingToStructureVoxels: 2,
      minEntranceClearanceVoxels: 4,
      hasEntrance: true,
      requiresRoadAccess: true,
      allowedTerrainTypes: ["grass", "dirt", "stone", "sand"],
      maxHeightAboveGround: 8,
      requiredPlotType: "commercial",
      minPlotAreaVoxels: 64,
    },
    {
      structureTypeId: "farm_plot",
      displayName: "Farm Plot",
      footprint: { width: 10, depth: 10, height: 1 },
      maxSlopeDegrees: 5,
      requiredFoundationVoxels: 100,
      minSpacingToStructureVoxels: 1,
      minEntranceClearanceVoxels: 2,
      hasEntrance: false,
      requiresRoadAccess: false,
      allowedTerrainTypes: ["grass", "dirt"],
      maxHeightAboveGround: 2,
      requiredPlotType: "farm",
      minPlotAreaVoxels: 144,
    },
    {
      structureTypeId: "guild_hall",
      displayName: "Guild Hall",
      footprint: { width: 14, depth: 14, height: 8 },
      maxSlopeDegrees: 5,
      requiredFoundationVoxels: 196,
      minSpacingToStructureVoxels: 5,
      minEntranceClearanceVoxels: 6,
      hasEntrance: true,
      requiresRoadAccess: true,
      allowedTerrainTypes: ["grass", "dirt", "stone"],
      maxHeightAboveGround: 16,
      requiredPlotType: "guild",
      minPlotAreaVoxels: 400,
    },
    {
      structureTypeId: "fence",
      displayName: "Fence Segment",
      footprint: { width: 1, depth: 3, height: 2 },
      maxSlopeDegrees: 25,
      requiredFoundationVoxels: 3,
      minSpacingToStructureVoxels: 0,
      minEntranceClearanceVoxels: 0,
      hasEntrance: false,
      requiresRoadAccess: false,
      allowedTerrainTypes: ["grass", "dirt", "stone", "sand", "snow"],
      maxHeightAboveGround: 3,
      minPlotAreaVoxels: 1,
    },
  ];
  for (const def of defaults) {
    _structureRegistry.set(def.structureTypeId, def);
  }
})();

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function getRotatedFootprint(
  def: HarthmereStructureDefinition,
  rotation: 0 | 90 | 180 | 270
): { width: number; depth: number } {
  if (rotation === 90 || rotation === 270) {
    return { width: def.footprint.depth, depth: def.footprint.width };
  }
  return { width: def.footprint.width, depth: def.footprint.depth };
}

/** Point-in-polygon test (ray casting) */
function pointInPolygon(
  px: number,
  pz: number,
  polygon: Array<{ x: number; z: number }>
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const zi = polygon[i].z;
    const xj = polygon[j].x;
    const zj = polygon[j].z;
    const intersect =
      zi > pz !== zj > pz &&
      px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function aabbsOverlap(
  aMinX: number,
  aMaxX: number,
  aMinZ: number,
  aMaxZ: number,
  bMinX: number,
  bMaxX: number,
  bMinZ: number,
  bMaxZ: number,
  margin = 0
): boolean {
  return (
    aMinX < bMaxX + margin &&
    aMaxX > bMinX - margin &&
    aMinZ < bMaxZ + margin &&
    aMaxZ > bMinZ - margin
  );
}

// ---------------------------------------------------------------------------
// Core placement validation
// ---------------------------------------------------------------------------

function fail(errors: string[], ...codes: string[]) {
  errors.push(...codes);
}

function warn(warnings: string[], ...codes: string[]) {
  warnings.push(...codes);
}

export function validateHarthmereBuildingPlacement(
  req: HarthmereBuildingPlacementRequest,
  ctx: HarthmereBuildingPlacementContext
): HarthmereBuildingPlacementResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const def = getHarthmereStructureDefinition(req.structureTypeId);
  if (!def) {
    return {
      ok: false,
      requestId: req.requestId,
      actorId: req.actorId,
      structureTypeId: req.structureTypeId,
      errors: ["unknown_structure_type"],
      warnings: [],
      auditTags: [],
    };
  }

  const footprint = getRotatedFootprint(def, req.rotationDegrees);
  const minX = req.origin.x;
  const maxX = req.origin.x + footprint.width;
  const minZ = req.origin.z;
  const maxZ = req.origin.z + footprint.depth;
  const baseY = req.origin.y;

  // --- Terrain checks ---
  let foundationCount = 0;
  let maxSlopeFound = 0;
  const terrainViolations: string[] = [];

  for (const col of ctx.terrainColumns) {
    if (col.x < minX || col.x >= maxX || col.z < minZ || col.z >= maxZ) {
      continue; // outside footprint
    }
    // Terrain type
    if (UNBUILDABLE_TERRAIN.has(col.terrainType)) {
      terrainViolations.push(`terrain_not_buildable:${col.terrainType}@${col.x},${col.z}`);
    } else if (!def.allowedTerrainTypes.includes(col.terrainType)) {
      terrainViolations.push(`terrain_type_not_allowed:${col.terrainType}`);
    }
    // Slope
    if (col.slopeDegrees > maxSlopeFound) maxSlopeFound = col.slopeDegrees;
    // Foundation
    if (col.hasFoundationSupport) foundationCount++;
  }

  if (terrainViolations.length > 0) {
    fail(errors, ...terrainViolations.slice(0, 5));
    if (terrainViolations.length > 5) {
      fail(errors, `terrain_violations_truncated:${terrainViolations.length - 5}_more`);
    }
  }

  // Slope
  if (maxSlopeFound > def.maxSlopeDegrees) {
    fail(errors, `slope_too_steep:${maxSlopeFound.toFixed(1)}_degrees_max_${def.maxSlopeDegrees}`);
  }

  // Foundation
  if (foundationCount < def.requiredFoundationVoxels) {
    fail(
      errors,
      `insufficient_foundation:${foundationCount}_of_${def.requiredFoundationVoxels}_required`
    );
  }

  // Height above ground
  const terrainHeights = ctx.terrainColumns
    .filter((c) => c.x >= minX && c.x < maxX && c.z >= minZ && c.z < maxZ)
    .map((c) => c.groundHeight);
  const avgGroundHeight =
    terrainHeights.length > 0
      ? terrainHeights.reduce((a, b) => a + b, 0) / terrainHeights.length
      : baseY;
  const heightAboveGround = baseY - avgGroundHeight + def.footprint.height;
  if (heightAboveGround > def.maxHeightAboveGround) {
    fail(
      errors,
      `structure_too_tall:${heightAboveGround}_voxels_max_${def.maxHeightAboveGround}`
    );
  }

  // --- Plot boundary check ---
  const plot = ctx.plot;
  if (req.plotId && !plot) {
    fail(errors, "plot_not_found");
  }

  if (plot) {
    if (plot.ownerId !== req.actorId) {
      fail(errors, "plot_not_owned_by_actor");
    }

    // All four corners of the footprint must be inside the plot boundary
    const corners = [
      { x: minX, z: minZ },
      { x: maxX - 1, z: minZ },
      { x: minX, z: maxZ - 1 },
      { x: maxX - 1, z: maxZ - 1 },
    ];
    for (const corner of corners) {
      if (!pointInPolygon(corner.x, corner.z, plot.boundaryPolygon)) {
        fail(errors, `structure_outside_plot_boundary:${corner.x},${corner.z}`);
        break;
      }
    }

    // Plot type
    if (def.requiredPlotType && plot.plotType !== def.requiredPlotType) {
      fail(
        errors,
        `wrong_plot_type:${plot.plotType}_required_${def.requiredPlotType}`
      );
    }

    // Plot area
    const newCoveredArea = footprint.width * footprint.depth;
    const totalCovered = plot.currentCoveredAreaVoxels + newCoveredArea;
    if (totalCovered > plot.totalAreaVoxels * plot.maxCoveredAreaFraction) {
      fail(errors, "plot_coverage_limit_exceeded");
    }

    if (heightAboveGround > plot.maxStructureHeight) {
      fail(
        errors,
        `plot_height_limit_exceeded:${heightAboveGround}_voxels_max_${plot.maxStructureHeight}`
      );
    }

    // Plot minimum size
    if (plot.totalAreaVoxels < def.minPlotAreaVoxels) {
      fail(errors, `plot_too_small:${plot.totalAreaVoxels}_min_${def.minPlotAreaVoxels}`);
    }

    // Plot active
    if (!plot.active) {
      fail(errors, "plot_not_active_or_tax_unpaid");
    }
  } else if (!req.plotId) {
    // Wilderness placement — warn but allow (may have zone restrictions)
    warn(warnings, "wilderness_placement_no_plot_ownership");
  }

  // --- Clipping — overlap with existing structures ---
  for (const structure of ctx.nearbyStructures) {
    const margin = def.minSpacingToStructureVoxels;
    if (
      aabbsOverlap(
        minX,
        maxX,
        minZ,
        maxZ,
        structure.minX,
        structure.maxX,
        structure.minZ,
        structure.maxZ,
        margin
      )
    ) {
      if (structure.isProtectedInfrastructure) {
        fail(errors, `clips_protected_infrastructure:${structure.structureId}`);
      } else {
        fail(errors, `clips_existing_structure:${structure.structureId}`);
      }
    }
  }

  // --- NPC route clearance ---
  for (const waypoint of ctx.npcRouteWaypoints) {
    const wpInFootprint =
      waypoint.x >= minX - waypoint.clearanceRadiusVoxels &&
      waypoint.x <= maxX + waypoint.clearanceRadiusVoxels &&
      waypoint.z >= minZ - waypoint.clearanceRadiusVoxels &&
      waypoint.z <= maxZ + waypoint.clearanceRadiusVoxels;
    if (wpInFootprint) {
      fail(errors, `blocks_npc_route_waypoint:${waypoint.x},${waypoint.z}`);
    }
  }

  // --- Quest trigger area clearance ---
  for (const quest of ctx.questTriggerAreas) {
    if (
      aabbsOverlap(minX, maxX, minZ, maxZ, quest.minX, quest.maxX, quest.minZ, quest.maxZ)
    ) {
      fail(errors, "overlaps_quest_trigger_area");
    }
  }

  // --- Entrance / path access ---
  if (def.hasEntrance) {
    // Entrance is on the south face (minZ side, centre column) after rotation
    const entranceX = Math.floor((minX + maxX) / 2);
    const entranceZ = minZ - 1;
    // Check entrance clearance: no structure within clearance radius of entrance
    for (const structure of ctx.nearbyStructures) {
      const entranceBlocked =
        entranceX >= structure.minX - def.minEntranceClearanceVoxels &&
        entranceX <= structure.maxX + def.minEntranceClearanceVoxels &&
        entranceZ >= structure.minZ - def.minEntranceClearanceVoxels &&
        entranceZ <= structure.maxZ + def.minEntranceClearanceVoxels;
      if (entranceBlocked) {
        fail(errors, `entrance_clearance_blocked_by:${structure.structureId}`);
      }
    }
  }

  // --- Road access requirement ---
  if (def.requiresRoadAccess && !ctx.hasRoadAccess) {
    fail(errors, "no_road_access_within_required_distance");
  }

  const ok = errors.length === 0;

  return {
    ok,
    requestId: req.requestId,
    actorId: req.actorId,
    structureTypeId: req.structureTypeId,
    errors,
    warnings,
    resolvedOrigin: ok ? req.origin : undefined,
    resolvedRotationDegrees: ok ? req.rotationDegrees : undefined,
    auditTags: ok
      ? [
          "building_placement_approved",
          req.structureTypeId,
          `origin:${req.origin.x},${req.origin.y},${req.origin.z}`,
          `rotation:${req.rotationDegrees}`,
          ...(req.plotId ? [`plot:${req.plotId}`] : []),
        ]
      : [
          "building_placement_rejected",
          req.structureTypeId,
          `error_count:${errors.length}`,
        ],
  };
}

// ---------------------------------------------------------------------------
// Demolition / removal validation
// ---------------------------------------------------------------------------

export interface HarthmereBuildingDemolitionRequest {
  requestId: string;
  actorId: string;
  structureId: string;
  plotId?: string;
  nowMs: number;
}

export interface HarthmereBuildingDemolitionResult {
  ok: boolean;
  requestId: string;
  errors: string[];
  warnings: string[];
  auditTags: string[];
}

export interface HarthmereBuildingDemolitionContext {
  structureOwnerId: string;
  plotOwnerId?: string;
  hasActiveResidents: boolean;
  hasActiveVendor: boolean;
  hasActiveQuestNpcs: boolean;
}

export function validateHarthmereBuildingDemolition(
  req: HarthmereBuildingDemolitionRequest,
  ctx: HarthmereBuildingDemolitionContext
): HarthmereBuildingDemolitionResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (
    ctx.structureOwnerId !== req.actorId &&
    ctx.plotOwnerId !== req.actorId
  ) {
    fail(errors, "not_structure_or_plot_owner");
  }

  if (ctx.hasActiveResidents) {
    fail(errors, "cannot_demolish_with_active_residents");
  }

  if (ctx.hasActiveVendor) {
    fail(errors, "cannot_demolish_with_active_vendor_inside");
  }

  if (ctx.hasActiveQuestNpcs) {
    warn(warnings, "demolition_may_break_active_quest_check_with_gm");
  }

  return {
    ok: errors.length === 0,
    requestId: req.requestId,
    errors,
    warnings,
    auditTags:
      errors.length === 0
        ? ["building_demolition_approved", req.structureId]
        : ["building_demolition_rejected", req.structureId, `errors:${errors.length}`],
  };
}

// ---------------------------------------------------------------------------
// Plot ownership / tax validation
// ---------------------------------------------------------------------------

export interface HarthmerePlotClaimRequest {
  requestId: string;
  actorId: string;
  plotId: string;
  nowMs: number;
}

export interface HarthmerePlotClaimResult {
  ok: boolean;
  requestId: string;
  errors: string[];
  warnings: string[];
  goldCost: number;
  auditTags: string[];
}

export interface HarthmerePlotClaimContext {
  plot: HarthmerePlotDefinition | undefined;
  claimPriceGold: number;
  actorGold: number;
  actorOwnedPlotCount: number;
  maxPlotsPerActor: number;
}

export function validateHarthmerePlotClaim(
  req: HarthmerePlotClaimRequest,
  ctx: HarthmerePlotClaimContext
): HarthmerePlotClaimResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!ctx.plot) fail(errors, "plot_not_found");
  if (ctx.plot && ctx.plot.ownerId !== "" && ctx.plot.ownerId !== req.actorId) {
    fail(errors, "plot_already_owned");
  }
  if (ctx.actorGold < ctx.claimPriceGold) {
    fail(errors, "insufficient_gold_for_plot_claim");
  }
  if (ctx.actorOwnedPlotCount >= ctx.maxPlotsPerActor) {
    fail(errors, "plot_ownership_limit_reached");
  }

  return {
    ok: errors.length === 0,
    requestId: req.requestId,
    errors,
    warnings,
    goldCost: ctx.claimPriceGold,
    auditTags:
      errors.length === 0
        ? ["plot_claim_approved", req.plotId, `cost:${ctx.claimPriceGold}`]
        : ["plot_claim_rejected", req.plotId],
  };
}
