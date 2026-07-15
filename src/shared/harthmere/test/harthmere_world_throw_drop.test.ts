/**
 * HARTHMERE_WORLD_THROW_DROP (audit fix, 2026-07-13)
 *
 * Covers the audit finding "thrown Harthmere items never appear in the
 * world": drop_item only debited the inventory and the item vanished. Now a
 * drop_item carrying a world `position` creates a positioned, claimable,
 * shared loot drop after the debit — and the debit still happens exactly
 * once. Also pins the quest-item protection and the claim round trip.
 */

import assert from "assert";
import { BikkieIds } from "@/shared/bikkie/ids";
import {
  defaultHarthmereLiveModeBackendState,
  reduceHarthmereLiveModeBackendState,
  type HarthmereLiveModeActionKind,
  type HarthmereLiveModeAuthorityEnvelope,
  type HarthmereLiveModeBackendState,
} from "../live_mode_backend";
import { createHarthmereDebitedWorldDrop } from "../mmo_inventory_loot_authority";

const NOW_MS = 1_700_000_000_000;
const ACTOR = "player_throw_drop_001";
const THROW_POSITION = { x: 512.4, y: 54, z: -152.8 };

let _seq = 0;
function nextId() {
  return `throw-drop-req-${++_seq}`;
}

function makeEnvelope(
  actionKind: HarthmereLiveModeActionKind,
  payload: Record<string, unknown> = {}
): HarthmereLiveModeAuthorityEnvelope {
  return {
    requestId: nextId(),
    idempotencyKey: nextId(),
    actorId: ACTOR,
    actionKind,
    subsystem: "inventory",
    source: "client_request",
    serverReceivedAtMs: NOW_MS,
    serverTick: 1,
    actorEntityVersion: 1,
    zoneId: "harthmere_wilderness",
    payload,
    clientClaims: {},
  };
}

function freshState(): HarthmereLiveModeBackendState {
  return defaultHarthmereLiveModeBackendState(ACTOR, NOW_MS);
}

function applyOne(
  state: HarthmereLiveModeBackendState,
  actionKind: HarthmereLiveModeActionKind,
  payload: Record<string, unknown> = {}
) {
  return reduceHarthmereLiveModeBackendState(
    state,
    makeEnvelope(actionKind, payload),
    NOW_MS
  );
}

function availableDrops(state: HarthmereLiveModeBackendState) {
  return Object.values(state.inventoryLoot.lootDrops).filter(
    (drop) => drop.status === "available"
  );
}

describe("HARTHMERE_WORLD_THROW_DROP", () => {
  it("drop_item WITH a position debits once and creates a positioned world drop", () => {
    const s = freshState();
    const grassBlockItemId = `b:${BikkieIds.grass}`;
    s.inventory.items[grassBlockItemId] = 10;

    const { state, summary } = applyOne(s, "request_inventory_item_action", {
      operation: "drop_item",
      itemId: grassBlockItemId,
      count: 2,
      position: THROW_POSITION,
      source: "Threw Grass",
    });

    // Debited exactly once.
    assert.strictEqual(state.inventory.items[grassBlockItemId], 8);
    // A shared, positioned, claimable world drop exists.
    const drops = availableDrops(state);
    assert.strictEqual(drops.length, 1);
    assert.deepStrictEqual(drops[0].position, THROW_POSITION);
    assert.strictEqual(drops[0].itemStacks[grassBlockItemId], 2);
    assert.strictEqual(drops[0].sourceKind, "actor_drop");
    assert.strictEqual(drops[0].sourceId, ACTOR);
    assert.ok(drops[0].expiresAtMs > NOW_MS, "throw drops must expire");
    assert.ok(summary.touchedModels.includes("inventory_loot_drops"));
    // Shared-state key so other players see (and can salvage) the drop.
    assert.ok(
      summary.sharedStateKeys.some((key) => key.includes("loot_drop")),
      "throw drop must be broadcast through shared state"
    );
  });

  it("drop_item WITHOUT a position keeps the legacy debit-only behaviour", () => {
    const s = freshState();
    const grassBlockItemId = `b:${BikkieIds.grass}`;
    s.inventory.items[grassBlockItemId] = 5;

    const { state } = applyOne(s, "request_inventory_item_action", {
      operation: "drop_item",
      itemId: grassBlockItemId,
      count: 1,
    });

    assert.strictEqual(state.inventory.items[grassBlockItemId], 4);
    assert.strictEqual(availableDrops(state).length, 0);
  });

  it("a thrown drop can be claimed back through the normal loot-claim path", () => {
    const s = freshState();
    const grassBlockItemId = `b:${BikkieIds.grass}`;
    s.inventory.items[grassBlockItemId] = 3;

    const thrown = applyOne(s, "request_inventory_item_action", {
      operation: "drop_item",
      itemId: grassBlockItemId,
      count: 1,
      position: THROW_POSITION,
    });
    const drop = availableDrops(thrown.state)[0];
    assert.ok(drop, "world drop must exist after the throw");

    const claimed = applyOne(thrown.state, "request_loot_claim", {
      dropId: drop.dropId,
      pickupToken: drop.pickupToken,
    });
    assert.strictEqual(
      claimed.state.inventoryLoot.lootDrops[drop.dropId]?.status,
      "claimed"
    );
    // The item is back with the player (3 - 1 thrown + 1 claimed). Material
    // category claims may route into material storage instead of the
    // backpack, so count both locations.
    const backpackCount = claimed.state.inventory.items[grassBlockItemId] ?? 0;
    const materialCount =
      claimed.state.banking.materialStorage[grassBlockItemId] ?? 0;
    assert.strictEqual(backpackCount + materialCount, 3);
  });

  it("createHarthmereDebitedWorldDrop refuses quest-bound items and bad positions", () => {
    const s = freshState();
    const ctx = {
      itemDefinitions: {
        quest_relic: {
          itemId: "quest_relic",
          displayName: "Quest Relic",
          category: "quest" as const,
          rarity: "rare" as const,
          maxStackSize: 1,
          baseValueGold: 0,
          weight: 1,
          volume: 1,
          binding: "quest" as const,
          tradeable: false,
          legalClass: "quest_bound" as const,
          allowedStorage: ["backpack" as const],
          businessUses: [],
          jobUses: [],
          townNeeds: [],
          perishable: false,
          hazardLevel: 0,
          contaminationRisk: 0,
          repairable: false,
          lootTableTags: [],
          uniqueInstance: true,
        },
      },
      lootTables: {},
    };
    assert.strictEqual(
      createHarthmereDebitedWorldDrop(s.inventoryLoot, ctx, {
        requestId: nextId(),
        actorId: ACTOR,
        nowMs: NOW_MS,
        itemId: "quest_relic",
        count: 1,
        position: THROW_POSITION,
      }),
      undefined,
      "quest-bound items must never become world drops"
    );
    assert.strictEqual(
      createHarthmereDebitedWorldDrop(s.inventoryLoot, ctx, {
        requestId: nextId(),
        actorId: ACTOR,
        nowMs: NOW_MS,
        itemId: "quest_relic",
        count: 1,
        position: { x: NaN, y: 0, z: 0 },
      }),
      undefined,
      "non-finite positions must be rejected"
    );
  });
});
