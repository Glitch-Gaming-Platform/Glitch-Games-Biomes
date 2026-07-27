import { validateHarthmereInventoryTransactionAuthorization } from "@/server/harthmere/native_inventory_transaction_token";
import { makeEventHandler, RollbackError } from "@/server/logic/events/core";
import { q } from "@/server/logic/events/query";
import { BikkieIds } from "@/shared/bikkie/ids";
import type { ReadonlyItemBag } from "@/shared/ecs/gen/types";
import { addToBag, takeFromBag } from "@/shared/game/items";
import { itemBagToString } from "@/shared/game/items_serde";
import { writeHarthmereNativeVitals } from "@/shared/harthmere/harthmere_native_vitals";

const MAX_LEDGER_ENTRIES = 256;
const MAX_ABSOLUTE_GOLD_DELTA = 9_000_000_000_000_000n;
const TRANSACTION_ID_PATTERN = /^[^\u0000-\u001F\u007F]{1,240}$/;

function validateBag(name: string, bag: ReadonlyItemBag) {
  for (const { item, count } of bag.values()) {
    if (!Number.isSafeInteger(item.id) || item.id <= 0 || count <= 0n) {
      throw new RollbackError(`Invalid ${name} item/count`);
    }
  }
}

/**
 * Atomic authority boundary for server-owned Harthmere economy metadata.
 *
 * Redis may decide that a vendor sale, timed craft, job, or auction settled,
 * but this handler is the only place where that decision becomes physical
 * player inventory/currency. The signed full payload prevents browser-forged
 * grants; the player ledger makes a retried outbox delivery exactly-once.
 */
