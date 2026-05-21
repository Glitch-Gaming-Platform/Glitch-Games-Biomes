import {
  HARTHMERE_MISSION_EVENTS_KEY,
  QUESTS,
  QUEST_TARGETS,
  getHarthmereQuestTargetWorldPosV71,
  readHarthmereQuestState,
  type HarthmereQuestDefinition,
  type HarthmereQuestState,
} from "@/client/components/challenges/LocalDevHarthmereQuests";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { NpcMetadataSelector } from "@/shared/ecs/gen/selectors";
import { blockIsEmpty } from "@/shared/game/terrain_helper";
import { blockPos, shardEncode, voxelToShardPos } from "@/shared/game/shard";
import type { ReadonlyEntity } from "@/shared/ecs/gen/entities";
import type { BiomesId } from "@/shared/ids";
import type { Vec3 } from "@/shared/math/types";
import {
  SNAPSHOT_LIVE_DEBUG_PLAYER_SCOPE_VERSION_V78,
  SNAPSHOT_LIVE_NPC_GROUNDING_VERSION_V78,
  SNAPSHOT_LIVE_NPC_MAX_FOOT_CLEARANCE_V78,
  SNAPSHOT_PERFORMANCE_DEBUG_TOOLS_V78,
  SNAPSHOT_PERFORMANCE_WALKER_VERSION_V78,
  SNAPSHOT_REMAINING_PORT_AUDIT_VERSION_V78,
  SNAPSHOT_WALK_PERFORMANCE_PROFILER_VERSION_V78,
  snapshotAreaForPositionV78,
  snapshotIsLiveFloatingGroveNpcCandidateV78,
  snapshotLiveNpcAuditSummaryV78,
  snapshotLiveNpcFootClearanceV78,
  snapshotPointInBoundsV78,
  snapshotRemainingPortAuditV78,
  SNAPSHOT_GROVE_LIVE_BOUNDS_V78,
  type SnapshotLiveNpcAuditRecordV78,
  type SnapshotPerformanceSampleV78,
} from "@/shared/harthmere/snapshot_live_debug_v78";
import React, { useEffect, useMemo, useRef, useState } from "react";

export const SNAPSHOT_DIAGNOSTICS_PANEL_VERSION_V78 =
  "snapshot-diagnostics-panel-v78" as const;

function localPlayerPositionV78(ctx: ReturnType<typeof useClientContext>): Vec3 | undefined {
  try {
    const local = ctx.reactResources.get("/scene/local_player");
    const pos = local?.player?.position;
    return Array.isArray(pos) ? ([...pos] as Vec3) : undefined;
  } catch {
    return undefined;
  }
}

function entityLabelV78(entity: ReadonlyEntity) {
  return entity.label?.text ?? entity.npc_metadata?.type_id?.toString?.() ?? String(entity.id);
}

function entityDescriptionV78(entity: ReadonlyEntity) {
  return entity.entity_description?.text ?? "";
}

function collectLiveNpcAuditV78(ctx: ReturnType<typeof useClientContext>): SnapshotLiveNpcAuditRecordV78[] {
  const records: SnapshotLiveNpcAuditRecordV78[] = [];
  for (const entity of ctx.table.scan(NpcMetadataSelector.query.all())) {
    const position = entity.position?.v ? ([...entity.position.v] as Vec3) : undefined;
    const label = entityLabelV78(entity);
    const inGrove = snapshotPointInBoundsV78(position, SNAPSHOT_GROVE_LIVE_BOUNDS_V78);
    const inHarthmere = snapshotAreaForPositionV78(position) === "harthmere";
    const clearance = snapshotLiveNpcFootClearanceV78(position);
    const candidate = snapshotIsLiveFloatingGroveNpcCandidateV78({
      id: entity.id,
      label,
      position,
      entityDescription: entityDescriptionV78(entity),
    });
    const pass = !inGrove || candidate || clearance === undefined || Math.abs(clearance) <= 12;
    records.push({
      id: entity.id as BiomesId,
      label,
      position,
      inGrove,
      inHarthmere,
      clearance,
      pass,
      action: !position
        ? "missing_position"
        : candidate
          ? "visual_grounded"
          : pass
            ? "ok"
            : "needs_server_remap",
      reason: !position
        ? "NPC has no position component."
        : candidate
          ? "Original snapshot/Grove NPC is above the playable floor; renderer v78 grounds it visually and reports the ID for server remap."
          : pass
            ? "Foot clearance is acceptable for the current area or outside the Grove audit bounds."
            : "NPC is in the Grove and too far from the expected floor. Needs server-side position remap/delete.",
    });
  }
  return records;
}

function visibleResourceCountV78() {
  if (typeof performance === "undefined") return 0;
  return performance.getEntriesByType("resource").length;
}

function heapUsedMbV78() {
  const perf = performance as Performance & { memory?: { usedJSHeapSize?: number } };
  const used = perf.memory?.usedJSHeapSize;
  return typeof used === "number" ? Number((used / 1024 / 1024).toFixed(1)) : undefined;
}

function downloadJsonV78(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}


const HARTHMERE_AUTO_SURVEY_VERSION_V84 =
  "harthmere-auto-survey-terrain-npc-performance-mission-v90" as const;

const HARTHMERE_MISSION_AUDIT_VERSION_V90 =
  "biomes-harthmere-mission-audit-v90" as const;

interface HarthmereTerrainColumnSampleV84 {
  x: number;
  z: number;
  sampledFromY: number;
  sampledToY: number;
  terrainLoaded: boolean;
  groundBlockY?: number;
  feetY?: number;
  terrainId?: number;
  occupancyId?: number;
  solidBlocksChecked: number;
  emptyBlocksChecked: number;
  unloadedBlocksChecked: number;
}

interface HarthmereNpcGroundSampleV84 {
  id: BiomesId;
  label: string;
  position?: Vec3;
  distance?: number;
  area: string;
  groundBlockY?: number;
  expectedFeetY?: number;
  footDelta?: number;
  issue?: "missing_position" | "terrain_unloaded" | "buried" | "floating";
}

interface HarthmereMissionTextChecksV90 {
  titleVisible: boolean;
  objectiveVisible: boolean;
  targetVisible: boolean;
  actionVisible: boolean;
}

interface HarthmereMissionTargetCandidateV90 {
  id: BiomesId;
  label: string;
  position?: Vec3;
  distance?: number;
  labelMatch: boolean;
}

