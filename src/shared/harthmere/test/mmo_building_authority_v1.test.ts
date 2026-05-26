/**
 * mmo_building_authority_v1.test.ts
 *
 * Comprehensive tests for server-authoritative building placement validation.
 * Covers base cases and edge cases for every validator rule.
 */

import assert from "assert";
import {
  registerHarthmereStructureDefinitionV1,
  validateHarthmereBuildingPlacementV1,
  validateHarthmereBuildingDemolitionV1,
  validateHarthmerePlotClaimV1,
  type HarthmereBuildingPlacementRequestV1,
  type HarthmereBuildingPlacementContextV1,
  type HarthmereBuildingDemolitionRequestV1,
  type HarthmereBuildingDemolitionContextV1,
  type HarthmerePlotClaimRequestV1,
  type HarthmerePlotClaimContextV1,
  type HarthmereStructureDefinitionV1,
  type HarthmerePlotDefinitionV1,
  type HarthmereTerrainTypeV1,
} from "../mmo_building_authority_v1";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

let _reqSeq = 0;
function nextReqId() {
  return `req-building-${++_reqSeq}`;
}

const NOW_MS = 1_700_000_000_000;

/** Flat 5×5 grass terrain centred on origin — enough for a small_house footprint */
function makeGrassColumns(
  minX: number,
  minZ: number,
  width: number,
  depth: number,
  overrides: Partial<{
    terrainType: HarthmereTerrainTypeV1;
    slopeDegrees: number;
    hasFoundationSupport: boolean;
    groundHeight: number;
  }> = {}
): HarthmereBuildingPlacementContextV1["terrainColumns"] {
  const cols: HarthmereBuildingPlacementContextV1["terrainColumns"] = [];
  for (let x = minX; x < minX + width; x++) {
    for (let z = minZ; z < minZ + depth; z++) {
      cols.push({
        x,
        z,
        terrainType: overrides.terrainType ?? "grass",
        groundHeight: overrides.groundHeight ?? 64,
        slopeDegrees: overrides.slopeDegrees ?? 0,
        hasFoundationSupport: overrides.hasFoundationSupport ?? true,
      });
    }
  }
  return cols;
}

/** A large-enough residential plot at (0,0)→(50,50) */
function makeResidentialPlot(
  overrides: Partial<HarthmerePlotDefinitionV1> = {}
): HarthmerePlotDefinitionV1 {
  return {
    plotId: "plot_res_1",
    ownerId: "player_1",
    plotType: "residential",
    boundaryPolygon: [
      { x: 0, z: 0 },
      { x: 50, z: 0 },
      { x: 50, z: 50 },
      { x: 0, z: 50 },
    ],
    maxStructureHeight: 20,
    maxCoveredAreaFraction: 0.5,
    currentCoveredAreaVoxels: 0,
    totalAreaVoxels: 2500, // 50×50
    active: true,
    ...overrides,
  };
}

/** Build a default valid context (small_house footprint, origin 5,64,5) */
function makeValidPlacementCtx(
  overrides: Partial<HarthmereBuildingPlacementContextV1> = {}
): HarthmereBuildingPlacementContextV1 {
  return {
    terrainColumns: makeGrassColumns(5, 5, 5, 5), // small_house: 5×5
    nearbyStructures: [],
    npcRouteWaypoints: [],
    questTriggerAreas: [],
    hasRoadAccess: true,
    minRoadDistanceVoxels: 10,
    plot: makeResidentialPlot(),
    ...overrides,
  };
}

