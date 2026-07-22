import { getTerrainID } from "@/shared/asset_defs/terrain";
import type { BiomesId } from "@/shared/ids";

export const HARTHMERE_CONNECTOR_ROUTE_VERSION =
  "harthmere-protected-additive-town-entry-route-v6" as const;

export type HarthmereConnectorPoint = readonly [x: number, z: number];

export interface HarthmereConnectorColumn {
  surfaceY: number | undefined;
  isWater?: boolean;
  blocked?: boolean;
  canTraverse?: boolean;
  canResurface?: boolean;
}

export interface HarthmereConnectorRouteEdit {
  position: [x: number, y: number, z: number];
  value: BiomesId;
  label:
    | "road_center"
    | "road_shoulder"
    | "passage_clearance"
    | "approach_fill"
    | "approach_cap";
}

export type HarthmereConnectorTraversalPoint = readonly [
  x: number,
  y: number,
  z: number
];

export interface HarthmereConnectorRoutePlan {
  path: HarthmereConnectorPoint[];
  traversal: HarthmereConnectorTraversalPoint[];
  resolvedAnchors: HarthmereConnectorPoint[];
  edits: HarthmereConnectorRouteEdit[];
  failures: string[];
}

export const HARTHMERE_CONNECTOR_ROUTE_BOUNDS = {
  minX: 488,
  maxX: 1792,
  minZ: -232,
  maxZ: -120,
} as const;

// The route starts at the existing Selfie Overlook on the Grove's east road,
// after the dense built-up fountain/Old Road cluster, and reaches a protected
// engineered approach into Harthmere. Anchors are resolved to
// nearby safe terrain at materialization time so an existing building can
// never be bulldozed just because it overlaps an authored waypoint. The final
// engineered descent leaves the upper shelf at the Harthmere Bridge Center,
// lands on the confirmed green Y=56 floor inside the opening, and then follows
// the natural, building-safe terrain to X=1792. The additive terrain generator
// owns the final flat road from that boundary handoff to Harthmere's West Gate.
export const HARTHMERE_CONNECTOR_DESCENT_START: HarthmereConnectorPoint = [
  896, -209,
];
export const HARTHMERE_CONNECTOR_DESCENT_LANDING: HarthmereConnectorPoint = [
  903, -209,
];
export const HARTHMERE_CONNECTOR_DESCENT_LANDING_Y = 56;
export const HARTHMERE_CONNECTOR_BOUNDARY_APPROACH_START: HarthmereConnectorPoint =
  [1780, -209];
export const HARTHMERE_CONNECTOR_DESCENT_LEAD_IN = [
  HARTHMERE_CONNECTOR_DESCENT_START,
] as const satisfies readonly HarthmereConnectorPoint[];
export const HARTHMERE_CONNECTOR_DESCENT_PATH = [
  HARTHMERE_CONNECTOR_DESCENT_START,
  [897, -209],
  [898, -209],
  [899, -209],
  [900, -209],
  [901, -209],
  [902, -209],
  HARTHMERE_CONNECTOR_DESCENT_LANDING,
] as const satisfies readonly HarthmereConnectorPoint[];
export const HARTHMERE_CONNECTOR_BOUNDARY_APPROACH_PATH = [
  [1780, -209],
  [1781, -209],
  [1782, -209],
  [1783, -209],
  [1784, -209],
  [1785, -209],
  [1786, -209],
  [1787, -209],
  [1788, -209],
  [1789, -209],
  [1790, -209],
  [1791, -209],
  [1792, -209],
] as const satisfies readonly HarthmereConnectorPoint[];
export const HARTHMERE_CONNECTOR_ROUTE_ANCHORS = [
  [560, -182],
  [640, -209],
  HARTHMERE_CONNECTOR_DESCENT_START,
] as const satisfies readonly HarthmereConnectorPoint[];
export const HARTHMERE_CONNECTOR_TOWN_ENTRANCE: HarthmereConnectorPoint = [
  1792, -209,
];
export const HARTHMERE_CONNECTOR_APPROACH_HALF_WIDTH = 0;
export const HARTHMERE_CONNECTOR_APPROACH_OPTIONAL_HALF_WIDTH = 1;
export const HARTHMERE_CONNECTOR_MIN_HEADROOM = 3;
export const HARTHMERE_CONNECTOR_MAX_APPROACH_CUT_OR_FILL = 12;

