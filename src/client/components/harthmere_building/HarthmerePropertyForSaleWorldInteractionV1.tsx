// HarthmerePropertyForSaleWorldInteractionV1 — when the local player walks up to
// a for-sale property plot, drop a light-blue beam over the land and pop a
// "Property For Sale" toast. Mirrors the jobs-board / business world-interaction
// components: it reads the live player position and reacts to proximity.

import * as React from "react";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { harthmereJobsBoardPlayerPositionV146 } from "@/client/components/harthmere_jobs_board/HarthmereJobsBoardWorldInteractionV146";
import {
  HARTHMERE_PROPERTY_BUILDING_STATE_EVENT_V1,
  harthmerePurchasablePlotMapLandmarksFromBuildingStateV1,
  type HarthmerePropertyMapBuildingStateV1,
} from "@/client/components/biomes_ui/adapters/propertyMapMarkersV1";
import { addToast } from "@/client/components/toast/helpers";
import { nearestPropertyForSaleLandmarkV1 } from "./propertyForSaleProximityV1";

export const HARTHMERE_PROPERTY_FOR_SALE_WORLD_INTERACTION_VERSION_V1 =
  "harthmere-property-for-sale-world-interaction-v1" as const;

// Stable nav-aid id so we only ever keep one for-sale beam at a time.
const PROPERTY_FOR_SALE_NAV_AID_ID_V1 = 914_701;
// Show the hint a bit further out than a doorway so the beam (which only renders
// past MapManager.MIN_BEAM_DISTANCE = 10) is visible as you approach.
const PROPERTY_FOR_SALE_HINT_RADIUS_V1 = 18;

export function HarthmerePropertyForSaleWorldInteractionV1({
  suppressPrompt = false,
}: { suppressPrompt?: boolean } = {}) {
  const { reactResources, resources, mapManager } = useClientContext();
  const localPlayer = reactResources.use("/scene/local_player") as unknown;
  const camera = reactResources.use("/scene/camera") as unknown;

  const [buildingState, setBuildingState] = React.useState<
    HarthmerePropertyMapBuildingStateV1 | undefined
  >(undefined);

  // The live adapters already fetch building state and broadcast it; reuse that
  // so we know which plots are still for sale without a second fetch.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    function onUpdate(event: Event) {
      const detail = (event as CustomEvent)?.detail?.buildingState;
      if (detail && typeof detail === "object") {
        setBuildingState(detail as HarthmerePropertyMapBuildingStateV1);
      }
    }
    window.addEventListener(
      HARTHMERE_PROPERTY_BUILDING_STATE_EVENT_V1,
      onUpdate as EventListener
    );
    return () =>
      window.removeEventListener(
        HARTHMERE_PROPERTY_BUILDING_STATE_EVENT_V1,
        onUpdate as EventListener
      );
  }, []);

  const forSale = React.useMemo(
    () => harthmerePurchasablePlotMapLandmarksFromBuildingStateV1(buildingState),
    [buildingState]
  );

  const player = harthmereJobsBoardPlayerPositionV146(
    localPlayer as any,
    camera as any
  );
  const nearest = suppressPrompt
    ? undefined
    : nearestPropertyForSaleLandmarkV1(
        forSale,
        player ? { x: player.x, z: player.z } : undefined,
        PROPERTY_FOR_SALE_HINT_RADIUS_V1
      );

  const nearestPlotId = nearest?.landmark.plotId;
  const toastedPlotIdRef = React.useRef<string | undefined>(undefined);

  // Beam: register/move a light-blue navigation aid over the nearest for-sale
  // plot, and tear it down when none is in range.
  React.useEffect(() => {
    if (!nearest) {
      mapManager.removeNavigationAid(PROPERTY_FOR_SALE_NAV_AID_ID_V1);
      return;
    }
    mapManager.addNavigationAid(
      {
        kind: "property_for_sale",
        autoremoveWhenNear: false,
        target: { kind: "position", position: nearest.landmark.position },
      },
      PROPERTY_FOR_SALE_NAV_AID_ID_V1
    );
    return () => {
      mapManager.removeNavigationAid(PROPERTY_FOR_SALE_NAV_AID_ID_V1);
    };
  }, [
    mapManager,
    nearestPlotId,
    nearest?.landmark.position[0],
    nearest?.landmark.position[2],
  ]);

  // Toast once per entry into a plot's radius.
  React.useEffect(() => {
    if (!nearest) {
      toastedPlotIdRef.current = undefined;
      return;
    }
    if (toastedPlotIdRef.current === nearest.landmark.plotId) {
      return;
    }
    toastedPlotIdRef.current = nearest.landmark.plotId;
    addToast(resources, {
      kind: "basic",
      id: `property-for-sale:${nearest.landmark.plotId}`,
      message: `Property For Sale — ${nearest.landmark.label.replace(
        /^For sale:\s*/i,
        ""
      )} · ${nearest.landmark.priceGold} gold`,
    });
  }, [resources, nearestPlotId]);

  return null;
}