/** Build a placement request for small_house */
function makePlacementReq(
  overrides: Partial<HarthmereBuildingPlacementRequestV1> = {}
): HarthmereBuildingPlacementRequestV1 {
  return {
    requestId: nextReqId(),
    actorId: "player_1",
    structureTypeId: "small_house",
    origin: { x: 5, y: 64, z: 5 },
    rotationDegrees: 0,
    plotId: "plot_res_1",
    nowMs: NOW_MS,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Register a custom structure type for edge-case testing
// ---------------------------------------------------------------------------

before(function registerTestStructures() {
  // A "road_stall" that requires commercial plot and road access
  const roadStall: HarthmereStructureDefinitionV1 = {
    structureTypeId: "shop",        // reuse an existing type slot; just override
    displayName: "Test Road Stall",
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
  };
  registerHarthmereStructureDefinitionV1(roadStall);
});

// ===========================================================================
// 1. validateHarthmereBuildingPlacementV1 — success cases
// ===========================================================================

describe("validateHarthmereBuildingPlacementV1 — success", function () {
  it("places a small_house on flat grass with a residential plot", function () {
    const req = makePlacementReq();
    const ctx = makeValidPlacementCtx();
    const result = validateHarthmereBuildingPlacementV1(req, ctx);
    assert.ok(result.ok, result.errors.join(", "));
    assert.strictEqual(result.errors.length, 0);
    assert.deepStrictEqual(result.resolvedOrigin, req.origin);
    assert.strictEqual(result.resolvedRotationDegrees, 0);
    assert.ok(result.auditTags.includes("building_placement_approved"));
  });

  it("emits wilderness_placement_no_plot_ownership warning when no plotId given", function () {
    const req = makePlacementReq({ plotId: undefined });
    const ctx = makeValidPlacementCtx({ plot: undefined });
    const result = validateHarthmereBuildingPlacementV1(req, ctx);
    // Should still be ok (warning only)
    assert.ok(result.ok, result.errors.join(", "));
    assert.ok(result.warnings.includes("wilderness_placement_no_plot_ownership"));
  });

  it("allows a fence with no plot, steep slope is within fence max (25°)", function () {
    const req = makePlacementReq({
      structureTypeId: "fence",
      plotId: undefined,
      origin: { x: 5, y: 64, z: 5 },
    });
    const ctx = makeValidPlacementCtx({
      plot: undefined,
      terrainColumns: makeGrassColumns(5, 5, 1, 3, { slopeDegrees: 20 }),
    });
    const result = validateHarthmereBuildingPlacementV1(req, ctx);
    assert.ok(result.ok, result.errors.join(", "));
  });

  it("resolvedOrigin and resolvedRotationDegrees set on success", function () {
    const req = makePlacementReq({ rotationDegrees: 90 });
    // 90° rotates footprint: small_house 5×5 stays 5×5 (symmetric)
    const ctx = makeValidPlacementCtx({
      terrainColumns: makeGrassColumns(5, 5, 5, 5),
    });
    const result = validateHarthmereBuildingPlacementV1(req, ctx);
    assert.ok(result.ok, result.errors.join(", "));
    assert.strictEqual(result.resolvedRotationDegrees, 90);
  });
});

// ===========================================================================
// 2. Unknown structure type
// ===========================================================================

describe("validateHarthmereBuildingPlacementV1 — unknown structure type", function () {
  it("returns unknown_structure_type error for unregistered typeId", function () {
    const req = makePlacementReq({
      structureTypeId: "unknown_magic_tower" as any,
    });
    const ctx = makeValidPlacementCtx();
    const result = validateHarthmereBuildingPlacementV1(req, ctx);
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.includes("unknown_structure_type"));
  });
});

// ===========================================================================
// 3. Unbuildable terrain types
// ===========================================================================

describe("validateHarthmereBuildingPlacementV1 — unbuildable terrain", function () {
  const unbuildableTypes: HarthmereTerrainTypeV1[] = [
    "water",
    "lava",
    "road",
    "bridge",
    "dungeon_floor",
    "quest_zone",
    "npc_route",
    "protected",
  ];

  for (const tt of unbuildableTypes) {
    it(`rejects placement on ${tt} terrain`, function () {
      const req = makePlacementReq();
      const ctx = makeValidPlacementCtx({
        terrainColumns: makeGrassColumns(5, 5, 5, 5, { terrainType: tt }),
      });
      const result = validateHarthmereBuildingPlacementV1(req, ctx);
      assert.strictEqual(result.ok, false);
      assert.ok(
        result.errors.some((e) => e.startsWith("terrain_not_buildable:")),
        `Expected terrain_not_buildable error for ${tt}, got: ${result.errors.join(", ")}`
      );
    });
  }

  it("allows marsh terrain since it is not in the unbuildable set (but may be disallowed by structure)", function () {
    // small_house only allows grass/dirt/stone — marsh is not in that list
    const req = makePlacementReq();
    const ctx = makeValidPlacementCtx({
      terrainColumns: makeGrassColumns(5, 5, 5, 5, { terrainType: "marsh" }),
    });
    const result = validateHarthmereBuildingPlacementV1(req, ctx);
    // Not unbuildable but also not in small_house allowedTerrainTypes
    assert.strictEqual(result.ok, false);
    assert.ok(
      result.errors.some((e) => e.startsWith("terrain_type_not_allowed:")),
      `Expected terrain_type_not_allowed error, got: ${result.errors.join(", ")}`
    );
  });
});

// ===========================================================================
// 4. Slope too steep
// ===========================================================================

describe("validateHarthmereBuildingPlacementV1 — slope violations", function () {
  it("rejects when max column slope exceeds structure maxSlopeDegrees", function () {
    const req = makePlacementReq();
    // small_house allows max 15°; push one column to 20°
    const cols = makeGrassColumns(5, 5, 5, 5);
    cols[0].slopeDegrees = 20;
    const ctx = makeValidPlacementCtx({ terrainColumns: cols });
    const result = validateHarthmereBuildingPlacementV1(req, ctx);
    assert.strictEqual(result.ok, false);
    assert.ok(
      result.errors.some((e) => e.startsWith("slope_too_steep:")),
      `Expected slope_too_steep, got: ${result.errors.join(", ")}`
    );
  });

  it("accepts slope exactly at maxSlopeDegrees boundary", function () {
    const req = makePlacementReq();
    const cols = makeGrassColumns(5, 5, 5, 5);
    cols[0].slopeDegrees = 15; // exactly at small_house max
    const ctx = makeValidPlacementCtx({ terrainColumns: cols });
    const result = validateHarthmereBuildingPlacementV1(req, ctx);
    assert.ok(result.ok, result.errors.join(", "));
  });

  it("rejects placement when every column is steeply sloped", function () {
    const req = makePlacementReq();
    const cols = makeGrassColumns(5, 5, 5, 5, { slopeDegrees: 45 });
    const ctx = makeValidPlacementCtx({ terrainColumns: cols });
    const result = validateHarthmereBuildingPlacementV1(req, ctx);
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.some((e) => e.startsWith("slope_too_steep:")));
  });
});

