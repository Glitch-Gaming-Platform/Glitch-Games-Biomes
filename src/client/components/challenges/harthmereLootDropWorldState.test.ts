import assert from "assert";

// HARTHMERE_LOOT_DROP_WORLD_STATE (audit fix, 2026-07-13)
//
// Covers the store feeding the loot-drop world renderer: only available,
// positioned, unexpired drops are renderable; revisions bump on publish; and
// listeners are notified (and can unsubscribe).

import {
  getHarthmereWorldLootDrops,
  getHarthmereWorldLootDropsRevision,
  publishHarthmereWorldLootDrops,
  resetHarthmereWorldLootDropsForTest,
  subscribeHarthmereWorldLootDrops,
} from "@/client/components/challenges/harthmereLootDropWorldState";
import type { HarthmereInventoryLootDrop } from "@/shared/harthmere/mmo_inventory_loot_authority";

const NOW_MS = 1_700_000_000_000;

function drop(
  overrides: Partial<HarthmereInventoryLootDrop> = {}
): HarthmereInventoryLootDrop {
  return {
    dropId: `drop_${Math.random().toString(36).slice(2)}`,
    sourceKind: "actor_drop",
    sourceId: "player_test",
    itemStacks: { rough_stone: 1 },
    instanceIds: [],
    ownerActorIds: ["player_test"],
    pickupToken: "token",
    createdAtMs: NOW_MS,
    expiresAtMs: NOW_MS + 60_000,
    status: "available",
    abuseFlags: [],
    firstTimeTags: [],
    position: { x: 512, y: 54, z: -152 },
    ...overrides,
  } as HarthmereInventoryLootDrop;
}

describe("HARTHMERE_LOOT_DROP_WORLD_STATE", () => {
  beforeEach(() => resetHarthmereWorldLootDropsForTest());

  it("publishes available, positioned, unexpired drops", () => {
    publishHarthmereWorldLootDrops([drop()], NOW_MS);
    assert.strictEqual(getHarthmereWorldLootDrops().length, 1);
  });

  it("filters claimed, expired, and unpositioned drops out of the world view", () => {
    publishHarthmereWorldLootDrops(
      [
        drop({ status: "claimed" }),
        drop({ expiresAtMs: NOW_MS - 1 }),
        drop({ position: undefined }),
        drop(), // the only renderable one
      ],
      NOW_MS
    );
    assert.strictEqual(getHarthmereWorldLootDrops().length, 1);
  });

  it("bumps the revision on every publish so the renderer can change-detect", () => {
    const before = getHarthmereWorldLootDropsRevision();
    publishHarthmereWorldLootDrops([], NOW_MS);
    publishHarthmereWorldLootDrops([drop()], NOW_MS);
    assert.strictEqual(getHarthmereWorldLootDropsRevision(), before + 2);
  });

  it("notifies subscribers and honors unsubscribe", () => {
    let calls = 0;
    const unsubscribe = subscribeHarthmereWorldLootDrops(() => {
      calls += 1;
    });
    publishHarthmereWorldLootDrops([drop()], NOW_MS);
    assert.strictEqual(calls, 1);
    unsubscribe();
    publishHarthmereWorldLootDrops([], NOW_MS);
    assert.strictEqual(calls, 1);
  });

  it("a throwing listener never breaks publishing", () => {
    subscribeHarthmereWorldLootDrops(() => {
      throw new Error("listener bug");
    });
    assert.doesNotThrow(() => publishHarthmereWorldLootDrops([drop()], NOW_MS));
    assert.strictEqual(getHarthmereWorldLootDrops().length, 1);
  });
});