interface HarthmereMissionStepAuditV90 {
  questId: string;
  title: string;
  status: "available" | "active" | "ready" | "completed" | "invalid";
  stepIndex?: number;
  stepCount: number;
  objective?: string;
  targetOffset?: number;
  targetLabel?: string;
  targetDistrict?: string;
  targetPos?: Vec3;
  distance?: number;
  targetTerrain?: HarthmereTerrainColumnSampleV84;
  targetFootDelta?: number;
  nearbyTargets: HarthmereMissionTargetCandidateV90[];
  textChecks: HarthmereMissionTextChecksV90;
  issues: string[];
}

interface HarthmereMissionTraceEventV90 {
  atMs: number;
  kind: "accepted" | "advanced" | "completed" | "abandoned" | "state_changed";
  questId: string;
  title: string;
  fromStep?: number;
  toStep?: number;
  position?: Vec3;
  area: string;
}

interface HarthmereMissionAuditV90 {
  version: typeof HARTHMERE_MISSION_AUDIT_VERSION_V90;
  activeCount: number;
  completedCount: number;
  availableBoardCount: number;
  recentEventCount: number;
  active: HarthmereMissionStepAuditV90[];
  nearbyAvailable: HarthmereMissionStepAuditV90[];
  recentEvents: unknown[];
  trace: HarthmereMissionTraceEventV90[];
  issues: string[];
}

interface HarthmereAutoSurveySampleV84 {
  atMs: number;
  elapsedMs: number;
  area: string;
  position?: Vec3;
  playerFeetY?: number;
  terrain: {
    center?: HarthmereTerrainColumnSampleV84;
    probes: HarthmereTerrainColumnSampleV84[];
    missingColumns: number;
    playerFootDelta?: number;
  };
  npcs: {
    nearbyCount: number;
    offGroundCount: number;
    buriedCount: number;
    floatingCount: number;
    worst: HarthmereNpcGroundSampleV84[];
  };
  collision: {
    checkedBlocks: number;
    solidBlocks: number;
    occupancyBlocks: number;
    unloadedBlocks: number;
    density: number;
    nearbyNpcCount: number;
    nearbyEntityCount: number;
  };
  terrainStreaming: {
    checkedShards: number;
    missingTerrainShards: number;
    missingCombinedMeshShards: number;
    missingShardCenters: Vec3[];
  };
  performance: {
    fps: number;
    avgFrameMs: number;
    maxFrameMs: number;
    longTaskCount: number;
    heapUsedMb?: number;
    resourceCount: number;
    newResourceCount: number;
    slowResourceCount: number;
  };
  warnings: string[];
  mission?: HarthmereMissionAuditV90;
}

function roundV84(value: number, places = 2) {
  const m = 10 ** places;
  return Number.isFinite(value) ? Math.round(value * m) / m : value;
}

function roundVec3V84(value: Vec3 | undefined): Vec3 | undefined {
  if (!value) return undefined;
  return [roundV84(value[0]), roundV84(value[1]), roundV84(value[2])] as Vec3;
}

function terrainBlockInfoV84(
  ctx: ReturnType<typeof useClientContext>,
  x: number,
  y: number,
  z: number,
) {
  const world: Vec3 = [Math.floor(x), Math.floor(y), Math.floor(z)];
  const shardId = shardEncode(...voxelToShardPos(...world));
  const local = blockPos(...world);
  const terrain = ctx.resources.get("/terrain/tensor", shardId);
  const volume = ctx.resources.get("/terrain/volume", shardId);
  const occupancy = ctx.resources.get("/terrain/occupancy", shardId);
  const loaded = !!terrain;
  let empty = true;
  try {
    empty = blockIsEmpty(world, ctx.resources as any);
  } catch {
    empty = false;
  }
  return {
    loaded,
    empty,
    terrainId: volume?.get(...local),
    occupancyId: occupancy?.get(...local),
    shardId,
  };
}

function sampleTerrainColumnV84(
  ctx: ReturnType<typeof useClientContext>,
  x: number,
  z: number,
  aroundY: number,
  scanUp = 10,
  scanDown = 48,
): HarthmereTerrainColumnSampleV84 {
  const sampledFromY = Math.floor(aroundY + scanUp);
  const sampledToY = Math.floor(aroundY - scanDown);
  let terrainLoaded = false;
  let solidBlocksChecked = 0;
  let emptyBlocksChecked = 0;
  let unloadedBlocksChecked = 0;
  for (let y = sampledFromY; y >= sampledToY; y--) {
    const info = terrainBlockInfoV84(ctx, x, y, z);
    terrainLoaded ||= info.loaded;
    if (!info.loaded) {
      unloadedBlocksChecked++;
      continue;
    }
    if (info.empty) {
      emptyBlocksChecked++;
      continue;
    }
    solidBlocksChecked++;
    return {
      x: Math.floor(x),
      z: Math.floor(z),
      sampledFromY,
      sampledToY,
      terrainLoaded,
      groundBlockY: y,
      feetY: y + 1,
      terrainId: info.terrainId,
      occupancyId: info.occupancyId,
      solidBlocksChecked,
      emptyBlocksChecked,
      unloadedBlocksChecked,
    };
  }
  return {
    x: Math.floor(x),
    z: Math.floor(z),
    sampledFromY,
    sampledToY,
    terrainLoaded,
    solidBlocksChecked,
    emptyBlocksChecked,
    unloadedBlocksChecked,
  };
}

function distanceV84(a: Vec3, b: Vec3) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function collectNpcGroundSamplesV84(
  ctx: ReturnType<typeof useClientContext>,
  playerPos: Vec3 | undefined,
  radius: number,
): HarthmereNpcGroundSampleV84[] {
  const out: HarthmereNpcGroundSampleV84[] = [];
  for (const entity of ctx.table.scan(NpcMetadataSelector.query.all())) {
    const position = entity.position?.v ? ([...entity.position.v] as Vec3) : undefined;
    const label = entityLabelV78(entity);
    const area = snapshotAreaForPositionV78(position);
    const distance = position && playerPos ? distanceV84(position, playerPos) : undefined;
    if (distance !== undefined && distance > radius) continue;
    if (!position) {
      out.push({ id: entity.id as BiomesId, label, area, issue: "missing_position" });
      continue;
    }
    const column = sampleTerrainColumnV84(ctx, position[0], position[2], position[1], 16, 64);
    const expectedFeetY = column.feetY;
    const footDelta = expectedFeetY === undefined ? undefined : position[1] - expectedFeetY;
    const issue = expectedFeetY === undefined
      ? "terrain_unloaded"
      : footDelta < -0.75
        ? "buried"
        : footDelta > 2.25
          ? "floating"
          : undefined;
    out.push({
      id: entity.id as BiomesId,
      label,
      position: roundVec3V84(position),
      distance: distance === undefined ? undefined : roundV84(distance),
      area,
      groundBlockY: column.groundBlockY,
      expectedFeetY,
      footDelta: footDelta === undefined ? undefined : roundV84(footDelta),
      issue,
    });
  }
  return out.sort((a, b) => {
    const ai = a.issue ? 0 : 1;
    const bi = b.issue ? 0 : 1;
    if (ai !== bi) return ai - bi;
    return (a.distance ?? Number.POSITIVE_INFINITY) - (b.distance ?? Number.POSITIVE_INFINITY);
  });
}

