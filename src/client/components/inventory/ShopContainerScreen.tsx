import { AvatarView } from "@/client/components/chat/Links";
import { RovingGrid } from "@/client/components/biomes_ui/nav/RovingGrid";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import type { ClientSideContainerItem } from "@/client/components/inventory/client_side_container";
import { useClientSideContainer } from "@/client/components/inventory/client_side_container";
import {
  BiomesUIShopAmountStepper,
  BiomesUIShopChrome,
  BiomesUIShopSection,
} from "@/client/components/inventory/BiomesUIShopChrome";
import { InventoryAndHotbarDisplay } from "@/client/components/inventory/InventoryAndHotbarDisplay";
import { useInventoryDraggerContext } from "@/client/components/inventory/InventoryDragger";
import { InventoryOverrideContextProvider } from "@/client/components/inventory/InventoryOverrideContext";
import { NormalSlotWithTooltip } from "@/client/components/inventory/NormalSlotWithTooltip";
import {
  buildShopListingEvent,
  buildShopPurchaseEvent,
  cannotBuyFromBiomesUIShopReason,
  chunkShopSlotIndexesForRovingGrid,
  firstFilledShopSlotIndex,
  MAX_BIOMES_UI_ADMIN_SHOP_PURCHASE_COUNT,
  normalizeShopListingPriceGold,
  normalizeShopPurchaseCount,
  selectedShopSlotOrFirstAvailable,
} from "@/client/components/inventory/shopBiomesUIModel";
import type { OpenContainer } from "@/client/components/inventory/types";
import { CurrencyWithGlyph } from "@/client/components/system/CurrencyWithGlyph";
import type { MoreMenuItem } from "@/client/components/system/MoreMenu";
import { MoreMenu } from "@/client/components/system/MoreMenu";
import { useCachedUserInfo } from "@/client/util/social_manager_hooks";
import { BikkieIds } from "@/shared/bikkie/ids";
import { AdminSetInfiniteCapacityContainerEvent } from "@/shared/ecs/gen/events";
import type { ReadonlyPricedItemSlot } from "@/shared/ecs/gen/types";
import { currencyBalance, maybeGetSlotByRef } from "@/shared/game/inventory";
import { anItem } from "@/shared/game/item";
import { countOf } from "@/shared/game/items";
import { fireAndForget } from "@/shared/util/async";
import { compact } from "lodash";
import type { PropsWithChildren } from "react";
import React, { useCallback, useEffect, useMemo, useState } from "react";

interface WantToBuyItem {
  containerSlotIdx: number;
}

export const ShopContainerLeftPaneContent: React.FunctionComponent<
  PropsWithChildren<{
    openContainer: OpenContainer;
  }>
