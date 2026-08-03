import {
  RollbackError,
  aclChecker,
  makeEventHandler,
} from "@/server/logic/events/core";
import { makeInventoryEventHandler } from "@/server/logic/events/handlers/inventory";
import { q } from "@/server/logic/events/query";
import { ContainerInventoryEditor } from "@/server/logic/inventory/container_inventory_editor";
import { PlayerInventoryEditor } from "@/server/logic/inventory/player_inventory_editor";
import { rollSpec } from "@/server/logic/utils/drops";
import { BikkieIds } from "@/shared/bikkie/ids";
import { attribs } from "@/shared/bikkie/schema/attributes";
import { DAILY_GIFTS } from "@/shared/constants";
import {
  secondsSinceEpoch,
  secondsSinceEpochToDate,
} from "@/shared/ecs/config";
import type { GiveMailboxItemEvent } from "@/shared/ecs/gen/events";
import { resetGiveGiftDate } from "@/shared/game/gifts";
import { anItem } from "@/shared/game/item";
import { countOf, createBag, isDroppableItem } from "@/shared/game/items";
import { itemBagToString } from "@/shared/game/items_serde";
import { findIndex } from "lodash";

export const giveGiftEventHandler = makeEventHandler("giveGiftEvent", {
  mergeKey: (event) => event.id,
  prepareInvolves: (event) => ({
    placeable: q.id(event.target).with("position"),
  }),
  prepare: ({ placeable }) => ({
    position: placeable.position.v,
  }),
  involves: (event, { position }) => {
    return {
      target: q.id(event.target).with("container_inventory"),
      targetRobot: q.id(event.target_robot).with("created_by"),
      player: q.id(event.id).with("inventory"),
      acl: aclChecker(
        {
          kind: "point",
          point: position,
        },
        event.id
      ),
    };
  },
  apply: ({ target, targetRobot, player, acl }, _event, context) => {
    // Check/decrement GiftGiver component
    const giftGiver = player.mutableGiftGiver();

    const curSeconds = secondsSinceEpoch();
    const curDate = secondsSinceEpochToDate(curSeconds);
    const shouldResetGifts =
      curDate.getTime() > resetGiveGiftDate(giftGiver.last_gift_time).getTime();

    if (shouldResetGifts) {
      giftGiver.gift_targets = [];
    }

    // Check if the giving player can take the gift from the mailbox
    if (acl.can("destroy", { entity: target })) {
      throw new RollbackError(
        "You cannot give a gift to a container you can take from."
      );
    }

    // Check if the player has already given a gift to the target
    const targetPlayer = targetRobot.createdBy().id;
    if (giftGiver.gift_targets.includes(targetPlayer)) {
      throw new RollbackError(
        "You have already given a gift to this player today."
      );
    }

    // Check if the target has gifts left to give
    if (giftGiver.gift_targets.length >= DAILY_GIFTS) {
      throw new RollbackError(
        `You have already given ${DAILY_GIFTS} gifts today.`
      );
    }

    // Check if the target has empty inventory slots
    const containerInventory = new ContainerInventoryEditor(target);
    const slot = findIndex(
      containerInventory.mutableInventory().items,
      (itemCt) => !itemCt
    );

    // Give the gift
    const giftBiscuit = anItem(BikkieIds.playerGift);
    const giftRoll =
      giftBiscuit.treasureChestDrop && rollSpec(giftBiscuit.treasureChestDrop);
    if (!giftRoll) {
      throw new RollbackError("Gift item has no drop spec");
    }
    const bagString = itemBagToString(giftRoll);
    const giftedItemPayload = {
      [attribs.wrappedItemBag.id]: bagString,
      [attribs.createdBy.id]: player.id,
    };

    containerInventory.set(
      {
        kind: "item",
        idx: slot,
      },
      countOf(giftBiscuit.id, giftedItemPayload)
    );

    giftGiver.gift_targets.push(targetPlayer);
    giftGiver.last_gift_time = curSeconds;

    // If the player has given all their gifts, give them a reward
    if (giftGiver.gift_targets.length >= DAILY_GIFTS) {
      const rewardBiscuit = anItem(BikkieIds.playerGiftReward);
      const rewardRoll =
        rewardBiscuit.treasureChestDrop &&
        rollSpec(rewardBiscuit.treasureChestDrop);
      if (!rewardRoll) {
        throw new RollbackError("Reward item has no drop spec");
      }
      const rewardItemPayload = {
        [attribs.wrappedItemBag.id]: itemBagToString(rewardRoll),
      };

      const playerInventory = new PlayerInventoryEditor(context, player);
      playerInventory.giveOrThrow(
        createBag(countOf(rewardBiscuit.id, rewardItemPayload))
      );
    }

    // Send an event
    context.publish({
      kind: "mailSent",
      entityId: player.id,
      targetId: targetPlayer,
      isGift: true,
      bag: bagString,
    });
  },
});

export const giveMailboxItemEventHandler =
  makeInventoryEventHandler<GiveMailboxItemEvent>(
    "giveMailboxItemEvent",
    ({ src, dst }, event, context) => {
      if (
        event.player_id !== event.src_id ||
        src.id !== event.player_id ||
        event.dst_id === undefined ||
        dst.id !== event.dst_id
      ) {
        throw new RollbackError("Invalid mailbox transfer endpoints");
      }
      const destinationPlaceable = dst.delta().placeableComponent();
      if (
        !destinationPlaceable ||
        !anItem(destinationPlaceable.item_id).isMailbox
      ) {
        throw new RollbackError("Mailbox gifts require a mailbox destination");
      }
      if (event.count <= 0n) {
        throw new RollbackError("Mailbox gift count must be positive");
      }
      if (dst.inventory.get(event.dst)) {
        throw new RollbackError("Tried to give to a non-empty mailbox cell");
      }
      const giftItem = src.inventory.get(event.src);
      if (!giftItem) {
        throw new RollbackError("Tried to give a non-existent item");
      }
      if (!isDroppableItem(giftItem.item)) {
        throw new RollbackError("Bound items cannot be mailed");
      }

      const targetCount = giftItem.count - event.count;
      if (targetCount < 0) {
        throw new RollbackError("Tried to give more than the owned quantity");
      }
      src.inventory.set(
        event.src,
        targetCount
          ? {
              ...giftItem,
              count: targetCount,
            }
          : undefined
      );
      // Wrap item in a parcel
      const bagString = itemBagToString(
        createBag({ ...giftItem, count: event.count })
      );
      const wrappedItem = countOf(BikkieIds.parcel, {
        [attribs.wrappedItemBag.id]: bagString,
        [attribs.createdBy.id]: src.id,
      });
      // Give them the parcel
      dst.inventory.set(event.dst, wrappedItem);

      // Send an event. TODO: verify target player id
      context.publish({
        kind: "mailSent",
        entityId: event.player_id,
        targetId: event.target_player_id,
        bag: bagString,
      });
    },
    { ignoreGivePermissions: true }
  );
