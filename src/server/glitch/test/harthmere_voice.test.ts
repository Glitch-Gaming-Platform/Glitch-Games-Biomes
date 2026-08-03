import {
  HARTHMERE_PLAYER_VOICE_CHANNEL_KEY,
  HARTHMERE_PLAYER_VOICE_AUDIBLE_RADIUS,
  makeHarthmereVoiceRoomCreateBody,
  normalizeHarthmereVoiceTokenResponse,
  parseHarthmereVoiceIceServers,
  selectHarthmereVoiceRoomCandidates,
} from "@/server/glitch/harthmere_voice";
import assert from "assert";

describe("Harthmere Glitch player voice", () => {
  it("creates an opt-in proximity Opus room without recording", () => {
    const body = makeHarthmereVoiceRoomCreateBody({
      playerId: "1234",
      displayName: "Cinder",
      iceServers: [{ urls: "stun:example.test:3478" }],
    });

    assert.equal(body.player_id, "1234");
    assert.equal(body.provider, "glitch_relay");
    assert.equal(body.topology, "proximity");
    assert.equal(body.codec, "opus");
    assert.equal(body.sample_rate, 48_000);
    assert.equal(body.channels, 1);
    assert.equal(body.recording_allowed, false);
    assert.equal(body.moderation_enabled, true);
    assert.equal(body.metadata.channel_key, HARTHMERE_PLAYER_VOICE_CHANNEL_KEY);
    assert.equal(
      body.metadata.proximity_radius,
      HARTHMERE_PLAYER_VOICE_AUDIBLE_RADIUS
    );
    assert.deepEqual(body.connection_config.iceServers, [
      { urls: "stun:example.test:3478" },
    ]);
  });

  it("lets Glitch inject platform TURN servers when no title override exists", () => {
    const body = makeHarthmereVoiceRoomCreateBody({
      playerId: "1234",
      displayName: "Cinder",
    });

    assert.deepEqual(body.connection_config, {});
  });

  it("selects only active non-full Biomes proximity rooms", () => {
    const rooms = selectHarthmereVoiceRoomCandidates([
      {
        id: "full",
        state: "active",
        topology: "proximity",
        provider: "glitch_relay",
        participant_count: 32,
        max_participants: 32,
        metadata: { channel_key: HARTHMERE_PLAYER_VOICE_CHANNEL_KEY },
      },
      {
        id: "other-game",
        state: "active",
        topology: "proximity",
        provider: "glitch_relay",
        participant_count: 1,
        max_participants: 32,
        metadata: { channel_key: "another-game" },
      },
      {
        id: "later",
        state: "active",
        topology: "proximity",
        provider: "glitch_relay",
        participant_count: 2,
        max_participants: 32,
        metadata: { channel_key: HARTHMERE_PLAYER_VOICE_CHANNEL_KEY },
        created_at: "2026-08-02T10:00:00Z",
      },
      {
        id: "earlier",
        state: "active",
        topology: "proximity",
        provider: "glitch_relay",
        participant_count: 3,
        max_participants: 32,
        metadata: { channel_key: HARTHMERE_PLAYER_VOICE_CHANNEL_KEY },
        created_at: "2026-08-02T09:00:00Z",
      },
    ]);

    assert.deepEqual(
      rooms.map((room) => room.id),
      ["earlier", "later"]
    );
  });

  it("normalizes SDK-style data envelopes and rejects missing tokens", () => {
    assert.deepEqual(
      normalizeHarthmereVoiceTokenResponse({
        data: {
          voice_room: { id: "room" },
          participant: { id: "participant" },
          voice_token: "voice-token",
        },
      }),
      {
        voice_room: { id: "room" },
        participant: { id: "participant" },
        voice_token: "voice-token",
      }
    );
    assert.equal(
      normalizeHarthmereVoiceTokenResponse({
        voice_room: { id: "room" },
        participant: { id: "participant" },
      }),
      undefined
    );
  });

  it("accepts configured ICE servers and safely falls back on bad JSON", () => {
    assert.deepEqual(
      parseHarthmereVoiceIceServers(
        JSON.stringify([
          {
            urls: ["stun:one.example", "turn:two.example"],
            username: "user",
            credential: "credential",
          },
        ])
      ),
      [
        {
          urls: ["stun:one.example", "turn:two.example"],
          username: "user",
          credential: "credential",
        },
      ]
    );
    assert.ok(parseHarthmereVoiceIceServers("not-json").length > 0);
  });
});
