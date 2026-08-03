import type { MapTrackableQuest } from "../tabs/MapQuestsTab";
import { fetchHarthmereLiveWithTimeout } from "@/client/components/harthmere_live_fetch";
import { harthmereJobsBoardQuestMarkerRuntimePositionForId } from "@/shared/harthmere/jobs_board_quest_marker_positions";
import {
  HarthmereQuestActionError,
  harthmereQuestRejectionWarningsFromResponse,
} from "@/client/components/challenges/questActionError";

export const HARTHMERE_QUEST_INVITES_UPDATED_EVENT =
  "harthmere:quest-invites-updated";

export const BIOMES_UI_SHARED_QUEST_MARKER_SOURCE =
  "shared_quest_invite" as const;

export interface HarthmereQuestInviteRecordForClient {
  inviteId: string;
  sharedQuestId: string;
  questId: string;
  questTitle: string;
  questArea: string;
  objectiveText: string;
  reward?: string;
  inviterActorId: string;
  inviteeActorId: string;
  createdAtMs: number;
  firstMarkerId?: string;
  markerWorldPosition?: [number, number, number];
}

export interface HarthmereSharedQuestForClient {
  sharedQuestId: string;
  questId: string;
  questTitle: string;
  questArea: string;
  objectiveText: string;
  reward?: string;
  memberActorIds: string[];
  inviteIds: string[];
  createdAtMs: number;
  updatedAtMs: number;
  firstMarkerId?: string;
  markerWorldPosition?: [number, number, number];
}

export interface HarthmereQuestStateForClient {
  version: string;
  actorId?: string;
  active: Record<
    string,
    {
      stepId?: string;
      progress: number;
      source?: string;
      title?: string;
      questKind?: string;
      entityId?: string;
      giverName?: string;
      giverPosition?: [number, number, number];
    }
  >;
  completed: Record<string, number>;
  pendingReceivedInvites: HarthmereQuestInviteRecordForClient[];
  sentPendingInvites: HarthmereQuestInviteRecordForClient[];
  sharedQuests: HarthmereSharedQuestForClient[];
  updatedAtMs?: number;
}

export interface HarthmereQuestInviteOption {
  questId: string;
  title: string;
  area: string;
  objectiveText: string;
  reward?: string;
  firstMarkerId?: string;
  markerWorldPosition?: [number, number, number];
}

export interface HarthmereQuestInviteAdapter {
  isHydrated: () => boolean;
  getPendingInvites: () => HarthmereQuestInviteRecordForClient[];
  getSentInvites: () => HarthmereQuestInviteRecordForClient[];
  getSharedQuests: () => HarthmereSharedQuestForClient[];
  refresh: () => Promise<void>;
  acceptInvite: (inviteId: string) => Promise<void>;
  denyInvite: (inviteId: string) => Promise<void>;
}

function text(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function maybeText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberMs(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : fallback;
}

function vec3(value: unknown): [number, number, number] | undefined {
  if (!Array.isArray(value) || value.length < 3) return undefined;
  const x = Number(value[0]);
  const y = Number(value[1]);
  const z = Number(value[2]);
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)
    ? [x, y, z]
    : undefined;
}

function normalizeInvite(
  raw: unknown
): HarthmereQuestInviteRecordForClient | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const value = raw as any;
  const inviteId = maybeText(value.inviteId);
  const sharedQuestId = maybeText(value.sharedQuestId);
  const questId = maybeText(value.questId);
  const inviterActorId = maybeText(value.inviterActorId);
  const inviteeActorId = maybeText(value.inviteeActorId);
  if (
    !inviteId ||
    !sharedQuestId ||
    !questId ||
    !inviterActorId ||
    !inviteeActorId
  ) {
    return undefined;
  }
  return {
    inviteId,
    sharedQuestId,
    questId,
    questTitle: text(value.questTitle, questId),
    questArea: text(value.questArea, "Quest"),
    objectiveText: text(value.objectiveText, "Join this quest together."),
    reward: maybeText(value.reward),
    inviterActorId,
    inviteeActorId,
    createdAtMs: numberMs(value.createdAtMs),
    firstMarkerId: maybeText(value.firstMarkerId),
    markerWorldPosition: vec3(value.markerWorldPosition),
  };
}

