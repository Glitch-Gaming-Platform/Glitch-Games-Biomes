import {
  HARTHMERE_BUSINESS_OUTPOSTS,
  harthmereBusinessOutpostJobsBoardPosition,
  harthmereBusinessOutpostMapMarkerId,
  type HarthmereBusinessOutpost,
} from "@/shared/harthmere/business_customer_simulator";
import {
  HARTHMERE_BUSINESS_OWNER_NPC_SEEDS,
  harthmereBusinessOwnerMarkerId,
  type HarthmereBusinessOwnerNpcSeed,
} from "@/shared/harthmere/business_owner_npc_seed";
import {
  harthmereExoticMatterDepositQuestMarkers,
  type HarthmereExoticMatterQuestMarker,
} from "@/shared/harthmere/exotic_matter_caves";
import {
  harthmereJobsBoardFieldTargets,
  type HarthmereJobsBoardFieldTarget,
} from "@/shared/harthmere/jobs_board_field_targets";
import {
  LIVE_ENTITY_HELPER_QUEST_TARGET_MARKERS,
  type LiveEntityHelperQuestTargetMarker,
} from "@/shared/harthmere/live_entity_helper_quests";
import {
  HARTHMERE_JOBS_BOARD_MUCK_BOUNTY_TARGETS,
  type HarthmereJobsBoardMuckBountyTarget,
} from "@/shared/harthmere/jobs_board_muck_bounty_targets";
import { resolveHarthmereProductionMarkerPosition } from "@/shared/harthmere/production_terrain_placement_map";
import { HARTHMERE_GATHERING_AUTHORITY_NODES } from "@/shared/harthmere/gathering_node_authority";
import { groveLandmarkWorldPosition } from "@/shared/harthmere/grove/grove_waypoints";
import {
  SNAPSHOT_GROVE_LANDMARKS,
  type SnapshotGroveLandmark,
} from "@/shared/harthmere/snapshot_grove_content";
import type { Vec3 } from "@/shared/math/types";
import { humanReadableHarthmereIdentifier } from "@/shared/harthmere/harthmere_readable_names";
import { HARTHMERE_LEGACY_PROTECTION_ESCORT_DESTINATIONS } from "@/shared/harthmere/legacy_protection_escort_destinations";

export const HARTHMERE_JOBS_BOARD_QUEST_MARKER_POSITIONS_VERSION =
  "harthmere-jobs-board-quest-marker-positions" as const;

export type HarthmereJobsBoardQuestMarkerSource =
  | "snapshot_landmark"
  | "live_entity_helper"
  | "job_item_source"
  | "business_outpost"
  | "business_outpost_jobs_board"
  | "business_owner"
  | "business_template_target"
  | "business_outpost_work_station"
  | "exotic_matter_deposit"
  | "muck_bounty_target"
  | "legacy_protection_field"
  | "fallback";

export interface HarthmereJobsBoardQuestMarkerPosition {
  markerId: string;
  label: string;
  position: Vec3;
  source: HarthmereJobsBoardQuestMarkerSource;
}

function markerFromSnapshotLandmark(
  landmark: SnapshotGroveLandmark
): HarthmereJobsBoardQuestMarkerPosition {
  return {
    markerId: landmark.id,
    label: landmark.label,
    // RESOLVED, not raw. 15 Grove-area landmarks are still authored at the
    // retired Y=54 while the terrain the browser loads is at Y=71; a raw read
    // puts the jobs-board pin 17 blocks under the courtyard.
    position: groveLandmarkWorldPosition(landmark),
    source: "snapshot_landmark",
  };
}

function markerFromLiveEntityHelper(
  marker: LiveEntityHelperQuestTargetMarker
): HarthmereJobsBoardQuestMarkerPosition {
  return {
    markerId: marker.id,
    label: marker.label,
    position: [...marker.position] as Vec3,
    source: "live_entity_helper",
  };
}

// HARTHMERE_JOB_ITEM_SOURCE_MARKERS (2026-07-29):
// Only two gathering nodes used to be registered here, so any job whose item
// source resolved to a different node (farm crops, temple herbs, hunting
// grounds, ward scrap) produced an acquisition hint pointing at a marker id
// that no map surface could resolve — the player got told where to go and got
// no pin. Register the whole authored gathering catalogue.
const HARTHMERE_JOBS_BOARD_ITEM_SOURCE_MARKERS: readonly HarthmereJobsBoardQuestMarkerPosition[] =
  HARTHMERE_GATHERING_AUTHORITY_NODES.map((node) => ({
    markerId: node.id,
    label: node.name,
    position: [...node.position] as Vec3,
    source: "job_item_source" as const,
  }));

function businessOutpostJobsBoardMarkerId(outpost: HarthmereBusinessOutpost) {
  return `${outpost.outpostId}_job_board`;
}

function markerFromBusinessOutpost(
  outpost: HarthmereBusinessOutpost
): HarthmereJobsBoardQuestMarkerPosition {
  return {
    markerId: harthmereBusinessOutpostMapMarkerId(outpost.outpostId),
    label: outpost.displayName,
    position: [outpost.position.x, outpost.position.y + 1, outpost.position.z],
    source: "business_outpost",
  };
}

