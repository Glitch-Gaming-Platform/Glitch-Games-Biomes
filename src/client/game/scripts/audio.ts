import type {
  AudioManager,
  AudioTrackType,
} from "@/client/game/context_managers/audio_manager";
import type { ClientTable } from "@/client/game/game";
import type { AudioPath } from "@/client/game/resources/audio";
import type { ClientResources } from "@/client/game/resources/types";
import type { Script } from "@/client/game/scripts/script_controller";
import {
  isCaveAudioEnvironment,
  isMountainTopAudioEnvironment,
} from "@/client/game/util/environment_audio";
import { getAudioAssetPaths } from "@/galois/assets/audio";
import {
  AudioSourceSelector,
  NpcMetadataSelector,
} from "@/shared/ecs/gen/selectors";
import type { ReadonlyHealth } from "@/shared/ecs/gen/components";
import type { ReadonlyEntity } from "@/shared/ecs/gen/entities";
import { anItem } from "@/shared/game/item";
import { ch1ElsewhenSlotAt } from "@/shared/harthmere/ch1_elsewhen_region";
import { isHarthmereBossMusicEncounter } from "@/shared/harthmere/boss_music";
import {
  getHarthmereSoundEffect,
  HARTHMERE_UNDERWATER_AMBIENCE_SOUND_ID,
} from "@/shared/harthmere/sound_effect_manifest";
import { HARTHMERE_EXTENSION_WORLD_BOUNDS } from "@/shared/harthmere/world_extension";
import type { BiomesId } from "@/shared/ids";
import { dist } from "@/shared/math/linear";
import { clamp, sample } from "lodash";

export const SOUND_REF = 4; // distance around the source where the volume is max
export const SOUND_DISTANCE = 20; // distance from ref to 0 volume
export const SOUND_DEADZONE = 32; // distance beyond that where the youtube player is still around at 0 volume
export const ACTIVE_COMBAT_NPC_SCAN_RADIUS = 64;
export const COMBAT_MUSIC_DAMAGE_GRACE_SECONDS = 8;
const COMBAT_MUSIC_CLOCK_SKEW_SECONDS = 2;
export const ENVIRONMENT_AUDIO_PROBE_INTERVAL_SECONDS = 0.5;
export const ENVIRONMENT_AUDIO_EXIT_GRACE_SECONDS = 1.5;
export const MOUNTAIN_WIND_ENVIRONMENT_LOOP_KEY = "mountain_top_wind";
export const MOUNTAIN_WIND_VOLUME_MULTIPLIER = 0.18;
export const MOUNTAIN_WIND_AUDIO_PATH = sample(
  getAudioAssetPaths("mountain_wind")
) as AudioPath | undefined;

// The Grove is part of the imported original world and retains its original
// Kyle Flynn theme. Keep this X/Z region separate from the Harthmere overworld
// bed so both songs cannot own the background mix at the same time.
export const GROVE_MUSIC_REGION_BOUNDS = {
  minX: 300,
  maxX: 650,
  minZ: -360,
  maxZ: -40,
} as const;

export function isGroveMusicPosition(position: {
  readonly [0]: number;
  readonly [2]: number;
}) {
  return (
    position[0] >= GROVE_MUSIC_REGION_BOUNDS.minX &&
    position[0] <= GROVE_MUSIC_REGION_BOUNDS.maxX &&
    position[2] >= GROVE_MUSIC_REGION_BOUNDS.minZ &&
    position[2] <= GROVE_MUSIC_REGION_BOUNDS.maxZ
  );
}

type CombatHealth = Pick<
  ReadonlyHealth,
  "hp" | "lastDamageAmount" | "lastDamageSource" | "lastDamageTime"
>;

export function healthIndicatesRecentCombatDamage(
  health: CombatHealth | undefined,
  nowSeconds: number,
  expectedAttacker?: BiomesId
) {
  if (
    !health ||
    health.hp <= 0 ||
    health.lastDamageSource?.kind !== "attack" ||
    health.lastDamageTime === undefined ||
    (health.lastDamageAmount ?? 0) >= 0 ||
    (expectedAttacker !== undefined &&
      health.lastDamageSource.attacker !== expectedAttacker)
  ) {
    return false;
  }

  const ageSeconds = nowSeconds - health.lastDamageTime;
  return (
    ageSeconds >= -COMBAT_MUSIC_CLOCK_SKEW_SECONDS &&
    ageSeconds <= COMBAT_MUSIC_DAMAGE_GRACE_SECONDS
  );
}

