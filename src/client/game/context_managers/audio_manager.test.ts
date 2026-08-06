import {
  AudioManager,
  MOBILE_BACKGROUND_MUSIC_PATHS,
  backgroundMusicTracksForDevice,
  isBackgroundMusicAutoplayBlocked,
  resolvePathSpatialAudioOptions,
  shouldPrefetchAllAudioAssets,
} from "@/client/game/context_managers/audio_manager";
import type { ClientResources } from "@/client/game/resources/types";
import assert from "assert";

describe("AudioManager generated positional paths", () => {
  // HARTHMERE_BACKGROUND_MUSIC_RESIDENCY (2026-08-04 asset loading audit):
  // this assertion used to require desktop to preload all ten tracks. That was
  // ~24 MB of boot fetches and, because each track was decoded to PCM and left
  // playing at gain 0, hundreds of MB resident for the whole session. Both
  // platforms now load only what they are playing.
  it("loads only the requested background track on every device", () => {
    assert.deepEqual(backgroundMusicTracksForDevice(true, "harthmere_music"), [
      "harthmere_music",
    ]);
    assert.deepEqual(backgroundMusicTracksForDevice(false, "harthmere_music"), [
      "harthmere_music",
    ]);
    assert.equal(shouldPrefetchAllAudioAssets(true), false);
    assert.equal(shouldPrefetchAllAudioAssets(false), true);
  });

  it("routes only mobile background music to AAC-LC M4A assets", () => {
    const mobile = new AudioManager({} as ClientResources, true) as any;
    const desktop = new AudioManager({} as ClientResources, false) as any;
    for (const [trackType, path] of Object.entries(
      MOBILE_BACKGROUND_MUSIC_PATHS
    )) {
      assert.match(path, /\/mobile\/.*\.m4a$/);
      assert.equal(mobile.backgroundTrackPaths[trackType], path);
      assert.notEqual(desktop.backgroundTrackPaths[trackType], path);
    }
  });

  it("recognizes iOS autoplay blocking without masking other failures", () => {
    assert.equal(
      isBackgroundMusicAutoplayBlocked({ name: "NotAllowedError" }),
      true
    );
    assert.equal(
      isBackgroundMusicAutoplayBlocked({ name: "NotSupportedError" }),
      false
    );
    assert.equal(isBackgroundMusicAutoplayBlocked(new Error("network")), false);
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

  it("coalesces startup and on-demand loads for the same track", async () => {
    const manager = new AudioManager({} as ClientResources) as any;
    manager.audioListener = {};
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    manager.createBackgroundMusicTrack = async () => {
      calls += 1;
      await gate;
      return undefined;
    };

    const startup = manager.loadBackgroundMusicTrack("music");
    const selection = manager.loadBackgroundMusicTrack("music");
    assert.strictEqual(startup, selection);
    assert.equal(calls, 1);
    release();
    await Promise.all([startup, selection]);
  });

  it("disposes a load that completes after teardown", async () => {
    const manager = new AudioManager({} as ClientResources) as any;
    manager.audioListener = {};
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const track = { path: "/music.mp3", audio: {} };
    let disposed = 0;
    manager.createBackgroundMusicTrack = async () => {
      await gate;
      return track;
    };
    manager.disposeBackgroundMusicTrack = (value: unknown) => {
      assert.strictEqual(value, track);
      disposed += 1;
    };

    const load = manager.loadBackgroundMusicTrack("music");
    manager.cancelPendingBackgroundMusicLoads();
    release();
    await load;

    assert.equal(disposed, 1);
    assert.equal(manager.audioTracks.size, 0);
  });

  it("routes normal stop teardown through the streaming-aware disposer", () => {
    const manager = new AudioManager({} as ClientResources) as any;
    const track = { path: "/music.mp3", audio: {} };
    let disposed = 0;
    manager.audioTracks.set("music", track);
    manager.currentTrack = track;
    manager.currentTrackType = "music";
    manager.disposeBackgroundMusicTrack = (value: unknown) => {
      assert.strictEqual(value, track);
      disposed += 1;
    };

    manager.stop();

    assert.equal(disposed, 1);
    assert.equal(manager.audioTracks.size, 0);
    assert.equal(manager.currentTrack, undefined);
  });

  it("fully releases decoded mobile music instead of retaining stale PCM in resources", () => {
    let stopped = 0;
    let disconnected = 0;
    let sourceDisconnected = 0;
    let gainDisconnected = 0;
    let invalidated = 0;
    const source = {
      buffer: {} as AudioBuffer,
      disconnect: () => {
        sourceDisconnected += 1;
      },
    };
    const audio = {
      isPlaying: true,
      buffer: {} as AudioBuffer,
      source,
      stop: () => {
        stopped += 1;
      },
      disconnect: () => {
        disconnected += 1;
      },
      gain: {
        disconnect: () => {
          gainDisconnected += 1;
        },
      },
    };
    const manager = new AudioManager({
      invalidate: () => {
        invalidated += 1;
      },
    } as unknown as ClientResources) as any;

    manager.disposeBackgroundMusicTrack({ path: "/music.webm", audio });

    assert.equal(stopped, 1);
    assert.equal(disconnected, 1);
    assert.equal(sourceDisconnected, 1);
    assert.equal(gainDisconnected, 1);
    assert.equal(audio.buffer, null);
    assert.equal(audio.source, null);
    assert.equal(source.buffer, null);
    assert.equal(
      invalidated,
      0,
      "decoded long-form music must bypass the shared resource cache entirely"
    );
  });

  it("releases completed mobile SFX buffers while retaining the desktop hot cache", () => {
    const invalidated: unknown[][] = [];
    const resources = {
      invalidate: (...args: unknown[]) => invalidated.push(args),
    } as unknown as ClientResources;
    const mobile = new AudioManager(resources, true) as any;
    const desktop = new AudioManager(resources, false) as any;

    mobile.releaseDecodedAudioBuffer("/assets/harthmere/audio/sfx/hit.webm");
    desktop.releaseDecodedAudioBuffer("/assets/harthmere/audio/sfx/hit.webm");

    assert.deepEqual(invalidated, [
      ["/audio/buffer", "/assets/harthmere/audio/sfx/hit.webm"],
    ]);
  });
});