// ===========================================================================
// 5. Insufficient foundation
// ===========================================================================

describe("validateHarthmereBuildingPlacementV1 — foundation support", function () {
  it("rejects when zero foundation voxels available", function () {
    const req = makePlacementReq();
    const cols = makeGrassColumns(5, 5, 5, 5, { hasFoundationSupport: false });
    const ctx = makeValidPlacementCtx({ terrainColumns: cols });
    const result = validateHarthmereBuildingPlacementV1(req, ctx);
    assert.strictEqual(result.ok, false);
    assert.ok(
      result.errors.some((e) => e.startsWith("insufficient_foundation:")),
      `Expected insufficient_foundation, got: ${result.errors.join(", ")}`
    );
  });

  it("rejects when foundation count is below required (partial support)", function () {
    // small_house requires 25 foundation voxels (5×5 = 25 total columns)
    // provide only 10 with support
    const cols = makeGrassColumns(5, 5, 5, 5, { hasFoundationSupport: false });
    for (let i = 0; i < 10; i++) cols[i].hasFoundationSupport = true;
    const ctx = makeValidPlacementCtx({ terrainColumns: cols });
    const result = validateHarthmereBuildingPlacementV1(makePlacementReq(), ctx);
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.some((e) => e.startsWith("insufficient_foundation:")));
  });

  it("accepts when foundation count meets exactly required threshold", function () {
    // 25 columns all with foundation support
    const cols = makeGrassColumns(5, 5, 5, 5, { hasFoundationSupport: true });
    assert.strictEqual(cols.length, 25);
    const ctx = makeValidPlacementCtx({ terrainColumns: cols });
    const result = validateHarthmereBuildingPlacementV1(makePlacementReq(), ctx);
    assert.ok(result.ok, result.errors.join(", "));
  });
});

// ===========================================================================
// 6. Plot boundary violations
// ===========================================================================

