// HARTHMERE_OBJECT_CONTAINER_UI_V199:
// A take/store interface for world-object containers (chests, crates, boxes,
// bags, toolbags, ...). Mirrors the vendor/store panel chrome so containers
// "act like an inventory": the left column is the container's contents, the
// right column is the player's loose items. Containers persist their contents in
// localStorage, so what you leave behind stays.
//
// Three ways to move items (HARTHMERE_CONTAINER_DRAG_AND_KEYBOARD_V1):
//  - drag an item from one column and drop it on the OTHER column,
//  - arrow keys move a focus cursor; Enter/Return moves the focused item across,
//  - the Take / Take All / Store buttons (precise single-unit / bulk actions).
// Drag and Enter move the WHOLE stack; the buttons keep their granular behavior.
//
// Only labels classified as containers route here (see
// object_interaction_semantics_v1 + isHarthmereContainerObjectLabelV1).
import {
  getHarthmereItemDisplayV1,
  useHarthmereInventoryState,
} from "@/client/components/challenges/LocalDevHarthmereInventorySystem";
import {
  clearHarthmereContainerOpenRequestV1,
  HARTHMERE_OBJECT_CONTAINER_CHANGED_EVENT_V1,
  HARTHMERE_OBJECT_CONTAINER_OPEN_EVENT_V1,
  putIntoHarthmereContainerV1,
  readHarthmereContainerOpenRequestV1,
  readHarthmereContainerV1,
  takeAllFromHarthmereContainerV1,
  takeFromHarthmereContainerV1,
  type HarthmereObjectContainerOpenRequestV1,
  type HarthmereObjectContainerRecordV1,
} from "@/client/components/challenges/harthmereObjectContainers";
import {
  clampHarthmereContainerFocusV1,
  HARTHMERE_CONTAINER_DRAG_MIME_V1,
  moveHarthmereContainerFocusV1,
  parseHarthmereContainerDragPayloadV1,
  resolveHarthmereContainerTransferV1,
  serializeHarthmereContainerDragPayloadV1,
  type HarthmereContainerArrowKeyV1,
  type HarthmereContainerFocusV1,
  type HarthmereContainerSideV1,
} from "@/client/components/challenges/harthmereContainerTransferInteractionV1";
import { usePointerLockManager } from "@/client/components/contexts/PointerLockContext";
import {
  closePointerLockUnlockWhileOpenV1,
  openPointerLockUnlockWhileOpenV1,
  type PointerLockUnlockWhileOpenReturnRefV1,
} from "@/client/components/contexts/pointerLockModalPolicy";
import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface TransferItemV1 {
  itemId: string;
  quantity: number;
  rowKey: string;
  subtitle: string;
}

const ARROW_KEYS_V1: HarthmereContainerArrowKeyV1[] = [
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
];

function ContainerItemIcon({ itemId }: { itemId: string }) {
  const def = getHarthmereItemDisplayV1(itemId);
  return (
    <div className="h-9 w-9 rounded text-lg flex shrink-0 items-center justify-center bg-white/10 font-bold">
      {def?.icon ?? "?"}
    </div>
  );
}

