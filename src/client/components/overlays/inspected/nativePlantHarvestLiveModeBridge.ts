import {
  HARTHMERE_INVENTORY_EVENT,
  HARTHMERE_LIVE_INVENTORY_SYNC_EVENT,
} from "@/client/components/challenges/harthmereEvents";
import { defaultHarthmereLiveFetch } from "@/client/components/harthmere_live_fetch";
import type { BiomesId } from "@/shared/ids";

export async function submitHarthmereNativePlantHarvestToLiveMode(input: {
  plantId: BiomesId;
  seedItemId: BiomesId;
  plantStatus?: string;
  farmingKind?: string;
  plantLabel?: string;
  position?: readonly number[];
}) {
  const plantId = String(input.plantId);
  const seedItemId = String(input.seedItemId);
  const requestId = `harthmere_native_plant_harvest_${plantId}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;
  const response = await defaultHarthmereLiveFetch("/api/harthmere/live_mode", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestId,
      idempotencyKey: requestId,
      actionKind: "request_farming_action",
      subsystem: "farming",
      actorEntityVersion: 1,
      zoneId: "the_grove",
      targetId: plantId,
      payload: {
        operation: "native_plant_harvest",
        plantId,
        seedItemId,
        plantStatus: input.plantStatus ?? "fully_grown",
        farmingKind: input.farmingKind ?? "plant",
        plantLabel: input.plantLabel,
        position: input.position ? [...input.position] : undefined,
      },
      includeSnapshots: [
        "inventoryLootState",
        "farmingFoodState",
        "playerStatusState",
      ],
      clientClaims: {
        source: "native_biomes_farming_harvest",
        plantStatus: input.plantStatus ?? "fully_grown",
        farmingKind: input.farmingKind ?? "plant",
      },
    }),
  });
  const body = await response.json().catch(() => undefined);
  if (typeof window !== "undefined" && body) {
    window.dispatchEvent(new Event(HARTHMERE_INVENTORY_EVENT));
    const syncEvent =
      typeof CustomEvent === "function"
        ? new CustomEvent(HARTHMERE_LIVE_INVENTORY_SYNC_EVENT, {
            detail: { body },
          })
        : Object.assign(new Event(HARTHMERE_LIVE_INVENTORY_SYNC_EVENT), {
            detail: { body },
          });
    window.dispatchEvent(syncEvent as CustomEvent<{ body: unknown }>);
  }
  return body;
}

export const submitHarthmereNativePlantHarvestToLiveModeForTest =
  submitHarthmereNativePlantHarvestToLiveMode;
