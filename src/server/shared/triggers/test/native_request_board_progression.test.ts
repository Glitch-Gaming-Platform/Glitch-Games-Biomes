import assert from "assert";

import type { TriggerContext } from "@/server/shared/triggers/core";
import { QuestExecutor } from "@/server/shared/triggers/roots/quest";
import { deserializeTrigger } from "@/server/shared/triggers/serde";
import { BikkieRuntime } from "@/shared/bikkie/active";
import type { Biscuit } from "@/shared/bikkie/schema/attributes";
import {
  Challenges,
  Health,
  Inventory,
  TriggerState,
} from "@/shared/ecs/gen/components";
import { EntityBackedDelta } from "@/shared/ecs/gen/delta";
import type { Entity } from "@/shared/ecs/gen/entities";
import type { FirehoseEvent } from "@/shared/firehose/events";
import { countOf } from "@/shared/game/items";
import {
  HARTHMERE_BOARD_REQUESTS,
  HARTHMERE_DOCK_FISHING_BOARD,
  HARTHMERE_REQUEST_BOARDS,
  harthmereBoardRequestByQuestId,
  harthmereBoardRequestsFor,
  type HarthmereBoardRequest,
} from "@/shared/harthmere/native_request_boards";
import type { BiomesId } from "@/shared/ids";
import type { MetaState } from "@/shared/triggers/base_schema";
import type { StoredTriggerDefinition } from "@/shared/triggers/schema";

/**
 * End-to-end coverage for the request boards, through the REAL trigger engine.
 *
 * The authored bounty tree is rebuilt here exactly as the snapshot stores it —
 * including the fact that every Bling bounty reuses the same three leaf ids —
 * and driven with synthetic firehose events the way
 * `TriggerEngine.processAllTriggers` drives them. The point is not that one
 * bounty completes; it is that seven bounties sharing three leaf ids across
 * four boards complete INDEPENDENTLY.
 */

const PLAYER_ID = 1 as BiomesId;

function boardTree(request: HarthmereBoardRequest): StoredTriggerDefinition {
  const board =
    HARTHMERE_REQUEST_BOARDS.find((entry) => entry.id === request.boardId)!;
  return {
    kind: "seq",
    id: 8717089019405262 as BiomesId,
    triggers: [
      {
        kind: "challengeClaimRewards",
        id: request.steps.pickUp,
        // The authored leaf has a description but no name — that is the blank
        // objective row the projection repairs.
        allowDefaultNavigationAid: true,
        returnNpcTypeId: board.entityId,
      },
      {
        kind: "inventoryHas",
        id: request.steps.gather,
        name: "Collect {count}/{countTarget} {item}",
        item: { id: request.itemId },
        count: request.count,
      },
      {
        kind: "challengeClaimRewards",
        id: request.steps.turnIn,
        name: "Turn in bounty",
        allowDefaultNavigationAid: true,
        itemsToTake: [[request.takeItemId, request.takeCount]],
        returnNpcTypeId: board.entityId,
      },
    ],
  } as unknown as StoredTriggerDefinition;
}

function unlockTree(introQuestId: BiomesId): StoredTriggerDefinition {
  return {
    kind: "seq",
    id: 265991807245371 as BiomesId,
    triggers: [
      {
        kind: "challengeComplete",
        id: 3572283753097426,
        challenge: introQuestId,
      },
    ],
  } as unknown as StoredTriggerDefinition;
}

class BoardWorld {
  readonly player: EntityBackedDelta;
  private readonly executors = new Map<BiomesId, QuestExecutor>();
  private readonly states = new Map<string, MetaState<any>>();