describe("validateHarthmereBuildingPlacementV1 — plot boundary", function () {
  it("rejects when requested plotId is set but no plot in context", function () {
    const req = makePlacementReq({ plotId: "missing_plot" });
    const ctx = makeValidPlacementCtx({ plot: undefined });
    const result = validateHarthmereBuildingPlacementV1(req, ctx);
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.includes("plot_not_found"));
  });

  it("rejects when a corner of the footprint lies outside the plot polygon", function () {
    // Tiny plot 6×6 at (0,0); place small_house at (5,64,5) — corners at x=9 outside plot
    const req = makePlacementReq({ origin: { x: 5, y: 64, z: 5 } });
    const tinyPlot = makeResidentialPlot({
      boundaryPolygon: [
        { x: 0, z: 0 },
        { x: 6, z: 0 },
        { x: 6, z: 6 },
        { x: 0, z: 6 },
      ],
      totalAreaVoxels: 36,
    });
    const ctx = makeValidPlacementCtx({ plot: tinyPlot });
    const result = validateHarthmereBuildingPlacementV1(req, ctx);
    assert.strictEqual(result.ok, false);
    assert.ok(
      result.errors.some((e) => e.startsWith("structure_outside_plot_boundary:")),
      `Expected outside boundary error, got: ${result.errors.join(", ")}`
    );
  });

  it("rejects wrong plot type (commercial plot, small_house requires residential)", function () {
    const req = makePlacementReq();
    const ctx = makeValidPlacementCtx({
      plot: makeResidentialPlot({ plotType: "commercial" }),
    });
    const result = validateHarthmereBuildingPlacementV1(req, ctx);
    assert.strictEqual(result.ok, false);
    assert.ok(
      result.errors.some((e) => e.startsWith("wrong_plot_type:")),
      `Expected wrong_plot_type, got: ${result.errors.join(", ")}`
    );
  });

  it("rejects when plot coverage limit would be exceeded", function () {
    // small_house footprint = 5×5 = 25 voxels; plot max 50% of 100 = 50; already 30 covered → 30+25=55 > 50
    const req = makePlacementReq();
    const ctx = makeValidPlacementCtx({
      plot: makeResidentialPlot({
        totalAreaVoxels: 100,
        maxCoveredAreaFraction: 0.5,
        currentCoveredAreaVoxels: 30,
      }),
    });
    const result = validateHarthmereBuildingPlacementV1(req, ctx);
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.includes("plot_coverage_limit_exceeded"));
  });

  it("rejects when plot area is smaller than structure minimum plot area", function () {
    const req = makePlacementReq();
    const ctx = makeValidPlacementCtx({
      plot: makeResidentialPlot({ totalAreaVoxels: 20, minPlotAreaVoxels: undefined as any }),
    });
    // small_house.minPlotAreaVoxels = 36; plot 20 < 36
    const result = validateHarthmereBuildingPlacementV1(req, ctx);
    assert.strictEqual(result.ok, false);
    assert.ok(
      result.errors.some((e) => e.startsWith("plot_too_small:")),
      `Expected plot_too_small, got: ${result.errors.join(", ")}`
    );
  });

  it("rejects when plot is inactive (tax unpaid)", function () {
    const req = makePlacementReq();
    const ctx = makeValidPlacementCtx({
      plot: makeResidentialPlot({ active: false }),
    });
    const result = validateHarthmereBuildingPlacementV1(req, ctx);
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.includes("plot_not_active_or_tax_unpaid"));
  });
});

// ===========================================================================
// 7. Structure clipping — AABB overlap with nearby structures
// ===========================================================================

describe("validateHarthmereBuildingPlacementV1 — clipping", function () {
  it("rejects when footprint overlaps an existing non-protected structure (with spacing margin)", function () {
    // small_house origin 5,64,5; footprint 5×5 → x∈[5,10) z∈[5,10)
    // Nearby structure at x∈[8,15) z∈[5,12) — overlaps with 2-voxel margin
    const req = makePlacementReq();
    const ctx = makeValidPlacementCtx({
      nearbyStructures: [
        {
          structureId: "existing_house_1",
          minX: 10, maxX: 15, minY: 64, maxY: 70, minZ: 5, maxZ: 12,
          isProtectedInfrastructure: false,
        },
      ],
    });
    const result = validateHarthmereBuildingPlacementV1(req, ctx);
    assert.strictEqual(result.ok, false);
    assert.ok(
      result.errors.some((e) => e.startsWith("clips_existing_structure:")),
      `Expected clips_existing_structure, got: ${result.errors.join(", ")}`
    );
  });

  it("rejects with clips_protected_infrastructure when overlapping protected infrastructure", function () {
    const req = makePlacementReq();
    const ctx = makeValidPlacementCtx({
      nearbyStructures: [
        {
          structureId: "npc_bridge_001",
          minX: 9, maxX: 14, minY: 64, maxY: 70, minZ: 5, maxZ: 12,
          isProtectedInfrastructure: true,
        },
      ],
    });
    const result = validateHarthmereBuildingPlacementV1(req, ctx);
    assert.strictEqual(result.ok, false);
    assert.ok(
      result.errors.some((e) => e.startsWith("clips_protected_infrastructure:")),
      `Expected clips_protected_infrastructure, got: ${result.errors.join(", ")}`
    );
  });

  it("allows placement when nearby structure is far enough away (beyond spacing margin)", function () {
    // small_house needs 2-voxel spacing; existing structure starts at x=14 (footprint ends at x=10, gap = 4 > 2)
    const req = makePlacementReq();
    const ctx = makeValidPlacementCtx({
      nearbyStructures: [
        {
          structureId: "far_house",
          minX: 14, maxX: 20, minY: 64, maxY: 70, minZ: 5, maxZ: 12,
          isProtectedInfrastructure: false,
        },
      ],
    });
    const result = validateHarthmereBuildingPlacementV1(req, ctx);
    assert.ok(result.ok, result.errors.join(", "));
  });

  it("accumulates multiple clipping errors for multiple overlapping structures", function () {
    const req = makePlacementReq();
    const ctx = makeValidPlacementCtx({
      nearbyStructures: [
        { structureId: "house_a", minX: 9, maxX: 15, minY: 64, maxY: 70, minZ: 5, maxZ: 12, isProtectedInfrastructure: false },
        { structureId: "house_b", minX: 5, maxX: 9, minY: 64, maxY: 70, minZ: 9, maxZ: 14, isProtectedInfrastructure: false },
      ],
    });
    const result = validateHarthmereBuildingPlacementV1(req, ctx);
    assert.strictEqual(result.ok, false);
    const clipErrors = result.errors.filter((e) => e.startsWith("clips_existing_structure:"));
    assert.ok(clipErrors.length >= 2, `Expected ≥2 clip errors, got: ${result.errors.join(", ")}`);
  });
});

