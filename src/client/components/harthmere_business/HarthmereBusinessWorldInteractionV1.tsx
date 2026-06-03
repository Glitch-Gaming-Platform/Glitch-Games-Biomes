import * as React from "react";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { fetchHarthmereLiveWithTimeoutV1 } from "@/client/components/harthmere_live_fetch";
import {
  harthmereJobsBoardCameraPositionV146,
  harthmereJobsBoardPlayerPositionV146,
} from "@/client/components/harthmere_jobs_board/HarthmereJobsBoardWorldInteractionV146";
import type { BuildingSystemInWorldMarkerV1 } from "@/shared/harthmere/building_system_v1";
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

interface HarthmereBusinessWorldCameraPointV1 {
  x: number;
  y?: number;
  z: number;
}

export interface HarthmereBusinessWorldBoardV1 {
  businessId: string;
  outpostId?: string;
  displayName: string;
  position: HarthmereBusinessWorldPointV1;
  markerId: string;
  radius: number;
}

const HARTHMERE_BUSINESS_WORLD_BOARDS_V1: HarthmereBusinessWorldBoardV1[] = HARTHMERE_BUSINESS_OUTPOSTS_V1.map(
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

function businessIdFromLiveMarkerIdV1(markerId: string) {
  const match = markerId.match(/^(.+):(?:marker|owner-npc)$/);
  return match?.[1];
}

export function harthmereBusinessDynamicWorldBoardsV1(
  markers: Record<string, BuildingSystemInWorldMarkerV1> | undefined
): HarthmereBusinessWorldBoardV1[] {
  return Object.values(markers ?? {}).flatMap((marker) => {
    if (marker.kind !== "business_marker" && marker.kind !== "npc_board") {
      return [];
    }
    const businessId = businessIdFromLiveMarkerIdV1(marker.markerId);
    if (!businessId) return [];
    return {
      businessId,
      displayName: marker.label,
      position: {
        x: marker.position[0],
        y: marker.position[1],
        z: marker.position[2],
      },
      markerId: marker.markerId,
      radius: BUSINESS_BOARD_RADIUS_V1,
    };
  });
}

function nearestBusinessBoardV1(
  playerPosition: HarthmereBusinessWorldCameraPointV1 | undefined,
  boards: HarthmereBusinessWorldBoardV1[]
) {
  if (!playerPosition) return undefined;
  let best: HarthmereBusinessWorldBoardV1 | undefined;
  let bestDistance = Infinity;
  for (const board of boards) {
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
  point: HarthmereBusinessWorldCameraPointV1 | undefined
): HarthmereBusinessWorldPointV1 | undefined {
  if (!point) return undefined;
  return { x: point.x, y: point.y ?? 0, z: point.z };
}

async function fetchHarthmereBusinessBuildingMarkersV1(
  fetchImpl: typeof fetch = fetch
) {
  const response = await fetchHarthmereLiveWithTimeoutV1(
    fetchImpl,
    "/api/harthmere/live_mode_building_state",
    {
      method: "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    }
  );
  if (!response.ok) return {};
  const body = await response.json();
  const markers = body?.buildingState?.inWorldMarkers;
  return typeof markers === "object" && markers !== null
    ? (markers as Record<string, BuildingSystemInWorldMarkerV1>)
    : {};
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
  const [buildingMarkers, setBuildingMarkers] = React.useState<
    Record<string, BuildingSystemInWorldMarkerV1>
  >({});
  const playerPosition = harthmereJobsBoardPlayerPositionV146(
    localPlayer,
    camera
  );
  const cameraPosition = harthmereJobsBoardCameraPositionV146(camera);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    const refresh = async () => {
      const markers = await fetchHarthmereBusinessBuildingMarkersV1();
      if (!cancelled) setBuildingMarkers(markers);
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);
  const dynamicBoards = React.useMemo(
    () => harthmereBusinessDynamicWorldBoardsV1(buildingMarkers),
    [buildingMarkers]
  );
  const activeBoard = nearestBusinessBoardV1(playerPosition, [
    ...HARTHMERE_BUSINESS_WORLD_BOARDS_V1,
    ...dynamicBoards,
  ]);
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
      dynamicBoards,
      open: () => activeBoard && setOpenBusinessId(activeBoard.businessId),
      close: () => setOpenBusinessId(undefined),
    };
    (window as any).__harthmereBusinessBoardDebugV1 = debug;
    return () => {
      if ((window as any).__harthmereBusinessBoardDebugV1 === debug) {
        delete (window as any).__harthmereBusinessBoardDebugV1;
      }
    };
  }, [activeBoard, cameraPosition, dynamicBoards, playerPosition]);

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
