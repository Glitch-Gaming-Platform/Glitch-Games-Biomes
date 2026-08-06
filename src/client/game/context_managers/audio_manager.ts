import type { ClientContext } from "@/client/game/context";
import {
  CH1_SAND_DUNGEON_MUSIC_PATH,
  CH1_WINTER_DUNGEON_MUSIC_PATH,
  HARTHMERE_BATTLE_MUSIC_PATH,
  HARTHMERE_BOSS_BATTLE_MUSIC_PATH,
  HARTHMERE_BUSINESS_MINIGAME_MUSIC_PATH,
  HARTHMERE_EXPLORATION_MUSIC_PATH,
  LEGACY_PROTECTED_AREA_MUSIC_PATHS,
  fetchAudioBuffer,
  resolveAudioUrl,
  type AudioPath,
} from "@/client/game/resources/audio";
import type { ClientResources } from "@/client/game/resources/types";
import type { SettingsKey } from "@/client/util/typed_local_storage";
import { getTypedStorageItem } from "@/client/util/typed_local_storage";
import {
  backgroundMusicStreamingSupported,
  createStreamingMusicElement,
  releaseStreamingMusicElement,
  shouldStreamBackgroundMusic,
  startStreamingMusicElement,
  type BackgroundMusicMediaElement,
  type BackgroundMusicStreamingEnvironment,
} from "@/client/game/util/background_music_streaming";
import type { AudioAssetType } from "@/galois/assets/audio";
import { audioAssets, getAudioAssetPaths } from "@/galois/assets/audio";
import type { AssetPath } from "@/galois/interface/asset_paths";
import { log } from "@/shared/logging";
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
  | "settings.volume.playerVoice"
>;

export const VOLUME_TYPE_VOLUME_MULTIPLER = new Map<SettingsKey, number>([
  ["settings.volume.music", 0.2],
  ["settings.volume.effects", 0.2],
  ["settings.volume.media", 0.4],
  ["settings.volume.voice", 0.6],
  ["settings.volume.playerVoice", 1],
]);

export const PLAYER_VOICE_GAME_AUDIO_DUCKING_GAIN = 0.42;

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
  | "grove_music"
  | "muck_music"
  | "cave_music"
  | "battle_music"
  | "boss_battle_music"
  | "business_minigame_music"
  | "harthmere_music"
  | "ch1_sand_music"
  | "ch1_winter_music"
  | "legacy_area_red_rock"
  | "legacy_area_rainforest"
  | "legacy_area_grassland"
  | "legacy_area_frontier";

export interface BackgroundMusicDiagnostics {
  running: boolean;
  requestedTrack: AudioTrackType;
  currentTrack: AudioTrackType | undefined;
  currentTrackPath: AudioPath | undefined;
  overrideTrack: AudioTrackType | undefined;
  loadedTracks: AudioTrackType[];
  loadedTrackPaths: Partial<Record<AudioTrackType, AudioPath>>;
  transitions: ReadonlyArray<{
    track: AudioTrackType;
    atMs: number;
  }>;
}

export interface AudioRecordingStream {
  stream: MediaStream;
  dispose(): void;
}

export interface PathSpatialAudioOptions {
  volumeMultiplier?: number;
  refDistance?: number;
  maxDistance?: number;
  rolloffFactor?: number;
}

export function resolvePathSpatialAudioOptions(
  volume: number,
  options: PathSpatialAudioOptions = {}
) {
  const volumeMultiplier = Number(options.volumeMultiplier);
  const refDistance = Number(options.refDistance);
  const maxDistance = Number(options.maxDistance);
  const rolloffFactor = Number(options.rolloffFactor);
  const resolvedRefDistance =
    Number.isFinite(refDistance) && refDistance > 0 ? refDistance : 2;
  return {
    volume: fixVolume(
      volume *
        (Number.isFinite(volumeMultiplier) ? Math.max(0, volumeMultiplier) : 1)
    ),
    refDistance: resolvedRefDistance,
    maxDistance:
      Number.isFinite(maxDistance) && maxDistance > 0
        ? Math.max(resolvedRefDistance, maxDistance)
        : 64,
    rolloffFactor:
      Number.isFinite(rolloffFactor) && rolloffFactor >= 0 ? rolloffFactor : 1,
  };
}

export const DEFAULT_BACKGROUND_MUSIC_CROSSFADE_SECONDS = 5;
export const COMBAT_MUSIC_CROSSFADE_SECONDS = 0.75;
export const GROVE_MUSIC_TRANSITION_SECONDS = 0;
export const BUSINESS_MINIGAME_MUSIC_TRANSITION_SECONDS = 0;
const COMBAT_MUSIC_TRACKS: ReadonlySet<AudioTrackType> = new Set([
  "battle_music",
  "boss_battle_music",
]);

// HARTHMERE_MOBILE_AAC_MUSIC (2026-08-04 physical iPhone crash audit).
// Keep the existing WebM/MP3 assets for desktop. Mobile Safari gets AAC-LC in
// an M4A container so its media pipeline can stream/hardware-decode long-form
// music rather than expanding an entire 3-10 minute track into ~90-190 MB of
// WebAudio PCM. These are additional assets; the originals remain untouched.
export const MOBILE_BACKGROUND_MUSIC_PATHS: Record<AudioTrackType, AudioPath> =
  {
    music: "/assets/harthmere/audio/mobile/muck-music.m4a",
    grove_music: "/assets/harthmere/audio/mobile/grove-music.m4a",
    muck_music: "/assets/harthmere/audio/mobile/muck-music.m4a",
    cave_music: "/assets/harthmere/audio/mobile/cave-music.m4a",
    battle_music: "/assets/harthmere/audio/mobile/battle-music.m4a",
    boss_battle_music: "/assets/harthmere/audio/mobile/boss-battle-music.m4a",
    business_minigame_music:
      "/assets/harthmere/audio/mobile/business-minigame-music.m4a",
    harthmere_music: "/assets/harthmere/audio/mobile/exploration-music.m4a",
    ch1_sand_music: "/assets/harthmere/audio/mobile/dungeon-music.m4a",
    ch1_winter_music: "/assets/harthmere/audio/mobile/dungeon-music.m4a",
    legacy_area_red_rock:
      "/assets/harthmere/audio/mobile/legacy-area-red-rock.m4a",
    legacy_area_rainforest:
      "/assets/harthmere/audio/mobile/legacy-area-rainforest.m4a",
    legacy_area_grassland:
      "/assets/harthmere/audio/mobile/legacy-area-grassland.m4a",
    legacy_area_frontier:
      "/assets/harthmere/audio/mobile/legacy-area-frontier.m4a",
  };

