// HARTHMERE_OBJECT_CONTAINER_UI:
// A take/store interface for world-object containers (chests, crates, boxes,
// bags, toolbags, ...). Mirrors the vendor/store panel chrome so containers
// "act like an inventory": the left column is the container's contents, the
// right column is the player's loose items. Containers persist their contents in
// localStorage, so what you leave behind stays.
//
// Three ways to move items (HARTHMERE_CONTAINER_DRAG_AND_KEYBOARD):
//  - drag an item from one column and drop it on the OTHER column,
//  - arrow keys move a focus cursor; Enter/Return moves the focused item across,
//  - the Take / Take All / Store buttons (precise single-unit / bulk actions).
// Drag and Enter move the WHOLE stack; the buttons keep their granular behavior.
//
// Only labels classified as containers route here (see
// object_interaction_semantics + isHarthmereContainerObjectLabel).
import {
  getHarthmereItemDisplay,
  useHarthmereInventoryState,
} from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import {
  clearHarthmereContainerOpenRequest,
  HARTHMERE_OBJECT_CONTAINER_CHANGED_EVENT,
  HARTHMERE_OBJECT_CONTAINER_OPEN_EVENT,
  HARTHMERE_OBJECT_CONTAINER_TRANSFER_EVENT,
  isHarthmereContainerTransferPending,
  putIntoHarthmereContainer,
  readHarthmereContainerOpenRequest,
  readHarthmereContainer,
  takeAllFromHarthmereContainer,
  takeFromHarthmereContainer,
  type HarthmereObjectContainerOpenRequest,
  type HarthmereObjectContainerRecord,
} from "@/client/components/challenges/harthmereObjectContainers";
import {
  clampHarthmereContainerFocus,
  HARTHMERE_CONTAINER_DRAG_MIME,
  moveHarthmereContainerFocus,
  parseHarthmereContainerDragPayload,
  resolveHarthmereContainerTransfer,
  serializeHarthmereContainerDragPayload,
  type HarthmereContainerArrowKey,
  type HarthmereContainerFocus,
  type HarthmereContainerSide,
} from "@/client/components/challenges/harthmereContainerTransferInteraction";
import { usePointerLockManager } from "@/client/components/contexts/PointerLockContext";
import {
  closePointerLockUnlockWhileOpen,
  openPointerLockUnlockWhileOpen,
  type PointerLockUnlockWhileOpenReturnRef,
} from "@/client/components/contexts/pointerLockModalPolicy";
import { installBiomesUITheme } from "@/client/components/biomes_ui/theme/biomesUITheme";
import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface TransferItem {
  itemId: string;
  quantity: number;
  rowKey: string;
  subtitle: string;
}

const ARROW_KEYS: HarthmereContainerArrowKey[] = [
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
];

function ContainerItemIcon({ itemId }: { itemId: string }) {
  const def = getHarthmereItemDisplay(itemId);
  return (
    <div className="biomes-ui-container-row__icon">{def?.icon ?? "?"}</div>
  );
}

function dragStartProps(side: HarthmereContainerSide, itemId: string) {
  return {
    draggable: true,
    onDragStart: (event: React.DragEvent) => {
      const text = serializeHarthmereContainerDragPayload({ side, itemId });
      try {
        event.dataTransfer.setData(HARTHMERE_CONTAINER_DRAG_MIME, text);
        event.dataTransfer.setData("text/plain", text);
        event.dataTransfer.effectAllowed = "move";
      } catch {
        // Some environments lock dataTransfer; the drop handler tolerates this.
      }
    },
  };
}

// A single draggable / focusable item row. Buttons are passed as children so the
// container side (Take / All) and inventory side (Store) keep their own actions.
function TransferRow({
  side,
  itemId,
  quantity,
  subtitle,
  focused,
  children,
}: {
  side: HarthmereContainerSide;
  itemId: string;
  quantity: number;
  subtitle?: string;
  focused: boolean;
  children?: React.ReactNode;
}) {
  const def = getHarthmereItemDisplay(itemId);
  return (
    <div
      {...dragStartProps(side, itemId)}
      aria-selected={focused}
      data-container-side={side}
      data-item-id={itemId}
      className="biomes-ui-container-row"
      data-focused={focused ? "true" : undefined}
    >
      <div className="biomes-ui-container-row__inner">
        <ContainerItemIcon itemId={itemId} />
        <div className="biomes-ui-container-row__copy">
          <div className="biomes-ui-container-row__title">
            {def?.name ?? itemId} {quantity > 1 ? `x${quantity}` : ""}
          </div>
          {subtitle && (
            <div className="biomes-ui-container-row__subtitle">{subtitle}</div>
          )}
        </div>
        <div className="biomes-ui-container-row__actions">{children}</div>
      </div>
    </div>
  );
}