const ROAD_CENTER = getTerrainID("cobblestone") as BiomesId;
const ROAD_SHOULDER = getTerrainID("gravel") as BiomesId;
const APPROACH_FILL = getTerrainID("dirt") as BiomesId;
const APPROACH_CAP = getTerrainID("stone_brick") as BiomesId;

function pointKey([x, z]: HarthmereConnectorPoint) {
  return `${x},${z}`;
}

function parsePointKey(key: string): HarthmereConnectorPoint {
  const [x, z] = key.split(",").map(Number);
  return [x, z];
}

function inConnectorBounds([x, z]: HarthmereConnectorPoint) {
  return (
    x >= HARTHMERE_CONNECTOR_ROUTE_BOUNDS.minX &&
    x <= HARTHMERE_CONNECTOR_ROUTE_BOUNDS.maxX &&
    z >= HARTHMERE_CONNECTOR_ROUTE_BOUNDS.minZ &&
    z <= HARTHMERE_CONNECTOR_ROUTE_BOUNDS.maxZ
  );
}

function isWalkableColumn(column: HarthmereConnectorColumn) {
  return (
    column.surfaceY !== undefined &&
    !column.isWater &&
    !column.blocked &&
    column.canTraverse !== false
  );
}

function manhattan(a: HarthmereConnectorPoint, b: HarthmereConnectorPoint) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}

function nearestWalkablePoint(
  authored: HarthmereConnectorPoint,
  sample: (x: number, z: number) => HarthmereConnectorColumn,
  radius = 12
): HarthmereConnectorPoint | undefined {
  let best:
    | { point: HarthmereConnectorPoint; distance: number; y: number }
    | undefined;
  for (let dx = -radius; dx <= radius; dx += 1) {
    for (let dz = -radius; dz <= radius; dz += 1) {
      const point: HarthmereConnectorPoint = [
        authored[0] + dx,
        authored[1] + dz,
      ];
      if (!inConnectorBounds(point)) continue;
      const column = sample(point[0], point[1]);
      if (!isWalkableColumn(column) || column.surfaceY === undefined) continue;
      const distance = Math.abs(dx) + Math.abs(dz);
      if (
        !best ||
        distance < best.distance ||
        (distance === best.distance && column.surfaceY < best.y)
      ) {
        best = { point, distance, y: column.surfaceY };
      }
    }
  }
  return best?.point;
}

function reconstructPath(
  cameFrom: Map<string, string>,
  currentKey: string
): HarthmereConnectorPoint[] {
  const reversed = [parsePointKey(currentKey)];
  while (cameFrom.has(currentKey)) {
    currentKey = cameFrom.get(currentKey)!;
    reversed.push(parsePointKey(currentKey));
  }
  reversed.reverse();
  return reversed;
}

interface ConnectorOpenNode {
  key: string;
  priority: number;
}

function pushOpenNode(heap: ConnectorOpenNode[], node: ConnectorOpenNode) {
  heap.push(node);
  let index = heap.length - 1;
  while (index > 0) {
    const parent = Math.floor((index - 1) / 2);
    if (heap[parent].priority <= heap[index].priority) break;
    [heap[parent], heap[index]] = [heap[index], heap[parent]];
    index = parent;
  }
}

function popOpenNode(heap: ConnectorOpenNode[]): ConnectorOpenNode | undefined {
  const first = heap[0];
  const last = heap.pop();
  if (!first || !last || heap.length === 0) return first;
  heap[0] = last;
  let index = 0;
  while (true) {
    const left = index * 2 + 1;
    const right = left + 1;
    let smallest = index;
    if (left < heap.length && heap[left].priority < heap[smallest].priority) {
      smallest = left;
    }
    if (right < heap.length && heap[right].priority < heap[smallest].priority) {
      smallest = right;
    }
    if (smallest === index) break;
    [heap[index], heap[smallest]] = [heap[smallest], heap[index]];
    index = smallest;
  }
  return first;
}

