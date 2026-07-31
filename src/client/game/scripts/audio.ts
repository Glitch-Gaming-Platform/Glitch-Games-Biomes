import type {
  AudioManager,
  AudioTrackType,
} from "@/client/game/context_managers/audio_manager";
import type { ClientTable } from "@/client/game/game";
import type { AudioPath } from "@/client/game/resources/audio";
import type { ClientResources } from "@/client/game/resources/types";
import type { Script } from "@/client/game/scripts/script_controller";
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
import { clamp } from "lodash";

export const SOUND_REF = 4; // distance around the source where the volume is max
export const SOUND_DISTANCE = 20; // distance from ref to 0 volume
export const SOUND_DEADZONE = 32; // distance beyond that where the youtube player is still around at 0 volume
export const ACTIVE_COMBAT_NPC_SCAN_RADIUS = 64;
export const COMBAT_MUSIC_DAMAGE_GRACE_SECONDS = 8;
const COMBAT_MUSIC_CLOCK_SKEW_SECONDS = 2;

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
  activeBossCombat = false
): AudioTrackType {
  // Regional cues replace only ordinary exploration music. Combat and Muck
  // preserve their existing priority and restore the current region on exit.
  if (activeBossCombat) {
    return "boss_battle_music";
  }
  if (activeCombat) {
    return "battle_music";
  }
  if (muckyness > 0) {
    return "muck_music";
  }
  if (!position) {
    return "music";
  }

  const elsewhenSlot = ch1ElsewhenSlotAt(position);
  if (elsewhenSlot?.dungeonId === "ch1_dungeon_desert") {
    return "ch1_sand_music";
  }
  if (elsewhenSlot?.dungeonId === "ch1_dungeon_winter") {
    return "ch1_winter_music";
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

export class AudioScript implements Script {
  readonly name = "audio";

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
    this.audioManager.setBackgroundMusicTrack(
      cutscene.active && cutscene.musicOverride
        ? (cutscene.musicOverride as AudioTrackType)
        : selectBackgroundMusicTrack(
            muckyness.get(),
            combatMusicState.activeCombat,
            playerPos,
            combatMusicState.activeBossCombat
          )
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
