export const HARTHMERE_PLAYER_VOICE_MAX_PARTICIPANTS = 32;

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

export type HarthmereVoiceTokenResponseClassification =
  | { kind: "active"; response: HarthmereVoiceTokenResponse }
  | { kind: "inactive"; state: string | undefined }
  | { kind: "invalid" };

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
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
      const participantCount = Number(room.participant_count ?? 0);
      const maxParticipants = Number(
        room.max_participants ?? HARTHMERE_PLAYER_VOICE_MAX_PARTICIPANTS
      );
      return (
        room.state === "active" &&
        room.topology === "proximity" &&
        room.provider === "glitch_relay" &&
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

export function makeHarthmereVoiceRoomCreateBody(input: { playerId: string }) {
  return {
    player_id: input.playerId,
    provider: "glitch_relay" as const,
    topology: "proximity" as const,
    codec: "opus" as const,
    sample_rate: 48_000,
    bitrate: 32_000,
    frame_duration_ms: 20 as const,
    channels: 1 as const,
    max_participants: HARTHMERE_PLAYER_VOICE_MAX_PARTICIPANTS,
    ttl_minutes: 60,
  };
}

export function classifyHarthmereVoiceTokenResponse(
  raw: unknown
): HarthmereVoiceTokenResponseClassification {
  const record = asRecord(raw);
  const candidate = asRecord(record?.data) ?? record;
  // Glitch create returns `voice_room`; join returns `room`. Canonicalize both
  // documented response shapes before the game adapter exposes one shape.
  const voiceRoom =
    asRecord(candidate?.voice_room) ?? asRecord(candidate?.room);
  const participant = asRecord(candidate?.participant);
  if (
    !candidate ||
    typeof candidate.voice_token !== "string" ||
    !voiceRoom ||
    typeof voiceRoom.id !== "string" ||
    !participant
  ) {
    return { kind: "invalid" };
  }
  if (voiceRoom.state !== "active") {
    return {
      kind: "inactive",
      state: typeof voiceRoom.state === "string" ? voiceRoom.state : undefined,
    };
  }
  return {
    kind: "active",
    response: {
      voice_room: voiceRoom as HarthmereGlitchVoiceRoom,
      participant,
      voice_token: candidate.voice_token,
    },
  };
}

export function normalizeHarthmereVoiceTokenResponse(
  raw: unknown
): HarthmereVoiceTokenResponse | undefined {
  const classified = classifyHarthmereVoiceTokenResponse(raw);
  return classified.kind === "active" ? classified.response : undefined;
}
