import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { usePointerLockManager } from "@/client/components/contexts/PointerLockContext";
import { HealthBarHUD } from "@/client/components/HealthBarHUD";
import { useOwnedItems } from "@/client/components/inventory/helpers";
import { NormalSlot } from "@/client/components/inventory/NormalSlot";
import { SelectionNameOverlay } from "@/client/components/inventory/SelectionHints";
import { inInputElement } from "@/client/components/ShortcutsHUD";
import type { ClientContextSubset } from "@/client/game/context";
import type { Events } from "@/client/game/context_managers/events";
import { throwInventoryItem } from "@/client/game/helpers/inventory";
import type {
  CameraSelection,
  HotBarSelection,
} from "@/client/game/resources/inventory";
import {
  cameraExitHotbarIndex,
  getSelectedItem,
  isCameraExitKey,
} from "@/client/game/resources/inventory";
import type { ClientReactResources } from "@/client/game/resources/types";
import { compatibleCameraModes } from "@/client/game/util/camera";
import type { LocalKeyCode } from "@/client/game/util/keyboard";
import { usePlayerHasPermissionFoItemAction } from "@/client/util/permissions_manager_hooks";
import { getTypedStorageItem } from "@/client/util/typed_local_storage";
import type { CameraItemMode } from "@/shared/bikkie/schema/types";
import type { Health } from "@/shared/ecs/gen/components";
import { Inventory } from "@/shared/ecs/gen/components";
import {
  ChangeCameraModeEvent,
  InventoryChangeSelectionEvent,
} from "@/shared/ecs/gen/events";
import type {
  Item,
  OwnedItemReference,
  ReadonlyItemAndCount,
} from "@/shared/ecs/gen/types";
import { OwnedItemReferencesEqual } from "@/shared/game/inventory";
import { fireAndForget } from "@/shared/util/async";
import type { Variants } from "framer-motion";
import { motion } from "framer-motion";
import { first, isEqual } from "lodash";
import React, { useCallback, useEffect, useRef } from "react";

export function handleCameraKeyDown(
  reactResources: ClientReactResources,
  events: Events,
  selection: CameraSelection
) {
  const modeSwitcher = compatibleCameraModes(selection.item);
  const currentIndex = modeSwitcher.findIndex((e) =>
    isEqual(e, selection?.mode)
  );
  let newIndex = 0;

  if (currentIndex >= 0 && currentIndex < modeSwitcher.length - 1) {
    newIndex = currentIndex + 1;
  }

  const newMode: CameraItemMode = modeSwitcher[newIndex];
  switchCameraModes(reactResources, events, newMode);
}

export function switchCameraModes(
  reactResources: ClientReactResources,
  events: Events,
  mode: CameraItemMode
) {
  const newMode = mode;
  const localPlayer = reactResources.get("/scene/local_player");
  reactResources.set("/hotbar/camera_mode", {
    value: mode,
  });
  fireAndForget(
    events.publish(
      new ChangeCameraModeEvent({ id: localPlayer.id, mode: newMode.modeType })
    )
  );
}

export function exitCameraMode(
  deps: ClientContextSubset<
    "events" | "gardenHose" | "reactResources" | "resources" | "userId"
  >
) {
  const selection = deps.reactResources.get("/hotbar/selection");
  if (selection.kind !== "camera") {
    return false;
  }

  // Reset the camera mode before changing selection. CameraScript observes the
  // selfie -> normal transition and rotates the player camera back by PI, so
  // leaving selfie mode cannot strand the view facing backwards.
  switchCameraModes(
    deps.reactResources,
    deps.events,
    first(compatibleCameraModes(undefined))!
  );

  const currentIndex = deps.resources.get("/hotbar/index").value;
  const inventory = deps.resources.get("/ecs/c/inventory", deps.userId);
  const exitIndex = cameraExitHotbarIndex(inventory, currentIndex);
  if (exitIndex >= 0) {
    updateHotbarIndexResource(deps, exitIndex);
  } else {
    // Extremely defensive fallback for a hotbar made entirely of cameras.
    // A negative local index produces no camera selection while preserving the
    // server-owned inventory contents.
    deps.resources.set("/hotbar/index", { value: -1 });
  }
  return true;
}

function updateHotbarIndexResource(
  deps: ClientContextSubset<"userId" | "gardenHose" | "resources">,
  idx: number
) {
  deps.resources.update("/hotbar/index", (index) => {
    if (index.value !== idx) {
      index.value = idx;
      deps.gardenHose.publish({ kind: "equip", hotbarIndex: idx });
      const item = getSelectedItem(
        deps.resources.get("/ecs/c/inventory", deps.userId),
        idx
      );
      deps.resources.set("/hotbar/camera_mode", {
        value: first(compatibleCameraModes(item?.item))!,
      });
    }
  });
}