export function selectBackgroundMusicTrack(
  muckyness: number,
  activeCombat: boolean,
  position?: { readonly [0]: number; readonly [2]: number },
  activeBossCombat = false,
  inCave = false,
  activeMinigame = false
): AudioTrackType {
  // Combat and authored dungeon cues own the soundtrack while active. Cave
  // music replaces ordinary regional exploration beds (including Muck), but
  // not a minigame-owned session.
  if (activeBossCombat) {
    return "boss_battle_music";
  }
  if (activeCombat) {
    return "battle_music";
  }
  if (position) {
    const elsewhenSlot = ch1ElsewhenSlotAt(position);
    if (elsewhenSlot?.dungeonId === "ch1_dungeon_desert") {
      return "ch1_sand_music";
    }
    if (elsewhenSlot?.dungeonId === "ch1_dungeon_winter") {
      return "ch1_winter_music";
    }
  }

  // A minigame may own its own media/music surface. Until minigames expose a
  // dedicated AudioTrackType, preserve the normal regional bed and suppress
  // environmental replacements such as cave music.
  if (!activeMinigame && inCave) {
    return "cave_music";
  }

  if (muckyness > 0) {
    return "muck_music";
  }
  if (!position) {
    return "music";
  }

  if (isGroveMusicPosition(position)) {
    return "grove_music";
  }

  const x = position[0];
  const z = position[2];
  if (
    x >= HARTHMERE_EXTENSION_WORLD_BOUNDS.minX &&
    x < HARTHMERE_EXTENSION_WORLD_BOUNDS.maxX &&
    z >= HARTHMERE_EXTENSION_WORLD_BOUNDS.minZ &&
    z < HARTHMERE_EXTENSION_WORLD_BOUNDS.maxZ
  ) {
    return "harthmere_music";
  }

  return "music";
}

export function shouldPlayMountainWind(input: {
  onMountainTop: boolean;
  inCave: boolean;
  inWater: boolean;
  activeCombat: boolean;
  activeBossCombat: boolean;
  muckyness: number;
  activeMinigame: boolean;
  cutsceneActive: boolean;
}) {
  return (
    input.onMountainTop &&
    !input.inCave &&
    !input.inWater &&
    !input.activeCombat &&
    !input.activeBossCombat &&
    input.muckyness <= 0 &&
    !input.activeMinigame &&
    !input.cutsceneActive
  );
}

export class AudioScript implements Script {
  readonly name = "audio";
  private lastEnvironmentProbeAt = -Infinity;
  private lastEnvironmentProbeCell = "";
  private caveExitGraceUntil = -Infinity;
  private mountainExitGraceUntil = -Infinity;
  private environmentState = { inCave: false, onMountainTop: false };

  constructor(
    private readonly userId: BiomesId,
    private readonly resources: ClientResources,
    private readonly table: ClientTable,
    private readonly audioManager: AudioManager
  ) {}

  private usesBossBattleMusic(entity: ReadonlyEntity | undefined) {
    return entity
      ? isHarthmereBossMusicEncounter({
          entityId: entity.id,
          label: entity.label?.text,
          npcTypeDisplayName: entity.npc_metadata
            ? anItem(entity.npc_metadata.type_id).displayName
            : undefined,
        })
      : false;
  }

  private playerCombatMusicState(
    center: [number, number, number],
    nowSeconds: number
  ) {
    const playerHealth = this.table.get(this.userId)?.health;
    if (playerHealth && playerHealth.hp <= 0) {
      return { activeCombat: false, activeBossCombat: false };
    }
    let activeCombat = false;
    let activeBossCombat = false;
    if (healthIndicatesRecentCombatDamage(playerHealth, nowSeconds)) {
      activeCombat = true;
      if (playerHealth?.lastDamageSource?.kind === "attack") {
        activeBossCombat = this.usesBossBattleMusic(
          this.table.get(playerHealth.lastDamageSource.attacker)
        );
      }
    }

    for (const npc of this.table.scan(
      NpcMetadataSelector.query.spatial.inSphere(
        { center, radius: ACTIVE_COMBAT_NPC_SCAN_RADIUS },
        { approx: true }
      )
    )) {
      const engaged =
        (npc.health?.hp ?? 0) > 0 &&
        (npc.npc_combat_state?.attack_target === this.userId ||
          healthIndicatesRecentCombatDamage(
            npc.health,
            nowSeconds,
            this.userId
          ));
      if (engaged) {
        activeCombat = true;
        activeBossCombat ||= this.usesBossBattleMusic(npc);
      }
    }
    return { activeCombat, activeBossCombat };
  }

  private activeMinigame() {
    try {
      return Boolean(
        this.resources.get("/ecs/c/playing_minigame", this.userId)
      );
    } catch {
      return false;
    }
  }

