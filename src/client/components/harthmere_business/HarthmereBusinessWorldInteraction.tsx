import * as React from "react";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { fetchHarthmereLiveWithTimeout } from "@/client/components/harthmere_live_fetch";
import {
  harthmereJobsBoardCameraPosition,
  harthmereJobsBoardPlayerPosition,
} from "@/client/components/harthmere_jobs_board/HarthmereJobsBoardWorldInteraction";
import type { BuildingSystemInWorldMarker } from "@/shared/harthmere/building_system";
import {
  HARTHMERE_BUSINESS_OUTPOSTS,
  createHarthmereBusinessOutpostProceduralBuilding,
  harthmereBusinessOutpostBusinessId,
} from "@/shared/harthmere/business_customer_simulator";
import { HarthmereBusinessLiveContainer } from "./HarthmereBusinessLiveContainer";
import type {
  HarthmereBusinessWorldContext,
  HarthmereBusinessWorldPoint,
} from "./businessInterfaceLiveAdapter";

export const HARTHMERE_BUSINESS_WORLD_INTERACTION_VERSION =
  "harthmere-business-world-interaction" as const;

const BUSINESS_BOARD_RADIUS = 9;

interface HarthmereBusinessWorldCameraPoint {
  x: number;
  y?: number;
  z: number;
}

export interface HarthmereBusinessWorldBoard {
  businessId: string;
  outpostId?: string;
  displayName: string;
  position: HarthmereBusinessWorldPoint;
  markerId: string;
  radius: number;
}

const HARTHMERE_BUSINESS_WORLD_BOARDS: HarthmereBusinessWorldBoard[] = HARTHMERE_BUSINESS_OUTPOSTS.map(
  (outpost) => {
    const building =
      createHarthmereBusinessOutpostProceduralBuilding(outpost);
    return {
      businessId: harthmereBusinessOutpostBusinessId(outpost.outpostId),
      outpostId: outpost.outpostId,
      displayName: outpost.displayName,
      position: building.dashboardAccessPoint.position,
      markerId: building.dashboardAccessPoint.markerId,
      radius: BUSINESS_BOARD_RADIUS,
    };
  }
);

function businessIdFromLiveMarkerId(markerId: string) {
  const match = markerId.match(/^(.+):(?:marker|owner-npc)$/);
  return match?.[1];
}

export function harthmereBusinessDynamicWorldBoards(
  markers: Record<string, BuildingSystemInWorldMarker> | undefined
): HarthmereBusinessWorldBoard[] {
  return Object.values(markers ?? {}).flatMap((marker) => {
    if (marker.kind !== "business_marker" && marker.kind !== "npc_board") {
      return [];
    }
    const businessId = businessIdFromLiveMarkerId(marker.markerId);
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
      radius: BUSINESS_BOARD_RADIUS,
    };
  });
}

function nearestBusinessBoard(
  playerPosition: HarthmereBusinessWorldCameraPoint | undefined,
  boards: HarthmereBusinessWorldBoard[]
) {
  if (!playerPosition) return undefined;
  let best: HarthmereBusinessWorldBoard | undefined;
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

function businessPointFromJobsPoint(
  point: HarthmereBusinessWorldCameraPoint | undefined
): HarthmereBusinessWorldPoint | undefined {
  if (!point) return undefined;
  return { x: point.x, y: point.y ?? 0, z: point.z };
}

async function fetchHarthmereBusinessBuildingMarkers(
  fetchImpl: typeof fetch = fetch
) {
  const response = await fetchHarthmereLiveWithTimeout(
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
    ? (markers as Record<string, BuildingSystemInWorldMarker>)
    : {};
}

export function HarthmereBusinessWorldInteraction({
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
    Record<string, BuildingSystemInWorldMarker>
  >({});
  const playerPosition = harthmereJobsBoardPlayerPosition(
    localPlayer,
    camera
  );
  const cameraPosition = harthmereJobsBoardCameraPosition(camera);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    const refresh = async () => {
      const markers = await fetchHarthmereBusinessBuildingMarkers();
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
    () => harthmereBusinessDynamicWorldBoards(buildingMarkers),
    [buildingMarkers]
  );
  const activeBoard = nearestBusinessBoard(playerPosition, [
    ...HARTHMERE_BUSINESS_WORLD_BOARDS,
    ...dynamicBoards,
  ]);
  const activeBusinessId = openBusinessId ?? activeBoard?.businessId;

  const worldContext: HarthmereBusinessWorldContext | undefined =
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
      version: HARTHMERE_BUSINESS_WORLD_INTERACTION_VERSION,
      playerPosition,
      cameraPosition,
      activeBoard,
      boards: HARTHMERE_BUSINESS_WORLD_BOARDS,
      dynamicBoards,
      open: () => activeBoard && setOpenBusinessId(activeBoard.businessId),
      close: () => setOpenBusinessId(undefined),
    };
    (window as any).__harthmereBusinessBoardDebug = debug;
    return () => {
      if ((window as any).__harthmereBusinessBoardDebug === debug) {
        delete (window as any).__harthmereBusinessBoardDebug;
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
      playerPosition={businessPointFromJobsPoint(playerPosition)}
      worldContext={worldContext}
    />
  );
}
