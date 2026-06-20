import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { useClientSideContainer } from "@/client/components/inventory/client_side_container";
import { useOwnedItems } from "@/client/components/inventory/helpers";
import { useInventoryDraggerContext } from "@/client/components/inventory/InventoryDragger";
import { InventoryOverrideContextProvider } from "@/client/components/inventory/InventoryOverrideContext";
import type { TooltipFlair } from "@/client/components/inventory/InventoryViewContext";
import { InventoryViewContext } from "@/client/components/inventory/InventoryViewContext";
import { InventoryAndHotbarDisplay } from "@/client/components/inventory/InventoryAndHotbarDisplay";
import { NormalSlotWithTooltip } from "@/client/components/inventory/NormalSlotWithTooltip";
import {
  BiomesUIShopChrome,
  BiomesUIShopSection,
} from "@/client/components/inventory/BiomesUIShopChrome";
import {
  buildNpcSellToEntityEvent,
  canSellItemToNpcBuyer,
  chunkShopSlotIndexesForRovingGrid,
} from "@/client/components/inventory/shopBiomesUIModel";
import { EntityProfilePic } from "@/client/components/social/EntityProfilePic";
import { CurrencyWithGlyph } from "@/client/components/system/CurrencyWithGlyph";
import { RovingGrid } from "@/client/components/biomes_ui/nav/RovingGrid";
import { BikkieIds } from "@/shared/bikkie/ids";
import { attribs } from "@/shared/bikkie/schema/attributes";
import type {
  InventoryAssignmentPattern,
  ItemAndCount,
  OwnedItemReference,
} from "@/shared/ecs/gen/types";
import { maybeGetSlotByRef } from "@/shared/game/inventory";
import { countOf, createBag } from "@/shared/game/items";
import { bagSellPrice, isSellable, unitSellPrice } from "@/shared/game/sales";
import type { BiomesId } from "@/shared/ids";
import { fireAndForget } from "@/shared/util/async";
import { andify } from "@/shared/util/text";
import { startCase } from "lodash";
import pluralize from "pluralize";
import type { PropsWithChildren } from "react";
import React, { useCallback, useMemo } from "react";

const ItemBuyerLeftPaneContent: React.FunctionComponent<
  PropsWithChildren<{
    entityId: BiomesId;
    disableSlotPredicate: (item: ItemAndCount | undefined) => boolean;
  }>