export function isBackgroundMusicAutoplayBlocked(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "NotAllowedError"
  );
}

// HARTHMERE_BACKGROUND_MUSIC_RESIDENCY (2026-08-04 asset loading audit, finding 4)
//
// Desktop used to preload all ten background tracks at boot -- ~24 MB of fetches
// and, because each one was decoded to PCM and left playing at gain 0, hundreds
// of MB of resident audio. Every device now loads only the track it is actually
// asking for, and anything else arrives on demand.
//
// Transition latency is covered two ways rather than by preloading everything:
//   * desktop streams (see background_music_streaming.ts), so a new track starts
//     as soon as the first media chunk arrives instead of after a full decode;
//   * the outgoing track is kept resident until the *next* transition, so the
//     crossfade in setBackgroundMusicTrack always has both ends available.
export function backgroundMusicTracksForDevice(
  _mobileDevice: boolean,
  requestedTrack: AudioTrackType
) {
  return [requestedTrack];
}

/**
 * Upper bound on simultaneously resident background tracks.
 *
 * Two on desktop: the one playing and the one fading in. One on mobile, which
 * is the behaviour validated on the physical iPhone (it releases before it
 * loads, accepting a short gap rather than holding two decoded tracks).
 */
export function maxResidentBackgroundMusicTracks(mobileDevice: boolean) {
  return mobileDevice ? 1 : 2;
}

/**
 * Select the oldest non-required tracks to evict after a load completes.
 *
 * `residentTracks` is insertion ordered (the order of `audioTracks`). Keeping
 * this decision pure makes the important third-transition case testable: when
 * desktop has outgoing + current + newly loaded tracks, the oldest outgoing
 * track must be removed immediately rather than surviving until transition 4.
 */
export function backgroundMusicTracksToEvict(
  residentTracks: readonly AudioTrackType[],
  keep: ReadonlySet<AudioTrackType>,
  limit: number
): AudioTrackType[] {
  let excess = Math.max(0, residentTracks.length - Math.max(0, limit));
  const evict: AudioTrackType[] = [];
  for (const trackType of residentTracks) {
    if (excess === 0) {
      break;
    }
    if (keep.has(trackType)) {
      continue;
    }
    evict.push(trackType);
    excess -= 1;
  }
  return evict;
}

// HARTHMERE_AUDIO_PREFETCH_SCOPE (2026-08-04 asset loading audit, finding 4)
//
// `prefetchAudioAssets` warmed every entry in `audioFiles`. That list mixes
// ~40 KB one-shots with multi-megabyte music beds. Measured against the current
// generated index, all 111 entries are 29.7 MB; the four long-form entries are
// 25.9 MB and the remaining 107 short effects/ambiences are 3.8 MB:
//
//   muck-music-1      7.96 MB     cave-music-loop   6.10 MB
//   music-1           7.81 MB     everything else  <= 0.82 MB
//
// Prefetching a footstep is a good trade (tiny, needed within seconds, and a
// late first-play is audible). Prefetching a music bed is not: it is large, the
// music system loads it on demand anyway, and on desktop it is now streamed
// rather than decoded. Excluding the long-form families takes the boot prefetch
// from 29.7 MB to 3.8 MB.
const LONG_FORM_AUDIO_ASSET_TYPES: ReadonlySet<AudioAssetType> = new Set([
  "music",
  "grove_music",
  "muck_music",
  "cave_music",
]);

/**
 * Whether the short-SFX prefetch should run at all. Mobile still opts out
 * entirely; its constraint is memory, not first-play latency.
 */
export function shouldPrefetchAllAudioAssets(mobileDevice: boolean) {
  return !mobileDevice;
}

/**
 * The audio paths worth warming at boot: every family except the long-form
 * music beds.
 */
export function audioAssetPathsToPrefetch(): AssetPath[] {
  return Object.entries(audioAssets).flatMap(([assetType, paths]) =>
    LONG_FORM_AUDIO_ASSET_TYPES.has(assetType as AudioAssetType)
      ? []
      : (paths as AssetPath[])
  );
}

export function backgroundMusicCrossfadeSeconds(
  previousTrack: AudioTrackType | undefined,
  nextTrack: AudioTrackType
) {
  // The Grove has its own established theme. Do not layer it with an incoming
  // or outgoing world bed: two full songs are immediately audible as a bug.
  if (previousTrack === "grove_music" || nextTrack === "grove_music") {
    return GROVE_MUSIC_TRANSITION_SECONDS;
  }
  if (
    previousTrack === "business_minigame_music" ||
    nextTrack === "business_minigame_music"
  ) {
    return BUSINESS_MINIGAME_MUSIC_TRANSITION_SECONDS;
  }
  return (previousTrack !== undefined &&
    COMBAT_MUSIC_TRACKS.has(previousTrack)) ||
    COMBAT_MUSIC_TRACKS.has(nextTrack)
    ? COMBAT_MUSIC_CROSSFADE_SECONDS
    : DEFAULT_BACKGROUND_MUSIC_CROSSFADE_SECONDS;
}

