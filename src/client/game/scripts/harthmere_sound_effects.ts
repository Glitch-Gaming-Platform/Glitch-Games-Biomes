import { HARTHMERE_CRAFT_COMPLETED_EVENT } from "@/client/components/challenges/harthmereEvents";
import type { GardenHose } from "@/client/events/api";
import type {
  AudioManager,
  PathSpatialAudioOptions,
} from "@/client/game/context_managers/audio_manager";
import type { ClientTable } from "@/client/game/game";
import type { AudioPath } from "@/client/game/resources/audio";
import type { Script } from "@/client/game/scripts/script_controller";
import { changedBiomesId, type ReadonlyChanges } from "@/shared/ecs/change";
import {
  HARTHMERE_MELEE_HIT_SOUND_DURATION_SECONDS,
  harthmereMeleeHitItem,
  harthmereMeleeHitSoundIdForItem,
  isHarthmereMeleeHitSoundItem,
} from "@/shared/harthmere/melee_hit_sound";
import {
  getHarthmereSoundEffect,
  HARTHMERE_OBJECT_INTERACTION_SOUND_MAP,
  HARTHMERE_SOUND_EFFECT_EVENT,
  type HarthmereSoundEffectEventDetail,
} from "@/shared/harthmere/sound_effect_manifest";
import { deserializeNpcCustomState } from "@/shared/npc/serde";

const HARTHMERE_WORLD_OBJECT_INTERACTION_EVENT =
  "biomes:harthmere-world-object-interaction" as const;
const HARTHMERE_COMBAT_EFFECT_EVENT = "biomes:harthmere-combat-effect" as const;
const HARTHMERE_PLAYER_STATUS_EVENT =
  "biomes:live-mode-player-status-updated" as const;
const HARTHMERE_CONFIRMED_MELEE_SOUND_FRESHNESS_SECONDS = 8;
const HARTHMERE_PENDING_SOUND_MAX_AGE_MS = 5_000;
const HARTHMERE_PENDING_SOUND_LIMIT = 64;
const HARTHMERE_SOUND_EFFECT_RUNTIME_VERSION =
  "harthmere-sound-effects-replicated-hit-runtime-v3" as const;

interface HarthmereWorldObjectInteractionEventDetail {
  label?: string | null;
  kind: string;
}

interface HarthmereSoundEffectsDebugState {
  version: typeof HARTHMERE_SOUND_EFFECT_RUNTIME_VERSION;
  receivedEventCount: number;
  requestedPlayCount: number;
  requestedPositionalPlayCount: number;
  requestedPreloadCount: number;
  confirmedMeleeHitCount: number;
  missingDefinitionCount: number;
  pendingRequestCount: number;
  droppedPendingRequestCount: number;
  lastRequestedId?: string;
  lastConfirmedMeleeTargetId?: number;
}

type PendingHarthmereSoundRequest =
  | {
      kind: "play";
      id: string | undefined;
      position?: readonly number[];
      idempotent: boolean;
      spatialOptions: PathSpatialAudioOptions;
      queuedAtMs: number;
    }
  | {
      kind: "preload";
      id: string | undefined;
      queuedAtMs: number;
    };

function combatEffectSoundId(detail: Record<string, unknown>) {
  const text = `${String(detail.ability ?? "")} ${String(
    detail.action ?? ""
  )} ${String(detail.attack ?? "")} ${String(
    detail.result ?? ""
  )}`.toLowerCase();
  if (/critical/.test(text)) return "critical_hit";
  if (/guard.?break/.test(text)) return "guard_break";
  if (/parry|riposte/.test(text)) return "parry";
  if (/shield bash/.test(text)) return "shield_bash";
  if (/shield|block/.test(text)) return "shield_block";
  if (/backstab/.test(text)) return "backstab";
  if (/poison/.test(text)) return "poison_blade";
  if (/whirlwind/.test(text)) return "whirlwind_slash";
  if (/cleave/.test(text)) return "cleave";
  if (/taunt/.test(text)) return "taunt";
  if (/pounce/.test(text)) return "animal_pounce";
  if (/tail/.test(text)) return "animal_tail_whip";
  if (/peck/.test(text)) return "animal_peck";
  if (/kick/.test(text)) return "animal_kick";
  if (/charge/.test(text)) return "animal_charge";
  if (/claw/.test(text)) return "animal_claw";
  if (/scratch/.test(text)) return "animal_scratch";
  if (/bite/.test(text)) return "animal_bite";
  return undefined;
}

