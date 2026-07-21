import { makeEventHandler } from "@/server/logic/events/core";
import { q } from "@/server/logic/events/query";
import { PlayerInventoryEditor } from "@/server/logic/inventory/player_inventory_editor";
import { decrementItemDurability } from "@/server/logic/utils/durability";
import {
  modifyPlayerHealth,
  setPlayerHealth,
  setPlayerMaxHealth,
} from "@/server/logic/utils/players";
import { BikkieIds } from "@/shared/bikkie/ids";
import { getAabbForEntity } from "@/shared/game/entity_sizes";
import { attackIntervalSeconds } from "@/shared/game/damage";
import { distSqToAABB } from "@/shared/math/linear";
import {
  harthmereNativeItemCombatProfile,
  harthmereNativeItemDefinitionForBiomesId,
  mitigateHarthmereNativeIncomingDamage,
  nativeCombatArmorStats,
  readHarthmereNativeCombatProgression,
  writeHarthmereNativeCombatProgression,
} from "@/shared/harthmere/harthmere_native_combat";
import { harthmereNativeNpcCombatProfileForTypeId } from "@/shared/harthmere/harthmere_native_combat_catalog";
import { log } from "@/shared/logging";
import {
  readHarthmereNativeVitals,
  writeHarthmereNativeVitals,
} from "@/shared/harthmere/harthmere_native_vitals";

export const playerInitEventHandler = makeEventHandler("playerInitEvent", {
  mergeKey: (event) => event.id,
  involves: (event) => ({
    player: event.id,
  }),
  apply: ({ player }, _event, context) => {
    if (player.playerStatus()?.init) {
      return;
    }
    player.mutablePlayerStatus().init = true;

    const inventory = new PlayerInventoryEditor(context, player);
    inventory.giveCurrency(BikkieIds.bling, 10n);
  },
});

export const playerSetNUXStatusEventHandler = makeEventHandler(
  "setNUXStatusEvent",
  {
    involves: (event) => ({
      player: q.includeIced(event.id),
    }),
    apply: ({ player }, event) => {
      player.mutablePlayerStatus().nux_status.set(event.nux_id, {
        ...event.status,
      });
    },
  }
);