interface AudioTrack {
  audio: THREE.Audio;
  path: AudioPath;
  // HARTHMERE_BACKGROUND_MUSIC_STREAMING: set when this track is streamed from a
  // media element instead of a decoded AudioBuffer. The element owns playback
  // (THREE.Audio reports hasPlaybackControl === false for a media source), while
  // `audio.gain` still owns loudness -- so crossfades, ducking, mute and cutscene
  // recording are unchanged.
  media?: BackgroundMusicMediaElement;
}

export class AudioManager {
  private audioListener: THREE.AudioListener | undefined;

  private audioTracks: Map<AudioTrackType, AudioTrack> = new Map();
  private currentTrack: AudioTrack | undefined;
  private currentTrackType: AudioTrackType | undefined;
  private requestedTrackType: AudioTrackType = "music";
  private backgroundMusicOverrides = new Map<string, AudioTrackType>();
  private backgroundMusicTransitions: Array<{
    track: AudioTrackType;
    atMs: number;
  }> = [];

  private backgroundMusicAttenuation = 0;
  private playerVoiceDuckingActive = false;
  private prefetched = false;
  private muted = false;
  private underwaterEnvironmentActive = false;
  private underwaterListenerFilter: BiquadFilterNode | undefined;
  private underwaterAmbience: THREE.Audio | undefined;
  private underwaterAmbiencePath: AudioPath | undefined;
  private underwaterAmbienceLoadingPath: AudioPath | undefined;
  private readonly environmentLoops = new Map<
    string,
    { path: AudioPath; audio: THREE.Audio; volumeMultiplier: number }
  >();
  private readonly environmentLoopLoadingPaths = new Map<string, AudioPath>();
  private readonly proximityLoops = new Map<
    string,
    { path: AudioPath; audio: THREE.PositionalAudio }
  >();
  private readonly proximityLoopLoadingPaths = new Map<string, AudioPath>();

  private activeRegistry: Map<THREE.PositionalAudio, number> = new Map();
  private activeAssets: MultiMap<AudioAssetType, THREE.Audio> = new MultiMap();
  private activePaths: MultiMap<AudioPath, THREE.Audio> = new MultiMap();
  private loadingPaths = new Set<AudioPath>();

  private readonly backgroundTrackPaths: Record<AudioTrackType, AudioPath>;
  // One in-flight promise per track prevents A -> B -> A selection churn from
  // starting two fetch/decode operations for A. Completion consults the latest
  // requested track, so an old request can become current again safely.
  private readonly backgroundMusicLoads = new Map<
    AudioTrackType,
    Promise<void>
  >();
  private readonly onDemandMusicLoads = new Map<
    AudioTrackType,
    Promise<void>
  >();
  // Incrementing this invalidates loads started by an older listener/session.
  // Fetch/decode itself is not abortable through the resource API, but stale
  // results are disposed before they can enter the resident-track map.
  private backgroundMusicLoadGeneration = 0;
  // iOS rejects HTMLMediaElement.play() before a trusted touch. While this is
  // set, do not retry every frame and never fall back to a full decoded PCM
  // buffer. The document-level mobile touch handler calls resumeAudio() again
  // inside the next real gesture and clears this gate.
  private backgroundMusicAwaitingGesture = false;
  private streamingEnvironmentOverride:
    BackgroundMusicStreamingEnvironment | undefined;

  constructor(
    private resources: ClientResources,
    private readonly mobileDevice = false
  ) {
    const desktopBackgroundTrackPaths: Record<AudioTrackType, AudioPath> = {
      music: sample(getAudioAssetPaths("music"))!,
      grove_music: sample(getAudioAssetPaths("grove_music"))!,
      muck_music: sample(getAudioAssetPaths("muck_music"))!,
      cave_music: sample(getAudioAssetPaths("cave_music"))!,
      battle_music: HARTHMERE_BATTLE_MUSIC_PATH,
      boss_battle_music: HARTHMERE_BOSS_BATTLE_MUSIC_PATH,
      business_minigame_music: HARTHMERE_BUSINESS_MINIGAME_MUSIC_PATH,
      harthmere_music: HARTHMERE_EXPLORATION_MUSIC_PATH,
      ch1_sand_music: CH1_SAND_DUNGEON_MUSIC_PATH,
      ch1_winter_music: CH1_WINTER_DUNGEON_MUSIC_PATH,
      ...LEGACY_PROTECTED_AREA_MUSIC_PATHS,
    };
    this.backgroundTrackPaths = mobileDevice
      ? MOBILE_BACKGROUND_MUSIC_PATHS
      : desktopBackgroundTrackPaths;
  }

  stop() {
    this.stopUnderwaterAmbience();
    for (const key of [...this.environmentLoops.keys()]) {
      this.stopEnvironmentLoop(key);
    }
    this.environmentLoopLoadingPaths.clear();
    for (const key of [...this.proximityLoops.keys()]) {
      this.stopProximityLoop(key);
    }
    this.proximityLoopLoadingPaths.clear();
    if (
      this.audioListener &&
      this.underwaterListenerFilter &&
      this.audioListener.getFilter() === this.underwaterListenerFilter
    ) {
      this.audioListener.removeFilter();
    }
    this.underwaterListenerFilter = undefined;
    this.underwaterEnvironmentActive = false;
    for (const [audio] of this.activeRegistry.entries()) {
      audio.stop();
      this.activeRegistry.delete(audio);
    }
    this.cancelPendingBackgroundMusicLoads();
    this.releaseBackgroundMusicTracks();
    this.requestedTrackType = "music";
    this.backgroundMusicAwaitingGesture = false;
    this.backgroundMusicOverrides.clear();
    this.backgroundMusicTransitions = [];
  }