export const harthmereInventoryTransactionEventHandler = makeEventHandler(
  "harthmereInventoryTransactionEvent",
  {
    involves: (event) => ({
      player: q.player(event.id),
      robot: q.optional(event.robot_entity_id)?.with("robot_component"),
    }),
    apply: ({ player, robot }, event, context) => {
      if (!TRANSACTION_ID_PATTERN.test(event.transaction_id)) {
        throw new RollbackError("Invalid Harthmere transaction id");
      }

      const priorTransactionIds =
        player.delta().harthmereEcsTransactionLedger()?.transaction_ids ?? [];
      // Checking the native replay ledger first lets a delayed duplicate be a
      // harmless no-op even after its short-lived authorization has expired.
      if (priorTransactionIds.includes(event.transaction_id)) return;

      if (
        !validateHarthmereInventoryTransactionAuthorization(
          {
            id: event.id,
            transaction_id: event.transaction_id,
            take: event.take,
            give: event.give,
            storage_take: event.storage_take,
            storage_give: event.storage_give,
            storage_max_slots: event.storage_max_slots,
            personal_bank_take: event.personal_bank_take,
            personal_bank_give: event.personal_bank_give,
            personal_bank_max_slots: event.personal_bank_max_slots,
            account_bank_take: event.account_bank_take,
            account_bank_give: event.account_bank_give,
            account_bank_max_slots: event.account_bank_max_slots,
            gold_delta: event.gold_delta,
            publish_craft: event.publish_craft,
            station_entity_id: event.station_entity_id,
            robot_entity_id: event.robot_entity_id,
            robot_energy_delta: event.robot_energy_delta,
            write_standing: event.write_standing,
            standing_scope: event.standing_scope,
            standing_likeability: event.standing_likeability,
            standing_legal: event.standing_legal,
            standing_notoriety: event.standing_notoriety,
            standing_notoriety_floor: event.standing_notoriety_floor,
          },
          event.authorization
        )
      ) {
        throw new RollbackError(
          "Harthmere inventory transaction authorization failed"
        );
      }

      validateBag("take", event.take);
      validateBag("give", event.give);
      validateBag("storage take", event.storage_take);
      validateBag("storage give", event.storage_give);
      validateBag("personal bank take", event.personal_bank_take);
      validateBag("personal bank give", event.personal_bank_give);
      validateBag("account bank take", event.account_bank_take);
      validateBag("account bank give", event.account_bank_give);
      for (const [name, slots] of [
        ["material storage", event.storage_max_slots],
        ["personal bank", event.personal_bank_max_slots],
        ["account bank", event.account_bank_max_slots],
      ] as const) {
        if (!Number.isSafeInteger(slots) || slots < 1 || slots > 10_000) {
          throw new RollbackError(`Invalid ${name} slot limit`);
        }
      }
      if (
        event.gold_delta > MAX_ABSOLUTE_GOLD_DELTA ||
        event.gold_delta < -MAX_ABSOLUTE_GOLD_DELTA
      ) {
        throw new RollbackError("Harthmere gold delta is out of range");
      }
      const storageSlotChange =
        (player.delta().harthmereMaterialStorage()?.max_slots ?? 0) !==
        event.storage_max_slots;
      const personalBankSlotChange =
        (player.delta().harthmereMaterialStorage()?.personal_max_slots ?? 0) !==
        event.personal_bank_max_slots;
      const accountBankSlotChange =
        (player.delta().harthmereMaterialStorage()?.account_max_slots ?? 0) !==
        event.account_bank_max_slots;
      if (
        event.take.size === 0 &&
        event.give.size === 0 &&
        event.storage_take.size === 0 &&
        event.storage_give.size === 0 &&
        event.personal_bank_take.size === 0 &&
        event.personal_bank_give.size === 0 &&
        event.account_bank_take.size === 0 &&
        event.account_bank_give.size === 0 &&
        event.gold_delta === 0n &&
        event.robot_energy_delta === 0 &&
        !event.write_standing &&
        !storageSlotChange &&
        !personalBankSlotChange &&
        !accountBankSlotChange
      ) {
        throw new RollbackError("Empty Harthmere inventory transaction");
      }

      // RollbackError restores all involved ECS components, so debit-first is
      // safe: an insufficient item or wallet balance cannot leave a partial
      // transaction or a replay receipt behind.
      if (
        event.gold_delta < 0n &&
        !player.inventory.trySpendCurrency(BikkieIds.bling, -event.gold_delta)
      ) {
        throw new RollbackError("Not enough gold");
      }
      player.inventory.takeOrThrow(event.take);
      // HARTHMERE_PAID_GRANT_NEVER_OVERFLOWS (2026-07-26): the player is paying
      // for this bag. `giveWithInventoryOverflow` diverts anything it cannot
      // slot into `inventory.overflow`, which the Harthmere live-mode reader
      // does not project (it reads `inventory.items` + `inventory.hotbar`), so
      // the next Redis rebase erased the item while the gold debit stayed
      // committed — a vendor purchase that charged and delivered nothing.
      // Rolling back keeps the wallet honest and surfaces `inventory_full` to
      // the store UI. Unpaid grants (loot, quest rewards) still overflow so a
      // reward is never destroyed by a full backpack.
      if (event.gold_delta < 0n) {
        player.inventory.giveOrThrow(event.give);
      } else {
        player.inventory.giveWithInventoryOverflow(event.give);
      }
      if (event.gold_delta > 0n) {
        player.inventory.giveCurrency(BikkieIds.bling, event.gold_delta);
      }
      if (event.storage_take.size > 0 || event.storage_give.size > 0) {
        const storage = player.delta().mutableHarthmereMaterialStorage();
        storage.max_slots = event.storage_max_slots;
        if (!takeFromBag(storage.items, event.storage_take)) {
          throw new RollbackError("Not enough items in material storage");
        }
        addToBag(storage.items, event.storage_give);
        if (storage.items.size > Math.max(1, storage.max_slots)) {
          throw new RollbackError("Material storage is full");
        }
      } else if (storageSlotChange) {
        player.delta().mutableHarthmereMaterialStorage().max_slots =
          event.storage_max_slots;
      }
      if (
        event.personal_bank_take.size > 0 ||
        event.personal_bank_give.size > 0 ||
        personalBankSlotChange
      ) {
        const storage = player.delta().mutableHarthmereMaterialStorage();
        storage.personal_max_slots = event.personal_bank_max_slots;
        if (!takeFromBag(storage.personal_items, event.personal_bank_take)) {
          throw new RollbackError("Not enough items in personal bank");
        }
        addToBag(storage.personal_items, event.personal_bank_give);
        if (storage.personal_items.size > storage.personal_max_slots) {
          throw new RollbackError("Personal bank is full");
        }
      }
      if (
        event.account_bank_take.size > 0 ||
        event.account_bank_give.size > 0 ||
        accountBankSlotChange
      ) {
        const storage = player.delta().mutableHarthmereMaterialStorage();
        storage.account_max_slots = event.account_bank_max_slots;
        if (!takeFromBag(storage.account_items, event.account_bank_take)) {
          throw new RollbackError("Not enough items in account bank");
        }
        addToBag(storage.account_items, event.account_bank_give);
        if (storage.account_items.size > storage.account_max_slots) {
          throw new RollbackError("Account bank is full");
        }
      }

      if (event.robot_energy_delta !== 0) {
        if (!robot || robot.id !== event.robot_entity_id) {
          throw new RollbackError("Recharge robot is unavailable");
        }
        if (!Number.isFinite(event.robot_energy_delta)) {
          throw new RollbackError("Invalid robot energy delta");
        }
        const component = robot.mutableRobotComponent();
        const capacity = Math.max(
          1,
          component.internal_battery_capacity ?? 100
        );
        component.internal_battery_capacity = capacity;
        component.internal_battery_charge = Math.max(
          0,
          Math.min(
            capacity,
            (component.internal_battery_charge ?? capacity) +
              event.robot_energy_delta
          )
        );
        component.last_update = Date.now() / 1000;
      }

      if (event.write_standing) {
        if (!event.standing_scope || event.standing_scope.length > 120) {
          throw new RollbackError("Invalid standing scope");
        }
        writeHarthmereNativeVitals(player.delta().mutableTriggerState(), {
          standingScopeId: event.standing_scope,
          likeability: event.standing_likeability,
          legal: event.standing_legal,
          notoriety: event.standing_notoriety,
          notorietyFloor: event.standing_notoriety_floor,
          statusProjectionUpdatedAtMs: Date.now(),
        });
      }

      if (event.publish_craft) {
        if (event.give.size === 0) {
          throw new RollbackError("Craft transaction has no output");
        }
        context.publish({
          kind: "craft",
          entityId: player.id,
          bag: itemBagToString(event.give),
          stationEntityId: event.station_entity_id,
        });
      }

      const ledger = player.delta().mutableHarthmereEcsTransactionLedger();
      ledger.transaction_ids.push(event.transaction_id);
      if (ledger.transaction_ids.length > MAX_LEDGER_ENTRIES) {
        ledger.transaction_ids.splice(
          0,
          ledger.transaction_ids.length - MAX_LEDGER_ENTRIES
        );
      }
    },
  }
);
