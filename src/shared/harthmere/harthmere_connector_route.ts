import { getTerrainID } from "@/shared/asset_defs/terrain";
import type { BiomesId } from "@/shared/ids";

export const HARTHMERE_CONNECTOR_ROUTE_VERSION =
  "harthmere-protected-surface-route-v1" as const;

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
    | "stair_carve"
    | "stair_fill"
    | "stair_cap";
}

export interface HarthmereConnectorRoutePlan {
  path: HarthmereConnectorPoint[];
  resolvedAnchors: HarthmereConnectorPoint[];
  edits: HarthmereConnectorRouteEdit[];
  failures: string[];
}

export const HARTHMERE_CONNECTOR_ROUTE_BOUNDS = {
  minX: 488,
  maxX: 904,
  minZ: -232,
  maxZ: -120,
} as const;

// The route starts at the existing Selfie Overlook on the Grove's east road,
// after the dense built-up fountain/Old Road cluster, and reaches a short
// purpose-built stair at the Harthmere west gate. Anchors are resolved to
// nearby safe terrain at materialization time so an existing building can
// never be bulldozed just because it overlaps an authored waypoint.
export const HARTHMERE_CONNECTOR_ROUTE_ANCHORS = [
  [560, -182],
  [640, -209],
  [896, -209],
] as const satisfies readonly HarthmereConnectorPoint[];

export const HARTHMERE_CONNECTOR_WEST_GATE_START: HarthmereConnectorPoint = [
  896, -209,
];
export const HARTHMERE_CONNECTOR_WEST_GATE_END: HarthmereConnectorPoint = [
  903, -209,
];
export const HARTHMERE_CONNECTOR_WEST_GATE_LANDING: HarthmereConnectorPoint = [
  904, -209,
];
export const HARTHMERE_CONNECTOR_STAIR_HALF_WIDTH = 2;
export const HARTHMERE_CONNECTOR_MIN_HEADROOM = 3;

const ROAD_CENTER = getTerrainID("cobblestone") as BiomesId;
const ROAD_SHOULDER = getTerrainID("gravel") as BiomesId;
const STAIR_FILL = getTerrainID("dirt") as BiomesId;
const STAIR_CAP = getTerrainID("stone_brick") as BiomesId;

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

function westGateStairEdits(
  sample: (x: number, z: number) => HarthmereConnectorColumn
): { edits: HarthmereConnectorRouteEdit[]; failures: string[] } {
  const failures: string[] = [];
  const start = HARTHMERE_CONNECTOR_WEST_GATE_START;
  const end = HARTHMERE_CONNECTOR_WEST_GATE_END;
  const landing = HARTHMERE_CONNECTOR_WEST_GATE_LANDING;
  const startColumn = sample(start[0], start[1]);
  if (
    !isWalkableColumn(startColumn) ||
    startColumn.surfaceY === undefined ||
    startColumn.canResurface === false
  ) {
    return {
      edits: [],
      failures: ["west gate stair start is not safe walkable terrain"],
    };
  }
  const landingColumn = sample(landing[0], landing[1]);
  if (
    landingColumn.surfaceY === undefined ||
    landingColumn.isWater ||
    landingColumn.canTraverse === false
  ) {
    return {
      edits: [],
      failures: ["west gate landing is not reachable walkable terrain"],
    };
  }
  const run = end[0] - start[0];
  const rise = landingColumn.surfaceY - startColumn.surfaceY;
  if (run <= 0 || Math.abs(rise) > run) {
    return {
      edits: [],
      failures: [`west gate stair cannot cover rise ${rise} over run ${run}`],
    };
  }

  const edits: HarthmereConnectorRouteEdit[] = [];
  for (let offset = 0; offset <= run; offset += 1) {
    const x = start[0] + offset;
    const progress = offset / run;
    const desiredY =
      startColumn.surfaceY +
      Math.trunc(rise * progress + Math.sign(rise) * 0.0001);
    for (
      let z = start[1] - HARTHMERE_CONNECTOR_STAIR_HALF_WIDTH;
      z <= start[1] + HARTHMERE_CONNECTOR_STAIR_HALF_WIDTH;
      z += 1
    ) {
      const column = sample(x, z);
      if (
        !isWalkableColumn(column) ||
        column.surfaceY === undefined ||
        column.canResurface === false
      ) {
        failures.push(`west gate stair intersects protected column ${x},${z}`);
        continue;
      }
      if (column.surfaceY > desiredY) {
        for (let y = desiredY + 1; y <= column.surfaceY; y += 1) {
          edits.push({
            position: [x, y, z],
            value: 0 as BiomesId,
            label: "stair_carve",
          });
        }
      } else if (column.surfaceY < desiredY) {
        for (let y = column.surfaceY + 1; y < desiredY; y += 1) {
          edits.push({
            position: [x, y, z],
            value: STAIR_FILL,
            label: "stair_fill",
          });
        }
      }
      edits.push({
        position: [x, desiredY, z],
        value: STAIR_CAP,
        label: "stair_cap",
      });
    }
  }
  return { edits: failures.length > 0 ? [] : edits, failures };
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
    return { path: [], resolvedAnchors, edits: [], failures };
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
    return { path: [], resolvedAnchors, edits: [], failures };
  }

  const stair = westGateStairEdits(input.sample);
  failures.push(...stair.failures);
  if (failures.length > 0) {
    return { path, resolvedAnchors, edits: [], failures };
  }
  return {
    path,
    resolvedAnchors,
    edits: [...roadEditsForPath(path, input.sample), ...stair.edits],
    failures,
  };
}

export function validateHarthmereConnectorRoutePlan(
  plan: HarthmereConnectorRoutePlan,
  sample: (x: number, z: number) => HarthmereConnectorColumn
): string[] {
  const failures = [...plan.failures];
  for (let index = 1; index < plan.path.length; index += 1) {
    const previous = plan.path[index - 1];
    const current = plan.path[index];
    if (manhattan(previous, current) !== 1) {
      failures.push(
        `route gap between ${previous.join(",")} and ${current.join(",")}`
      );
    }
    const previousY = sample(previous[0], previous[1]).surfaceY;
    const currentY = sample(current[0], current[1]).surfaceY;
    if (
      previousY === undefined ||
      currentY === undefined ||
      Math.abs(previousY - currentY) > 1
    ) {
      failures.push(`route grade exceeds one block at ${current.join(",")}`);
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
  return [...new Set(failures)];
}
