// SNAPSHOT_LIVE_DEBUG_PLAYER_SCOPE_V78
// Final snapshot-debug pass for live NPC foot clearance, per-player mission state,
// and walk-around performance profiling across The Grove and Harthmere.

import type { BiomesId } from "@/shared/ids";
import type { ReadonlyVec3, Vec3 } from "@/shared/math/types";
import {
  SNAPSHOT_GROVE_LIVE_NPC_FEET_Y_V83,
  SNAPSHOT_GROVE_NPC_FEET_Y_V75,
  SNAPSHOT_GROVE_NPCS_V75,
} from "@/shared/harthmere/snapshot_grove_content_v75";

export const SNAPSHOT_LIVE_DEBUG_PLAYER_SCOPE_VERSION_V78 =
  "snapshot-live-debug-player-scope-v78" as const;
export const SNAPSHOT_PER_PLAYER_MISSION_STATE_VERSION_V78 =
  "snapshot-per-player-mission-state-v78" as const;
export const SNAPSHOT_LIVE_NPC_GROUNDING_VERSION_V78 =
  "snapshot-live-npc-grounding-v78" as const;
export const SNAPSHOT_WALK_PERFORMANCE_PROFILER_VERSION_V78 =
  "snapshot-walk-performance-profiler-v78" as const;
export const SNAPSHOT_REMAINING_PORT_AUDIT_VERSION_V78 =
  "snapshot-remaining-port-audit-v78" as const;

export const SNAPSHOT_LIVE_NPC_MAX_FOOT_CLEARANCE_V78 = 0.25;
export const SNAPSHOT_LIVE_NPC_FORCE_GROUND_ABOVE_Y_V78 =
  SNAPSHOT_GROVE_LIVE_NPC_FEET_Y_V83 + 1.25;

export const SNAPSHOT_GROVE_LIVE_BOUNDS_V78 = {
  label: "The Grove / snapshot starter area",
  min: [300, 24, -360] as Vec3,
  max: [650, 140, -40] as Vec3,
  expectedFeetY: SNAPSHOT_GROVE_LIVE_NPC_FEET_Y_V83,
};

export const SNAPSHOT_HARTHMERE_LIVE_BOUNDS_V78 = {
  label: "Harthmere connected town",
  min: [192, 24, -512] as Vec3,
  max: [768, 140, 192] as Vec3,
  // Connected Harthmere shares the live Grove surface. The authored 52/53 band
  // remains available for bible/layout comparisons, but live connected-world
  // bounds must not introduce a Y discontinuity at the connector road.
  expectedFeetY: SNAPSHOT_GROVE_LIVE_NPC_FEET_Y_V83,
};

// BIOMES_HARTHMERE_SHIFTED_TOWN_BOUNDS_V89
// When BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN or BIOMES_FORCE_LOCAL_DEV_TOWN is
// active, the server shifts the Harthmere city terrain by +512 X so it can sit
// beside the imported snapshot/Grove world. The old diagnostic bounds called
// that shifted city "wilds", which made the survey and logs misleading.
export const SNAPSHOT_HARTHMERE_SHIFTED_LIVE_BOUNDS_V89 = {
  label: "Harthmere shifted local-dev town",
  min: [704, 24, -512] as Vec3,
  max: [1280, 140, 192] as Vec3,
  expectedFeetY: SNAPSHOT_GROVE_NPC_FEET_Y_V75,
};

export const SNAPSHOT_ORIGINAL_FLOATING_NPC_LABELS_V78 = [
  "Allix",
  "Helsa",
  "Drona",
  "Coretta",
  "Patsy",
  "Gizela",
  "Grover",
  "Alva",
  "Davi",
  "Runna",
  "Richard",
  "Emily",
] as const;

const GROVE_BIBLE_NAMES_V78 = new Set(
  SNAPSHOT_GROVE_NPCS_V75.map((npc) => npc.displayName.toLowerCase()),
);

