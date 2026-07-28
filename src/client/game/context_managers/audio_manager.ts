import type { ClientContext } from "@/client/game/context";
import {
  CH1_SAND_DUNGEON_MUSIC_PATH,
  CH1_WINTER_DUNGEON_MUSIC_PATH,
  HARTHMERE_BATTLE_MUSIC_PATH,
  HARTHMERE_BOSS_BATTLE_MUSIC_PATH,
  HARTHMERE_EXPLORATION_MUSIC_PATH,
  type AudioPath,
} from "@/client/game/resources/audio";
import type { ClientResources } from "@/client/game/resources/types";
import type { SettingsKey } from "@/client/util/typed_local_storage";
import { getTypedStorageItem } from "@/client/util/typed_local_storage";
import type { AudioAssetType } from "@/galois/assets/audio";
import { audioFiles, getAudioAssetPaths } from "@/galois/assets/audio";
import type { AssetPath } from "@/galois/interface/asset_paths";
import type { RegistryLoader } from "@/shared/registry";
import { fireAndForget } from "@/shared/util/async";
import { MultiMap } from "@/shared/util/collections";
import type { Extends } from "@/shared/util/type_helpers";
import { ok } from "assert";
import { clamp, round, sample } from "lodash";
import * as THREE from "three";

export type VolumeSettingsType = Extends<
  SettingsKey,
  | "settings.volume"
  | "settings.volume.music"
  | "settings.volume.effects"
  | "settings.volume.media"
  | "settings.volume.voice"
>;

export const VOLUME_TYPE_VOLUME_MULTIPLER = new Map<SettingsKey, number>([
  ["settings.volume.music", 0.2],
  ["settings.volume.effects", 0.2],
  ["settings.volume.media", 0.4],
  ["settings.volume.voice", 0.6],
]);

export const ASSET_TYPE_VOLUME_MULTIPLER = new Map<AudioAssetType, number>([
  ["camera_select", 0.1],
  ["footsteps", 6.0],
]);

type BackgroundMusicEffect = "none" | "water";

// JS keeps compaining about non-finite numbers if we set volume...
function fixVolume(volume: number) {
  const rounded = round(volume, 4);
  return isFinite(rounded) ? rounded : 0;
}

export type AudioTrackType =
  | "music"
  | "muck_music"
  | "battle_music"
  | "boss_battle_music"
  | "harthmere_music"
  | "ch1_sand_music"
  | "ch1_winter_music";

export interface BackgroundMusicDiagnostics {
  running: boolean;
  currentTrack: AudioTrackType | undefined;
  loadedTracks: AudioTrackType[];
  transitions: ReadonlyArray<{
    track: AudioTrackType;
    atMs: number;
  }>;
}

export interface AudioRecordingStream {
  stream: MediaStream;
  dispose(): void;
}

export const DEFAULT_BACKGROUND_MUSIC_CROSSFADE_SECONDS = 5;
export const COMBAT_MUSIC_CROSSFADE_SECONDS = 0.75;
const COMBAT_MUSIC_TRACKS: ReadonlySet<AudioTrackType> = new Set([
  "battle_music",
  "boss_battle_music",
]);

export function backgroundMusicCrossfadeSeconds(
  previousTrack: AudioTrackType | undefined,
  nextTrack: AudioTrackType
) {
  return (previousTrack !== undefined &&
    COMBAT_MUSIC_TRACKS.has(previousTrack)) ||
    COMBAT_MUSIC_TRACKS.has(nextTrack)
    ? COMBAT_MUSIC_CROSSFADE_SECONDS
    : DEFAULT_BACKGROUND_MUSIC_CROSSFADE_SECONDS;
}

interface AudioTrack {
  audio: THREE.Audio;
}

export class AudioManager {
  private audioListener: THREE.AudioListener | undefined;

  private audioTracks: Map<AudioTrackType, AudioTrack> = new Map();
  private currentTrack: AudioTrack | undefined;
  private currentTrackType: AudioTrackType | undefined;
  private backgroundMusicTransitions: Array<{
    track: AudioTrackType;
    atMs: number;
  }> = [];

  private backgroundMusicAttenuation = 0;
  private prefetched = false;
  private muted = false;

  private activeRegistry: Map<THREE.PositionalAudio, number> = new Map();
  private activeAssets: MultiMap<AudioAssetType, THREE.Audio> = new MultiMap();

  constructor(private resources: ClientResources) {}

  stop() {
    for (const [audio] of this.activeRegistry.entries()) {
      audio.stop();
      this.activeRegistry.delete(audio);
    }
    for (const track of this.audioTracks.values()) {
      if (track.audio.isPlaying) {
        track.audio.stop();
      }
      track.audio.disconnect();
    }
    this.audioTracks.clear();
    this.currentTrack = undefined;
    this.currentTrackType = undefined;
    this.backgroundMusicTransitions = [];
  }

  hotHandoff(old: AudioManager) {
    this.activeRegistry = old.activeRegistry;
    this.activeAssets = old.activeAssets;
    old.stop();
  }