function markerFromBusinessOutpostJobsBoard(
  outpost: HarthmereBusinessOutpost
): HarthmereJobsBoardQuestMarkerPosition {
  const position = harthmereBusinessOutpostJobsBoardPosition(outpost);
  return {
    markerId: businessOutpostJobsBoardMarkerId(outpost),
    label: `${outpost.displayName} Jobs Board`,
    position: [position.x, position.y, position.z],
    source: "business_outpost_jobs_board",
  };
}

// HARTHMERE_JOBS_BOARD_FIELD_TARGET_MARKERS
// Business job-template targets and outpost starter work stations resolve to
// the PHYSICAL prop on the shop apron (jobs_board_field_targets), not to the
// outpost's centre marker. Both the marker id and the requirement target id are
// registered so the server's field-proximity check and the client's map pin
// agree with the object the player actually presses F on.
function markersFromFieldTarget(
  target: HarthmereJobsBoardFieldTarget
): HarthmereJobsBoardQuestMarkerPosition[] {
  const source: HarthmereJobsBoardQuestMarkerSource =
    target.source === "business_outpost_work_station"
      ? "business_outpost_work_station"
      : "business_template_target";
  const base = {
    label: target.label,
    position: [...target.position] as Vec3,
    source,
  };
  const markers: HarthmereJobsBoardQuestMarkerPosition[] = [
    { markerId: target.mapMarkerId, ...base },
  ];
  if (target.targetId !== target.mapMarkerId) {
    markers.push({ markerId: target.targetId, ...base });
  }
  return markers;
}

// HARTHMERE_DELIVERY_RECIPIENT: a delivery whose recipient is a PERSON
// points at a business owner NPC. Mark them at their authored in-shop position
// (+1 so the pin sits above the floor), so the player walks the map to find them.
function markerFromBusinessOwner(
  seed: HarthmereBusinessOwnerNpcSeed
): HarthmereJobsBoardQuestMarkerPosition {
  return {
    markerId: harthmereBusinessOwnerMarkerId(seed.ownerNpcId),
    label: seed.displayName,
    position: [seed.position[0], seed.position[1] + 1, seed.position[2]],
    source: "business_owner",
  };
}

function markerFromExoticMatterDeposit(
  marker: HarthmereExoticMatterQuestMarker
): HarthmereJobsBoardQuestMarkerPosition {
  return {
    markerId: marker.markerId,
    label: marker.label,
    position: [...marker.position] as Vec3,
    source: "exotic_matter_deposit",
  };
}

function markerFromMuckBountyTarget(
  target: HarthmereJobsBoardMuckBountyTarget
): HarthmereJobsBoardQuestMarkerPosition {
  return {
    markerId: target.markerId,
    label: target.label,
    position: [...target.position] as Vec3,
    source: "muck_bounty_target",
  };
}

function markerFromLegacyProtectionDestination(
  destination: (typeof HARTHMERE_LEGACY_PROTECTION_ESCORT_DESTINATIONS)[number]
): HarthmereJobsBoardQuestMarkerPosition {
  return {
    markerId: destination.markerId,
    label: destination.name,
    position: [...destination.position] as Vec3,
    source: "legacy_protection_field",
  };
}

// HARTHMERE_MARKER_TABLE_MEMOIZATION (2026-07-29):
// This table is derived entirely from static module data, but it used to be
// rebuilt from scratch on EVERY lookup — including inside the jobs-board
// completion reducer, which resolves a marker per requirement. With ~1.5k
// landmarks, outposts, owners, deposits, bounty targets and field targets that
// turned a single job turn-in into hundreds of thousands of allocations and was
// the dominant cost in both the authority tests and the browser E2E run.
// Build once, then serve from an id index.
let cachedMarkerPositions:
  readonly HarthmereJobsBoardQuestMarkerPosition[] | undefined;
let cachedMarkerIndex:
  ReadonlyMap<string, HarthmereJobsBoardQuestMarkerPosition> | undefined;
const cachedRuntimeMarkerById = new Map<
  string,
  HarthmereJobsBoardQuestMarkerPosition
>();

/** Test-only: drop the memoized marker tables. */
export function resetHarthmereJobsBoardQuestMarkerCachesForTest() {
  cachedMarkerPositions = undefined;
  cachedMarkerIndex = undefined;
  cachedRuntimeMarkerById.clear();
}