const HOTBAR_SPRING = { tension: 140, friction: 12 };

export const HotBar: React.FunctionComponent<{}> = ({}) => {
  const clientContext = useClientContext();
  const { audioManager, reactResources, userId, events } = clientContext;

  const [currentSelection, currentIndex] = reactResources.useAll(
    ["/hotbar/selection"],
    ["/hotbar/index"]
  ) as [HotBarSelection, { value: number }];

  const localPlayer = reactResources.get("/scene/local_player");
  const ownedItems = useOwnedItems(reactResources, userId);
  const inventory = ownedItems.inventory ?? Inventory.create({});
  const canBreathe = reactResources.useSubset(
    (q) => q.canBreathe,
    "/players/possible_terrain_actions",
    localPlayer.id
  );
  const localInventory = reactResources.use("/ecs/c/inventory", userId);
  const gameModal = reactResources.use("/game_modal");
  const hotbarSelectedIdx = currentIndex.value;
  const priorSelectedItemRef = useRef<Item | undefined>();
  const pointerLockManager = usePointerLockManager();

  const setHotbarSelectedIdx = useCallback((idx: number) => {
    updateHotbarIndexResource(clientContext, idx);
  }, []);

  useEffect(() => {
    if (currentSelection.kind == "camera") {
      document.body.classList.add("selection-camera");
    } else {
      document.body.classList.remove("selection-camera");
    }
    // Trigger any sound effects if the selected item has changed.
    const priorSelectedItem = priorSelectedItemRef.current;
    const selectedItemHasChanged =
      !priorSelectedItemRef.current ||
      !isEqual(currentSelection.item, priorSelectedItemRef.current);

    // Reset the authoritative mode whenever ordinary hotbar navigation leaves
    // a camera. The old index effect read this ref after it had already been
    // overwritten with the new item, leaving remote player state in selfie.
    if (
      selectedItemHasChanged &&
      priorSelectedItem?.action === "photo" &&
      currentSelection.item?.action !== "photo"
    ) {
      switchCameraModes(
        reactResources,
        events,
        first(compatibleCameraModes(undefined))!
      );
    }
    priorSelectedItemRef.current = currentSelection.item;

    if (selectedItemHasChanged && currentSelection.item) {
      const action = currentSelection.item.action;
      if (action === "photo") {
        audioManager.playSound("camera_select");
      } else {
        audioManager.playSound("item_select");
      }
    }
  }, [reactResources.version("/hotbar/selection")]);

  useEffect(() => {
    // Update selection on hotbar change.
    // If our selected item ref is forcefully changed, (i.e. placing a group),
    // we won't override it until we change our selected hotbar slot
    if (hotbarSelectedIdx < 0) {
      return;
    }

    const slotRef = {
      kind: "hotbar",
      idx: hotbarSelectedIdx,
    } as OwnedItemReference;

    if (!OwnedItemReferencesEqual(inventory.selected, slotRef)) {
      // TODO: rate limit this
      fireAndForget(
        events.publish(
          new InventoryChangeSelectionEvent({
            id: localPlayer.id,
            ref: slotRef,
          })
        )
      );
    }
  }, [hotbarSelectedIdx]);

  useEffect(() => {
    const keyDownCB = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const lk = event.code as LocalKeyCode;

      // Camera exit is a recovery key, so it must work after pointer lock is
      // released by the photo/selfie flow. Ordinary HUD shortcuts remain
      // gated below, and text inputs still retain X for typing.
      const selection = reactResources.get("/hotbar/selection");
      if (!inInputElement(event) && isCameraExitKey(lk, selection)) {
        event.preventDefault();
        exitCameraMode(clientContext);
        return;
      }

      if (!pointerLockManager.allowHUDInput() || inInputElement(event)) {
        return;
      }

      switch (event.key) {
        case "!":
        case "1":
          setHotbarSelectedIdx(0);
          break;

        case "@":
        case "2":
          setHotbarSelectedIdx(1);
          break;

        case "#":
        case "3":
          setHotbarSelectedIdx(2);
          break;

        case "4":
        case "$":
          setHotbarSelectedIdx(3);
          break;

        case "5":
        case "%":
          setHotbarSelectedIdx(4);
          break;

        case "6":
        case "^":
          setHotbarSelectedIdx(5);
          break;

        case "7":
        case "&":
          setHotbarSelectedIdx(6);
          break;

        case "8":
        case "*":
          setHotbarSelectedIdx(7);
          break;

        case "9":
        case "(":
          setHotbarSelectedIdx(8);
          break;
      }

      switch (lk) {
        case "KeyX":
          if (selection.kind === "camera") {
            exitCameraMode(clientContext);
          } else {
            fireAndForget(
              throwInventoryItem(clientContext, localPlayer.id, {
                kind: "hotbar",
                idx: hotbarSelectedIdx,
              })
            );
          }
          break;
        case "KeyF":
          if (selection.kind === "camera") {
            handleCameraKeyDown(reactResources, events, selection);
            audioManager.playSound("camera_flip");
          }
          break;
      }
    };

    let previousWheelSelectionTime = Date.now();
    const wheelCb = (event: WheelEvent) => {
      if (!pointerLockManager.isLockedAndFocused()) {
        return;
      }
      if (!getTypedStorageItem("settings.mouse.scrollHotbar")) {
        return;
      }
      const WHEEL_WAIT = 100; // ms
      if (Date.now() < previousWheelSelectionTime + WHEEL_WAIT) {
        return;
      }
      const idx = hotbarSelectedIdx;
      const WHEEL_THRESHOLD = 1;
      if (event.deltaY > WHEEL_THRESHOLD) {
        previousWheelSelectionTime = Date.now();
        setHotbarSelectedIdx(idx === inventory.hotbar.length - 1 ? 0 : idx + 1);
      } else if (event.deltaY < -WHEEL_THRESHOLD) {
        previousWheelSelectionTime = Date.now();
        setHotbarSelectedIdx(idx === 0 ? inventory.hotbar.length - 1 : idx - 1);
      }
    };

    window.addEventListener("keydown", keyDownCB);
    window.addEventListener("wheel", wheelCb, { passive: true });

    return () => {
      window.removeEventListener("keydown", keyDownCB);
      window.removeEventListener("wheel", wheelCb);
    };
  }, [hotbarSelectedIdx]);

  const health =
    reactResources.use("/ecs/c/health", userId) ??
    ({
      hp: 0,
      maxHp: 100,
    } as Health);

  if (!localInventory) {
    return <></>;
  }

  return (
    <motion.div
      className="hot-bar select-none"
      transition={{ type: "spring", ...HOTBAR_SPRING }}
      initial={{ x: "-50%" }}
      animate={{ x: "-50%", y: gameModal.kind !== "empty" ? "3%" : "-100%" }}
    >
      <SelectionNameOverlay />
      <HealthBarHUD
        health={health}
        type={canBreathe ? "normal" : "underwater"}
      />
      <div className="hot-bar-cells">
        {localInventory.hotbar.map((slot, index) => (
          <HotBarCell
            key={index}
            hotbarSelectedIdx={hotbarSelectedIdx}
            slot={slot}
            index={index}
          />
        ))}
      </div>
    </motion.div>
  );
};

