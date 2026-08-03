import {
  AudioManager,
  backgroundMusicTracksForDevice,
  resolvePathSpatialAudioOptions,
  shouldPrefetchAllAudioAssets,
} from "@/client/game/context_managers/audio_manager";
import type { ClientResources } from "@/client/game/resources/types";
import assert from "assert";

describe("AudioManager generated positional paths", () => {
  it("keeps phone audio lazy while desktop retains its preload behavior", () => {
    assert.deepEqual(backgroundMusicTracksForDevice(true, "harthmere_music"), [
      "harthmere_music",
    ]);
    assert.equal(
      backgroundMusicTracksForDevice(false, "harthmere_music").length,
      10
    );
    assert.equal(shouldPrefetchAllAudioAssets(true), false);
    assert.equal(shouldPrefetchAllAudioAssets(false), true);
  });

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

  it("remembers the requested background track before Web Audio is ready", () => {
    const manager = new AudioManager({} as ClientResources);

    manager.setBackgroundMusicTrack("harthmere_music");

    assert.equal(
      manager.getBackgroundMusicDiagnostics().requestedTrack,
      "harthmere_music"
    );
    assert.equal(
      manager.getBackgroundMusicDiagnostics().currentTrack,
      undefined
    );
  });

  it("tracks and clears an owning background-music override", () => {
    const manager = new AudioManager({} as ClientResources);

    manager.setBackgroundMusicOverride(
      "business_shift",
      "business_minigame_music"
    );
    assert.equal(
      manager.getBackgroundMusicOverride(),
      "business_minigame_music"
    );
    assert.equal(
      manager.getBackgroundMusicDiagnostics().overrideTrack,
      "business_minigame_music"
    );

    manager.setBackgroundMusicOverride("business_shift", undefined);
    assert.equal(manager.getBackgroundMusicOverride(), undefined);
  });
});
