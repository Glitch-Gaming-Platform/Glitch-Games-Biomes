import { HARTHMERE_CRAFT_COMPLETED_EVENT } from "@/client/components/challenges/harthmereEvents";
import type { GardenHose } from "@/client/events/api";
import type { AudioManager } from "@/client/game/context_managers/audio_manager";
import type { ClientTable } from "@/client/game/game";
import type { AudioPath } from "@/client/game/resources/audio";
import type { Script } from "@/client/game/scripts/script_controller";
import { changedBiomesId, type ReadonlyChanges } from "@/shared/ecs/change";
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

interface HarthmereWorldObjectInteractionEventDetail {
  label?: string | null;
  kind: string;
}

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

  private readonly onSoundEffect = (event: Event) => {
    const detail = (event as CustomEvent<HarthmereSoundEffectEventDetail>)
      .detail;
    this.play(detail?.id, detail?.position, detail?.idempotent);
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
  }

  private play(
    id: string | undefined,
    position?: readonly number[],
    idempotent = false
  ) {
    const definition = getHarthmereSoundEffect(id);
    if (!definition) return;
    if (position && position.length >= 3) {
      this.audioManager.playPathAt(definition.path as AudioPath, position);
      return;
    }
    this.audioManager.playPath(definition.path as AudioPath, { idempotent });
  }

  tick() {}

  clear() {
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
  }
}
