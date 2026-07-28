import { shapeIDs } from "@/galois/assets/shapes";
import { secondsSinceEpoch } from "@/shared/ecs/config";
import { toShapeId } from "@/shared/game/ids";
import type {
  BlockResourceDeps,
  BlockResources,
} from "@/shared/game/resources/blocks";
import { voxelShard } from "@/shared/game/shard";
import { getTerrainIdAndIsomorphismAtPosition } from "@/shared/game/terrain_helper";
import { add, dist, equals } from "@/shared/math/linear";
import type { ReadonlyVec3, Vec3 } from "@/shared/math/types";
import { zVec3f } from "@/shared/math/types";
import {
  movementOffsetIsTraversable,
  nearestStandingVoxel,
  npcMovementOffsets,
  pathfindingEdgeWeight,
  PATHFINDING_MAX_EXPANDED_NODES,
} from "@/shared/npc/behavior/pathfinding_geometry";
import FastPriorityQueue from "fastpriorityqueue";
import { z } from "zod";

const zNode = z.object({
  position: zVec3f,
});
export type Node = z.infer<typeof zNode>;

const zPath = z.object({
  nodes: z.array(zNode),
});
export type Path = z.infer<typeof zPath>;

export const zPathfindingComponent = z.object({
  // Time in seconds the NPC has been within a certain distance to {position}.
  searchTime: z.number(),
  path: zPath,
  // The NPCs position at some point during pathfinding. The distance from
  // this point is used to determine if the NPC is stuck.
  position: zVec3f,
});

export const PATHFINDING_PROGRESS_DISTANCE_METERS = 0.75;
export const PATHFINDING_STUCK_DURATION_SECONDS = 2.5;

export type PathfindingComponent = z.infer<typeof zPathfindingComponent>;

function isBetweenNodes(position: ReadonlyVec3, a: Node, b: Node): boolean {
  const BUFFER = 1.1;
  for (let i = 0; i < 3; ++i) {
    const total = Math.abs(a.position[i] - b.position[i]);
    const distA = Math.abs(a.position[i] - position[i]);
    const distB = Math.abs(b.position[i] - position[i]);

    if (distA > total + BUFFER || distB > total + BUFFER) {
      return false;
    }
  }

  return true;
}

// Given a current position and a path return the next position that the NPC should travel towards
// to continue following the path.
export function findNextTargetOnPath(
  position: ReadonlyVec3,
  path: Path
): Vec3 | undefined {
  // We iterate backwards so that the lastest target, is multiple satisfy inBetweenNodes,
  // is taken.
  for (let i = path.nodes.length - 1; i > 0; --i) {
    const a = path.nodes[i];
    const b = path.nodes[i - 1];

    if (isBetweenNodes(position, a, b)) {
      return add(a.position, [0.5, 0.5, 0.5]);
    }
  }
}

export interface Edge {
  weight: number;
}

export interface Graph {
  neighbors: (node: Node, resources: BlockResources) => [Edge, Node][];
  /**
   * `resources` is optional so existing callers keep the historical rounding
   * behaviour; passing it enables terrain-aware nearest-standing-voxel
   * resolution, which is what hilly terrain requires.
   */
  closestNode: (
    src: ReadonlyVec3,
    resources?: BlockResources
  ) => Node | undefined;
}

export class GraphImpl implements Graph {
  private adj: Map<string, [Edge, Node][]>;

  constructor() {
    this.adj = new Map();
  }

  canOccupyBlock(position: Vec3, resources: BlockResources): boolean {
    return resources
      .get("/terrain/pathfinding/human_can_occupy", voxelShard(...position))
      .check(position);
  }

  movementOffsets(onFullBlock: boolean): Vec3[] {
    // HARTHMERE_HILL_PATHFINDING: cardinal-only movement forced an L-shaped
    // detour around every diagonal step, which on rolling ground turned into
    // permanent zig-zag and repeated "no progress" stuck declarations. Diagonals
    // are same-height only and additionally corner-checked in `neighbors`.
    return npcMovementOffsets({ onFullBlock });
  }