function buildHarthmereJobsBoardQuestMarkerPositions(): readonly HarthmereJobsBoardQuestMarkerPosition[] {
  return [
    ...SNAPSHOT_GROVE_LANDMARKS.map(markerFromSnapshotLandmark),
    ...LIVE_ENTITY_HELPER_QUEST_TARGET_MARKERS.map(markerFromLiveEntityHelper),
    ...HARTHMERE_JOBS_BOARD_ITEM_SOURCE_MARKERS,
    ...HARTHMERE_BUSINESS_OUTPOSTS.flatMap((outpost) => [
      markerFromBusinessOutpost(outpost),
      markerFromBusinessOutpostJobsBoard(outpost),
    ]),
    ...HARTHMERE_BUSINESS_OWNER_NPC_SEEDS.map(markerFromBusinessOwner),
    ...harthmereJobsBoardFieldTargets().flatMap(markersFromFieldTarget),
    ...harthmereExoticMatterDepositQuestMarkers().map(
      markerFromExoticMatterDeposit
    ),
    ...HARTHMERE_JOBS_BOARD_MUCK_BOUNTY_TARGETS.map(markerFromMuckBountyTarget),
    ...HARTHMERE_LEGACY_PROTECTION_ESCORT_DESTINATIONS.map(
      markerFromLegacyProtectionDestination
    ),
  ];
}

export function harthmereJobsBoardQuestMarkerPositions(): readonly HarthmereJobsBoardQuestMarkerPosition[] {
  if (!cachedMarkerPositions) {
    cachedMarkerPositions = buildHarthmereJobsBoardQuestMarkerPositions();
  }
  return cachedMarkerPositions;
}

function harthmereJobsBoardQuestMarkerIndex() {
  if (!cachedMarkerIndex) {
    const index = new Map<string, HarthmereJobsBoardQuestMarkerPosition>();
    // First writer wins, matching the previous `Array.find` semantics.
    for (const marker of harthmereJobsBoardQuestMarkerPositions()) {
      if (!index.has(marker.markerId)) {
        index.set(marker.markerId, marker);
      }
    }
    cachedMarkerIndex = index;
  }
  return cachedMarkerIndex;
}

export function harthmereJobsBoardQuestMarkerPositionForId(
  markerId: string | undefined
): HarthmereJobsBoardQuestMarkerPosition | undefined {
  if (!markerId) {
    return undefined;
  }
  return harthmereJobsBoardQuestMarkerIndex().get(markerId);
}

export function harthmereJobsBoardQuestMarkerRuntimePosition(
  marker: HarthmereJobsBoardQuestMarkerPosition
): HarthmereJobsBoardQuestMarkerPosition {
  // Registered jobs-board field targets are physical procedural props. Their
  // authored position is therefore the runtime authority: applying an older
  // production-placement recommendation here can move the map/completion
  // target 20+ metres away from the object the player actually interacts with.
  if (
    marker.source === "business_template_target" ||
    marker.source === "business_outpost_work_station" ||
    marker.source === "legacy_protection_field" ||
    // Exotic Matter markers are already canonical runtime coordinates. Town
    // caves have received the shared +1600 transform, while original-map
    // Indisworm caverns intentionally remain unshifted and underground. The
    // retired +512 placement map must not move either class onto another floor.
    marker.source === "exotic_matter_deposit"
  ) {
    return {
      ...marker,
      position: [...marker.position] as Vec3,
    };
  }
  return {
    ...marker,
    position: resolveHarthmereProductionMarkerPosition({
      markerId: marker.markerId,
      fallback: marker.position,
    }),
  };
}

export function harthmereJobsBoardQuestMarkerRuntimePositionForId(
  markerId: string | undefined
): HarthmereJobsBoardQuestMarkerPosition | undefined {
  if (!markerId) {
    return undefined;
  }
  const cached = cachedRuntimeMarkerById.get(markerId);
  if (cached) {
    return cached;
  }
  const marker = harthmereJobsBoardQuestMarkerPositionForId(markerId);
  if (!marker) {
    return undefined;
  }
  const runtime = harthmereJobsBoardQuestMarkerRuntimePosition(marker);
  cachedRuntimeMarkerById.set(markerId, runtime);
  return runtime;
}

export function harthmereJobsBoardQuestMarkerPositionForTodo(input: {
  mapMarkerId?: string;
  targetId?: string;
  fallbackPosition: Vec3;
}): HarthmereJobsBoardQuestMarkerPosition {
  return (
    harthmereJobsBoardQuestMarkerPositionForId(input.mapMarkerId) ??
    harthmereJobsBoardQuestMarkerPositionForId(input.targetId) ?? {
      markerId: input.mapMarkerId ?? input.targetId ?? "unknown_job_target",
      label: humanReadableHarthmereIdentifier(
        input.mapMarkerId ?? input.targetId,
        "Job Target"
      ),
      position: [...input.fallbackPosition] as Vec3,
      source: "fallback",
    }
  );
}

export function harthmereJobsBoardQuestMarkerRuntimePositionForTodo(input: {
  mapMarkerId?: string;
  targetId?: string;
  fallbackPosition: Vec3;
}): HarthmereJobsBoardQuestMarkerPosition {
  return harthmereJobsBoardQuestMarkerRuntimePosition(
    harthmereJobsBoardQuestMarkerPositionForTodo(input)
  );
}

export function unresolvedHarthmereJobsBoardQuestMarkerIds(
  markerIds: readonly string[]
) {
  return markerIds.filter(
    (markerId) => !harthmereJobsBoardQuestMarkerPositionForId(markerId)
  );
}