function findWalkableSegment(
  start: HarthmereConnectorPoint,
  goal: HarthmereConnectorPoint,
  sample: (x: number, z: number) => HarthmereConnectorColumn
): HarthmereConnectorPoint[] | undefined {
  const startKey = pointKey(start);
  const goalKey = pointKey(goal);
  const firstPriority = manhattan(start, goal);
  const open: ConnectorOpenNode[] = [
    { key: startKey, priority: firstPriority },
  ];
  const openPriority = new Map<string, number>([[startKey, firstPriority]]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[startKey, 0]]);
  const neighbors = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;

  while (open.length > 0) {
    const currentNode = popOpenNode(open);
    if (!currentNode) break;
    const currentKey = currentNode.key;
    if (openPriority.get(currentKey) !== currentNode.priority) continue;
    if (currentKey === goalKey) return reconstructPath(cameFrom, currentKey);
    openPriority.delete(currentKey);

    const current = parsePointKey(currentKey);
    const currentColumn = sample(current[0], current[1]);
    if (currentColumn.surfaceY === undefined) continue;
    const currentG = gScore.get(currentKey) ?? Number.POSITIVE_INFINITY;

    for (const [dx, dz] of neighbors) {
      const next: HarthmereConnectorPoint = [current[0] + dx, current[1] + dz];
      if (!inConnectorBounds(next)) continue;
      const nextColumn = sample(next[0], next[1]);
      if (!isWalkableColumn(nextColumn) || nextColumn.surfaceY === undefined)
        continue;
      const rise = Math.abs(nextColumn.surfaceY - currentColumn.surfaceY);
      if (rise > 1) continue;

      const nextKey = pointKey(next);
      // Prefer gentle terrain and a reasonably direct line. The grade penalty
      // is deliberately small: avoiding protected buildings always wins.
      const tentative = currentG + 1 + rise * 0.35;
      if (tentative >= (gScore.get(nextKey) ?? Number.POSITIVE_INFINITY))
        continue;
      cameFrom.set(nextKey, currentKey);
      gScore.set(nextKey, tentative);
      const priority = tentative + manhattan(next, goal);
      openPriority.set(nextKey, priority);
      pushOpenNode(open, { key: nextKey, priority });
    }
  }
  return undefined;
}

function roadEditsForPath(
  path: readonly HarthmereConnectorPoint[],
  sample: (x: number, z: number) => HarthmereConnectorColumn
): HarthmereConnectorRouteEdit[] {
  const edits = new Map<string, HarthmereConnectorRouteEdit>();
  const add = (
    point: HarthmereConnectorPoint,
    value: BiomesId,
    label: "road_center" | "road_shoulder",
    referenceY?: number
  ) => {
    const column = sample(point[0], point[1]);
    if (
      !isWalkableColumn(column) ||
      column.surfaceY === undefined ||
      column.canResurface === false
    ) {
      return;
    }
    if (referenceY !== undefined && Math.abs(column.surfaceY - referenceY) > 1)
      return;
    const edit: HarthmereConnectorRouteEdit = {
      position: [point[0], column.surfaceY, point[1]],
      value,
      label,
    };
    const key = `${edit.position.join(":")}`;
    const previous = edits.get(key);
    if (!previous || label === "road_center") edits.set(key, edit);
  };

  for (let index = 0; index < path.length; index += 1) {
    const current = path[index];
    const currentY = sample(current[0], current[1]).surfaceY;
    if (currentY === undefined) continue;
    add(current, ROAD_CENTER, "road_center");
    const previous = path[Math.max(0, index - 1)];
    const next = path[Math.min(path.length - 1, index + 1)];
    const dx = next[0] - previous[0];
    const dz = next[1] - previous[1];
    const shoulderA: HarthmereConnectorPoint =
      Math.abs(dx) >= Math.abs(dz)
        ? [current[0], current[1] - 1]
        : [current[0] - 1, current[1]];
    const shoulderB: HarthmereConnectorPoint =
      Math.abs(dx) >= Math.abs(dz)
        ? [current[0], current[1] + 1]
        : [current[0] + 1, current[1]];
    add(shoulderA, ROAD_SHOULDER, "road_shoulder", currentY);
    add(shoulderB, ROAD_SHOULDER, "road_shoulder", currentY);
  }
  return [...edits.values()];
}

function isBuildableApproachPoint(
  point: HarthmereConnectorPoint,
  sample: (x: number, z: number) => HarthmereConnectorColumn
) {
  for (
    let dx = -HARTHMERE_CONNECTOR_APPROACH_HALF_WIDTH;
    dx <= HARTHMERE_CONNECTOR_APPROACH_HALF_WIDTH;
    dx += 1
  ) {
    for (
      let dz = -HARTHMERE_CONNECTOR_APPROACH_HALF_WIDTH;
      dz <= HARTHMERE_CONNECTOR_APPROACH_HALF_WIDTH;
      dz += 1
    ) {
      const column = sample(point[0] + dx, point[1] + dz);
      if (!isWalkableColumn(column) || column.canResurface === false) {
        return false;
      }
    }
  }
  return true;
}