function collisionDensityV84(
  ctx: ReturnType<typeof useClientContext>,
  position: Vec3 | undefined,
  radius = 8,
  verticalBelow = 3,
  verticalAbove = 5,
) {
  if (!position) {
    return { checkedBlocks: 0, solidBlocks: 0, occupancyBlocks: 0, unloadedBlocks: 0, density: 0, nearbyNpcCount: 0, nearbyEntityCount: 0 };
  }
  let checkedBlocks = 0;
  let solidBlocks = 0;
  let occupancyBlocks = 0;
  let unloadedBlocks = 0;
  const px = Math.floor(position[0]);
  const py = Math.floor(position[1]);
  const pz = Math.floor(position[2]);
  for (let x = px - radius; x <= px + radius; x += 2) {
    for (let z = pz - radius; z <= pz + radius; z += 2) {
      for (let y = py - verticalBelow; y <= py + verticalAbove; y++) {
        checkedBlocks++;
        const info = terrainBlockInfoV84(ctx, x, y, z);
        if (!info.loaded) {
          unloadedBlocks++;
        } else if (!info.empty) {
          solidBlocks++;
        }
        if (info.occupancyId) occupancyBlocks++;
      }
    }
  }
  let nearbyNpcCount = 0;
  let nearbyEntityCount = 0;
  const tableContents = ((ctx.table as any).contents?.() ?? []) as ReadonlyEntity[];
  for (const entity of tableContents) {
    const ep = entity.position?.v ? ([...entity.position.v] as Vec3) : undefined;
    if (!ep || distanceV84(ep, position) > radius * 2) continue;
    nearbyEntityCount++;
    if (entity.npc_metadata) nearbyNpcCount++;
  }
  return {
    checkedBlocks,
    solidBlocks,
    occupancyBlocks,
    unloadedBlocks,
    density: checkedBlocks ? roundV84(solidBlocks / checkedBlocks, 3) : 0,
    nearbyNpcCount,
    nearbyEntityCount,
  };
}

function terrainStreamingStatusV84(
  ctx: ReturnType<typeof useClientContext>,
  position: Vec3 | undefined,
  radius = 96,
) {
  if (!position) {
    return { checkedShards: 0, missingTerrainShards: 0, missingCombinedMeshShards: 0, missingShardCenters: [] as Vec3[] };
  }
  const centerShard = voxelToShardPos(...position);
  const shardRadius = Math.ceil(radius / 32);
  let checkedShards = 0;
  let missingTerrainShards = 0;
  let missingCombinedMeshShards = 0;
  const missingShardCenters: Vec3[] = [];
  for (let sx = centerShard[0] - shardRadius; sx <= centerShard[0] + shardRadius; sx++) {
    for (let sz = centerShard[2] - shardRadius; sz <= centerShard[2] + shardRadius; sz++) {
      for (let sy = centerShard[1] - 1; sy <= centerShard[1] + 1; sy++) {
        checkedShards++;
        const shardId = shardEncode(sx, sy, sz);
        const terrain = ctx.resources.get("/terrain/tensor", shardId);
        const resourcesAny = ctx.resources as any;
        const mesh = resourcesAny.cached?.("/terrain/combined_mesh", shardId)
          ? resourcesAny.get("/terrain/combined_mesh", shardId)
          : undefined;
        if (!terrain) {
          missingTerrainShards++;
          if (missingShardCenters.length < 20) {
            missingShardCenters.push([sx * 32 + 16, sy * 32 + 16, sz * 32 + 16] as Vec3);
          }
        }
        if (!mesh) missingCombinedMeshShards++;
      }
    }
  }
  return { checkedShards, missingTerrainShards, missingCombinedMeshShards, missingShardCenters };
}

function slowResourceStatsV84(previousCount: number) {
  const resources = performance.getEntriesByType("resource");
  const slowResourceCount = resources.filter((entry) => entry.duration > 250).length;
  return {
    resourceCount: resources.length,
    newResourceCount: Math.max(0, resources.length - previousCount),
    slowResourceCount,
  };
}

function normalizeMissionTextV90(value: string | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function documentTextV90() {
  if (typeof document === "undefined") return "";
  return normalizeMissionTextV90(document.body?.innerText ?? "");
}

function readMissionEventsV90(): unknown[] {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HARTHMERE_MISSION_EVENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, 20) : [];
  } catch {
    return [];
  }
}

function missionStatusV90(quest: HarthmereQuestDefinition, state: HarthmereQuestState) {
  if (state.completed.includes(quest.id)) return "completed" as const;
  const stepIndex = state.active[quest.id];
  if (stepIndex === undefined) return "available" as const;
  if (stepIndex < 0 || stepIndex >= quest.steps.length) return "invalid" as const;
  return stepIndex >= quest.steps.length - 1 ? ("ready" as const) : ("active" as const);
}

function missionTargetLabelMatchV90(entityLabel: string, targetLabel: string | undefined) {
  const entity = normalizeMissionTextV90(entityLabel);
  const target = normalizeMissionTextV90(targetLabel);
  if (!entity || !target) return false;
  if (entity.includes(target) || target.includes(entity)) return true;
  const targetWords = target.split(" ").filter((word) => word.length >= 4);
  if (!targetWords.length) return false;
  const matches = targetWords.filter((word) => entity.includes(word)).length;
  return matches >= Math.min(2, targetWords.length);
}

