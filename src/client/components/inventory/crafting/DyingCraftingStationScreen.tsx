import {
  CharacterPreview,
  makePreviewSlot,
} from "@/client/components/character/CharacterPreview";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { useClientSideContainer } from "@/client/components/inventory/client_side_container";
import { useOwnedItems } from "@/client/components/inventory/helpers";
import {
  BiomesUIShopChrome,
  BiomesUIShopSection,
} from "@/client/components/inventory/BiomesUIShopChrome";
import { useInventoryDraggerContext } from "@/client/components/inventory/InventoryDragger";
import { InventoryOverrideContextProvider } from "@/client/components/inventory/InventoryOverrideContext";
import { NormalSlotWithTooltip } from "@/client/components/inventory/NormalSlotWithTooltip";
import { SelfInventoryRightPaneContent } from "@/client/components/inventory/SelfInventoryScreen";
import { attribs } from "@/shared/bikkie/schema/attributes";
import { InventoryDyeEvent } from "@/shared/ecs/gen/events";
import type { ItemAssignment } from "@/shared/ecs/gen/types";
import { getSlotByRef } from "@/shared/game/inventory";
import type { ItemPayload } from "@/shared/game/item";
import { anItem } from "@/shared/game/item";
import { findItemEquippableSlot } from "@/shared/game/wearables";
import type { BiomesId } from "@/shared/ids";
import { isDyeItem, itemIsDyeable } from "@/shared/util/dye_helpers";
import { compact } from "lodash";
import { useCallback, useMemo } from "react";

const DyingCraftingStationLeftPane: React.FunctionComponent<{}> = ({}) => {
  const { events, reactResources, userId } = useClientContext();
  const { inventory, wearing } = useOwnedItems(reactResources, userId);

  const { dragItem, setDragItem } = useInventoryDraggerContext();

  const clientSideContainer = useClientSideContainer(2);
  const DYE_IDX = 0;
  const ITEM_IDX = 1;

  const handleDyeCellClick = useCallback(() => {
    const dyeItem = clientSideContainer.slots[DYE_IDX];
    if (dragItem && dragItem.kind === "inventory_drag") {
      const slot = getSlotByRef({ inventory, wearing }, dragItem.slotReference);
      if (slot && isDyeItem(slot.item)) {
        clientSideContainer.setSlotAtIndex(DYE_IDX, {
          refSlot: dragItem.slotReference,
          quantity: 1n,
        });
      }
      setDragItem(null);
    } else if (dyeItem) {
      setDragItem({
        kind: "ephemeral",
        item: dyeItem.item,
        slotDropCallback: () => {
          clientSideContainer.setSlotAtIndex(DYE_IDX, undefined);
          setDragItem(null);
        },
      });
    }
  }, [dragItem, clientSideContainer]);

  const handleItemCellClick = useCallback(() => {
    const itemItem = clientSideContainer.slots[ITEM_IDX];
    if (dragItem && dragItem.kind === "inventory_drag") {
      const slot = getSlotByRef({ inventory, wearing }, dragItem.slotReference);
      if (slot && itemIsDyeable(slot.item)) {
        clientSideContainer.setSlotAtIndex(ITEM_IDX, {
          refSlot: dragItem.slotReference,
          quantity: 1n,
        });
      }
      setDragItem(null);
    } else if (itemItem) {
      setDragItem({
        kind: "ephemeral",
        item: itemItem.item,
        slotDropCallback: () => {
          clientSideContainer.setSlotAtIndex(ITEM_IDX, undefined);
          setDragItem(null);
        },
      });
    }
  }, [dragItem, inventory, wearing, clientSideContainer]);

  const handleDye = useCallback(async () => {
    const dyeItem = clientSideContainer.slots[DYE_IDX];
    const itemItem = clientSideContainer.slots[ITEM_IDX];
    if (!dyeItem || !itemItem) {
      return;
    }
    await events.publish(
      new InventoryDyeEvent({
        id: userId,
        src: dyeItem.refSlot,
        dst: itemItem.refSlot,
      })
    );

    clientSideContainer.clear();
  }, [clientSideContainer]);

  const wearableOverrides = useMemo(() => {
    const ret: ItemAssignment = new Map(wearing?.items.entries());
    const dyeItem = clientSideContainer.slots[DYE_IDX];
    const itemItem = clientSideContainer.slots[ITEM_IDX];
    if (itemItem) {
      const slot = findItemEquippableSlot(itemItem.item.item);
      if (slot) {
        if (dyeItem) {
          const base: ItemPayload = {
            ...itemItem.item.item.payload,
            [attribs.dyedWith.id]: dyeItem.item.item.id,
          };
          ret.set(slot, anItem(itemItem.item.item.id, base));
        } else {
          ret.set(slot, itemItem.item.item);
        }
      }
    }
    return ret;
  }, [wearing, clientSideContainer]);
  const filledSlots = compact(clientSideContainer.slots).length;
  return (
    <BiomesUIShopSection title="Dye Bay" meta={`${filledSlots}/2 inputs`}>
      <div className="biomes-ui-workshop-station biomes-ui-workshop-station--dye">
        <div className="biomes-ui-workshop-slot">
          <NormalSlotWithTooltip
            slot={clientSideContainer.slots[DYE_IDX]?.item}
            slotReference={{
              kind: "item",
              idx: 0,
            }}
            entityId={123 as BiomesId}
            onClick={handleDyeCellClick}
          />
          <span>Dye</span>
        </div>
        <div className="biomes-ui-workshop-slot">
          <NormalSlotWithTooltip
            slot={clientSideContainer.slots[ITEM_IDX]?.item}
            slotReference={{
              kind: "item",
              idx: 0,
            }}
            entityId={123 as BiomesId}
            onClick={handleItemCellClick}
          />
          <span>Dyeable Item</span>
        </div>
        <div className="biomes-ui-workshop-preview">
          <CharacterPreview
            key="bbq"
            previewSlot={makePreviewSlot("dying", userId)}
            wearableOverrides={wearableOverrides}
            entityId={userId}
          />
          <span>Preview</span>
        </div>
      </div>
      <div className="biomes-ui-workshop-actions">
        <button
          type="button"
          className="biomes-ui-action-button"
          disabled={filledSlots !== 2}
          onClick={handleDye}
        >
          Dye
        </button>
      </div>
    </BiomesUIShopSection>
  );
};

export const DyingCraftingStationScreen: React.FunctionComponent<{
  stationEntityId?: BiomesId;
}> = ({}) => {
  return (
    <InventoryOverrideContextProvider>
      <BiomesUIShopChrome
        title="Dye-o-matic"
        eyebrow="Crafting Station"
        variant="container"
        subtitle="Slot a dye and dyeable item, then preview the result before applying it."
      >
        <DyingCraftingStationLeftPane />
        <BiomesUIShopSection
          title="Your Inventory"
          className="biomes-ui-shop-section--inventory"
        >
          <div className="biomes-ui-shop-inventory-pane biomes-ui-inventory-pane">
            <SelfInventoryRightPaneContent className="biomes-ui-inventory-stack" />
          </div>
        </BiomesUIShopSection>
      </BiomesUIShopChrome>
    </InventoryOverrideContextProvider>
  );
};