function findBuildableApproach(
  start: HarthmereConnectorPoint,
  goal: HarthmereConnectorPoint,
  sample: (x: number, z: number) => HarthmereConnectorColumn
): HarthmereConnectorPoint[] | undefined {
  if (
    !isBuildableApproachPoint(start, sample) ||
    !isBuildableApproachPoint(goal, sample)
  ) {
    return undefined;
  }
  const startKey = pointKey(start);
  const goalKey = pointKey(goal);
  const firstPriority = manhattan(start, goal);
  const open: ConnectorOpenNode[] = [
    { key: startKey, priority: firstPriority },
  ];
  const openPriority = new Map<string, number>([[startKey, firstPriority]]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[startKey, 0]]);
  const neighbors = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;

  while (open.length > 0) {
    const currentNode = popOpenNode(open);
    if (!currentNode) break;
    const currentKey = currentNode.key;
    if (openPriority.get(currentKey) !== currentNode.priority) continue;
    if (currentKey === goalKey) return reconstructPath(cameFrom, currentKey);
    openPriority.delete(currentKey);

    const current = parsePointKey(currentKey);
    const currentY = sample(current[0], current[1]).surfaceY;
    if (currentY === undefined) continue;
    const currentG = gScore.get(currentKey) ?? Number.POSITIVE_INFINITY;

    for (const [dx, dz] of neighbors) {
      const next: HarthmereConnectorPoint = [current[0] + dx, current[1] + dz];
      if (!inConnectorBounds(next) || !isBuildableApproachPoint(next, sample))
        continue;
      const nextY = sample(next[0], next[1]).surfaceY;
      if (nextY === undefined) continue;
      const naturalRise = Math.abs(nextY - currentY);
      if (naturalRise > HARTHMERE_CONNECTOR_MAX_APPROACH_CUT_OR_FILL) continue;

      const nextKey = pointKey(next);
      // The approach is allowed to cut a short tunnel or build a supported
      // causeway, but it still prefers flatter natural ground and a direct
      // line. Protected structures remain completely impassable.
      const tentative = currentG + 1 + naturalRise * 0.2;
      if (tentative >= (gScore.get(nextKey) ?? Number.POSITIVE_INFINITY))
        continue;
      cameFrom.set(nextKey, currentKey);
      gScore.set(nextKey, tentative);
      const priority = tentative + manhattan(next, goal);
      openPriority.set(nextKey, priority);
      pushOpenNode(open, { key: nextKey, priority });
    }
  }
  return undefined;
}

function approachCellsForPoint(
  path: readonly HarthmereConnectorPoint[],
  index: number,
  sample: (x: number, z: number) => HarthmereConnectorColumn
): HarthmereConnectorPoint[] {
  const current = path[index];
  const previous = path[Math.max(0, index - 1)];
  const next = path[Math.min(path.length - 1, index + 1)];
  const dx = next[0] - previous[0];
  const dz = next[1] - previous[1];
  const cells: HarthmereConnectorPoint[] = [current];
  const optionalCells: HarthmereConnectorPoint[] = [];
  if (Math.abs(dx) >= Math.abs(dz)) {
    optionalCells.push(
      [
        current[0],
        current[1] - HARTHMERE_CONNECTOR_APPROACH_OPTIONAL_HALF_WIDTH,
      ],
      [
        current[0],
        current[1] + HARTHMERE_CONNECTOR_APPROACH_OPTIONAL_HALF_WIDTH,
      ]
    );
  } else {
    optionalCells.push(
      [
        current[0] - HARTHMERE_CONNECTOR_APPROACH_OPTIONAL_HALF_WIDTH,
        current[1],
      ],
      [
        current[0] + HARTHMERE_CONNECTOR_APPROACH_OPTIONAL_HALF_WIDTH,
        current[1],
      ]
    );
  }
  for (const cell of optionalCells) {
    const column = sample(cell[0], cell[1]);
    if (isWalkableColumn(column) && column.canResurface !== false) {
      cells.push(cell);
    }
  }
  return cells;
}