export function snapshotPointInBoundsV78(
  point: ReadonlyVec3 | undefined,
  bounds: { min: ReadonlyVec3; max: ReadonlyVec3 },
) {
  if (!point) return false;
  return (
    point[0] >= bounds.min[0] &&
    point[0] <= bounds.max[0] &&
    point[1] >= bounds.min[1] &&
    point[1] <= bounds.max[1] &&
    point[2] >= bounds.min[2] &&
    point[2] <= bounds.max[2]
  );
}

export function snapshotLabelIsOriginalFloatingNpcV78(label: string | undefined) {
  const normalized = (label ?? "").trim().toLowerCase();
  if (!normalized) return false;
  if (GROVE_BIBLE_NAMES_V78.has(normalized)) return false;
  return SNAPSHOT_ORIGINAL_FLOATING_NPC_LABELS_V78.some(
    (name) => normalized === name.toLowerCase(),
  );
}

export function snapshotIsLiveFloatingGroveNpcCandidateV78(input: {
  id?: BiomesId;
  label?: string;
  position?: ReadonlyVec3;
  entityDescription?: string;
}) {
  const position = input.position;
  if (!position) return false;
  const label = input.label?.trim();
  const inGrove = snapshotPointInBoundsV78(position, SNAPSHOT_GROVE_LIVE_BOUNDS_V78);
  if (!inGrove) return false;
  const fromV75Seed = input.entityDescription?.includes("snapshot-grove-npc-grounding-v75");
  if (fromV75Seed) return false;
  const hasOriginalName = snapshotLabelIsOriginalFloatingNpcV78(label);
  const tooHigh = position[1] > SNAPSHOT_LIVE_NPC_FORCE_GROUND_ABOVE_Y_V78;
  return hasOriginalName || tooHigh;
}

export function snapshotGroundLiveNpcPositionV78(
  position: ReadonlyVec3,
  label?: string,
): Vec3 {
  const shouldGround = snapshotIsLiveFloatingGroveNpcCandidateV78({
    label,
    position,
  });
  return shouldGround
    ? [position[0], SNAPSHOT_GROVE_LIVE_NPC_FEET_Y_V83, position[2]]
    : [position[0], position[1], position[2]];
}

export function snapshotLiveNpcFootClearanceV78(position: ReadonlyVec3 | undefined) {
  if (!position) {
    return undefined;
  }
  return Number((position[1] - SNAPSHOT_GROVE_LIVE_NPC_FEET_Y_V83).toFixed(3));
}

export interface SnapshotLiveNpcAuditRecordV78 {
  id?: BiomesId;
  label: string;
  position?: Vec3;
  inGrove: boolean;
  inHarthmere: boolean;
  clearance?: number;
  pass: boolean;
  action: "ok" | "visual_grounded" | "needs_server_remap" | "missing_position";
  reason: string;
}

export function snapshotLiveNpcAuditSummaryV78(records: SnapshotLiveNpcAuditRecordV78[]) {
  const failures = records.filter((record) => !record.pass);
  const visualGrounded = records.filter((record) => record.action === "visual_grounded");
  const serverRemap = records.filter((record) => record.action === "needs_server_remap");
  return {
    version: SNAPSHOT_LIVE_NPC_GROUNDING_VERSION_V78,
    total: records.length,
    failures: failures.length,
    visualGrounded: visualGrounded.length,
    needsServerRemap: serverRemap.length,
    pass: failures.length === 0,
  };
}

export interface SnapshotPerformanceSampleV78 {
  atMs: number;
  area: "grove" | "harthmere" | "connector" | "wilds" | "unknown";
  position?: Vec3;
  fps: number;
  avgFrameMs: number;
  maxFrameMs: number;
  longTaskCount: number;
  heapUsedMb?: number;
  nearbyNpcCount: number;
  floatingNpcCount: number;
  visibleResourceCount: number;
  note?: string;
}

