import {
  findNewTradeWithPlayer,
  waitForNewTradeWithPlayer,
} from "@/client/components/inventory/helpers";
import { ActiveTrades } from "@/shared/ecs/gen/components";
import type { BiomesId } from "@/shared/ids";
import assert from "assert";

const SELF = 101 as BiomesId;
const OTHER = 102 as BiomesId;
const OLD_TRADE = 201 as BiomesId;
const NEW_TRADE = 202 as BiomesId;

function activeTrades(...tradeIds: BiomesId[]) {
  return ActiveTrades.create({
    trades: tradeIds.map((trade_id) => ({
      trade_id,
      id1: SELF,
      id2: OTHER,
    })),
  });
}

describe("native trade discovery", () => {
  it("selects only a new trade with the requested player", () => {
    assert.equal(
      findNewTradeWithPlayer(
        activeTrades(OLD_TRADE, NEW_TRADE),
        OTHER,
        new Set([OLD_TRADE])
      )?.trade_id,
      NEW_TRADE
    );
  });

  it("falls back to authoritative OOB state when Sync is late", async () => {
    let authoritativeReads = 0;
    const trade = await waitForNewTradeWithPlayer({
      otherUserId: OTHER,
      knownTradeIds: new Set([OLD_TRADE]),
      readLocalActiveTrades: () => activeTrades(OLD_TRADE),
      fetchAuthoritativeActiveTrades: async () => {
        authoritativeReads += 1;
        return activeTrades(OLD_TRADE, NEW_TRADE);
      },
      localTimeoutMs: 1,
    });

    assert.equal(trade.trade_id, NEW_TRADE);
    assert.equal(authoritativeReads, 1);
  });

  it("preserves the timeout when neither Sync nor OOB has a new trade", async () => {
    await assert.rejects(
      waitForNewTradeWithPlayer({
        otherUserId: OTHER,
        knownTradeIds: new Set([OLD_TRADE]),
        readLocalActiveTrades: () => activeTrades(OLD_TRADE),
        fetchAuthoritativeActiveTrades: async () => activeTrades(OLD_TRADE),
        localTimeoutMs: 1,
      }),
      /Timed out waiting for trade to be created/
    );
  });
});