function useContainerRecord(
  key: string | undefined
): HarthmereObjectContainerRecord | undefined {
  const [record, setRecord] = useState<
    HarthmereObjectContainerRecord | undefined
  >(() => (key ? readHarthmereContainer(key) : undefined));

  useEffect(() => {
    if (!key) {
      setRecord(undefined);
      return;
    }
    const refresh = () => setRecord(readHarthmereContainer(key));
    refresh();
    window.addEventListener(HARTHMERE_OBJECT_CONTAINER_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(
        HARTHMERE_OBJECT_CONTAINER_CHANGED_EVENT,
        refresh
      );
      window.removeEventListener("storage", refresh);
    };
  }, [key]);

  return record;
}

export const HarthmereObjectContainerPanel: React.FunctionComponent<{}> =
  () => {
    const [request, setRequest] = useState<
      HarthmereObjectContainerOpenRequest | undefined
    >(undefined);
    const inventory = useHarthmereInventoryState();
    const record = useContainerRecord(request?.key);
    const pointerLockManager = usePointerLockManager();
    const shouldReturnPointerLock = useRef<PointerLockUnlockWhileOpenReturnRef>(
      { current: false }
    );

    const [focus, setFocus] = useState<HarthmereContainerFocus | undefined>(
      undefined
    );
    const [dragOverSide, setDragOverSide] = useState<
      HarthmereContainerSide | undefined
    >(undefined);
    const [, setTransferRevision] = useState(0);

    useEffect(() => {
      const refresh = () => setTransferRevision((value) => value + 1);
      window.addEventListener(
        HARTHMERE_OBJECT_CONTAINER_TRANSFER_EVENT,
        refresh
      );
      return () =>
        window.removeEventListener(
          HARTHMERE_OBJECT_CONTAINER_TRANSFER_EVENT,
          refresh
        );
    }, []);

    useEffect(() => {
      installBiomesUITheme();
    }, []);

    // HARTHMERE_OBJECT_CONTAINER_UI: release the mouse while the panel is open
    // (and re-lock on close) exactly like the jobs-board / crafting / shop panels.
    // Without this the pointer stays locked to the camera, so the cursor never
    // appears and the player cannot click / drag — which is what made the
    // container "do nothing" even though the panel rendered.
    useEffect(() => {
      if (!request) {
        return;
      }
      openPointerLockUnlockWhileOpen(
        pointerLockManager,
        shouldReturnPointerLock.current
      );
      return () => {
        closePointerLockUnlockWhileOpen(
          pointerLockManager,
          shouldReturnPointerLock.current
        );
      };
    }, [request, pointerLockManager]);

    useEffect(() => {
      if (typeof window === "undefined") {
        return;
      }
      const openRequest = (detail?: HarthmereObjectContainerOpenRequest) => {
        const pending = detail ?? readHarthmereContainerOpenRequest();
        if (!pending) {
          return;
        }
        setRequest(pending);
        setFocus(undefined);
      };
      const handler = (event: Event) => {
        openRequest(
          (event as CustomEvent<HarthmereObjectContainerOpenRequest>).detail
        );
      };
      const storageHandler = (event: StorageEvent) => {
        if (
          event.key === "biomes.localDev.harthmere.objectContainerOpenRequest"
        ) {
          openRequest();
        }
      };
      clearHarthmereContainerOpenRequest();
      window.addEventListener(HARTHMERE_OBJECT_CONTAINER_OPEN_EVENT, handler);
      window.addEventListener("storage", storageHandler);
      return () => {
        window.removeEventListener(
          HARTHMERE_OBJECT_CONTAINER_OPEN_EVENT,
          handler
        );
        window.removeEventListener("storage", storageHandler);
      };
    }, []);

    const closePanel = useCallback(() => {
      clearHarthmereContainerOpenRequest();
      setRequest(undefined);
      setFocus(undefined);
    }, []);

    // Player items that are safe to store: loose backpack items and loose crafting
    // materials. Quest-pouch items, keys, wallet, and equipped gear are
    // intentionally protected from accidental storage (they drive quests/combat).
    const storableBackpack = (inventory.backpack.items ?? []).filter((item) =>
      getHarthmereItemDisplay(item.itemId)
    );
    const storableMaterials = Object.entries(inventory.materialStorage ?? {})
      .filter(([, qty]) => qty > 0)
      .map(([itemId, qty]) => ({ itemId, quantity: qty }));

    const containerItems = record?.items ?? [];
    const inventoryList: TransferItem[] = [
      ...storableBackpack.map((item) => {
        const def = getHarthmereItemDisplay(item.itemId);
        return {
          itemId: item.itemId,
          quantity: item.quantity,
          rowKey: `bp-${item.instanceId}`,
          subtitle: def ? `${def.category} · ${def.quality}` : "backpack",
        };
      }),
      ...storableMaterials.map((mat) => ({
        itemId: mat.itemId,
        quantity: mat.quantity,
        rowKey: `mat-${mat.itemId}`,
        subtitle: "material storage",
      })),
    ];

    const counts = {
      containerCount: containerItems.length,
      inventoryCount: inventoryList.length,
    };
    const displayFocus = clampHarthmereContainerFocus(focus, counts);

    const containerKey = request?.key;

    const takeWholeStack = useCallback(
      (itemId: string, quantity: number) => {
        if (containerKey) {
          takeFromHarthmereContainer(containerKey, itemId, quantity);
        }
      },
      [containerKey]
    );
    const storeWholeStack = useCallback(
      (itemId: string, quantity: number) => {
        if (containerKey) {
          putIntoHarthmereContainer(containerKey, itemId, quantity);
        }
      },
      [containerKey]
    );

    // Move an item identified by (sourceSide, itemId) onto targetSide. Used by both
    // drag-drop and a row's double-action. Looks up the live quantity so the WHOLE
    // stack moves; a stale id resolves to a 0-effect take/store (no crash).
    const executeTransfer = useCallback(
      (
        sourceSide: HarthmereContainerSide,
        targetSide: HarthmereContainerSide,
        itemId: string
      ) => {
        const action = resolveHarthmereContainerTransfer(
          sourceSide,
          targetSide
        );
        if (action === "take") {
          const item = containerItems.find((i) => i.itemId === itemId);
          takeWholeStack(itemId, item?.quantity ?? 1);
        } else if (action === "store") {
          const item = inventoryList.find((i) => i.itemId === itemId);
          storeWholeStack(itemId, item?.quantity ?? 1);
        }
      },
      [containerItems, inventoryList, takeWholeStack, storeWholeStack]
    );

    // Keep a fresh snapshot for the window keydown handler (registered once while
    // open) so arrow/Enter never act on stale lists after a transfer.
    const interactionRef = useRef<{
      focus: HarthmereContainerFocus | undefined;
      containerItems: { itemId: string; quantity: number }[];
      inventoryList: TransferItem[];
    }>({ focus, containerItems, inventoryList });
    interactionRef.current = { focus, containerItems, inventoryList };

    useEffect(() => {
      if (!request || typeof window === "undefined") {
        return;
      }
      const handler = (event: KeyboardEvent) => {
        if (event.code === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          closePanel();
          return;
        }
        const cur = interactionRef.current;
        const liveCounts = {
          containerCount: cur.containerItems.length,
          inventoryCount: cur.inventoryList.length,
        };
        if ((ARROW_KEYS as string[]).includes(event.key)) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          setFocus((prev) =>
            moveHarthmereContainerFocus(
              prev,
              event.key as HarthmereContainerArrowKey,
              liveCounts
            )
          );
          return;
        }
        if (event.key === "Enter") {
          if (event.repeat) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          const f = clampHarthmereContainerFocus(cur.focus, liveCounts);
          if (!f) {
            return;
          }
          if (f.side === "container") {
            const item = cur.containerItems[f.index];
            if (item) {
              takeWholeStack(item.itemId, item.quantity);
            }
          } else {
            const item = cur.inventoryList[f.index];
            if (item) {
              storeWholeStack(item.itemId, item.quantity);
            }
          }
        }
      };
      window.addEventListener("keydown", handler, true);
      return () => window.removeEventListener("keydown", handler, true);
    }, [request, closePanel, takeWholeStack, storeWholeStack]);

    if (!request || typeof window === "undefined") {
      return null;
    }
    const transferPending = isHarthmereContainerTransferPending(request.key);

    const dropZoneProps = (targetSide: HarthmereContainerSide) => ({
      onDragEnter: (event: React.DragEvent) => {
        event.preventDefault();
        setDragOverSide(targetSide);
      },
      onDragOver: (event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      },
      onDragLeave: () => setDragOverSide(undefined),
      onDrop: (event: React.DragEvent) => {
        event.preventDefault();
        setDragOverSide(undefined);
        const text =
          event.dataTransfer.getData(HARTHMERE_CONTAINER_DRAG_MIME) ||
          event.dataTransfer.getData("text/plain");
        const payload = parseHarthmereContainerDragPayload(text);
        if (!payload) {
          return;
        }
        executeTransfer(payload.side, targetSide, payload.itemId);
      },
    });

    const columnDragClass = (side: HarthmereContainerSide) =>
      dragOverSide === side ? "biomes-ui-container-list--drag-over" : "";

    const panel = (
      <div
        data-harthmere-object-container-panel="true"
        aria-busy={transferPending}
        data-pointer-lock-policy="unlock-while-open"
        className="biomes-ui-container-backdrop"
        style={{ zIndex: 2147483000 }}
        onMouseDown={(event) => event.stopPropagation()}
        onMouseUp={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <div
          role="dialog"
          aria-label={`${request.label} container`}
          className="biomes-ui-container-panel biomes-ui-panel"
        >
          <header className="biomes-ui-shop-screen__header">
            <div className="biomes-ui-shop-screen__identity">
              <span className="biomes-ui-shop-screen__eyebrow">
                Container Storage
              </span>
              <h2>{request.label}</h2>
              <p className="biomes-ui-shop-screen__subtitle">
                Move items between storage and your backpack. Backpack{" "}
                {inventory.backpack.items.length}/{inventory.backpack.maxSlots}.
              </p>
            </div>
            <div className="biomes-ui-shop-screen__actions">
              <button
                type="button"
                className="biomes-ui-shop-screen__close"
                onClick={closePanel}
                aria-label="Close container"
              >
                <span aria-hidden>Esc</span>
                Close
              </button>
            </div>
          </header>

          <div className="biomes-ui-container-panel__body">
            {/* Container contents — drop here to STORE; drag/Take to remove. */}
            <section className="biomes-ui-shop-section">
              <div className="biomes-ui-shop-section__header">
                <h3>Container</h3>
                <span>{containerItems.length} stored</span>
                <button
                  type="button"
                  className="biomes-ui-action-button"
                  disabled={!containerItems.length || transferPending}
                  onClick={() => takeAllFromHarthmereContainer(request.key)}
                >
                  {transferPending ? "Taking…" : "Take All"}
                </button>
              </div>
              <div
                {...dropZoneProps("container")}
                className={`biomes-ui-container-list ${columnDragClass(
                  "container"
                )}`}
              >
                {containerItems.length ? (
                  containerItems.map((slot, index) => (
                    <TransferRow
                      key={slot.itemId}
                      side="container"
                      itemId={slot.itemId}
                      quantity={slot.quantity}
                      subtitle={(() => {
                        const def = getHarthmereItemDisplay(slot.itemId);
                        return def
                          ? `${def.category} · ${def.quality}`
                          : undefined;
                      })()}
                      focused={
                        displayFocus?.side === "container" &&
                        displayFocus.index === index
                      }
                    >
                      <button
                        type="button"
                        className="biomes-ui-action-button"
                        disabled={transferPending}
                        onClick={() =>
                          takeFromHarthmereContainer(
                            request.key,
                            slot.itemId,
                            1
                          )
                        }
                      >
                        Take
                      </button>
                      {slot.quantity > 1 && (
                        <button
                          type="button"
                          className="biomes-ui-action-button"
                          disabled={transferPending}
                          onClick={() =>
                            takeFromHarthmereContainer(
                              request.key,
                              slot.itemId,
                              slot.quantity
                            )
                          }
                        >
                          All
                        </button>
                      )}
                    </TransferRow>
                  ))
                ) : (
                  <div className="biomes-ui-container-empty">
                    {record?.note ??
                      "This container is empty. Drop items here to store them."}
                  </div>
                )}
              </div>
            </section>

            {/* Player items — drop here to TAKE; drag/Store to add to container. */}
            <section className="biomes-ui-shop-section">
              <div className="biomes-ui-shop-section__header">
                <h3>Your Items</h3>
                <span>{inventoryList.length} loose</span>
              </div>
              <div
                {...dropZoneProps("inventory")}
                className={`biomes-ui-container-list ${columnDragClass(
                  "inventory"
                )}`}
              >
                {inventoryList.length ? (
                  inventoryList.map((item, index) => (
                    <TransferRow
                      key={item.rowKey}
                      side="inventory"
                      itemId={item.itemId}
                      quantity={item.quantity}
                      subtitle={item.subtitle}
                      focused={
                        displayFocus?.side === "inventory" &&
                        displayFocus.index === index
                      }
                    >
                      <button
                        type="button"
                        className="biomes-ui-action-button"
                        disabled={transferPending}
                        onClick={() =>
                          putIntoHarthmereContainer(request.key, item.itemId, 1)
                        }
                      >
                        Store
                      </button>
                      {item.quantity > 1 && (
                        <button
                          type="button"
                          className="biomes-ui-action-button"
                          disabled={transferPending}
                          onClick={() =>
                            putIntoHarthmereContainer(
                              request.key,
                              item.itemId,
                              item.quantity
                            )
                          }
                        >
                          All
                        </button>
                      )}
                    </TransferRow>
                  ))
                ) : (
                  <div className="biomes-ui-container-empty">
                    No loose items to store. Quest items, keys, and equipped
                    gear are protected.
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    );

    return createPortal(panel, document.body);
  };
