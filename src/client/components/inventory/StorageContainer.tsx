import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import {
  BiomesUIShopChrome,
  BiomesUIShopSection,
} from "@/client/components/inventory/BiomesUIShopChrome";
import { useInventoryControllerContext } from "@/client/components/inventory/InventoryControllerContext";
import { useOwnedItems } from "@/client/components/inventory/helpers";
import { InventoryOverrideContextProvider } from "@/client/components/inventory/InventoryOverrideContext";
import { NormalSlotWithTooltip } from "@/client/components/inventory/NormalSlotWithTooltip";
import { SelfInventoryRightPaneContent } from "@/client/components/inventory/SelfInventoryScreen";
import type { OpenContainer } from "@/client/components/inventory/types";
import { anItem, resolveItemAttributeId } from "@/shared/game/item";
import { cloneDeepWithItems } from "@/shared/game/item";
import type { ItemAndCount } from "@/shared/game/types";
import {
  findSlotToMergeIntoInventory,
  giveToOwnedItems,
  maybeGetSlotByRef,
  patternAsSingleRef,
  type OwnedItems,
} from "@/shared/game/inventory";
import {
  InventoryCombineEvent,
  InventorySwapEvent,
} from "@/shared/ecs/gen/events";
import {
  nativeRoadAheadContainerClaimForItem,
  NATIVE_ROAD_AHEAD_QUEST_ID,
} from "@/shared/harthmere/native_road_ahead_contract";
import { pollUntil } from "@/shared/util/async";
import { compact } from "lodash";
import { rowMajorIdx } from "@/shared/util/helpers";
import { range } from "lodash";
import type { PropsWithChildren } from "react";
import React from "react";
import { ItemIcon } from "@/client/components/inventory/ItemIcon";

export const StorageContainerLeftPaneContent: React.FunctionComponent<{
  openContainer: OpenContainer;
}> = ({ openContainer }) => {
  const { handleInventorySlotClick } = useInventoryControllerContext();
  const { reactResources, events, userId } = useClientContext();
  const [containerInventory, containerLabel] = reactResources.useAll(
    ["/ecs/c/container_inventory", openContainer.containerId],
    ["/ecs/c/label", openContainer.containerId]
  );
  const ownedItems = useOwnedItems(reactResources, userId);
  const [takingAll, setTakingAll] = React.useState(false);
  const [takeAllError, setTakeAllError] = React.useState<string>();
  const [takeAllSuccess, setTakeAllSuccess] = React.useState<string>();

  const numItems = containerInventory?.items.length ?? 0;
  const numCols = anItem(openContainer.itemId).numCols || 1;

  const derivedNumRows = Math.ceil(numItems / numCols);

  const takeAll = React.useCallback(async () => {
    if (takingAll || !containerInventory || !ownedItems.inventory) return;
    setTakingAll(true);
    setTakeAllError(undefined);
    setTakeAllSuccess(undefined);
    const received: string[] = [];
    try {
      // Plan against a mutable local projection so each item reserves or fills
      // a real backpack slot. Take All never spills wearables/materials into
      // hotbar, and it stops without swapping over an occupied incompatible
      // slot when the backpack is full.
      const projected = cloneDeepWithItems(ownedItems) as OwnedItems;
      const sourcePosition = reactResources.get(
        "/ecs/c/position",
        openContainer.containerId
      )?.v;
      const playerPosition = reactResources.get("/ecs/c/position", userId)?.v;
      const positions = compact([sourcePosition, playerPosition]);

      for (let idx = 0; idx < containerInventory.items.length; idx += 1) {
        const source = containerInventory.items[idx];
        if (!source) continue;
        const pattern = findSlotToMergeIntoInventory(projected, source, {
          spreadOk: false,
          noHotbar: true,
        });
        const destination = patternAsSingleRef(pattern);
        if (!destination || !pattern) {
          throw new Error("Backpack full");
        }
        const existing = maybeGetSlotByRef(projected, destination);
        const sourceRef = { kind: "item" as const, idx };
        if (existing) {
          await events.publish(
            new InventoryCombineEvent({
              src_id: openContainer.containerId,
              src: sourceRef,
              dst_id: userId,
              dst: destination,
              count: source.count,
              player_id: userId,
              positions,
            })
          );
        } else {
          await events.publish(
            new InventorySwapEvent({
              src_id: openContainer.containerId,
              src: sourceRef,
              dst_id: userId,
              dst: destination,
              player_id: userId,
              positions,
            })
          );
        }
        giveToOwnedItems(projected, pattern);
        const displayName = source.item.displayName ?? String(source.item.id);
        received.push(
          `${displayName}${source.count > 1n ? ` x${source.count}` : ""}`
        );

        const claim = nativeRoadAheadContainerClaimForItem(
          containerLabel?.text,
          source.item.id
        );
        if (claim) {
          // Road Ahead's reward choices are consecutive sequence leaves. Wait
          // for the authoritative trigger-state socket update before moving the
          // next item, otherwise a fast Take All can race the prior-step check.
          await pollUntil(
            () => {
              const raw = reactResources
                .get("/ecs/c/trigger_state", userId)
                ?.by_root.get(NATIVE_ROAD_AHEAD_QUEST_ID)
                ?.get(claim.stepId);
              return raw !== undefined && raw !== 0;
            },
            { timeout: 10_000, timeoutText: "Quest update timed out" }
          );
        }
      }
      if (received.length > 0) {
        setTakeAllSuccess(`Received ${received.join(", ")}.`);
      }
    } catch (error) {
      setTakeAllError(
        error instanceof Error ? error.message : "Could not take all items"
      );
    } finally {
      setTakingAll(false);
    }
  }, [
    containerInventory,
    containerLabel?.text,
    events,
    openContainer.containerId,
    ownedItems,
    reactResources,
    takingAll,
    userId,
  ]);

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
      {containerInventory?.items.some(Boolean) ? (
        <button
          type="button"
          className="biomes-ui-shop-button"
          disabled={takingAll}
          onClick={() => void takeAll()}
        >
          {takingAll ? "Taking…" : "Take All"}
        </button>
      ) : null}
      {takeAllError ? (
        <p role="alert" className="biomes-ui-shop-muted">
          {takeAllError}
        </p>
      ) : null}
      {takeAllSuccess ? (
        <p role="status" className="biomes-ui-shop-muted">
          {takeAllSuccess}
        </p>
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
