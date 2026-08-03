import {
  parsePlayerVoiceSignalPayload,
  playerVoiceIceServersFromConfig,
  playerVoiceIceTransportPolicyFromConfig,
  playerVoiceProximityVolume,
  shouldInitiatePlayerVoiceOffer,
  shouldMaintainPlayerVoicePeer,
} from "@/client/game/voice/player_voice_chat";
import assert from "assert";

describe("player voice chat", () => {
  it("attenuates nearby voices and mutes them outside the audible radius", () => {
    assert.equal(playerVoiceProximityVolume(0, 0.8), 0.8);
    assert.equal(playerVoiceProximityVolume(8, 0.8), 0.8);
    assert.ok(playerVoiceProximityVolume(14, 0.8) > 0.69);
    assert.ok(playerVoiceProximityVolume(20, 0.8) > 0.56);
    assert.ok(playerVoiceProximityVolume(24, 0.8) > 0.46);
    assert.equal(playerVoiceProximityVolume(32, 0.8), 0);
    assert.equal(playerVoiceProximityVolume(50, 0.8), 0);
  });

  it("uses a deterministic offerer to avoid WebRTC glare", () => {
    assert.equal(shouldInitiatePlayerVoiceOffer("100", "200"), true);
    assert.equal(shouldInitiatePlayerVoiceOffer("200", "100"), false);
  });

  it("keeps only peers inside the disconnect radius", () => {
    assert.equal(shouldMaintainPlayerVoicePeer(43.9), true);
    assert.equal(shouldMaintainPlayerVoicePeer(44), true);
    assert.equal(shouldMaintainPlayerVoicePeer(44.1), false);
    assert.equal(
      shouldMaintainPlayerVoicePeer(Number.POSITIVE_INFINITY),
      false
    );
  });

  it("validates targeted signaling payloads", () => {
    assert.deepEqual(
      parsePlayerVoiceSignalPayload(
        JSON.stringify({
          version: 1,
          from: "100",
          to: "200",
          kind: "hello",
        })
      ),
      { version: 1, from: "100", to: "200", kind: "hello" }
    );
    assert.equal(parsePlayerVoiceSignalPayload("not-json"), undefined);
    assert.equal(
      parsePlayerVoiceSignalPayload(
        JSON.stringify({ version: 2, from: "100" })
      ),
      undefined
    );
  });

  it("reads only valid ICE servers from room connection config", () => {
    assert.deepEqual(
      playerVoiceIceServersFromConfig({
        iceServers: [
          { urls: "stun:example.test" },
          {
            urls: ["turn:one.test", "turn:two.test"],
            username: "user",
            credential: "credential",
          },
          { urls: [] },
        ],
      }),
      [
        { urls: "stun:example.test" },
        {
          urls: ["turn:one.test", "turn:two.test"],
          username: "user",
          credential: "credential",
        },
      ]
    );
    assert.equal(
      playerVoiceIceTransportPolicyFromConfig({
        iceTransportPolicy: "relay",
      }),
      "relay"
    );
    assert.equal(playerVoiceIceTransportPolicyFromConfig({}), "all");
  });
});