export function snapshotAreaForPositionV78(position: ReadonlyVec3 | undefined): SnapshotPerformanceSampleV78["area"] {
  if (!position) return "unknown";
  if (snapshotPointInBoundsV78(position, SNAPSHOT_GROVE_LIVE_BOUNDS_V78)) return "grove";
  if (snapshotPointInBoundsV78(position, SNAPSHOT_HARTHMERE_LIVE_BOUNDS_V78)) return "harthmere";
  if (snapshotPointInBoundsV78(position, SNAPSHOT_HARTHMERE_SHIFTED_LIVE_BOUNDS_V89)) return "harthmere";
  if (position[0] >= 620 && position[0] <= 930 && position[2] >= -240 && position[2] <= -160) return "connector";
  return "wilds";
}

export const SNAPSHOT_PERFORMANCE_DEBUG_TOOLS_V78 = [
  {
    tool: "window.__snapshotPerfV78.start() / stop()",
    use: "Record FPS, frame spikes, long tasks, heap, nearby NPC count, and floating NPC count while walking around.",
  },
  {
    tool: "window.__snapshotPerfV78.mark('label')",
    use: "Drop a marker at the current player coordinate when you see hitching, collision trouble, or scene-load stutter.",
  },
  {
    tool: "window.__snapshotPerfV78.report()",
    use: "Summarize worst frame samples by area: Grove, connector, Harthmere, or Wilds.",
  },
  {
    tool: "window.__snapshotPerfV78.download()",
    use: "Export the walk audit JSON so another developer can reproduce exact problem coordinates.",
  },
  {
    tool: "window.__snapshotDiagnosticsV78.runFloatingAudit()",
    use: "List live NPCs, foot clearance, and whether the renderer had to visually ground a snapshot original.",
  },
  {
    tool: "Chrome DevTools Performance + WebGL renderer info",
    use: "Profile slow screen loads, shader/texture stalls, render-frame spikes, and GPU/CPU bottlenecks.",
  },
] as const;

export const SNAPSHOT_REMAINING_PORT_ITEMS_V78 = [
  {
    area: "challenge_data",
    status: "needs_review",
    item: "Review the 75 non-NUX Bikkie/static/source candidates from v77 and decide which are real production challenges versus content/code false positives.",
  },
  {
    area: "server_progress",
    status: "production_endpoint_required",
    item: "Point GLITCH_SNAPSHOT_PROGRESS_BACKEND_URL at the final Glitch backend route and persist progress by install/user/title/session identity.",
  },
  {
    area: "raw_snapshot_npcs",
    status: "live_audit_required",
    item: "Remap or delete original floating snapshot NPC entities once their live entity IDs are captured; v78 visually grounds them and reports the IDs.",
  },
  {
    area: "mission_quality",
    status: "playtest_required",
    item: "Run every Road Ahead and 15 Grove quest step as a new player and as a returning player; verify journal, marker, reward, and backend mutation together.",
  },
  {
    area: "camera_social",
    status: "backend_integration_required",
    item: "Replace photo/social fallback proof with final social post backend confirmation where available.",
  },
  {
    area: "muck_world_state",
    status: "server_mutation_required",
    item: "Promote clear_muck mutations from progress records into real world terrain/placeable mutations when final production world write policy is selected.",
  },
  {
    area: "fishing_water",
    status: "systems_polish_required",
    item: "Replace Shutter Cove fallback catch table with final fishing balance, water hints, loot tables, and UI feedback.",
  },
  {
    area: "audio_rewards",
    status: "content_polish_required",
    item: "Swap temporary cue bindings for final stingers, Mucker/Muckling sounds, recipe unlock sounds, and completion music balance.",
  },
  {
    area: "player_builder",
    status: "visual_qa_required",
    item: "Validate Grove presets in the first-login character builder against cosmetics, body sliders, equipment preview, and saved appearance.",
  },
] as const;

export function snapshotRemainingPortAuditV78() {
  return {
    version: SNAPSHOT_REMAINING_PORT_AUDIT_VERSION_V78,
    items: SNAPSHOT_REMAINING_PORT_ITEMS_V78,
    openCount: SNAPSHOT_REMAINING_PORT_ITEMS_V78.length,
  };
}
