import { validateHarthmerePlaceableTransactionAuthorization } from "@/server/harthmere/native_placeable_transaction_token";
import {
  RollbackError,
  aclChecker,
  makeEventHandler,
} from "@/server/logic/events/core";
import { q } from "@/server/logic/events/query";
import {
  checkAndOccupyTerrainForPlaceable,
  clearTerrainOccupancyForPlaceable,
  involvedShardsForPlaceable,
  newPlaceable,
  onPlaceablePlace,
} from "@/server/logic/utils/placeables";
import { secondsSinceEpoch } from "@/shared/ecs/config";
import { anItem } from "@/shared/game/item";
import { countOf } from "@/shared/game/items";
import { getAabbForPlaceable } from "@/shared/game/placeables";
import { integerAABB } from "@/shared/math/linear";

const OPERATIONS = new Set([
  "place",
  "restore",
  "move",
  "remove",
  "remove_missing",
]);
const MAX_LEDGER_ENTRIES = 256;
const TRANSACTION_ID_PATTERN = /^[^\u0000-\u001F\u007F]{1,240}$/;

function samePosition(
  left: readonly number[] | undefined,
  right: readonly number[]
) {
  return (
    left?.length === right.length &&
    left.every((value, index) => Math.abs(value - right[index]) < 0.001)
  );
}

/**
 * Atomically owns custom decor's physical boundary. Redis may keep property
 * layout/comfort metadata, but the native placeable, occupancy, ACL check, and
 * player item debit/refund are one replay-protected ECS transaction.
 */
export const harthmerePlaceableTransactionEventHandler = makeEventHandler(
  "harthmerePlaceableTransactionEvent",
  {
    involves: (event) => {
      const item = anItem(event.item_id);
      const newAabb = getAabbForPlaceable(
        item.id,
        event.position,
        event.orientation
      );
      if (!newAabb) throw new RollbackError("Invalid placeable bounds");
      const shards = new Set([
        ...involvedShardsForPlaceable(
          item.id,
          event.position,
          event.orientation
        ),
        ...involvedShardsForPlaceable(
          item.id,
          event.old_position,
          event.old_orientation
        ),
      ]);
      return {
        player: q.player(event.id),
        placeable: q
          .optional(event.entity_id)
          ?.includeIced()
          .with("placeable_component", "position", "orientation"),
        terrain: q.byKeys("terrainByShardId", ...shards).terrain(),
        destinationAcl: aclChecker(
          { kind: "aabb", aabb: integerAABB(newAabb) },
          event.id
        ),
        sourceAcl: aclChecker(
          { kind: "point", point: event.old_position },
          event.id
        ),
      };
    },
    apply: (
      { player, placeable, terrain, destinationAcl, sourceAcl },
      event,
      context
    ) => {
      if (!OPERATIONS.has(event.operation)) {
        throw new RollbackError("Invalid Harthmere placeable operation");
      }
      if (!TRANSACTION_ID_PATTERN.test(event.transaction_id)) {
        throw new RollbackError("Invalid Harthmere placeable transaction id");
      }
      const ledger = player.delta().mutableHarthmereEcsTransactionLedger();
      if (ledger.transaction_ids.includes(event.transaction_id)) return;
      if (
        !validateHarthmerePlaceableTransactionAuthorization(
          {
            id: event.id,
            transaction_id: event.transaction_id,
            operation: event.operation,
            entity_id: event.entity_id,
            item_id: event.item_id,
            position: event.position,
            orientation: event.orientation,
            old_position: event.old_position,
            old_orientation: event.old_orientation,
          },
          event.authorization
        )
      ) {
        throw new RollbackError("Placeable authorization failed");
      }

      const item = anItem(event.item_id);
      if (!item.isPlaceable) {
        throw new RollbackError("Item is not a native placeable");
      }
      const inventory = player.inventory;

      if (event.operation === "place" || event.operation === "restore") {
        if (placeable) throw new RollbackError("Placeable id is occupied");
        if (!destinationAcl.canPerformItemAction(item)) {
          throw new RollbackError("Cannot place item at destination");
        }
        if (event.operation === "place") {
          inventory.takeOrThrow(
            new Map([[String(item.id), countOf(item.id, 1n)]])
          );
        }
        placeable = context.create(
          newPlaceable({
            id: event.entity_id,
            creatorId: player.id,
            position: [...event.position],
            orientation: [...event.orientation],
            item,
            timestamp: secondsSinceEpoch(),
          })
        );
        checkAndOccupyTerrainForPlaceable(
          placeable.id,
          terrain,
          item.id,
          event.position,
          event.orientation,
          destinationAcl
        );
        onPlaceablePlace(placeable, destinationAcl, context);
      } else if (event.operation === "remove_missing") {
        if (placeable) {
          throw new RollbackError("Missing-placeable refund found an entity");
        }
        inventory.giveWithInventoryOverflow(
          new Map([[String(item.id), countOf(item.id, 1n)]])
        );
      } else {
        if (!placeable || placeable.placeableComponent().item_id !== item.id) {
          throw new RollbackError("Native placeable is unavailable");
        }
        const owner = placeable.placedBy()?.id ?? placeable.createdBy()?.id;
        if (owner !== player.id) {
          throw new RollbackError("Only the placeable owner may change it");
        }
        if (
          !samePosition(placeable.position().v, event.old_position) ||
          !samePosition(placeable.orientation().v, event.old_orientation)
        ) {
          throw new RollbackError(
            "Placeable moved since the request was validated"
          );
        }
        if (!sourceAcl.can("destroy", { entity: placeable })) {
          throw new RollbackError("Cannot remove placeable from source");
        }
        clearTerrainOccupancyForPlaceable(
          terrain,
          item.id,
          event.old_position,
          event.old_orientation
        );

        if (event.operation === "move") {
          if (!destinationAcl.canPerformItemAction(item)) {
            throw new RollbackError("Cannot move item to destination");
          }
          placeable.setPosition({ v: [...event.position] });
          placeable.setOrientation({ v: [...event.orientation] });
          checkAndOccupyTerrainForPlaceable(
            placeable.id,
            terrain,
            item.id,
            event.position,
            event.orientation,
            destinationAcl
          );
          onPlaceablePlace(placeable, destinationAcl, context);
        } else {
          const hasContainerItems =
            placeable.containerInventory()?.items.some(Boolean) ||
            placeable
              .pricedContainerInventory()
              ?.items.some((entry) => Boolean(entry?.contents)) ||
            [...(placeable.wearing()?.items.values() ?? [])].length > 0;
          if (hasContainerItems) {
            throw new RollbackError("Empty the placeable before removing it");
          }
          context.delete(placeable.id);
          inventory.giveWithInventoryOverflow(
            new Map([[String(item.id), countOf(item.id, 1n)]])
          );
        }
      }

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
