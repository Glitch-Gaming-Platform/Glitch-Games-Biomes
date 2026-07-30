import assert from "assert";

import { HARTHMERE_BUILDINGS } from "@/shared/harthmere/harthmere_town_buildings";
import { harthmereRiverContains } from "@/shared/harthmere/harthmere_river";
import { harthmereStillWaterContains } from "@/shared/harthmere/harthmere_still_water";
import {
  HARTHMERE_BOARD_CATEGORY_ITEM_ATTRIBUTES,
  HARTHMERE_BOARD_CURRENCY_IDS,
  HARTHMERE_BOARD_MINIMUM_PAYOUT,
  HARTHMERE_BOARD_REQUEST_DEFECTS,
  HARTHMERE_BOARD_REQUESTS,
  HARTHMERE_COLLECTIVE_EVENT_REQUESTS,
  HARTHMERE_DOCK_FISHING_BOARD,
  HARTHMERE_ICED_BOARD_ENTITY_IDS,
  HARTHMERE_REQUEST_BOARDS,
  HARTHMERE_ROYAL_FLUSH_AUTHORED_TAKE_ITEM_ID,
  harthmereBoardAcceptsItem,
  harthmereBoardProjectedTriggerName,
  harthmereBoardRequestByQuestId,
  harthmereBoardRequestCanTurnIn,
  harthmereBoardRequestRemaining,
  harthmereBoardRequestResetsAt,
  harthmereBoardRequestState,
  harthmereBoardRequestStepKind,
  harthmereBoardRequestsFor,
  harthmereBoardRequestsForEntity,
  harthmereBoardStanding,
  harthmereBoardSuggestedPayout,
  harthmereOtherBoards,
  harthmereRequestBoardByEntityId,
} from "@/shared/harthmere/native_request_boards";

/**
 * HARTHMERE_REQUEST_BOARDS — the four snapshot request boards as one system.
 *
 * The two things most likely to break this are structural rather than
 * cosmetic, and both are covered first:
 *
 *   1. every Bling bounty shares its trigger ids, so any routing keyed on a
 *      leaf id alone silently merges all seven boards' requests;
 *   2. all four boards are iced, so nothing is reachable until they are
 *      restored.
 */

function progress(overrides: Partial<{
  introComplete: boolean;
  pickedUp: boolean;
  heldCount: number;
  turnedIn: boolean;
}> = {}) {
  return {
    introComplete: true,
    pickedUp: true,
    heldCount: 0,
    turnedIn: false,
    ...overrides,
  };
}

