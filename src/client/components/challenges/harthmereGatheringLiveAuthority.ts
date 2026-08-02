import { defaultHarthmereLiveFetch } from "@/client/components/harthmere_live_fetch";
import { harthmerePlayerCapacityMessage } from "@/client/components/harthmere_capacity_messages";
import {
  HARTHMERE_INVENTORY_EVENT,
  HARTHMERE_LIVE_INVENTORY_SYNC_EVENT,
} from "@/client/components/challenges/harthmereEvents";
import {
  harthmereDialogueLiveModeHeaders,
  harthmereDialogueLiveModeUrl,
} from "@/client/components/challenges/dialogueLiveModeReputation";

/**
 * Production gathering never calls the localStorage simulator. The client sends
 * only the authored node id; the server reads ECS position, validates equipment,
 * rolls yield, owns depletion, and returns the authoritative inventory snapshot.
 */
export async function submitHarthmereGatheringNode(nodeId: string) {
  const requestId = `harthmere_gather_node_${nodeId}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;
  const search = typeof window !== "undefined" ? window.location.search : "";
  const response = await defaultHarthmereLiveFetch(
    harthmereDialogueLiveModeUrl(search),
    {
      method: "POST",
      credentials: "same-origin",
      headers: harthmereDialogueLiveModeHeaders(search),
      body: JSON.stringify({
        requestId,
        idempotencyKey: requestId,
        targetId: nodeId,
        actionKind: "request_farming_action",
        subsystem: "farming",
        actorEntityVersion: 1,
        zoneId: "harthmere_wilderness",
        payload: { operation: "gather_node", nodeId },
        includeSnapshots: [
          "inventoryLootState",
          "farmingFoodState",
          "playerStatusState",
        ],
        clientClaims: { source: "gathering_node_world_interaction" },
      }),
    }
  );
  const body = await response.json().catch(() => undefined);
  const warnings = Array.isArray(body?.backendMutation?.warnings)
    ? body.backendMutation.warnings.map(String)
    : [];
  const rejection = warnings.find((warning: string) =>
    warning.startsWith("gathering_rejected:")
  );
  if (!response.ok || body?.ok === false || rejection) {
    throw new Error(rejection ?? "gathering_rejected:request_failed");
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(HARTHMERE_INVENTORY_EVENT));
    window.dispatchEvent(
      new CustomEvent(HARTHMERE_LIVE_INVENTORY_SYNC_EVENT, {
        detail: { body },
      })
    );
  }
  return body;
}

export function harthmereGatheringErrorMessage(
  error: unknown,
  nodeName: string
) {
  const message = error instanceof Error ? error.message : String(error);
  const capacityMessage = harthmerePlayerCapacityMessage(message);
  if (capacityMessage) return capacityMessage;
  if (message.includes("node_depleted")) {
    return `${nodeName} is depleted and will respawn.`;
  }
  if (message.includes("required_tool_missing")) {
    return `Equip the required tool before harvesting ${nodeName}.`;
  }
  if (message.includes("node_out_of_range")) {
    return `Move closer to ${nodeName}.`;
  }
  if (message.includes("profession_level_too_low")) {
    return `Your gathering profession is not high enough for ${nodeName}.`;
  }
  return `Could not harvest ${nodeName}.`;
}