export const updatePlayerHealthEventHandler = makeEventHandler(
  "updatePlayerHealthEvent",
  {
    prepareInvolves: (event) => ({
      player: q.id(event.id),
    }),
    prepare: ({ player }) => ({
      activeMinigameInstanceId: player.playing_minigame?.minigame_instance_id,
      activeMinigameId: player.playing_minigame?.minigame_id,
    }),
    mergeKey: (event) => event.id,
    involves: (event, { activeMinigameInstanceId, activeMinigameId }) => ({
      player: event.id,
      playerActiveMinigameInstance:
        activeMinigameInstanceId &&
        q.id(activeMinigameInstanceId).with("minigame_instance").includeIced(),
      playerActiveMinigame:
        activeMinigameId &&
        q.id(activeMinigameId).with("minigame_component").includeIced(),
      attacker:
        event.damageSource?.kind === "attack"
          ? q.id(event.damageSource.attacker)
          : undefined,
    }),
    apply: (
      { attacker, player, playerActiveMinigame, playerActiveMinigameInstance },
      event,
      context
    ) => {
      let authoritativeHp = event.hp;
      let authoritativeHpDelta = event.hpDelta;
      if (event.damageSource?.kind === "attack") {
        const health = attacker?.health();
        if (health !== undefined && health.hp <= 0) {
          // You cannot attack if you're dead.
          return;
        }

        const npcTypeId = attacker?.npcMetadata()?.type_id;
        const nativeProfile = npcTypeId
          ? harthmereNativeNpcCombatProfileForTypeId(npcTypeId)
          : undefined;
        if (nativeProfile) {
          if (nativeProfile.attackDamage <= 0) return;
          const attackerPosition = attacker?.position()?.v;
          const playerAabb = getAabbForEntity(player.asReadonlyEntity());
          if (
            !attackerPosition ||
            !playerAabb ||
            distSqToAABB(attackerPosition, playerAabb) >
              nativeProfile.attackDistance * nativeProfile.attackDistance
          ) {
            log.debug("Rejected out-of-range native NPC damage", {
              attackerId: attacker?.id,
              playerId: player.id,
              attackDistance: nativeProfile.attackDistance,
            });
            return;
          }

          const worn = [...(player.wearing()?.items.values() ?? [])];
          const armor = nativeCombatArmorStats(worn);
          const defender = readHarthmereNativeCombatProgression(
            player.triggerState()
          );
          const damage = mitigateHarthmereNativeIncomingDamage({
            rawDamage: nativeProfile.attackDamage,
            armor: armor.armor,
            defense: armor.defense,
            evasion: armor.evasion,
            attackerLevel: nativeProfile.level,
            defenderLevel: defender.level,
          });
          authoritativeHp = undefined;
          authoritativeHpDelta = -damage;

          // Armor durability is consumed in the same event transaction as the
          // accepted hit. Rejected/out-of-range packets cannot wear equipment.
          const inventory = new PlayerInventoryEditor(context, player);
          for (const [slot, item] of player.wearing()?.items ?? []) {
            const profile = harthmereNativeItemCombatProfile(item);
            if (
              profile &&
              profile.armor + profile.defense + profile.evasion > 0 &&
              profile.durabilityCostMs > 0
            ) {
              decrementItemDurability(
                inventory,
                { kind: "wearable", key: slot },
                profile.durabilityCostMs
              );
            }
          }
        } else if (attacker?.playerStatus()) {
          const attackerProgress = readHarthmereNativeCombatProgression(
            attacker.triggerState()
          );
          const attackerInventory = new PlayerInventoryEditor(
            context,
            attacker
          );
          const selectedRef = attackerInventory.inventory().selected;
          const selected = attackerInventory.get(selectedRef);
          const definition = harthmereNativeItemDefinitionForBiomesId(
            selected?.item.id
          );
          const usesNativeCombat =
            attackerProgress.migrationVersion > 0 || definition !== undefined;
          if (usesNativeCombat) {
            const itemProfile = harthmereNativeItemCombatProfile(
              selected?.item
            );
            if (!itemProfile || (definition && itemProfile.damagePerHit <= 0)) {
              return;
            }
            if (attackerProgress.level < itemProfile.levelRequirement) {
              return;
            }
            const attackerVitals = readHarthmereNativeVitals(
              attacker.triggerState()
            );
            if (itemProfile.manaCost > attackerVitals.mana) {
              return;
            }
            const attackerPosition = attacker.position()?.v;
            const playerAabb = getAabbForEntity(player.asReadonlyEntity());
            if (
              !attackerPosition ||
              !playerAabb ||
              distSqToAABB(attackerPosition, playerAabb) >
                itemProfile.reach * itemProfile.reach
            ) {
              return;
            }
            const nowMs = Date.now();
            const intervalMs = Math.round(
              1000 *
                (itemProfile.intervalSecs ??
                  attackIntervalSeconds(selected?.item))
            );
            if (nowMs - attackerProgress.lastAttackMs < intervalMs) {
              return;
            }
            writeHarthmereNativeCombatProgression(
              attacker.mutableTriggerState(),
              { lastAttackMs: nowMs }
            );
            if (itemProfile.manaCost > 0) {
              writeHarthmereNativeVitals(attacker.mutableTriggerState(), {
                mana: attackerVitals.mana - itemProfile.manaCost,
              });
            }

            const worn = [...(player.wearing()?.items.values() ?? [])];
            const armor = nativeCombatArmorStats(worn);
            const defender = readHarthmereNativeCombatProgression(
              player.triggerState()
            );
            const damage = mitigateHarthmereNativeIncomingDamage({
              rawDamage: itemProfile.damagePerHit,
              armor: armor.armor,
              defense: armor.defense,
              evasion: armor.evasion,
              attackerLevel: attackerProgress.level,
              defenderLevel: defender.level,
            });
            authoritativeHp = undefined;
            authoritativeHpDelta = -damage;
            if (selected && itemProfile.durabilityCostMs > 0) {
              decrementItemDurability(
                attackerInventory,
                selectedRef,
                itemProfile.durabilityCostMs
              );
            }
          }
        }
      }

      if (authoritativeHp !== undefined) {
        setPlayerHealth(
          player,
          authoritativeHp,
          event.damageSource,
          playerActiveMinigame,
          playerActiveMinigameInstance,
          context
        );
      } else if (authoritativeHpDelta !== undefined) {
        modifyPlayerHealth(
          player,
          authoritativeHpDelta,
          event.damageSource,
          playerActiveMinigame,
          playerActiveMinigameInstance,
          context
        );
      }
      if (event.maxHp !== undefined) {
        setPlayerMaxHealth(player, event.maxHp);
      }
    },
  }
);