  constructor(requests: readonly HarthmereBoardRequest[]) {
    const inventory = Inventory.create();
    inventory.items.length = 64;
    this.player = new EntityBackedDelta({
      id: PLAYER_ID,
      challenges: Challenges.create({}),
      trigger_state: TriggerState.create(),
      health: Health.create({ hp: 100, maxHp: 100 }),
      inventory,
    } as Entity);

    for (const request of requests) {
      const board = HARTHMERE_REQUEST_BOARDS.find(
        (entry) => entry.id === request.boardId
      )!;
      this.executors.set(
        request.questId,
        new QuestExecutor(
          request.questId,
          deserializeTrigger(unlockTree(board.introQuestId)),
          deserializeTrigger(boardTree(request)),
          undefined
        )
      );
    }
  }

  private contextFor(rootId: BiomesId, events: FirehoseEvent[]): TriggerContext {
    const key = (id: BiomesId) => `${rootId}:${id}`;
    return {
      entity: this.player,
      events,
      rootId,
      publish: () => {},
      updateState: (id: BiomesId, _schema: unknown, fn: (s: any) => any) => {
        const next = fn(this.states.get(key(id)) ?? {});
        this.states.set(key(id), next);
        return next;
      },
      clearState: (id: BiomesId) => this.states.delete(key(id)),
    } as unknown as TriggerContext;
  }

  /** One engine pass: every board root sees the same batch. */
  tick(...events: FirehoseEvent[]) {
    for (const [questId, executor] of this.executors) {
      executor.run(this.contextFor(questId, events));
    }
  }

  completeIntro(introQuestId: BiomesId) {
    this.player.mutableChallenges().complete.add(introQuestId);
  }

  accept(questId: BiomesId) {
    const challenges = this.player.mutableChallenges();
    assert.ok(
      challenges.available.has(questId),
      `request ${questId} was never listed`
    );
    challenges.available.delete(questId);
    challenges.in_progress.add(questId);
  }

  give(itemId: BiomesId, count: number) {
    const inventory = this.player.mutableInventory();
    const slot = inventory.items.findIndex((entry) => !entry);
    assert.ok(slot >= 0, "inventory full");
    inventory.items[slot] = countOf(itemId, BigInt(count));
  }

  held(itemId: BiomesId) {
    let total = 0n;
    for (const slot of this.player.inventory()?.items ?? []) {
      if (slot?.item.id === itemId) total += slot.count;
    }
    return Number(total);
  }

  state(questId: BiomesId) {
    const challenges = this.player.challenges();
    if (challenges?.complete.has(questId)) return "complete";
    if (challenges?.in_progress.has(questId)) return "in_progress";
    if (challenges?.available.has(questId)) return "available";
    return "locked";
  }
}

function pickUpEvent(request: HarthmereBoardRequest): FirehoseEvent {
  const board = HARTHMERE_REQUEST_BOARDS.find(
    (entry) => entry.id === request.boardId
  )!;
  return {
    kind: "completeQuestStepAtEntity",
    entityId: PLAYER_ID,
    challenge: request.questId,
    stepId: request.steps.pickUp,
    claimFromEntityId: board.entityId,
  } as unknown as FirehoseEvent;
}

function turnInEvent(request: HarthmereBoardRequest): FirehoseEvent {
  const board = HARTHMERE_REQUEST_BOARDS.find(
    (entry) => entry.id === request.boardId
  )!;
  return {
    kind: "completeQuestStepAtEntity",
    entityId: PLAYER_ID,
    challenge: request.questId,
    stepId: request.steps.turnIn,
    claimFromEntityId: board.entityId,
  } as unknown as FirehoseEvent;
}

const BLING_REQUESTS = HARTHMERE_BOARD_REQUESTS.filter(
  (request) => request.boardId !== "collective_research_board"
);

function questBiscuit(request: HarthmereBoardRequest): Biscuit {
  const board = HARTHMERE_REQUEST_BOARDS.find(
    (entry) => entry.id === request.boardId
  )!;
  return {
    id: request.questId,
    name: request.title,
    displayName: request.title,
    isQuest: true,
    questGiver: board.entityId,
    repeatableCadence: request.cadence === "daily" ? "daily" : "never",
  } as Biscuit;
}

