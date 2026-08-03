import { resolvePathSpatialAudioOptions } from "@/client/game/context_managers/audio_manager";
import assert from "assert";

describe("AudioManager generated positional paths", () => {
  it("preserves the ordinary generated-effect defaults", () => {
    assert.deepEqual(resolvePathSpatialAudioOptions(0.2), {
      volume: 0.2,
      refDistance: 2,
      maxDistance: 64,
      rolloffFactor: 1,
    });
  });

  it("applies the giant boss arena profile without an inaudible 2m reference", () => {
    assert.deepEqual(
      resolvePathSpatialAudioOptions(0.2, {
        volumeMultiplier: 4,
        refDistance: 9.24,
        maxDistance: 96,
        rolloffFactor: 0.85,
      }),
      {
        volume: 0.8,
        refDistance: 9.24,
        maxDistance: 96,
        rolloffFactor: 0.85,
      }
    );
  });

  it("sanitizes invalid options and never places max distance inside ref distance", () => {
    assert.deepEqual(
      resolvePathSpatialAudioOptions(0.2, {
        volumeMultiplier: Number.NaN,
        refDistance: 12,
        maxDistance: 4,
        rolloffFactor: -1,
      }),
      {
        volume: 0.2,
        refDistance: 12,
        maxDistance: 12,
        rolloffFactor: 1,
      }
    );
  });
});
