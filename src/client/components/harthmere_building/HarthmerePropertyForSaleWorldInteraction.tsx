// HarthmerePropertyForSaleWorldInteraction — when the local player walks up to
// a for-sale property plot, drop a light-blue beam over the land and pop a
// "Property For Sale" toast. Mirrors the jobs-board / business world-interaction
// components: it reads the live player position and reacts to proximity.

import * as React from "react";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { harthmereJobsBoardPlayerPosition } from "@/client/components/harthmere_jobs_board/HarthmereJobsBoardWorldInteraction";
import {
  HARTHMERE_PROPERTY_BUILDING_STATE_EVENT,
  harthmerePurchasablePlotMapLandmarksFromBuildingState,
  type HarthmerePropertyMapBuildingState,
} from "@/client/components/biomes_ui/adapters/propertyMapMarkers";
import { addToast } from "@/client/components/toast/helpers";
import { harthmereGroundedFeetYWithMemory } from "@/client/game/util/harthmere_entity_grounding";
import { nearestPropertyForSaleLandmark } from "./propertyForSaleProximity";

export const HARTHMERE_PROPERTY_FOR_SALE_WORLD_INTERACTION_VERSION =
  "harthmere-property-for-sale-world-interaction" as const;

// Stable nav-aid id so we only ever keep one for-sale beam at a time.
const PROPERTY_FOR_SALE_NAV_AID_ID = 914_701;
// Show the hint a bit further out than a doorway so the beam (which only renders
// past MapManager.MIN_BEAM_DISTANCE = 10) is visible as you approach.
const PROPERTY_FOR_SALE_HINT_RADIUS = 18;

export function HarthmerePropertyForSaleWorldInteraction({
  suppressPrompt = false,
}: { suppressPrompt?: boolean } = {}) {
  const { reactResources, resources, mapManager } = useClientContext();
  const localPlayer = reactResources.use("/scene/local_player") as unknown;
  const camera = reactResources.use("/scene/camera") as unknown;

  const [buildingState, setBuildingState] = React.useState<
    HarthmerePropertyMapBuildingState | undefined
  >(undefined);

  // The live adapters already fetch building state and broadcast it; reuse that
  // so we know which plots are still for sale without a second fetch.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    function onUpdate(event: Event) {
      const detail = (event as CustomEvent)?.detail?.buildingState;
      if (detail && typeof detail === "object") {
        setBuildingState(detail as HarthmerePropertyMapBuildingState);
      }
    }
    window.addEventListener(
      HARTHMERE_PROPERTY_BUILDING_STATE_EVENT,
      onUpdate as EventListener
    );
    return () =>
      window.removeEventListener(
        HARTHMERE_PROPERTY_BUILDING_STATE_EVENT,
        onUpdate as EventListener
      );
  }, []);

  const forSale = React.useMemo(
    () => harthmerePurchasablePlotMapLandmarksFromBuildingState(buildingState),
    [buildingState]
  );

  const player = harthmereJobsBoardPlayerPosition(
    localPlayer as any,
    camera as any
  );
  const nearest = suppressPrompt
    ? undefined
    : nearestPropertyForSaleLandmark(
        forSale,
        player ? { x: player.x, z: player.z } : undefined,
        PROPERTY_FOR_SALE_HINT_RADIUS
      );

  const nearestPlotId = nearest?.landmark.plotId;
  const toastedPlotIdRef = React.useRef<string | undefined>(undefined);
  // Per-column last-grounded surface memory, shared with the NPC/animal/marker
  // grounder. Rests the for-sale beam on the REAL terrain (cave-safe, water-aware)
  // instead of the flat authored plot Y, exactly like the muckers/animals/quest
  // markers — so the beam never floats above or buries below the plot ground.
  const groundCacheRef = React.useRef<Map<string, number>>(new Map());

  const beamPosition = React.useMemo<[number, number, number] | undefined>(() => {
    const pos = nearest?.landmark.position;
    if (!pos) {
      return undefined;
    }
    const feetY = harthmereGroundedFeetYWithMemory(
      resources,
      groundCacheRef.current,
      pos[0],
      pos[2],
      pos[1],
      true
    );
    // Fall back to the authored Y while the plot terrain is still streaming in;
    // a later render re-grounds it once the surface is known.
    return [pos[0], feetY ?? pos[1], pos[2]];
  }, [
    resources,
    nearest?.landmark.position[0],
    nearest?.landmark.position[1],
    nearest?.landmark.position[2],
  ]);

  // Beam: register/move a light-blue navigation aid over the nearest for-sale
  // plot, and tear it down when none is in range.
  React.useEffect(() => {
    if (!beamPosition) {
      mapManager.removeNavigationAid(PROPERTY_FOR_SALE_NAV_AID_ID);
      return;
    }
    mapManager.addNavigationAid(
      {
        kind: "property_for_sale",
        autoremoveWhenNear: false,
        target: { kind: "position", position: beamPosition },
      },
      PROPERTY_FOR_SALE_NAV_AID_ID
    );
    return () => {
      mapManager.removeNavigationAid(PROPERTY_FOR_SALE_NAV_AID_ID);
    };
  }, [mapManager, nearestPlotId, beamPosition?.[0], beamPosition?.[1], beamPosition?.[2]]);

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