function dragStartPropsV1(side: HarthmereContainerSideV1, itemId: string) {
  return {
    draggable: true,
    onDragStart: (event: React.DragEvent) => {
      const text = serializeHarthmereContainerDragPayloadV1({ side, itemId });
      try {
        event.dataTransfer.setData(HARTHMERE_CONTAINER_DRAG_MIME_V1, text);
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
function TransferRowV1({
  side,
  itemId,
  quantity,
  subtitle,
  focused,
  children,
}: {
  side: HarthmereContainerSideV1;
  itemId: string;
  quantity: number;
  subtitle?: string;
  focused: boolean;
  children?: React.ReactNode;
}) {
  const def = getHarthmereItemDisplayV1(itemId);
  return (
    <div
      {...dragStartPropsV1(side, itemId)}
      aria-selected={focused}
      data-container-side={side}
      data-item-id={itemId}
      className={`cursor-grab rounded-xl border bg-white/5 p-2 active:cursor-grabbing ${
        focused
          ? "border-amber-300 ring-2 ring-amber-300/70"
          : "border-white/10"
      }`}
    >
      <div className="flex items-center gap-3">
        <ContainerItemIcon itemId={itemId} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-white">
            {def?.name ?? itemId} {quantity > 1 ? `x${quantity}` : ""}
          </div>
          {subtitle && (
            <div className="text-white/50 text-[11px]">{subtitle}</div>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

function useContainerRecord(
  key: string | undefined
): HarthmereObjectContainerRecordV1 | undefined {
  const [record, setRecord] = useState<
    HarthmereObjectContainerRecordV1 | undefined
  >(() => (key ? readHarthmereContainerV1(key) : undefined));

  useEffect(() => {
    if (!key) {
      setRecord(undefined);
      return;
    }
    const refresh = () => setRecord(readHarthmereContainerV1(key));
    refresh();
    window.addEventListener(HARTHMERE_OBJECT_CONTAINER_CHANGED_EVENT_V1, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(
        HARTHMERE_OBJECT_CONTAINER_CHANGED_EVENT_V1,
        refresh
      );
      window.removeEventListener("storage", refresh);
    };
  }, [key]);

  return record;
}

export const HarthmereObjectContainerPanel: React.FunctionComponent<
  {}
> = () => {
  const [request, setRequest] = useState<
    HarthmereObjectContainerOpenRequestV1 | undefined
  >(() => readHarthmereContainerOpenRequestV1());
  const inventory = useHarthmereInventoryState();
  const record = useContainerRecord(request?.key);
  const pointerLockManager = usePointerLockManager();
  const shouldReturnPointerLock =
    useRef<PointerLockUnlockWhileOpenReturnRefV1>({ current: false });

  const [focus, setFocus] = useState<HarthmereContainerFocusV1 | undefined>(
    undefined
  );
  const [dragOverSide, setDragOverSide] =
    useState<HarthmereContainerSideV1 | undefined>(undefined);

  // HARTHMERE_OBJECT_CONTAINER_UI_V199: release the mouse while the panel is open
  // (and re-lock on close) exactly like the jobs-board / crafting / shop panels.
  // Without this the pointer stays locked to the camera, so the cursor never
  // appears and the player cannot click / drag — which is what made the
  // container "do nothing" even though the panel rendered.
  useEffect(() => {
    if (!request) {
      return;
    }
    openPointerLockUnlockWhileOpenV1(
      pointerLockManager,
      shouldReturnPointerLock.current
    );
    return () => {
      closePointerLockUnlockWhileOpenV1(
        pointerLockManager,
        shouldReturnPointerLock.current
      );
    };
  }, [request, pointerLockManager]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const openRequest = (detail?: HarthmereObjectContainerOpenRequestV1) => {
      const pending = detail ?? readHarthmereContainerOpenRequestV1();
      if (!pending) {
        return;
      }
      setRequest(pending);
      setFocus(undefined);
    };
    const handler = (event: Event) => {
      openRequest(
        (event as CustomEvent<HarthmereObjectContainerOpenRequestV1>).detail
      );
    };
    const storageHandler = (event: StorageEvent) => {
      if (
        event.key === "biomes.localDev.harthmere.objectContainerOpenRequest.v1"
      ) {
        openRequest();
      }
    };
    openRequest();
    window.addEventListener(HARTHMERE_OBJECT_CONTAINER_OPEN_EVENT_V1, handler);
    window.addEventListener("storage", storageHandler);
    return () => {
      window.removeEventListener(
        HARTHMERE_OBJECT_CONTAINER_OPEN_EVENT_V1,
        handler
      );
      window.removeEventListener("storage", storageHandler);
    };
  }, []);

  const closePanel = useCallback(() => {
    clearHarthmereContainerOpenRequestV1();
    setRequest(undefined);
    setFocus(undefined);
  }, []);

  // Player items that are safe to store: loose backpack items and loose crafting
  // materials. Quest-pouch items, keys, wallet, and equipped gear are
  // intentionally protected from accidental storage (they drive quests/combat).
  const storableBackpack = (inventory.backpack.items ?? []).filter((item) =>
    getHarthmereItemDisplayV1(item.itemId)
  );
  const storableMaterials = Object.entries(inventory.materialStorage ?? {})
    .filter(([, qty]) => qty > 0)
    .map(([itemId, qty]) => ({ itemId, quantity: qty }));

  const containerItems = record?.items ?? [];
  const inventoryList: TransferItemV1[] = [
    ...storableBackpack.map((item) => {
      const def = getHarthmereItemDisplayV1(item.itemId);
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
  const displayFocus = clampHarthmereContainerFocusV1(focus, counts);

  const containerKey = request?.key;

  const takeWholeStack = useCallback(
    (itemId: string, quantity: number) => {
      if (containerKey) {
        takeFromHarthmereContainerV1(containerKey, itemId, quantity);
      }
    },
    [containerKey]
  );
  const storeWholeStack = useCallback(
    (itemId: string, quantity: number) => {
      if (containerKey) {
        putIntoHarthmereContainerV1(containerKey, itemId, quantity);
      }
    },
    [containerKey]
  );

  // Move an item identified by (sourceSide, itemId) onto targetSide. Used by both
  // drag-drop and a row's double-action. Looks up the live quantity so the WHOLE
  // stack moves; a stale id resolves to a 0-effect take/store (no crash).
  const executeTransfer = useCallback(
    (
      sourceSide: HarthmereContainerSideV1,
      targetSide: HarthmereContainerSideV1,
      itemId: string
    ) => {
      const action = resolveHarthmereContainerTransferV1(sourceSide, targetSide);
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
    focus: HarthmereContainerFocusV1 | undefined;
    containerItems: { itemId: string; quantity: number }[];
    inventoryList: TransferItemV1[];
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
      if ((ARROW_KEYS_V1 as string[]).includes(event.key)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        setFocus((prev) =>
          moveHarthmereContainerFocusV1(
            prev,
            event.key as HarthmereContainerArrowKeyV1,
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
        const f = clampHarthmereContainerFocusV1(cur.focus, liveCounts);
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

  const dropZoneProps = (targetSide: HarthmereContainerSideV1) => ({
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
        event.dataTransfer.getData(HARTHMERE_CONTAINER_DRAG_MIME_V1) ||
        event.dataTransfer.getData("text/plain");
      const payload = parseHarthmereContainerDragPayloadV1(text);
      if (!payload) {
        return;
      }
      executeTransfer(payload.side, targetSide, payload.itemId);
    },
  });

  const columnDragClass = (side: HarthmereContainerSideV1) =>
    dragOverSide === side ? "rounded-lg ring-2 ring-amber-300/40" : "";

  const panel = (
    <div
      data-harthmere-object-container-panel="true"
      data-pointer-lock-policy="unlock-while-open"
      className="pointer-events-auto fixed inset-0 flex items-center justify-center bg-black/70 p-3 text-white backdrop-blur-sm"
      style={{ zIndex: 2147483000 }}
      onMouseDown={(event) => event.stopPropagation()}
      onMouseUp={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div className="rounded-2xl border-white/15 max-h-[calc(100vh-2rem)] w-[min(52rem,calc(100vw-1rem))] overflow-hidden border bg-black/95 shadow-2xl">
        <div className="border-b border-white/10 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-base text-amber-200 font-bold">
                {request.label}
              </div>
              <div className="text-xs text-white/70">
                Drag items between the columns, or use the arrow keys and press
                Enter. Backpack {inventory.backpack.items.length}/
                {inventory.backpack.maxSlots}
              </div>
            </div>
            <button
              className="border-white/15 rounded-full border bg-white/10 px-3 py-1 text-xs hover:bg-white/20"
              onClick={closePanel}
            >
              Close
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2">
          {/* Container contents — drop here to STORE; drag/Take to remove. */}
          <div className="flex flex-col">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm text-amber-100 font-semibold">
                Container
              </div>
              <button
                className={`rounded px-2 py-1 text-[11px] font-semibold ${
                  containerItems.length
                    ? "bg-amber-300 text-black hover:bg-amber-200"
                    : "cursor-not-allowed bg-white/10 text-white/40"
                }`}
                disabled={!containerItems.length}
                onClick={() => takeAllFromHarthmereContainerV1(request.key)}
              >
                Take All
              </button>
            </div>
            <div
              {...dropZoneProps("container")}
              className={`max-h-[52vh] space-y-2 overflow-y-auto pr-1 ${columnDragClass(
                "container"
              )}`}
            >
              {containerItems.length ? (
                containerItems.map((slot, index) => (
                  <TransferRowV1
                    key={slot.itemId}
                    side="container"
                    itemId={slot.itemId}
                    quantity={slot.quantity}
                    subtitle={(() => {
                      const def = getHarthmereItemDisplayV1(slot.itemId);
                      return def ? `${def.category} · ${def.quality}` : undefined;
                    })()}
                    focused={
                      displayFocus?.side === "container" &&
                      displayFocus.index === index
                    }
                  >
                    <button
                      className="rounded bg-amber-300 px-3 py-1 text-xs font-semibold text-black hover:bg-amber-200"
                      onClick={() =>
                        takeFromHarthmereContainerV1(request.key, slot.itemId, 1)
                      }
                    >
                      Take
                    </button>
                    {slot.quantity > 1 && (
                      <button
                        className="rounded bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-white/20"
                        onClick={() =>
                          takeFromHarthmereContainerV1(
                            request.key,
                            slot.itemId,
                            slot.quantity
                          )
                        }
                      >
                        All
                      </button>
                    )}
                  </TransferRowV1>
                ))
              ) : (
                <div className="rounded border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                  {record?.note ??
                    "This container is empty. Drop items here to store them."}
                </div>
              )}
            </div>
          </div>

          {/* Player items — drop here to TAKE; drag/Store to add to container. */}
          <div className="flex flex-col">
            <div className="mb-2 text-sm text-amber-100 font-semibold">
              Your items
            </div>
            <div
              {...dropZoneProps("inventory")}
              className={`max-h-[52vh] space-y-2 overflow-y-auto pr-1 ${columnDragClass(
                "inventory"
              )}`}
            >
              {inventoryList.length ? (
                inventoryList.map((item, index) => (
                  <TransferRowV1
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
                      className="rounded bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-white/20"
                      onClick={() =>
                        putIntoHarthmereContainerV1(request.key, item.itemId, 1)
                      }
                    >
                      Store
                    </button>
                    {item.quantity > 1 && (
                      <button
                        className="rounded bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-white/20"
                        onClick={() =>
                          putIntoHarthmereContainerV1(
                            request.key,
                            item.itemId,
                            item.quantity
                          )
                        }
                      >
                        All
                      </button>
                    )}
                  </TransferRowV1>
                ))
              ) : (
                <div className="rounded border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                  No loose items to store. Quest items, keys, and equipped gear
                  are protected.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(panel, document.body);
};
