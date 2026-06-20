import {
  HARTHMERE_MISSION_EVENTS_KEY,
  QUESTS,
  QUEST_TARGETS,
  getHarthmereQuestTargetWorldPos,
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
  SNAPSHOT_LIVE_DEBUG_PLAYER_SCOPE_VERSION,
  SNAPSHOT_LIVE_NPC_GROUNDING_VERSION,
  SNAPSHOT_LIVE_NPC_MAX_FOOT_CLEARANCE,
  SNAPSHOT_PERFORMANCE_DEBUG_TOOLS,
  SNAPSHOT_REMAINING_PORT_AUDIT_VERSION,
  SNAPSHOT_WALK_PERFORMANCE_PROFILER_VERSION,
  snapshotAreaForPosition,
  snapshotIsLiveFloatingGroveNpcCandidate,
  snapshotLiveNpcAuditSummary,
  snapshotLiveNpcFootClearance,
  snapshotMuckerHexerTileClearancePass,
  snapshotPointInBounds,
  snapshotRemainingPortAudit,
  snapshotLabelIsMuckerOrHexer,
  SNAPSHOT_GROVE_LIVE_BOUNDS,
  SNAPSHOT_MUCKER_HEXER_TILE_CLEARANCE_VERSION,
  type SnapshotLiveNpcAuditRecord,
  type SnapshotPerformanceSample,
} from "@/shared/harthmere/snapshot_live_debug";
import React, { useEffect, useMemo, useRef, useState } from "react";

export const SNAPSHOT_DIAGNOSTICS_PANEL_VERSION =
  "snapshot-diagnostics-panel" as const;

function localPlayerPosition(
  ctx: ReturnType<typeof useClientContext>
): Vec3 | undefined {
  try {
    const local = ctx.reactResources.get("/scene/local_player");
    const pos = local?.player?.position;
    return Array.isArray(pos) ? ([...pos] as Vec3) : undefined;
  } catch {
    return undefined;
  }
}

function entityLabel(entity: ReadonlyEntity) {
  return (
    entity.label?.text ??
    entity.npc_metadata?.type_id?.toString?.() ??
    String(entity.id)
  );
}

function entityDescription(entity: ReadonlyEntity) {
  return entity.entity_description?.text ?? "";
}

function collectLiveNpcAudit(
  ctx: ReturnType<typeof useClientContext>
): SnapshotLiveNpcAuditRecord[] {
  const records: SnapshotLiveNpcAuditRecord[] = [];
  for (const entity of ctx.table.scan(NpcMetadataSelector.query.all())) {
    const position = entity.position?.v
      ? ([...entity.position.v] as Vec3)
      : undefined;
    const label = entityLabel(entity);
    const inGrove = snapshotPointInBounds(
      position,
      SNAPSHOT_GROVE_LIVE_BOUNDS
    );
    const inHarthmere = snapshotAreaForPosition(position) === "harthmere";
    const clearance = snapshotLiveNpcFootClearance(position);
    const candidate = snapshotIsLiveFloatingGroveNpcCandidate({
      id: entity.id,
      label,
      position,
      entityDescription: entityDescription(entity),
    });
    const pass =
      !inGrove ||
      candidate ||
      clearance === undefined ||
      Math.abs(clearance) <= 12;
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
          ? "Original snapshot/Grove NPC is above the playable floor; renderer current grounds it visually and reports the ID for server remap."
          : pass
            ? "Foot clearance is acceptable for the current area or outside the Grove audit bounds."
            : "NPC is in the Grove and too far from the expected floor. Needs server-side position remap/delete.",
    });
  }
  return records;
}

function visibleResourceCount() {
  if (typeof performance === "undefined") return 0;
  return performance.getEntriesByType("resource").length;
}