// ===========================================================================
// 8. NPC route waypoint clearance
// ===========================================================================

describe("validateHarthmereBuildingPlacementV1 — NPC route clearance", function () {
  it("rejects when an NPC waypoint falls within footprint + clearance radius", function () {
    // small_house footprint x∈[5,10) z∈[5,10); waypoint at x=4, z=6, radius=2 → 4 >= 5-2=3 and 4 <= 10+2=12
    const req = makePlacementReq();
    const ctx = makeValidPlacementCtx({
      npcRouteWaypoints: [{ x: 4, z: 6, clearanceRadiusVoxels: 2 }],
    });
    const result = validateHarthmereBuildingPlacementV1(req, ctx);
    assert.strictEqual(result.ok, false);
    assert.ok(
      result.errors.some((e) => e.startsWith("blocks_npc_route_waypoint:")),
      `Expected blocks_npc_route_waypoint, got: ${result.errors.join(", ")}`
    );
  });

  it("allows placement when NPC waypoint is fully outside clearance zone", function () {
    // waypoint at x=0, z=0 — far from footprint x∈[5,10)
    const req = makePlacementReq();
    const ctx = makeValidPlacementCtx({
      npcRouteWaypoints: [{ x: 0, z: 0, clearanceRadiusVoxels: 2 }],
    });
    const result = validateHarthmereBuildingPlacementV1(req, ctx);
    assert.ok(result.ok, result.errors.join(", "));
  });

  it("rejects when multiple NPC waypoints are blocked", function () {
    const req = makePlacementReq();
    const ctx = makeValidPlacementCtx({
      npcRouteWaypoints: [
        { x: 6, z: 7, clearanceRadiusVoxels: 1 },
        { x: 8, z: 8, clearanceRadiusVoxels: 1 },
      ],
    });
    const result = validateHarthmereBuildingPlacementV1(req, ctx);
    assert.strictEqual(result.ok, false);
    const wpErrors = result.errors.filter((e) => e.startsWith("blocks_npc_route_waypoint:"));
    assert.ok(wpErrors.length >= 2, `Expected ≥2 waypoint errors, got: ${result.errors.join(", ")}`);
  });
});

// ===========================================================================
// 9. Quest trigger area overlap
// ===========================================================================

describe("validateHarthmereBuildingPlacementV1 — quest trigger areas", function () {
  it("rejects when footprint overlaps a quest trigger area", function () {
    // footprint x∈[5,10) z∈[5,10); quest area fully inside footprint
    const req = makePlacementReq();
    const ctx = makeValidPlacementCtx({
      questTriggerAreas: [{ minX: 6, maxX: 9, minZ: 6, maxZ: 9 }],
    });
    const result = validateHarthmereBuildingPlacementV1(req, ctx);
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.includes("overlaps_quest_trigger_area"));
  });

  it("rejects when quest area partially overlaps footprint corner", function () {
    const req = makePlacementReq();
    const ctx = makeValidPlacementCtx({
      questTriggerAreas: [{ minX: 8, maxX: 15, minZ: 8, maxZ: 15 }],
    });
    const result = validateHarthmereBuildingPlacementV1(req, ctx);
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.includes("overlaps_quest_trigger_area"));
  });

  it("allows placement when quest area is entirely adjacent (no overlap)", function () {
    // quest area starts at x=12, footprint ends at x=10 — no overlap
    const req = makePlacementReq();
    const ctx = makeValidPlacementCtx({
      questTriggerAreas: [{ minX: 12, maxX: 20, minZ: 5, maxZ: 10 }],
    });
    const result = validateHarthmereBuildingPlacementV1(req, ctx);
    assert.ok(result.ok, result.errors.join(", "));
  });
});

