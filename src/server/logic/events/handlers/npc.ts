import { makeEventHandler, newIds } from "@/server/logic/events/core";
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
        ? q.id(event.damageSource.attacker).with("position")
        : undefined,
  }),
  apply: ({ npc, attacker }, event, context) => {
    if (npc.health().hp <= 0) {
      // Health updates have no effect on dead NPCs.
      return;
    }

    if (event.damageSource?.kind === "attack") {
      const attackerPosition = attacker?.staleOk().position().v;
      const npcPosition = npc.staleOk().position().v;
      if (!attackerPosition) {
        return;
      }
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

    // Native Health is authoritative for every NPC, including Harthmere's
    // seeded creatures.  The former live-mode exception left the ECS entity at
    // full health while a private Redis snapshot died, which split AI, drops,
    // quest triggers, and multiplayer visibility.  Keep all damage, death, and
    // drop handling in this one transaction.
    modifyNpcHealth(
      npc,
      npc.health().hp + event.hp,
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

    const npcTypeId = npc.npcMetadata().type_id;
    const npcTypeInfo = idToNpcType(npcTypeId);

    // Emit an event for the trigger server to track, if this mucker was
    // killed by an attack
    if (event.damageSource?.kind === "attack") {
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