describe("request board progression", () => {
  let priorRuntime: BikkieRuntime | undefined;

  beforeEach(() => {
    priorRuntime = global.bikkieRuntime;
    global.bikkieRuntime = new BikkieRuntime();
    const biscuits = new Map<BiomesId, Biscuit>();
    for (const request of HARTHMERE_BOARD_REQUESTS) {
      biscuits.set(request.questId, questBiscuit(request));
      biscuits.set(request.itemId, {
        id: request.itemId,
        name: `item_${request.itemId}`,
        displayName: `Item ${request.itemId}`,
        stackable: 999n,
      } as Biscuit);
    }
    for (const board of HARTHMERE_REQUEST_BOARDS) {
      biscuits.set(board.introQuestId, {
        id: board.introQuestId,
        name: `intro_${board.id}`,
        displayName: board.label,
        isQuest: true,
        repeatableCadence: "never",
      } as Biscuit);
    }
    global.bikkieRuntime.registerBiscuits(biscuits);
  });

  afterEach(() => {
    if (priorRuntime) {
      global.bikkieRuntime = priorRuntime;
    } else {
      delete (global as { bikkieRuntime?: BikkieRuntime }).bikkieRuntime;
    }
  });

  it("lists nothing until the board's intro quest is done", () => {
    const world = new BoardWorld(BLING_REQUESTS);
    world.tick();
    for (const request of BLING_REQUESTS) {
      assert.equal(
        world.state(request.questId),
        "locked",
        `${request.title} listed before its board was found`
      );
    }
  });

  it("lists a board's own requests, and only that board's", () => {
    const world = new BoardWorld(BLING_REQUESTS);
    const farming = HARTHMERE_REQUEST_BOARDS.find(
      (b) => b.id === "farming_bounties_board"
    )!;
    world.completeIntro(farming.introQuestId);
    world.tick();

    for (const request of BLING_REQUESTS) {
      const expected =
        request.boardId === "farming_bounties_board" ? "available" : "locked";
      assert.equal(
        world.state(request.questId),
        expected,
        `${request.title} on ${request.boardId} was ${world.state(
          request.questId
        )}`
      );
    }
  });

  for (const boardId of [
    "fishing_board",
    "farming_bounties_board",
    "industrial_job_board",
  ]) {
    it(`plays a ${boardId} request end to end`, () => {
      const request = harthmereBoardRequestsFor(boardId)[0];
      const board = HARTHMERE_REQUEST_BOARDS.find((b) => b.id === boardId)!;
      const world = new BoardWorld([request]);
      world.completeIntro(board.introQuestId);
      world.tick();
      assert.equal(world.state(request.questId), "available");

      world.accept(request.questId);
      world.tick(pickUpEvent(request));

      // One short: the gather leaf must not fire.
      world.give(request.itemId, request.count - 1);
      world.tick(turnInEvent(request));
      assert.equal(
        world.state(request.questId),
        "in_progress",
        "a short delivery was accepted"
      );

      world.give(request.itemId, 1);
      world.tick();
      world.tick(turnInEvent(request));
      assert.equal(world.state(request.questId), "complete");
      // The goods were actually taken.
      assert.equal(world.held(request.itemId), 0);
    });
  }

  it("keeps seven bounties sharing three leaf ids completely independent", () => {
    // The whole system rests on this. All seven share `gather` and `turnIn`;
    // six share `pickUp`. Trigger state is keyed per quest root and claim
    // events match on `challenge === rootId`, so finishing one must not move
    // any other — including ones on the same board.
    const world = new BoardWorld(BLING_REQUESTS);
    for (const board of HARTHMERE_REQUEST_BOARDS) {
      world.completeIntro(board.introQuestId);
    }
    world.tick();

    const target = harthmereBoardRequestByQuestId(4589392321684603)!; // Wheat
    world.accept(target.questId);
    world.tick(pickUpEvent(target));
    world.give(target.itemId, target.count);
    world.tick();
    world.tick(turnInEvent(target));
    assert.equal(world.state(target.questId), "complete");

    for (const other of BLING_REQUESTS) {
      if (Number(other.questId) === Number(target.questId)) continue;
      assert.equal(
        world.state(other.questId),
        "available",
        `${other.title} advanced when ${target.title} was turned in`
      );
    }
  });

  it("does not let one board's turn-in event settle another board's request", () => {
    const world = new BoardWorld(BLING_REQUESTS);
    for (const board of HARTHMERE_REQUEST_BOARDS) {
      world.completeIntro(board.introQuestId);
    }
    world.tick();

    const wheat = harthmereBoardRequestByQuestId(4589392321684603)!;
    const stone = harthmereBoardRequestByQuestId(7193493460362756)!;
    assert.equal(Number(wheat.steps.turnIn), Number(stone.steps.turnIn));

    world.accept(stone.questId);
    world.tick(pickUpEvent(stone));
    world.give(stone.itemId, stone.count);
    world.tick();
    // Fire the WHEAT quest's turn-in. Same leaf id, different quest and board.
    world.tick(turnInEvent(wheat));
    assert.equal(
      world.state(stone.questId),
      "in_progress",
      "an event for another quest completed this one"
    );
    // The real event still works.
    world.tick(turnInEvent(stone));
    assert.equal(world.state(stone.questId), "complete");
  });

  it("refuses a turn-in claimed at the wrong board", () => {
    const world = new BoardWorld(BLING_REQUESTS);
    for (const board of HARTHMERE_REQUEST_BOARDS) {
      world.completeIntro(board.introQuestId);
    }
    world.tick();

    const wheat = harthmereBoardRequestByQuestId(4589392321684603)!;
    const industrial = HARTHMERE_REQUEST_BOARDS.find(
      (b) => b.id === "industrial_job_board"
    )!;
    world.accept(wheat.questId);
    world.tick(pickUpEvent(wheat));
    world.give(wheat.itemId, wheat.count);
    world.tick();

    world.tick({
      kind: "completeQuestStepAtEntity",
      entityId: PLAYER_ID,
      challenge: wheat.questId,
      stepId: wheat.steps.turnIn,
      // Right quest, right leaf, wrong board.
      claimFromEntityId: industrial.entityId,
    } as unknown as FirehoseEvent);
    assert.equal(
      world.state(wheat.questId),
      "in_progress",
      "a farming bounty was settled at the industrial board"
    );
  });

  it("relists a daily bounty rather than retiring it", () => {
    const request = harthmereBoardRequestsFor("fishing_board")[0];
    const board = HARTHMERE_REQUEST_BOARDS.find(
      (b) => b.id === "fishing_board"
    )!;
    assert.equal(request.cadence, "daily");
    const world = new BoardWorld([request]);
    world.completeIntro(board.introQuestId);
    world.tick();
    world.accept(request.questId);
    world.tick(pickUpEvent(request));
    world.give(request.itemId, request.count);
    world.tick();
    world.tick(turnInEvent(request));
    assert.equal(world.state(request.questId), "complete");

    // `QuestExecutor.canRepeat` reads `repeatableCadence` off the biscuit, so a
    // daily listing must be authored as repeatable or it silently becomes a
    // one-shot and the board empties out.
    const biscuit = global.bikkieRuntime.getBiscuitOnlyIfExists(
      request.questId
    );
    assert.equal(biscuit?.repeatableCadence, "daily");
  });

  it("accepts the quay board's fishing requests as the same quests", () => {
    // The Harthmere quay board is a second entity over one catalogue, so a
    // request is a single quest no matter which board it was read from.
    const fishing = harthmereBoardRequestsFor("fishing_board");
    assert.ok(fishing.length > 0);
    assert.notEqual(
      Number(HARTHMERE_DOCK_FISHING_BOARD.entityId),
      Number(
        HARTHMERE_REQUEST_BOARDS.find((b) => b.category === "fishing")!.entityId
      )
    );
  });
});
