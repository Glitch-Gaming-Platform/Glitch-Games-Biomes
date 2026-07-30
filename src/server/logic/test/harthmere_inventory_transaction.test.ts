import { authorizeHarthmereInventoryTransaction } from "@/server/harthmere/native_inventory_transaction_token";
import { GameEvent } from "@/server/shared/api/game_event";
import { loadVoxeloo } from "@/server/shared/voxeloo";
import {
  addGameUser,
  addGameRobot,
  editEntity,
  setItemAtSlotIndex,
  testInventoryEditor,
  TestLogicApi,
} from "@/server/test/test_helpers";
import { BikkieIds } from "@/shared/bikkie/ids";
import { HarthmereInventoryTransactionEvent } from "@/shared/ecs/gen/events";
import {
  PLAYER_HOTBAR_SLOTS,
  PLAYER_INVENTORY_SLOTS,
} from "@/shared/game/inventory";
import { bagCount, countOf, createBag } from "@/shared/game/items";
import { readHarthmereNativeVitals } from "@/shared/harthmere/harthmere_native_vitals";
import type { BiomesId } from "@/shared/ids";
import { generateTestId } from "@/shared/test_helpers";
import type { VoxelooModule } from "@/shared/wasm/types";
import assert from "assert";

describe("Harthmere native inventory transaction", () => {
  let voxeloo!: VoxelooModule;
  let logic!: TestLogicApi;
  let playerId!: BiomesId;

  before(async () => {
    voxeloo = await loadVoxeloo();
  });

  beforeEach(async () => {
    logic = new TestLogicApi(voxeloo);
    playerId = (await addGameUser(logic.world, generateTestId(), {})).id;
    setItemAtSlotIndex(logic.world, playerId, countOf(BikkieIds.dirt, 5n), 0);
    editEntity(logic.world, playerId, (player) => {
      testInventoryEditor(player).giveCurrency(BikkieIds.bling, 10n);
    });
  });

  function event(input: {
    transactionId: string;
    take?: ReturnType<typeof createBag>;
    give?: ReturnType<typeof createBag>;
    goldDelta?: bigint;
    robotEntityId?: BiomesId;
    robotEnergyDelta?: number;
    storageTake?: ReturnType<typeof createBag>;
    storageGive?: ReturnType<typeof createBag>;
    storageMaxSlots?: number;
    personalBankTake?: ReturnType<typeof createBag>;
    personalBankGive?: ReturnType<typeof createBag>;
    personalBankMaxSlots?: number;
    accountBankTake?: ReturnType<typeof createBag>;
    accountBankGive?: ReturnType<typeof createBag>;
    accountBankMaxSlots?: number;
    standing?: {
      scopeId: string;
      likeability: number;
      legal: number;
      notoriety: number;
      notorietyFloor: number;
    };
    authorizationFor?: {
      take: ReturnType<typeof createBag>;
      give: ReturnType<typeof createBag>;
      goldDelta: bigint;
    };
  }) {
    const take = input.take ?? createBag();
    const give = input.give ?? createBag();
    const goldDelta = input.goldDelta ?? 0n;
    const signed = input.authorizationFor ?? { take, give, goldDelta };
    const standing = input.standing;
    const authorizationInput = {
      id: playerId,
      transaction_id: input.transactionId,
      take: signed.take,
      give: signed.give,
      storage_take: input.storageTake ?? createBag(),
      storage_give: input.storageGive ?? createBag(),
      storage_max_slots: input.storageMaxSlots ?? 32,
      personal_bank_take: input.personalBankTake ?? createBag(),
      personal_bank_give: input.personalBankGive ?? createBag(),
      personal_bank_max_slots: input.personalBankMaxSlots ?? 24,
      account_bank_take: input.accountBankTake ?? createBag(),
      account_bank_give: input.accountBankGive ?? createBag(),
      account_bank_max_slots: input.accountBankMaxSlots ?? 40,
      gold_delta: signed.goldDelta,
      publish_craft: false,
      station_entity_id: undefined,
      robot_entity_id: input.robotEntityId,
      robot_energy_delta: input.robotEnergyDelta ?? 0,
      write_standing: standing !== undefined,
      standing_scope: standing?.scopeId ?? "",
      standing_likeability: standing?.likeability ?? 0,
      standing_legal: standing?.legal ?? 0,
      standing_notoriety: standing?.notoriety ?? 0,
      standing_notoriety_floor: standing?.notorietyFloor ?? 0,
    } as const;
    const authorization =
      authorizeHarthmereInventoryTransaction(authorizationInput);
    return new GameEvent(
      playerId,
      new HarthmereInventoryTransactionEvent({
        id: playerId,
        transaction_id: input.transactionId,
        take,
        give,
        storage_take: input.storageTake ?? createBag(),
        storage_give: input.storageGive ?? createBag(),
        storage_max_slots: input.storageMaxSlots ?? 32,
        personal_bank_take: input.personalBankTake ?? createBag(),
        personal_bank_give: input.personalBankGive ?? createBag(),
        personal_bank_max_slots: input.personalBankMaxSlots ?? 24,
        account_bank_take: input.accountBankTake ?? createBag(),
        account_bank_give: input.accountBankGive ?? createBag(),
        account_bank_max_slots: input.accountBankMaxSlots ?? 40,
        gold_delta: goldDelta,
        publish_craft: false,
        station_entity_id: undefined,
        robot_entity_id: input.robotEntityId,
        robot_energy_delta: input.robotEnergyDelta ?? 0,
        write_standing: standing !== undefined,
        standing_scope: standing?.scopeId ?? "",
        standing_likeability: standing?.likeability ?? 0,
        standing_legal: standing?.legal ?? 0,
        standing_notoriety: standing?.notoriety ?? 0,
        standing_notoriety_floor: standing?.notorietyFloor ?? 0,
        authorization,
      })
    );
  }

  it("atomically exchanges items and gold exactly once", async () => {
    const transaction = event({
      transactionId: "test:inventory:exchange:1",
      take: createBag(countOf(BikkieIds.dirt, 2n)),
      give: createBag(countOf(BikkieIds.dirt, 3n)),
      goldDelta: -4n,
    });
    await logic.publish(transaction);
    await logic.publish(transaction);

    const player = logic.world.table.get(playerId)!;
    assert.equal(player.inventory?.items[0]?.count, 6n);
    assert.equal(
      bagCount(player.inventory?.currencies, { id: BikkieIds.bling }),
      6n
    );
    assert.deepEqual(player.harthmere_ecs_transaction_ledger?.transaction_ids, [
      "test:inventory:exchange:1",
    ]);
  });

  it("rejects a payload changed after signing without writing a receipt", async () => {
    const signedGive = createBag(countOf(BikkieIds.log, 1n));
    await logic.publish(
      event({
        transactionId: "test:inventory:tampered:1",
        give: createBag(countOf(BikkieIds.log, 2n)),
        authorizationFor: {
          take: createBag(),
          give: signedGive,
          goldDelta: 0n,
        },
      })
    );

    const player = logic.world.table.get(playerId)!;
    assert.equal(
      player.inventory?.items.some((slot) => slot?.item.id === BikkieIds.log),
      false
    );
    assert.equal(
      player.harthmere_ecs_transaction_ledger?.transaction_ids.includes(
        "test:inventory:tampered:1"
      ),
      false
    );
  });

  it("rolls back every channel when an item or wallet debit is insufficient", async () => {
    await logic.publish(
      event({
        transactionId: "test:inventory:insufficient:1",
        take: createBag(countOf(BikkieIds.dirt, 99n)),
        give: createBag(countOf(BikkieIds.log, 1n)),
        goldDelta: -9n,
      })
    );

    const player = logic.world.table.get(playerId)!;
    assert.equal(player.inventory?.items[0]?.count, 5n);
    assert.equal(
      bagCount(player.inventory?.currencies, { id: BikkieIds.bling }),
      10n
    );
    assert.equal(
      player.harthmere_ecs_transaction_ledger?.transaction_ids.length,
      0
    );
  });

  it("does not charge a store purchase when all 40 backpack slots are full", async () => {
    for (let i = 0; i < PLAYER_INVENTORY_SLOTS; i += 1) {
      setItemAtSlotIndex(
        logic.world,
        playerId,
        countOf(BikkieIds.dirt, 99n),
        i
      );
    }
    editEntity(logic.world, playerId, (player) => {
      const inventory = testInventoryEditor(player);
      for (let i = 0; i < PLAYER_HOTBAR_SLOTS; i += 1) {
        inventory.set({ kind: "hotbar", idx: i }, countOf(BikkieIds.dirt, 99n));
      }
    });
    await logic.publish(
      event({
        transactionId: "test:inventory:paid-full:1",
        give: createBag(countOf(BikkieIds.grass, 1n)),
        goldDelta: -4n,
      })
    );

    const player = logic.world.table.get(playerId)!;
    assert.equal(player.inventory?.items.length, PLAYER_INVENTORY_SLOTS);
    assert.equal(
      player.inventory?.items.some((slot) => slot?.item.id === BikkieIds.grass),
      false
    );
    assert.equal(
      bagCount(player.inventory?.currencies, { id: BikkieIds.bling }),
      10n
    );
    assert.equal(
      bagCount(player.inventory?.overflow, { id: BikkieIds.grass }),
      0n
    );
    assert.equal(
      player.harthmere_ecs_transaction_ledger?.transaction_ids.includes(
        "test:inventory:paid-full:1"
      ),
      false
    );
  });

  it("updates robot battery in the same replay-protected transaction", async () => {
    const robotId = generateTestId();
    await addGameRobot(logic.world, robotId, false, playerId);
    editEntity(logic.world, robotId, (robot) => {
      const component = robot.mutableRobotComponent();
      component.internal_battery_capacity = 100;
      component.internal_battery_charge = 25;
    });

    const transaction = event({
      transactionId: "test:robot:recharge:1",
      robotEntityId: robotId,
      robotEnergyDelta: 40,
    });
    await logic.publish(transaction);
    await logic.publish(transaction);

    assert.equal(
      logic.world.table.get(robotId)?.robot_component?.internal_battery_charge,
      65
    );
    assert.deepEqual(
      logic.world.table.get(playerId)?.harthmere_ecs_transaction_ledger
        ?.transaction_ids,
      ["test:robot:recharge:1"]
    );
  });

  it("writes standing without requiring a parallel Redis inventory delta", async () => {
    await logic.publish(
      event({
        transactionId: "test:standing:1",
        standing: {
          scopeId: "harthmere",
          likeability: 125,
          legal: -20,
          notoriety: 9,
          notorietyFloor: 3,
        },
      })
    );

    const player = logic.world.table.get(playerId)!;
    const standing = readHarthmereNativeVitals(player.trigger_state);
    assert.equal(standing.standingScopeId, "harthmere");
    assert.equal(standing.likeability, 125);
    assert.equal(standing.legal, -20);
    assert.equal(standing.notoriety, 9);
    assert.equal(standing.notorietyFloor, 3);
  });

  it("moves material-bank stacks on the player ECS document atomically", async () => {
    await logic.publish(
      event({
        transactionId: "test:material-storage:deposit:1",
        take: createBag(countOf(BikkieIds.dirt, 2n)),
        storageGive: createBag(countOf(BikkieIds.dirt, 2n)),
        storageMaxSlots: 8,
      })
    );
    let player = logic.world.table.get(playerId)!;
    assert.equal(player.inventory?.items[0]?.count, 3n);
    assert.equal(
      bagCount(player.harthmere_material_storage?.items, {
        id: BikkieIds.dirt,
      }),
      2n
    );

    await logic.publish(
      event({
        transactionId: "test:material-storage:withdraw:1",
        give: createBag(countOf(BikkieIds.dirt, 1n)),
        storageTake: createBag(countOf(BikkieIds.dirt, 1n)),
        storageMaxSlots: 8,
      })
    );
    player = logic.world.table.get(playerId)!;
    assert.equal(player.inventory?.items[0]?.count, 4n);
    assert.equal(
      bagCount(player.harthmere_material_storage?.items, {
        id: BikkieIds.dirt,
      }),
      1n
    );
    assert.equal(player.harthmere_material_storage?.max_slots, 8);
  });

  it("moves personal and account bank stacks through the same atomic ECS transaction", async () => {
    await logic.publish(
      event({
        transactionId: "test:bank-vaults:deposit:1",
        take: createBag(countOf(BikkieIds.dirt, 4n)),
        personalBankGive: createBag(countOf(BikkieIds.dirt, 2n)),
        personalBankMaxSlots: 12,
        accountBankGive: createBag(countOf(BikkieIds.dirt, 2n)),
        accountBankMaxSlots: 20,
      })
    );
    let player = logic.world.table.get(playerId)!;
    assert.equal(player.inventory?.items[0]?.count, 1n);
    assert.equal(
      bagCount(player.harthmere_material_storage?.personal_items, {
        id: BikkieIds.dirt,
      }),
      2n
    );
    assert.equal(
      bagCount(player.harthmere_material_storage?.account_items, {
        id: BikkieIds.dirt,
      }),
      2n
    );

    await logic.publish(
      event({
        transactionId: "test:bank-vaults:withdraw:1",
        give: createBag(countOf(BikkieIds.dirt, 2n)),
        personalBankTake: createBag(countOf(BikkieIds.dirt, 1n)),
        personalBankMaxSlots: 12,
        accountBankTake: createBag(countOf(BikkieIds.dirt, 1n)),
        accountBankMaxSlots: 20,
      })
    );
    player = logic.world.table.get(playerId)!;
    assert.equal(player.inventory?.items[0]?.count, 3n);
    assert.equal(
      bagCount(player.harthmere_material_storage?.personal_items, {
        id: BikkieIds.dirt,
      }),
      1n
    );
    assert.equal(
      bagCount(player.harthmere_material_storage?.account_items, {
        id: BikkieIds.dirt,
      }),
      1n
    );
    assert.equal(player.harthmere_material_storage?.personal_max_slots, 12);
    assert.equal(player.harthmere_material_storage?.account_max_slots, 20);
  });

  it("rolls back every vault when one bank debit is insufficient", async () => {
    await logic.publish(
      event({
        transactionId: "test:bank-vaults:seed:1",
        take: createBag(countOf(BikkieIds.dirt, 1n)),
        personalBankGive: createBag(countOf(BikkieIds.dirt, 1n)),
      })
    );
    await logic.publish(
      event({
        transactionId: "test:bank-vaults:rollback:1",
        give: createBag(countOf(BikkieIds.dirt, 2n)),
        personalBankTake: createBag(countOf(BikkieIds.dirt, 1n)),
        accountBankTake: createBag(countOf(BikkieIds.dirt, 1n)),
      })
    );

    const player = logic.world.table.get(playerId)!;
    assert.equal(player.inventory?.items[0]?.count, 4n);
    assert.equal(
      bagCount(player.harthmere_material_storage?.personal_items, {
        id: BikkieIds.dirt,
      }),
      1n
    );
    assert.equal(
      bagCount(player.harthmere_material_storage?.account_items, {
        id: BikkieIds.dirt,
      }),
      0n
    );
    assert.equal(
      player.harthmere_ecs_transaction_ledger?.transaction_ids.includes(
        "test:bank-vaults:rollback:1"
      ),
      false
    );
  });
});