> = ({ entityId, disableSlotPredicate, children }) => {
  const { reactResources, events, userId } = useClientContext();
  const { dragItem, setDragItem } = useInventoryDraggerContext();
  const ownedItems = useOwnedItems(reactResources, userId);

  const numItems = 12;
  const numCols = 3;
  const slotRows = useMemo(
    () => chunkShopSlotIndexesForRovingGrid(numItems, numCols),
    []
  );
  const clientSideContainer = useClientSideContainer(numItems);
  const itemBuyer = reactResources.use("/ecs/c/item_buyer", entityId);

  const friendlyBuyerStrings = itemBuyer?.attribute_ids
    .map((attribute) =>
      pluralize(startCase(attribs.byId.get(attribute)?.name.replace(/^is/, "")))
    )
    .filter((attribute) => attribute != undefined);

  const friendlyBuyerString = friendlyBuyerStrings
    ? `I'm interested in ${andify(friendlyBuyerStrings)}`
    : undefined;

  const buyerString = itemBuyer?.buy_description ?? friendlyBuyerString;
  const entity = reactResources.use("/ecs/entity", entityId);

  const filledSlotAssignment = useMemo<InventoryAssignmentPattern>(
    () =>
      clientSideContainer.slots.flatMap((e) => {
        if (e && canSellItemToNpcBuyer(e.item, itemBuyer?.attribute_ids)) {
          return [[e.refSlot, e.item]] as Array<
            [OwnedItemReference, ItemAndCount]
          >;
        }
        return [];
      }),
    [clientSideContainer.slots, ownedItems, itemBuyer?.attribute_ids]
  );

  const fillBag = useMemo(() => {
    return createBag(...filledSlotAssignment.map((e) => e[1]));
  }, [filledSlotAssignment]);

  const handleNpcBuyerCellClick = useCallback(
    (slotIdx: number) => {
      if (!dragItem && clientSideContainer.slots[slotIdx]) {
        const surrogateItem = clientSideContainer.slots[slotIdx];
        const item = maybeGetSlotByRef(ownedItems, surrogateItem?.refSlot);
        if (item && surrogateItem) {
          setDragItem({
            kind: "ephemeral",
            item: item,
            quantity: surrogateItem.quantity,
            slotDropCallback: () => {
              clientSideContainer.setSlotAtIndex(slotIdx, undefined);
              setDragItem(null);
            },
          });
        }
        return;
      } else if (dragItem) {
        if (dragItem.kind === "inventory_drag") {
          const item = maybeGetSlotByRef(ownedItems, dragItem.slotReference);
          if (item && canSellItemToNpcBuyer(item, itemBuyer?.attribute_ids)) {
            clientSideContainer.setSlotAtIndex(slotIdx, {
              refSlot: dragItem.slotReference,
              quantity: dragItem.quantity,
            });
          }
          setDragItem(null);
        }
      }
    },
    [dragItem, clientSideContainer, ownedItems, itemBuyer?.attribute_ids]
  );

  const handleSell = useCallback(() => {
    if (filledSlotAssignment.length === 0) {
      return;
    }
    fireAndForget(
      events.publish(
        buildNpcSellToEntityEvent({
          buyerEntityId: entityId,
          sellerId: userId,
          src: [...filledSlotAssignment],
        })
      )
    );
  }, [events, entityId, userId, filledSlotAssignment]);

  const totalPrice = bagSellPrice(fillBag);

  return (
    <BiomesUIShopChrome
      title="Sell Items"
      eyebrow="Buyer Interface"
      variant="npc-buyer"
      subtitle={
        buyerString ?? "Choose items this buyer accepts, then confirm the sale."
      }
    >
      <BiomesUIShopSection
        title="Buyer"
        meta={`${filledSlotAssignment.length} staged`}
      >
        <div className="biomes-ui-shop-merchant">
          <EntityProfilePic entityId={entityId} />
          <div className="biomes-ui-shop-merchant__copy">
            <strong>{entity?.label?.text ?? "Buyer"}</strong>
            <span>{buyerString ?? "Waiting for accepted goods."}</span>
          </div>
        </div>
        <RovingGrid
          ariaLabel="Items staged for sale"
          className="biomes-ui-shop-grid"
          items={slotRows}
          onActivate={(_row, _col, slotIdx) => handleNpcBuyerCellClick(slotIdx)}
          renderCell={(slotIdx, { focused }, cell) => {
            const itemRef = clientSideContainer.slots[slotIdx];
            const itemLabel =
              itemRef?.item.item.displayName ??
              (dragItem ? "Drop item" : "Empty slot");
            return (
              <button
                key={`item-buyer-slot-${slotIdx}`}
                ref={cell.ref}
                type="button"
                tabIndex={cell.tabIndex}
                onFocus={cell.onFocus}
                onClick={cell.onClick}
                onKeyDown={cell.onKeyDown}
                className="biomes-ui-shop-slot-button"
                data-focused={focused ? "true" : undefined}
                aria-label={`Sale slot ${slotIdx + 1}: ${itemLabel}`}
                data-biomes-ui-shop-initial-focus={
                  slotIdx === 0 ? "true" : undefined
                }
              >
                <NormalSlotWithTooltip
                  slotType="shop"
                  entityId={userId}
                  slot={itemRef?.item}
                  slotReference={{
                    kind: "item",
                    idx: slotIdx,
                  }}
                />
                <span className="biomes-ui-shop-slot-button__label">
                  {itemRef ? (
                    <>
                      <strong>{itemRef.item.item.displayName}</strong>
                      <span>x{itemRef.item.count.toLocaleString()}</span>
                    </>
                  ) : (
                    <span>{dragItem ? "Drop" : "Empty"}</span>
                  )}
                </span>
              </button>
            );
          }}
        />
      </BiomesUIShopSection>

      <BiomesUIShopSection
        title="Your Inventory"
        meta="Drag, tap, or use item controls"
        className="biomes-ui-shop-section--inventory"
      >
        <div className="biomes-ui-shop-inventory-pane">
          <InventoryAndHotbarDisplay
            disableSlotPredicate={disableSlotPredicate}
          />
          {children}
        </div>
      </BiomesUIShopSection>

      <BiomesUIShopSection
        title="Sale Summary"
        className="biomes-ui-shop-section--summary"
      >
        <div className="biomes-ui-shop-total">
          {totalPrice === 0n ? (
            "No accepted items staged"
          ) : (
            <>
              Sell for{" "}
              <span>
                <CurrencyWithGlyph
                  itemAndCount={countOf(BikkieIds.bling, totalPrice)}
                />
              </span>
            </>
          )}
        </div>
        <button
          type="button"
          className="biomes-ui-action-button"
          disabled={filledSlotAssignment.length === 0}
          onClick={handleSell}
        >
          Sell Items
        </button>
      </BiomesUIShopSection>
    </BiomesUIShopChrome>
  );
};

export const ItemBuyerScreen: React.FunctionComponent<
  PropsWithChildren<{
    entityId: BiomesId;
  }>
> = ({ entityId, children }) => {
  const { reactResources } = useClientContext();
  const itemBuyer = reactResources.use("/ecs/c/item_buyer", entityId);
  const disableSlotPredicate = (item: ItemAndCount | undefined) => {
    return item
      ? !canSellItemToNpcBuyer(item, itemBuyer?.attribute_ids)
      : false;
  };
  return (
    <InventoryOverrideContextProvider>
      <InventoryViewContext.Provider
        value={{
          tooltipFlairForItem(item): TooltipFlair[] {
            if (
              !isSellable(item.item) ||
              !canSellItemToNpcBuyer(item, itemBuyer?.attribute_ids)
            ) {
              return [];
            }

            return [
              {
                kind: "sale",
                unitPrice: countOf(BikkieIds.bling, unitSellPrice(item.item)),
              },
            ];
          },
        }}
      >
        <ItemBuyerLeftPaneContent
          entityId={entityId}
          disableSlotPredicate={disableSlotPredicate}
        >
          {children}
        </ItemBuyerLeftPaneContent>
      </InventoryViewContext.Provider>
    </InventoryOverrideContextProvider>
  );
};