  hotHandoff(old: AudioManager) {
    this.activeRegistry = old.activeRegistry;
    this.activeAssets = old.activeAssets;
    this.activePaths = old.activePaths;
    this.loadingPaths = old.loadingPaths;
    this.requestedTrackType = old.requestedTrackType;
    this.backgroundMusicOverrides = new Map(old.backgroundMusicOverrides);
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
    if (!shouldPrefetchAllAudioAssets(this.mobileDevice)) {
      return;
    }
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
      requestedTrack: this.requestedTrackType,
      currentTrack: this.currentTrackType,
      currentTrackPath: this.currentTrack?.path,
      overrideTrack: this.getBackgroundMusicOverride(),
      loadedTracks: [...this.audioTracks.keys()].sort(),
      loadedTrackPaths: Object.fromEntries(
        [...this.audioTracks.entries()].map(([trackType, track]) => [
          trackType,
          track.path,
        ])
      ),
      transitions: [...this.backgroundMusicTransitions],
    };
  }

  async resumeAudio() {
    const activeUserGesture =
      !this.mobileDevice ||
      (typeof navigator !== "undefined" &&
        navigator.userActivation?.isActive === true);
    const retryBlockedMobileMusic =
      activeUserGesture && this.backgroundMusicAwaitingGesture;
    if (activeUserGesture) {
      this.backgroundMusicAwaitingGesture = false;
    }
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
      this.applyPlayerVoiceDucking(false);
      if (!this.backgroundMusicAwaitingGesture) {
        await this.startBackgroundMusic();
      }
      this.prefetchAudioAssets();
    } else if (retryBlockedMobileMusic && !this.currentTrack) {
      await this.startBackgroundMusic();
    }
  }

  async startBackgroundMusic() {
    if (
      !this.audioListener ||
      this.currentTrack ||
      this.backgroundMusicAwaitingGesture
    ) {
      return;
    }
    await Promise.allSettled(
      backgroundMusicTracksForDevice(
        this.mobileDevice,
        this.requestedTrackType
      ).map((trackType) => this.loadBackgroundMusicTrack(trackType))
    );

    // AudioScript may select the player's real region while these buffers are
    // still loading. Honor that latest request instead of forcing the legacy
    // default world slot once preload completes.
    this.setBackgroundMusicTrack(this.requestedTrackType);
  }

  /**
   * The streaming environment for this process. Overridable in tests; in the
   * browser it probes for `window.Audio` and MediaElementAudioSourceNode.
   */
  backgroundMusicStreamingEnvironment(): BackgroundMusicStreamingEnvironment {
    if (this.streamingEnvironmentOverride) {
      return this.streamingEnvironmentOverride;
    }
    const win = typeof window === "undefined" ? undefined : window;
    return {
      audioElementCtor: win?.Audio as
        BackgroundMusicStreamingEnvironment["audioElementCtor"] | undefined,
      mediaElementSourceSupported:
        typeof this.audioListener?.context?.createMediaElementSource ===
        "function",
    };
  }

  /** Test seam for the streaming policy. */
  setBackgroundMusicStreamingEnvironmentForTest(
    env: BackgroundMusicStreamingEnvironment | undefined
  ) {
    this.streamingEnvironmentOverride = env;
  }

  /** Whether music for this session streams rather than decoding to PCM. */
  streamsBackgroundMusic() {
    return shouldStreamBackgroundMusic(
      this.mobileDevice,
      this.backgroundMusicStreamingEnvironment()
    );
  }

  /**
   * Coalesce every load path, including startup and later selection changes.
   * Without this layer a region change during startup could start a second
   * fetch/parse for the same track before the first one became resident.
   */
  private loadBackgroundMusicTrack(
    audioTrackType: AudioTrackType
  ): Promise<void> {
    const existing = this.backgroundMusicLoads.get(audioTrackType);
    if (existing) {
      return existing;
    }
    const listener = this.audioListener;
    if (
      !listener ||
      this.audioTracks.has(audioTrackType) ||
      this.backgroundMusicAwaitingGesture
    ) {
      return Promise.resolve();
    }
    const generation = this.backgroundMusicLoadGeneration;
    const assetPath = this.backgroundTrackPaths[audioTrackType];

    const pending = this.createBackgroundMusicTrack(
      listener,
      assetPath,
      generation
    )
      .then((track) => {
        if (!track) {
          return;
        }
        if (
          generation !== this.backgroundMusicLoadGeneration ||
          this.audioListener !== listener ||
          this.audioTracks.has(audioTrackType)
        ) {
          this.disposeBackgroundMusicTrack(track);
          return;
        }
        this.audioTracks.set(audioTrackType, track);
      })
      .finally(() => {
        // An old, invalidated load must not delete a newer load for the same
        // track after stop/hot-handoff or a mobile selection change.
        if (this.backgroundMusicLoads.get(audioTrackType) === pending) {
          this.backgroundMusicLoads.delete(audioTrackType);
        }
      });
    this.backgroundMusicLoads.set(audioTrackType, pending);
    return pending;
  }

  private async createBackgroundMusicTrack(
    listener: THREE.AudioListener,
    assetPath: AudioPath,
    generation: number
  ): Promise<AudioTrack | undefined> {
    if (generation !== this.backgroundMusicLoadGeneration) {
      return undefined;
    }
    // HARTHMERE_BACKGROUND_MUSIC_STREAMING: supported browsers, including
    // current iOS Safari, stream the track through a media element wired into
    // the same WebAudio graph. Runtimes without MediaElementAudioSourceNode
    // keep the decoded-buffer fallback.
    if (this.streamsBackgroundMusic()) {
      const streamed = await this.loadStreamingBackgroundMusicTrack(
        listener,
        assetPath,
        generation
      );
      return streamed;
    }

    // Long-form decoded music must not enter the shared resource cache. On
    // iPhone each track expands to roughly 150-190 MB of PCM; invalidating a
    // cached node only marked it stale and retained the old AudioBuffer until a
    // later resource purge. A cave -> world transition therefore held both
    // decoded tracks and crossed WebContent's 1.5 GiB high-water limit.
    const buffer = await this.loadDecodedBackgroundMusicBuffer(assetPath);
    if (
      !buffer ||
      this.audioListener !== listener ||
      generation !== this.backgroundMusicLoadGeneration
    ) {
      return;
    }
    const audio = new THREE.Audio(listener);
    audio.setBuffer(buffer);
    audio.setLoop(true);
    audio.setFilters(this.getBackgroundMusicFilters());
    audio.gain.gain.value = 0;
    audio.play();
    return { audio, path: assetPath };
  }

  private loadDecodedBackgroundMusicBuffer(assetPath: AudioPath) {
    return fetchAudioBuffer(assetPath);
  }

  private async loadStreamingBackgroundMusicTrack(
    listener: THREE.AudioListener,
    assetPath: AudioPath,
    generation: number
  ): Promise<AudioTrack | undefined> {
    const env = this.backgroundMusicStreamingEnvironment();
    if (!backgroundMusicStreamingSupported(env)) {
      return undefined;
    }
    let media: BackgroundMusicMediaElement | undefined;
    let audio: THREE.Audio | undefined;
    try {
      media = createStreamingMusicElement(resolveAudioUrl(assetPath), env);
      audio = new THREE.Audio(listener);
      // Gain first: the element starts playing immediately, and an un-zeroed
      // gain would blast a full-volume track before the crossfade ramps it.
      audio.gain.gain.value = 0;
      audio.setMediaElementSource(media as unknown as HTMLMediaElement);
      audio.setFilters(this.getBackgroundMusicFilters());
      await startStreamingMusicElement(media);
      if (
        this.audioListener !== listener ||
        generation !== this.backgroundMusicLoadGeneration
      ) {
        // The listener was torn down while we awaited playback.
        releaseStreamingMusicElement(media);
        audio.disconnect();
        return undefined;
      }
      return { audio, path: assetPath, media };
    } catch (error) {
      if (this.mobileDevice && isBackgroundMusicAutoplayBlocked(error)) {
        if (media) {
          releaseStreamingMusicElement(media);
        }
        audio?.disconnect();
        this.backgroundMusicAwaitingGesture = true;
        log.info(
          "Mobile background music is waiting for a trusted touch gesture",
          { assetPath }
        );
        return undefined;
      }
      // A browser that rejects createMediaElementSource must still get music:
      // drop back to the decoded path rather than leaving the world silent.
      if (media) {
        releaseStreamingMusicElement(media);
      }
      audio?.disconnect();
      log.warn(
        "Background music streaming failed; falling back to a decoded buffer",
        { assetPath, error }
      );
      if (generation !== this.backgroundMusicLoadGeneration) {
        return undefined;
      }
      const buffer = await this.loadDecodedBackgroundMusicBuffer(assetPath);
      if (
        !buffer ||
        this.audioListener !== listener ||
        generation !== this.backgroundMusicLoadGeneration
      ) {
        return undefined;
      }
      const fallbackAudio = new THREE.Audio(listener);
      fallbackAudio.setBuffer(buffer);
      fallbackAudio.setLoop(true);
      fallbackAudio.setFilters(this.getBackgroundMusicFilters());
      fallbackAudio.gain.gain.value = 0;
      fallbackAudio.play();
      return { audio: fallbackAudio, path: assetPath };
    }
  }

  /** Tear one track down and release whatever memory it held. */
  private disposeBackgroundMusicTrack(track: AudioTrack) {
    if (track.media) {
      // Streamed: the element owns playback, and clearing it is what actually
      // frees the buffered media.
      releaseStreamingMusicElement(track.media);
      track.audio.disconnect();
      return;
    }
    if (track.audio.isPlaying) {
      track.audio.stop();
    }
    track.audio.disconnect();
    // Decoded: sever every WebAudio/Three reference to the large PCM buffer.
    // `stop()` alone leaves both THREE.Audio.buffer and the last
    // AudioBufferSourceNode.buffer reachable, which made mobile transitions
    // accumulate roughly 150-190 MB per music bed until iOS jetsammed the tab.
    const source = track.audio.source as AudioBufferSourceNode | null;
    try {
      source?.disconnect();
    } catch {
      // Already disconnected by THREE.Audio.disconnect().
    }
    if (source && "buffer" in source) {
      source.buffer = null;
    }
    (track.audio as THREE.Audio & { buffer: AudioBuffer | null }).buffer = null;
    (track.audio as THREE.Audio & { source: AudioNode | null }).source = null;
    try {
      track.audio.gain.disconnect();
    } catch {
      // The gain may already be detached during listener teardown.
    }
  }

  private releaseBackgroundMusicTracks() {
    for (const track of this.audioTracks.values()) {
      this.disposeBackgroundMusicTrack(track);
    }
    this.audioTracks.clear();
    this.currentTrack = undefined;
    this.currentTrackType = undefined;
  }

  /** Invalidate in-flight loads without waiting for unabortable decode work. */
  private cancelPendingBackgroundMusicLoads() {
    this.backgroundMusicLoadGeneration += 1;
    this.backgroundMusicLoads.clear();
    this.onDemandMusicLoads.clear();
  }

  /**
   * HARTHMERE_BACKGROUND_MUSIC_RESIDENCY: keep residency within
   * `maxResidentBackgroundMusicTracks`, never evicting the track that is playing
   * or the one that was just requested.
   *
   * Eviction happens when the *next* transition starts rather than on a timer,
   * so a crossfade always has both of its ends and no clock has to be trusted.
   */
  private pruneBackgroundMusicTracks(keep: ReadonlySet<AudioTrackType>) {
    const limit = maxResidentBackgroundMusicTracks(this.mobileDevice);
    const protectedTracks = new Set(keep);
    if (this.currentTrackType) {
      protectedTracks.add(this.currentTrackType);
    }
    for (const trackType of backgroundMusicTracksToEvict(
      [...this.audioTracks.keys()],
      protectedTracks,
      limit
    )) {
      const track = this.audioTracks.get(trackType);
      if (!track) {
        continue;
      }
      this.disposeBackgroundMusicTrack(track);
      this.audioTracks.delete(trackType);
      if (this.currentTrackType === trackType) {
        this.currentTrackType = undefined;
      }
    }
  }

  /**
   * Load a track that was not resident, then switch to it if it is still the
   * one being asked for.
   *
   * This used to be mobile-only (`loadMobileBackgroundMusicTrack`); every device
   * now takes it, because no device preloads the full set any more. Mobile keeps
   * its release-before-load behaviour via `maxResidentBackgroundMusicTracks`.
   */
  private loadOnDemandBackgroundMusicTrack(trackType: AudioTrackType) {
    if (
      this.onDemandMusicLoads.has(trackType) ||
      this.audioTracks.has(trackType)
    ) {
      return;
    }
    if (maxResidentBackgroundMusicTracks(this.mobileDevice) <= 1) {
      // Mobile: release first so two tracks are never decoded at once. This is
      // the behaviour validated on the physical iPhone; the audible cost is a
      // short gap during the load.
      this.cancelPendingBackgroundMusicLoads();
      this.releaseBackgroundMusicTracks();
    }

    const pending = this.loadBackgroundMusicTrack(trackType).finally(() => {
      if (this.onDemandMusicLoads.get(trackType) === pending) {
        this.onDemandMusicLoads.delete(trackType);
      }
      const loadedTrack = this.audioTracks.get(trackType);
      if (this.requestedTrackType === trackType) {
        // Prune after insertion. Pruning before the await allowed the third
        // desktop transition to leave three tracks resident indefinitely.
        this.pruneBackgroundMusicTracks(new Set([trackType]));
        if (loadedTrack) {
          this.setBackgroundMusicTrack(trackType);
        }
      } else if (loadedTrack && loadedTrack !== this.currentTrack) {
        // Selection moved elsewhere while this track loaded. Do not keep a
        // silent, never-used stream/buffer resident.
        this.disposeBackgroundMusicTrack(loadedTrack);
        this.audioTracks.delete(trackType);
      }
    });
    this.onDemandMusicLoads.set(trackType, pending);
    fireAndForget(
      pending.catch((error) => {
        log.warn("Failed to load background music on demand", {
          trackType,
          error,
        });
      })
    );
  }

  setBackgroundMusicTrack(trackType: AudioTrackType) {
    // Remember selection requests made before the AudioContext or requested
    // buffer is ready. startBackgroundMusic applies the latest one after load.
    this.requestedTrackType = trackType;
    if (!this.audioListener) {
      return;
    }
    const context = this.audioListener.context;
    const newTrack = this.audioTracks.get(trackType);
    if (!newTrack) {
      if (this.backgroundMusicAwaitingGesture) {
        return;
      }
      // HARTHMERE_BACKGROUND_MUSIC_RESIDENCY: no device preloads every track any
      // more, so a miss here is normal on all platforms, not just mobile.
      this.loadOnDemandBackgroundMusicTrack(trackType);
      return;
    }
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

    // Crossfade volume to the current track. Region themes that require an
    // exclusive handoff use a zero-second transition to avoid layering songs.
    for (const track of this.audioTracks.values()) {
      if (track !== this.currentTrack) {
        track.audio.gain.gain.cancelScheduledValues(context.currentTime);
        if (crossfadeSeconds === 0) {
          track.audio.gain.gain.setValueAtTime(0, context.currentTime);
        } else {
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
    }
    this.currentTrack?.audio.gain.gain.cancelScheduledValues(
      context.currentTime
    );
    if (this.currentTrack) {
      if (crossfadeSeconds === 0) {
        this.currentTrack.audio.gain.gain.setValueAtTime(
          this.getVolume("settings.volume.music"),
          context.currentTime
        );
      } else {
        this.currentTrack.audio.gain.gain.setValueAtTime(
          this.currentTrack.audio.gain.gain.value,
          context.currentTime
        );
        this.currentTrack.audio.gain.gain.linearRampToValueAtTime(
          this.getVolume("settings.volume.music"),
          context.currentTime + crossfadeSeconds
        );
      }
    }
  }

  setBackgroundMusicOverride(
    owner: string,
    trackType: AudioTrackType | undefined
  ) {
    this.backgroundMusicOverrides.delete(owner);
    if (trackType) {
      this.backgroundMusicOverrides.set(owner, trackType);
    }
  }

  getBackgroundMusicOverride() {
    return [...this.backgroundMusicOverrides.values()].at(-1);
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

  setPlayerVoiceDucking(active: boolean) {
    if (this.playerVoiceDuckingActive === active) {
      return;
    }
    this.playerVoiceDuckingActive = active;
    this.applyPlayerVoiceDucking(true);
  }

  private applyPlayerVoiceDucking(smooth: boolean) {
    const listener = this.audioListener;
    if (!listener) {
      return;
    }
    const now = listener.context.currentTime;
    const gain = listener.gain.gain;
    const target = this.playerVoiceDuckingActive
      ? PLAYER_VOICE_GAME_AUDIO_DUCKING_GAIN
      : 1;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    if (smooth) {
      gain.linearRampToValueAtTime(
        target,
        now + (this.playerVoiceDuckingActive ? 0.08 : 0.22)
      );
    } else {
      gain.setValueAtTime(target, now);
    }
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

  private stopUnderwaterAmbience() {
    const path = this.underwaterAmbiencePath;
    this.underwaterAmbienceLoadingPath = undefined;
    if (this.underwaterAmbience) {
      if (this.underwaterAmbience.isPlaying) {
        this.underwaterAmbience.stop();
      }
      this.underwaterAmbience.disconnect();
    }
    this.underwaterAmbience = undefined;
    this.underwaterAmbiencePath = undefined;
    if (path) {
      this.releaseDecodedAudioBuffer(path);
    }
  }

  private startUnderwaterAmbience(assetPath: AudioPath) {
    if (
      (this.underwaterAmbiencePath === assetPath &&
        this.underwaterAmbience?.isPlaying) ||
      this.underwaterAmbienceLoadingPath === assetPath
    ) {
      return;
    }
    this.stopUnderwaterAmbience();
    const listener = this.audioListener;
    if (!listener) {
      return;
    }
    this.underwaterAmbienceLoadingPath = assetPath;
    fireAndForget(
      (async () => {
        const buffer = await this.resources.get("/audio/buffer", assetPath);
        if (this.underwaterAmbienceLoadingPath !== assetPath) {
          return;
        }
        this.underwaterAmbienceLoadingPath = undefined;
        if (
          !buffer ||
          !this.underwaterEnvironmentActive ||
          this.audioListener !== listener
        ) {
          return;
        }
        const sound = new THREE.Audio(listener);
        sound.setBuffer(buffer);
        sound.setLoop(true);
        sound.setVolume(this.getVolume("settings.volume.effects") * 0.35);
        sound.play();
        this.underwaterAmbience = sound;
        this.underwaterAmbiencePath = assetPath;
      })()
    );
  }

  /**
   * Applies the submerged listener mix to every game sound and owns the quiet
   * looping water bed. Camera immersion is used because it matches the actual
   * player's auditory perspective in both first- and third-person views.
   */
  setUnderwaterEnvironment(active: boolean, ambiencePath?: AudioPath) {
    this.underwaterEnvironmentActive = active;
    const listener = this.audioListener;
    if (!listener) {
      return;
    }
    if (!active && !this.underwaterListenerFilter) {
      this.stopUnderwaterAmbience();
      return;
    }
    const context = listener.context;
    if (!this.underwaterListenerFilter) {
      const lowpass = context.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.Q.value = 0.7;
      lowpass.frequency.value = 0.5 * context.sampleRate;
      listener.setFilter(lowpass);
      this.underwaterListenerFilter = lowpass;
    }
    this.underwaterListenerFilter.frequency.setTargetAtTime(
      active ? 1_100 : 0.5 * context.sampleRate,
      context.currentTime,
      0.12
    );

    if (active && ambiencePath) {
      this.startUnderwaterAmbience(ambiencePath);
      this.underwaterAmbience?.setVolume(
        this.getVolume("settings.volume.effects") * 0.35
      );
    } else {
      this.stopUnderwaterAmbience();
    }
  }

  /**
   * Owns a non-positional environmental ambience loop. Callers update this
   * every tick; matching active loops are reused, while deactivation cancels
   * both loaded and in-flight audio. Music remains on the music volume channel
   * and these beds follow the effects volume channel.
   */
  setEnvironmentLoop(
    key: string,
    active: boolean,
    assetPath?: AudioPath,
    options: { volumeMultiplier?: number } = {}
  ) {
    if (!active || !assetPath) {
      this.stopEnvironmentLoop(key);
      return;
    }
    const volumeMultiplier = options.volumeMultiplier ?? 1;
    const existing = this.environmentLoops.get(key);
    if (existing?.path === assetPath) {
      existing.volumeMultiplier = volumeMultiplier;
      existing.audio.setVolume(
        this.getVolume("settings.volume.effects") * volumeMultiplier
      );
      if (!existing.audio.isPlaying) {
        existing.audio.play();
      }
      return;
    }
    if (existing) {
      this.stopEnvironmentLoop(key);
    }
    if (this.environmentLoopLoadingPaths.get(key) === assetPath) {
      return;
    }
    const listener = this.audioListener;
    if (!listener) {
      return;
    }
    this.environmentLoopLoadingPaths.set(key, assetPath);
    fireAndForget(
      (async () => {
        const buffer = await this.resources.get("/audio/buffer", assetPath);
        if (this.environmentLoopLoadingPaths.get(key) !== assetPath) {
          return;
        }
        this.environmentLoopLoadingPaths.delete(key);
        if (!buffer || this.audioListener !== listener) {
          return;
        }
        const audio = new THREE.Audio(listener);
        audio.setBuffer(buffer);
        audio.setLoop(true);
        audio.setVolume(
          this.getVolume("settings.volume.effects") * volumeMultiplier
        );
        audio.play();
        this.environmentLoops.set(key, {
          path: assetPath,
          audio,
          volumeMultiplier,
        });
      })()
    );
  }

  stopEnvironmentLoop(key: string) {
    this.environmentLoopLoadingPaths.delete(key);
    const loop = this.environmentLoops.get(key);
    if (!loop) {
      return;
    }
    if (loop.audio.isPlaying) {
      loop.audio.stop();
    }
    loop.audio.disconnect();
    this.environmentLoops.delete(key);
    this.releaseDecodedAudioBuffer(loop.path);
  }

  setProximityLoop(
    key: string,
    assetPath: AudioPath,
    position: readonly number[],
    options: {
      volumeMultiplier?: number;
      refDistance?: number;
      maxDistance?: number;
      rolloffFactor?: number;
    } = {}
  ) {
    if (!this.audioListener || position.length < 3) {
      return;
    }
    const existing = this.proximityLoops.get(key);
    if (existing?.path === assetPath) {
      existing.audio.position.set(position[0], position[1], position[2]);
      existing.audio.setVolume(
        this.getVolume("settings.volume.effects") *
          (options.volumeMultiplier ?? 1)
      );
      existing.audio.updateMatrixWorld(true);
      if (!existing.audio.isPlaying) {
        existing.audio.play();
      }
      return;
    }
    if (existing) {
      this.stopProximityLoop(key);
    }
    if (this.proximityLoopLoadingPaths.get(key) === assetPath) {
      return;
    }
    this.proximityLoopLoadingPaths.set(key, assetPath);
    const listener = this.audioListener;
    const requestedPosition = [position[0], position[1], position[2]] as const;
    fireAndForget(
      (async () => {
        const buffer = await this.resources.get("/audio/buffer", assetPath);
        if (this.proximityLoopLoadingPaths.get(key) !== assetPath) {
          return;
        }
        this.proximityLoopLoadingPaths.delete(key);
        if (!buffer || this.audioListener !== listener) {
          return;
        }
        const audio = new THREE.PositionalAudio(listener);
        audio.setBuffer(buffer);
        audio.setLoop(true);
        audio.setDistanceModel("exponential");
        audio.setRefDistance(options.refDistance ?? 3);
        audio.setMaxDistance(options.maxDistance ?? 32);
        audio.setRolloffFactor(options.rolloffFactor ?? 1.6);
        audio.setVolume(
          this.getVolume("settings.volume.effects") *
            (options.volumeMultiplier ?? 1)
        );
        audio.position.set(...requestedPosition);
        audio.updateMatrixWorld(true);
        audio.play();
        this.proximityLoops.set(key, { path: assetPath, audio });
      })()
    );
  }

  stopProximityLoop(key: string) {
    this.proximityLoopLoadingPaths.delete(key);
    const loop = this.proximityLoops.get(key);
    if (!loop) {
      return;
    }
    if (loop.audio.isPlaying) {
      loop.audio.stop();
    }
    loop.audio.disconnect();
    this.proximityLoops.delete(key);
    this.releaseDecodedAudioBuffer(loop.path);
  }

  /**
   * Mobile WebAudio must decode even compressed AAC/Opus into PCM. Once a
   * one-shot or stopped loop releases its Three.js node, invalidate the shared
   * resource node too so Safari/Chrome may reclaim that decoded buffer. Desktop
   * keeps its existing hot SFX cache and first-play latency behavior.
   */
  private releaseDecodedAudioBuffer(assetPath: AudioPath) {
    if (this.mobileDevice) {
      this.resources.invalidate("/audio/buffer", assetPath);
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

        const assetPath = sample(getAudioAssetPaths(assetType));
        // Cutscene story cues are best-effort labels. An unknown cue must no-op
        // like playSoundAt instead of requesting /audio/buffer with undefined
        // and turning an otherwise valid scene into a browser error.
        if (!assetPath) {
          return;
        }
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
            this.releaseDecodedAudioBuffer(assetPath);
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
        sound.onEnded = () => {
          sound.disconnect();
          this.releaseDecodedAudioBuffer(assetPath);
        };
        sound.play();
      })()
    );
  }

  playPath(
    assetPath: AudioPath,
    options: {
      idempotent?: boolean;
    } = {}
  ) {
    if (
      options.idempotent &&
      (this.activePaths.hasAny(assetPath) || this.loadingPaths.has(assetPath))
    ) {
      return;
    }
    fireAndForget(
      (async () => {
        if (!this.audioListener) {
          return;
        }
        const volume = this.getVolume("settings.volume.effects");
        if (volume === 0) {
          return;
        }
        if (options.idempotent) this.loadingPaths.add(assetPath);
        const buffer = await this.resources
          .get("/audio/buffer", assetPath)
          .finally(() => this.loadingPaths.delete(assetPath));
        if (!buffer) {
          return;
        }
        const sound = new THREE.Audio(this.audioListener);
        this.activePaths.add(assetPath, sound);
        sound.setBuffer(buffer);
        sound.setVolume(volume);
        sound.onEnded = () => {
          sound.disconnect();
          this.activePaths.delete(assetPath, sound);
          this.releaseDecodedAudioBuffer(assetPath);
        };
        sound.play();
      })()
    );
  }

  playPathAt(
    assetPath: AudioPath,
    position: readonly number[],
    options: PathSpatialAudioOptions = {}
  ) {
    fireAndForget(
      (async () => {
        if (!this.audioListener || position.length < 3) {
          return;
        }
        const volume = this.getVolume("settings.volume.effects");
        if (volume === 0) {
          return;
        }
        const buffer = await this.resources.get("/audio/buffer", assetPath);
        if (!buffer) {
          return;
        }
        const sound = new THREE.PositionalAudio(this.audioListener);
        sound.setBuffer(buffer);
        const spatial = resolvePathSpatialAudioOptions(volume, options);
        sound.setVolume(spatial.volume);
        sound.position.set(position[0], position[1], position[2]);
        sound.setDistanceModel("exponential");
        sound.setRolloffFactor(spatial.rolloffFactor);
        sound.setRefDistance(spatial.refDistance);
        sound.setMaxDistance(spatial.maxDistance);
        sound.updateMatrixWorld(true);
        sound.onEnded = () => {
          sound.disconnect();
          this.releaseDecodedAudioBuffer(assetPath);
        };
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
      ? (ASSET_TYPE_VOLUME_MULTIPLER.get(assetType) ?? 1)
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
  // HARTHMERE_AUDIO_PREFETCH_SCOPE: short SFX/ambience only. The four generated
  // music beds are 25.9 MB of the old 29.7 MB prefetch and are loaded (and on
  // desktop streamed) on demand.
  audioAssetPathsToPrefetch().forEach((file) =>
    resources.cached("/audio/buffer", file)
  );
}

export async function loadAudioManager(loader: RegistryLoader<ClientContext>) {
  const [resources, clientConfig] = await Promise.all([
    loader.get("resources"),
    loader.get("clientConfig"),
  ]);
  return new AudioManager(resources, clientConfig.mobileDevice);
}