> = ({ openContainer, children }) => {
  const { authManager, socialManager, reactResources, events, userId } =
    useClientContext();
  const { dragItem, setDragItem } = useInventoryDraggerContext();
  const [showMore, setShowMore] = useState(false);
  const [moreMenuPos, setMoreMenuPos] = useState<[number, number]>();
  const [listingPriceGold, setListingPriceGold] = useState(10);
  const [selectedListingSlotIdx, setSelectedListingSlotIdx] = useState<
    number | undefined
  >();
  const [wantToBuy, setWantToBuy] = useState<WantToBuyItem | undefined>();
  const [buyText, setBuyText] = useState("Buy");
  const [disableBuyButton, setDisableBuyButton] = useState(false);
  const [purchaseCount, setPurchaseCount] = useState(1);
  const [containerInventory, placedBy, inventory, wearing] =
    reactResources.useAll(
      ["/ecs/c/priced_container_inventory", openContainer.containerId],
      ["/ecs/c/placed_by", openContainer.containerId],
      ["/ecs/c/inventory", userId],
      ["/ecs/c/wearing", userId]
    );

  const owner = useCachedUserInfo(socialManager, placedBy?.id);
  const isMyStorageContainer = placedBy?.id === userId;
  const isAdmin = authManager.currentUser.hasSpecialRole("admin");
  const isAdminShop = Boolean(containerInventory?.infinite_capacity);
  const serverFilledSlots = compact(containerInventory?.items ?? []).length;
  const mode =
    isMyStorageContainer && serverFilledSlots === 0 ? "place_into" : "buy";
  const numItems = containerInventory?.items.length ?? 0;
  const itemCols = anItem(openContainer.itemId).numCols || 1;
  const numCols = Math.max(1, Math.min(4, itemCols));
  const slotRows = useMemo(
    () => chunkShopSlotIndexesForRovingGrid(numItems, numCols),
    [numItems, numCols]
  );
  const clientSideContainer = useClientSideContainer(numItems);
  const clientFilledSlots = compact(clientSideContainer.slots).length;
  const selectedListingSlot =
    selectedShopSlotOrFirstAvailable(
      clientSideContainer.slots,
      selectedListingSlotIdx
    ) ?? firstFilledShopSlotIndex(clientSideContainer.slots);
  const stagedItem =
    selectedListingSlot >= 0
      ? clientSideContainer.slots[selectedListingSlot]
      : undefined;
  const selectedForPurchase = wantToBuy
    ? containerInventory?.items[wantToBuy.containerSlotIdx]
    : undefined;
  const normalizedPurchaseCount = normalizeShopPurchaseCount(
    purchaseCount,
    isAdminShop
  );
  const costOfPurchase = selectedForPurchase?.price.count
    ? Number(selectedForPurchase.price.count) * normalizedPurchaseCount
    : 0;
  const walletGold = inventory
    ? currencyBalance(inventory, BikkieIds.bling)
    : 0n;
  const canAfford =
    Boolean(inventory) && walletGold >= BigInt(Math.max(0, costOfPurchase));
  const cannotBuyReason = cannotBuyFromBiomesUIShopReason({
    hasSelection: Boolean(wantToBuy),
    itemAvailable: Boolean(selectedForPurchase),
    hasInventory: Boolean(inventory),
    canAfford,
    isOwner: isMyStorageContainer,
  });

  useEffect(() => {
    setPurchaseCount((current) =>
      normalizeShopPurchaseCount(current, isAdminShop)
    );
  }, [isAdminShop]);

  useEffect(() => {
    if (!containerInventory || mode !== "buy") {
      return;
    }
    const nextSlot = selectedShopSlotOrFirstAvailable(
      containerInventory.items,
      wantToBuy?.containerSlotIdx
    );
    if (nextSlot !== wantToBuy?.containerSlotIdx) {
      setWantToBuy(
        nextSlot === undefined ? undefined : { containerSlotIdx: nextSlot }
      );
    }
  }, [containerInventory, mode, wantToBuy?.containerSlotIdx]);

  const handleShopCellClick = useCallback(
    (slotIdx: number) => {
      setSelectedListingSlotIdx(slotIdx);
      if (!dragItem && clientSideContainer.slots[slotIdx]) {
        const surrogateItem = clientSideContainer.slots[slotIdx];
        if (surrogateItem) {
          setDragItem({
            kind: "ephemeral",
            item: surrogateItem.item,
            quantity: surrogateItem.quantity,
            slotDropCallback: () => {
              clientSideContainer.setSlotAtIndex(slotIdx, undefined);
              setDragItem(null);
            },
          });
        }
        return;
      }
      if (dragItem?.kind === "inventory_drag") {
        const item = maybeGetSlotByRef(
          { inventory, wearing },
          dragItem.slotReference
        );
        if (item) {
          clientSideContainer.setSlotAtIndex(slotIdx, {
            refSlot: dragItem.slotReference,
            quantity: dragItem.quantity,
          });
        }
        setDragItem(null);
      }
    },
    [dragItem, clientSideContainer, inventory, wearing, setDragItem]
  );

  const handleListForSale = useCallback(
    (item: ClientSideContainerItem, priceGold: number, slotIdx: number) => {
      fireAndForget(
        events.publish(
          buildShopListingEvent({
            containerId: openContainer.containerId,
            src: item.refSlot,
            sellerId: userId,
            sellItem: item.item,
            dstSlotIdx: slotIdx,
            priceGold,
          })
        )
      );
    },
    [events, openContainer.containerId, userId]
  );

  const handleBuy = useCallback(
    (item: WantToBuyItem | undefined) => {
      if (!containerInventory || !item) {
        return;
      }
      const containerItem = containerInventory.items[item.containerSlotIdx];
      if (!containerItem) {
        return;
      }

      fireAndForget(
        events.publish(
          buildShopPurchaseEvent({
            containerId: openContainer.containerId,
            purchaserId: userId,
            sellerId: containerItem.seller_id,
            slotIdx: item.containerSlotIdx,
            quantity: purchaseCount,
            isAdminShop,
          })
        )
      );
      setBuyText(isMyStorageContainer ? "Removed from Sale" : "Added");
      setDisableBuyButton(true);
      setTimeout(() => {
        setBuyText("Buy");
        setDisableBuyButton(false);
      }, 2000);
    },
    [
      containerInventory,
      events,
      openContainer.containerId,
      userId,
      purchaseCount,
      isAdminShop,
      isMyStorageContainer,
    ]
  );

  if (!containerInventory) {
    return (
      <BiomesUIShopChrome
        title="Shop Unavailable"
        eyebrow="Shop Interface"
        variant="container"
        subtitle="This shop is still loading or no longer exists."
      >
        <BiomesUIShopSection title="Status">
          <p className="biomes-ui-shop-muted">No shop inventory found.</p>
        </BiomesUIShopSection>
      </BiomesUIShopChrome>
    );
  }

  const ownerName = owner?.user.username ?? "Unknown seller";
  const title = isMyStorageContainer ? "Your Shop" : `${ownerName}'s Shop`;
  const adminItems: MoreMenuItem[] = [
    {
      label: isAdminShop ? "Unset Infinite Capacity" : "Set Infinite Capacity",
      type: "destructive",
      onClick: () => {
        setShowMore(false);
        fireAndForget(
          events.publish(
            new AdminSetInfiniteCapacityContainerEvent({
              id: openContainer.containerId,
              infinite_capacity: !isAdminShop,
            })
          )
        );
      },
    },
    {
      label: "Copy Shop ID",
      onClick: () => {
        setShowMore(false);
        void navigator.clipboard.writeText(String(openContainer.containerId));
      },
    },
  ];

  const adminActions =
    isAdmin && isMyStorageContainer ? (
      <>
        <button
          type="button"
          className="biomes-ui-action-button"
          aria-label="Open shop admin menu"
          onClick={(event) => {
            setMoreMenuPos([event.clientX, event.clientY]);
            setShowMore((showing) => !showing);
          }}
        >
          Admin
        </button>
        <MoreMenu
          items={adminItems}
          showing={showMore}
          setShowing={setShowMore}
          pos={moreMenuPos}
          anchor="right"
        />
      </>
    ) : null;

  return (
    <BiomesUIShopChrome
      title={title}
      eyebrow={isAdminShop ? "Infinite Stock Shop" : "Shop Interface"}
      variant="container"
      subtitle={
        mode === "place_into"
          ? "Choose an item from your inventory, set a Bling price, and list it for sale."
          : isMyStorageContainer
          ? "Select a listing to remove it from sale."
          : "Select a listing, adjust quantity where allowed, and buy with Bling."
      }
      actions={adminActions}
    >
      <BiomesUIShopSection
        title={mode === "place_into" ? "Sale Slots" : "Listings"}
        meta={
          mode === "place_into"
            ? `${clientFilledSlots} staged`
            : `${serverFilledSlots} available`
        }
      >
        <div className="biomes-ui-shop-merchant">
          {placedBy ? <AvatarView userId={placedBy.id} /> : null}
          <div className="biomes-ui-shop-merchant__copy">
            <strong>{ownerName}</strong>
            <span>
              {isAdminShop
                ? "Stock can be bought in multiples."
                : mode === "place_into"
                ? "Empty shop ready for a listing."
                : "Player listing inventory."}
            </span>
          </div>
        </div>

        {slotRows.length === 0 ? (
          <p className="biomes-ui-shop-muted">This shop has no slots.</p>
        ) : (
          <RovingGrid
            ariaLabel={
              mode === "place_into" ? "Shop sale slots" : "Shop listings"
            }
            className="biomes-ui-shop-grid"
            items={slotRows}
            onActivate={(_row, _col, slotIdx) => {
              if (mode === "place_into") {
                handleShopCellClick(slotIdx);
                return;
              }
              if (containerInventory.items[slotIdx]) {
                setWantToBuy({ containerSlotIdx: slotIdx });
              }
            }}
            renderCell={(slotIdx, { focused }, cell) => {
              const staged = clientSideContainer.slots[slotIdx];
              const listing = containerInventory.items[slotIdx];
              const displayItem =
                mode === "place_into" ? staged?.item : listing?.contents;
              const selected =
                mode === "place_into"
                  ? selectedListingSlot === slotIdx
                  : wantToBuy?.containerSlotIdx === slotIdx;
              const initialFocusSlot =
                mode === "place_into"
                  ? 0
                  : wantToBuy?.containerSlotIdx ??
                    firstFilledShopSlotIndex(containerInventory.items);
              const label =
                displayItem?.item.displayName ??
                (mode === "place_into"
                  ? dragItem
                    ? "Drop item"
                    : "Empty sale slot"
                  : "Empty listing");
              return (
                <button
                  key={`shop-slot-${slotIdx}`}
                  ref={cell.ref}
                  type="button"
                  tabIndex={cell.tabIndex}
                  onFocus={cell.onFocus}
                  onClick={cell.onClick}
                  onKeyDown={cell.onKeyDown}
                  className="biomes-ui-shop-slot-button"
                  data-focused={focused ? "true" : undefined}
                  data-selected={selected ? "true" : undefined}
                  aria-label={`Shop slot ${slotIdx + 1}: ${label}`}
                  data-biomes-ui-shop-initial-focus={
                    slotIdx === initialFocusSlot ? "true" : undefined
                  }
                >
                  <NormalSlotWithTooltip
                    slotType="shop"
                    entityId={openContainer.containerId}
                    slot={displayItem}
                    slotReference={{
                      kind: "item",
                      idx: slotIdx,
                    }}
                  />
                  <span className="biomes-ui-shop-slot-button__label">
                    {displayItem ? (
                      <>
                        <strong>{displayItem.item.displayName}</strong>
                        {mode === "buy" && listing ? (
                          <span>
                            {Number(listing.price.count).toLocaleString()} Bling
                          </span>
                        ) : (
                          <span>x{displayItem.count.toLocaleString()}</span>
                        )}
                      </>
                    ) : (
                      <span>
                        {mode === "place_into" && dragItem ? "Drop" : "Empty"}
                      </span>
                    )}
                  </span>
                </button>
              );
            }}
          />
        )}
      </BiomesUIShopSection>

      <BiomesUIShopSection
        title="Your Inventory"
        meta={`${walletGold.toLocaleString()} Bling`}
        className="biomes-ui-shop-section--inventory"
      >
        <div className="biomes-ui-shop-inventory-pane">
          <InventoryAndHotbarDisplay />
          {children}
        </div>
      </BiomesUIShopSection>

      <BiomesUIShopSection
        title={mode === "place_into" ? "Set Price" : "Checkout"}
        className="biomes-ui-shop-section--summary"
      >
        {mode === "place_into" ? (
          <PlaceIntoShopActions
            stagedItem={stagedItem}
            slotIdx={selectedListingSlot}
            listingPriceGold={listingPriceGold}
            onListingPriceGoldChange={(next) =>
              setListingPriceGold(normalizeShopListingPriceGold(next))
            }
            onListForSale={(item, slotIdx) =>
              handleListForSale(item, listingPriceGold, slotIdx)
            }
          />
        ) : (
          <BuyFromShopActions
            isOwner={isMyStorageContainer}
            isAdminShop={isAdminShop}
            selectedListing={selectedForPurchase}
            purchaseCount={normalizedPurchaseCount}
            onPurchaseCountChange={setPurchaseCount}
            costOfPurchase={costOfPurchase}
            cannotBuyReason={cannotBuyReason}
            disabled={disableBuyButton}
            buyText={buyText}
            onBuy={() => handleBuy(wantToBuy)}
          />
        )}
      </BiomesUIShopSection>
    </BiomesUIShopChrome>
  );
};