function heapUsedMb() {
  const perf = performance as Performance & {
    memory?: { usedJSHeapSize?: number };
  };
  const used = perf.memory?.usedJSHeapSize;
  return typeof used === "number"
    ? Number((used / 1024 / 1024).toFixed(1))
    : undefined;
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const HARTHMERE_AUTO_SURVEY_VERSION =
  "harthmere-auto-survey-terrain-npc-performance-mission" as const;

const HARTHMERE_MISSION_AUDIT_VERSION =
  "biomes-harthmere-mission-audit" as const;

// HARTHMERE_PERF_AND_PLACEMENT — Survey signal hygiene.
//
// 43% of the off-ground warnings in the 2026-05-21 audit were wandering
// wilds creatures (mucklings, hexers, muckers, halides) whose feet legitimately
// leave the ground as they walk. They were drowning the *real* Harthmere
// signal (named NPCs buried under raised structures). current separates them into
// their own counter so the main warning string focuses on town residents.
//
// current also reduces survey retention defaults to stop the survey itself from
// becoming a perf problem (793 retained samples in 14 minutes at fps:6 was
// not helping anyone).
export const HARTHMERE_PERF_AND_PLACEMENT_SURVEY =
  "harthmere-perf-and-placement-survey";

const HARTHMERE_WANDERING_NPC_LABEL_RX =
  /muckling|mucker|hexer|halide|chirp|wisp|sprite|moth|bat\b|hostile/i;

function isHarthmereWanderingNpcLabel(label: string | undefined): boolean {
  if (!label) return false;
  return HARTHMERE_WANDERING_NPC_LABEL_RX.test(label);
}

// Survey retention caps — every value below was the previous default doubled
// or worse. The current caps were chosen so a 30-minute capture session at
// fps>=20 produces a downloadable JSON under ~3 MB and keeps the most
// recent useful slice rather than a long unfocused tail.
const HARTHMERE_SURVEY_RAW_SAMPLE_CAP = 60;
const HARTHMERE_SURVEY_WORST_FRAME_CAP = 12;
const HARTHMERE_SURVEY_NPC_SCAN_RADIUS = 40;
const HARTHMERE_SURVEY_OFF_GROUND_TOWN_REPORT_CAP = 40;
const HARTHMERE_SURVEY_OFF_GROUND_WANDERING_REPORT_CAP = 12;

interface HarthmereTerrainColumnSample {
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

interface HarthmereNpcGroundSample {
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

interface HarthmereMissionTextChecks {
  titleVisible: boolean;
  objectiveVisible: boolean;
  targetVisible: boolean;
  actionVisible: boolean;
}

interface HarthmereMissionTargetCandidate {
  id: BiomesId;
  label: string;
  position?: Vec3;
  distance?: number;
  labelMatch: boolean;
}

interface HarthmereMuckerHexerTileClearanceSample {
  version: typeof SNAPSHOT_MUCKER_HEXER_TILE_CLEARANCE_VERSION;
  id?: BiomesId;
  label: string;
  position?: Vec3;
  rendered: boolean;
  groundBlockY?: number;
  expectedFeetY?: number;
  clearance?: number;
  pass: boolean;
  reason: string;
}

interface HarthmereMissionStepAudit {
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
  targetTerrain?: HarthmereTerrainColumnSample;
  targetFootDelta?: number;
  nearbyTargets: HarthmereMissionTargetCandidate[];
  textChecks: HarthmereMissionTextChecks;
  issues: string[];
}

interface HarthmereMissionTraceEvent {
  atMs: number;
  kind: "accepted" | "advanced" | "completed" | "abandoned" | "state_changed";
  questId: string;
  title: string;
  fromStep?: number;
  toStep?: number;
  position?: Vec3;
  area: string;
}

interface HarthmereMissionAudit {
  version: typeof HARTHMERE_MISSION_AUDIT_VERSION;
  activeCount: number;
  completedCount: number;
  availableBoardCount: number;
  recentEventCount: number;
  active: HarthmereMissionStepAudit[];
  nearbyAvailable: HarthmereMissionStepAudit[];
  recentEvents: unknown[];
  trace: HarthmereMissionTraceEvent[];
  issues: string[];
}

interface HarthmereAutoSurveySample {
  atMs: number;
  elapsedMs: number;
  area: string;
  position?: Vec3;
  playerFeetY?: number;
  terrain: {
    center?: HarthmereTerrainColumnSample;
    probes: HarthmereTerrainColumnSample[];
    missingColumns: number;
    playerFootDelta?: number;
  };
  npcs: {
    nearbyCount: number;
    offGroundCount: number;
    buriedCount: number;
    floatingCount: number;
    worst: HarthmereNpcGroundSample[];
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
  mission?: HarthmereMissionAudit;
}

function round(value: number, places = 2) {
  const m = 10 ** places;
  return Number.isFinite(value) ? Math.round(value * m) / m : value;
}

function roundVec3(value: Vec3 | undefined): Vec3 | undefined {
  if (!value) return undefined;
  return [round(value[0]), round(value[1]), round(value[2])] as Vec3;
}

function terrainBlockInfo(
  ctx: ReturnType<typeof useClientContext>,
  x: number,
  y: number,
  z: number
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

function sampleTerrainColumn(
  ctx: ReturnType<typeof useClientContext>,
  x: number,
  z: number,
  aroundY: number,
  scanUp = 10,
  scanDown = 48
): HarthmereTerrainColumnSample {
  const sampledFromY = Math.floor(aroundY + scanUp);
  const sampledToY = Math.floor(aroundY - scanDown);
  let terrainLoaded = false;
  let solidBlocksChecked = 0;
  let emptyBlocksChecked = 0;
  let unloadedBlocksChecked = 0;
  for (let y = sampledFromY; y >= sampledToY; y--) {
    const info = terrainBlockInfo(ctx, x, y, z);
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

function distance(a: Vec3, b: Vec3) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function npcGroundTolerance(label: string) {
  const normalized = label.toLowerCase();
  if (/chirp|bird|bat|wisp|sprite|moth/.test(normalized)) {
    return { buried: -2.25, floating: 6.5 };
  }
  if (/muckling|mucker|hexer|halide/.test(normalized)) {
    return { buried: -1.5, floating: 2.75 };
  }
  return { buried: -1.25, floating: 2.75 };
}

function collectNpcGroundSamples(
  ctx: ReturnType<typeof useClientContext>,
  playerPos: Vec3 | undefined,
  radius: number
): HarthmereNpcGroundSample[] {
  const out: HarthmereNpcGroundSample[] = [];
  for (const entity of ctx.table.scan(NpcMetadataSelector.query.all())) {
    const position = entity.position?.v
      ? ([...entity.position.v] as Vec3)
      : undefined;
    const label = entityLabel(entity);
    const area = snapshotAreaForPosition(position);
    const distance =
      position && playerPos ? distance(position, playerPos) : undefined;
    if (distance !== undefined && distance > radius) continue;
    if (!position) {
      out.push({
        id: entity.id as BiomesId,
        label,
        area,
        issue: "missing_position",
      });
      continue;
    }
    const column = sampleTerrainColumn(
      ctx,
      position[0],
      position[2],
      position[1],
      16,
      64
    );
    const expectedFeetY = column.feetY;
    const footDelta =
      expectedFeetY === undefined ? undefined : position[1] - expectedFeetY;
    const tolerance = npcGroundTolerance(label);
    const issue =
      expectedFeetY === undefined || footDelta === undefined
        ? "terrain_unloaded"
        : footDelta < tolerance.buried
          ? "buried"
          : footDelta > tolerance.floating
            ? "floating"
            : undefined;
    out.push({
      id: entity.id as BiomesId,
      label,
      position: roundVec3(position),
      distance: distance === undefined ? undefined : round(distance),
      area,
      groundBlockY: column.groundBlockY,
      expectedFeetY,
      footDelta: footDelta === undefined ? undefined : round(footDelta),
      issue,
    });
  }
  return out.sort((a, b) => {
    const ai = a.issue ? 0 : 1;
    const bi = b.issue ? 0 : 1;
    if (ai !== bi) return ai - bi;
    return (
      (a.distance ?? Number.POSITIVE_INFINITY) -
      (b.distance ?? Number.POSITIVE_INFINITY)
    );
  });
}

function renderedMuckerHexerActors(): Array<{
  id?: BiomesId;
  label: string;
  position?: Vec3;
  rendered: boolean;
}> {
  if (typeof window === "undefined") return [];
  const win = window as typeof window & {
    __harthmereVoxelNpcMotionActorPositions?: Record<string, unknown>;
    __harthmereEcsNpcCombatActorPositions?: Record<string, unknown>;
  };
  const records = new Map<
    string,
    { id?: BiomesId; label: string; position?: Vec3; rendered: boolean }
  >();
  const readSource = (
    raw: Record<string, unknown> | undefined,
    rendered: boolean
  ) => {
    if (!raw || typeof raw !== "object") return;
    for (const [key, value] of Object.entries(raw)) {
      if (!value || typeof value !== "object") continue;
      const actor = value as Record<string, unknown>;
      const label = String(actor.label ?? "");
      if (!snapshotLabelIsMuckerOrHexer(label)) continue;
      const world = Array.isArray(actor.world) ? actor.world : undefined;
      const x = Number(world?.[0]);
      const y = Number(world?.[1]);
      const z = Number(world?.[2]);
      const id = Number(actor.id ?? actor.entityId ?? key) as BiomesId;
      records.set(key, {
        id: Number.isFinite(Number(id)) ? id : undefined,
        label,
        position:
          Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)
            ? ([x, y, z] as Vec3)
            : undefined,
        rendered,
      });
    }
  };
  // Prefer renderer-published position because the visual grounding fix happens
  // in the renderer before the authoritative ECS combat registry catches up.
  readSource(win.__harthmereEcsNpcCombatActorPositions, false);
  readSource(win.__harthmereVoxelNpcMotionActorPositions, true);
  return Array.from(records.values());
}

function collectMuckerHexerTileClearance(
  ctx: ReturnType<typeof useClientContext>,
  playerPos: Vec3 | undefined,
  radius = 128
): HarthmereMuckerHexerTileClearanceSample[] {
  const actors = renderedMuckerHexerActors();
  const out: HarthmereMuckerHexerTileClearanceSample[] = [];
  for (const actor of actors) {
    const distance =
      actor.position && playerPos
        ? distance(actor.position, playerPos)
        : undefined;
    if (distance !== undefined && distance > radius) continue;
    const column = actor.position
      ? sampleTerrainColumn(
          ctx,
          actor.position[0],
          actor.position[2],
          actor.position[1],
          10,
          72
        )
      : undefined;
    const verdict = snapshotMuckerHexerTileClearancePass({
      label: actor.label,
      actorFeetY: actor.position?.[1],
      tileFeetY: column?.feetY,
    });
    out.push({
      version: SNAPSHOT_MUCKER_HEXER_TILE_CLEARANCE_VERSION,
      id: actor.id,
      label: actor.label,
      position: roundVec3(actor.position),
      rendered: actor.rendered,
      groundBlockY: column?.groundBlockY,
      expectedFeetY: column?.feetY,
      clearance: verdict.clearance,
      pass: verdict.pass,
      reason: verdict.reason,
    });
  }
  return out.sort((a, b) => Number(a.pass) - Number(b.pass));
}

function muckerHexerTileClearanceSummary(
  samples: HarthmereMuckerHexerTileClearanceSample[]
) {
  const failures = samples.filter((sample) => !sample.pass);
  const clearances = samples
    .map((sample) => sample.clearance)
    .filter((value): value is number => Number.isFinite(value));
  return {
    version: SNAPSHOT_MUCKER_HEXER_TILE_CLEARANCE_VERSION,
    total: samples.length,
    failures: failures.length,
    pass: samples.length > 0 && failures.length === 0,
    minClearance: clearances.length ? Math.min(...clearances) : undefined,
    maxClearance: clearances.length ? Math.max(...clearances) : undefined,
    worst: failures.slice(0, 12),
  };
}

function collisionDensity(
  ctx: ReturnType<typeof useClientContext>,
  position: Vec3 | undefined,
  radius = 8,
  verticalBelow = 3,
  verticalAbove = 5
) {
  if (!position) {
    return {
      checkedBlocks: 0,
      solidBlocks: 0,
      occupancyBlocks: 0,
      unloadedBlocks: 0,
      density: 0,
      nearbyNpcCount: 0,
      nearbyEntityCount: 0,
    };
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
        const info = terrainBlockInfo(ctx, x, y, z);
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
  const tableContents = ((ctx.table as any).contents?.() ??
    []) as ReadonlyEntity[];
  for (const entity of tableContents) {
    const ep = entity.position?.v
      ? ([...entity.position.v] as Vec3)
      : undefined;
    if (!ep || distance(ep, position) > radius * 2) continue;
    nearbyEntityCount++;
    if (entity.npc_metadata) nearbyNpcCount++;
  }
  return {
    checkedBlocks,
    solidBlocks,
    occupancyBlocks,
    unloadedBlocks,
    density: checkedBlocks ? round(solidBlocks / checkedBlocks, 3) : 0,
    nearbyNpcCount,
    nearbyEntityCount,
  };
}

function terrainStreamingStatus(
  ctx: ReturnType<typeof useClientContext>,
  position: Vec3 | undefined,
  radius = 96
) {
  if (!position) {
    return {
      checkedShards: 0,
      missingTerrainShards: 0,
      missingCombinedMeshShards: 0,
      missingShardCenters: [] as Vec3[],
    };
  }
  const centerShard = voxelToShardPos(...position);
  const shardRadius = Math.ceil(radius / 32);
  let checkedShards = 0;
  let missingTerrainShards = 0;
  let missingCombinedMeshShards = 0;
  const missingShardCenters: Vec3[] = [];

  // current: only audit the ground/player-feet shard band. The previous +/-1 Y
  // shard scan counted high air/roof bands around the player as missing terrain
  // and produced noisy warnings like 60/147 missing shards even when the ground
  // column was loaded. Missing sky shards are not what makes the town slow or
  // unnavigable; missing ground shards are.
  const sy = centerShard[1];

  for (
    let sx = centerShard[0] - shardRadius;
    sx <= centerShard[0] + shardRadius;
    sx++
  ) {
    for (
      let sz = centerShard[2] - shardRadius;
      sz <= centerShard[2] + shardRadius;
      sz++
    ) {
      const centerX = sx * 32 + 16;
      const centerZ = sz * 32 + 16;
      if (
        Math.hypot(centerX - position[0], centerZ - position[2]) >
        radius + 16
      )
        continue;

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
          missingShardCenters.push([centerX, sy * 32 + 16, centerZ] as Vec3);
        }
      }
      if (!mesh) missingCombinedMeshShards++;
    }
  }
  return {
    checkedShards,
    missingTerrainShards,
    missingCombinedMeshShards,
    missingShardCenters,
  };
}

function slowResourceStats(previousCount: number) {
  const resources = performance.getEntriesByType("resource");
  const slowResourceCount = resources.filter(
    (entry) => entry.duration > 250
  ).length;
  return {
    resourceCount: resources.length,
    newResourceCount: Math.max(0, resources.length - previousCount),
    slowResourceCount,
  };
}

function normalizeMissionText(value: string | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function documentText() {
  if (typeof document === "undefined") return "";
  return normalizeMissionText(document.body?.innerText ?? "");
}

function readMissionEvents(): unknown[] {
  if (
    typeof window === "undefined" ||
    typeof window.localStorage === "undefined"
  )
    return [];
  try {
    const raw = window.localStorage.getItem(HARTHMERE_MISSION_EVENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, 20) : [];
  } catch {
    return [];
  }
}

function missionStatus(
  quest: HarthmereQuestDefinition,
  state: HarthmereQuestState
) {
  if (state.completed.includes(quest.id)) return "completed" as const;
  const stepIndex = state.active[quest.id];
  if (stepIndex === undefined) return "available" as const;
  if (stepIndex < 0 || stepIndex >= quest.steps.length)
    return "invalid" as const;
  return stepIndex >= quest.steps.length - 1
    ? ("ready" as const)
    : ("active" as const);
}

function missionAuditTargetOffset(
  quest: HarthmereQuestDefinition,
  status: ReturnType<typeof missionStatus>,
  step: HarthmereQuestDefinition["steps"][number] | undefined
) {
  // Keep the audit aligned with the mission HUD: available quests should be
  // audited against the first actual objective, not the board that listed them.
  if (status === "available") {
    return (
      quest.steps[0]?.targetOffset ??
      quest.giverOffsets.find((offset) => QUEST_TARGETS[offset]) ??
      41
    );
  }
  return (
    step?.targetOffset ??
    quest.steps[0]?.targetOffset ??
    quest.giverOffsets.find((offset) => QUEST_TARGETS[offset]) ??
    41
  );
}

function missionTargetLabelMatch(
  entityLabel: string,
  targetLabel: string | undefined
) {
  const entity = normalizeMissionText(entityLabel);
  const target = normalizeMissionText(targetLabel);
  if (!entity || !target) return false;
  if (entity.includes(target) || target.includes(entity)) return true;
  const targetWords = target.split(" ").filter((word) => word.length >= 4);
  if (!targetWords.length) return false;
  const matches = targetWords.filter((word) => entity.includes(word)).length;
  return matches >= Math.min(2, targetWords.length);
}

function collectMissionTargetCandidates(
  ctx: ReturnType<typeof useClientContext>,
  targetPos: Vec3 | undefined,
  targetLabel: string | undefined,
  radius = 18
): HarthmereMissionTargetCandidate[] {
  if (!targetPos) return [];
  const candidates: HarthmereMissionTargetCandidate[] = [];
  for (const entity of ctx.table.scan(NpcMetadataSelector.query.all())) {
    const position = entity.position?.v
      ? ([...entity.position.v] as Vec3)
      : undefined;
    if (!position) continue;
    const distance = distance(position, targetPos);
    if (distance > radius) continue;
    const label = entityLabel(entity);
    candidates.push({
      id: entity.id as BiomesId,
      label,
      position: roundVec3(position),
      distance: round(distance),
      labelMatch: missionTargetLabelMatch(label, targetLabel),
    });
  }
  return candidates
    .sort(
      (a, b) =>
        (b.labelMatch ? 1 : 0) - (a.labelMatch ? 1 : 0) ||
        (a.distance ?? 999) - (b.distance ?? 999)
    )
    .slice(0, 8);
}

function auditMissionQuest(
  ctx: ReturnType<typeof useClientContext>,
  quest: HarthmereQuestDefinition,
  state: HarthmereQuestState,
  playerPos: Vec3 | undefined,
  bodyText: string
): HarthmereMissionStepAudit {
  const status = missionStatus(quest, state);
  const stepIndex = state.active[quest.id] ?? 0;
  const step = quest.steps[stepIndex];
  const targetOffset = missionAuditTargetOffset(quest, status, step);
  const target =
    targetOffset === undefined ? undefined : QUEST_TARGETS[targetOffset];
  const targetPos = target
    ? (getHarthmereQuestTargetWorldPos(target) as Vec3)
    : undefined;
  const targetTerrain = targetPos
    ? sampleTerrainColumn(
        ctx,
        targetPos[0],
        targetPos[2],
        targetPos[1],
        24,
        80
      )
    : undefined;
  const targetFootDelta =
    targetPos && targetTerrain?.feetY !== undefined
      ? targetPos[1] - targetTerrain.feetY
      : undefined;
  const nearbyTargets = collectMissionTargetCandidates(
    ctx,
    targetPos,
    target?.label
  );
  const distance =
    playerPos && targetPos ? distance(playerPos, targetPos) : undefined;
  const titleNeedle = normalizeMissionText(quest.title);
  const objectiveNeedle = normalizeMissionText(step?.objective);
  const targetNeedle = normalizeMissionText(target?.label);
  const completeNeedle = normalizeMissionText(`complete ${quest.title}`);
  const acceptNeedle = normalizeMissionText(`accept ${quest.title}`);
  const textChecks: HarthmereMissionTextChecks = {
    titleVisible: !!titleNeedle && bodyText.includes(titleNeedle),
    objectiveVisible: !objectiveNeedle || bodyText.includes(objectiveNeedle),
    targetVisible:
      !targetNeedle ||
      bodyText.includes(targetNeedle) ||
      nearbyTargets.some((candidate) => candidate.labelMatch),
    actionVisible:
      status === "available"
        ? bodyText.includes(acceptNeedle)
        : status === "ready"
          ? bodyText.includes(completeNeedle)
          : true,
  };
  const issues: string[] = [];
  if (status === "invalid")
    issues.push("mission step index is outside quest step list");
  if (!step && status !== "completed")
    issues.push("mission has no current step definition");
  if (!target)
    issues.push(
      `missing QUEST_TARGETS entry for offset ${targetOffset ?? "unknown"}`
    );
  if (targetPos && targetTerrain?.feetY === undefined)
    issues.push("mission target terrain is not loaded");
  if (targetFootDelta !== undefined && Math.abs(targetFootDelta) > 16) {
    issues.push(
      `mission target Y looks wrong; target delta is ${round(targetFootDelta)} blocks`
    );
  }
  if ((status === "active" || status === "ready") && !textChecks.titleVisible) {
    issues.push("mission title is not visible in current UI text");
  }
  if (
    (status === "active" || status === "ready") &&
    !textChecks.objectiveVisible
  ) {
    issues.push("mission objective text is not visible in current UI text");
  }
  if (
    (status === "active" || status === "ready") &&
    !textChecks.targetVisible
  ) {
    issues.push(
      "mission target label/person/item is not visible or loaded near the marker"
    );
  }
  if (distance !== undefined && distance <= 8 && !textChecks.actionVisible) {
    issues.push(
      "player is near mission target but expected Accept/Complete action text is not visible"
    );
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
    targetPos: roundVec3(targetPos),
    distance: distance === undefined ? undefined : round(distance),
    targetTerrain,
    targetFootDelta:
      targetFootDelta === undefined ? undefined : round(targetFootDelta),
    nearbyTargets,
    textChecks,
    issues,
  };
}

function appendMissionTraceEvents(
  state: HarthmereQuestState,
  previousState: HarthmereQuestState | undefined,
  trace: HarthmereMissionTraceEvent[],
  position: Vec3 | undefined
) {
  if (!previousState) return trace;
  const nextTrace = [...trace];
  for (const quest of QUESTS) {
    const before = previousState.active[quest.id];
    const after = state.active[quest.id];
    const wasCompleted = previousState.completed.includes(quest.id);
    const isCompleted = state.completed.includes(quest.id);
    let kind: HarthmereMissionTraceEvent["kind"] | undefined;
    if (before === undefined && after !== undefined) kind = "accepted";
    else if (before !== undefined && after !== undefined && before !== after)
      kind = "advanced";
    else if (
      before !== undefined &&
      after === undefined &&
      isCompleted &&
      !wasCompleted
    )
      kind = "completed";
    else if (before !== undefined && after === undefined && !isCompleted)
      kind = "abandoned";
    if (kind) {
      nextTrace.unshift({
        atMs: Date.now(),
        kind,
        questId: quest.id,
        title: quest.title,
        fromStep: before,
        toStep: after,
        position: roundVec3(position),
        area: snapshotAreaForPosition(position),
      });
    }
  }
  return nextTrace.slice(0, 100);
}

export const SnapshotLiveDiagnosticsRuntimeController: React.FunctionComponent<{}> =
  () => {
    const ctx = useClientContext();
    const samplesRef = useRef<SnapshotPerformanceSample[]>([]);
    const autoSurveySamplesRef = useRef<HarthmereAutoSurveySample[]>([]);
    const autoSurveyStartedAtRef = useRef<number | undefined>(undefined);
    const autoSurveyRunningRef = useRef(false);
    const autoSurveyResourceCountRef = useRef(0);
    const marksRef = useRef<
      Array<{ atMs: number; label: string; position?: Vec3; area: string }>
    >([]);
    const missionTraceRef = useRef<HarthmereMissionTraceEvent[]>([]);
    const previousMissionStateRef = useRef<HarthmereQuestState | undefined>(
      undefined
    );
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

    const captureMissionAudit = (
      position?: Vec3
    ): HarthmereMissionAudit => {
      const state = readHarthmereQuestState();
      missionTraceRef.current = appendMissionTraceEvents(
        state,
        previousMissionStateRef.current,
        missionTraceRef.current,
        position
      );
      previousMissionStateRef.current = state;
      const bodyText = documentText();
      const activeQuests = QUESTS.filter(
        (quest) =>
          state.active[quest.id] !== undefined ||
          state.completed.includes(quest.id)
      );
      const active = activeQuests
        .filter((quest) => !state.completed.includes(quest.id))
        .map((quest) =>
          auditMissionQuest(ctx, quest, state, position, bodyText)
        );
      const available = QUESTS.filter(
        (quest) =>
          state.active[quest.id] === undefined &&
          !state.completed.includes(quest.id) &&
          quest.boardListed
      )
        .map((quest) =>
          auditMissionQuest(ctx, quest, state, position, bodyText)
        )
        .sort((a, b) => (a.distance ?? 9999) - (b.distance ?? 9999))
        .slice(0, 8);
      const recentEvents = readMissionEvents();
      const issues = [
        ...active.flatMap((entry) =>
          entry.issues.map((issue) => `${entry.title}: ${issue}`)
        ),
      ];
      if (
        active.length &&
        recentEvents.length === 0 &&
        missionTraceRef.current.length === 0
      ) {
        issues.push(
          "active mission exists but no mission event/trace history was recorded"
        );
      }
      return {
        version: HARTHMERE_MISSION_AUDIT_VERSION,
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
    }): HarthmereAutoSurveySample => {
      if (autoSurveyStartedAtRef.current === undefined) {
        autoSurveyStartedAtRef.current = Date.now();
      }
      // HARTHMERE_PERF_AND_PLACEMENT — survey is now lighter by default.
      // The current capture at fps:6 had 56-block NPC scans and 72-block streaming
      // scans every tick, which made the audit itself a perf contributor.
      const npcRadius = opts?.npcRadius ?? HARTHMERE_SURVEY_NPC_SCAN_RADIUS;
      const terrainProbeRadius = opts?.terrainProbeRadius ?? 16;
      const collisionRadius = opts?.collisionRadius ?? 8;
      const streamingRadius = opts?.streamingRadius ?? 56;
      const frames = framesRef.current;
      const avgFrameMs = frames.length
        ? frames.reduce((a, b) => a + b, 0) / frames.length
        : 0;
      const maxFrameMs = frames.length ? Math.max(...frames) : 0;
      const fps = avgFrameMs > 0 ? 1000 / avgFrameMs : 0;
      const position = localPlayerPosition(ctx);
      const area = snapshotAreaForPosition(position);
      const aroundY = position?.[1] ?? 70;
      const terrainProbes = position
        ? [
            [position[0], position[2]],
            [position[0] + terrainProbeRadius, position[2]],
            [position[0] - terrainProbeRadius, position[2]],
            [position[0], position[2] + terrainProbeRadius],
            [position[0], position[2] - terrainProbeRadius],
          ].map(([x, z]) => sampleTerrainColumn(ctx, x, z, aroundY))
        : [];
      const center = terrainProbes[0];
      const playerFootDelta =
        position && center?.feetY !== undefined
          ? position[1] - center.feetY
          : undefined;
      const npcSamples = collectNpcGroundSamples(ctx, position, npcRadius);
      // HARTHMERE_PERF_AND_PLACEMENT — split town residents (the audit
      // target) from wandering wilds creatures whose foot-Y legitimately
      // changes as they walk. Both are still recorded for download, but only
      // the town count drives the user-facing warning.
      const offGroundAll = npcSamples.filter((npc) => !!npc.issue);
      const offGroundTown = offGroundAll.filter(
        (npc) => !isHarthmereWanderingNpcLabel(npc.label)
      );
      const offGroundWandering = offGroundAll.filter((npc) =>
        isHarthmereWanderingNpcLabel(npc.label)
      );
      const offGroundNpcs = offGroundTown; // legacy alias for downstream usage
      const collision = collisionDensity(ctx, position, collisionRadius);
      const terrainStreaming = terrainStreamingStatus(
        ctx,
        position,
        streamingRadius
      );
      const resourceStats = slowResourceStats(
        autoSurveyResourceCountRef.current
      );
      autoSurveyResourceCountRef.current = resourceStats.resourceCount;
      const mission = captureMissionAudit(position);
      const warnings: string[] = [];
      if (playerFootDelta !== undefined && Math.abs(playerFootDelta) > 2.5) {
        warnings.push(
          `player foot delta ${round(playerFootDelta)} from terrain feet ${center?.feetY}`
        );
      }
      if (offGroundTown.length) {
        warnings.push(
          `${offGroundTown.length} town NPCs are buried/floating/unloaded (current)`
        );
      }
      // Wandering wilds creatures are tracked separately and only warned about
      // if the count is large enough to suggest a real placement bug rather
      // than normal motion sampling noise.
      if (offGroundWandering.length > 20) {
        warnings.push(
          `${offGroundWandering.length} wandering wilds creatures off-ground (current — likely motion sampling, not a town bug)`
        );
      }
      if (maxFrameMs > 80) {
        warnings.push(
          `slow frame ${round(maxFrameMs)}ms near ${roundVec3(position)?.join(",") ?? "unknown"}`
        );
      }
      if (terrainStreaming.missingTerrainShards > 0) {
        warnings.push(
          `${terrainStreaming.missingTerrainShards}/${terrainStreaming.checkedShards} nearby terrain shards missing`
        );
      }
      if (
        terrainStreaming.missingCombinedMeshShards >
        terrainStreaming.checkedShards * 0.4
      ) {
        warnings.push(
          `${terrainStreaming.missingCombinedMeshShards}/${terrainStreaming.checkedShards} nearby combined meshes missing`
        );
      }
      if (
        collision.density > 0.65 &&
        (Math.abs(playerFootDelta ?? 0) > 2.5 ||
          collision.nearbyNpcCount > 2 ||
          collision.occupancyBlocks > 16)
      ) {
        warnings.push(
          `high nearby solid collision density ${collision.density}`
        );
      }
      if (mission.issues.length) {
        warnings.push(`${mission.issues.length} active mission audit issues`);
      }
      const sample: HarthmereAutoSurveySample = {
        atMs: Date.now(),
        elapsedMs: Date.now() - autoSurveyStartedAtRef.current,
        area,
        position: roundVec3(position),
        playerFeetY: position ? round(position[1]) : undefined,
        terrain: {
          center,
          probes: terrainProbes,
          missingColumns: terrainProbes.filter(
            (probe) => probe.feetY === undefined
          ).length,
          playerFootDelta:
            playerFootDelta === undefined
              ? undefined
              : round(playerFootDelta),
        },
        npcs: {
          nearbyCount: npcSamples.length,
          // current: offGroundCount continues to mean the *town* count (the one
          // that historically drove the warning string). The wandering count
          // is exposed via the new `offGroundWanderingCount` field so callers
          // and check scripts can still see it.
          offGroundCount: offGroundTown.length,
          buriedCount: offGroundTown.filter((npc) => npc.issue === "buried")
            .length,
          floatingCount: offGroundTown.filter((npc) => npc.issue === "floating")
            .length,
          worst: offGroundTown.slice(0, 12),
          offGroundWanderingCount: offGroundWandering.length,
          worstWandering: offGroundWandering.slice(0, 6),
        } as HarthmereAutoSurveySample["npcs"] & {
          offGroundWanderingCount?: number;
          worstWandering?: HarthmereNpcGroundSample[];
        },
        collision,
        terrainStreaming,
        performance: {
          fps: Number(fps.toFixed(1)),
          avgFrameMs: Number(avgFrameMs.toFixed(2)),
          maxFrameMs: Number(maxFrameMs.toFixed(2)),
          longTaskCount: longTaskCountRef.current,
          heapUsedMb: heapUsedMb(),
          ...resourceStats,
        },
        warnings,
        mission,
      };
      autoSurveySamplesRef.current.push(sample);
      // HARTHMERE_PERF_AND_PLACEMENT — keep retained samples small to stop
      // the survey itself from being a perf cliff. 60 samples at 5 sec/sample
      // is 5 minutes of recent capture, which is plenty for download analysis.
      if (
        autoSurveySamplesRef.current.length >
        HARTHMERE_SURVEY_RAW_SAMPLE_CAP
      ) {
        autoSurveySamplesRef.current.splice(
          0,
          autoSurveySamplesRef.current.length -
            HARTHMERE_SURVEY_RAW_SAMPLE_CAP
        );
      }
      if (warnings.length && autoSurveyRunningRef.current) {
        const lastWarn =
          (window as any).__harthmereAutoSurveyLastWarnAt ?? 0;
        if (Date.now() - lastWarn > 15000) {
          (window as any).__harthmereAutoSurveyLastWarnAt = Date.now();
          // BIOMES_AUTO_SURVEY_CONSOLE_QUIET
          // Recent compact samples are still stored in the downloaded report. Keep the
          // live console readable while profiling by logging only the summary.
          console.warn("[HarthmereAutoSurvey]", {
            warnings,
            area: sample.area,
            position: sample.position,
            fps: sample.performance.fps,
            avgFrameMs: sample.performance.avgFrameMs,
            offGroundNpcs: sample.npcs.offGroundCount,
            collisionDensity: sample.collision.density,
            missingTerrainShards: sample.terrainStreaming.missingTerrainShards,
            missingCombinedMeshShards:
              sample.terrainStreaming.missingCombinedMeshShards,
            activeMissionIssues: sample.mission?.issues.length ?? 0,
          });
        }
      }
      return sample;
    };

    const captureSample = () => {
      const frames = framesRef.current;
      const avgFrameMs = frames.length
        ? frames.reduce((a, b) => a + b, 0) / frames.length
        : 0;
      const maxFrameMs = frames.length ? Math.max(...frames) : 0;
      const fps = avgFrameMs > 0 ? 1000 / avgFrameMs : 0;
      const position = localPlayerPosition(ctx);
      const audit = collectLiveNpcAudit(ctx);
      const nearbyNpcCount = audit.filter((record) => {
        if (!record.position || !position) return false;
        const dx = record.position[0] - position[0];
        const dy = record.position[1] - position[1];
        const dz = record.position[2] - position[2];
        return Math.sqrt(dx * dx + dy * dy + dz * dz) <= 40;
      }).length;
      const sample: SnapshotPerformanceSample = {
        atMs: Date.now(),
        area: snapshotAreaForPosition(position),
        position,
        fps: Number(fps.toFixed(1)),
        avgFrameMs: Number(avgFrameMs.toFixed(2)),
        maxFrameMs: Number(maxFrameMs.toFixed(2)),
        longTaskCount: longTaskCountRef.current,
        heapUsedMb: heapUsedMb(),
        nearbyNpcCount,
        floatingNpcCount: audit.filter(
          (record) =>
            record.action === "visual_grounded" ||
            record.action === "needs_server_remap"
        ).length,
        visibleResourceCount: visibleResourceCount(),
      };
      samplesRef.current = [...samplesRef.current, sample].slice(-1800);
      return sample;
    };

    const report = () => {
      const samples = samplesRef.current;
      const byArea = new Map<string, SnapshotPerformanceSample[]>();
      for (const sample of samples) {
        byArea.set(sample.area, [...(byArea.get(sample.area) ?? []), sample]);
      }
      const areaReports = [...byArea.entries()].map(([area, areaSamples]) => {
        const avgFps =
          areaSamples.reduce((sum, sample) => sum + sample.fps, 0) /
          Math.max(1, areaSamples.length);
        const worst = [...areaSamples].sort(
          (a, b) => b.maxFrameMs - a.maxFrameMs
        )[0];
        return {
          area,
          samples: areaSamples.length,
          avgFps: Number(avgFps.toFixed(1)),
          worstFrameMs: worst?.maxFrameMs ?? 0,
          worstPosition: worst?.position,
          floatingNpcCount: Math.max(
            ...areaSamples.map((sample) => sample.floatingNpcCount),
            0
          ),
          nearbyNpcHighWater: Math.max(
            ...areaSamples.map((sample) => sample.nearbyNpcCount),
            0
          ),
        };
      });
      const resources = performance
        .getEntriesByType("resource")
        .map((entry) => ({
          name: entry.name,
          duration: Number(entry.duration.toFixed(1)),
          startTime: Number(entry.startTime.toFixed(1)),
        }))
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 25);
      return {
        version: SNAPSHOT_WALK_PERFORMANCE_PROFILER_VERSION,
        running: runningRef.current,
        samples: samples.length,
        marks: marksRef.current,
        areas: areaReports,
        slowResources: resources,
        floatingAudit: snapshotLiveNpcAuditSummary(
          collectLiveNpcAudit(ctx)
        ),
        navigation:
          performance.getEntriesByType("navigation")[0]?.toJSON?.() ??
          undefined,
      };
    };

    const autoSurveyReport = () => {
      const samples = autoSurveySamplesRef.current;
      const warningSamples = samples.filter(
        (sample) => sample.warnings.length > 0
      );
      const worstFrames = [...samples]
        .sort((a, b) => b.performance.maxFrameMs - a.performance.maxFrameMs)
        .slice(0, HARTHMERE_SURVEY_WORST_FRAME_CAP)
        .map((sample) => ({
          atMs: sample.atMs,
          elapsedMs: sample.elapsedMs,
          area: sample.area,
          position: sample.position,
          maxFrameMs: sample.performance.maxFrameMs,
          fps: sample.performance.fps,
          warnings: sample.warnings,
        }));
      const offGroundNpcs = new Map<string, HarthmereNpcGroundSample>();
      for (const sample of samples) {
        for (const npc of sample.npcs.worst) {
          offGroundNpcs.set(String(npc.id), npc);
        }
      }
      const highCollision = [...samples]
        .sort((a, b) => b.collision.density - a.collision.density)
        .slice(0, HARTHMERE_SURVEY_WORST_FRAME_CAP)
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
        .filter(
          (sample) =>
            sample.terrainStreaming.missingTerrainShards > 0 ||
            sample.terrainStreaming.missingCombinedMeshShards > 0
        )
        .slice(-HARTHMERE_SURVEY_OFF_GROUND_TOWN_REPORT_CAP)
        .map((sample) => ({
          atMs: sample.atMs,
          elapsedMs: sample.elapsedMs,
          area: sample.area,
          position: sample.position,
          checkedShards: sample.terrainStreaming.checkedShards,
          missingTerrainShards: sample.terrainStreaming.missingTerrainShards,
          missingCombinedMeshShards:
            sample.terrainStreaming.missingCombinedMeshShards,
          missingShardCenters: sample.terrainStreaming.missingShardCenters,
        }));
      const missionProblems = samples
        .filter((sample) => (sample.mission?.issues.length ?? 0) > 0)
        .slice(-HARTHMERE_SURVEY_OFF_GROUND_TOWN_REPORT_CAP)
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
        version: HARTHMERE_AUTO_SURVEY_VERSION,
        running: autoSurveyRunningRef.current,
        samples: samples.length,
        startedAtMs: autoSurveyStartedAtRef.current,
        latest: samples.at(-1),
        warningCount: warningSamples.length,
        latestWarnings: warningSamples.slice(-8),
        worstFrames,
        offGroundNpcs: [...offGroundNpcs.values()]
          .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))
          .slice(0, HARTHMERE_SURVEY_OFF_GROUND_TOWN_REPORT_CAP),
        highCollision,
        streamingProblems,
        missionTrace: missionTraceRef.current,
        missionProblems,
        latestMission:
          samples.at(-1)?.mission ??
          captureMissionAudit(localPlayerPosition(ctx)),
        rawSampleTruncated: samples.length > 60,
        rawSamples: samples.slice(-60),
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
        const position = localPlayerPosition(ctx);
        const entry = {
          atMs: Date.now(),
          label,
          position,
          area: snapshotAreaForPosition(position),
        };
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
        const intervalMs = Math.max(750, opts?.intervalMs ?? 1500);
        autoSurveyRunningRef.current = true;
        autoSurveyStartedAtRef.current ??= Date.now();
        autoSurveyResourceCountRef.current =
          performance.getEntriesByType("resource").length;
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
        // HARTHMERE_PERF_AND_PLACEMENT — auto-throttle interval when fps
        // craters. The current capture showed 793 samples accrued in 14 minutes at
        // fps:6, with longTaskCount:5496. The survey doubled the perf wound it
        // was diagnosing. current watches the rolling fps and, if it falls below
        // 12 for 3 consecutive samples, multiplies the interval by 3 until the
        // fps recovers above 18. The user can override with explicit intervalMs.
        let throttledIntervalMs = intervalMs;
        let throttledSampleStreak = 0;
        const scheduleNext = () => {
          if (!autoSurveyRunningRef.current) return;
          autoSurveyIntervalRef.current = window.setTimeout(() => {
            if (!autoSurveyRunningRef.current) return;
            const sample = captureAutoSurveySample(sampleOpts);
            const fps = sample.performance.fps;
            if (fps > 0 && fps < 12) {
              throttledSampleStreak += 1;
            } else if (fps >= 18) {
              throttledSampleStreak = 0;
            }
            const desiredInterval =
              throttledSampleStreak >= 3 ? intervalMs * 3 : intervalMs;
            throttledIntervalMs = desiredInterval;
            scheduleNext();
          }, throttledIntervalMs) as unknown as number;
        };
        scheduleNext();
        console.info("[HarthmereAutoSurvey] started", {
          intervalMs,
          retention: HARTHMERE_SURVEY_RAW_SAMPLE_CAP,
          throttleWhenFpsBelow: 12,
          ...sampleOpts,
        });
        return autoSurveyReport();
      };
      const autoSurveyStop = () => {
        autoSurveyRunningRef.current = false;
        if (autoSurveyIntervalRef.current !== undefined) {
          // current: the runner now uses setTimeout chains, so clearTimeout is the
          // right cleanup. clearInterval is harmless on a setTimeout id.
          window.clearTimeout(autoSurveyIntervalRef.current);
          window.clearInterval(autoSurveyIntervalRef.current);
          autoSurveyIntervalRef.current = undefined;
        }
        console.info("[HarthmereAutoSurvey] stopped", autoSurveyReport());
        return autoSurveyReport();
      };
      const autoSurveyClear = () => {
        autoSurveySamplesRef.current = [];
        autoSurveyStartedAtRef.current = undefined;
        missionTraceRef.current = [];
        previousMissionStateRef.current = undefined;
        autoSurveyResourceCountRef.current =
          performance.getEntriesByType("resource").length;
        return autoSurveyReport();
      };
      const win = window as typeof window & {
        __snapshotPerf?: unknown;
        __snapshotDiagnostics?: unknown;
        __harthmereAutoSurvey?: unknown;
      };
      win.__snapshotPerf = {
        version: SNAPSHOT_WALK_PERFORMANCE_PROFILER_VERSION,
        start,
        stop,
        mark,
        clear,
        sample: captureSample,
        samples: () => samplesRef.current,
        report,
        tools: SNAPSHOT_PERFORMANCE_DEBUG_TOOLS,
        download: (filename = `snapshot-perf-walk-${Date.now()}.json`) =>
          downloadJson(filename, report()),
      };
      win.__snapshotDiagnostics = {
        version: SNAPSHOT_LIVE_DEBUG_PLAYER_SCOPE_VERSION,
        runFloatingAudit: () => collectLiveNpcAudit(ctx),
        terrainColumnAt: (x: number, z: number, aroundY = 54) =>
          sampleTerrainColumn(ctx, x, z, aroundY, 32, 96),
        floatingSummary: () =>
          snapshotLiveNpcAuditSummary(collectLiveNpcAudit(ctx)),
        muckerHexerGroundAudit: () =>
          collectMuckerHexerTileClearance(ctx, localPlayerPosition(ctx)),
        muckerHexerGroundSummary: () =>
          muckerHexerTileClearanceSummary(
            collectMuckerHexerTileClearance(
              ctx,
              localPlayerPosition(ctx)
            )
          ),
        remainingPortAudit: snapshotRemainingPortAudit,
        performanceTools: SNAPSHOT_PERFORMANCE_DEBUG_TOOLS,
        performanceReport: report,
        autoSurvey: autoSurveyReport,
        missionAudit: () =>
          captureMissionAudit(localPlayerPosition(ctx)),
        downloadMissionAudit: (
          filename = `harthmere-mission-audit-${Date.now()}.json`
        ) =>
          downloadJson(
            filename,
            captureMissionAudit(localPlayerPosition(ctx))
          ),
        downloadFloatingAudit: (
          filename = `snapshot-floating-npc-audit-${Date.now()}.json`
        ) => downloadJson(filename, collectLiveNpcAudit(ctx)),
        downloadMuckerHexerGroundAudit: (
          filename = `mucker-hexer-ground-audit-${Date.now()}.json`
        ) =>
          downloadJson(
            filename,
            collectMuckerHexerTileClearance(
              ctx,
              localPlayerPosition(ctx)
            )
          ),
      };
      win.__harthmereAutoSurvey = {
        version: HARTHMERE_AUTO_SURVEY_VERSION,
        start: autoSurveyStart,
        stop: autoSurveyStop,
        clear: autoSurveyClear,
        sample: captureAutoSurveySample,
        samples: () => autoSurveySamplesRef.current,
        report: autoSurveyReport,
        missionAudit: () => captureMissionAudit(localPlayerPosition(ctx)),
        downloadMissionAudit: (
          filename = `harthmere-mission-audit-${Date.now()}.json`
        ) =>
          downloadJson(
            filename,
            captureMissionAudit(localPlayerPosition(ctx))
          ),
        download: (filename = `harthmere-auto-survey-${Date.now()}.json`) =>
          downloadJson(filename, autoSurveyReport()),
        explain: () => ({
          terrain:
            "Scans terrain tensors above/below the player and nearby NPCs to find groundBlockY, expected feetY, and buried/floating deltas.",
          performance:
            "Records FPS, max frame time, long tasks, heap, new resources, slow resources, terrain/mesh shard readiness, and local collision density.",
          missions:
            "When a Harthmere mission starts or advances, records active quest state, target position, nearby loaded target NPCs, UI text visibility, objective/action text, and mission issues.",
          usage:
            "Run window.__harthmereAutoSurvey.start(); accept/advance a mission; walk to the marker; then run stop(), report(), or download(). Use start({npcRadius:96, streamingRadius:128}) only for a deeper audit pass.",
        }),
      };
      return () => {
        if (intervalRef.current !== undefined)
          window.clearInterval(intervalRef.current);
        if (autoSurveyIntervalRef.current !== undefined)
          window.clearInterval(autoSurveyIntervalRef.current);
      };
    }, [ctx]);

    return (
      <span
        className="hidden"
        data-snapshot-live-debug-player-scope={
          SNAPSHOT_LIVE_DEBUG_PLAYER_SCOPE_VERSION
        }
      />
    );
  };

export const SnapshotLiveGroundingAuditPanel: React.FunctionComponent<{}> =
  () => {
    const ctx = useClientContext();
    const [audit, setAudit] = useState<SnapshotLiveNpcAuditRecord[]>(() =>
      collectLiveNpcAudit(ctx)
    );

    useEffect(() => {
      const interval = window.setInterval(
        () => setAudit(collectLiveNpcAudit(ctx)),
        1500
      );
      return () => window.clearInterval(interval);
    }, [ctx]);

    const summary = useMemo(
      () => snapshotLiveNpcAuditSummary(audit),
      [audit]
    );
    const flagged = audit.filter(
      (entry) =>
        entry.action === "visual_grounded" ||
        entry.action === "needs_server_remap"
    );

    return (
      <div className="rounded border border-red-200/20 bg-red-950/30 p-2 text-white">
        <div className="text-sm font-semibold">Live NPC Foot Audit</div>
        <div className="text-[10px] uppercase tracking-wide text-red-100/80">
          {SNAPSHOT_LIVE_NPC_GROUNDING_VERSION}
        </div>
        <div className="mt-1 text-xs text-white/75">
          {summary.total} live NPCs scanned · visually grounded{" "}
          {summary.visualGrounded} · server remap {summary.needsServerRemap}
        </div>
        <div className="mt-1 text-[11px] text-white/60">
          Tolerance ≤ {SNAPSHOT_LIVE_NPC_MAX_FOOT_CLEARANCE}m for
          Grove-authored NPCs. Floating snapshot originals are grounded visually
          and reported by ID.
        </div>
        {!!flagged.length && (
          <div className="mt-1 text-[11px] text-red-100">
            {flagged
              .slice(0, 4)
              .map(
                (entry) =>
                  `${entry.label}: y=${entry.position?.[1]?.toFixed?.(2) ?? "?"}`
              )
              .join(" · ")}
          </div>
        )}
      </div>
    );
  };

export const SnapshotPerformanceWalkerPanel: React.FunctionComponent<{}> =
  () => {
    const [report, setReport] = useState<any>(() => undefined);
    useEffect(() => {
      const refresh = () => {
        const perf = (window as any).__snapshotPerf;
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
          {SNAPSHOT_WALK_PERFORMANCE_PROFILER_VERSION}
        </div>
        <div className="mt-1 text-xs text-white/75">
          Console: window.__harthmereAutoSurvey.start(); walk around; stop();
          download()
        </div>
        <div className="mt-1 text-[11px] text-white/60">
          Also available: window.__snapshotPerf.start(),
          mark(&quot;bad-collision&quot;), stop(), report(), download()
        </div>
        <div className="mt-1 text-[11px] text-white/60">
          Samples: {report?.samples ?? 0} · Worst area: {latest?.area ?? "none"}{" "}
          · Worst frame: {latest?.worstFrameMs ?? 0}ms · Floating NPCs:{" "}
          {report?.floatingAudit?.visualGrounded ?? 0}
        </div>
      </div>
    );
  };

export const SnapshotRemainingPortAuditPanel: React.FunctionComponent<{}> =
  () => {
    const audit = snapshotRemainingPortAudit();
    return (
      <div className="rounded border border-zinc-200/20 bg-zinc-950/30 p-2 text-white">
        <div className="text-sm font-semibold">
          Remaining Snapshot Port Audit
        </div>
        <div className="text-[10px] uppercase tracking-wide text-zinc-100/80">
          {SNAPSHOT_REMAINING_PORT_AUDIT_VERSION}
        </div>
        <div className="mt-1 text-xs text-white/75">
          {audit.openCount} follow-up production QA items remain.
        </div>
        <div className="mt-1 text-[11px] text-white/60">
          {audit.items
            .slice(0, 3)
            .map((item) => `${item.area}: ${item.status}`)
            .join(" · ")}
        </div>
      </div>
    );
  };