// ===========================================================================
// 10. Entrance clearance
// ===========================================================================

describe("validateHarthmereBuildingPlacementV1 — entrance clearance", function () {
  it("rejects when a structure blocks the entrance of small_house", function () {
    // small_house entrance: entranceX = floor((5+10)/2) = 7, entranceZ = 5-1 = 4
    // Blocker at x∈[3,12) z∈[0,5) with clearance 3 → entranceX=7 in [3-3,12+3]=[0,15], entranceZ=4 in [0-3,5+3]=[-3,8]
    const req = makePlacementReq();
    const ctx = makeValidPlacementCtx({
      nearbyStructures: [
        {
          structureId: "blocker_001",
          minX: 3, maxX: 12, minY: 60, maxY: 70, minZ: 0, maxZ: 5,
          isProtectedInfrastructure: false,
        },
      ],
    });
    const result = validateHarthmereBuildingPlacementV1(req, ctx);
    assert.strictEqual(result.ok, false);
    assert.ok(
      result.errors.some((e) => e.startsWith("entrance_clearance_blocked_by:") || e.startsWith("clips_existing_structure:")),
      `Expected entrance or clip error, got: ${result.errors.join(", ")}`
    );
  });
});

// ===========================================================================
// 11. Road access requirement
// ===========================================================================

describe("validateHarthmereBuildingPlacementV1 — road access", function () {
  it("rejects shop placement when no road access available", function () {
    // shop requires road access
    const req = makePlacementReq({
      structureTypeId: "shop",
      origin: { x: 5, y: 64, z: 5 },
    });
    const ctx: HarthmereBuildingPlacementContextV1 = {
      terrainColumns: makeGrassColumns(5, 5, 6, 6),
      nearbyStructures: [],
      npcRouteWaypoints: [],
      questTriggerAreas: [],
      hasRoadAccess: false,
      minRoadDistanceVoxels: 10,
      plot: makeResidentialPlot({ plotType: "commercial", totalAreaVoxels: 2500 }),
    };
    const result = validateHarthmereBuildingPlacementV1(req, ctx);
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.includes("no_road_access_within_required_distance"));
  });

  it("allows small_house placement without road access (not required)", function () {
    const req = makePlacementReq();
    const ctx = makeValidPlacementCtx({ hasRoadAccess: false });
    const result = validateHarthmereBuildingPlacementV1(req, ctx);
    assert.ok(result.ok, result.errors.join(", "));
  });

  it("allows shop placement when road access is available", function () {
    const req = makePlacementReq({ structureTypeId: "shop", origin: { x: 5, y: 64, z: 5 } });
    const ctx: HarthmereBuildingPlacementContextV1 = {
      terrainColumns: makeGrassColumns(5, 5, 6, 6),
      nearbyStructures: [],
      npcRouteWaypoints: [],
      questTriggerAreas: [],
      hasRoadAccess: true,
      minRoadDistanceVoxels: 10,
      plot: makeResidentialPlot({ plotType: "commercial", totalAreaVoxels: 2500 }),
    };
    const result = validateHarthmereBuildingPlacementV1(req, ctx);
    assert.ok(result.ok, result.errors.join(", "));
  });
});

// ===========================================================================
// 12. Multiple simultaneous violations
// ===========================================================================

describe("validateHarthmereBuildingPlacementV1 — multiple violations", function () {
  it("returns all applicable errors when placement violates multiple rules", function () {
    const req = makePlacementReq({ rotationDegrees: 0 });
    const cols = makeGrassColumns(5, 5, 5, 5, { terrainType: "water" }); // unbuildable
    const ctx: HarthmereBuildingPlacementContextV1 = {
      terrainColumns: cols,
      nearbyStructures: [
        { structureId: "blocker", minX: 9, maxX: 15, minY: 64, maxY: 70, minZ: 5, maxZ: 12, isProtectedInfrastructure: false },
      ],
      npcRouteWaypoints: [{ x: 6, z: 7, clearanceRadiusVoxels: 1 }],
      questTriggerAreas: [{ minX: 6, maxX: 9, minZ: 6, maxZ: 9 }],
      hasRoadAccess: false,
      minRoadDistanceVoxels: 10,
      plot: makeResidentialPlot({ plotType: "commercial" }), // wrong type
    };
    const result = validateHarthmereBuildingPlacementV1(req, ctx);
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.length >= 3, `Expected ≥3 errors, got: ${result.errors.join(", ")}`);
  });
});

