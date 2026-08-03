export const HARTHMERE_PLAYER_INVITE_TTL_SECONDS = 60 * 60;
export const HARTHMERE_PLAYER_INVITE_CODE_LENGTH = 8;

const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type HarthmerePlayerInvitePosition = [number, number, number];
export type HarthmerePlayerInviteOrientation = [number, number];

export type HarthmerePlayerInviteRecord = {
  version: 1;
  code: string;
  titleId: string;
  inviterPlayerId: string;
  inviterName: string;
  position: HarthmerePlayerInvitePosition;
  orientation?: HarthmerePlayerInviteOrientation;
  createdAtMs: number;
  expiresAtMs: number;
};

export type HarthmerePlayerInviteSnapshot = {
  playerId: string;
  name?: string;
  position?: readonly number[];
  orientation?: readonly number[];
};

export interface HarthmerePlayerInviteStore {
  getInvite(code: string): Promise<HarthmerePlayerInviteRecord | undefined>;
  setInvite(
    record: HarthmerePlayerInviteRecord,
    ttlSeconds: number
  ): Promise<void>;
  deleteInvite(code: string): Promise<void>;
  getActiveCode(
    titleId: string,
    inviterPlayerId: string
  ): Promise<string | undefined>;
  setActiveCode(
    titleId: string,
    inviterPlayerId: string,
    code: string,
    ttlSeconds: number
  ): Promise<void>;
  tryClaim(
    code: string,
    playerId: string,
    ttlSeconds: number
  ): Promise<boolean>;
  releaseClaim(code: string, playerId: string): Promise<void>;
}

export class HarthmerePlayerInviteError extends Error {
  constructor(
    readonly code: string,
    readonly status: number
  ) {
    super(code);
  }
}

export function normalizeHarthmerePlayerInviteCode(raw: unknown) {
  if (typeof raw !== "string") {
    return "";
  }
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, HARTHMERE_PLAYER_INVITE_CODE_LENGTH);
}

export function formatHarthmerePlayerInviteCode(raw: unknown) {
  const normalized = normalizeHarthmerePlayerInviteCode(raw);
  return normalized.length <= 4
    ? normalized
    : `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
}

export function makeHarthmerePlayerInviteCode(randomBytes: Uint8Array) {
  if (randomBytes.length < HARTHMERE_PLAYER_INVITE_CODE_LENGTH) {
    throw new Error("INSUFFICIENT_INVITE_RANDOMNESS");
  }
  let code = "";
  for (let i = 0; i < HARTHMERE_PLAYER_INVITE_CODE_LENGTH; i += 1) {
    code += INVITE_CODE_ALPHABET[randomBytes[i] % INVITE_CODE_ALPHABET.length];
  }
  return code;
}

export function harthmerePlayerInvitePlayUrl(titleId: string, code: string) {
  const url = new URL(
    `https://www.glitch.fun/games/${encodeURIComponent(titleId)}/play`
  );
  url.searchParams.set("invite_code", formatHarthmerePlayerInviteCode(code));
  return url.toString();
}

function finiteTuple(
  value: readonly number[] | undefined,
  length: number
): number[] | undefined {
  if (
    !value ||
    value.length < length ||
    value.slice(0, length).some((part) => !Number.isFinite(part))
  ) {
    return undefined;
  }
  return value.slice(0, length);
}

export function harthmerePlayerInvitePosition(
  snapshot: HarthmerePlayerInviteSnapshot | undefined
): HarthmerePlayerInvitePosition | undefined {
  return finiteTuple(snapshot?.position, 3) as
    HarthmerePlayerInvitePosition | undefined;
}

export function harthmerePlayerInviteOrientation(
  snapshot: HarthmerePlayerInviteSnapshot | undefined
): HarthmerePlayerInviteOrientation | undefined {
  return finiteTuple(snapshot?.orientation, 2) as
    HarthmerePlayerInviteOrientation | undefined;
}