  setActive(audio: THREE.PositionalAudio, time: number) {
    this.activeRegistry.set(audio, time);
  }

  purgeInactive(time: number) {
    const PURGE_TIME = 1;
    for (const [audio, lastActive] of this.activeRegistry.entries()) {
      if (time > lastActive + PURGE_TIME) {
        audio.stop();
        this.activeRegistry.delete(audio);
      }
    }
  }

  prefetchAudioAssets() {
    if (!this.prefetched) {
      prefetchAudioAssets(this.resources);
      this.prefetched = true;
    }
  }

  getAudioListener() {
    return this.audioListener;
  }

  /** Mirror the listener's final mix into MediaRecorder without muting play. */
  createRecordingStream(): AudioRecordingStream | undefined {
    if (!this.audioListener) {
      return undefined;
    }
    const destination =
      this.audioListener.context.createMediaStreamDestination();
    this.audioListener.gain.connect(destination);
    return {
      stream: destination.stream,
      dispose: () => {
        try {
          this.audioListener?.gain.disconnect(destination);
        } catch {
          // The audio graph may already be gone during hot reload/teardown.
        }
      },
    };
  }

  isRunning() {
    return this.audioListener && this.audioListener.context.state === "running";
  }

  getBackgroundMusicDiagnostics(): BackgroundMusicDiagnostics {
    return {
      running: Boolean(this.isRunning()),
      currentTrack: this.currentTrackType,
      loadedTracks: [...this.audioTracks.keys()].sort(),
      transitions: [...this.backgroundMusicTransitions],
    };
  }

  async resumeAudio() {
    if (!this.isRunning()) {
      if (!this.audioListener) {
        this.audioListener = new THREE.AudioListener();
        const camera = this.resources.get("/scene/camera");
        camera.three.add(this.audioListener);
        this.resources.set("/audio", {
          listener: this.audioListener,
          manager: this,
        });
      }
      await this.audioListener.context.resume();
      await this.startBackgroundMusic();
      this.prefetchAudioAssets();
    }
  }

  async startBackgroundMusic() {
    if (!this.audioListener || this.currentTrack) {
      return;
    }
    const loadTrack = async (
      audioTrackType: AudioTrackType,
      assetPath: AudioPath
    ) => {
      if (!this.audioListener || this.audioTracks.has(audioTrackType)) {
        return;
      }
      const audio = new THREE.Audio(this.audioListener);
      const buffer = await this.resources.get("/audio/buffer", assetPath);
      if (!buffer) {
        // Should we try to start it later to avoid race conditions?
        return;
      }
      audio.setBuffer(buffer);
      audio.setLoop(true);
      audio.setFilters(this.getBackgroundMusicFilters());
      audio.gain.gain.value = 0;
      audio.play();
      this.audioTracks.set(audioTrackType, { audio });
    };

    await Promise.allSettled([
      loadTrack("music", sample(getAudioAssetPaths("music"))!),
      loadTrack("muck_music", sample(getAudioAssetPaths("muck_music"))!),
      loadTrack("battle_music", HARTHMERE_BATTLE_MUSIC_PATH),
      loadTrack("boss_battle_music", HARTHMERE_BOSS_BATTLE_MUSIC_PATH),
      loadTrack("harthmere_music", HARTHMERE_EXPLORATION_MUSIC_PATH),
      loadTrack("ch1_sand_music", CH1_SAND_DUNGEON_MUSIC_PATH),
      loadTrack("ch1_winter_music", CH1_WINTER_DUNGEON_MUSIC_PATH),
    ]);

    this.setBackgroundMusicTrack("music");
  }

  setBackgroundMusicTrack(trackType: AudioTrackType) {
    if (!this.audioListener) {
      return;
    }
    const context = this.audioListener.context;
    const newTrack = this.audioTracks.get(trackType);
    if (!newTrack || newTrack === this.currentTrack) {
      return;
    }
    const crossfadeSeconds = backgroundMusicCrossfadeSeconds(
      this.currentTrackType,
      trackType
    );
    this.currentTrack = newTrack;
    this.currentTrackType = trackType;
    this.backgroundMusicTransitions.push({
      track: trackType,
      atMs: Date.now(),
    });
    if (this.backgroundMusicTransitions.length > 32) {
      this.backgroundMusicTransitions.splice(
        0,
        this.backgroundMusicTransitions.length - 32
      );
    }

    // Crossfade volume to the current track.
    for (const track of this.audioTracks.values()) {
      if (track !== this.currentTrack) {
        track.audio.gain.gain.cancelScheduledValues(context.currentTime);
        track.audio.gain.gain.setValueAtTime(
          track.audio.gain.gain.value,
          context.currentTime
        );
        track.audio.gain.gain.linearRampToValueAtTime(
          0,
          context.currentTime + crossfadeSeconds
        );
      }
    }
    this.currentTrack?.audio.gain.gain.cancelScheduledValues(
      context.currentTime
    );
    this.currentTrack?.audio.gain.gain.setValueAtTime(
      this.currentTrack.audio.gain.gain.value,
      context.currentTime
    );
    this.currentTrack?.audio.gain.gain.linearRampToValueAtTime(
      this.getVolume("settings.volume.music"),
      context.currentTime + crossfadeSeconds
    );
  }