function collectMissionTargetCandidatesV90(
  ctx: ReturnType<typeof useClientContext>,
  targetPos: Vec3 | undefined,
  targetLabel: string | undefined,
  radius = 18,
): HarthmereMissionTargetCandidateV90[] {
  if (!targetPos) return [];
  const candidates: HarthmereMissionTargetCandidateV90[] = [];
  for (const entity of ctx.table.scan(NpcMetadataSelector.query.all())) {
    const position = entity.position?.v ? ([...entity.position.v] as Vec3) : undefined;
    if (!position) continue;
    const distance = distanceV84(position, targetPos);
    if (distance > radius) continue;
    const label = entityLabelV78(entity);
    candidates.push({
      id: entity.id as BiomesId,
      label,
      position: roundVec3V84(position),
      distance: roundV84(distance),
      labelMatch: missionTargetLabelMatchV90(label, targetLabel),
    });
  }
  return candidates.sort((a, b) => (b.labelMatch ? 1 : 0) - (a.labelMatch ? 1 : 0) || (a.distance ?? 999) - (b.distance ?? 999)).slice(0, 8);
}

function auditMissionQuestV90(
  ctx: ReturnType<typeof useClientContext>,
  quest: HarthmereQuestDefinition,
  state: HarthmereQuestState,
  playerPos: Vec3 | undefined,
  bodyText: string,
): HarthmereMissionStepAuditV90 {
  const status = missionStatusV90(quest, state);
  const stepIndex = state.active[quest.id] ?? 0;
  const step = quest.steps[stepIndex];
  const targetOffset = status === "available"
    ? (quest.giverOffsets.find((offset) => QUEST_TARGETS[offset]) ?? 41)
    : step?.targetOffset;
  const target = targetOffset === undefined ? undefined : QUEST_TARGETS[targetOffset];
  const targetPos = target ? (getHarthmereQuestTargetWorldPosV71(target) as Vec3) : undefined;
  const targetTerrain = targetPos ? sampleTerrainColumnV84(ctx, targetPos[0], targetPos[2], targetPos[1], 24, 80) : undefined;
  const targetFootDelta = targetPos && targetTerrain?.feetY !== undefined ? targetPos[1] - targetTerrain.feetY : undefined;
  const nearbyTargets = collectMissionTargetCandidatesV90(ctx, targetPos, target?.label);
  const distance = playerPos && targetPos ? distanceV84(playerPos, targetPos) : undefined;
  const titleNeedle = normalizeMissionTextV90(quest.title);
  const objectiveNeedle = normalizeMissionTextV90(step?.objective);
  const targetNeedle = normalizeMissionTextV90(target?.label);
  const completeNeedle = normalizeMissionTextV90(`complete ${quest.title}`);
  const acceptNeedle = normalizeMissionTextV90(`accept ${quest.title}`);
  const textChecks: HarthmereMissionTextChecksV90 = {
    titleVisible: !!titleNeedle && bodyText.includes(titleNeedle),
    objectiveVisible: !objectiveNeedle || bodyText.includes(objectiveNeedle),
    targetVisible: !targetNeedle || bodyText.includes(targetNeedle) || nearbyTargets.some((candidate) => candidate.labelMatch),
    actionVisible:
      status === "available"
        ? bodyText.includes(acceptNeedle)
        : status === "ready"
          ? bodyText.includes(completeNeedle)
          : true,
  };
  const issues: string[] = [];
  if (status === "invalid") issues.push("mission step index is outside quest step list");
  if (!step && status !== "completed") issues.push("mission has no current step definition");
  if (!target) issues.push(`missing QUEST_TARGETS entry for offset ${targetOffset ?? "unknown"}`);
  if (targetPos && targetTerrain?.feetY === undefined) issues.push("mission target terrain is not loaded");
  if (targetFootDelta !== undefined && Math.abs(targetFootDelta) > 16) {
    issues.push(`mission target Y looks wrong; target delta is ${roundV84(targetFootDelta)} blocks`);
  }
  if ((status === "active" || status === "ready") && !textChecks.titleVisible) {
    issues.push("mission title is not visible in current UI text");
  }
  if ((status === "active" || status === "ready") && !textChecks.objectiveVisible) {
    issues.push("mission objective text is not visible in current UI text");
  }
  if ((status === "active" || status === "ready") && !textChecks.targetVisible) {
    issues.push("mission target label/person/item is not visible or loaded near the marker");
  }
  if (distance !== undefined && distance <= 8 && !textChecks.actionVisible) {
    issues.push("player is near mission target but expected Accept/Complete action text is not visible");
  }
  return {
    questId: quest.id,
    title: quest.title,
    status,
    stepIndex: status === "completed" ? undefined : stepIndex,
    stepCount: quest.steps.length,
    objective: step?.objective,
    targetOffset,
    targetLabel: target?.label,
    targetDistrict: target?.district,
    targetPos: roundVec3V84(targetPos),
    distance: distance === undefined ? undefined : roundV84(distance),
    targetTerrain,
    targetFootDelta: targetFootDelta === undefined ? undefined : roundV84(targetFootDelta),
    nearbyTargets,
    textChecks,
    issues,
  };
}

function appendMissionTraceEventsV90(
  state: HarthmereQuestState,
  previousState: HarthmereQuestState | undefined,
  trace: HarthmereMissionTraceEventV90[],
  position: Vec3 | undefined,
) {
  if (!previousState) return trace;
  const nextTrace = [...trace];
  for (const quest of QUESTS) {
    const before = previousState.active[quest.id];
    const after = state.active[quest.id];
    const wasCompleted = previousState.completed.includes(quest.id);
    const isCompleted = state.completed.includes(quest.id);
    let kind: HarthmereMissionTraceEventV90["kind"] | undefined;
    if (before === undefined && after !== undefined) kind = "accepted";
    else if (before !== undefined && after !== undefined && before !== after) kind = "advanced";
    else if (before !== undefined && after === undefined && isCompleted && !wasCompleted) kind = "completed";
    else if (before !== undefined && after === undefined && !isCompleted) kind = "abandoned";
    if (kind) {
      nextTrace.unshift({
        atMs: Date.now(),
        kind,
        questId: quest.id,
        title: quest.title,
        fromStep: before,
        toStep: after,
        position: roundVec3V84(position),
        area: snapshotAreaForPositionV78(position),
      });
    }
  }
  return nextTrace.slice(0, 100);
}

