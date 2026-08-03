export const HARTHMERE_PLAYER_VOICE_CHANNEL_KEY = "biomes-world";
export const HARTHMERE_PLAYER_VOICE_MAX_PARTICIPANTS = 32;
export const HARTHMERE_PLAYER_VOICE_AUDIBLE_RADIUS = 32;

export type HarthmereVoiceIceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

export type HarthmereGlitchVoiceRoom = {
  id: string;
  state?: string;
  topology?: string;
  provider?: string;
  participant_count?: number;
  max_participants?: number;
  metadata?: Record<string, unknown>;
  created_at?: string | null;
};

export type HarthmereVoiceTokenResponse = {
  voice_room: HarthmereGlitchVoiceRoom;
  participant: Record<string, unknown>;
  voice_token: string;
};

const DEFAULT_VOICE_ICE_SERVERS: HarthmereVoiceIceServer[] = [
  { urls: "stun:stun.cloudflare.com:3478" },
  { urls: "stun:stun.l.google.com:19302" },
];

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function validIceServer(value: unknown): HarthmereVoiceIceServer | undefined {
  const record = asRecord(value);
  const urls = record?.urls;
  const validUrls =
    typeof urls === "string"
      ? urls.trim().length > 0
      : Array.isArray(urls) &&
        urls.length > 0 &&
        urls.every((url) => typeof url === "string" && url.trim().length > 0);
  if (!record || !validUrls) {
    return undefined;
  }
  return {
    urls: urls as string | string[],
    ...(typeof record.username === "string"
      ? { username: record.username }
      : {}),
    ...(typeof record.credential === "string"
      ? { credential: record.credential }
      : {}),
  };
}

export function parseHarthmereVoiceIceServers(
  raw: string | undefined
): HarthmereVoiceIceServer[] {
  if (!raw?.trim()) {
    return DEFAULT_VOICE_ICE_SERVERS;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return DEFAULT_VOICE_ICE_SERVERS;
    }
    const servers = parsed
      .map(validIceServer)
      .filter((server): server is HarthmereVoiceIceServer => Boolean(server));
    return servers.length > 0 ? servers : DEFAULT_VOICE_ICE_SERVERS;
  } catch {
    return DEFAULT_VOICE_ICE_SERVERS;
  }
}

export function harthmereVoiceRoomsFromResponse(
  raw: unknown
): HarthmereGlitchVoiceRoom[] {
  if (Array.isArray(raw)) {
    return raw.filter((room): room is HarthmereGlitchVoiceRoom =>
      Boolean(asRecord(room) && typeof room.id === "string")
    );
  }
  const record = asRecord(raw);
  return Array.isArray(record?.data)
    ? harthmereVoiceRoomsFromResponse(record.data)
    : [];
}

export function selectHarthmereVoiceRoomCandidates(
  rooms: HarthmereGlitchVoiceRoom[]
) {
  return rooms
    .filter((room) => {
      const metadata = asRecord(room.metadata);
      const participantCount = Number(room.participant_count ?? 0);
      const maxParticipants = Number(
        room.max_participants ?? HARTHMERE_PLAYER_VOICE_MAX_PARTICIPANTS
      );
      return (
        room.state === "active" &&
        room.topology === "proximity" &&
        room.provider === "glitch_relay" &&
        metadata?.channel_key === HARTHMERE_PLAYER_VOICE_CHANNEL_KEY &&
        Number.isFinite(participantCount) &&
        Number.isFinite(maxParticipants) &&
        participantCount < maxParticipants
      );
    })
    .sort((left, right) => {
      const byCreated = String(left.created_at ?? "").localeCompare(
        String(right.created_at ?? "")
      );
      return byCreated || left.id.localeCompare(right.id);
    });
}

export function makeHarthmereVoiceRoomCreateBody(input: {
  playerId: string;
  displayName: string;
  iceServers?: HarthmereVoiceIceServer[];
}) {
  return {
    player_id: input.playerId,
    display_name: input.displayName,
    provider: "glitch_relay" as const,
    topology: "proximity" as const,
    state: "active" as const,
    codec: "opus" as const,
    sample_rate: 48_000,
    bitrate: 32_000,
    frame_duration_ms: 20 as const,
    channels: 1 as const,
    max_participants: HARTHMERE_PLAYER_VOICE_MAX_PARTICIPANTS,
    recording_allowed: false,
    moderation_enabled: true,
    connection_config:
      input.iceServers && input.iceServers.length > 0
        ? { iceServers: input.iceServers }
        : {},
    metadata: {
      channel_key: HARTHMERE_PLAYER_VOICE_CHANNEL_KEY,
      transport: "webrtc",
      proximity_radius: HARTHMERE_PLAYER_VOICE_AUDIBLE_RADIUS,
    },
    ttl_minutes: 60,
  };
}

export function normalizeHarthmereVoiceTokenResponse(
  raw: unknown
): HarthmereVoiceTokenResponse | undefined {
  const record = asRecord(raw);
  const candidate = asRecord(record?.data) ?? record;
  const voiceRoom = asRecord(candidate?.voice_room);
  const participant = asRecord(candidate?.participant);
  if (
    !candidate ||
    typeof candidate.voice_token !== "string" ||
    !voiceRoom ||
    typeof voiceRoom.id !== "string" ||
    !participant
  ) {
    return undefined;
  }
  return {
    voice_room: voiceRoom as HarthmereGlitchVoiceRoom,
    participant,
    voice_token: candidate.voice_token,
  };
}