function engineeredConnectorSegment(
  start: HarthmereConnectorPoint,
  end: HarthmereConnectorPoint,
  description: string,
  sample: (x: number, z: number) => HarthmereConnectorColumn,
  authoredPath?: readonly HarthmereConnectorPoint[]
): {
  path: HarthmereConnectorPoint[];
  traversal: HarthmereConnectorTraversalPoint[];
  edits: HarthmereConnectorRouteEdit[];
  failures: string[];
} {
  const path = authoredPath
    ? authoredPath.map(([x, z]): HarthmereConnectorPoint => [x, z])
    : findBuildableApproach(start, end, sample);
  if (!path) {
    return {
      path: [],
      traversal: [],
      edits: [],
      failures: [
        `no protected-structure-safe ${description} from ${start.join(
          ","
        )} to ${end.join(",")}`,
      ],
    };
  }
  if (
    path.length === 0 ||
    pointKey(path[0]) !== pointKey(start) ||
    pointKey(path.at(-1)!) !== pointKey(end)
  ) {
    return {
      path: [],
      traversal: [],
      edits: [],
      failures: [`${description} authored path has incorrect endpoints`],
    };
  }
  for (let index = 0; index < path.length; index += 1) {
    if (!isBuildableApproachPoint(path[index], sample)) {
      return {
        path: [],
        traversal: [],
        edits: [],
        failures: [
          `${description} intersects protected column ${path[index].join(",")}`,
        ],
      };
    }
    if (index > 0 && manhattan(path[index - 1], path[index]) !== 1) {
      return {
        path: [],
        traversal: [],
        edits: [],
        failures: [`${description} authored path contains a route gap`],
      };
    }
  }
  const startY = sample(start[0], start[1]).surfaceY;
  const endY = sample(end[0], end[1]).surfaceY;
  if (startY === undefined || endY === undefined) {
    return {
      path: [],
      traversal: [],
      edits: [],
      failures: [`${description} is missing start or end terrain`],
    };
  }
  const run = Math.max(1, path.length - 1);
  const rise = endY - startY;
  if (Math.abs(rise) > run) {
    return {
      path: [],
      traversal: [],
      edits: [],
      failures: [`${description} cannot cover rise ${rise} over run ${run}`],
    };
  }

  const edits = new Map<string, HarthmereConnectorRouteEdit>();
  const traversal: HarthmereConnectorTraversalPoint[] = path.map(
    ([x, z], index) => [x, startY + Math.round(rise * (index / run)), z]
  );
  const centerlineColumns = new Set(path.map(pointKey));
  const floorByColumn = new Map<
    string,
    { point: HarthmereConnectorPoint; desiredY: number }
  >();
  const addEdit = (edit: HarthmereConnectorRouteEdit) => {
    const key = edit.position.join(":");
    const previous = edits.get(key);
    if (!previous || edit.label === "approach_cap") edits.set(key, edit);
  };

  for (let index = 0; index < path.length; index += 1) {
    const [x, desiredY, z] = traversal[index];
    floorByColumn.set(pointKey([x, z]), { point: [x, z], desiredY });
  }
  for (let index = 0; index < path.length; index += 1) {
    const [x, desiredY, z] = traversal[index];
    for (const [cellX, cellZ] of approachCellsForPoint(path, index, sample)) {
      // A shoulder from a nearby turn must never become a second floor above
      // another centerline step. Keep every authored traversal column reserved
      // for its own exact stair height and headroom.
      if (
        (cellX !== x || cellZ !== z) &&
        centerlineColumns.has(pointKey([cellX, cellZ]))
      ) {
        continue;
      }
      const key = pointKey([cellX, cellZ]);
      const previous = floorByColumn.get(key);
      if (!previous || desiredY < previous.desiredY) {
        floorByColumn.set(key, {
          point: [cellX, cellZ],
          desiredY,
        });
      }
    }
  }

  for (const {
    point: [cellX, cellZ],
    desiredY,
  } of floorByColumn.values()) {
    const column = sample(cellX, cellZ);
    if (
      !isWalkableColumn(column) ||
      column.surfaceY === undefined ||
      column.canResurface === false
    ) {
      return {
        path,
        traversal,
        edits: [],
        failures: [
          `${description} intersects protected column ${cellX},${cellZ}`,
        ],
      };
    }
    const cutOrFill = Math.abs(column.surfaceY - desiredY);
    if (cutOrFill > HARTHMERE_CONNECTOR_MAX_APPROACH_CUT_OR_FILL) {
      return {
        path,
        traversal,
        edits: [],
        failures: [
          `${description} requires ${cutOrFill} blocks of cut/fill at ${cellX},${cellZ}`,
        ],
      };
    }
    if (column.surfaceY > desiredY) {
      for (
        let y = desiredY + 1;
        y <=
        Math.min(column.surfaceY, desiredY + HARTHMERE_CONNECTOR_MIN_HEADROOM);
        y += 1
      ) {
        addEdit({
          position: [cellX, y, cellZ],
          value: 0 as BiomesId,
          label: "passage_clearance",
        });
      }
    } else if (column.surfaceY < desiredY) {
      for (let y = column.surfaceY + 1; y < desiredY; y += 1) {
        addEdit({
          position: [cellX, y, cellZ],
          value: APPROACH_FILL,
          label: "approach_fill",
        });
      }
    }
    addEdit({
      position: [cellX, desiredY, cellZ],
      value: APPROACH_CAP,
      label: "approach_cap",
    });
  }
  return { path, traversal, edits: [...edits.values()], failures: [] };
}