export const SnapshotLiveDiagnosticsRuntimeControllerV78: React.FunctionComponent<{}> = () => {
  const ctx = useClientContext();
  const samplesRef = useRef<SnapshotPerformanceSampleV78[]>([]);
  const autoSurveySamplesRef = useRef<HarthmereAutoSurveySampleV84[]>([]);
  const autoSurveyStartedAtRef = useRef<number | undefined>(undefined);
  const autoSurveyRunningRef = useRef(false);
  const autoSurveyResourceCountRef = useRef(0);
  const marksRef = useRef<Array<{ atMs: number; label: string; position?: Vec3; area: string }>>([]);
  const missionTraceRef = useRef<HarthmereMissionTraceEventV90[]>([]);
  const previousMissionStateRef = useRef<HarthmereQuestState | undefined>(undefined);
  const framesRef = useRef<number[]>([]);
  const lastFrameRef = useRef<number | undefined>(undefined);
  const runningRef = useRef(false);
  const longTaskCountRef = useRef(0);
  const rafRef = useRef<number | undefined>(undefined);
  const intervalRef = useRef<number | undefined>(undefined);
  const autoSurveyIntervalRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    let observer: PerformanceObserver | undefined;
    if (typeof PerformanceObserver !== "undefined") {
      try {
        observer = new PerformanceObserver((list) => {
          longTaskCountRef.current += list.getEntries().length;
        });
        observer.observe({ entryTypes: ["longtask"] });
      } catch {
        // Safari/older browsers may not support longtask. FPS and frame spikes still work.
      }
    }
    return () => observer?.disconnect();
  }, []);

  useEffect(() => {
    const tick = (now: number) => {
      if (lastFrameRef.current !== undefined) {
        framesRef.current.push(now - lastFrameRef.current);
        framesRef.current = framesRef.current.slice(-120);
      }
      lastFrameRef.current = now;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const captureMissionAuditV90 = (position?: Vec3): HarthmereMissionAuditV90 => {
    const state = readHarthmereQuestState();
    missionTraceRef.current = appendMissionTraceEventsV90(
      state,
      previousMissionStateRef.current,
      missionTraceRef.current,
      position,
    );
    previousMissionStateRef.current = state;
    const bodyText = documentTextV90();
    const activeQuests = QUESTS.filter((quest) => state.active[quest.id] !== undefined || state.completed.includes(quest.id));
    const active = activeQuests
      .filter((quest) => !state.completed.includes(quest.id))
      .map((quest) => auditMissionQuestV90(ctx, quest, state, position, bodyText));
    const available = QUESTS
      .filter((quest) => state.active[quest.id] === undefined && !state.completed.includes(quest.id) && quest.boardListed)
      .map((quest) => auditMissionQuestV90(ctx, quest, state, position, bodyText))
      .sort((a, b) => (a.distance ?? 9999) - (b.distance ?? 9999))
      .slice(0, 8);
    const recentEvents = readMissionEventsV90();
    const issues = [
      ...active.flatMap((entry) => entry.issues.map((issue) => `${entry.title}: ${issue}`)),
    ];
    if (active.length && recentEvents.length === 0 && missionTraceRef.current.length === 0) {
      issues.push("active mission exists but no mission event/trace history was recorded");
    }
    return {
      version: HARTHMERE_MISSION_AUDIT_VERSION_V90,
      activeCount: active.length,
      completedCount: state.completed.length,
      availableBoardCount: available.length,
      recentEventCount: recentEvents.length,
      active,
      nearbyAvailable: available,
      recentEvents,
      trace: missionTraceRef.current,
      issues,
    };
  };

  const captureAutoSurveySample = (opts?: {
    npcRadius?: number;
    terrainProbeRadius?: number;
    collisionRadius?: number;
    streamingRadius?: number;
  }): HarthmereAutoSurveySampleV84 => {
    if (autoSurveyStartedAtRef.current === undefined) {
      autoSurveyStartedAtRef.current = Date.now();
    }
    const npcRadius = opts?.npcRadius ?? 96;
    const terrainProbeRadius = opts?.terrainProbeRadius ?? 16;
    const collisionRadius = opts?.collisionRadius ?? 10;
    const streamingRadius = opts?.streamingRadius ?? 96;
    const frames = framesRef.current;
    const avgFrameMs = frames.length ? frames.reduce((a, b) => a + b, 0) / frames.length : 0;
    const maxFrameMs = frames.length ? Math.max(...frames) : 0;
    const fps = avgFrameMs > 0 ? 1000 / avgFrameMs : 0;
    const position = localPlayerPositionV78(ctx);
    const area = snapshotAreaForPositionV78(position);
    const aroundY = position?.[1] ?? 70;
    const terrainProbes = position
      ? [
          [position[0], position[2]],
          [position[0] + terrainProbeRadius, position[2]],
          [position[0] - terrainProbeRadius, position[2]],
          [position[0], position[2] + terrainProbeRadius],
          [position[0], position[2] - terrainProbeRadius],
        ].map(([x, z]) => sampleTerrainColumnV84(ctx, x, z, aroundY))
      : [];
    const center = terrainProbes[0];
    const playerFootDelta = position && center?.feetY !== undefined ? position[1] - center.feetY : undefined;
    const npcSamples = collectNpcGroundSamplesV84(ctx, position, npcRadius);
    const offGroundNpcs = npcSamples.filter((npc) => !!npc.issue);
    const collision = collisionDensityV84(ctx, position, collisionRadius);
    const terrainStreaming = terrainStreamingStatusV84(ctx, position, streamingRadius);
    const resourceStats = slowResourceStatsV84(autoSurveyResourceCountRef.current);
    autoSurveyResourceCountRef.current = resourceStats.resourceCount;
    const mission = captureMissionAuditV90(position);
    const warnings: string[] = [];
    if (playerFootDelta !== undefined && Math.abs(playerFootDelta) > 2.5) {
      warnings.push(`player foot delta ${roundV84(playerFootDelta)} from terrain feet ${center?.feetY}`);
    }
    if (offGroundNpcs.length) {
      warnings.push(`${offGroundNpcs.length} nearby NPCs are buried/floating/unloaded`);
    }
    if (maxFrameMs > 80) {
      warnings.push(`slow frame ${roundV84(maxFrameMs)}ms near ${roundVec3V84(position)?.join(",") ?? "unknown"}`);
    }
    if (terrainStreaming.missingTerrainShards > 0) {
      warnings.push(`${terrainStreaming.missingTerrainShards}/${terrainStreaming.checkedShards} nearby terrain shards missing`);
    }
    if (terrainStreaming.missingCombinedMeshShards > terrainStreaming.checkedShards * 0.4) {
      warnings.push(`${terrainStreaming.missingCombinedMeshShards}/${terrainStreaming.checkedShards} nearby combined meshes missing`);
    }
    if (collision.density > 0.45) {
      warnings.push(`high nearby solid collision density ${collision.density}`);
    }
    if (mission.issues.length) {
      warnings.push(`${mission.issues.length} active mission audit issues`);
    }
    const sample: HarthmereAutoSurveySampleV84 = {
      atMs: Date.now(),
      elapsedMs: Date.now() - autoSurveyStartedAtRef.current,
      area,
      position: roundVec3V84(position),
      playerFeetY: position ? roundV84(position[1]) : undefined,
      terrain: {
        center,
        probes: terrainProbes,
        missingColumns: terrainProbes.filter((probe) => probe.feetY === undefined).length,
        playerFootDelta: playerFootDelta === undefined ? undefined : roundV84(playerFootDelta),
      },
      npcs: {
        nearbyCount: npcSamples.length,
        offGroundCount: offGroundNpcs.length,
        buriedCount: offGroundNpcs.filter((npc) => npc.issue === "buried").length,
        floatingCount: offGroundNpcs.filter((npc) => npc.issue === "floating").length,
        worst: offGroundNpcs.slice(0, 20),
      },
      collision,
      terrainStreaming,
      performance: {
        fps: Number(fps.toFixed(1)),
        avgFrameMs: Number(avgFrameMs.toFixed(2)),
        maxFrameMs: Number(maxFrameMs.toFixed(2)),
        longTaskCount: longTaskCountRef.current,
        heapUsedMb: heapUsedMbV78(),
        ...resourceStats,
      },
      warnings,
      mission,
    };
    autoSurveySamplesRef.current = [...autoSurveySamplesRef.current, sample].slice(-7200);
    if (warnings.length && autoSurveyRunningRef.current) {
      const lastWarn = (window as any).__harthmereAutoSurveyLastWarnAtV84 ?? 0;
      if (Date.now() - lastWarn > 15000) {
        (window as any).__harthmereAutoSurveyLastWarnAtV84 = Date.now();
        // BIOMES_AUTO_SURVEY_CONSOLE_QUIET_V89
        // The full sample is still stored in the downloaded report. Keep the
        // live console readable while profiling by logging only the summary.
        console.warn("[HarthmereAutoSurveyV89]", {
          warnings,
          area: sample.area,
          position: sample.position,
          fps: sample.performance.fps,
          avgFrameMs: sample.performance.avgFrameMs,
          offGroundNpcs: sample.npcs.offGroundCount,
          collisionDensity: sample.collision.density,
          missingTerrainShards: sample.terrainStreaming.missingTerrainShards,
          missingCombinedMeshShards: sample.terrainStreaming.missingCombinedMeshShards,
          activeMissionIssues: sample.mission?.issues.length ?? 0,
        });
      }
    }
    return sample;
  };

  const captureSample = () => {
    const frames = framesRef.current;
    const avgFrameMs = frames.length ? frames.reduce((a, b) => a + b, 0) / frames.length : 0;
    const maxFrameMs = frames.length ? Math.max(...frames) : 0;
    const fps = avgFrameMs > 0 ? 1000 / avgFrameMs : 0;
    const position = localPlayerPositionV78(ctx);
    const audit = collectLiveNpcAuditV78(ctx);
    const nearbyNpcCount = audit.filter((record) => {
      if (!record.position || !position) return false;
      const dx = record.position[0] - position[0];
      const dy = record.position[1] - position[1];
      const dz = record.position[2] - position[2];
      return Math.sqrt(dx * dx + dy * dy + dz * dz) <= 40;
    }).length;
    const sample: SnapshotPerformanceSampleV78 = {
      atMs: Date.now(),
      area: snapshotAreaForPositionV78(position),
      position,
      fps: Number(fps.toFixed(1)),
      avgFrameMs: Number(avgFrameMs.toFixed(2)),
      maxFrameMs: Number(maxFrameMs.toFixed(2)),
      longTaskCount: longTaskCountRef.current,
      heapUsedMb: heapUsedMbV78(),
      nearbyNpcCount,
      floatingNpcCount: audit.filter((record) => record.action === "visual_grounded" || record.action === "needs_server_remap").length,
      visibleResourceCount: visibleResourceCountV78(),
    };
    samplesRef.current = [...samplesRef.current, sample].slice(-1800);
    return sample;
  };

  const report = () => {
    const samples = samplesRef.current;
    const byArea = new Map<string, SnapshotPerformanceSampleV78[]>();
    for (const sample of samples) {
      byArea.set(sample.area, [...(byArea.get(sample.area) ?? []), sample]);
    }
    const areaReports = [...byArea.entries()].map(([area, areaSamples]) => {
      const avgFps = areaSamples.reduce((sum, sample) => sum + sample.fps, 0) / Math.max(1, areaSamples.length);
      const worst = [...areaSamples].sort((a, b) => b.maxFrameMs - a.maxFrameMs)[0];
      return {
        area,
        samples: areaSamples.length,
        avgFps: Number(avgFps.toFixed(1)),
        worstFrameMs: worst?.maxFrameMs ?? 0,
        worstPosition: worst?.position,
        floatingNpcCount: Math.max(...areaSamples.map((sample) => sample.floatingNpcCount), 0),
        nearbyNpcHighWater: Math.max(...areaSamples.map((sample) => sample.nearbyNpcCount), 0),
      };
    });
    const resources = performance.getEntriesByType("resource")
      .map((entry) => ({ name: entry.name, duration: Number(entry.duration.toFixed(1)), startTime: Number(entry.startTime.toFixed(1)) }))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 25);
    return {
      version: SNAPSHOT_WALK_PERFORMANCE_PROFILER_VERSION_V78,
      running: runningRef.current,
      samples: samples.length,
      marks: marksRef.current,
      areas: areaReports,
      slowResources: resources,
      floatingAudit: snapshotLiveNpcAuditSummaryV78(collectLiveNpcAuditV78(ctx)),
      navigation: performance.getEntriesByType("navigation")[0]?.toJSON?.() ?? undefined,
    };
  };


  const autoSurveyReport = () => {
    const samples = autoSurveySamplesRef.current;
    const warningSamples = samples.filter((sample) => sample.warnings.length > 0);
    const worstFrames = [...samples]
      .sort((a, b) => b.performance.maxFrameMs - a.performance.maxFrameMs)
      .slice(0, 20)
      .map((sample) => ({
        atMs: sample.atMs,
        elapsedMs: sample.elapsedMs,
        area: sample.area,
        position: sample.position,
        maxFrameMs: sample.performance.maxFrameMs,
        fps: sample.performance.fps,
        warnings: sample.warnings,
      }));
    const offGroundNpcs = new Map<string, HarthmereNpcGroundSampleV84>();
    for (const sample of samples) {
      for (const npc of sample.npcs.worst) {
        offGroundNpcs.set(String(npc.id), npc);
      }
    }
    const highCollision = [...samples]
      .sort((a, b) => b.collision.density - a.collision.density)
      .slice(0, 20)
      .map((sample) => ({
        atMs: sample.atMs,
        elapsedMs: sample.elapsedMs,
        area: sample.area,
        position: sample.position,
        density: sample.collision.density,
        solidBlocks: sample.collision.solidBlocks,
        checkedBlocks: sample.collision.checkedBlocks,
        nearbyNpcCount: sample.collision.nearbyNpcCount,
        nearbyEntityCount: sample.collision.nearbyEntityCount,
      }));
    const streamingProblems = samples
      .filter((sample) => sample.terrainStreaming.missingTerrainShards > 0 || sample.terrainStreaming.missingCombinedMeshShards > 0)
      .slice(-50)
      .map((sample) => ({
        atMs: sample.atMs,
        elapsedMs: sample.elapsedMs,
        area: sample.area,
        position: sample.position,
        checkedShards: sample.terrainStreaming.checkedShards,
        missingTerrainShards: sample.terrainStreaming.missingTerrainShards,
        missingCombinedMeshShards: sample.terrainStreaming.missingCombinedMeshShards,
        missingShardCenters: sample.terrainStreaming.missingShardCenters,
      }));
    const missionProblems = samples
      .filter((sample) => (sample.mission?.issues.length ?? 0) > 0)
      .slice(-50)
      .map((sample) => ({
        atMs: sample.atMs,
        elapsedMs: sample.elapsedMs,
        area: sample.area,
        position: sample.position,
        activeCount: sample.mission?.activeCount ?? 0,
        issues: sample.mission?.issues ?? [],
        active: sample.mission?.active ?? [],
      }));
    return {
      version: HARTHMERE_AUTO_SURVEY_VERSION_V84,
      running: autoSurveyRunningRef.current,
      samples: samples.length,
      startedAtMs: autoSurveyStartedAtRef.current,
      latest: samples.at(-1),
      warningCount: warningSamples.length,
      latestWarnings: warningSamples.slice(-20),
      worstFrames,
      offGroundNpcs: [...offGroundNpcs.values()].sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0)),
      highCollision,
      streamingProblems,
      missionTrace: missionTraceRef.current,
      missionProblems,
      latestMission: samples.at(-1)?.mission ?? captureMissionAuditV90(localPlayerPositionV78(ctx)),
      rawSamples: samples,
    };
  };

  useEffect(() => {
    const start = () => {
      runningRef.current = true;
      if (intervalRef.current === undefined) {
        intervalRef.current = window.setInterval(() => {
          if (runningRef.current) captureSample();
        }, 1000);
      }
      return report();
    };
    const stop = () => {
      runningRef.current = false;
      return report();
    };
    const mark = (label = "manual") => {
      const position = localPlayerPositionV78(ctx);
      const entry = { atMs: Date.now(), label, position, area: snapshotAreaForPositionV78(position) };
      marksRef.current = [entry, ...marksRef.current].slice(0, 250);
      return entry;
    };
    const clear = () => {
      samplesRef.current = [];
      marksRef.current = [];
      missionTraceRef.current = [];
      previousMissionStateRef.current = undefined;
      longTaskCountRef.current = 0;
      return report();
    };
    const autoSurveyStart = (opts?: {
      intervalMs?: number;
      npcRadius?: number;
      terrainProbeRadius?: number;
      collisionRadius?: number;
      streamingRadius?: number;
    }) => {
      const intervalMs = Math.max(250, opts?.intervalMs ?? 1000);
      autoSurveyRunningRef.current = true;
      autoSurveyStartedAtRef.current ??= Date.now();
      autoSurveyResourceCountRef.current = performance.getEntriesByType("resource").length;
      if (autoSurveyIntervalRef.current !== undefined) {
        window.clearInterval(autoSurveyIntervalRef.current);
      }
      const sampleOpts = {
        npcRadius: opts?.npcRadius,
        terrainProbeRadius: opts?.terrainProbeRadius,
        collisionRadius: opts?.collisionRadius,
        streamingRadius: opts?.streamingRadius,
      };
      captureAutoSurveySample(sampleOpts);
      autoSurveyIntervalRef.current = window.setInterval(() => {
        if (autoSurveyRunningRef.current) captureAutoSurveySample(sampleOpts);
      }, intervalMs);
      console.info("[HarthmereAutoSurveyV89] started", { intervalMs, ...sampleOpts });
      return autoSurveyReport();
    };
    const autoSurveyStop = () => {
      autoSurveyRunningRef.current = false;
      if (autoSurveyIntervalRef.current !== undefined) {
        window.clearInterval(autoSurveyIntervalRef.current);
        autoSurveyIntervalRef.current = undefined;
      }
      console.info("[HarthmereAutoSurveyV89] stopped", autoSurveyReport());
      return autoSurveyReport();
    };
    const autoSurveyClear = () => {
      autoSurveySamplesRef.current = [];
      autoSurveyStartedAtRef.current = undefined;
      missionTraceRef.current = [];
      previousMissionStateRef.current = undefined;
      autoSurveyResourceCountRef.current = performance.getEntriesByType("resource").length;
      return autoSurveyReport();
    };
    const win = window as typeof window & {
      __snapshotPerfV78?: unknown;
      __snapshotDiagnosticsV78?: unknown;
      __harthmereAutoSurveyV84?: unknown;
    };
    win.__snapshotPerfV78 = {
      version: SNAPSHOT_WALK_PERFORMANCE_PROFILER_VERSION_V78,
      start,
      stop,
      mark,
      clear,
      sample: captureSample,
      samples: () => samplesRef.current,
      report,
      tools: SNAPSHOT_PERFORMANCE_DEBUG_TOOLS_V78,
      download: (filename = `snapshot-perf-walk-v78-${Date.now()}.json`) => downloadJsonV78(filename, report()),
    };
    win.__snapshotDiagnosticsV78 = {
      version: SNAPSHOT_LIVE_DEBUG_PLAYER_SCOPE_VERSION_V78,
      runFloatingAudit: () => collectLiveNpcAuditV78(ctx),
      floatingSummary: () => snapshotLiveNpcAuditSummaryV78(collectLiveNpcAuditV78(ctx)),
      remainingPortAudit: snapshotRemainingPortAuditV78,
      performanceTools: SNAPSHOT_PERFORMANCE_DEBUG_TOOLS_V78,
      performanceReport: report,
      autoSurvey: autoSurveyReport,
      missionAuditV90: () => captureMissionAuditV90(localPlayerPositionV78(ctx)),
      downloadMissionAuditV90: (filename = `harthmere-mission-audit-v90-${Date.now()}.json`) =>
        downloadJsonV78(filename, captureMissionAuditV90(localPlayerPositionV78(ctx))),
      downloadFloatingAudit: (filename = `snapshot-floating-npc-audit-v78-${Date.now()}.json`) =>
        downloadJsonV78(filename, collectLiveNpcAuditV78(ctx)),
    };
    win.__harthmereAutoSurveyV84 = {
      version: HARTHMERE_AUTO_SURVEY_VERSION_V84,
      start: autoSurveyStart,
      stop: autoSurveyStop,
      clear: autoSurveyClear,
      sample: captureAutoSurveySample,
      samples: () => autoSurveySamplesRef.current,
      report: autoSurveyReport,
      missionAudit: () => captureMissionAuditV90(localPlayerPositionV78(ctx)),
      downloadMissionAudit: (filename = `harthmere-mission-audit-v90-${Date.now()}.json`) =>
        downloadJsonV78(filename, captureMissionAuditV90(localPlayerPositionV78(ctx))),
      download: (filename = `harthmere-auto-survey-v84-${Date.now()}.json`) =>
        downloadJsonV78(filename, autoSurveyReport()),
      explain: () => ({
        terrain: "Scans terrain tensors above/below the player and nearby NPCs to find groundBlockY, expected feetY, and buried/floating deltas.",
        performance: "Records FPS, max frame time, long tasks, heap, new resources, slow resources, terrain/mesh shard readiness, and local collision density.",
        missions: "When a Harthmere mission starts or advances, records active quest state, target position, nearby loaded target NPCs, UI text visibility, objective/action text, and mission issues.",
        usage: "Run window.__harthmereAutoSurveyV84.start(); accept/advance a mission; walk to the marker; then run stop(), report(), or download().",
      }),
    };
    return () => {
      if (intervalRef.current !== undefined) window.clearInterval(intervalRef.current);
      if (autoSurveyIntervalRef.current !== undefined) window.clearInterval(autoSurveyIntervalRef.current);
    };
  }, [ctx]);

  return <span className="hidden" data-snapshot-live-debug-player-scope-v78={SNAPSHOT_LIVE_DEBUG_PLAYER_SCOPE_VERSION_V78} />;
};

