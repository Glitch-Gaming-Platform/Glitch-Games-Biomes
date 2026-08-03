import worldInteractionGraphicsManifest from "../../../public/assets/harthmere/manifest/world-interaction-graphics.json";

export const HARTHMERE_WORLD_INTERACTION_GRAPHICS_VERSION =
  "harthmere-world-interaction-graphics-runtime-v1" as const;

export type HarthmereWorldInteractionGraphicLod = "lod0" | "lod1" | "hidden";
export type HarthmereJobsBoardGraphicVariant =
  keyof typeof worldInteractionGraphicsManifest.jobsBoardVariants;
export type HarthmereRequestBoardGraphicVariant =
  keyof typeof worldInteractionGraphicsManifest.requestBoardVariants;

export type HarthmereGatheringNodeGraphicRecord =
  (typeof worldInteractionGraphicsManifest.gatheringNodes)[number];

export type HarthmereJobsBoardGraphicRecord =
  (typeof worldInteractionGraphicsManifest.jobsBoardVariants)[HarthmereJobsBoardGraphicVariant];
export type HarthmereRequestBoardGraphicRecord =
  (typeof worldInteractionGraphicsManifest.requestBoardVariants)[HarthmereRequestBoardGraphicVariant];

export const HARTHMERE_GATHERING_NODE_GRAPHICS =
  worldInteractionGraphicsManifest.gatheringNodes;
export const HARTHMERE_JOBS_BOARD_GRAPHICS =
  worldInteractionGraphicsManifest.jobsBoardVariants;
export const HARTHMERE_REQUEST_BOARD_GRAPHICS =
  worldInteractionGraphicsManifest.requestBoardVariants;
export const HARTHMERE_GATHERING_NODE_GRAPHIC_LOD_POLICY =
  worldInteractionGraphicsManifest.gatheringNodeLodPolicy;
export const HARTHMERE_JOBS_BOARD_GRAPHIC_LOD_POLICY =
  worldInteractionGraphicsManifest.jobsBoardLodPolicy;
export const HARTHMERE_REQUEST_BOARD_GRAPHIC_LOD_POLICY =
  worldInteractionGraphicsManifest.requestBoardLodPolicy;
export const HARTHMERE_GATHERING_NODE_GROW_IN_SECONDS = 0.9;

export function harthmereGatheringNodeGrowInTransform(progress: number) {
  const t = Math.max(0, Math.min(1, progress));
  const eased = t * t * (3 - 2 * t);
  const softOvershoot = Math.sin(Math.PI * t) * 0.035;
  return {
    y: -0.46 * (1 - eased),
    scaleXZ: 0.72 + 0.28 * eased + softOvershoot,
    scaleY: 0.08 + 0.92 * eased,
  };
}

const GATHERING_GRAPHIC_BY_NODE_ID = new Map(
  HARTHMERE_GATHERING_NODE_GRAPHICS.map((record) => [record.nodeId, record])
);

export function harthmereGatheringNodeGraphic(nodeId: string) {
  return GATHERING_GRAPHIC_BY_NODE_ID.get(nodeId);
}

export function harthmereJobsBoardGraphic(
  variant: HarthmereJobsBoardGraphicVariant
) {
  return HARTHMERE_JOBS_BOARD_GRAPHICS[variant];
}

export function harthmereRequestBoardGraphic(
  variant: HarthmereRequestBoardGraphicVariant
) {
  return HARTHMERE_REQUEST_BOARD_GRAPHICS[variant];
}

export function harthmereWorldInteractionGraphicLod(
  distanceMeters: number,
  policy: {
    lod0MaxDistanceMeters: number;
    lod1MaxDistanceMeters: number;
    hiddenBeyondMeters: number;
  }
): HarthmereWorldInteractionGraphicLod {
  if (distanceMeters <= policy.lod0MaxDistanceMeters) return "lod0";
  if (distanceMeters <= policy.lod1MaxDistanceMeters) return "lod1";
  return "hidden";
}

export function validateHarthmereWorldInteractionGraphicsManifest() {
  const errors: string[] = [];
  if (HARTHMERE_GATHERING_NODE_GRAPHICS.length !== 29) {
    errors.push(
      `gathering_graphic_count:${HARTHMERE_GATHERING_NODE_GRAPHICS.length}`
    );
  }
  if (Object.keys(HARTHMERE_JOBS_BOARD_GRAPHICS).length !== 5) {
    errors.push(
      `jobs_board_variant_count:${Object.keys(HARTHMERE_JOBS_BOARD_GRAPHICS).length}`
    );
  }
  if (Object.keys(HARTHMERE_REQUEST_BOARD_GRAPHICS).length !== 4) {
    errors.push(
      `request_board_variant_count:${Object.keys(
        HARTHMERE_REQUEST_BOARD_GRAPHICS
      ).length}`
    );
  }
  const duplicateNodeIds = HARTHMERE_GATHERING_NODE_GRAPHICS.filter(
    (record, index, all) =>
      all.findIndex((candidate) => candidate.nodeId === record.nodeId) !== index
  ).map((record) => record.nodeId);
  if (duplicateNodeIds.length) {
    errors.push(`duplicate_gathering_graphics:${duplicateNodeIds.join(",")}`);
  }
  for (const record of HARTHMERE_GATHERING_NODE_GRAPHICS) {
    if (!record.assets.lod0 || !record.assets.lod1) {
      errors.push(`${record.nodeId}:missing_lod`);
    }
  }
  for (const [category, record] of Object.entries(
    HARTHMERE_REQUEST_BOARD_GRAPHICS
  )) {
    if (!record.assets.lod0 || !record.assets.lod1) {
      errors.push(`${category}:missing_request_board_lod`);
    }
  }
  return errors;
}
