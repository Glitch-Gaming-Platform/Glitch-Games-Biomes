import { makeEventHandler, RollbackError } from "@/server/logic/events/core";
import { q } from "@/server/logic/events/query";
import { PlayerInventoryEditor } from "@/server/logic/inventory/player_inventory_editor";
import { rollSpec } from "@/server/logic/utils/drops";
import { decrementItemDurability } from "@/server/logic/utils/durability";
import { attribs } from "@/shared/bikkie/schema/attributes";
import { getBiscuit } from "@/shared/bikkie/active";
import { BikkieIds } from "@/shared/bikkie/ids";
import type {
  OwnedItemReference,
  ReadonlyItemBag,
} from "@/shared/ecs/gen/types";
import type { FishedEvent } from "@/shared/firehose/events";
import type { ItemPayload } from "@/shared/game/item";
import { countOf, fishingBagTransform } from "@/shared/game/items";
import { itemBagToString } from "@/shared/game/items_serde";
import { onlyMapValue } from "@/shared/util/collections";
import {
  awardHarthmereNativeSkillXp,
  harthmereNativeGatheringSkillAwards,
} from "@/shared/harthmere/harthmere_skill_progression";

// The client still orchestrates timing and the drop roll, but the server never
// trusts an arbitrary tool, duration, or bag. A future server-issued cast token
// can replace this boundary without changing the native fishing UI.

export const MAX_SERVER_FISHING_ATTEMPT_SECONDS = 60 * 60;

const SERVER_FISHING_FALLBACK_CATCH_IDS = new Set([
  BikkieIds.clownfish,
  BikkieIds.koi,
  BikkieIds.punkfish,
  BikkieIds.spikefish,
  BikkieIds.switchGrass,
]);

export function validServerFishingAttemptSeconds(seconds: number): boolean {
  return (
    Number.isFinite(seconds) &&
    seconds >= 0 &&
    seconds <= MAX_SERVER_FISHING_ATTEMPT_SECONDS
  );
}

export function validServerFishingCatchBag(bag: ReadonlyItemBag): boolean {
  if (bag.size !== 1) return false;
  const caught = onlyMapValue(bag);
  if (!caught || caught.count !== 1n) return false;
  const biscuit = getBiscuit(caught.item.id);
  return (
    SERVER_FISHING_FALLBACK_CATCH_IDS.has(caught.item.id) ||
    Boolean(biscuit?.fishConditions?.length)
  );
}

function requireFishingRod(
  inventory: PlayerInventoryEditor,
  ref: OwnedItemReference
) {
  const slot = inventory.get(ref);
  if (!slot || slot.item.action !== "fish") {
    throw new RollbackError("Expected an owned fishing rod");
  }
  return slot;
}

const fishingClaimEventHandler = makeEventHandler("fishingClaimEvent", {
  involves: (event) => ({ player: q.includeIced(event.id) }),
  apply: ({ player }, event, context) => {
    const inventory = new PlayerInventoryEditor(context, player);
    requireFishingRod(inventory, event.tool_ref);
    if (
      !validServerFishingAttemptSeconds(event.catch_time) ||
      !validServerFishingCatchBag(event.bag)
    ) {
      throw new RollbackError("Invalid fishing claim");
    }
    decrementItemDurability(inventory, event.tool_ref, event.catch_time * 1000);
    inventory.giveOrThrow(fishingBagTransform(event.bag));
    awardHarthmereNativeSkillXp(
      player.mutableTriggerState(),
      harthmereNativeGatheringSkillAwards({
        sourceId: "native_fishing_claim",
        fishing: true,
      })
    );
  },
});

const fishingConsumeBaitEventHandler = makeEventHandler(
  "fishingConsumeBaitEvent",
  {
    involves: (event) => ({ player: q.includeIced(event.id) }),
    apply: ({ player }, event, context) => {
      const inventory = new PlayerInventoryEditor(context, player);
      const bait = inventory.get(event.ref);
      if (!bait || bait.item.id !== event.item_id || !bait.item.isBait) {
        throw new RollbackError("Expected owned fishing bait");
      }
      if (!inventory.attemptTakeFromSlot(event.ref, countOf(event.item_id))) {
        throw new RollbackError("Could not consume bait");
      }
    },
  }
);

const fishingCaughtEventHandler = makeEventHandler("fishingCaughtEvent", {
  involves: (event) => ({ player: q.includeIced(event.id) }),
  apply: ({ player }, event, context) => {
    if (!validServerFishingCatchBag(event.bag)) {
      throw new RollbackError("Invalid caught-fish event");
    }
    context.publish(<FishedEvent>{
      kind: "fished",
      entityId: player.id,
      bag: itemBagToString(event.bag),
    });
  },
});

const fishingFailedEventHandler = makeEventHandler("fishingFailedEvent", {
  involves: (event) => ({ player: q.includeIced(event.id) }),
  apply: ({ player }, event, context) => {
    const inventory = new PlayerInventoryEditor(context, player);
    requireFishingRod(inventory, event.tool_ref);
    if (!validServerFishingAttemptSeconds(event.catch_time)) {
      throw new RollbackError("Invalid failed-fishing duration");
    }
    decrementItemDurability(inventory, event.tool_ref, event.catch_time * 1000);
  },
});

const treasureRollEventHandler = makeEventHandler("treasureRollEvent", {
  involves: (event) => ({ player: q.player(event.id) }),
  apply: ({ player }, event, _context) => {
    const src = player.inventory.get(event.ref);

    if (!src?.item.treasureChestDrop) {
      throw new RollbackError("Expected to claim a treasure chest only");
    }

    const items = rollSpec(src.item.treasureChestDrop);
    const chestBase: ItemPayload = {
      ...src.item.payload,
      [attribs.wrappedItemBag.id]: itemBagToString(items),
    };
    player.inventory.set(event.ref, countOf(src.item.id, chestBase, src.count));
  },
});

export const allFishingEventHandlers = [
  fishingClaimEventHandler,
  fishingConsumeBaitEventHandler,
  fishingCaughtEventHandler,
  fishingFailedEventHandler,
  treasureRollEventHandler,
];