function normalizeSharedQuest(
  raw: unknown
): HarthmereSharedQuestForClient | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const value = raw as any;
  const sharedQuestId = maybeText(value.sharedQuestId);
  const questId = maybeText(value.questId);
  if (!sharedQuestId || !questId) return undefined;
  const memberActorIds = Array.isArray(value.memberActorIds)
    ? value.memberActorIds
        .map((entry: unknown) => maybeText(entry))
        .filter((entry: string | undefined): entry is string => Boolean(entry))
    : [];
  return {
    sharedQuestId,
    questId,
    questTitle: text(value.questTitle, questId),
    questArea: text(value.questArea, "Quest"),
    objectiveText: text(value.objectiveText, "Complete this quest together."),
    reward: maybeText(value.reward),
    memberActorIds,
    inviteIds: Array.isArray(value.inviteIds)
      ? value.inviteIds
          .map((entry: unknown) => maybeText(entry))
          .filter((entry: string | undefined): entry is string =>
            Boolean(entry)
          )
      : [],
    createdAtMs: numberMs(value.createdAtMs),
    updatedAtMs: numberMs(value.updatedAtMs),
    firstMarkerId: maybeText(value.firstMarkerId),
    markerWorldPosition: vec3(value.markerWorldPosition),
  };
}

export function normalizeHarthmereQuestState(
  raw: unknown
): HarthmereQuestStateForClient {
  const value = raw && typeof raw === "object" ? (raw as any) : {};
  return {
    version: text(value.version, "harthmere-live-mode-quest-state"),
    actorId: maybeText(value.actorId),
    active:
      value.active &&
      typeof value.active === "object" &&
      !Array.isArray(value.active)
        ? (value.active as HarthmereQuestStateForClient["active"])
        : {},
    completed:
      value.completed &&
      typeof value.completed === "object" &&
      !Array.isArray(value.completed)
        ? (value.completed as Record<string, number>)
        : {},
    pendingReceivedInvites: Array.isArray(value.pendingReceivedInvites)
      ? value.pendingReceivedInvites
          .map(normalizeInvite)
          .filter(
            (
              invite: HarthmereQuestInviteRecordForClient | undefined
            ): invite is HarthmereQuestInviteRecordForClient =>
              Boolean(invite)
          )
      : [],
    sentPendingInvites: Array.isArray(value.sentPendingInvites)
      ? value.sentPendingInvites
          .map(normalizeInvite)
          .filter(
            (
              invite: HarthmereQuestInviteRecordForClient | undefined
            ): invite is HarthmereQuestInviteRecordForClient =>
              Boolean(invite)
          )
      : [],
    sharedQuests: Array.isArray(value.sharedQuests)
      ? value.sharedQuests
          .map(normalizeSharedQuest)
          .filter(
            (
              quest: HarthmereSharedQuestForClient | undefined
            ): quest is HarthmereSharedQuestForClient => Boolean(quest)
          )
      : [],
    updatedAtMs: numberMs(value.updatedAtMs),
  };
}

export async function fetchHarthmereQuestState(
  fetchImpl: typeof fetch = fetch
) {
  const response = await fetchHarthmereLiveWithTimeout(
    fetchImpl,
    "/api/harthmere/live_mode_quest_state",
    {
      method: "GET",
      credentials: "same-origin",
    }
  );
  if (!response.ok) return undefined;
  const body = await response.json();
  return normalizeHarthmereQuestState(body?.questState);
}

export async function submitHarthmereQuestInviteMutation(
  payload: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch
) {
  const operation = text(payload.operation, "quest_invite");
  const errorContext = {
    action: "invite" as const,
    questTitle:
      typeof payload.questTitle === "string" ? payload.questTitle : undefined,
  };
  const requestId = `biomes_ui_${operation}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2)}`;
  let response: Response;
  try {
    response = await fetchHarthmereLiveWithTimeout(
      fetchImpl,
      "/api/harthmere/live_mode",
      {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          idempotencyKey: requestId,
          actionKind: "request_quest_state_update",
          subsystem: "quest",
          actorEntityVersion: 1,
          zoneId: "harthmere",
          targetId:
            typeof payload.inviteeActorId === "string"
              ? payload.inviteeActorId
              : undefined,
          payload,
          clientClaims: {},
        }),
      }
    );
  } catch {
    throw new HarthmereQuestActionError(
      ["quest_invite_rejected:network_error"],
      errorContext
    );
  }
  const body = await response.json().catch(() => undefined);
  const rejectionWarnings = harthmereQuestRejectionWarningsFromResponse(body);
  if (!body || !response.ok || body?.ok === false) {
    throw new HarthmereQuestActionError(
      rejectionWarnings.length
        ? rejectionWarnings
        : ["quest_invite_rejected:request_failed"],
      errorContext
    );
  }
  if (rejectionWarnings.length) {
    throw new HarthmereQuestActionError(rejectionWarnings, errorContext);
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(HARTHMERE_QUEST_INVITES_UPDATED_EVENT, {
        detail: { questState: body?.questState },
      })
    );
  }
  return body;
}

