// HARTHMERE_MAP_TERRAIN_REGIONS
//
// Authentic Harthmere terrain, expressed in WORLD (x, z) coordinates and sourced
// from the live world data — NOT decorative guesses:
//   - Town core, roads, and the river come from the town route graph
//     (HARTHMERE_TOWN_ROUTE_ANCHORS in town_routes.ts): the market street,
//     the north-gate road, and the river_docks run.
//   - Muck clearings come from the muck relocation anchors used by the business
//     simulator (Watchtower / Old Wood / Gravewood / Road muckwad) plus the West
//     Muck Breach the building system places plots against.
//   - Highland / elevation comes from the noble_rise loop and Watchtower Ridge.
//
// These are projected onto the BiomesUI world map with the SAME bounds the
// markers use (see harthmereMapTerrainRegionsForBounds), so the terrain lines
// up exactly with the markers drawn on top of it.

export type HarthmereMapTerrainKind =
  | "land"
  | "town"
  | "road"
  | "water"
  | "muck"
  | "highland"
  | "safe_zone";

type WorldCircle = { type: "circle"; cx: number; cz: number; radius: number };
type WorldRect = {
  type: "rect";
  xMin: number;
  xMax: number;
  zMin: number;
  zMax: number;
};
type WorldPath = { type: "path"; points: Array<[number, number]>; width: number };

export interface HarthmereMapTerrainRegionWorld {
  id: string;
  label: string;
  kind: HarthmereMapTerrainKind;
  shape: WorldCircle | WorldRect | WorldPath;
}

export interface MapBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