  private environmentAudioState(
    position: readonly [number, number, number],
    nowSeconds: number
  ) {
    const cell = `${Math.floor(position[0])}|${Math.floor(
      position[1]
    )}|${Math.floor(position[2])}`;
    if (
      cell === this.lastEnvironmentProbeCell &&
      nowSeconds - this.lastEnvironmentProbeAt <
        ENVIRONMENT_AUDIO_PROBE_INTERVAL_SECONDS
    ) {
      return this.environmentState;
    }
    this.lastEnvironmentProbeAt = nowSeconds;
    this.lastEnvironmentProbeCell = cell;

    const detectedCave = isCaveAudioEnvironment(this.resources, position);
    const detectedMountainTop = isMountainTopAudioEnvironment(
      this.resources,
      position,
      detectedCave
    );
    if (detectedCave) {
      this.caveExitGraceUntil =
        nowSeconds + ENVIRONMENT_AUDIO_EXIT_GRACE_SECONDS;
    }
    if (detectedMountainTop) {
      this.mountainExitGraceUntil =
        nowSeconds + ENVIRONMENT_AUDIO_EXIT_GRACE_SECONDS;
    }
    const inCave = detectedCave || nowSeconds < this.caveExitGraceUntil;
    this.environmentState = {
      inCave,
      onMountainTop:
        !inCave &&
        (detectedMountainTop || nowSeconds < this.mountainExitGraceUntil),
    };
    return this.environmentState;
  }

  tick(_dt: number) {
    const cameraPos = this.resources.get("/scene/camera").pos();
    const nowSeconds = this.resources.get("/clock").time;
    const playerPos =
      this.resources.get("/ecs/c/position", this.userId)?.v ?? cameraPos;

    const audioSources = [
      ...this.table.scan(
        AudioSourceSelector.query.spatial.inSphere(
          {
            center: cameraPos,
            radius: SOUND_REF + SOUND_DISTANCE + SOUND_DEADZONE,
          },
          {
            approx: true,
          }
        )
      ),
    ]
      .filter(
        (entity) =>
          !!entity.video_component.video_url && !entity.video_component.muted
      )
      .map((entity) => ({
        entity,
        distance: dist(entity.position.v, cameraPos),
      }))
      .sort((a, b) => a.distance - b.distance);

    const closestSource = audioSources?.[0];

    const maxVolume = this.audioManager.getVolume("settings.volume.media");
    const calculateVolume = (dist: number) =>
      clamp(
        ((SOUND_REF + SOUND_DISTANCE - dist) / SOUND_DISTANCE) * maxVolume,
        0,
        maxVolume
      );

    const { inWater, muckyness } = this.resources.get("/camera/environment");
    // Cutscene music override wins over combat, Muck, and regional exploration
    // for the duration of the scene.
    const cutscene = this.resources.get("/scene/cutscene");
    const combatMusicState = this.playerCombatMusicState(
      [...playerPos],
      nowSeconds
    );
    const activeMinigame = this.activeMinigame();
    const environment = this.environmentAudioState([...playerPos], nowSeconds);
    const currentMuckyness = muckyness.get();
    const backgroundMusicOverride =
      this.audioManager.getBackgroundMusicOverride();
    const selectedBackgroundMusic =
      cutscene.active && cutscene.musicOverride
        ? (cutscene.musicOverride as AudioTrackType)
        : (backgroundMusicOverride ??
          selectBackgroundMusicTrack(
            currentMuckyness,
            combatMusicState.activeCombat,
            playerPos,
            combatMusicState.activeBossCombat,
            environment.inCave,
            activeMinigame
          ));
    this.audioManager.setBackgroundMusicTrack(selectedBackgroundMusic);

    this.audioManager.setEnvironmentLoop(
      MOUNTAIN_WIND_ENVIRONMENT_LOOP_KEY,
      shouldPlayMountainWind({
        onMountainTop: environment.onMountainTop,
        inCave: environment.inCave,
        inWater,
        activeCombat: combatMusicState.activeCombat,
        activeBossCombat: combatMusicState.activeBossCombat,
        muckyness: currentMuckyness,
        activeMinigame,
        cutsceneActive: cutscene.active,
      }),
      MOUNTAIN_WIND_AUDIO_PATH,
      { volumeMultiplier: MOUNTAIN_WIND_VOLUME_MULTIPLIER }
    );

    if (closestSource) {
      const volume = calculateVolume(closestSource.distance);
      this.audioManager.setBackgroundMusicAttenuation(
        maxVolume > 0 ? (3.0 * volume) / maxVolume : 0
      );
    } else {
      this.audioManager.setBackgroundMusicAttenuation(0);
    }

    if (inWater) {
      this.audioManager.setBackgroundMusicEffect("water");
    } else {
      this.audioManager.setBackgroundMusicEffect("none");
    }
    const underwaterAmbience = getHarthmereSoundEffect(
      HARTHMERE_UNDERWATER_AMBIENCE_SOUND_ID
    );
    this.audioManager.setUnderwaterEnvironment(
      inWater,
      underwaterAmbience?.path as AudioPath | undefined
    );
  }
}