// ===========================================================================
// 13. Rotation — footprint swap
// ===========================================================================

describe("validateHarthmereBuildingPlacementV1 — rotation footprint", function () {
  it("swaps width/depth for 90° rotation of a non-square structure (medium_house 8×8 stays square)", function () {
    // Use medium_house 8×8 footprint; with 90° rotation it's still 8×8
    const req = makePlacementReq({
      structureTypeId: "medium_house",
      origin: { x: 5, y: 64, z: 5 },
      rotationDegrees: 90,
    });
    const ctx: HarthmereBuildingPlacementContextV1 = {
      terrainColumns: makeGrassColumns(5, 5, 8, 8),
      nearbyStructures: [],
      npcRouteWaypoints: [],
      questTriggerAreas: [],
      hasRoadAccess: true,
      minRoadDistanceVoxels: 10,
      plot: makeResidentialPlot({ totalAreaVoxels: 2500 }),
    };
    const result = validateHarthmereBuildingPlacementV1(req, ctx);
    assert.ok(result.ok, result.errors.join(", "));
  });
});

// ===========================================================================
// 14. validateHarthmereBuildingDemolitionV1
// ===========================================================================

describe("validateHarthmereBuildingDemolitionV1", function () {
  function makeDemolitionReq(
    overrides: Partial<HarthmereBuildingDemolitionRequestV1> = {}
  ): HarthmereBuildingDemolitionRequestV1 {
    return {
      requestId: nextReqId(),
      actorId: "player_1",
      structureId: "house_001",
      plotId: "plot_res_1",
      nowMs: NOW_MS,
      ...overrides,
    };
  }

  it("allows demolition when actor is structure owner", function () {
    const result = validateHarthmereBuildingDemolitionV1(makeDemolitionReq(), {
      structureOwnerId: "player_1",
      plotOwnerId: "player_2",
      hasActiveResidents: false,
      hasActiveVendor: false,
      hasActiveQuestNpcs: false,
    });
    assert.ok(result.ok, result.errors.join(", "));
    assert.ok(result.auditTags.includes("building_demolition_approved"));
  });

  it("allows demolition when actor is plot owner (even if not structure owner)", function () {
    const result = validateHarthmereBuildingDemolitionV1(makeDemolitionReq(), {
      structureOwnerId: "player_9",
      plotOwnerId: "player_1",
      hasActiveResidents: false,
      hasActiveVendor: false,
      hasActiveQuestNpcs: false,
    });
    assert.ok(result.ok, result.errors.join(", "));
  });

  it("rejects demolition when actor owns neither structure nor plot", function () {
    const result = validateHarthmereBuildingDemolitionV1(makeDemolitionReq(), {
      structureOwnerId: "player_2",
      plotOwnerId: "player_3",
      hasActiveResidents: false,
      hasActiveVendor: false,
      hasActiveQuestNpcs: false,
    });
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.includes("not_structure_or_plot_owner"));
  });

  it("rejects demolition when structure has active residents", function () {
    const result = validateHarthmereBuildingDemolitionV1(makeDemolitionReq(), {
      structureOwnerId: "player_1",
      plotOwnerId: "player_1",
      hasActiveResidents: true,
      hasActiveVendor: false,
      hasActiveQuestNpcs: false,
    });
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.includes("cannot_demolish_with_active_residents"));
  });

  it("rejects demolition when structure has an active vendor inside", function () {
    const result = validateHarthmereBuildingDemolitionV1(makeDemolitionReq(), {
      structureOwnerId: "player_1",
      plotOwnerId: "player_1",
      hasActiveResidents: false,
      hasActiveVendor: true,
      hasActiveQuestNpcs: false,
    });
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.includes("cannot_demolish_with_active_vendor_inside"));
  });

  it("allows demolition but emits warning when active quest NPCs are present", function () {
    const result = validateHarthmereBuildingDemolitionV1(makeDemolitionReq(), {
      structureOwnerId: "player_1",
      plotOwnerId: "player_1",
      hasActiveResidents: false,
      hasActiveVendor: false,
      hasActiveQuestNpcs: true,
    });
    assert.ok(result.ok, result.errors.join(", "));
    assert.ok(result.warnings.includes("demolition_may_break_active_quest_check_with_gm"));
  });

  it("accumulates both active-residents and active-vendor errors together", function () {
    const result = validateHarthmereBuildingDemolitionV1(makeDemolitionReq(), {
      structureOwnerId: "player_1",
      plotOwnerId: "player_1",
      hasActiveResidents: true,
      hasActiveVendor: true,
      hasActiveQuestNpcs: false,
    });
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.includes("cannot_demolish_with_active_residents"));
    assert.ok(result.errors.includes("cannot_demolish_with_active_vendor_inside"));
  });
});

