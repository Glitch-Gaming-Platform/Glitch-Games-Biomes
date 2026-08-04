import {
  classifyHarthmereVoiceTokenResponse,
  makeHarthmereVoiceRoomCreateBody,
  normalizeHarthmereVoiceTokenResponse,
  selectHarthmereVoiceRoomCandidates,
} from "@/server/glitch/harthmere_voice";
import assert from "assert";

describe("Harthmere Glitch player voice", () => {
  it("creates a proximity Opus room with only documented fields", () => {
    const body = makeHarthmereVoiceRoomCreateBody({
      playerId: "1234",
    });

    assert.equal(body.player_id, "1234");
    assert.equal(body.provider, "glitch_relay");
    assert.equal(body.topology, "proximity");
    assert.equal(body.codec, "opus");
    assert.equal(body.sample_rate, 48_000);
    assert.equal(body.channels, 1);
    assert.deepEqual(Object.keys(body).sort(), [
      "bitrate",
      "channels",
      "codec",
      "frame_duration_ms",
      "max_participants",
      "player_id",
      "provider",
      "sample_rate",
      "topology",
      "ttl_minutes",
    ]);
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
      },
      {
        id: "other-game",
        state: "active",
        topology: "party",
        provider: "glitch_relay",
        participant_count: 1,
        max_participants: 32,
      },
      {
        id: "later",
        state: "active",
        topology: "proximity",
        provider: "glitch_relay",
        participant_count: 2,
        max_participants: 32,
        created_at: "2026-08-02T10:00:00Z",
      },
      {
        id: "earlier",
        state: "active",
        topology: "proximity",
        provider: "glitch_relay",
        participant_count: 3,
        max_participants: 32,
        created_at: "2026-08-02T09:00:00Z",
      },
    ]);

    assert.deepEqual(
      rooms.map((room) => room.id),
      ["earlier", "later"]
    );
  });

  it("normalizes documented create and join response shapes", () => {
    assert.deepEqual(
      normalizeHarthmereVoiceTokenResponse({
        data: {
          voice_room: { id: "room", state: "active" },
          participant: { id: "participant" },
          voice_token: "voice-token",
        },
      }),
      {
        voice_room: { id: "room", state: "active" },
        participant: { id: "participant" },
        voice_token: "voice-token",
      }
    );
    assert.deepEqual(
      normalizeHarthmereVoiceTokenResponse({
        room: { id: "joined-room", state: "active" },
        participant: { id: "participant" },
        voice_token: "joined-token",
      }),
      {
        voice_room: { id: "joined-room", state: "active" },
        participant: { id: "participant" },
        voice_token: "joined-token",
      }
    );
  });

  it("rejects closed rooms before signaling can start", () => {
    assert.deepEqual(
      classifyHarthmereVoiceTokenResponse({
        voice_room: { id: "closed-room", state: "closed" },
        participant: { id: "participant" },
        voice_token: "stale-token",
      }),
      { kind: "inactive", state: "closed" }
    );
    assert.equal(
      normalizeHarthmereVoiceTokenResponse({
        room: { id: "closed-room", state: "closed" },
        participant: { id: "participant" },
        voice_token: "stale-token",
      }),
      undefined
    );
  });

  it("rejects missing voice tokens", () => {
    assert.equal(
      normalizeHarthmereVoiceTokenResponse({
        voice_room: { id: "room", state: "active" },
        participant: { id: "participant" },
      }),
      undefined
    );
  });
});
