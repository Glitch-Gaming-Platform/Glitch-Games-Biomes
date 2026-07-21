import { makeEventHandler, newIds } from "@/server/logic/events/core";
import { PlayerInventoryEditor } from "@/server/logic/inventory/player_inventory_editor";
import { decrementItemDurability } from "@/server/logic/utils/durability";
import { q } from "@/server/logic/events/query";
import {
  MAX_DROPS_FOR_SPEC,
  createDropsForBag,
  rollSpec,
} from "@/server/logic/utils/drops";
import { BikkieIds } from "@/shared/bikkie/ids";
import { secondsSinceEpoch } from "@/shared/ecs/config";
import type * as ecs from "@/shared/ecs/gen/types";
import type { SellToEntityEvent } from "@/shared/firehose/events";
import { resolveItemAttributeId } from "@/shared/game/item";
import { createBag } from "@/shared/game/items";
import { itemBagToString } from "@/shared/game/items_serde";
import { sellPrice } from "@/shared/game/sales";
import { idToNpcType } from "@/shared/npc/bikkie";
import { modifyNpcHealth } from "@/shared/npc/modify_health";
import { getAabbForEntity } from "@/shared/game/entity_sizes";
import { attackIntervalSeconds } from "@/shared/game/damage";
import { distSqToAABB } from "@/shared/math/linear";
import {
  awardHarthmereNativeCombatXp,
  harthmereNativeItemCombatProfile,
  harthmereNativeItemDefinitionForBiomesId,
  readHarthmereNativeCombatProgression,
  writeHarthmereNativeCombatProgression,
} from "@/shared/harthmere/harthmere_native_combat";
import { harthmereNativeNpcCombatProfileForTypeId } from "@/shared/harthmere/harthmere_native_combat_catalog";
import { log } from "@/shared/logging";
import {
  readHarthmereNativeVitals,
  writeHarthmereNativeVitals,
} from "@/shared/harthmere/harthmere_native_vitals";
import { any } from "@/shared/util/helpers";
import { ok } from "assert";
import { HARTHMERE_NATIVE_NPC_MELEE_MAX_CENTER_DISTANCE } from "@/shared/harthmere/combat_reach";
import { harthmereRespawningLiveCreatureSeedIds } from "@/shared/harthmere/live_entity_production_seed";
import { harthmereSharedLiveCreatureRespawnRegistry } from "@/shared/harthmere/live_creature_respawn_registry";

const HARTHMERE_RESPAWNING_CREATURE_IDS = new Set(
  harthmereRespawningLiveCreatureSeedIds()
);

