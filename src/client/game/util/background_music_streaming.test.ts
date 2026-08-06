/// <reference types="mocha" />
import {
  audioAssetPathsToPrefetch,
  backgroundMusicTracksToEvict,
  backgroundMusicTracksForDevice,
  maxResidentBackgroundMusicTracks,
} from "@/client/game/context_managers/audio_manager";
import {
  backgroundMusicStreamingSupported,
  createStreamingMusicElement,
  releaseStreamingMusicElement,
  shouldStreamBackgroundMusic,
  startStreamingMusicElement,
  type BackgroundMusicMediaElement,
} from "@/client/game/util/background_music_streaming";
import { audioAssets } from "@/galois/assets/audio";
import assert from "assert";

// HARTHMERE_BACKGROUND_MUSIC_STREAMING / _RESIDENCY (2026-08-04 asset audit)
//
// The memory arithmetic these tests defend: an 8 MB compressed music bed is
// ~190 MB of Float32 PCM once `decodeAudioData` is done with it, and desktop
// used to hold ten of them for the whole session.

class FakeAudioElement implements BackgroundMusicMediaElement {
  src = "";
  loop = false;
  preload = "none";
  crossOrigin: string | null = null;
  autoplay = true;
  volume = 0.5;
  playCalls = 0;
  pauseCalls = 0;
  loadCalls = 0;
  removedAttributes: string[] = [];
  playRejection: Error | undefined;

  async play() {
    this.playCalls += 1;
    if (this.playRejection) {
      throw this.playRejection;
    }
  }
  pause() {
    this.pauseCalls += 1;
  }
  load() {
    this.loadCalls += 1;
  }
  removeAttribute(name: string) {
    this.removedAttributes.push(name);
  }
}

function envWith(created: FakeAudioElement[]) {
  return {
    audioElementCtor: class {
      constructor() {
        const element = new FakeAudioElement();
        created.push(element);
        return element as unknown as FakeAudioElement;
      }
    } as unknown as new () => BackgroundMusicMediaElement,
    mediaElementSourceSupported: true,
  };
}

describe("background music streaming policy", () => {
  it("streams on desktop when the runtime supports it", () => {
    assert.equal(shouldStreamBackgroundMusic(false, envWith([])), true);
  });

  it("streams on mobile when the runtime supports it", () => {
    assert.equal(shouldStreamBackgroundMusic(true, envWith([])), true);
  });

  it("does not stream without MediaElementAudioSourceNode", () => {
    assert.equal(
      shouldStreamBackgroundMusic(false, {
        audioElementCtor: envWith([]).audioElementCtor,
        mediaElementSourceSupported: false,
      }),
      false
    );
  });

  it("does not stream without an <audio> constructor (SSR/worker)", () => {
    assert.equal(
      backgroundMusicStreamingSupported({ mediaElementSourceSupported: true }),
      false
    );
    assert.equal(
      shouldStreamBackgroundMusic(false, { mediaElementSourceSupported: true }),
      false
    );
  });
});

describe("streaming music elements", () => {
  it("configures a looping, buffering, silent-by-gain element", () => {
    const created: FakeAudioElement[] = [];
    const element = createStreamingMusicElement(
      "/assets/harthmere/audio/loop.mp3",
      envWith(created)
    ) as FakeAudioElement;

    assert.equal(element.src, "/assets/harthmere/audio/loop.mp3");
    assert.equal(element.loop, true, "music must loop seamlessly");
    assert.equal(element.preload, "auto", "buffer ahead so crossfades survive");
    assert.equal(element.autoplay, false, "playback is started explicitly");
    assert.equal(
      element.volume,
      1,
      "loudness is owned by the WebAudio gain node, not the element"
    );
    assert.equal(
      element.crossOrigin,
      "anonymous",
      "cross-origin media must opt into CORS before entering WebAudio"
    );
  });

  it("resolves when playback starts", async () => {
    const element = new FakeAudioElement();
    await startStreamingMusicElement(element);
    assert.equal(element.playCalls, 1);
  });

  it("propagates playback rejection so the manager can use its buffer fallback", async () => {
    const element = new FakeAudioElement();
    element.playRejection = new Error("NotAllowedError");
    await assert.rejects(
      () => startStreamingMusicElement(element),
      /NotAllowedError/
    );
  });

  it("releases buffered media so the memory actually comes back", () => {
    const element = new FakeAudioElement();
    releaseStreamingMusicElement(element);
    assert.equal(element.pauseCalls, 1);
    assert.equal(element.src, "");
    assert.equal(element.loadCalls, 1, "load() is what frees the buffer");
    assert.deepEqual(element.removedAttributes, ["src"]);
  });

  it("tolerates an element that throws during teardown", () => {
    const hostile = {
      ...new FakeAudioElement(),
      pause() {
        throw new Error("detached");
      },
      load() {
        throw new Error("detached");
      },
    } as unknown as BackgroundMusicMediaElement;
    assert.doesNotThrow(() => releaseStreamingMusicElement(hostile));
  });
});

describe("background music residency", () => {
  it("keeps the outgoing and incoming track on desktop so crossfades work", () => {
    assert.equal(maxResidentBackgroundMusicTracks(false), 2);
  });

  it("keeps exactly one resident track on mobile", () => {
    assert.equal(maxResidentBackgroundMusicTracks(true), 1);
  });

  it("boots with a single track on both platforms", () => {
    assert.equal(backgroundMusicTracksForDevice(false, "music").length, 1);
    assert.equal(backgroundMusicTracksForDevice(true, "music").length, 1);
  });

  it("evicts the oldest outgoing track as soon as a third track is loaded", () => {
    assert.deepEqual(
      backgroundMusicTracksToEvict(
        ["music", "grove_music", "boss_battle_music"],
        new Set(["grove_music", "boss_battle_music"]),
        2
      ),
      ["music"]
    );
  });

  it("never evicts a protected current or requested track", () => {
    assert.deepEqual(
      backgroundMusicTracksToEvict(
        ["music", "grove_music", "boss_battle_music"],
        new Set(["music", "boss_battle_music"]),
        2
      ),
      ["grove_music"]
    );
  });
});

describe("boot audio prefetch scope", () => {
  const prefetched = audioAssetPathsToPrefetch();

  it("excludes the multi-megabyte music beds", () => {
    for (const path of [
      ...audioAssets.music,
      ...audioAssets.grove_music,
      ...audioAssets.muck_music,
      ...audioAssets.cave_music,
    ]) {
      assert.ok(
        !prefetched.includes(path as never),
        `${path} is a music bed and must not be prefetched at boot`
      );
    }
  });

  it("still prefetches the short SFX whose first play is audible", () => {
    for (const path of [
      ...audioAssets.footstep_grass,
      ...audioAssets.swing,
      ...audioAssets.block_break,
      ...audioAssets.button_click,
    ]) {
      assert.ok(
        prefetched.includes(path as never),
        `${path} is a short one-shot and should stay warm`
      );
    }
  });

  it("still prefetches small ambience loops", () => {
    // mountain-wind-loop is 0.37 MB -- an environment loop, not a music bed.
    assert.ok(prefetched.includes(audioAssets.mountain_wind[0] as never));
  });

  it("drops a large majority of the old prefetch payload", () => {
    const all = Object.values(audioAssets).flat();
    assert.ok(prefetched.length < all.length);
    assert.ok(
      prefetched.length > all.length - 10,
      "only the long-form families should be excluded"
    );
  });
});
