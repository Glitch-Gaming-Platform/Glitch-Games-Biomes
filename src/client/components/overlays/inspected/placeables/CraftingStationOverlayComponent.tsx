import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import type { InspectShortcuts } from "@/client/components/overlays/inspected/CursorInspectionOverlayComponent";
import { CursorInspectionComponent } from "@/client/components/overlays/inspected/CursorInspectionOverlayComponent";
import { openHarthmereCookingStation } from "@/client/components/harthmere_cooking/harthmereCookingStations";
import { useCheckPlaceableBuildingRequirements } from "@/client/game/helpers/placeables";
import type { PlaceableInspectOverlay } from "@/client/game/resources/overlays";
import { anItem } from "@/shared/game/item";
import { harthmereCookStationKindForText } from "@/shared/harthmere/object_interaction_semantics";
import { useMemo } from "react";
import { HARTHMERE_PLACED_COOK_STATION_RE } from "./craftingStationCookRouting";

export const CraftingStationOverlayComponent: React.FunctionComponent<{
  overlay: PlaceableInspectOverlay;
}> = ({ overlay }) => {
  const { resources, reactResources } = useClientContext();

  const placeable = reactResources.use(
    "/ecs/c/placeable_component",
    overlay.entityId
  );

  const meetsBuildingReqs = useCheckPlaceableBuildingRequirements(
    overlay.entityId
  );

  const title = useMemo(() => {
    const item = anItem(overlay.itemId);
    const displayName = item.displayName;
    if (meetsBuildingReqs) {
      return displayName;
    }
    const reqs = item.buildingRequirements;
    if (reqs === "roof") {
      return `${displayName} requires a roof to use`;
    } else if (reqs === "noRoof") {
      return `${displayName} requires no roof to use`;
    }
    return `${displayName} requires ${reqs} to use`;
  }, [meetsBuildingReqs, overlay.itemId]);

  if (!placeable) {
    return <></>;
  }

  const item = anItem(overlay.itemId);
  const stationText = `${overlay.itemId} ${item.displayName ?? ""}`;
  const isCookStation = HARTHMERE_PLACED_COOK_STATION_RE.test(stationText);

  const shortcuts: InspectShortcuts = [];
  if (isCookStation) {
    const stationKind = harthmereCookStationKindForText(stationText);
    shortcuts.push({
      title: meetsBuildingReqs ? `Cook at ${item.displayName}` : title,
      disabled: !meetsBuildingReqs,
      onKeyDown: () => {
        openHarthmereCookingStation({
          stationId: `ecs:${overlay.entityId}`,
          stationKind,
          label: item.displayName,
          entityId: overlay.entityId,
        });
      },
    });
  } else {
    shortcuts.push({
      title,
      disabled: !meetsBuildingReqs,
      onKeyDown: () => {
        resources.set("/game_modal", {
          kind: "crafting",
          payload: {
            type: "crafting_station",
            stationEntityId: overlay.entityId,
          },
        });
      },
    });
  }

  return <CursorInspectionComponent overlay={overlay} shortcuts={shortcuts} />;
};
