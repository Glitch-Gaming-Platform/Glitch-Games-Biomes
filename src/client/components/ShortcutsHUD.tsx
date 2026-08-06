import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { usePointerLockManager } from "@/client/components/contexts/PointerLockContext";
import { useInventoryDraggerContext } from "@/client/components/inventory/InventoryDragger";
import { shouldFocusAndLockForGameplayMovementKey } from "@/client/components/shortcutsHudMovementFocus";
import { shortcutsHUDHandlesKeyForModeForTest } from "@/client/components/shortcutsHudKeyOwnership";
import type { GameModal } from "@/client/game/resources/game_modal";
import type { GlobalKeyCode } from "@/client/game/util/keyboard";
import { cleanListener } from "@/client/util/helpers";
import type { Inventory, Label } from "@/shared/ecs/gen/components";
import { includes } from "lodash";
import React, { useCallback, useEffect, useRef } from "react";

export function inInputElement(event: KeyboardEvent) {
  const target = event.target as HTMLDivElement;
  return target && includes(["TEXTAREA", "INPUT"], target.tagName);
}

const HARTHMERE_RESERVED_KEY_CODES = new Set([
  "KeyM", // Harthmere map
  "KeyJ", // Harthmere quest journal
  "Quote", // Draw / sheathe weapon
  "Tab", // Combat target lock / release
  "KeyH", // Heavy attack
  "KeyL", // Slotted spell
  "KeyP", // Farming journal
  "KeyN", // PvP flag
]);

function isLocalDevHarthmereReservedKey(code: string) {
  return (
    process.env.NODE_ENV !== "production" &&
    HARTHMERE_RESERVED_KEY_CODES.has(code)
  );
}

export const ShortcutsHUD: React.FunctionComponent<{
  /**
   * Replacement BiomesUI owns its tab keys at capture phase, but R must still
   * reach the original native crafting modal. Keeping only that handler mounted
   * avoids reviving legacy E/I/M/C/V/O shortcuts behind the new tab rail.
   */
  recipesOnly?: boolean;
}> = ({ recipesOnly = false }) => {
  const { userId, reactResources, audioManager } = useClientContext();

  const pointerLockManager = usePointerLockManager();
  const returnPointerLock = useRef<boolean>(undefined);
  const lastInputKeydown = useRef(performance.now());
  const [gameModal] = reactResources.useAll(
    ["/game_modal"],
    ["/ecs/c/label", userId],
    ["/ecs/c/inventory", userId]
  ) as [GameModal, Label, Inventory];

  const { setDragItem } = useInventoryDraggerContext();

  useEffect(
    () =>
      cleanListener(window, {
        keydown: (event: KeyboardEvent) => {
          const lk = event.code as GlobalKeyCode;
          if (event.repeat) return;
          if (!shortcutsHUDHandlesKeyForModeForTest(lk, recipesOnly)) return;
          if (isLocalDevHarthmereReservedKey(lk)) return;
          if (event.altKey || event.ctrlKey || event.metaKey) return;

          const inInputEl = inInputElement(event);
          if (inInputEl) {
            lastInputKeydown.current = performance.now();
          } else {
            if (
              shouldFocusAndLockForGameplayMovementKey({
                code: lk,
                modalKind: gameModal.kind,
                inInputElement: inInputEl,
                repeat: event.repeat,
                altKey: event.altKey,
                ctrlKey: event.ctrlKey,
                metaKey: event.metaKey,
                pointerLocked: pointerLockManager.isLocked(),
              })
            ) {
              pointerLockManager.focusAndLock();
            }

            switch (lk) {
              case "KeyI":
                toggleInventoryModal();
                break;
              case "KeyR":
                toggleCraftingModal();
                break;
              case "KeyV":
                toggleInboxModal();
                break;
              case "BracketRight":
                toggleCollectionsModal();
                break;
              case "KeyU":
                toggleMapModal();
                break;
              case "KeyM":
                toggleMapModal();
                break;
              case "KeyO":
                toggleSettingsModal();
                break;
            }
          }
        },

        keyup: (event: KeyboardEvent) => {
          const lk = event.code as GlobalKeyCode;
          if (lk === "Escape") {
            returnPointerLock.current = true;
            doCloseModal();
          }
        },
      }),
    [recipesOnly]
  );

  const doCloseModal = () => {
    reactResources.set("/game_modal", {
      kind: "empty",
      returnPointerLock: returnPointerLock.current,
    });
  };

  const openModal = (modal: GameModal) => {
    const existingModal = reactResources.get("/game_modal");
    if (existingModal.kind !== "empty" && existingModal.onClose) {
      existingModal.onClose();
    }
    reactResources.set("/game_modal", modal);
    returnPointerLock.current = pointerLockManager.isLocked();
    pointerLockManager.unlock();
    audioManager.playSound("button_click");
  };

  const toggleInventoryModal = () => {
    if (gameModal.kind !== "inventory") {
      openModal({ kind: "inventory" });
    } else {
      audioManager.playSound("button_click");
      doCloseModal();
    }
  };

  const toggleCraftingModal = useCallback(() => {
    if (gameModal.kind === "crafting") {
      doCloseModal();
      setDragItem(null);
    } else {
      openModal({ kind: "crafting" });
    }
  }, []);

  const toggleCollectionsModal = () => {
    const gameModal = reactResources.get("/game_modal");
    if (gameModal.kind === "collections") {
      doCloseModal();
      setDragItem(null);
    } else {
      openModal({ kind: "collections" });
    }
  };

  const toggleInboxModal = () => {
    const gameModal = reactResources.get("/game_modal");
    if (gameModal.kind === "inbox") {
      doCloseModal();
      setDragItem(null);
    } else {
      openModal({ kind: "inbox" });
    }
  };

  const toggleSettingsModal = () => {
    const gameModal = reactResources.get("/game_modal");
    if (gameModal.kind === "game_settings") {
      doCloseModal();
      setDragItem(null);
    } else {
      openModal({ kind: "game_settings" });
    }
  };

  const toggleMapModal = () => {
    if (gameModal.kind === "map") {
      doCloseModal();
      setDragItem(null);
    } else {
      openModal({ kind: "map" });
    }
  };

  return <></>;
};
