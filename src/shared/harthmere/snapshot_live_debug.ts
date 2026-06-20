// SNAPSHOT_LIVE_DEBUG_PLAYER_SCOPE
// Final snapshot-debug pass for live NPC foot clearance, per-player mission state,
// and walk-around performance profiling across The Grove and Harthmere.

import type { BiomesId } from "@/shared/ids";
import type { ReadonlyVec3, Vec3 } from "@/shared/math/types";
import {
  SNAPSHOT_GROVE_LIVE_NPC_FEET_Y,
  SNAPSHOT_GROVE_NPC_FEET_Y,
  SNAPSHOT_GROVE_NPCS,
} from "@/shared/harthmere/snapshot_grove_content";

export const SNAPSHOT_LIVE_DEBUG_PLAYER_SCOPE_VERSION =
  "snapshot-live-debug-player-scope" as const;
export const SNAPSHOT_PER_PLAYER_MISSION_STATE_VERSION =
  "snapshot-per-player-mission-state" as const;
export const SNAPSHOT_LIVE_NPC_GROUNDING_VERSION =
  "snapshot-live-npc-grounding" as const;
export const SNAPSHOT_WALK_PERFORMANCE_PROFILER_VERSION =
  "snapshot-walk-performance-profiler" as const;
export const SNAPSHOT_HOSTILE_MUCKER_GROUNDING_VERSION =
  "snapshot-hostile-mucker-grounding" as const;
export const SNAPSHOT_MUCKER_HEXER_UNEVEN_GROUNDING_VERSION =
  "snapshot-mucker-hexer-uneven-grounding" as const;
export const SNAPSHOT_MUCKER_HEXER_FLOATING_Y_OFFSET = 17;
export const SNAPSHOT_MUCKER_HEXER_TILE_CLEARANCE_VERSION =
  "snapshot-mucker-hexer-tile-clearance" as const;
export const SNAPSHOT_MUCKER_HEXER_MIN_TILE_CLEARANCE = -0.75;
export const SNAPSHOT_MUCKER_HEXER_MAX_TILE_CLEARANCE = 1.75;
export const SNAPSHOT_REMAINING_PORT_AUDIT_VERSION =
  "snapshot-remaining-port-audit" as const;

export const SNAPSHOT_LIVE_NPC_MAX_FOOT_CLEARANCE = 0.25;
export const SNAPSHOT_LIVE_NPC_FORCE_GROUND_ABOVE_Y =
  SNAPSHOT_GROVE_LIVE_NPC_FEET_Y + 1.25;

export const SNAPSHOT_GROVE_LIVE_BOUNDS = {
  label: "The Grove / snapshot starter area",
  min: [300, 24, -360] as Vec3,
  max: [650, 140, -40] as Vec3,
  expectedFeetY: SNAPSHOT_GROVE_LIVE_NPC_FEET_Y,
};

export const SNAPSHOT_HARTHMERE_LIVE_BOUNDS = {
  label: "Harthmere connected town",
  min: [192, 24, -512] as Vec3,
  max: [768, 140, 192] as Vec3,
  // Connected Harthmere shares the live Grove surface. The authored 52/53 band
  // remains available for bible/layout comparisons, but live connected-world
  // bounds must not introduce a Y discontinuity at the connector road.
  expectedFeetY: SNAPSHOT_GROVE_LIVE_NPC_FEET_Y,
};

// BIOMES_HARTHMERE_SHIFTED_TOWN_BOUNDS
// When BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN or BIOMES_FORCE_LOCAL_DEV_TOWN is
// active, the server shifts the Harthmere city terrain by +512 X so it can sit
// beside the imported snapshot/Grove world. The old diagnostic bounds called
// that shifted city "wilds", which made the survey and logs misleading.
export const SNAPSHOT_HARTHMERE_SHIFTED_LIVE_BOUNDS = {
  label: "Harthmere shifted local-dev town",
  min: [704, 24, -512] as Vec3,
  max: [1280, 140, 192] as Vec3,
  expectedFeetY: SNAPSHOT_GROVE_NPC_FEET_Y,
};

