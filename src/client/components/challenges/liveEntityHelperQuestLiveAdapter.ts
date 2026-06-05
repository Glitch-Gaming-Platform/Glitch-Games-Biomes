import type {
  LiveEntityHelperQuestEntityContextV1,
  LiveEntityHelperQuestInstanceV1,
} from "@/shared/harthmere/live_entity_helper_quests_v1";
import {
  liveEntityRobotDefaultRobotIdForAreaV1,
  liveEntityRobotProtectionAreaForPositionV1,
} from "@/shared/harthmere/live_entity_robot_energy_protection_v1";

export const LIVE_ENTITY_HELPER_LIVE_MODE_RESPONSE_EVENT_V1 =
  "biomes:live-entity-helper-live-mode-response-v1" as const;

export interface LiveEntityHelperQuestLiveSnapshotV1 {
  inventoryItems: Record<string, number>;
  quests: {
    active: Record<string, { stepId?: string; progress?: number }>;
    completed: Record<string, number>;
  };
  warnings: string[];
  body?: any;
}

export class LiveEntityHelperLiveModeRejectionErrorV1 extends Error {
  readonly warnings: string[];

  constructor(warnings: string[]) {
    super(warnings.join(",") || "live_entity_helper_rejected");
    this.name = "LiveEntityHelperLiveModeRejectionErrorV1";
    this.warnings = warnings;
  }
}

export function isLiveEntityHelperLiveModeRejectionErrorV1(
  error: unknown
): error is LiveEntityHelperLiveModeRejectionErrorV1 {
  return error instanceof LiveEntityHelperLiveModeRejectionErrorV1;
}

function dispatchLiveEntityHelperLiveModeResponseV1(body: any) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(LIVE_ENTITY_HELPER_LIVE_MODE_RESPONSE_EVENT_V1, {
      detail: body,
    })
  );
}

export function harthmereLiveEntityHelperLiveModeUrlV1(search?: string) {
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

export function harthmereLiveEntityHelperLiveModeHeadersV1(search?: string) {
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

function finiteCoordinateV1(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

export function liveEntityHelperQuestPayloadForLiveModeV1(
  quest: LiveEntityHelperQuestInstanceV1,
  context: LiveEntityHelperQuestEntityContextV1,
  operation: string
) {
  const position = context.position ?? [];
  return {
    operation,
    questId: quest.questId,
    questKind: quest.kind,
    entityId: quest.entityId,
    entityLabel: quest.giverName,
    entityX: finiteCoordinateV1(position[0]),
    entityY: finiteCoordinateV1(position[1]),
    entityZ: finiteCoordinateV1(position[2]),
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

export function liveEntityRobotRechargePayloadForLiveModeV1(input: {
  entityId: string | number;
  label?: string;
  position?: readonly number[];
}) {
  const area = liveEntityRobotProtectionAreaForPositionV1(input.position);
  const robotId = area
    ? liveEntityRobotDefaultRobotIdForAreaV1(area.areaId)
    : String(input.entityId);
  return {
    operation: "live_entity_robot_energy_recharge",
    robotId,
    entityId: String(input.entityId),
    entityLabel: input.label,
    entityX: finiteCoordinateV1(input.position?.[0]),
    entityY: finiteCoordinateV1(input.position?.[1]),
    entityZ: finiteCoordinateV1(input.position?.[2]),
    areaId: area?.areaId,
  };
}

function recordNumberMapV1(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, raw]) => [key, Math.trunc(Number(raw))] as const)
      .filter(([, count]) => Number.isFinite(count) && count > 0)
  );
}

export function liveEntityHelperLiveSnapshotFromResponseV1(
  body: any
): LiveEntityHelperQuestLiveSnapshotV1 {
  const inventoryItems = recordNumberMapV1(
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

export function liveEntityHelperLiveSnapshotHasRejectionV1(
  snapshot: LiveEntityHelperQuestLiveSnapshotV1,
  prefix = "live_entity_helper_rejected:"
) {
  return snapshot.warnings.some((warning) => warning.startsWith(prefix));
}

async function submitLiveEntityHelperLiveModeActionV1(
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
  const response = await fetchImpl(
    harthmereLiveEntityHelperLiveModeUrlV1(options.locationSearch),
    {
      method: "POST",
      credentials: "same-origin",
      headers: harthmereLiveEntityHelperLiveModeHeadersV1(
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
  const snapshot = liveEntityHelperLiveSnapshotFromResponseV1(body);
  dispatchLiveEntityHelperLiveModeResponseV1(body);
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

export async function readLiveEntityHelperQuestLiveModeStateV1(
  options: {
    fetchImpl?: typeof fetch;
    requestId?: string;
    locationSearch?: string;
  } = {}
) {
  return submitLiveEntityHelperLiveModeActionV1(
    { operation: "live_entity_helper_read_state" },
    {
      ...options,
      targetId: "live_entity_helper_state",
    }
  );
}

export async function submitLiveEntityHelperQuestMutationV1(
  operation:
    | "live_entity_helper_accept"
    | "live_entity_helper_complete"
    | "live_entity_helper_record_boss_defeat",
  quest: LiveEntityHelperQuestInstanceV1,
  context: LiveEntityHelperQuestEntityContextV1,
  options: {
    fetchImpl?: typeof fetch;
    requestId?: string;
    locationSearch?: string;
    extraPayload?: Record<string, unknown>;
  } = {}
) {
  const snapshot = await submitLiveEntityHelperLiveModeActionV1(
    {
      ...liveEntityHelperQuestPayloadForLiveModeV1(quest, context, operation),
      ...(options.extraPayload ?? {}),
    },
    {
      ...options,
      targetId: quest.entityId,
    }
  );
  if (liveEntityHelperLiveSnapshotHasRejectionV1(snapshot)) {
    throw new LiveEntityHelperLiveModeRejectionErrorV1(snapshot.warnings);
  }
  return snapshot;
}

export async function submitLiveEntityRobotRechargeMutationV1(
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
  const snapshot = await submitLiveEntityHelperLiveModeActionV1(
    liveEntityRobotRechargePayloadForLiveModeV1(input),
    {
      ...options,
      targetId: String(input.entityId),
    }
  );
  if (
    liveEntityHelperLiveSnapshotHasRejectionV1(
      snapshot,
      "live_entity_robot_rejected:"
    )
  ) {
    throw new LiveEntityHelperLiveModeRejectionErrorV1(snapshot.warnings);
  }
  return snapshot;
}
