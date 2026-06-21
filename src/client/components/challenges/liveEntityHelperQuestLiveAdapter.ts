import type {
  LiveEntityHelperQuestEntityContext,
  LiveEntityHelperQuestInstance,
} from "@/shared/harthmere/live_entity_helper_quests";
import { fetchHarthmereLiveWithTimeout } from "@/client/components/harthmere_live_fetch";
import {
  liveEntityRobotDefaultRobotIdForArea,
  liveEntityRobotProtectionAreaForPosition,
} from "@/shared/harthmere/live_entity_robot_energy_protection";

export const LIVE_ENTITY_HELPER_LIVE_MODE_RESPONSE_EVENT =
  "biomes:live-entity-helper-live-mode-response" as const;

export interface LiveEntityHelperQuestLiveSnapshot {
  inventoryItems: Record<string, number>;
  quests: {
    active: Record<string, { stepId?: string; progress?: number }>;
    completed: Record<string, number>;
  };
  warnings: string[];
  body?: any;
}

export class LiveEntityHelperLiveModeRejectionError extends Error {
  readonly warnings: string[];

  constructor(warnings: string[]) {
    super(warnings.join(",") || "live_entity_helper_rejected");
    this.name = "LiveEntityHelperLiveModeRejectionError";
    this.warnings = warnings;
  }
}

export function isLiveEntityHelperLiveModeRejectionError(
  error: unknown
): error is LiveEntityHelperLiveModeRejectionError {
  return error instanceof LiveEntityHelperLiveModeRejectionError;
}

function dispatchLiveEntityHelperLiveModeResponse(body: any) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(LIVE_ENTITY_HELPER_LIVE_MODE_RESPONSE_EVENT, {
      detail: body,
    })
  );
}

export function harthmereLiveEntityHelperLiveModeUrl(search?: string) {
  const rawSearch =
    search ??
    (typeof window !== "undefined" ? window.location?.search ?? "" : "");
  const params = new URLSearchParams(rawSearch);
  const installId = params.get("install_id") ?? params.get("installId");
  const endpoint = "/api/harthmere/live_mode";
  return installId
    ? `${endpoint}?install_id=${encodeURIComponent(installId)}`
    : endpoint;
}

export function harthmereLiveEntityHelperLiveModeHeaders(search?: string) {
  const rawSearch =
    search ??
    (typeof window !== "undefined" ? window.location?.search ?? "" : "");
  const params = new URLSearchParams(rawSearch);
  const installId = params.get("install_id") ?? params.get("installId");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (installId) {
    headers["X-Glitch-Install-Id"] = installId;
  }
  return headers;
}

function finiteCoordinate(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

export function liveEntityHelperQuestPayloadForLiveMode(
  quest: LiveEntityHelperQuestInstance,
  context: LiveEntityHelperQuestEntityContext,
  operation: string
) {
  const position = context.position ?? [];
  return {
    operation,
    questId: quest.questId,
    questKind: quest.kind,
    entityId: quest.entityId,
    entityLabel: quest.giverName,
    entityX: finiteCoordinate(position[0]),
    entityY: finiteCoordinate(position[1]),
    entityZ: finiteCoordinate(position[2]),
    hasRobotComponent: context.hasRobotComponent === true,
    hasAppearanceComponent: context.hasAppearanceComponent === true,
    hasNpcMetadata: context.hasNpcMetadata === true,
    hasPlayerStatus: context.hasPlayerStatus === true,
    hasTalkableDialog: context.hasTalkableDialog === true,
    isRobotLike: context.isRobotLike === true,
    iced: context.iced === true,
    isMuckMonster: context.isMuckMonster === true,
    isJobsBoard: context.isJobsBoard === true,
    isMountOnly: context.isMountOnly === true,
  };
}

export function liveEntityRobotRechargePayloadForLiveMode(input: {
  entityId: string | number;
  label?: string;
  position?: readonly number[];
}) {
  const area = liveEntityRobotProtectionAreaForPosition(input.position);
  const robotId = area
    ? liveEntityRobotDefaultRobotIdForArea(area.areaId)
    : String(input.entityId);
  return {
    operation: "live_entity_robot_energy_recharge",
    robotId,
    entityId: String(input.entityId),
    entityLabel: input.label,
    entityX: finiteCoordinate(input.position?.[0]),
    entityY: finiteCoordinate(input.position?.[1]),
    entityZ: finiteCoordinate(input.position?.[2]),
    areaId: area?.areaId,
  };
}

function recordNumberMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, raw]) => [key, Math.trunc(Number(raw))] as const)
      .filter(([, count]) => Number.isFinite(count) && count > 0)
  );
}