export const SNAPSHOT_ORIGINAL_FLOATING_NPC_LABELS = [
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

const GROVE_BIBLE_NAMES = new Set(
  SNAPSHOT_GROVE_NPCS.map((npc) => npc.displayName.toLowerCase())
);

export function snapshotPointInBounds(
  point: ReadonlyVec3 | undefined,
  bounds: { min: ReadonlyVec3; max: ReadonlyVec3 }
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

export function snapshotLabelIsOriginalFloatingNpc(
  label: string | undefined
) {
  const normalized = (label ?? "").trim().toLowerCase();
  if (!normalized) return false;
  if (GROVE_BIBLE_NAMES.has(normalized)) return false;
  return SNAPSHOT_ORIGINAL_FLOATING_NPC_LABELS.some(
    (name) => normalized === name.toLowerCase()
  );
}

export function snapshotLabelIsMuckerOrHexer(label: string | undefined) {
  const normalized = (label ?? "").trim().toLowerCase();
  return /muck|mucker|muckling|hexer|greater hexer|lesser hexer/.test(
    normalized
  );
}

export function snapshotIsLiveFloatingGroveNpcCandidate(input: {
  id?: BiomesId;
  label?: string;
  position?: ReadonlyVec3;
  entityDescription?: string;
}) {
  const position = input.position;
  if (!position) return false;
  const label = input.label?.trim();
  const inGrove = snapshotPointInBounds(
    position,
    SNAPSHOT_GROVE_LIVE_BOUNDS
  );
  if (!inGrove) return false;
  const fromAuthoredSeed = input.entityDescription?.includes(
    "snapshot-grove-npc-grounding"
  );
  if (fromAuthoredSeed) return false;
  const hasOriginalName = snapshotLabelIsOriginalFloatingNpc(label);
  const tooHigh = position[1] > SNAPSHOT_LIVE_NPC_FORCE_GROUND_ABOVE_Y;
  return hasOriginalName || tooHigh;
}

export function snapshotGroundMuckerOrHexerPosition(
  position: ReadonlyVec3,
  label?: string
): Vec3 | undefined {
  if (!snapshotLabelIsMuckerOrHexer(label)) {
    return undefined;
  }

  // The coordinate probe showed Muckers/Hexers rendering at y=70 while the
  // nearby player and wilds ground were around y=53. That is the raised Grove
  // courtyard correction leaking into hostile wild creatures. Preserve any
  // uneven-terrain variation by subtracting the leaked offset instead of
  // flattening every hostile to one constant Y.
  const looksRaisedToGroveBand =
    position[1] >= SNAPSHOT_GROVE_LIVE_NPC_FEET_Y - 1 &&
    position[1] <= SNAPSHOT_GROVE_LIVE_NPC_FEET_Y + 20;
  if (!looksRaisedToGroveBand) {
    return undefined;
  }
  return [
    position[0],
    position[1] - SNAPSHOT_MUCKER_HEXER_FLOATING_Y_OFFSET,
    position[2],
  ];
}

export function snapshotGroundLiveNpcPosition(
  position: ReadonlyVec3,
  label?: string
): Vec3 {
  const muckerOrHexerGrounded = snapshotGroundMuckerOrHexerPosition(
    position,
    label
  );
  if (muckerOrHexerGrounded) {
    return muckerOrHexerGrounded;
  }

  const shouldGround = snapshotIsLiveFloatingGroveNpcCandidate({
    label,
    position,
  });
  return shouldGround
    ? [position[0], SNAPSHOT_GROVE_LIVE_NPC_FEET_Y, position[2]]
    : [position[0], position[1], position[2]];
}

export function snapshotMuckerHexerTileClearance(input: {
  label?: string;
  actorFeetY?: number;
  tileFeetY?: number;
}) {
  if (!snapshotLabelIsMuckerOrHexer(input.label)) {
    return undefined;
  }
  const actorFeetY = Number(input.actorFeetY);
  const tileFeetY = Number(input.tileFeetY);
  if (!Number.isFinite(actorFeetY) || !Number.isFinite(tileFeetY)) {
    return undefined;
  }
  return Number((actorFeetY - tileFeetY).toFixed(3));
}

export function snapshotMuckerHexerTileClearancePass(input: {
  label?: string;
  actorFeetY?: number;
  tileFeetY?: number;
}) {
  const clearance = snapshotMuckerHexerTileClearance(input);
  if (clearance === undefined) {
    return {
      version: SNAPSHOT_MUCKER_HEXER_TILE_CLEARANCE_VERSION,
      pass: false,
      clearance,
      reason: "missing_mucker_hexer_or_tile_sample",
    };
  }
  const pass =
    clearance >= SNAPSHOT_MUCKER_HEXER_MIN_TILE_CLEARANCE &&
    clearance <= SNAPSHOT_MUCKER_HEXER_MAX_TILE_CLEARANCE;
  return {
    version: SNAPSHOT_MUCKER_HEXER_TILE_CLEARANCE_VERSION,
    pass,
    clearance,
    min: SNAPSHOT_MUCKER_HEXER_MIN_TILE_CLEARANCE,
    max: SNAPSHOT_MUCKER_HEXER_MAX_TILE_CLEARANCE,
    reason: pass ? "close_to_tile_beneath" : "too_far_from_tile_beneath",
  };
}

export function snapshotLiveNpcFootClearance(
  position: ReadonlyVec3 | undefined
) {
  if (!position) {
    return undefined;
  }
  return Number((position[1] - SNAPSHOT_GROVE_LIVE_NPC_FEET_Y).toFixed(3));
}

export interface SnapshotLiveNpcAuditRecord {
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

export function snapshotLiveNpcAuditSummary(
  records: SnapshotLiveNpcAuditRecord[]
) {
  const failures = records.filter((record) => !record.pass);
  const visualGrounded = records.filter(
    (record) => record.action === "visual_grounded"
  );
  const serverRemap = records.filter(
    (record) => record.action === "needs_server_remap"
  );
  return {
    version: SNAPSHOT_LIVE_NPC_GROUNDING_VERSION,
    total: records.length,
    failures: failures.length,
    visualGrounded: visualGrounded.length,
    needsServerRemap: serverRemap.length,
    pass: failures.length === 0,
  };
}

export interface SnapshotPerformanceSample {
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

export function snapshotAreaForPosition(
  position: ReadonlyVec3 | undefined
): SnapshotPerformanceSample["area"] {
  if (!position) return "unknown";
  if (snapshotPointInBounds(position, SNAPSHOT_GROVE_LIVE_BOUNDS))
    return "grove";
  if (snapshotPointInBounds(position, SNAPSHOT_HARTHMERE_LIVE_BOUNDS))
    return "harthmere";
  if (
    snapshotPointInBounds(
      position,
      SNAPSHOT_HARTHMERE_SHIFTED_LIVE_BOUNDS
    )
  )
    return "harthmere";
  if (
    position[0] >= 620 &&
    position[0] <= 930 &&
    position[2] >= -240 &&
    position[2] <= -160
  )
    return "connector";
  return "wilds";
}

export const SNAPSHOT_PERFORMANCE_DEBUG_TOOLS = [
  {
    tool: "window.__snapshotPerf.start() / stop()",
    use: "Record FPS, frame spikes, long tasks, heap, nearby NPC count, and floating NPC count while walking around.",
  },
  {
    tool: "window.__snapshotPerf.mark('label')",
    use: "Drop a marker at the current player coordinate when you see hitching, collision trouble, or scene-load stutter.",
  },
  {
    tool: "window.__snapshotPerf.report()",
    use: "Summarize worst frame samples by area: Grove, connector, Harthmere, or Wilds.",
  },
  {
    tool: "window.__snapshotPerf.download()",
    use: "Export the walk audit JSON so another developer can reproduce exact problem coordinates.",
  },
  {
    tool: "window.__snapshotDiagnostics.runFloatingAudit()",
    use: "List live NPCs, foot clearance, and whether the renderer had to visually ground a snapshot original.",
  },
  {
    tool: "Chrome DevTools Performance + WebGL renderer info",
    use: "Profile slow screen loads, shader/texture stalls, render-frame spikes, and GPU/CPU bottlenecks.",
  },
] as const;

export const SNAPSHOT_REMAINING_PORT_ITEMS = [
  {
    area: "challenge_data",
    status: "needs_review",
    item: "Review the 75 non-NUX Bikkie/static/source candidates from current and decide which are real production challenges versus content/code false positives.",
  },
  {
    area: "server_progress",
    status: "production_endpoint_required",
    item: "Point GLITCH_SNAPSHOT_PROGRESS_BACKEND_URL at the final Glitch backend route and persist progress by install/user/title/session identity.",
  },
  {
    area: "raw_snapshot_npcs",
    status: "live_audit_required",
    item: "Remap or delete original floating snapshot NPC entities once their live entity IDs are captured; current visually grounds them and reports the IDs.",
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

export function snapshotRemainingPortAudit() {
  return {
    version: SNAPSHOT_REMAINING_PORT_AUDIT_VERSION,
    items: SNAPSHOT_REMAINING_PORT_ITEMS,
    openCount: SNAPSHOT_REMAINING_PORT_ITEMS.length,
  };
}
