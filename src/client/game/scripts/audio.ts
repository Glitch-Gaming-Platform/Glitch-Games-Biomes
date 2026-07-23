import type {
  AudioManager,
  AudioTrackType,
} from "@/client/game/context_managers/audio_manager";
import type { ClientTable } from "@/client/game/game";
import type { ClientResources } from "@/client/game/resources/types";
import type { Script } from "@/client/game/scripts/script_controller";
import {
  AudioSourceSelector,
  NpcMetadataSelector,
} from "@/shared/ecs/gen/selectors";
import type { ReadonlyHealth } from "@/shared/ecs/gen/components";
import type { BiomesId } from "@/shared/ids";
import { dist } from "@/shared/math/linear";
import { deserializeNpcCustomState } from "@/shared/npc/serde";
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

export function combatTargetFromNpcStateData(
  data: Uint8Array
): BiomesId | undefined {
  try {
    return deserializeNpcCustomState(data, {
      propagateParseError: true,
    }).chaseAttack?.attackTarget;
  } catch {
    // A malformed or newer NPC state should not break the audio render loop.
    return undefined;
  }
}

export function selectBackgroundMusicTrack(
  muckyness: number,
  activeCombat: boolean
): AudioTrackType {
  if (activeCombat) {
    return "battle_music";
  }
  return muckyness > 0 ? "muck_music" : "music";
}

export class AudioScript implements Script {
  readonly name = "audio";
  private readonly npcCombatTargetCache = new WeakMap<
    Uint8Array,
    BiomesId | null
  >();

  constructor(
    private readonly userId: BiomesId,
    private readonly resources: ClientResources,
    private readonly table: ClientTable,
    private readonly audioManager: AudioManager
  ) {}

  private cachedNpcCombatTarget(data: Uint8Array) {
    const cached = this.npcCombatTargetCache.get(data);
    if (cached !== undefined) {
      return cached ?? undefined;
    }
    const target = combatTargetFromNpcStateData(data);
    this.npcCombatTargetCache.set(data, target ?? null);
    return target;
  }

  private isPlayerInActiveCombat(
    center: [number, number, number],
    nowSeconds: number
  ) {
    const playerHealth = this.table.get(this.userId)?.health;
    if (playerHealth && playerHealth.hp <= 0) {
      return false;
    }
    if (healthIndicatesRecentCombatDamage(playerHealth, nowSeconds)) {
      return true;
    }

    for (const npc of this.table.scan(
      NpcMetadataSelector.query.spatial.inSphere(
        { center, radius: ACTIVE_COMBAT_NPC_SCAN_RADIUS },
        { approx: true }
      )
    )) {
      if (
        (npc.health?.hp ?? 0) > 0 &&
        ((npc.npc_state?.data &&
          this.cachedNpcCombatTarget(npc.npc_state.data) === this.userId) ||
          healthIndicatesRecentCombatDamage(
            npc.health,
            nowSeconds,
            this.userId
          ))
      ) {
        return true;
      }
    }
    return false;
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
    this.audioManager.setBackgroundMusicTrack(
      selectBackgroundMusicTrack(
        muckyness.get(),
        this.isPlayerInActiveCombat([...playerPos], nowSeconds)
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
  }
}
