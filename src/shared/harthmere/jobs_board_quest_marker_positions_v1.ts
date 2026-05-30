import {
  HARTHMERE_BUSINESS_OUTPOSTS_V1,
  HARTHMERE_BUSINESS_OUTPOST_MAP_MARKERS_V1,
  harthmereBusinessOutpostJobsBoardPositionV1,
  harthmereBusinessOutpostMapMarkerIdV1,
  type HarthmereBusinessOutpostV1,
} from "@/shared/harthmere/business_customer_simulator_v1";
import {
  harthmereExoticMatterDepositQuestMarkersV1,
  type HarthmereExoticMatterQuestMarkerV1,
} from "@/shared/harthmere/exotic_matter_caves_v1";
import { HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES_V146 } from "@/shared/harthmere/jobs_board_business_templates_v146";
import {
  LIVE_ENTITY_HELPER_QUEST_TARGET_MARKERS_V1,
  type LiveEntityHelperQuestTargetMarkerV1,
} from "@/shared/harthmere/live_entity_helper_quests_v1";
import {
  SNAPSHOT_GROVE_LANDMARKS_V75,
  type SnapshotGroveLandmarkV75,
} from "@/shared/harthmere/snapshot_grove_content_v75";
import type { Vec3 } from "@/shared/math/types";

export const HARTHMERE_JOBS_BOARD_QUEST_MARKER_POSITIONS_VERSION_V1 =
  "harthmere-jobs-board-quest-marker-positions-v1" as const;

export type HarthmereJobsBoardQuestMarkerSourceV1 =
  | "snapshot_landmark"
  | "live_entity_helper"
  | "business_outpost"
  | "business_outpost_jobs_board"
  | "business_template_target"
  | "exotic_matter_deposit"
  | "fallback";

export interface HarthmereJobsBoardQuestMarkerPositionV1 {
  markerId: string;
  label: string;
  position: Vec3;
  source: HarthmereJobsBoardQuestMarkerSourceV1;
}

function markerFromSnapshotLandmarkV1(
  landmark: SnapshotGroveLandmarkV75
): HarthmereJobsBoardQuestMarkerPositionV1 {
  return {
    markerId: landmark.id,
    label: landmark.label,
    position: [...landmark.position] as Vec3,
    source: "snapshot_landmark",
  };
}

function markerFromLiveEntityHelperV1(
  marker: LiveEntityHelperQuestTargetMarkerV1
): HarthmereJobsBoardQuestMarkerPositionV1 {
  return {
    markerId: marker.id,
    label: marker.label,
    position: [...marker.position] as Vec3,
    source: "live_entity_helper",
  };
}

function businessOutpostJobsBoardMarkerIdV1(outpost: HarthmereBusinessOutpostV1) {
  return `${outpost.outpostId}_job_board`;
}

function markerFromBusinessOutpostV1(
  outpost: HarthmereBusinessOutpostV1
): HarthmereJobsBoardQuestMarkerPositionV1 {
  return {
    markerId: harthmereBusinessOutpostMapMarkerIdV1(outpost.outpostId),
    label: outpost.displayName,
    position: [
      outpost.position.x,
      outpost.position.y + 1,
      outpost.position.z,
    ],
    source: "business_outpost",
  };
}

function markerFromBusinessOutpostJobsBoardV1(
  outpost: HarthmereBusinessOutpostV1
): HarthmereJobsBoardQuestMarkerPositionV1 {
  const position = harthmereBusinessOutpostJobsBoardPositionV1(outpost);
  return {
    markerId: businessOutpostJobsBoardMarkerIdV1(outpost),
    label: `${outpost.displayName} Jobs Board`,
    position: [position.x, position.y, position.z],
    source: "business_outpost_jobs_board",
  };
}

function businessOutpostForTemplateV1(
  template: (typeof HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES_V146)[number]
) {
  return HARTHMERE_BUSINESS_OUTPOSTS_V1.find(
    (outpost) => outpost.businessType === template.businessType
  );
}

function markerFromBusinessTemplateV1(
  template: (typeof HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES_V146)[number]
): HarthmereJobsBoardQuestMarkerPositionV1 | undefined {
  const outpost = businessOutpostForTemplateV1(template);
  const marker = outpost
    ? HARTHMERE_BUSINESS_OUTPOST_MAP_MARKERS_V1.find(
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

function markerFromExoticMatterDepositV1(
  marker: HarthmereExoticMatterQuestMarkerV1
): HarthmereJobsBoardQuestMarkerPositionV1 {
  return {
    markerId: marker.markerId,
    label: marker.label,
    position: [...marker.position] as Vec3,
    source: "exotic_matter_deposit",
  };
}

export function harthmereJobsBoardQuestMarkerPositionsV1(): readonly HarthmereJobsBoardQuestMarkerPositionV1[] {
  return [
    ...SNAPSHOT_GROVE_LANDMARKS_V75.map(markerFromSnapshotLandmarkV1),
    ...LIVE_ENTITY_HELPER_QUEST_TARGET_MARKERS_V1.map(
      markerFromLiveEntityHelperV1
    ),
    ...HARTHMERE_BUSINESS_OUTPOSTS_V1.flatMap((outpost) => [
      markerFromBusinessOutpostV1(outpost),
      markerFromBusinessOutpostJobsBoardV1(outpost),
    ]),
    ...HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES_V146.map(
      markerFromBusinessTemplateV1
    ).filter(
      (
        marker
      ): marker is HarthmereJobsBoardQuestMarkerPositionV1 =>
        Boolean(marker)
    ),
    ...harthmereExoticMatterDepositQuestMarkersV1().map(
      markerFromExoticMatterDepositV1
    ),
  ];
}

export function harthmereJobsBoardQuestMarkerPositionForIdV1(
  markerId: string | undefined
): HarthmereJobsBoardQuestMarkerPositionV1 | undefined {
  if (!markerId) {
    return undefined;
  }
  return harthmereJobsBoardQuestMarkerPositionsV1().find(
    (marker) => marker.markerId === markerId
  );
}

export function harthmereJobsBoardQuestMarkerPositionForTodoV1(input: {
  mapMarkerId?: string;
  targetId?: string;
  fallbackPosition: Vec3;
}): HarthmereJobsBoardQuestMarkerPositionV1 {
  return (
    harthmereJobsBoardQuestMarkerPositionForIdV1(input.mapMarkerId) ??
    harthmereJobsBoardQuestMarkerPositionForIdV1(input.targetId) ?? {
      markerId: input.mapMarkerId ?? input.targetId ?? "unknown_job_target",
      label: input.mapMarkerId ?? input.targetId ?? "Job Target",
      position: [...input.fallbackPosition] as Vec3,
      source: "fallback",
    }
  );
}

export function unresolvedHarthmereJobsBoardQuestMarkerIdsV1(
  markerIds: readonly string[]
) {
  return markerIds.filter(
    (markerId) => !harthmereJobsBoardQuestMarkerPositionForIdV1(markerId)
  );
}
