import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import {
  BiomesUIShopChrome,
  BiomesUIShopSection,
} from "@/client/components/inventory/BiomesUIShopChrome";
import { useInventoryControllerContext } from "@/client/components/inventory/InventoryControllerContext";
import { InventoryOverrideContextProvider } from "@/client/components/inventory/InventoryOverrideContext";
import { NormalSlotWithTooltip } from "@/client/components/inventory/NormalSlotWithTooltip";
import { SelfInventoryRightPaneContent } from "@/client/components/inventory/SelfInventoryScreen";
import type { OpenContainer } from "@/client/components/inventory/types";
import { anItem, resolveItemAttributeId } from "@/shared/game/item";
import type { ItemAndCount } from "@/shared/game/types";
import { rowMajorIdx } from "@/shared/util/helpers";
import { range } from "lodash";
import type { PropsWithChildren } from "react";
import React from "react";
import { ItemIcon } from "@/client/components/inventory/ItemIcon";

export const StorageContainerLeftPaneContent: React.FunctionComponent<{
  openContainer: OpenContainer;
}> = ({ openContainer }) => {
  const { handleInventorySlotClick } = useInventoryControllerContext();
  const { reactResources } = useClientContext();
  const containerInventory = reactResources.use(
    "/ecs/c/container_inventory",
    openContainer.containerId
  );

  const numItems = containerInventory?.items.length ?? 0;
  const numCols = anItem(openContainer.itemId).numCols || 1;

  const derivedNumRows = Math.ceil(numItems / numCols);

  return (
    <div
      className="biomes-ui-storage-container-grid"
      style={{
        gridTemplateColumns: `repeat(${Math.max(
          1,
          numCols
        )}, var(--cell-width))`,
      }}
    >
      {range(derivedNumRows).map((row) => (
        <React.Fragment key={`row${row}`}>
          {range(numCols).map((col) => {
            const slotIdx = rowMajorIdx(numCols, row, col);
            return (
              <NormalSlotWithTooltip
                key={`row${row}-item-${col}`}
                slotType="inventory"
                entityId={openContainer.containerId}
                slot={containerInventory?.items[slotIdx]}
                slotReference={{
                  kind: "item",
                  idx: slotIdx,
                }}
                onClick={handleInventorySlotClick}
              />
            );
          })}
        </React.Fragment>
      ))}
      {derivedNumRows === 0 ? (
        <p className="biomes-ui-shop-muted">This container has no slots.</p>
      ) : null}
    </div>
  );
};

const StorageContainerIdentity: React.FunctionComponent<{
  openContainer: OpenContainer;
}> = ({ openContainer }) => {
  const { reactResources } = useClientContext();
  const item = anItem(openContainer.itemId);
  const containerInventory = reactResources.use(
    "/ecs/c/container_inventory",
    openContainer.containerId
  );
  const slots = containerInventory?.items.length ?? 0;
  return (
    <div className="biomes-ui-shop-merchant">
      <ItemIcon item={item} className="avatar" />
      <div className="biomes-ui-shop-merchant__copy">
        <strong>{item.displayName}</strong>
        <span>
          {slots.toLocaleString()} storage slot{slots === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
};

export const StorageContainerScreen: React.FunctionComponent<
  PropsWithChildren<{
    openContainer: OpenContainer;
  }>
> = ({ openContainer, children }) => {
  const containerItem = anItem(openContainer.itemId);
  const screenTitle = containerItem.displayName;

  const disableSlotPredicate = (item: ItemAndCount | undefined) => {
    if (containerItem.compatibleItemPredicates === undefined) {
      return false;
    }

    if (!item) {
      return true;
    }

    for (const attributeId of containerItem.compatibleItemPredicates) {
      if (resolveItemAttributeId(item.item, attributeId)) {
        return false;
      }
    }
    return true;
  };

  return (
    <InventoryOverrideContextProvider>
      <BiomesUIShopChrome
        title={screenTitle}
        eyebrow="Container Storage"
        variant="container"
        subtitle="Move items between this container and your inventory."
      >
        <BiomesUIShopSection
          title="Container"
          meta={`${containerItem.numCols || 1} column${
            (containerItem.numCols || 1) === 1 ? "" : "s"
          }`}
        >
          <StorageContainerIdentity openContainer={openContainer} />
          <StorageContainerLeftPaneContent openContainer={openContainer} />
        </BiomesUIShopSection>
        <BiomesUIShopSection
          title="Your Inventory"
          className="biomes-ui-shop-section--inventory"
        >
          <div className="biomes-ui-shop-inventory-pane biomes-ui-inventory-pane">
            <SelfInventoryRightPaneContent
              className="biomes-ui-inventory-stack"
              disableSlotPredicate={disableSlotPredicate}
            >
              {children}
            </SelfInventoryRightPaneContent>
          </div>
        </BiomesUIShopSection>
      </BiomesUIShopChrome>
    </InventoryOverrideContextProvider>
  );
};
