import { GameEvent } from "@/server/shared/api/game_event";
import { loadVoxeloo } from "@/server/shared/voxeloo";
import {
  addGameUser,
  editEntity,
  setItemAtSlotIndex,
  TestLogicApi,
} from "@/server/test/test_helpers";
import { BikkieIds } from "@/shared/bikkie/ids";
import { BikkieRuntime } from "@/shared/bikkie/active";
import {
  AcceptTradeEvent,
  BeginTradeEvent,
  ChangeTradeOfferEvent,
} from "@/shared/ecs/gen/events";
import { countOf } from "@/shared/game/items";
import type { BiomesId } from "@/shared/ids";
import { generateTestId } from "@/shared/test_helpers";
import type { VoxelooModule } from "@/shared/wasm/types";
import assert from "assert";

const BOUND_TEST_ITEM_ID = generateTestId();

function inventoryCount(
  logic: TestLogicApi,
  playerId: BiomesId,
  itemId: BiomesId
) {
  const inventory = logic.world.table.get(playerId)?.inventory;
  return [...(inventory?.items ?? []), ...(inventory?.hotbar ?? [])].reduce(
    (total, stack) => total + (stack?.item.id === itemId ? stack.count : 0n),
    0n
  );
}

describe("native player trade", () => {
  let voxeloo!: VoxelooModule;
  let logic!: TestLogicApi;
  let playerA!: BiomesId;
  let playerB!: BiomesId;

  before(async () => {
    voxeloo = await loadVoxeloo();
    BikkieRuntime.get().registerBiscuits(
      new Map([
        [
          BOUND_TEST_ITEM_ID,
          {
            id: BOUND_TEST_ITEM_ID,
            name: "bound_trade_test_item",
            displayName: "Bound Test Item",
            isItem: true,
            stackable: 99n,
          } as any,
        ],
      ])
    );
  });

  beforeEach(async () => {
    logic = new TestLogicApi(voxeloo);
    playerA = (await addGameUser(logic.world, generateTestId())).id;
    playerB = (await addGameUser(logic.world, generateTestId())).id;
  });

  it("conserves both offers when an offered stack moves before acceptance", async () => {
    setItemAtSlotIndex(
      logic.world,
      playerA,
      countOf(BikkieIds.dirt, undefined, 5n),
      0
    );
    setItemAtSlotIndex(
      logic.world,
      playerB,
      countOf(BikkieIds.stone, undefined, 3n),
      0
    );

    await logic.publish(
      new GameEvent(playerA, new BeginTradeEvent({ id: playerA, id2: playerB }))
    );
    const tradeId =
      logic.world.table.get(playerA)?.active_trades?.trades[0]?.trade_id;
    assert.ok(tradeId);

    await logic.publish(
      new GameEvent(
        playerA,
        new ChangeTradeOfferEvent({
          id: playerA,
          trade_id: tradeId,
          offer: [
            [{ kind: "item", idx: 0 }, countOf(BikkieIds.dirt, undefined, 4n)],
          ],
        })
      ),
      new GameEvent(
        playerB,
        new ChangeTradeOfferEvent({
          id: playerB,
          trade_id: tradeId,
          offer: [
            [{ kind: "item", idx: 0 }, countOf(BikkieIds.stone, undefined, 3n)],
          ],
        })
      )
    );

    editEntity(logic.world, playerA, (entity) => {
      const inventory = entity.mutableInventory();
      inventory.items[3] = inventory.items[0];
      inventory.items[0] = undefined;
    });

    await logic.publish(
      new GameEvent(
        playerA,
        new AcceptTradeEvent({
          id: playerA,
          trade_id: tradeId,
          other_trader_id: playerB,
        })
      )
    );
    await logic.publish(
      new GameEvent(
        playerB,
        new AcceptTradeEvent({
          id: playerB,
          trade_id: tradeId,
          other_trader_id: playerA,
        })
      )
    );

    assert.equal(inventoryCount(logic, playerA, BikkieIds.dirt), 1n);
    assert.equal(inventoryCount(logic, playerA, BikkieIds.stone), 3n);
    assert.equal(inventoryCount(logic, playerB, BikkieIds.dirt), 4n);
    assert.equal(inventoryCount(logic, playerB, BikkieIds.stone), 0n);
    assert.equal(
      logic.world.table.get(playerA)?.active_trades?.trades.length,
      0
    );
    assert.equal(
      logic.world.table.get(playerB)?.active_trades?.trades.length,
      0
    );
  });

  it("rejects bound items before they enter an offer", async () => {
    setItemAtSlotIndex(
      logic.world,
      playerA,
      countOf(BOUND_TEST_ITEM_ID, undefined, 1n),
      0
    );
    await logic.publish(
      new GameEvent(playerA, new BeginTradeEvent({ id: playerA, id2: playerB }))
    );
    const tradeId =
      logic.world.table.get(playerA)?.active_trades?.trades[0]?.trade_id;
    assert.ok(tradeId);
    await logic.publish(
      new GameEvent(
        playerA,
        new ChangeTradeOfferEvent({
          id: playerA,
          trade_id: tradeId,
          offer: [
            [
              { kind: "item", idx: 0 },
              countOf(BOUND_TEST_ITEM_ID, undefined, 1n),
            ],
          ],
        })
      )
    );
    const trade = logic.world.table.get(tradeId)?.trade;
    assert.deepEqual(trade?.trader1.offer_assignment, []);
    assert.equal(inventoryCount(logic, playerA, BOUND_TEST_ITEM_ID), 1n);
  });
});