const updateNpcHealthEventHandler = makeEventHandler("updateNpcHealthEvent", {
  involves: (event) => ({
    npc: q
      .id(event.id)
      .with(
        "health",
        "npc_metadata",
        "position",
        "rigid_body",
        "size",
        "npc_state"
      ),
    dropIds: newIds(MAX_DROPS_FOR_SPEC),
    attacker:
      event.damageSource?.kind === "attack"
        ? q.player(event.damageSource.attacker)
        : undefined,
  }),
  apply: ({ npc, attacker }, event, context) => {
    if (npc.health().hp <= 0) {
      // Health updates have no effect on dead NPCs.
      return;
    }

    const npcTypeId = npc.npcMetadata().type_id;
    const nativeProfile = harthmereNativeNpcCombatProfileForTypeId(npcTypeId);
    let hpDelta = event.hp;

    if (event.damageSource?.kind === "attack") {
      const attackerPosition = attacker?.position();
      if (!attackerPosition) return;

      if (nativeProfile) {
        // Native Harthmere damage is computed from the attacker's ECS-selected
        // item. Client hp, item ids, levels, and cooldowns are observations only.
        if (!attacker?.has("player_status")) return;
        if ((attacker.delta().health()?.hp ?? 0) <= 0) {
          // Match the native player-damage path: death disables attacks until
          // the authoritative respawn/health transaction revives the player.
          return;
        }
        if (nativeProfile.behaviorKind === "sentinel") {
          // Protected robots/training sentinels are authored as non-attackable.
          // Enforce that on the server as well as in cursor filtering so a
          // forged UpdateNpcHealthEvent cannot reproduce the robot-only kill.
          return;
        }
        const selectedRef = attacker.inventory.inventory().selected;
        const selected = attacker.inventory.get(selectedRef);
        const definition = harthmereNativeItemDefinitionForBiomesId(
          selected?.item.id
        );
        const itemProfile = harthmereNativeItemCombatProfile(selected?.item);
        if (definition && (!itemProfile || itemProfile.damagePerHit <= 0)) {
          log.debug("Rejected Harthmere attack with non-combat selected item", {
            attackerId: attacker.id,
            targetId: npc.id,
            itemId: selected?.item.id,
          });
          return;
        }

        const reach = itemProfile?.reach ?? 3.5;
        const targetAabb = getAabbForEntity(npc.asReadonlyEntity());
        if (
          !targetAabb ||
          distSqToAABB(attackerPosition, targetAabb) > reach * reach
        ) {
          log.debug("Rejected out-of-range Harthmere attack", {
            attackerId: attacker.id,
            targetId: npc.id,
            reach,
          });
          return;
        }

        const progression = readHarthmereNativeCombatProgression(
          attacker.delta().triggerState()
        );
        if (progression.level < (itemProfile?.levelRequirement ?? 1)) {
          log.debug("Rejected under-level Harthmere weapon use", {
            attackerId: attacker.id,
            targetId: npc.id,
            level: progression.level,
            requiredLevel: itemProfile?.levelRequirement,
          });
          return;
        }
        const vitals = readHarthmereNativeVitals(
          attacker.delta().triggerState()
        );
        if ((itemProfile?.manaCost ?? 0) > vitals.mana) {
          log.debug("Rejected Harthmere spell with insufficient native mana", {
            attackerId: attacker.id,
            targetId: npc.id,
            mana: vitals.mana,
            requiredMana: itemProfile?.manaCost,
          });
          return;
        }
        const nowMs = Date.now();
        const intervalMs = Math.round(
          1000 *
            (itemProfile?.intervalSecs ?? attackIntervalSeconds(selected?.item))
        );
        if (nowMs - progression.lastAttackMs < intervalMs) {
          return;
        }

        const baseDamage =
          itemProfile?.damagePerHit ??
          Math.max(
            1,
            Math.round(((selected?.item.dps ?? 16) * intervalMs) / 1000)
          );
        const levelFactor = Math.max(
          0.65,
          Math.min(1.75, 1 + (progression.level - nativeProfile.level) * 0.04)
        );
        hpDelta = -Math.max(1, Math.round(baseDamage * levelFactor));
        writeHarthmereNativeCombatProgression(
          attacker.delta().mutableTriggerState(),
          { lastAttackMs: nowMs }
        );
        if ((itemProfile?.manaCost ?? 0) > 0) {
          writeHarthmereNativeVitals(attacker.delta().mutableTriggerState(), {
            mana: vitals.mana - itemProfile!.manaCost,
          });
        }
        if (selected && (itemProfile?.durabilityCostMs ?? 0) > 0) {
          decrementItemDurability(
            attacker.inventory as PlayerInventoryEditor,
            selectedRef,
            itemProfile!.durabilityCostMs
          );
        }
      } else {
        const npcPosition = npc.staleOk().position().v;
        const dx = attackerPosition[0] - npcPosition[0];
        const dy = attackerPosition[1] - npcPosition[1];
        const dz = attackerPosition[2] - npcPosition[2];
        if (
          dx * dx + dy * dy + dz * dz >
          HARTHMERE_NATIVE_NPC_MELEE_MAX_CENTER_DISTANCE ** 2
        ) {
          return;
        }
      }
    }

    // Native Health is authoritative for every NPC, including Harthmere's
    // seeded creatures.  The former live-mode exception left the ECS entity at
    // full health while a private Redis snapshot died, which split AI, drops,
    // quest triggers, and multiplayer visibility.  Keep all damage, death, and
    // drop handling in this one transaction.
    modifyNpcHealth(
      npc,
      Math.max(0, npc.health().hp + hpDelta),
      event.damageSource,
      secondsSinceEpoch()
    );

    if (npc.health().hp > 0) {
      return;
    }

    if (HARTHMERE_RESPAWNING_CREATURE_IDS.has(npc.id)) {
      // The native death transaction is the only place that schedules the
      // fixed-id seed's reappearance. Without this bridge the seed reconciler
      // recreated a corpse as soon as its 90-second ECS expiry elapsed.
      harthmereSharedLiveCreatureRespawnRegistry().recordKill(
        npc.id,
        secondsSinceEpoch() * 1000
      );
    }

    const npcTypeInfo = idToNpcType(npcTypeId);

    // Emit an event for the trigger server to track, if this mucker was
    // killed by an attack
    if (event.damageSource?.kind === "attack") {
      if (nativeProfile && attacker?.has("player_status")) {
        awardHarthmereNativeCombatXp(
          attacker.delta().mutableTriggerState(),
          nativeProfile.killXp,
          nativeProfile.isBoss
        );
      }
      context.publish({
        kind: "npcKilled",
        entityId: event.damageSource.attacker,
        npcTypeId,
      });
    }

    const npcSize = npc.size().v;
    const npcPosition = npc.staleOk().position().v;
    const dropPosition: ecs.Vec3f = [
      npcPosition[0],
      npcPosition[1] + npcSize[1] / 2,
      npcPosition[2],
    ];

    if (npcTypeInfo.drop) {
      const dropBag = rollSpec(npcTypeInfo.drop);
      createDropsForBag(context, "dropIds", dropBag, dropPosition, false);
    }
  },
});