export function planHarthmereConnectorRoute(input: {
  sample: (x: number, z: number) => HarthmereConnectorColumn;
  anchorSearchRadius?: number;
}): HarthmereConnectorRoutePlan {
  const failures: string[] = [];
  const resolvedAnchors: HarthmereConnectorPoint[] = [];
  for (const anchor of HARTHMERE_CONNECTOR_ROUTE_ANCHORS) {
    const resolved = nearestWalkablePoint(
      anchor,
      input.sample,
      input.anchorSearchRadius ?? 12
    );
    if (!resolved) {
      failures.push(
        `no safe terrain near connector anchor ${anchor.join(",")}`
      );
    } else {
      resolvedAnchors.push(resolved);
    }
  }
  if (failures.length > 0) {
    return {
      path: [],
      traversal: [],
      resolvedAnchors,
      edits: [],
      failures,
    };
  }

  const path: HarthmereConnectorPoint[] = [];
  for (let index = 1; index < resolvedAnchors.length; index += 1) {
    const segment = findWalkableSegment(
      resolvedAnchors[index - 1],
      resolvedAnchors[index],
      input.sample
    );
    if (!segment) {
      failures.push(
        `no building-safe walkable segment from ${resolvedAnchors[
          index - 1
        ].join(",")} to ${resolvedAnchors[index].join(",")}`
      );
      continue;
    }
    path.push(...(path.length > 0 ? segment.slice(1) : segment));
  }
  if (failures.length > 0) {
    return {
      path: [],
      traversal: [],
      resolvedAnchors,
      edits: [],
      failures,
    };
  }

  const surfaceTraversal: HarthmereConnectorTraversalPoint[] = path.map(
    ([x, z]) => [x, input.sample(x, z).surfaceY!, z]
  );
  for (const leadInPoint of HARTHMERE_CONNECTOR_DESCENT_LEAD_IN.slice(1)) {
    const previous = path.at(-1)!;
    const previousY = input.sample(previous[0], previous[1]).surfaceY;
    const column = input.sample(leadInPoint[0], leadInPoint[1]);
    if (
      manhattan(previous, leadInPoint) !== 1 ||
      !isWalkableColumn(column) ||
      column.surfaceY === undefined ||
      previousY === undefined ||
      Math.abs(column.surfaceY - previousY) > 1
    ) {
      failures.push(
        `Harthmere descent lead-in is not walkable at ${leadInPoint.join(",")}`
      );
      break;
    }
    path.push(leadInPoint);
    surfaceTraversal.push([leadInPoint[0], column.surfaceY, leadInPoint[1]]);
  }
  const descentLanding = input.sample(
    HARTHMERE_CONNECTOR_DESCENT_LANDING[0],
    HARTHMERE_CONNECTOR_DESCENT_LANDING[1]
  );
  if (
    !isWalkableColumn(descentLanding) ||
    descentLanding.canResurface === false ||
    descentLanding.surfaceY !== HARTHMERE_CONNECTOR_DESCENT_LANDING_Y
  ) {
    failures.push(
      `Harthmere descent landing is not usable at ${HARTHMERE_CONNECTOR_DESCENT_LANDING.join(
        ","
      )},${HARTHMERE_CONNECTOR_DESCENT_LANDING_Y}`
    );
  }
  const descent = engineeredConnectorSegment(
    path.at(-1)!,
    HARTHMERE_CONNECTOR_DESCENT_LANDING,
    "Harthmere floor descent",
    input.sample,
    HARTHMERE_CONNECTOR_DESCENT_PATH
  );
  failures.push(...descent.failures);
  const lowerSurfacePath = findWalkableSegment(
    HARTHMERE_CONNECTOR_DESCENT_LANDING,
    HARTHMERE_CONNECTOR_BOUNDARY_APPROACH_START,
    input.sample
  );
  if (!lowerSurfacePath) {
    failures.push(
      `no building-safe lower-floor segment from ${HARTHMERE_CONNECTOR_DESCENT_LANDING.join(
        ","
      )} to ${HARTHMERE_CONNECTOR_BOUNDARY_APPROACH_START.join(",")}`
    );
  }
  const boundaryApproach = engineeredConnectorSegment(
    HARTHMERE_CONNECTOR_BOUNDARY_APPROACH_START,
    HARTHMERE_CONNECTOR_TOWN_ENTRANCE,
    "Harthmere extension boundary stair",
    input.sample,
    HARTHMERE_CONNECTOR_BOUNDARY_APPROACH_PATH
  );
  failures.push(...boundaryApproach.failures);
  if (failures.length > 0) {
    return {
      path,
      traversal: surfaceTraversal,
      resolvedAnchors,
      edits: [],
      failures,
    };
  }
  const lowerSurfaceTraversal: HarthmereConnectorTraversalPoint[] =
    lowerSurfacePath!.map(([x, z]) => [x, input.sample(x, z).surfaceY!, z]);
  return {
    path: [
      ...path,
      ...descent.path.slice(1),
      ...lowerSurfacePath!.slice(1),
      ...boundaryApproach.path.slice(1),
    ],
    traversal: [
      ...surfaceTraversal,
      ...descent.traversal.slice(1),
      ...lowerSurfaceTraversal.slice(1),
      ...boundaryApproach.traversal.slice(1),
    ],
    resolvedAnchors,
    edits: [
      ...roadEditsForPath(path, input.sample),
      ...descent.edits,
      ...roadEditsForPath(lowerSurfacePath!, input.sample),
      ...boundaryApproach.edits,
    ],
    failures,
  };
}