const PlaceIntoShopActions: React.FunctionComponent<{
  stagedItem: ClientSideContainerItem | undefined;
  slotIdx: number;
  listingPriceGold: number;
  onListingPriceGoldChange: (value: number) => void;
  onListForSale: (item: ClientSideContainerItem, slotIdx: number) => void;
}> = ({
  stagedItem,
  slotIdx,
  listingPriceGold,
  onListingPriceGoldChange,
  onListForSale,
}) => {
  if (!stagedItem || slotIdx < 0) {
    return (
      <>
        <p className="biomes-ui-shop-muted">
          Stage an item in a sale slot before setting the price.
        </p>
        <button type="button" className="biomes-ui-action-button" disabled>
          List for Sale
        </button>
      </>
    );
  }

  return (
    <>
      <div className="biomes-ui-shop-total">
        {stagedItem.item.item.displayName} for{" "}
        <span>{listingPriceGold.toLocaleString()} Bling</span>
      </div>
      <BiomesUIShopAmountStepper
        label="Price"
        value={listingPriceGold}
        min={1}
        max={999_999}
        step={1}
        largeStep={10}
        onChange={onListingPriceGoldChange}
      />
      <button
        type="button"
        className="biomes-ui-action-button"
        onClick={() => onListForSale(stagedItem, slotIdx)}
      >
        List for Sale
      </button>
    </>
  );
};