describe("Harthmere request boards", () => {
  describe("the boards themselves", () => {
    it("registers all four, each with a distinct entity and category", () => {
      assert.equal(HARTHMERE_REQUEST_BOARDS.length, 4);
      const entityIds = HARTHMERE_REQUEST_BOARDS.map((b) => Number(b.entityId));
      assert.equal(new Set(entityIds).size, 4);
      assert.deepEqual(
        HARTHMERE_REQUEST_BOARDS.map((b) => b.category).sort(),
        ["farming", "fishing", "industrial", "research"]
      );
      assert.equal(new Set(HARTHMERE_REQUEST_BOARDS.map((b) => b.id)).size, 4);
    });

    it("lists every board for restoration", () => {
      // All four are `iced` in the restored world; until they are thawed the
      // whole catalogue is unreachable.
      assert.equal(HARTHMERE_ICED_BOARD_ENTITY_IDS.length, 4);
      for (const board of HARTHMERE_REQUEST_BOARDS) {
        assert.ok(
          HARTHMERE_ICED_BOARD_ENTITY_IDS.some(
            (id) => Number(id) === Number(board.entityId)
          ),
          `${board.label} is not in the restore manifest`
        );
      }
    });

    it("resolves a board from its entity id", () => {
      for (const board of HARTHMERE_REQUEST_BOARDS) {
        assert.equal(
          harthmereRequestBoardByEntityId(board.entityId)?.id,
          board.id
        );
      }
      assert.equal(harthmereRequestBoardByEntityId(1), undefined);
      assert.equal(harthmereRequestBoardByEntityId(undefined), undefined);
    });

    it("pays research in tokens and everything else in Bling", () => {
      for (const board of HARTHMERE_REQUEST_BOARDS) {
        assert.equal(
          board.payoutItemId,
          board.category === "research"
            ? HARTHMERE_BOARD_CURRENCY_IDS.COLLECTIVE_TOKEN
            : HARTHMERE_BOARD_CURRENCY_IDS.BLING,
          `${board.label} pays the wrong currency`
        );
      }
    });

    it("connects every board to the other three", () => {
      for (const board of HARTHMERE_REQUEST_BOARDS) {
        const others = harthmereOtherBoards(board.id);
        assert.equal(others.length, 3);
        assert.ok(!others.some((other) => other.id === board.id));
      }
    });
  });

  describe("the shared-trigger-id hazard", () => {
    it("really does reuse leaf ids across different boards", () => {
      // This is not a defect to fix, it is a fact to defend against — and if
      // it ever stops being true, the guards below become dead weight and
      // should be revisited rather than silently kept.
      const bling = HARTHMERE_BOARD_REQUESTS.filter(
        (r) => r.payItemId === HARTHMERE_BOARD_CURRENCY_IDS.BLING
      );
      assert.ok(bling.length >= 7);
      assert.equal(
        new Set(bling.map((r) => Number(r.steps.gather))).size,
        1,
        "the Bling bounties no longer share a gather leaf"
      );
      assert.equal(
        new Set(bling.map((r) => Number(r.steps.turnIn))).size,
        1,
        "the Bling bounties no longer share a turn-in leaf"
      );
      // And they span more than one board, which is what makes it dangerous.
      assert.ok(new Set(bling.map((r) => r.boardId)).size >= 3);
    });

    it("refuses to identify a step without its quest", () => {
      const wheat = harthmereBoardRequestByQuestId(4589392321684603);
      const stone = harthmereBoardRequestByQuestId(7193493460362756);
      assert.ok(wheat && stone);
      assert.equal(Number(wheat!.steps.gather), Number(stone!.steps.gather));
      // Same leaf id, different quests: each must resolve against its own root.
      assert.equal(
        harthmereBoardRequestStepKind(wheat!.questId, wheat!.steps.gather),
        "gather"
      );
      assert.equal(
        harthmereBoardRequestStepKind(stone!.questId, stone!.steps.gather),
        "gather"
      );
      // An unknown quest never resolves, however familiar the leaf looks.
      assert.equal(
        harthmereBoardRequestStepKind(999999, wheat!.steps.gather),
        undefined
      );
    });

    it("keeps every quest id unique even though leaves are not", () => {
      const questIds = HARTHMERE_BOARD_REQUESTS.map((r) => Number(r.questId));
      assert.equal(new Set(questIds).size, questIds.length);
      const eventIds = HARTHMERE_COLLECTIVE_EVENT_REQUESTS.map((r) =>
        Number(r.questId)
      );
      assert.equal(new Set(eventIds).size, eventIds.length);
      assert.equal(
        new Set([...questIds, ...eventIds]).size,
        questIds.length + eventIds.length,
        "a delivery listing and an event listing share a quest id"
      );
    });
  });

  describe("the catalogue", () => {
    it("gives every board at least one request", () => {
      for (const board of HARTHMERE_REQUEST_BOARDS) {
        const requests = harthmereBoardRequestsFor(board.id);
        const events =
          board.category === "research"
            ? HARTHMERE_COLLECTIVE_EVENT_REQUESTS.length
            : 0;
        assert.ok(
          requests.length + events > 0,
          `${board.label} has nothing on it`
        );
      }
    });

    it("keeps the Collective's listings, which are the worked example", () => {
      const research = harthmereBoardRequestsFor("collective_research_board");
      // Seven deliveries plus six event listings is the authored thirteen.
      assert.equal(research.length, 7);
      assert.equal(HARTHMERE_COLLECTIVE_EVENT_REQUESTS.length, 6);
      assert.equal(research.length + HARTHMERE_COLLECTIVE_EVENT_REQUESTS.length, 13);
      for (const request of research) {
        assert.equal(
          request.payItemId,
          HARTHMERE_BOARD_CURRENCY_IDS.COLLECTIVE_TOKEN
        );
      }
    });

    it("asks for what it takes, on every well-formed request", () => {
      for (const request of HARTHMERE_BOARD_REQUESTS) {
        assert.equal(
          Number(request.takeItemId),
          Number(request.itemId),
          `${request.title} takes an item it never asked for`
        );
        assert.equal(request.takeCount, request.count);
      }
    });

    it("never lists a free or negative request", () => {
      for (const request of HARTHMERE_BOARD_REQUESTS) {
        assert.ok(request.count > 0, `${request.title} asks for nothing`);
        assert.ok(request.payCount > 0, `${request.title} pays nothing`);
      }
    });

    it("records both authoring defects and repairs them", () => {
      assert.equal(HARTHMERE_BOARD_REQUEST_DEFECTS.length, 2);
      const kinds = HARTHMERE_BOARD_REQUEST_DEFECTS.map((r) => r.defect).sort();
      assert.deepEqual(kinds, ["no_payout", "take_item_mismatch"]);

      // Punk'd: the snapshot's reward leaf is an empty array, so it paid zero.
      const punkd = harthmereBoardRequestByQuestId(4879502557032659);
      assert.equal(punkd?.defect, "no_payout");
      assert.ok((punkd?.payCount ?? 0) > 0, "Punk'd still pays nothing");

      // Royal Flush: the snapshot confiscated an item never asked for.
      const royalFlush = harthmereBoardRequestByQuestId(214309461279408);
      assert.equal(royalFlush?.defect, "take_item_mismatch");
      assert.notEqual(
        Number(royalFlush?.takeItemId),
        Number(HARTHMERE_ROYAL_FLUSH_AUTHORED_TAKE_ITEM_ID),
        "Royal Flush still takes the Royal Gramma"
      );
      assert.equal(
        Number(royalFlush?.takeItemId),
        Number(royalFlush?.itemId),
        "Royal Flush's take was repaired to the wrong item"
      );
    });
  });

  describe("category rules", () => {
    it("keeps each board to its own goods", () => {
      assert.equal(harthmereBoardAcceptsItem("fishing", { isFish: true }), true);
      assert.equal(
        harthmereBoardAcceptsItem("fishing", { isVegetable: true }),
        false
      );
      assert.equal(
        harthmereBoardAcceptsItem("farming", { isVegetable: true }),
        true
      );
      assert.equal(harthmereBoardAcceptsItem("farming", { isFish: true }), false);
      assert.equal(
        harthmereBoardAcceptsItem("industrial", { isAnyStone: true }),
        true
      );
      assert.equal(
        harthmereBoardAcceptsItem("industrial", { isFish: true }),
        false
      );
    });

    it("lets the Collective study anything", () => {
      assert.equal(HARTHMERE_BOARD_CATEGORY_ITEM_ATTRIBUTES.research, "any");
      for (const attributes of [
        { isFish: true },
        { isVegetable: true },
        { isBlock: true },
        {},
      ]) {
        assert.equal(harthmereBoardAcceptsItem("research", attributes), true);
      }
    });

    it("rejects an unrecognised item everywhere but research", () => {
      // A board that accepts anything is a board with no identity.
      for (const category of ["fishing", "farming", "industrial"] as const) {
        assert.equal(harthmereBoardAcceptsItem(category, {}), false);
        assert.equal(
          harthmereBoardAcceptsItem(category, { isWearable: true }),
          false
        );
      }
    });

    it("treats a falsy attribute as absent", () => {
      assert.equal(
        harthmereBoardAcceptsItem("fishing", { isFish: false }),
        false
      );
      assert.equal(
        harthmereBoardAcceptsItem("fishing", { isFish: undefined }),
        false
      );
    });
  });

  describe("pricing", () => {
    it("pays more per unit of effort on the harder boards", () => {
      const fishing = harthmereBoardSuggestedPayout({
        category: "fishing",
        count: 10,
        itemSellPrice: 5,
      });
      const farming = harthmereBoardSuggestedPayout({
        category: "farming",
        count: 10,
        itemSellPrice: 5,
      });
      const industrial = harthmereBoardSuggestedPayout({
        category: "industrial",
        count: 10,
        itemSellPrice: 5,
      });
      assert.ok(fishing > farming);
      assert.ok(farming > industrial);
    });

    it("never offers less than it is worth walking over for", () => {
      for (const category of ["fishing", "farming", "industrial"] as const) {
        assert.ok(
          harthmereBoardSuggestedPayout({ category, count: 1, itemSellPrice: 0 }) >=
            HARTHMERE_BOARD_MINIMUM_PAYOUT
        );
      }
    });

    it("survives missing, negative and absurd inputs", () => {
      assert.ok(
        harthmereBoardSuggestedPayout({ category: "fishing", count: 5 }) > 0
      );
      assert.equal(
        harthmereBoardSuggestedPayout({
          category: "fishing",
          count: -5,
          itemSellPrice: 5,
        }),
        HARTHMERE_BOARD_MINIMUM_PAYOUT
      );
      assert.equal(
        harthmereBoardSuggestedPayout({
          category: "fishing",
          count: 5,
          itemSellPrice: -100,
        }),
        HARTHMERE_BOARD_MINIMUM_PAYOUT
      );
      assert.ok(
        Number.isFinite(
          harthmereBoardSuggestedPayout({
            category: "farming",
            count: 5,
            itemSellPrice: Number.NaN,
          })
        )
      );
    });

    it("leaves the snapshot's own prices alone", () => {
      // The authored numbers are canon even where they are a bad deal: sixty
      // four Limestone Bricks for ten Bling is the offer the snapshot makes.
      const bricks = harthmereBoardRequestByQuestId(3750760121162678);
      assert.equal(bricks?.count, 64);
      assert.equal(bricks?.payCount, 10);
      const silver = harthmereBoardRequestByQuestId(1006083001460253);
      assert.equal(silver?.count, 2);
      assert.equal(silver?.payCount, 100);
    });
  });

  describe("lifecycle", () => {
    const wheat = harthmereBoardRequestByQuestId(4589392321684603)!;

    it("walks a request from locked to paid", () => {
      assert.equal(
        harthmereBoardRequestState(wheat, progress({ introComplete: false })),
        "locked"
      );
      assert.equal(
        harthmereBoardRequestState(wheat, progress({ pickedUp: false })),
        "available"
      );
      assert.equal(
        harthmereBoardRequestState(wheat, progress({ heldCount: 3 })),
        "in_progress"
      );
      assert.equal(
        harthmereBoardRequestState(wheat, progress({ heldCount: wheat.count })),
        "ready_to_turn_in"
      );
      assert.equal(
        harthmereBoardRequestState(wheat, progress({ turnedIn: true })),
        "completed"
      );
    });

    it("counts what is still owed, and never past the ends", () => {
      assert.equal(harthmereBoardRequestRemaining(wheat, 0), wheat.count);
      assert.equal(harthmereBoardRequestRemaining(wheat, 4), wheat.count - 4);
      assert.equal(harthmereBoardRequestRemaining(wheat, wheat.count), 0);
      // Overshoot and nonsense must not produce a negative debt.
      assert.equal(harthmereBoardRequestRemaining(wheat, wheat.count + 99), 0);
      assert.equal(harthmereBoardRequestRemaining(wheat, -5), wheat.count);
      assert.equal(harthmereBoardRequestRemaining(wheat, Number.NaN), wheat.count);
    });

    it("blocks a turn-in the server would silently refuse", () => {
      // `inventoryHas` only checks a total, so a player can reach the board and
      // drop the goods before handing them over. `itemsToTake` would then fail
      // and the leaf would quietly not fire.
      assert.equal(
        harthmereBoardRequestCanTurnIn(wheat, progress({ heldCount: wheat.count })),
        true
      );
      assert.equal(
        harthmereBoardRequestCanTurnIn(
          wheat,
          progress({ heldCount: wheat.count - 1 })
        ),
        false
      );
      assert.equal(
        harthmereBoardRequestCanTurnIn(
          wheat,
          progress({ heldCount: wheat.count, introComplete: false })
        ),
        false
      );
      assert.equal(
        harthmereBoardRequestCanTurnIn(
          wheat,
          progress({ heldCount: wheat.count, turnedIn: true })
        ),
        false
      );
    });

    it("relists a daily request at the next UTC midnight", () => {
      const noon = Date.UTC(2026, 6, 29, 12, 0, 0);
      const reset = harthmereBoardRequestResetsAt(wheat, noon);
      assert.equal(reset, Date.UTC(2026, 6, 30, 0, 0, 0));
      assert.ok(reset! > noon);
      // A minute before midnight still resets the same night.
      const lateNight = Date.UTC(2026, 6, 29, 23, 59, 0);
      assert.equal(
        harthmereBoardRequestResetsAt(wheat, lateNight),
        Date.UTC(2026, 6, 30, 0, 0, 0)
      );
    });

    it("never relists a one-shot research listing", () => {
      const research = harthmereBoardRequestByQuestId(3115411814768521)!;
      assert.equal(research.cadence, "never");
      assert.equal(harthmereBoardRequestResetsAt(research, Date.now()), undefined);
    });
  });

  describe("standing across the boards", () => {
    it("starts at nothing", () => {
      assert.equal(harthmereBoardStanding([]), 0);
    });

    it("counts research higher than a daily bounty", () => {
      const bounty = harthmereBoardStanding([4589392321684603]);
      const research = harthmereBoardStanding([6399652626343596]);
      assert.ok(research > bounty);
    });

    it("adds up across different boards", () => {
      const both = harthmereBoardStanding([
        4589392321684603, // Farming Bounties
        7193493460362756, // Industrial Job Board
      ]);
      assert.equal(both, harthmereBoardStanding([4589392321684603]) * 2);
    });

    it("ignores quests that are not board requests", () => {
      assert.equal(harthmereBoardStanding([1, 2, 3]), 0);
    });

    it("does not double-count a repeated id", () => {
      assert.equal(
        harthmereBoardStanding([4589392321684603, 4589392321684603]),
        harthmereBoardStanding([4589392321684603])
      );
    });

    it("counts the Collective's event listings too", () => {
      assert.ok(harthmereBoardStanding([6257698449427345]) > 0);
    });
  });

  describe("the Harthmere quay board", () => {
    it("shares the fishing catalogue with the original board", () => {
      const quay = harthmereBoardRequestsForEntity(
        HARTHMERE_DOCK_FISHING_BOARD.entityId
      );
      const original = harthmereBoardRequestsForEntity(
        HARTHMERE_REQUEST_BOARDS.find((b) => b.category === "fishing")!.entityId
      );
      assert.ok(quay.length > 0);
      assert.deepEqual(
        quay.map((r) => Number(r.questId)),
        original.map((r) => Number(r.questId))
      );
    });

    it("has its own entity id, distinct from all four snapshot boards", () => {
      for (const board of HARTHMERE_REQUEST_BOARDS) {
        assert.notEqual(
          Number(board.entityId),
          Number(HARTHMERE_DOCK_FISHING_BOARD.entityId)
        );
      }
    });

    it("stands on dry land beside the water", () => {
      const [x, z] = HARTHMERE_DOCK_FISHING_BOARD.authoredPosition;
      assert.equal(
        harthmereRiverContains(x, z),
        false,
        "the board is standing in the river"
      );
      assert.equal(harthmereStillWaterContains(x, z), false);
      // But close enough to the water to be a quay board.
      let nearestWater = Infinity;
      for (let dx = -20; dx <= 20; dx += 1) {
        for (let dz = -20; dz <= 20; dz += 1) {
          if (harthmereRiverContains(x + dx, z + dz)) {
            nearestWater = Math.min(nearestWater, Math.hypot(dx, dz));
          }
        }
      }
      assert.ok(
        nearestWater <= 12,
        `the quay board is ${nearestWater.toFixed(1)} from the water`
      );
    });

    it("does not stand inside a building", () => {
      const [x, z] = HARTHMERE_DOCK_FISHING_BOARD.authoredPosition;
      for (const building of HARTHMERE_BUILDINGS) {
        const inside =
          x >= building.x0 &&
          x <= building.x1 &&
          z >= building.z0 &&
          z <= building.z1;
        assert.equal(inside, false, `the quay board is inside ${building.name}`);
      }
    });

    it("is near the docks it serves", () => {
      const [x, z] = HARTHMERE_DOCK_FISHING_BOARD.authoredPosition;
      const dock = HARTHMERE_BUILDINGS.find(
        (b) => b.name === "dock_warehouse"
      )!;
      const dx = Math.max(dock.x0 - x, 0, x - dock.x1);
      const dz = Math.max(dock.z0 - z, 0, z - dock.z1);
      assert.ok(
        Math.hypot(dx, dz) <= 20,
        "the quay board is nowhere near the docks"
      );
    });
  });

  describe("restored-world projections", () => {
    it("names the pick-up leaf the snapshot left blank", () => {
      for (const request of HARTHMERE_BOARD_REQUESTS) {
        if (request.payItemId !== HARTHMERE_BOARD_CURRENCY_IDS.BLING) continue;
        const projected = harthmereBoardProjectedTriggerName(
          request.steps.pickUp
        );
        assert.ok(
          projected && projected.length > 0,
          `${request.title} opens on a blank objective`
        );
      }
    });

    it("leaves every other leaf alone", () => {
      assert.equal(harthmereBoardProjectedTriggerName(123456), undefined);
    });
  });
});
