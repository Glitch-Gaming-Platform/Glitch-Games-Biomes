import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import type { InspectShortcuts } from "@/client/components/overlays/inspected/CursorInspectionOverlayComponent";
import { CursorInspectionComponent } from "@/client/components/overlays/inspected/CursorInspectionOverlayComponent";
import type { GrabBagInspectOverlay } from "@/client/game/resources/overlays";
import { PickUpEvent } from "@/shared/ecs/gen/events";
import { fireAndForget } from "@/shared/util/async";
import { useState } from "react";

/**
 * Manual pickup fallback for native ECS GrabBags. Automatic pickup remains the
 * fast path, but an explicit F action keeps crop/mining/NPC drops recoverable
 * when automatic block pickup is disabled or world synchronization is delayed.
 */
export const GrabBagInspectionOverlayComponent: React.FunctionComponent<{
  overlay: GrabBagInspectOverlay;
}> = ({ overlay }) => {
  const { events, userId } = useClientContext();
  const [pending, setPending] = useState(false);
  const shortcuts: InspectShortcuts = [
    {
      title: pending ? "Picking up…" : "Pick Up Items",
      disabled: pending,
      onKeyDown: () => {
        if (pending) return;
        setPending(true);
        fireAndForget(
          events
            .publish(new PickUpEvent({ id: userId, item: overlay.entityId }))
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
