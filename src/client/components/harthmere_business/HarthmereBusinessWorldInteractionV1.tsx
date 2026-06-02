import * as React from "react";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import {
  harthmereJobsBoardCameraPositionV146,
  harthmereJobsBoardPlayerPositionV146,
  type HarthmereJobsBoardPointV146,
} from "@/client/components/harthmere_jobs_board/HarthmereJobsBoardWorldInteractionV146";
import {
  HARTHMERE_BUSINESS_OUTPOSTS_V1,
  createHarthmereBusinessOutpostProceduralBuildingV1,
  harthmereBusinessOutpostBusinessIdV1,
} from "@/shared/harthmere/business_customer_simulator_v1";
import { HarthmereBusinessLiveContainer } from "./HarthmereBusinessLiveContainer";
import type {
  HarthmereBusinessWorldContextV1,
  HarthmereBusinessWorldPointV1,
} from "./businessInterfaceLiveAdapter";

export const HARTHMERE_BUSINESS_WORLD_INTERACTION_VERSION_V1 =
  "harthmere-business-world-interaction-v1" as const;

const BUSINESS_BOARD_RADIUS_V1 = 9;

const HARTHMERE_BUSINESS_WORLD_BOARDS_V1 = HARTHMERE_BUSINESS_OUTPOSTS_V1.map(
  (outpost) => {
    const building =
      createHarthmereBusinessOutpostProceduralBuildingV1(outpost);
    return {
      businessId: harthmereBusinessOutpostBusinessIdV1(outpost.outpostId),
      outpostId: outpost.outpostId,
      displayName: outpost.displayName,
      position: building.dashboardAccessPoint.position,
      markerId: building.dashboardAccessPoint.markerId,
      radius: BUSINESS_BOARD_RADIUS_V1,
    };
  }
);

function nearestBusinessBoardV1(
  playerPosition: HarthmereJobsBoardPointV146 | undefined
) {
  if (!playerPosition) return undefined;
  let best: (typeof HARTHMERE_BUSINESS_WORLD_BOARDS_V1)[number] | undefined;
  let bestDistance = Infinity;
  for (const board of HARTHMERE_BUSINESS_WORLD_BOARDS_V1) {
    const distance = Math.hypot(
      board.position.x - playerPosition.x,
      board.position.z - playerPosition.z
    );
    if (distance <= board.radius && distance < bestDistance) {
      best = board;
      bestDistance = distance;
    }
  }
  return best ? { ...best, distance: bestDistance } : undefined;
}

function businessPointFromJobsPointV1(
  point: HarthmereJobsBoardPointV146 | undefined
): HarthmereBusinessWorldPointV1 | undefined {
  if (!point) return undefined;
  return { x: point.x, y: point.y ?? 0, z: point.z };
}

export function HarthmereBusinessWorldInteractionV1({
  suppressPrompt = false,
}: {
  suppressPrompt?: boolean;
}) {
  const { reactResources } = useClientContext();
  const localPlayer = reactResources.use("/scene/local_player") as unknown;
  const camera = reactResources.use("/scene/camera") as unknown;
  const [openBusinessId, setOpenBusinessId] = React.useState<
    string | undefined
  >();
  const playerPosition = harthmereJobsBoardPlayerPositionV146(
    localPlayer,
    camera
  );
  const cameraPosition = harthmereJobsBoardCameraPositionV146(camera);
  const activeBoard = nearestBusinessBoardV1(playerPosition);
  const activeBusinessId = openBusinessId ?? activeBoard?.businessId;

  const worldContext: HarthmereBusinessWorldContextV1 | undefined =
    activeBusinessId
      ? {
          nearbyBusinessId: activeBusinessId,
          insideBusiness: true,
          interactionKeyLabel: "F",
          outpostId: activeBoard?.outpostId,
          businessInteractionMarkerId: activeBoard?.markerId,
          businessInteractionPosition: activeBoard?.position,
        }
      : undefined;

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const debug = {
      version: HARTHMERE_BUSINESS_WORLD_INTERACTION_VERSION_V1,
      playerPosition,
      cameraPosition,
      activeBoard,
      boards: HARTHMERE_BUSINESS_WORLD_BOARDS_V1,
      open: () => activeBoard && setOpenBusinessId(activeBoard.businessId),
      close: () => setOpenBusinessId(undefined),
    };
    (window as any).__harthmereBusinessBoardDebugV1 = debug;
    return () => {
      if ((window as any).__harthmereBusinessBoardDebugV1 === debug) {
        delete (window as any).__harthmereBusinessBoardDebugV1;
      }
    };
  }, [activeBoard, cameraPosition, playerPosition]);

  if (!activeBoard && !openBusinessId) return null;

  return (
    <HarthmereBusinessLiveContainer
      open={Boolean(openBusinessId)}
      onOpen={() => activeBoard && setOpenBusinessId(activeBoard.businessId)}
      onClose={() => setOpenBusinessId(undefined)}
      showPrompt={!suppressPrompt}
      playerPosition={businessPointFromJobsPointV1(playerPosition)}
      worldContext={worldContext}
    />
  );
}
