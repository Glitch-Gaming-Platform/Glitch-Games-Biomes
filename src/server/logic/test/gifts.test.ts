import { GameEvent } from "@/server/shared/api/game_event";
import { loadVoxeloo } from "@/server/shared/voxeloo";
import {
  addGameUser,
  setItemAtSlotIndex,
  TestLogicApi,
} from "@/server/test/test_helpers";
import { BikkieIds } from "@/shared/bikkie/ids";
import { BikkieRuntime } from "@/shared/bikkie/active";
import { GiveMailboxItemEvent } from "@/shared/ecs/gen/events";
import { anItem } from "@/shared/game/item";
import { bagCount, countOf } from "@/shared/game/items";
import { stringToItemBag } from "@/shared/game/items_serde";
import { newPlaceable } from "@/server/logic/utils/placeables";
import type { BiomesId } from "@/shared/ids";
import { generateTestId } from "@/shared/test_helpers";
import type { VoxelooModule } from "@/shared/wasm/types";
import assert from "assert";

describe("native mailbox item gifts", () => {
  let voxeloo!: VoxelooModule;
  let logic!: TestLogicApi;
  let sender!: BiomesId;
  let recipient!: BiomesId;
  let mailboxId!: BiomesId;

  before(async () => {
    voxeloo = await loadVoxeloo();
    BikkieRuntime.get().registerBiscuits(
      new Map([
        [
          BikkieIds.mailbox,
          {
            id: BikkieIds.mailbox,
            name: "test_mailbox",
            displayName: "Mailbox",
            isPlaceable: true,
            isMailbox: true,
            boxSize: [1, 1, 1],
            numSlots: 8,
            stackable: 1n,
          } as any,
        ],
        [
          BikkieIds.parcel,
          {
            id: BikkieIds.parcel,
            name: "test_parcel",
            displayName: "Parcel",
            isItem: true,
            isDroppable: true,
            stackable: 99n,
          } as any,
        ],
        [
          BikkieIds.treasureChest,
          {
            id: BikkieIds.treasureChest,
            name: "test_treasure_chest",
            displayName: "Treasure Chest",
            isPlaceable: true,
            isContainer: true,
            boxSize: [1, 1, 1],
            numSlots: 8,
            stackable: 1n,
          } as any,
        ],
      ])
    );
  });

  beforeEach(async () => {
    logic = new TestLogicApi(voxeloo);
    sender = (await addGameUser(logic.world, generateTestId())).id;
    recipient = (await addGameUser(logic.world, generateTestId())).id;
    mailboxId = generateTestId();
    logic.world.applyChanges([
      {
        kind: "create",
        entity: newPlaceable({
          id: mailboxId,
          creatorId: recipient,
          position: [0, 0, 0],
          orientation: [0, 0],
          item: anItem(BikkieIds.mailbox),
        }),
      },
    ]);
    setItemAtSlotIndex(
      logic.world,
      sender,
      countOf(BikkieIds.dirt, undefined, 10n),
      0
    );
  });

  function mailboxEvent(count: bigint) {
    return new GameEvent(
      sender,
      new GiveMailboxItemEvent({
        player_id: sender,
        src_id: sender,
        src: { kind: "item", idx: 0 },
        count,
        dst_id: mailboxId,
        dst: { kind: "item", idx: 0 },
        target_player_id: recipient,
      })
    );
  }

  it("wraps exactly the quantity removed from the sender", async () => {
    await logic.publish(mailboxEvent(3n));

    assert.equal(logic.world.table.get(sender)?.inventory?.items[0]?.count, 7n);
    const parcel =
      logic.world.table.get(mailboxId)?.container_inventory?.items[0];
    assert.equal(parcel?.item.id, BikkieIds.parcel);
    assert.ok(parcel?.item.wrappedItemBag);
    const wrapped = stringToItemBag(parcel.item.wrappedItemBag);
    assert.equal(bagCount(wrapped, anItem(BikkieIds.dirt)), 3n);
  });

  it("rejects a zero-count parcel without changing either inventory", async () => {
    await logic.publish(mailboxEvent(0n));
    assert.equal(
      logic.world.table.get(sender)?.inventory?.items[0]?.count,
      10n
    );
    assert.equal(
      logic.world.table.get(mailboxId)?.container_inventory?.items[0],
      undefined
    );
  });

  it("rejects arbitrary containers masquerading as another player's mailbox", async () => {
    const chestId = generateTestId();
    logic.world.applyChanges([
      {
        kind: "create",
        entity: newPlaceable({
          id: chestId,
          creatorId: recipient,
          position: [0, 0, 0],
          orientation: [0, 0],
          item: anItem(BikkieIds.treasureChest),
        }),
      },
    ]);
    await logic.publish(
      new GameEvent(
        sender,
        new GiveMailboxItemEvent({
          player_id: sender,
          src_id: sender,
          src: { kind: "item", idx: 0 },
          count: 3n,
          dst_id: chestId,
          dst: { kind: "item", idx: 0 },
          target_player_id: recipient,
        })
      )
    );
    assert.equal(
      logic.world.table.get(sender)?.inventory?.items[0]?.count,
      10n
    );
    assert.equal(
      logic.world.table.get(chestId)?.container_inventory?.items[0],
      undefined
    );
  });
});