export async function createHarthmerePlayerInvite(input: {
  titleId: string;
  inviterPlayerId: string;
  store: HarthmerePlayerInviteStore;
  readPlayer: (
    playerId: string
  ) => Promise<HarthmerePlayerInviteSnapshot | undefined>;
  randomBytes: (length: number) => Uint8Array;
  nowMs?: number;
  rotate?: boolean;
  destinationAllowed?: (position: HarthmerePlayerInvitePosition) => boolean;
}) {
  const nowMs = input.nowMs ?? Date.now();
  const inviter = await input.readPlayer(input.inviterPlayerId);
  const position = harthmerePlayerInvitePosition(inviter);
  if (!position) {
    throw new HarthmerePlayerInviteError("INVITER_POSITION_UNAVAILABLE", 409);
  }
  if (input.destinationAllowed && !input.destinationAllowed(position)) {
    throw new HarthmerePlayerInviteError("INVITE_DESTINATION_UNAVAILABLE", 409);
  }

  const activeCode = await input.store.getActiveCode(
    input.titleId,
    input.inviterPlayerId
  );
  if (input.rotate && activeCode) {
    const activeInvite = await input.store.getInvite(activeCode);
    if (
      activeInvite?.titleId === input.titleId &&
      activeInvite.inviterPlayerId === input.inviterPlayerId
    ) {
      await input.store.deleteInvite(activeCode);
    }
  }

  let code = input.rotate ? undefined : activeCode;
  let existing = code ? await input.store.getInvite(code) : undefined;
  if (
    existing &&
    (existing.expiresAtMs <= nowMs ||
      existing.titleId !== input.titleId ||
      existing.inviterPlayerId !== input.inviterPlayerId)
  ) {
    existing = undefined;
    code = undefined;
  }

  if (!code) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = makeHarthmerePlayerInviteCode(
        input.randomBytes(HARTHMERE_PLAYER_INVITE_CODE_LENGTH)
      );
      if (!(await input.store.getInvite(candidate))) {
        code = candidate;
        break;
      }
    }
  }
  if (!code) {
    throw new HarthmerePlayerInviteError("INVITE_CODE_GENERATION_FAILED", 503);
  }

  const record: HarthmerePlayerInviteRecord = {
    version: 1,
    code,
    titleId: input.titleId,
    inviterPlayerId: input.inviterPlayerId,
    inviterName: inviter?.name?.trim() || `Player ${input.inviterPlayerId}`,
    position,
    orientation: harthmerePlayerInviteOrientation(inviter),
    createdAtMs: existing?.createdAtMs ?? nowMs,
    expiresAtMs: nowMs + HARTHMERE_PLAYER_INVITE_TTL_SECONDS * 1000,
  };
  await input.store.setInvite(record, HARTHMERE_PLAYER_INVITE_TTL_SECONDS);
  await input.store.setActiveCode(
    input.titleId,
    input.inviterPlayerId,
    code,
    HARTHMERE_PLAYER_INVITE_TTL_SECONDS
  );
  return {
    record,
    playUrl: harthmerePlayerInvitePlayUrl(input.titleId, code),
  };
}

export async function joinHarthmerePlayerInvite(input: {
  titleId: string;
  inviteePlayerId: string;
  code: string;
  store: HarthmerePlayerInviteStore;
  readPlayer: (
    playerId: string
  ) => Promise<HarthmerePlayerInviteSnapshot | undefined>;
  publishWarp: (
    playerId: string,
    position: HarthmerePlayerInvitePosition,
    orientation?: HarthmerePlayerInviteOrientation
  ) => Promise<void>;
  nowMs?: number;
  destinationAllowed?: (position: HarthmerePlayerInvitePosition) => boolean;
}) {
  const nowMs = input.nowMs ?? Date.now();
  const code = normalizeHarthmerePlayerInviteCode(input.code);
  if (code.length !== HARTHMERE_PLAYER_INVITE_CODE_LENGTH) {
    throw new HarthmerePlayerInviteError("INVALID_INVITE_CODE", 422);
  }
  const record = await input.store.getInvite(code);
  if (!record || record.titleId !== input.titleId) {
    throw new HarthmerePlayerInviteError("INVITE_NOT_FOUND", 404);
  }
  if (record.expiresAtMs <= nowMs) {
    throw new HarthmerePlayerInviteError("INVITE_EXPIRED", 410);
  }
  if (record.inviterPlayerId === input.inviteePlayerId) {
    throw new HarthmerePlayerInviteError("CANNOT_JOIN_OWN_INVITE", 409);
  }
  const invitee = await input.readPlayer(input.inviteePlayerId);
  if (!harthmerePlayerInvitePosition(invitee)) {
    throw new HarthmerePlayerInviteError("INVITE_PLAYER_NOT_READY", 409);
  }
  const inviter = await input.readPlayer(record.inviterPlayerId);
  const position = harthmerePlayerInvitePosition(inviter) ?? record.position;
  const orientation =
    harthmerePlayerInviteOrientation(inviter) ?? record.orientation;
  if (input.destinationAllowed && !input.destinationAllowed(position)) {
    throw new HarthmerePlayerInviteError("INVITE_DESTINATION_UNAVAILABLE", 409);
  }

  const remainingTtl = Math.max(
    1,
    Math.ceil((record.expiresAtMs - nowMs) / 1000)
  );
  if (
    !(await input.store.tryClaim(code, input.inviteePlayerId, remainingTtl))
  ) {
    return {
      record,
      position,
      alreadyJoined: true,
    };
  }

  try {
    await input.publishWarp(input.inviteePlayerId, position, orientation);
  } catch (error) {
    await input.store
      .releaseClaim(code, input.inviteePlayerId)
      .catch(() => undefined);
    throw error;
  }
  return { record, position, alreadyJoined: false };
}

export class MemoryHarthmerePlayerInviteStore implements HarthmerePlayerInviteStore {
  private invites = new Map<string, HarthmerePlayerInviteRecord>();
  private active = new Map<string, string>();
  private claims = new Set<string>();

  async getInvite(code: string) {
    return this.invites.get(code);
  }

  async setInvite(record: HarthmerePlayerInviteRecord) {
    this.invites.set(record.code, record);
  }

  async deleteInvite(code: string) {
    this.invites.delete(code);
  }

  async getActiveCode(titleId: string, inviterPlayerId: string) {
    return this.active.get(`${titleId}:${inviterPlayerId}`);
  }

  async setActiveCode(titleId: string, inviterPlayerId: string, code: string) {
    this.active.set(`${titleId}:${inviterPlayerId}`, code);
  }

  async tryClaim(code: string, playerId: string) {
    const key = `${code}:${playerId}`;
    if (this.claims.has(key)) {
      return false;
    }
    this.claims.add(key);
    return true;
  }

  async releaseClaim(code: string, playerId: string) {
    this.claims.delete(`${code}:${playerId}`);
  }
}
