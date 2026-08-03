import type { ClientContext } from "@/client/game/context";
import type { AudioManager } from "@/client/game/context_managers/audio_manager";
import type {
  ClientResourceDeps,
  ClientResourcesBuilder,
} from "@/client/game/resources/types";
import type { AssetPath } from "@/galois/interface/asset_paths";
import { resolveAssetUrl } from "@/galois/interface/asset_paths";
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

export function resolveAudioUrl(path: AudioPath) {
  return path.startsWith("/") ? path : resolveAssetUrl(path as AssetPath);
}

function fetchAudioBuffer(path: AudioPath): Promise<AudioBuffer> {
  // Note: We cannot load samples if the AudioContext is missing, or there will be a warning in the console.
  // So make sure it exists before calling this function.
  return new Promise((resolve, reject) => {
    const audioLoader = new THREE.AudioLoader();
    audioLoader.load(
      resolveAudioUrl(path),
      function (buffer) {
        resolve(buffer);
      },
      undefined,
      reject
    );
  });
}

async function genAudioBuffer(deps: ClientResourceDeps, path: AudioPath) {
  const { listener: audioListener, manager: audioManager } = deps.get("/audio");
  if (!audioListener || !audioManager) {
    return;
  }
  try {
    return await fetchAudioBuffer(path);
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
  builder.add("/audio/buffer", genAudioBuffer);
  builder.addGlobal("/audio", {});
}