  setBackgroundMusicAttenuation(value: number) {
    const attenuation = clamp(value, 0, 1);
    if (this.backgroundMusicAttenuation !== attenuation) {
      this.backgroundMusicAttenuation = attenuation;
      this.updateBackgroundMusicVolume();
    }
  }

  updateBackgroundMusicVolume() {
    const volume = this.getVolume("settings.volume.music");
    this.currentTrack?.audio.setVolume(volume);
  }

  private getBackgroundMusicFilters() {
    ok(this.audioListener, "Cannot apply an effect to undefined listener");
    const lowpass = this.audioListener.context.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 0.5 * this.audioListener.context.sampleRate;
    return [lowpass];
  }

  setBackgroundMusicEffect(effect: BackgroundMusicEffect) {
    if (
      !this.audioListener ||
      !this.currentTrack ||
      !this.currentTrack.audio.filters.length
    ) {
      return;
    }

    const context = this.audioListener.context;

    if (effect === "water") {
      const lowpass = this.currentTrack.audio.filters[0] as BiquadFilterNode;
      lowpass.frequency.setTargetAtTime(200, context.currentTime, 0.2);
    } else {
      const lowpass = this.currentTrack.audio.filters[0] as BiquadFilterNode;
      const nyquist = 0.5 * context.sampleRate;
      lowpass.frequency.setTargetAtTime(nyquist, context.currentTime, 0.2);
    }
  }

  getBuffer(assetPath: AudioPath) {
    return this.resources.cached("/audio/buffer", assetPath);
  }

  playSound(
    assetType: AudioAssetType,
    options: {
      idempotent: boolean;
    } = {
      idempotent: false,
    }
  ) {
    if (options.idempotent && this.activeAssets.hasAny(assetType)) {
      return;
    }

    fireAndForget(
      (async () => {
        if (!this.audioListener) {
          return;
        }

        const assetPath = sample(getAudioAssetPaths(assetType))!;
        const volume = this.getVolume("settings.volume.effects", assetType);
        if (volume === 0) {
          return;
        }
        const sound = new THREE.Audio(this.audioListener);
        const buffer = await this.resources.get("/audio/buffer", assetPath);
        if (buffer) {
          this.activeAssets.add(assetType, sound);
          sound.setBuffer(buffer);
          sound.setVolume(volume);
          sound.onEnded = () => {
            sound.disconnect();
            this.activeAssets.delete(assetType, sound);
          };
          sound.play();
        }
      })()
    );
  }

  playSoundAt(assetType: AudioAssetType, position: readonly number[]) {
    fireAndForget(
      (async () => {
        if (!this.audioListener || position.length < 3) {
          return;
        }
        const assetPath = sample(getAudioAssetPaths(assetType));
        if (!assetPath) {
          return;
        }
        const volume = this.getVolume("settings.volume.effects", assetType);
        if (volume === 0) {
          return;
        }
        const buffer = await this.resources.get("/audio/buffer", assetPath);
        if (!buffer) {
          return;
        }
        const sound = new THREE.PositionalAudio(this.audioListener);
        sound.setBuffer(buffer);
        sound.setVolume(volume);
        sound.position.set(position[0], position[1], position[2]);
        sound.setDistanceModel("exponential");
        sound.setRefDistance(2);
        sound.setMaxDistance(64);
        sound.updateMatrixWorld(true);
        sound.onEnded = () => sound.disconnect();
        sound.play();
      })()
    );
  }

  muteAll() {
    this.muted = true;
    this.currentTrack?.audio.setVolume(0);
  }

  getVolume(type: VolumeSettingsType, assetType?: AudioAssetType) {
    if (this.muted) {
      return 0;
    }
    const volume = (getTypedStorageItem(type) ?? 0) / 100;
    const generalMultipler =
      (getTypedStorageItem("settings.volume") ?? 0) / 100;
    const backgroundMultiplier =
      type === "settings.volume.music"
        ? 1 - this.backgroundMusicAttenuation
        : 1;
    const assetTypeMultiplier = assetType
      ? ASSET_TYPE_VOLUME_MULTIPLER.get(assetType) ?? 1
      : 1;
    const volumeTypeMultiplier = VOLUME_TYPE_VOLUME_MULTIPLER.get(type) ?? 1;

    const result = fixVolume(
      volume *
        generalMultipler *
        backgroundMultiplier *
        assetTypeMultiplier *
        volumeTypeMultiplier
    );

    return result;
  }
}

function prefetchAudioAssets(resources: ClientResources) {
  audioFiles.forEach((file) =>
    resources.cached("/audio/buffer", file as AssetPath)
  );
}

export async function loadAudioManager(loader: RegistryLoader<ClientContext>) {
  return new AudioManager(await loader.get("resources"));
}