export function createHarthmereQuestInviteAdapter(input: {
  questState: unknown;
  hydrated: boolean;
  setQuestState?: (state: HarthmereQuestStateForClient | undefined) => void;
  refresh: () => Promise<void>;
}): HarthmereQuestInviteAdapter {
  const questState = normalizeHarthmereQuestState(input.questState);
  const respond = async (inviteId: string, response: "accept" | "deny") => {
    const body = await submitHarthmereQuestInviteMutation({
      operation: "respond_to_quest_invite",
      inviteId,
      response,
    });
    if (body?.questState) {
      input.setQuestState?.(normalizeHarthmereQuestState(body.questState));
    } else {
      await input.refresh();
    }
  };
  return {
    isHydrated: () => input.hydrated,
    getPendingInvites: () => questState.pendingReceivedInvites,
    getSentInvites: () => questState.sentPendingInvites,
    getSharedQuests: () => questState.sharedQuests,
    refresh: input.refresh,
    acceptInvite: (inviteId) => respond(inviteId, "accept"),
    denyInvite: (inviteId) => respond(inviteId, "deny"),
  };
}

// Resolve the world position for a shared quest's map landmark. Prefer the
// server-supplied markerWorldPosition; otherwise fall back to looking up the
// quest's firstMarkerId in the known jobs-board quest marker table, so an
// accepted shared quest still gets an on-map landmark instead of vanishing.
export function resolveSharedQuestMarkerPosition(quest: {
  markerWorldPosition?: [number, number, number];
  firstMarkerId?: string;
}): [number, number, number] | undefined {
  if (quest.markerWorldPosition) {
    return quest.markerWorldPosition;
  }
  const resolved = harthmereJobsBoardQuestMarkerRuntimePositionForId(
    quest.firstMarkerId
  );
  return resolved
    ? ([
        resolved.position[0],
        resolved.position[1],
        resolved.position[2],
      ] as [number, number, number])
    : undefined;
}

export function sharedQuestAcceptedLandmarksForBiomesUI(raw: unknown) {
  const state = normalizeHarthmereQuestState(raw);
  return state.sharedQuests.flatMap((quest) => {
    const markerPosition = resolveSharedQuestMarkerPosition(quest);
    if (!markerPosition) return [];
    return [
      {
        id: `shared_quest_marker:${quest.sharedQuestId}`,
        label: quest.questTitle,
        position: markerPosition,
        kind: "objective" as const,
        area: quest.questArea,
        visibleOnWorldMap: true as const,
        visibleOnHudMap: true as const,
        active: true as const,
        description: quest.objectiveText,
        source: BIOMES_UI_SHARED_QUEST_MARKER_SOURCE,
        sharedQuestId: quest.sharedQuestId,
      },
    ];
  });
}

export function sharedQuestTrackableQuestsForBiomesUI(
  raw: unknown
): MapTrackableQuest[] {
  const state = normalizeHarthmereQuestState(raw);
  return state.sharedQuests.map((quest) => ({
    questId: `shared_quest:${quest.sharedQuestId}`,
    title: quest.questTitle,
    area: `${quest.questArea} - ${quest.memberActorIds.length} players`,
    status: "active" as const,
    firstMarkerId: quest.markerWorldPosition
      ? `shared_quest_marker:${quest.sharedQuestId}`
      : quest.firstMarkerId,
    reward: quest.reward,
    kind: quest.questId,
    kindLabel: "Shared Quest",
    objective: quest.objectiveText,
    objectives: [quest.objectiveText],
    description: quest.objectiveText,
  }));
}

export function activeSharedQuestMissionStepsForBiomesUI(raw: unknown) {
  const state = normalizeHarthmereQuestState(raw);
  return state.sharedQuests.map((quest, index) => ({
    id: `shared_quest:${quest.sharedQuestId}`,
    title: `Shared quest ${index + 1}`,
    objective: quest.objectiveText,
    done: false,
  }));
}

export function firstActiveSharedQuestTitleForBiomesUI(raw: unknown) {
  return normalizeHarthmereQuestState(raw).sharedQuests[0]?.questTitle;
}

export function questInviteOptionsFromTrackableQuests(
  quests: unknown[]
): HarthmereQuestInviteOption[] {
  const seen = new Set<string>();
  return quests.flatMap((quest: any) => {
    const questId = maybeText(quest?.questId) ?? maybeText(quest?.id);
    const title = maybeText(quest?.title) ?? questId;
    if (!questId || !title || seen.has(questId)) return [];
    seen.add(questId);
    return [
      {
        questId,
        title,
        area: text(quest?.area, "Quest"),
        objectiveText: text(
          quest?.objectiveText ?? quest?.objective ?? quest?.description,
          `Join ${title} together.`
        ),
        reward: maybeText(quest?.reward),
        firstMarkerId: maybeText(quest?.firstMarkerId),
        markerWorldPosition: vec3(quest?.markerWorldPosition),
      },
    ];
  });
}