  neighbors(node: Node, resources: BlockResources): [Edge, Node][] {
    const key = node.position.toString();
    if (this.adj.get(key)) {
      return this.adj.get(key)!;
    }

    const edges: [Edge, Node][] = [];
    const onFullBlock = isFullHeightBlockAtPosition(
      resources,
      add(node.position, [0, -1, 0])
    );
    const canOccupy = (position: Vec3) =>
      this.canOccupyBlock(position, resources);
    const offsets = this.movementOffsets(onFullBlock);
    for (const offset of offsets) {
      if (
        !movementOffsetIsTraversable({ node: node.position, offset, canOccupy })
      ) {
        continue;
      }
      edges.push([
        { weight: pathfindingEdgeWeight(offset) },
        { position: add(offset, node.position) },
      ]);
    }
    this.adj.set(key, edges);
    return edges;
  }

  /**
   * Resolves a world position to a graph node.
   *
   * HARTHMERE_HILL_PATHFINDING: this used to round all three axes blindly. On the
   * original map's hills a player standing at Y=34.6 rounds to Y=35, and if that
   * voxel is solid the destination node can never be expanded — A* exhausts its
   * budget and returns `undefined`, leaving the NPC in blind direct pursuit. We
   * now search the nearby column for a voxel a body can actually occupy and
   * return `undefined` when there is none, so "unreachable" is reported honestly
   * instead of being disguised as a failed search.
   */
  closestNode(
    pos: ReadonlyVec3,
    resources?: BlockResources
  ): Node | undefined {
    if (!resources) {
      return {
        position: [Math.round(pos[0]), Math.round(pos[1]), Math.round(pos[2])],
      };
    }
    const position = nearestStandingVoxel({
      position: pos,
      canOccupy: (candidate) => this.canOccupyBlock(candidate, resources),
    });
    return position ? { position } : undefined;
  }
}

// Performs pathfinding. The idea is that if we want to change the pathfinding algorithm all we
// need to do is reimplement the Pathfinder for a different class.
abstract class Pathfinder {
  abstract findPath(): Path | undefined;
}

export class AStarPathfinder extends Pathfinder {
  private openSetNodes: Set<string>;
  private openSet: FastPriorityQueue<[Node, number]>;
  private closedSet: Set<string>;
  private costs: Map<string, number>;
  private parents: Map<string, Node | undefined>;

  constructor(
    private graph: Graph,
    private src: Node,
    private dest: Node,
    private resources: BlockResources
  ) {
    super();
    this.openSet = new FastPriorityQueue((a, b) => a[1] < b[1]); // MinPriorityQueue
    this.openSetNodes = new Set();
    this.closedSet = new Set();
    this.costs = new Map();
    this.parents = new Map();

    this.setCost(this.src, 0);
    this.addToOpenSet(this.src);
  }

  nodeToKey(node: Node): string {
    return node.position.toString();
  }

  parent(node: Node): Node | undefined {
    return this.parents.get(this.nodeToKey(node));
  }

  setParent(node: Node, parent: Node) {
    this.parents.set(this.nodeToKey(node), parent);
  }

  cost(node: Node): number | undefined {
    return this.costs.get(this.nodeToKey(node));
  }

  setCost(node: Node, cost: number) {
    this.costs.set(this.nodeToKey(node), cost);
  }

  inClosedSet(node: Node): boolean {
    return this.closedSet.has(this.nodeToKey(node));
  }

  inOpenSet(node: Node): boolean {
    return this.openSetNodes.has(this.nodeToKey(node));
  }

  addToClosedSet(node: Node) {
    this.closedSet.add(this.nodeToKey(node));
  }

  addToOpenSet(node: Node) {
    this.openSetNodes.add(this.nodeToKey(node));
    this.openSet.add([node, this.totalCost(node)]);
  }

  totalCost(node: Node): number {
    return (this.cost(node) ?? Infinity) + this.heuristic(node);
  }

  findNextNode(): Node {
    return this.openSet.poll()![0];
  }