export const HotBarCell: React.FunctionComponent<{
  slot?: ReadonlyItemAndCount;
  hotbarSelectedIdx: number;
  index: number;
}> = ({ slot, hotbarSelectedIdx, index }) => {
  const context = useClientContext();
  const { reactResources, userId } = context;

  const localInventory = reactResources.use("/ecs/c/inventory", userId);
  const gameModal = reactResources.use("/game_modal");
  const disabled = !usePlayerHasPermissionFoItemAction(slot?.item);

  if (!localInventory) return <></>;

  const maxOffset = Math.max(
    hotbarSelectedIdx,
    localInventory.hotbar.length - hotbarSelectedIdx
  );

  const cellAnimation: Variants = {
    from: (i: number) => ({
      y: 0,
      transition: { type: "spring", ...HOTBAR_SPRING, delay: i },
    }),
    to: (i: number) => ({
      y: "50%",
      transition: { type: "spring", ...HOTBAR_SPRING, delay: i },
    }),
  };

  return (
    <motion.div
      custom={(maxOffset - Math.abs(hotbarSelectedIdx - index)) * 0.03}
      animate={gameModal.kind !== "empty" ? "to" : "from"}
      variants={cellAnimation}
      key={`hot-bar-cell-wrapper-${index}`}
      className="hot-bar-cell-wrapper"
    >
      <NormalSlot
        entityId={userId}
        slot={slot}
        key={`hot-bar-cell-${index}`}
        slotReference={{
          kind: "hotbar",
          idx: index,
        }}
        selected={hotbarSelectedIdx === index}
        emptyImg={""}
        label={String(index === 9 ? 0 : index + 1)}
        disabled={disabled}
        animateDisabled={true}
      />
    </motion.div>
  );
};