export function liveEntityHelperLiveSnapshotFromResponse(
  body: any
): LiveEntityHelperQuestLiveSnapshot {
  const inventoryItems = recordNumberMap(
    body?.inventoryLootState?.actor?.items ??
      body?.buildingState?.inventoryItems ??
      body?.inventoryItems
  );
  const questState = body?.questState;
  const active =
    questState?.active && typeof questState.active === "object"
      ? questState.active
      : {};
  const completed =
    questState?.completed && typeof questState.completed === "object"
      ? questState.completed
      : {};
  const warnings = Array.isArray(body?.backendMutation?.warnings)
    ? body.backendMutation.warnings.map(String)
    : Array.isArray(body?.warnings)
    ? body.warnings.map(String)
    : [];
  return {
    inventoryItems,
    quests: {
      active,
      completed,
    },
    warnings,
    body,
  };
}

export function liveEntityHelperLiveSnapshotHasRejection(
  snapshot: LiveEntityHelperQuestLiveSnapshot,
  prefix = "live_entity_helper_rejected:"
) {
  return snapshot.warnings.some((warning) => warning.startsWith(prefix));
}

async function submitLiveEntityHelperLiveModeAction(
  payload: Record<string, unknown>,
  options: {
    fetchImpl?: typeof fetch;
    requestId?: string;
    locationSearch?: string;
    targetId?: string;
  } = {}
) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const requestId =
    options.requestId ??
    `live_entity_helper_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const response = await fetchHarthmereLiveWithTimeout(
    fetchImpl,
    harthmereLiveEntityHelperLiveModeUrl(options.locationSearch),
    {
      method: "POST",
      credentials: "same-origin",
      headers: harthmereLiveEntityHelperLiveModeHeaders(
        options.locationSearch
      ),
      body: JSON.stringify({
        requestId,
        idempotencyKey: requestId,
        targetId: options.targetId,
        actionKind: "request_quest_state_update",
        subsystem: "quest",
        actorEntityVersion: 1,
        targetEntityVersion: 1,
        zoneId: "harthmere_wilderness",
        clientSentAtMs: Date.now(),
        payload,
        clientClaims: {},
      }),
    } as any
  );
  const body = await response.json();
  const snapshot = liveEntityHelperLiveSnapshotFromResponse(body);
  dispatchLiveEntityHelperLiveModeResponse(body);
  if (!response.ok || body?.ok === false) {
    throw new Error(
      body?.error ??
        body?.validation?.errors?.join(",") ??
        body?.validation?.warnings?.join(",") ??
        snapshot.warnings.join(",") ??
        "live_entity_helper_request_failed"
    );
  }
  return snapshot;
}

export async function readLiveEntityHelperQuestLiveModeState(
  options: {
    fetchImpl?: typeof fetch;
    requestId?: string;
    locationSearch?: string;
  } = {}
) {
  return submitLiveEntityHelperLiveModeAction(
    { operation: "live_entity_helper_read_state" },
    {
      ...options,
      targetId: "live_entity_helper_state",
    }
  );
}

export async function submitLiveEntityHelperQuestMutation(
  operation:
    | "live_entity_helper_accept"
    | "live_entity_helper_complete"
    | "live_entity_helper_record_boss_defeat",
  quest: LiveEntityHelperQuestInstance,
  context: LiveEntityHelperQuestEntityContext,
  options: {
    fetchImpl?: typeof fetch;
    requestId?: string;
    locationSearch?: string;
    extraPayload?: Record<string, unknown>;
  } = {}
) {
  const snapshot = await submitLiveEntityHelperLiveModeAction(
    {
      ...liveEntityHelperQuestPayloadForLiveMode(quest, context, operation),
      ...(options.extraPayload ?? {}),
    },
    {
      ...options,
      targetId: quest.entityId,
    }
  );
  if (liveEntityHelperLiveSnapshotHasRejection(snapshot)) {
    throw new LiveEntityHelperLiveModeRejectionError(snapshot.warnings);
  }
  return snapshot;
}

export async function submitLiveEntityRobotRechargeMutation(
  input: {
    entityId: string | number;
    label?: string;
    position?: readonly number[];
  },
  options: {
    fetchImpl?: typeof fetch;
    requestId?: string;
    locationSearch?: string;
  } = {}
) {
  const snapshot = await submitLiveEntityHelperLiveModeAction(
    liveEntityRobotRechargePayloadForLiveMode(input),
    {
      ...options,
      targetId: String(input.entityId),
    }
  );
  if (
    liveEntityHelperLiveSnapshotHasRejection(
      snapshot,
      "live_entity_robot_rejected:"
    )
  ) {
    throw new LiveEntityHelperLiveModeRejectionError(snapshot.warnings);
  }
  return snapshot;
}