  step(current: Node) {
    this.addToClosedSet(current);

    const neighbors = this.graph.neighbors(current, this.resources);
    for (const [edge, neighbor] of neighbors) {
      if (this.inClosedSet(neighbor)) {
        continue;
      }

      const cost = this.cost(current)! + edge.weight;
      const hasNeighbour = this.inOpenSet(neighbor);
      if (!hasNeighbour || cost < this.cost(neighbor)!) {
        this.setCost(neighbor, cost);
        this.setParent(neighbor, current);
        this.addToOpenSet(neighbor);
      }
    }

    return false;
  }

  findPath(): Path | undefined {
    while (this.closedSet.size < PATHFINDING_MAX_EXPANDED_NODES) {
      if (this.openSet.size === 0) {
        break;
      }

      const candidate = this.findNextNode();
      if (equals(candidate.position, this.dest.position)) {
        break;
      }

      this.step(candidate);
    }

    return this.constructPath();
  }

  // Euclidean distance heuristic.
  private heuristic(node: Node): number {
    return dist(node.position, this.dest.position);
  }

  private constructPath(): Path | undefined {
    if (this.parent(this.dest) === undefined) {
      return undefined;
    }

    const path: Path = { nodes: [] };
    let current = this.dest;
    while (current) {
      path.nodes.push(current);
      current = this.parent(current)!;
    }

    path.nodes.reverse();
    return path;
  }
}

export function updatePathfindingPosition(
  state: PathfindingComponent,
  position: ReadonlyVec3
) {
  const distance = dist(position, state.position);
  if (!state.position || distance >= PATHFINDING_PROGRESS_DISTANCE_METERS) {
    state.position = position as Vec3;
    state.searchTime = secondsSinceEpoch();
  }
}

export function stuckWhilePathfinding(
  state: PathfindingComponent,
  nowSeconds = secondsSinceEpoch()
): boolean {
  const timeElapsed = nowSeconds - state.searchTime;
  return timeElapsed >= PATHFINDING_STUCK_DURATION_SECONDS;
}

/**
 * Replaces the final node of a cached path in place.
 *
 * HARTHMERE_HILL_PATHFINDING: a player who steps one voxel sideways used to
 * invalidate an entire multi-node route, forcing a fresh A* on the next tick for
 * every pursuing NPC. Repairing the tail preserves all the work behind it. The
 * caller decides when a repair is legitimate (see `evaluatePathDestination`).
 */
export function repairPathDestination(path: Path, destination: Vec3): Path {
  if (path.nodes.length === 0) {
    return { nodes: [{ position: destination }] };
  }
  const nodes = path.nodes.slice(0, -1);
  nodes.push({ position: destination });
  return { nodes };
}

/**
 * Repairs a cached path only when the new destination is a real graph neighbour
 * of its penultimate node. Replacing the tail with an arbitrary nearby point can
 * create a two- or three-voxel jump through a wall, so the same graph that built
 * the route must approve the replacement edge.
 */
export function repairPathDestinationIfConnected(
  path: Path,
  destination: Vec3,
  graph: Graph,
  resources: BlockResources
): Path | undefined {
  if (path.nodes.length < 2) {
    return undefined;
  }
  const predecessor = path.nodes[path.nodes.length - 2];
  const connected = graph
    .neighbors(predecessor, resources)
    .some(([, node]) => equals(node.position, destination));
  return connected ? repairPathDestination(path, destination) : undefined;
}

/** Final node of a path, or `undefined` for an empty path. */
export function pathDestination(path: Path): Vec3 | undefined {
  return path.nodes.length ? path.nodes[path.nodes.length - 1].position : undefined;
}

function isFullHeightBlockAtPosition(
  resources: BlockResources | BlockResourceDeps,
  worldPos: ReadonlyVec3
) {
  const [_, isomorphismId] = getTerrainIdAndIsomorphismAtPosition(
    resources,
    worldPos
  );
  const shapeId = toShapeId(isomorphismId ?? -1);
  return [shapeIDs.full, shapeIDs.step, shapeIDs.table].includes(shapeId);
}