function objectInteractionSoundId(
  detail: HarthmereWorldObjectInteractionEventDetail
) {
  const label = String(detail.label ?? "").toLowerCase();
  if (detail.kind === "open_container") {
    if (/lockbox|strongbox|metal|iron|steel|safe/.test(label)) {
      return "open_container_metal";
    }
    if (/satchel|bag|mailbag|toolbag|cloth/.test(label)) {
      return "open_container_cloth";
    }
  }
  if (detail.kind === "repair") {
    if (/stone|masonry|brick|wall|road/.test(label)) return "repair_stone";
    if (/metal|iron|steel|machine|robot|mechan/.test(label)) {
      return "repair_metal";
    }
  }
  return HARTHMERE_OBJECT_INTERACTION_SOUND_MAP[detail.kind];
}

export class HarthmereSoundEffectsScript implements Script {
  readonly name = "harthmereSoundEffects";
  private lastDeathState: string | undefined;
  private lastHp: number | undefined;
  private readonly plantStatuses = new Map<number, string>();
  private readonly energyEffectMarkers = new Map<number, string>();
  private readonly lastMeleeDamageTimes = new Map<number, number>();
  private readonly pendingRequests: PendingHarthmereSoundRequest[] = [];
  private readonly debugState: HarthmereSoundEffectsDebugState = {
    version: HARTHMERE_SOUND_EFFECT_RUNTIME_VERSION,
    receivedEventCount: 0,
    requestedPlayCount: 0,
    requestedPositionalPlayCount: 0,
    requestedPreloadCount: 0,
    confirmedMeleeHitCount: 0,
    missingDefinitionCount: 0,
    pendingRequestCount: 0,
    droppedPendingRequestCount: 0,
  };

  private readonly onSoundEffect = (event: Event) => {
    const detail = (event as CustomEvent<HarthmereSoundEffectEventDetail>)
      .detail;
    this.debugState.receivedEventCount += 1;
    if (detail?.preloadOnly) {
      this.preload(detail.id);
      return;
    }
    this.play(detail?.id, detail?.position, detail?.idempotent, {
      durationSeconds: detail?.durationSeconds,
      fadeOutSeconds: detail?.fadeOutSeconds,
      volumeMultiplier: detail?.volumeMultiplier,
      refDistance: detail?.refDistance,
      maxDistance: detail?.maxDistance,
      rolloffFactor: detail?.rolloffFactor,
    });
  };

  private readonly onWorldObjectInteraction = (event: Event) => {
    const detail = (
      event as CustomEvent<HarthmereWorldObjectInteractionEventDetail>
    ).detail;
    if (!detail) return;
    this.play(objectInteractionSoundId(detail));
  };

  private readonly onCraftCompleted = () => {
    // Reuse the existing Biomes crafting cue rather than generating a duplicate.
    this.play("craft_success");
  };

  private readonly onCombatEffect = (event: Event) => {
    const detail = (event as CustomEvent<Record<string, unknown>>).detail;
    if (!detail) return;
    this.play(combatEffectSoundId(detail));
  };

  private readonly onPlayerStatus = (event: Event) => {
    const detail = (
      event as CustomEvent<{
        combat?: { deathState?: string; hp?: number };
      }>
    ).detail;
    const next = String(detail?.combat?.deathState ?? "").toLowerCase();
    const nextHp = Number(detail?.combat?.hp);
    if (
      Number.isFinite(nextHp) &&
      this.lastHp !== undefined &&
      nextHp < this.lastHp &&
      !["downed", "dead"].includes(next)
    ) {
      this.play("armor_hit");
    }
    if (Number.isFinite(nextHp)) this.lastHp = nextHp;
    if (!next || next === this.lastDeathState) return;
    const previous = this.lastDeathState;
    this.lastDeathState = next;
    if (next === "downed") {
      this.play("player_downed");
    } else if (next === "dead") {
      this.play("player_death");
    } else if (
      previous &&
      ["downed", "dead", "respawning"].includes(previous) &&
      !["downed", "dead", "respawning"].includes(next)
    ) {
      this.play("player_revive");
    }
  };

  private readonly onEquip = (event: {
    operation?: "equip" | "unequip";
    slot?: string;
  }) => {
    if (!/hand|weapon/.test(String(event.slot ?? "").toLowerCase())) return;
    this.play(
      event.operation === "unequip" ? "weapon_unequip" : "weapon_equip"
    );
  };