// Projected geometry, in 0..100 map units (matches an SVG viewBox of 0 0 100 100
// so terrain can share the marker zoom/pan transform).
export type MapTerrainRegionShape =
  | { type: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { type: "rect"; x: number; y: number; w: number; h: number }
  | { type: "polyline"; points: Array<{ x: number; y: number }>; width: number };

export interface MapTerrainRegion {
  id: string;
  label: string;
  kind: HarthmereMapTerrainKind;
  shape: MapTerrainRegionShape;
}

// Authoritative world regions. Order in this array is paint order (earlier =
// underneath). Land first as the base, then water/muck/town areas, then thin
// overlays (roads, ridges).
export const HARTHMERE_MAP_TERRAIN_REGIONS_WORLD: HarthmereMapTerrainRegionWorld[] =
  [
    // --- Town & built area (route-graph extent) --------------------------------
    {
      id: "harthmere_town_core",
      label: "Harthmere Town",
      kind: "town",
      shape: { type: "rect", xMin: 408, xMax: 612, zMin: -290, zMax: -150 },
    },
    {
      id: "harthmere_safe_zone",
      label: "Harthmere Safe Zone",
      kind: "safe_zone",
      shape: { type: "circle", cx: 486, cz: -207, radius: 86 },
    },
    // --- Water (river docks run) ----------------------------------------------
    {
      id: "river_docks_water",
      label: "River Docks",
      kind: "water",
      shape: { type: "path", points: [[516, -196], [568, -196], [604, -196]], width: 14 },
    },
    // --- Muck clearings (relocation anchors + west breach) ---------------------
    {
      id: "watchtower_muck_clearing",
      label: "Watchtower Muck Clearing",
      kind: "muck",
      shape: { type: "circle", cx: 332, cz: -390, radius: 34 },
    },
    {
      id: "old_wood_mucker_copse",
      label: "Old Wood Mucker Copse",
      kind: "muck",
      shape: { type: "circle", cx: 640, cz: -455, radius: 48 },
    },
    {
      id: "gravewood_pale_muck",
      label: "Gravewood Pale Muck",
      kind: "muck",
      shape: { type: "circle", cx: 640, cz: 120, radius: 42 },
    },
    {
      id: "road_muckwad_patch",
      label: "Road Muckwad Patch",
      kind: "muck",
      shape: { type: "circle", cx: 512, cz: -152, radius: 22 },
    },
    {
      id: "west_muck_breach",
      label: "West Muck Breach",
      kind: "muck",
      shape: { type: "circle", cx: 236, cz: -506, radius: 46 },
    },
    // --- Highland / elevation --------------------------------------------------
    {
      id: "noble_rise_highland",
      label: "Noble Rise",
      kind: "highland",
      shape: { type: "circle", cx: 539, cz: -232, radius: 30 },
    },
    {
      id: "watchtower_ridge_highland",
      label: "Watchtower Ridge",
      kind: "highland",
      shape: { type: "circle", cx: 332, cz: -356, radius: 26 },
    },
    // --- Roads (route-graph spines) -------------------------------------------
    {
      id: "market_street_road",
      label: "Market Street",
      kind: "road",
      shape: { type: "path", points: [[430, -207], [494, -207], [526, -207], [556, -214]], width: 7 },
    },
    {
      id: "north_gate_road",
      label: "North Gate Road",
      kind: "road",
      shape: { type: "path", points: [[486, -282], [486, -252], [486, -222], [486, -207]], width: 7 },
    },
    {
      id: "west_road",
      label: "West Road",
      kind: "road",
      shape: { type: "path", points: [[360, -209], [430, -208], [486, -207]], width: 7 },
    },
    {
      id: "temple_green_path",
      label: "Temple Green Path",
      kind: "road",
      shape: { type: "path", points: [[486, -207], [486, -190], [491, -155]], width: 5 },
    },
  ];

function normX(worldX: number, bounds: MapBounds): number {
  return ((worldX - bounds.minX) / Math.max(1, bounds.maxX - bounds.minX)) * 100;
}

function normZ(worldZ: number, bounds: MapBounds): number {
  return ((worldZ - bounds.minZ) / Math.max(1, bounds.maxZ - bounds.minZ)) * 100;
}

// World distance -> map units, averaged across the two axes (the map is rendered
// with preserveAspectRatio="none", so x and z can scale differently; for radii /
// stroke widths we use the mean so circles read as round-ish corridors).
function scaleWorldToMap(worldSize: number, bounds: MapBounds): number {
  const sx = 100 / Math.max(1, bounds.maxX - bounds.minX);
  const sz = 100 / Math.max(1, bounds.maxZ - bounds.minZ);
  return worldSize * ((sx + sz) / 2);
}

// Project the authentic world regions onto the current map bounds. NOT clamped:
// regions outside the visible bounds simply fall outside the 0..100 viewBox and
// are clipped by the canvas, which keeps every shape's proportions intact.
export function harthmereMapTerrainRegionsForBounds(
  bounds: MapBounds | undefined,
  regions: HarthmereMapTerrainRegionWorld[] = HARTHMERE_MAP_TERRAIN_REGIONS_WORLD
): MapTerrainRegion[] {
  if (
    !bounds ||
    !Number.isFinite(bounds.minX) ||
    !Number.isFinite(bounds.maxX) ||
    !Number.isFinite(bounds.minZ) ||
    !Number.isFinite(bounds.maxZ)
  ) {
    return [];
  }
  const projected: MapTerrainRegion[] = [
    // Land base: fill the whole canvas so muck/water/town read as features on
    // top of "non-muck" land.
    {
      id: "land_base",
      label: "Land",
      kind: "land",
      shape: { type: "rect", x: 0, y: 0, w: 100, h: 100 },
    },
  ];
  for (const region of regions) {
    if (region.shape.type === "circle") {
      projected.push({
        id: region.id,
        label: region.label,
        kind: region.kind,
        shape: {
          type: "ellipse",
          cx: normX(region.shape.cx, bounds),
          cy: normZ(region.shape.cz, bounds),
          rx: Math.max(0.6, scaleWorldToMap(region.shape.radius, bounds)),
          ry: Math.max(0.6, scaleWorldToMap(region.shape.radius, bounds)),
        },
      });
    } else if (region.shape.type === "rect") {
      const x0 = normX(region.shape.xMin, bounds);
      const x1 = normX(region.shape.xMax, bounds);
      const y0 = normZ(region.shape.zMin, bounds);
      const y1 = normZ(region.shape.zMax, bounds);
      projected.push({
        id: region.id,
        label: region.label,
        kind: region.kind,
        shape: {
          type: "rect",
          x: Math.min(x0, x1),
          y: Math.min(y0, y1),
          w: Math.abs(x1 - x0),
          h: Math.abs(y1 - y0),
        },
      });
    } else {
      projected.push({
        id: region.id,
        label: region.label,
        kind: region.kind,
        shape: {
          type: "polyline",
          points: region.shape.points.map(([wx, wz]) => ({
            x: normX(wx, bounds),
            y: normZ(wz, bounds),
          })),
          width: Math.max(0.4, scaleWorldToMap(region.shape.width, bounds)),
        },
      });
    }
  }
  return projected;
}

// Elevation summary derived from real marker heights (worldPosition Y). The
// snapshot world is mostly flat (ground ~52), so this is a light touch: it
// reports the observed band so the tab can label "low / rolling / highland"
// without inventing contour data the world does not have.
export function harthmereMapElevationBandForHeight(
  worldY: number | undefined
): "water" | "low" | "rolling" | "highland" {
  const y = Number(worldY);
  if (!Number.isFinite(y)) return "low";
  if (y < 50) return "water";
  if (y < 56) return "low";
  if (y < 70) return "rolling";
  return "highland";
}