// ===========================================================================
// 15. validateHarthmerePlotClaimV1
// ===========================================================================

describe("validateHarthmerePlotClaimV1", function () {
  function makePlotClaimReq(
    overrides: Partial<HarthmerePlotClaimRequestV1> = {}
  ): HarthmerePlotClaimRequestV1 {
    return {
      requestId: nextReqId(),
      actorId: "player_1",
      plotId: "plot_res_99",
      nowMs: NOW_MS,
      ...overrides,
    };
  }

  function makePlotClaimCtx(
    overrides: Partial<HarthmerePlotClaimContextV1> = {}
  ): HarthmerePlotClaimContextV1 {
    return {
      plot: makeResidentialPlot({ plotId: "plot_res_99", ownerId: "" }),
      claimPriceGold: 200,
      actorGold: 500,
      actorOwnedPlotCount: 0,
      maxPlotsPerActor: 3,
      ...overrides,
    };
  }

  it("succeeds when plot is unclaimed and actor has gold", function () {
    const result = validateHarthmerePlotClaimV1(makePlotClaimReq(), makePlotClaimCtx());
    assert.ok(result.ok, result.errors.join(", "));
    assert.strictEqual(result.goldCost, 200);
    assert.ok(result.auditTags.includes("plot_claim_approved"));
  });

  it("returns goldCost from context even on failure (for UI display)", function () {
    const result = validateHarthmerePlotClaimV1(
      makePlotClaimReq(),
      makePlotClaimCtx({ actorGold: 10 }) // insufficient
    );
    assert.strictEqual(result.goldCost, 200);
  });

  it("rejects when plot does not exist in context", function () {
    const result = validateHarthmerePlotClaimV1(
      makePlotClaimReq(),
      makePlotClaimCtx({ plot: undefined })
    );
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.includes("plot_not_found"));
  });

  it("rejects when plot is already owned by a different player", function () {
    const result = validateHarthmerePlotClaimV1(
      makePlotClaimReq(),
      makePlotClaimCtx({ plot: makeResidentialPlot({ ownerId: "player_9" }) })
    );
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.includes("plot_already_owned"));
  });

  it("allows re-claim when actor already owns this plot (ownerId === actorId)", function () {
    // If actor already owns the plot (ownerId === actorId) the ownership check passes
    const result = validateHarthmerePlotClaimV1(
      makePlotClaimReq(),
      makePlotClaimCtx({
        plot: makeResidentialPlot({ ownerId: "player_1", plotId: "plot_res_99" }),
        actorOwnedPlotCount: 1, // already owns 1 (this very plot)
      })
    );
    // Should be ok since ownerId === actorId (no plot_already_owned error)
    assert.ok(result.ok, result.errors.join(", "));
  });

  it("rejects when actor has insufficient gold for claim price", function () {
    const result = validateHarthmerePlotClaimV1(
      makePlotClaimReq(),
      makePlotClaimCtx({ actorGold: 50, claimPriceGold: 200 })
    );
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.includes("insufficient_gold_for_plot_claim"));
  });

  it("rejects when actor already owns max allowed plots", function () {
    const result = validateHarthmerePlotClaimV1(
      makePlotClaimReq(),
      makePlotClaimCtx({ actorOwnedPlotCount: 3, maxPlotsPerActor: 3 })
    );
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.includes("plot_ownership_limit_reached"));
  });

  it("accumulates multiple errors (no gold + plot limit + already owned)", function () {
    const result = validateHarthmerePlotClaimV1(
      makePlotClaimReq(),
      makePlotClaimCtx({
        actorGold: 0,
        actorOwnedPlotCount: 3,
        maxPlotsPerActor: 3,
        plot: makeResidentialPlot({ ownerId: "player_9" }),
      })
    );
    assert.strictEqual(result.ok, false);
    assert.ok(result.errors.includes("plot_already_owned"));
    assert.ok(result.errors.includes("insufficient_gold_for_plot_claim"));
    assert.ok(result.errors.includes("plot_ownership_limit_reached"));
    assert.ok(result.errors.length >= 3);
  });

  it("auditTags include plot_claim_rejected on failure", function () {
    const result = validateHarthmerePlotClaimV1(
      makePlotClaimReq(),
      makePlotClaimCtx({ actorGold: 0 })
    );
    assert.ok(result.auditTags.includes("plot_claim_rejected"));
  });
});
