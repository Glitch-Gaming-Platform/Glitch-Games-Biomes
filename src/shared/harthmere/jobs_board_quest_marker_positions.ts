import {
  HARTHMERE_BUSINESS_OUTPOSTS,
  HARTHMERE_BUSINESS_OUTPOST_MAP_MARKERS,
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
import { HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES } from "@/shared/harthmere/jobs_board_business_templates";
import {
  LIVE_ENTITY_HELPER_QUEST_TARGET_MARKERS,
  type LiveEntityHelperQuestTargetMarker,
} from "@/shared/harthmere/live_entity_helper_quests";
import {
  HARTHMERE_JOBS_BOARD_MUCK_BOUNTY_TARGETS,
  type HarthmereJobsBoardMuckBountyTarget,
} from "@/shared/harthmere/jobs_board_muck_bounty_targets";
import { resolveHarthmereProductionMarkerPosition } from "@/shared/harthmere/production_terrain_placement_map";
import { harthmereGatheringAuthorityNode } from "@/shared/harthmere/gathering_node_authority";
import {
  SNAPSHOT_GROVE_LANDMARKS,
  type SnapshotGroveLandmark,
} from "@/shared/harthmere/snapshot_grove_content";
import type { Vec3 } from "@/shared/math/types";

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
  | "exotic_matter_deposit"
  | "muck_bounty_target"
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
    position: [...landmark.position] as Vec3,
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

const HARTHMERE_JOBS_BOARD_ITEM_SOURCE_MARKERS: readonly HarthmereJobsBoardQuestMarkerPosition[] =
  [
    {
      markerId: "harthmere_orchard_softwood",
      label: "Orchard Softwood Branches",
      position: [
        ...(harthmereGatheringAuthorityNode("harthmere_orchard_softwood")
          ?.position ?? [2068, 53, -118]),
      ] as Vec3,
      source: "job_item_source",
    },
    {
      markerId: "harthmere_north_iron_vein",
      label: "North Road Iron Vein",
      position: [
        ...(harthmereGatheringAuthorityNode("harthmere_north_iron_vein")
          ?.position ?? [2103, 53, -270]),
      ] as Vec3,
      source: "job_item_source",
    },
  ];

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

function businessOutpostForTemplate(
  template: (typeof HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES)[number]
) {
  return HARTHMERE_BUSINESS_OUTPOSTS.find(
    (outpost) => outpost.businessType === template.businessType
  );
}

function markerFromBusinessTemplate(
  template: (typeof HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES)[number]
): HarthmereJobsBoardQuestMarkerPosition | undefined {
  const outpost = businessOutpostForTemplate(template);
  const marker = outpost
    ? HARTHMERE_BUSINESS_OUTPOST_MAP_MARKERS.find(
        (entry) => entry.outpostId === outpost.outpostId
      )
    : undefined;
  if (!marker || !template.mapMarkerId) {
    return undefined;
  }
  const targetName =
    template.requirements.find((requirement) => requirement.targetName)
      ?.targetName ?? template.label;
  return {
    markerId: template.mapMarkerId,
    label: targetName,
    position: [...marker.position] as Vec3,
    source: "business_template_target",
  };
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

export function harthmereJobsBoardQuestMarkerPositions(): readonly HarthmereJobsBoardQuestMarkerPosition[] {
  return [
    ...SNAPSHOT_GROVE_LANDMARKS.map(markerFromSnapshotLandmark),
    ...LIVE_ENTITY_HELPER_QUEST_TARGET_MARKERS.map(markerFromLiveEntityHelper),
    ...HARTHMERE_JOBS_BOARD_ITEM_SOURCE_MARKERS,
    ...HARTHMERE_BUSINESS_OUTPOSTS.flatMap((outpost) => [
      markerFromBusinessOutpost(outpost),
      markerFromBusinessOutpostJobsBoard(outpost),
    ]),
    ...HARTHMERE_BUSINESS_OWNER_NPC_SEEDS.map(markerFromBusinessOwner),
    ...HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES.map(
      markerFromBusinessTemplate
    ).filter((marker): marker is HarthmereJobsBoardQuestMarkerPosition =>
      Boolean(marker)
    ),
    ...harthmereExoticMatterDepositQuestMarkers().map(
      markerFromExoticMatterDeposit
    ),
    ...HARTHMERE_JOBS_BOARD_MUCK_BOUNTY_TARGETS.map(markerFromMuckBountyTarget),
  ];
}

export function harthmereJobsBoardQuestMarkerPositionForId(
  markerId: string | undefined
): HarthmereJobsBoardQuestMarkerPosition | undefined {
  if (!markerId) {
    return undefined;
  }
  return harthmereJobsBoardQuestMarkerPositions().find(
    (marker) => marker.markerId === markerId
  );
}

export function harthmereJobsBoardQuestMarkerRuntimePosition(
  marker: HarthmereJobsBoardQuestMarkerPosition
): HarthmereJobsBoardQuestMarkerPosition {
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
  const marker = harthmereJobsBoardQuestMarkerPositionForId(markerId);
  return marker
    ? harthmereJobsBoardQuestMarkerRuntimePosition(marker)
    : undefined;
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
      label: input.mapMarkerId ?? input.targetId ?? "Job Target",
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