const sellToEntityEventHandler = makeEventHandler("sellToEntityEvent", {
  involves: (event) => ({
    player: q.player(event.seller_id),
    buyer: q.id(event.purchaser_id).with("item_buyer"),
  }),
  apply: ({ player, buyer }, event, context) => {
    const buyingAttributes = buyer.itemBuyer().attribute_ids;
    ok(buyingAttributes);
    for (const [_, item] of event.src) {
      ok(
        any(buyingAttributes, (e) =>
          Boolean(resolveItemAttributeId(item.item, e))
        )
      );
    }

    let price = 0n;
    for (const [_, item] of event.src) {
      price += sellPrice(item);
    }
    player.inventory.take(event.src);
    player.inventory.giveCurrency(BikkieIds.bling, price);

    context.publish(<SellToEntityEvent>{
      kind: "sell_to_entity",
      entityId: player.id,
      bag: itemBagToString(createBag(...event.src.map((e) => e[1]))),
      buyerId: buyer.id,
    });
  },
});

const setNPCPositionEventHandler = makeEventHandler("setNPCPositionEvent", {
  involves: (event) => ({
    npc: q
      .id(event.entity_id)
      .with(
        "health",
        "npc_metadata",
        "position",
        "rigid_body",
        "size",
        "npc_state"
      ),
  }),
  apply: ({ npc }, event, _context) => {
    if (event.position) {
      npc.setPosition({
        v: event.position,
      });

      if (event.update_spawn) {
        npc.mutableNpcMetadata().spawn_position = event.position;
      }
    }

    if (event.orientation) {
      npc.setOrientation({
        v: event.orientation,
      });
      if (event.update_spawn) {
        npc.mutableNpcMetadata().spawn_orientation = event.orientation;
      }
    }
  },
});

export const npcEventHandlers = [
  updateNpcHealthEventHandler,
  sellToEntityEventHandler,
  setNPCPositionEventHandler,
];