export const SnapshotLiveGroundingAuditPanelV78: React.FunctionComponent<{}> = () => {
  const ctx = useClientContext();
  const [audit, setAudit] = useState<SnapshotLiveNpcAuditRecordV78[]>(() => collectLiveNpcAuditV78(ctx));

  useEffect(() => {
    const interval = window.setInterval(() => setAudit(collectLiveNpcAuditV78(ctx)), 1500);
    return () => window.clearInterval(interval);
  }, [ctx]);

  const summary = useMemo(() => snapshotLiveNpcAuditSummaryV78(audit), [audit]);
  const flagged = audit.filter((entry) => entry.action === "visual_grounded" || entry.action === "needs_server_remap");

  return (
    <div className="rounded border border-red-200/20 bg-red-950/30 p-2 text-white">
      <div className="text-sm font-semibold">Live NPC Foot Audit</div>
      <div className="text-[10px] uppercase tracking-wide text-red-100/80">
        {SNAPSHOT_LIVE_NPC_GROUNDING_VERSION_V78}
      </div>
      <div className="mt-1 text-xs text-white/75">
        {summary.total} live NPCs scanned · visually grounded {summary.visualGrounded} · server remap {summary.needsServerRemap}
      </div>
      <div className="mt-1 text-[11px] text-white/60">
        Tolerance ≤ {SNAPSHOT_LIVE_NPC_MAX_FOOT_CLEARANCE_V78}m for Grove-authored NPCs. Floating snapshot originals are grounded visually and reported by ID.
      </div>
      {!!flagged.length && (
        <div className="mt-1 text-[11px] text-red-100">
          {flagged.slice(0, 4).map((entry) => `${entry.label}: y=${entry.position?.[1]?.toFixed?.(2) ?? "?"}`).join(" · ")}
        </div>
      )}
    </div>
  );
};

