import { BIOMES_UI_PLAYER_STATUS_UPDATED_EVENT } from "@/client/components/biomes_ui/adapters/playerStatusAdapter";
import {
  HARTHMERE_BUSINESS_INVENTORY_LOOT_UPDATED_EVENT,
  HARTHMERE_LIVE_INVENTORY_SYNC_EVENT,
} from "@/client/components/challenges/harthmereEvents";

export function dispatchHarthmereLiveModeResponseEventsForTest(
  body: any,
  win: Window | undefined =
    typeof window !== "undefined" ? window : undefined
) {
  const result = {
    inventoryLootState: false,
    playerStatusState: false,
  };
  if (!win || !body) {
    return result;
  }

  const inventoryLootState =
    body.inventoryLootState ?? body.snapshots?.inventoryLootState;
  if (inventoryLootState) {
    win.dispatchEvent(
      new CustomEvent(HARTHMERE_BUSINESS_INVENTORY_LOOT_UPDATED_EVENT, {
        detail: { inventoryLootState, body },
      })
    );
    win.dispatchEvent(
      new CustomEvent(HARTHMERE_LIVE_INVENTORY_SYNC_EVENT, {
        detail: { inventoryLootState, body },
      })
    );
    result.inventoryLootState = true;
  }

  const playerStatusState =
    body.playerStatusState ?? body.snapshots?.playerStatusState;
  if (playerStatusState) {
    win.dispatchEvent(
      new CustomEvent(BIOMES_UI_PLAYER_STATUS_UPDATED_EVENT, {
        detail: playerStatusState,
      })
    );
    result.playerStatusState = true;
  }

  return result;
}