export function validateHarthmereConnectorRoutePlan(
  plan: HarthmereConnectorRoutePlan,
  sample: (x: number, z: number) => HarthmereConnectorColumn
): string[] {
  const failures = [...plan.failures];
  if (plan.path.length !== plan.traversal.length) {
    failures.push("route traversal length does not match centerline path");
  }
  for (let index = 1; index < plan.traversal.length; index += 1) {
    const previous = plan.traversal[index - 1];
    const current = plan.traversal[index];
    if (manhattan([previous[0], previous[2]], [current[0], current[2]]) !== 1) {
      failures.push(
        `route gap between ${previous[0]},${previous[2]} and ${current[0]},${current[2]}`
      );
    }
    if (Math.abs(previous[1] - current[1]) > 1) {
      failures.push(
        `route grade exceeds one block at ${current[0]},${current[2]}`
      );
    }
  }
  for (const point of plan.path) {
    const column = sample(point[0], point[1]);
    if (!isWalkableColumn(column)) {
      failures.push(
        `route crosses protected or unsafe column ${point.join(",")}`
      );
    }
  }
  const finalPoint = plan.path.at(-1);
  const landingIndex = plan.path.findIndex(
    ([x, z]) =>
      x === HARTHMERE_CONNECTOR_DESCENT_LANDING[0] &&
      z === HARTHMERE_CONNECTOR_DESCENT_LANDING[1]
  );
  if (
    landingIndex < 0 ||
    plan.traversal[landingIndex]?.[1] !== HARTHMERE_CONNECTOR_DESCENT_LANDING_Y
  ) {
    failures.push("route does not land on the Y=56 Harthmere floor");
  }
  if (
    finalPoint?.[0] !== HARTHMERE_CONNECTOR_TOWN_ENTRANCE[0] ||
    finalPoint?.[1] !== HARTHMERE_CONNECTOR_TOWN_ENTRANCE[1]
  ) {
    failures.push("route does not reach the additive-map boundary handoff");
  }
  return [...new Set(failures)];
}
