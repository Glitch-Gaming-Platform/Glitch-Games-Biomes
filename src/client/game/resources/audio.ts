import type { ClientContext } from "@/client/game/context";
import type { AudioManager } from "@/client/game/context_managers/audio_manager";
import type {
  ClientResourceDeps,
  ClientResourcesBuilder,
} from "@/client/game/resources/types";
import type { AssetPath } from "@/galois/interface/asset_paths";
import { resolveAssetUrl } from "@/galois/interface/asset_paths";
import {
  browserMobileAudioCapabilityEnvironment,
  mobileAacVariantUrl,
  shouldPreferMobileAacForBufferedAudio,
} from "@/client/game/util/mobile_audio_variants";
import type { RegistryLoader } from "@/shared/registry";
import * as THREE from "three";

export interface AudioResource {
  manager?: AudioManager;
  listener?: THREE.AudioListener;
}

export type AudioPath = AssetPath | `/${string}`;

export const HARTHMERE_BATTLE_MUSIC_PATH =
  "/assets/harthmere/audio/hauntsync-rpg-battle-chiptune.webm" as const;

export const HARTHMERE_BOSS_BATTLE_MUSIC_PATH =
  "/assets/harthmere/audio/11-no-crown-above-the-storm-loop.mp3" as const;

export const HARTHMERE_EXPLORATION_MUSIC_PATH =
  "/assets/harthmere/audio/08-banners-at-first-light-loop.mp3" as const;

export const HARTHMERE_BUSINESS_MINIGAME_MUSIC_PATH =
  "/assets/harthmere/audio/harthmere-fiddle-race-v3-fast-loop.mp3" as const;

export const CH1_SAND_DUNGEON_MUSIC_PATH =
  "/assets/harthmere/audio/09-embers-test-the-oath-loop.mp3" as const;

export const CH1_WINTER_DUNGEON_MUSIC_PATH =
  "/assets/harthmere/audio/09-embers-test-the-oath-loop.mp3" as const;

export const LEGACY_PROTECTED_AREA_MUSIC_PATHS = {
  legacy_area_red_rock:
    "/assets/harthmere/audio/legacy-protected-areas/01-red-rock-horizon-loop.webm",
  legacy_area_rainforest:
    "/assets/harthmere/audio/legacy-protected-areas/02-rainforest-machinery-loop.webm",
  legacy_area_grassland:
    "/assets/harthmere/audio/legacy-protected-areas/03-open-grassland-journey-loop.webm",
  legacy_area_frontier:
    "/assets/harthmere/audio/legacy-protected-areas/04-sunbaked-frontier-loop.webm",
} as const satisfies Record<string, AudioPath>;

export function resolveAudioUrl(path: AudioPath) {
  return path.startsWith("/") ? path : resolveAssetUrl(path as AssetPath);
}

function fetchAudioBufferUrl(url: string): Promise<AudioBuffer> {
  // Note: We cannot load samples if the AudioContext is missing, or there will be a warning in the console.
  // So make sure it exists before calling this function.
  return new Promise((resolve, reject) => {
    const audioLoader = new THREE.AudioLoader();
    audioLoader.load(
      url,
      function (buffer) {
        resolve(buffer);
      },
      undefined,
      reject
    );
  });
}

export async function fetchAudioBuffer(
  path: AudioPath,
  preferredUrl?: string
): Promise<AudioBuffer> {
  const originalUrl = resolveAudioUrl(path);
  if (preferredUrl && preferredUrl !== originalUrl) {
    try {
      return await fetchAudioBufferUrl(preferredUrl);
    } catch {
      // Variants are additive. A stale CDN edge or partial local checkout must
      // fall back to the original WebM/Opus asset rather than dropping sound.
    }
  }
  return fetchAudioBufferUrl(originalUrl);
}

async function genAudioBuffer(
  deps: ClientResourceDeps,
  path: AudioPath,
  preferMobileAac: boolean
) {
  const { listener: audioListener, manager: audioManager } = deps.get("/audio");
  if (!audioListener || !audioManager) {
    return;
  }
  try {
    const originalUrl = resolveAudioUrl(path);
    return await fetchAudioBuffer(
      path,
      preferMobileAac ? mobileAacVariantUrl(originalUrl) : undefined
    );
  } catch (error) {
    // The public local snapshot can be missing a few historical audio files.
    // Treat those as optional in development so a missing footstep/sfx clip does
    // not crash world startup.
    if (process.env.NODE_ENV !== "production") {
      return;
    }
    throw error;
  }
}

export async function addAudioResources(
  loader: RegistryLoader<ClientContext>,
  builder: ClientResourcesBuilder
) {
  const clientConfig = await loader.get("clientConfig");
  const preferMobileAac = shouldPreferMobileAacForBufferedAudio(
    clientConfig.mobileDevice,
    browserMobileAudioCapabilityEnvironment()
  );
  builder.add("/audio/buffer", (deps, path) =>
    genAudioBuffer(deps, path, preferMobileAac)
  );
  builder.addGlobal("/audio", {});
}