  private readonly onTableChanges = (changes: ReadonlyChanges) => {
    for (const change of changes) {
      const id = changedBiomesId(change);
      const entity = this.table.get(id);
      const damageTime = entity?.health?.lastDamageTime;
      const previousDamageTime = this.lastMeleeDamageTimes.get(id);
      if (damageTime === undefined) {
        this.lastMeleeDamageTimes.delete(id);
      } else if (damageTime !== previousDamageTime) {
        this.lastMeleeDamageTimes.set(id, damageTime);
        const damageSource = entity?.health?.lastDamageSource;
        const attackerId =
          damageSource?.kind === "attack" ? damageSource.attacker : undefined;
        const attacker =
          attackerId === undefined ? undefined : this.table.get(attackerId);
        const attackItem = harthmereMeleeHitItem(
          attacker?.emote,
          attacker?.selected_item?.item?.item
        );
        const recentEnough =
          Math.abs(Date.now() / 1000 - damageTime) <=
          HARTHMERE_CONFIRMED_MELEE_SOUND_FRESHNESS_SECONDS;
        if (
          recentEnough &&
          damageSource?.kind === "attack" &&
          Boolean(attacker?.player_status) &&
          isHarthmereMeleeHitSoundItem(attackItem)
        ) {
          this.debugState.confirmedMeleeHitCount += 1;
          this.debugState.lastConfirmedMeleeTargetId = Number(id);
          this.play(
            harthmereMeleeHitSoundIdForItem(attackItem),
            entity?.position?.v,
            false,
            {
              durationSeconds: HARTHMERE_MELEE_HIT_SOUND_DURATION_SECONDS,
              refDistance: 3,
              maxDistance: 48,
              rolloffFactor: 0.85,
            }
          );
        }
      }
      const npcStateData = entity?.npc_state?.data;
      if (npcStateData?.length) {
        const effect =
          deserializeNpcCustomState(npcStateData).energyWeapon?.lastEffect;
        if (effect) {
          const marker = `${effect.id}:${effect.atMs}`;
          const previousMarker = this.energyEffectMarkers.get(id);
          this.energyEffectMarkers.set(id, marker);
          if (
            marker !== previousMarker &&
            Math.abs(Date.now() - effect.atMs) <= 5_000
          ) {
            this.play(effect.id, entity?.position?.v);
          }
        }
      }
      const next = entity?.farming_plant_component?.status;
      const previous = this.plantStatuses.get(id);
      if (!next) {
        this.plantStatuses.delete(id);
        continue;
      }
      this.plantStatuses.set(id, next);
      if (!previous || previous === next) continue;
      const position = entity?.position?.v;
      if (next === "fully_grown") {
        this.play("crop_ready", position);
      } else if (next === "dead") {
        this.play("crop_failed", position);
      }
    }
  };

  constructor(
    private readonly audioManager: AudioManager,
    private readonly gardenHose: GardenHose,
    private readonly table: ClientTable
  ) {
    for (const entity of table.contents()) {
      const status = entity.farming_plant_component?.status;
      if (status) this.plantStatuses.set(entity.id, status);
      const damageTime = entity.health?.lastDamageTime;
      if (damageTime !== undefined) {
        this.lastMeleeDamageTimes.set(entity.id, damageTime);
      }
      const npcStateData = entity.npc_state?.data;
      if (npcStateData?.length) {
        const effect =
          deserializeNpcCustomState(npcStateData).energyWeapon?.lastEffect;
        if (effect) {
          this.energyEffectMarkers.set(
            entity.id,
            `${effect.id}:${effect.atMs}`
          );
        }
      }
    }
    this.table.events.on("postApply", this.onTableChanges);
    if (typeof window === "undefined") return;
    window.addEventListener(HARTHMERE_SOUND_EFFECT_EVENT, this.onSoundEffect);
    window.addEventListener(
      HARTHMERE_WORLD_OBJECT_INTERACTION_EVENT,
      this.onWorldObjectInteraction
    );
    window.addEventListener(
      HARTHMERE_CRAFT_COMPLETED_EVENT,
      this.onCraftCompleted
    );
    window.addEventListener(HARTHMERE_COMBAT_EFFECT_EVENT, this.onCombatEffect);
    window.addEventListener(HARTHMERE_PLAYER_STATUS_EVENT, this.onPlayerStatus);
    this.gardenHose.on("equip", this.onEquip);
    this.publishDebug();
  }

