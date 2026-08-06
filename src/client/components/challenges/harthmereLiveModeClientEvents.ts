import { BIOMES_UI_PLAYER_STATUS_UPDATED_EVENT } from "@/client/components/biomes_ui/adapters/playerStatusAdapter";
import {
  HARTHMERE_BUSINESS_INVENTORY_LOOT_UPDATED_EVENT,
  HARTHMERE_LIVE_INVENTORY_SYNC_EVENT,
} from "@/client/components/challenges/harthmereEvents";

export const HARTHMERE_ESCORT_ARRIVAL_DIALOGUE_EVENT =
  "biomes:harthmere-escort-arrival-dialogue";

export interface HarthmereEscortArrivalDialogueDetail {
  companionId: string;
  displayName: string;
  dialogue: string;
  destinationName?: string;
  arrivedAtMs?: number;
}

const deliveredEscortDialogueKeys = new WeakMap<Window, Set<string>>();

export function dispatchHarthmereLiveModeResponseEventsForTest(
  body: any,
  win: Window | undefined = typeof window !== "undefined" ? window : undefined
) {
  const result = {
    inventoryLootState: false,
    playerStatusState: false,
    escortArrivalDialogues: 0,
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

  const combatState = body.combatState ?? body.snapshots?.combatState;
  const entitySnapshots =
    combatState?.entitySnapshots &&
    typeof combatState.entitySnapshots === "object"
      ? combatState.entitySnapshots
      : {};
  const delivered = deliveredEscortDialogueKeys.get(win) ?? new Set<string>();
  deliveredEscortDialogueKeys.set(win, delivered);
  for (const [entityId, entity] of Object.entries(entitySnapshots) as Array<
    [string, Record<string, unknown>]
  >) {
    if (entity.escortStatus !== "arrived") continue;
    const dialogue = String(entity.escortArrivalDialogue ?? "").trim();
    if (!dialogue) continue;
    const companionId = String(entity.escortCompanionId ?? entityId).trim();
    const arrivedAtMs = Number(entity.escortArrivedAtMs);
    const key = `${companionId}:${
      Number.isFinite(arrivedAtMs) ? arrivedAtMs : "arrived"
    }`;
    if (delivered.has(key)) continue;
    delivered.add(key);
    win.dispatchEvent(
      new CustomEvent<HarthmereEscortArrivalDialogueDetail>(
        HARTHMERE_ESCORT_ARRIVAL_DIALOGUE_EVENT,
        {
          detail: {
            companionId,
            displayName: String(entity.escortDisplayName ?? "Newcomer"),
            dialogue,
            arrivedAtMs: Number.isFinite(arrivedAtMs) ? arrivedAtMs : undefined,
          },
        }
      )
    );
    result.escortArrivalDialogues += 1;
  }

  return result;
}