const BuyFromShopActions: React.FunctionComponent<{
  isOwner: boolean;
  isAdminShop: boolean;
  selectedListing: ReadonlyPricedItemSlot;
  purchaseCount: number;
  onPurchaseCountChange: (value: number) => void;
  costOfPurchase: number;
  cannotBuyReason: string | undefined;
  disabled: boolean;
  buyText: string;
  onBuy: () => void;
}> = ({
  isOwner,
  isAdminShop,
  selectedListing,
  purchaseCount,
  onPurchaseCountChange,
  costOfPurchase,
  cannotBuyReason,
  disabled,
  buyText,
  onBuy,
}) => {
  const buttonDisabled =
    disabled || !selectedListing || (!isOwner && Boolean(cannotBuyReason));
  const actionLabel = isOwner ? "Remove from Sale" : buyText;
  const description = selectedListing?.contents.item.displayDescription;

  return (
    <>
      <div>
        <div className="biomes-ui-shop-total">
          {selectedListing ? (
            <>
              {selectedListing.contents.item.displayName}
              {!isOwner ? (
                <>
                  {" "}
                  for{" "}
                  <span>
                    <CurrencyWithGlyph
                      itemAndCount={countOf(
                        BikkieIds.bling,
                        BigInt(Math.max(0, costOfPurchase))
                      )}
                    />
                  </span>
                </>
              ) : null}
            </>
          ) : (
            "Choose a listing"
          )}
        </div>
        {description ? (
          <p className="biomes-ui-shop-muted">{description}</p>
        ) : null}
        {cannotBuyReason && !isOwner ? (
          <p className="biomes-ui-shop-muted">{cannotBuyReason}</p>
        ) : null}
      </div>
      {isAdminShop && !isOwner ? (
        <BiomesUIShopAmountStepper
          label="Quantity"
          value={purchaseCount}
          min={1}
          max={MAX_BIOMES_UI_ADMIN_SHOP_PURCHASE_COUNT}
          onChange={onPurchaseCountChange}
        />
      ) : null}
      <button
        type="button"
        className="biomes-ui-action-button"
        disabled={buttonDisabled}
        title={cannotBuyReason}
        onClick={onBuy}
      >
        {actionLabel}
      </button>
    </>
  );
};

export const ShopContainerScreen: React.FunctionComponent<
  PropsWithChildren<{
    openContainer: OpenContainer;
  }>
> = ({ openContainer, children }) => {
  const { gardenHose } = useClientContext();

  useEffect(() => {
    gardenHose.publish({
      kind: "open_shop",
    });

    return () => {
      gardenHose.publish({
        kind: "close_shop",
      });
    };
  }, [gardenHose]);

  return (
    <InventoryOverrideContextProvider>
      <ShopContainerLeftPaneContent openContainer={openContainer}>
        {children}
      </ShopContainerLeftPaneContent>
    </InventoryOverrideContextProvider>
  );
};
