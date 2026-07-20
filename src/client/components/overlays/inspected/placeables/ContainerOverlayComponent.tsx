import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import type { InspectShortcuts } from "@/client/components/overlays/inspected/CursorInspectionOverlayComponent";
import { CursorInspectionComponent } from "@/client/components/overlays/inspected/CursorInspectionOverlayComponent";
import type { PlaceableInspectOverlay } from "@/client/game/resources/overlays";
import { useUserCanAction } from "@/client/util/permissions_manager_hooks";
import { StartPlaceableAnimationEvent } from "@/shared/ecs/gen/events";
import { CONTAINER_ACCESS_ACL_ACTION } from "@/shared/game/container_access";
import { fireAndForget } from "@/shared/util/async";

export const ContainerOverlayComponent: React.FunctionComponent<{
  overlay: PlaceableInspectOverlay;
}> = ({ overlay }) => {
  const { reactResources, events } = useClientContext();
  // Storage access is governed by the interaction ACL. Requiring `destroy`
  // made public and quest containers visible but impossible to open unless the
  // visitor also had permission to demolish them.
  const canAccess = useUserCanAction(
    overlay.entityId,
    CONTAINER_ACCESS_ACL_ACTION
  );

  const shortcuts: InspectShortcuts = canAccess
    ? [
        {
          title: "Open Container",
          onKeyDown: () => {
            fireAndForget(
              events.publish(
                new StartPlaceableAnimationEvent({
                  id: overlay.entityId,
                  animation_type: "open",
                })
              )
            );
            setTimeout(() => {
              reactResources.set("/game_modal", {
                kind: "generic_miniphone",
                rootPayload: {
                  type: "container",
                  placeableId: overlay.entityId,
                  itemId: overlay.itemId,
                },
                onClose: () => {
                  fireAndForget(
                    events.publish(
                      new StartPlaceableAnimationEvent({
                        id: overlay.entityId,
                        animation_type: "close",
                      })
                    )
                  );
                },
              });
            }, 600);
          },
        },
      ]
    : [];

  return <CursorInspectionComponent overlay={overlay} shortcuts={shortcuts} />;
};
