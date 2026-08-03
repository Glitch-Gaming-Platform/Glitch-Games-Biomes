import { harthmereBiomesAuthHeaders } from "@/shared/util/harthmere_auth_session";

export const PLAYER_INVITE_HOTKEY_CODE = "Digit0";
export const PLAYER_INVITE_HOTKEY_LABEL = "0";
export const PLAYER_INVITE_QUERY_PARAM = "invite_code";
export const PLAYER_INVITE_STATUS_EVENT = "biomes:player-invite-status";

const PLAYER_INVITE_PENDING_SESSION_KEY =
  "biomes.harthmere.pendingPlayerInviteCode";
const PLAYER_INVITE_CODE_LENGTH = 8;

export type PlayerInviteCreateResponse = {
  ok: true;
  code: string;
  formatted_code: string;
  play_url: string;
  inviter_name: string;
  expires_at: string;
};

export type PlayerInviteJoinResponse = {
  ok: true;
  inviter_name: string;
  position: [number, number, number];
  already_joined: boolean;
};

export type PlayerInviteStatusDetail = {
  kind: "success" | "error" | "info";
  message: string;
};

export class PlayerInviteRequestError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number
  ) {
    super(message);
  }
}

export function normalizePlayerInviteCode(raw: unknown) {
  return typeof raw === "string"
    ? raw
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, PLAYER_INVITE_CODE_LENGTH)
    : "";
}

export function formatPlayerInviteCode(raw: unknown) {
  const normalized = normalizePlayerInviteCode(raw);
  return normalized.length <= 4
    ? normalized
    : `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
}

export function playerInviteCodeFromSearch(search: string) {
  const code = normalizePlayerInviteCode(
    new URLSearchParams(search).get(PLAYER_INVITE_QUERY_PARAM)
  );
  return code.length === PLAYER_INVITE_CODE_LENGTH ? code : undefined;
}

export function readPendingPlayerInviteCode() {
  if (typeof window === "undefined") {
    return undefined;
  }
  const fromLocation = playerInviteCodeFromSearch(window.location.search);
  if (fromLocation) {
    setPendingPlayerInviteCode(fromLocation);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete(PLAYER_INVITE_QUERY_PARAM);
      window.history.replaceState(window.history.state, "", url.toString());
    } catch {}
    return fromLocation;
  }
  try {
    const stored = normalizePlayerInviteCode(
      window.sessionStorage.getItem(PLAYER_INVITE_PENDING_SESSION_KEY)
    );
    return stored.length === PLAYER_INVITE_CODE_LENGTH ? stored : undefined;
  } catch {
    return undefined;
  }
}

export function setPendingPlayerInviteCode(code: string | undefined) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const normalized = normalizePlayerInviteCode(code);
    if (normalized) {
      window.sessionStorage.setItem(
        PLAYER_INVITE_PENDING_SESSION_KEY,
        normalized
      );
    } else {
      window.sessionStorage.removeItem(PLAYER_INVITE_PENDING_SESSION_KEY);
    }
  } catch {}
}

export function clearPendingPlayerInviteCode() {
  setPendingPlayerInviteCode(undefined);
}

async function playerInviteRequest<T>(body: Record<string, unknown>) {
  const response = await fetch("/api/glitch/harthmere", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...harthmereBiomesAuthHeaders("/api/glitch/harthmere"),
    },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = String(json?.error ?? "PLAYER_INVITE_REQUEST_FAILED");
    throw new PlayerInviteRequestError(
      playerInviteErrorMessage(code),
      code,
      response.status
    );
  }
  return json as T;
}

export function createPlayerInvite(rotate = false) {
  return playerInviteRequest<PlayerInviteCreateResponse>({
    op: "inviteCreate",
    rotate,
  });
}

export function joinPlayerInvite(code: string) {
  return playerInviteRequest<PlayerInviteJoinResponse>({
    op: "inviteJoin",
    invite_code: normalizePlayerInviteCode(code),
  });
}

export async function joinPlayerInviteWithRetry(code: string, attempts = 5) {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await joinPlayerInvite(code);
    } catch (error) {
      lastError = error;
      if (
        !(error instanceof PlayerInviteRequestError) ||
        error.code !== "INVITE_PLAYER_NOT_READY" ||
        attempt === attempts - 1
      ) {
        throw error;
      }
      await new Promise((resolve) =>
        window.setTimeout(resolve, 350 * (attempt + 1))
      );
    }
  }
  throw lastError;
}

export function playerInviteErrorMessage(code: string) {
  switch (code) {
    case "INVITE_NOT_FOUND":
    case "INVALID_INVITE_CODE":
      return "That invite code is not valid.";
    case "INVITE_EXPIRED":
      return "That invite expired. Ask your friend for a new code.";
    case "CANNOT_JOIN_OWN_INVITE":
      return "You are already the owner of that invite.";
    case "INVITER_POSITION_UNAVAILABLE":
      return "Your location is still loading. Try again in a moment.";
    case "INVITE_PLAYER_NOT_READY":
      return "Your character is still entering the world. Try again in a moment.";
    case "INVITE_DESTINATION_UNAVAILABLE":
      return "Friends cannot join at that location right now.";
    case "INVITE_SERVICE_UNAVAILABLE":
      return "Invites are temporarily unavailable. Please try again.";
    default:
      return "The invite could not be completed. Please try again.";
  }
}

export function dispatchPlayerInviteStatus(detail: PlayerInviteStatusDetail) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<PlayerInviteStatusDetail>(PLAYER_INVITE_STATUS_EVENT, {
        detail,
      })
    );
  }
}
