import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import type { InspectShortcuts } from "@/client/components/overlays/inspected/CursorInspectionOverlayComponent";
import { CursorInspectionComponent } from "@/client/components/overlays/inspected/CursorInspectionOverlayComponent";
import {
  acquiredInventoryCountForBag,
  snapshotInventoryCountsForBag,
  totalItemCountInBag,
} from "@/client/components/overlays/inspected/nativeEcsAcquisitionFeedback";
import { addToast } from "@/client/components/toast/helpers";
import type { GrabBagInspectOverlay } from "@/client/game/resources/overlays";
import { PickUpEvent } from "@/shared/ecs/gen/events";
import { fireAndForget, sleep } from "@/shared/util/async";
import { useState } from "react";

/**
 * Manual pickup fallback for native ECS GrabBags. Automatic pickup remains the
 * fast path, but an explicit F action keeps crop/mining/NPC drops recoverable
 * when automatic block pickup is disabled or world synchronization is delayed.
 */
export const GrabBagInspectionOverlayComponent: React.FunctionComponent<{
  overlay: GrabBagInspectOverlay;
}> = ({ overlay }) => {
  const { events, resources, userId } = useClientContext();
  const [pending, setPending] = useState(false);
  const shortcuts: InspectShortcuts = [
    {
      title: pending ? "Picking up…" : "Pick Up Items",
      disabled: pending,
      onKeyDown: () => {
        if (pending) return;
        setPending(true);
        fireAndForget(
          (async () => {
            const bag = resources.get(
              "/ecs/c/grab_bag",
              overlay.entityId
            )?.slots;
            const inventoryBefore = snapshotInventoryCountsForBag(
              resources.get("/ecs/c/inventory", userId),
              bag
            );
            await events.publish(
              new PickUpEvent({ id: userId, item: overlay.entityId })
            );

            for (let attempt = 0; attempt < 40; attempt += 1) {
              const acquisition = resources.get(
                "/ecs/c/acquisition",
                overlay.entityId
              );
              if (acquisition?.acquired_by !== undefined) {
                if (acquisition.acquired_by !== userId) {
                  throw new Error("already_acquired");
                }
                const acquired = acquiredInventoryCountForBag(
                  inventoryBefore,
                  resources.get("/ecs/c/inventory", userId),
                  bag
                );
                const total = totalItemCountInBag(bag);
                addToast(resources, {
                  kind: "basic",
                  id: `native-grab-bag-picked-up:${overlay.entityId}`,
                  message:
                    acquired >= total
                      ? "Items added to your inventory."
                      : acquired > 0n
                      ? "Items picked up. Backpack overflow was dropped nearby."
                      : "Backpack full. The items remain in a nearby native drop.",
                });
                return;
              }
              await sleep(250);
            }
            throw new Error("pickup_not_applied");
          })()
            .catch((error) => {
              addToast(resources, {
                kind: "basic",
                id: `native-grab-bag-pickup-failed:${overlay.entityId}`,
                message:
                  error instanceof Error && error.message === "already_acquired"
                    ? "Those items were already picked up."
                    : "Items were not picked up. Move closer and try again.",
              });
            })
            .finally(() => setPending(false))
        );
      },
    },
  ];
  return (
    <CursorInspectionComponent
      overlay={overlay}
      title="Dropped Items"
      shortcuts={shortcuts}
      suppressTalkShortcut
    />
  );
};