  private play(
    id: string | undefined,
    position?: readonly number[],
    idempotent = false,
    spatialOptions: PathSpatialAudioOptions = {}
  ) {
    if (!this.audioIsRunning()) {
      this.queuePendingRequest({
        kind: "play",
        id,
        position,
        idempotent,
        spatialOptions,
        queuedAtMs: Date.now(),
      });
      return;
    }
    const definition = getHarthmereSoundEffect(id);
    if (!definition) {
      this.debugState.missingDefinitionCount += 1;
      this.publishDebug();
      return;
    }
    this.debugState.requestedPlayCount += 1;
    this.debugState.lastRequestedId = definition.id;
    if (position && position.length >= 3) {
      this.debugState.requestedPositionalPlayCount += 1;
      this.audioManager.playPathAt(
        definition.path as AudioPath,
        position,
        spatialOptions
      );
      this.publishDebug();
      return;
    }
    this.audioManager.playPath(definition.path as AudioPath, { idempotent });
    this.publishDebug();
  }

  private preload(id: string | undefined) {
    if (!this.audioIsRunning()) {
      this.queuePendingRequest({
        kind: "preload",
        id,
        queuedAtMs: Date.now(),
      });
      return;
    }
    const definition = getHarthmereSoundEffect(id);
    if (!definition) {
      this.debugState.missingDefinitionCount += 1;
      this.publishDebug();
      return;
    }
    this.debugState.requestedPreloadCount += 1;
    this.debugState.lastRequestedId = definition.id;
    this.audioManager.preloadPath(definition.path as AudioPath);
    this.publishDebug();
  }

  private audioIsRunning() {
    const isRunning = (
      this.audioManager as AudioManager & {
        isRunning?: () => unknown;
      }
    ).isRunning;
    // Lightweight test doubles predate AudioManager.isRunning(). Treat them as
    // ready so focused routing tests keep exercising the actual play call.
    return (
      typeof isRunning !== "function" ||
      Boolean(isRunning.call(this.audioManager))
    );
  }

  private queuePendingRequest(request: PendingHarthmereSoundRequest) {
    if (
      request.kind === "play" &&
      request.idempotent &&
      this.pendingRequests.some(
        (pending) => pending.kind === "play" && pending.id === request.id
      )
    ) {
      return;
    }
    if (this.pendingRequests.length >= HARTHMERE_PENDING_SOUND_LIMIT) {
      this.pendingRequests.shift();
      this.debugState.droppedPendingRequestCount += 1;
    }
    this.pendingRequests.push(request);
    this.debugState.pendingRequestCount = this.pendingRequests.length;
    this.publishDebug();
  }

  private flushPendingRequests() {
    if (!this.audioIsRunning() || this.pendingRequests.length === 0) return;
    const now = Date.now();
    const requests = this.pendingRequests.splice(0);
    this.debugState.pendingRequestCount = 0;
    for (const request of requests) {
      if (now - request.queuedAtMs > HARTHMERE_PENDING_SOUND_MAX_AGE_MS) {
        this.debugState.droppedPendingRequestCount += 1;
        continue;
      }
      if (request.kind === "preload") {
        this.preload(request.id);
      } else {
        this.play(
          request.id,
          request.position,
          request.idempotent,
          request.spatialOptions
        );
      }
    }
    this.publishDebug();
  }

  private publishDebug() {
    if (typeof window === "undefined") return;
    (
      window as typeof window & {
        __harthmereSoundEffectsDebug?: HarthmereSoundEffectsDebugState;
      }
    ).__harthmereSoundEffectsDebug = { ...this.debugState };
  }

  tick() {
    this.flushPendingRequests();
  }

  clear() {
    this.pendingRequests.length = 0;
    this.debugState.pendingRequestCount = 0;
    this.table.events.off("postApply", this.onTableChanges);
    if (typeof window === "undefined") return;
    window.removeEventListener(
      HARTHMERE_SOUND_EFFECT_EVENT,
      this.onSoundEffect
    );
    window.removeEventListener(
      HARTHMERE_WORLD_OBJECT_INTERACTION_EVENT,
      this.onWorldObjectInteraction
    );
    window.removeEventListener(
      HARTHMERE_CRAFT_COMPLETED_EVENT,
      this.onCraftCompleted
    );
    window.removeEventListener(
      HARTHMERE_COMBAT_EFFECT_EVENT,
      this.onCombatEffect
    );
    window.removeEventListener(
      HARTHMERE_PLAYER_STATUS_EVENT,
      this.onPlayerStatus
    );
    this.gardenHose.off("equip", this.onEquip);
    delete (
      window as typeof window & {
        __harthmereSoundEffectsDebug?: HarthmereSoundEffectsDebugState;
      }
    ).__harthmereSoundEffectsDebug;
  }
}