export const SnapshotPerformanceWalkerPanelV78: React.FunctionComponent<{}> = () => {
  const [report, setReport] = useState<any>(() => undefined);
  useEffect(() => {
    const refresh = () => {
      const perf = (window as any).__snapshotPerfV78;
      if (perf?.report) setReport(perf.report());
    };
    refresh();
    const interval = window.setInterval(refresh, 1500);
    return () => window.clearInterval(interval);
  }, []);
  const latest = report?.areas?.[0];
  return (
    <div className="rounded border border-lime-200/20 bg-lime-950/30 p-2 text-white">
      <div className="text-sm font-semibold">Walk Performance Profiler</div>
      <div className="text-[10px] uppercase tracking-wide text-lime-100/80">
        {SNAPSHOT_PERFORMANCE_WALKER_VERSION_V78}
      </div>
      <div className="mt-1 text-xs text-white/75">
        Console: window.__harthmereAutoSurveyV84.start(); walk around; stop(); download()
      </div>
      <div className="mt-1 text-[11px] text-white/60">
        Also available: window.__snapshotPerfV78.start(), mark(&quot;bad-collision&quot;), stop(), report(), download()
      </div>
      <div className="mt-1 text-[11px] text-white/60">
        Samples: {report?.samples ?? 0} · Worst area: {latest?.area ?? "none"} · Worst frame: {latest?.worstFrameMs ?? 0}ms · Floating NPCs: {report?.floatingAudit?.visualGrounded ?? 0}
      </div>
    </div>
  );
};

export const SnapshotRemainingPortAuditPanelV78: React.FunctionComponent<{}> = () => {
  const audit = snapshotRemainingPortAuditV78();
  return (
    <div className="rounded border border-zinc-200/20 bg-zinc-950/30 p-2 text-white">
      <div className="text-sm font-semibold">Remaining Snapshot Port Audit</div>
      <div className="text-[10px] uppercase tracking-wide text-zinc-100/80">
        {SNAPSHOT_REMAINING_PORT_AUDIT_VERSION_V78}
      </div>
      <div className="mt-1 text-xs text-white/75">{audit.openCount} follow-up production QA items remain.</div>
      <div className="mt-1 text-[11px] text-white/60">
        {audit.items.slice(0, 3).map((item) => `${item.area}: ${item.status}`).join(" · ")}
      </div>
    </div>
  );
};
