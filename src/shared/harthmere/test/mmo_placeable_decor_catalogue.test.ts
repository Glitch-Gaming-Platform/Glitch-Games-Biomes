import assert from "assert";
import {
  getHarthmereCraftingRecipe,
  getHarthmereItemDefinition,
  getHarthmereVendorEntry,
  reduceHarthmereInventoryMutation,
  type HarthmereInventoryMutationKind,
  type HarthmereInventoryMutationRequest,
  type HarthmereInventorySnapshot,
} from "../mmo_inventory_authority";
import {
  HARTHMERE_NEW_PLACEABLE_DECOR_SPECS,
  HARTHMERE_PLACEABLE_DECOR_SPECS,
  defaultHarthmerePlaceableWorldState,
  ensureHarthmerePlaceableDecorCatalogue,
  getHarthmerePlaceableDecorSpec,
  normalizeHarthmerePlaceableWorldState,
  placeableDecorRecipeId,
  reduceHarthmerePlaceableWorldMutation,
  type HarthmerePlaceableWorldState,
} from "../mmo_placeable_decor_catalogue";
import {
  getHarthmereHomeDecorationDefinition,
  listHarthmereHomeDecorationDefinitions,
} from "../home_decoration_authority";

const NOW_MS = 1_760_500_000_000;
const ACTOR = "decor_player_1";
const OTHER = "decor_player_2";

function snapshot(
  overrides: Partial<HarthmereInventorySnapshot> = {}
): HarthmereInventorySnapshot {
  return {
    actorId: ACTOR,
    gold: 1_000,
    equipment: {},
    items: {},
    bank: {},
    escrow: {},
    consumableCooldowns: {},
    knownAbilities: [],
    knownRecipes: [],
    ...overrides,
  };
}

function mutate(
  kind: HarthmereInventoryMutationKind,
  base: HarthmereInventorySnapshot,
  overrides: Partial<HarthmereInventoryMutationRequest>,
  playerSkills: Record<string, { level: number }> = {}
) {
  return reduceHarthmereInventoryMutation(
    {
      requestId: `decor-test-${kind}`,
      actorId: ACTOR,
      kind,
      nowMs: NOW_MS,
      ...overrides,
    } as HarthmereInventoryMutationRequest,
    { snapshot: base, playerLevel: 10, playerSkills, reputation: {} }
  );
}

let placeSeq = 0;
function worldRequest(
  operation: "place_object" | "move_object" | "remove_object",
  fields: Record<string, unknown>,
  actorId = ACTOR
) {
  placeSeq += 1;
  return {
    requestId: `decor-world-${placeSeq}`,
    actorId,
    operation,
    nowMs: NOW_MS,
    ...fields,
  } as any;
}

describe("Harthmere placeable decor catalogue", () => {
  before(() => {
    ensureHarthmerePlaceableDecorCatalogue();
  });

  it("registers item + recipe + vendor entry for every NEW decor spec", () => {
    for (const spec of HARTHMERE_NEW_PLACEABLE_DECOR_SPECS) {
      const def = getHarthmereItemDefinition(spec.itemId);
      assert.ok(def, `missing item def for ${spec.itemId}`);
      assert.strictEqual(def!.baseValue, spec.price);

      if (spec.station && spec.inputs) {
        const recipe = getHarthmereCraftingRecipe(
          placeableDecorRecipeId(spec.itemId)
        );
        assert.ok(recipe, `missing recipe for ${spec.itemId}`);
        assert.strictEqual(recipe!.outputItemId, spec.itemId);
        assert.ok(recipe!.requiredStationId, `${spec.itemId} has no station`);
      }

      const entry = getHarthmereVendorEntry(spec.vendorId, spec.itemId);
      assert.ok(entry, `missing vendor entry for ${spec.itemId}`);
      assert.strictEqual(entry!.buyPrice, spec.price);
      assert.ok(entry!.sellPrice < entry!.buyPrice);
      assert.ok(entry!.sellPrice >= 1);
    }
  });

  it("adds purchase entries for existing stations/decor without duplicating their recipe", () => {
    const existing = HARTHMERE_PLACEABLE_DECOR_SPECS.filter((s) => s.existing);
    assert.ok(existing.length > 0, "expected some existing-item decor specs");
    for (const spec of existing) {
      // A purchase entry exists...
      const entry = getHarthmereVendorEntry(spec.vendorId, spec.itemId);
      assert.ok(entry, `existing item ${spec.itemId} should be purchasable`);
      // ...but we did NOT mint a duplicate placement recipe for it.
      assert.strictEqual(
        getHarthmereCraftingRecipe(placeableDecorRecipeId(spec.itemId)),
        undefined,
        `existing item ${spec.itemId} must not get a duplicate decor recipe`
      );
    }
  });

  it("crafts a furniture item from materials at its station", () => {
    const recipeId = placeableDecorRecipeId("bench");
    const recipe = getHarthmereCraftingRecipe(recipeId)!;
    const base = snapshot({
      items: { wood_plank: 8, iron_ingot: 2 },
      knownRecipes: [recipeId],
    });
    const result = mutate(
      "craft_item",
      base,
      { recipeId, stationId: recipe.requiredStationId, count: 1 },
      { carpentry: { level: 1 } }
    );
    assert.ok(result.ok, `craft failed: ${result.errors.join(",")}`);
    assert.strictEqual(result.itemDeltas["bench"], 1);
    assert.strictEqual(result.itemDeltas["wood_plank"], -4);
    assert.strictEqual(result.itemDeltas["iron_ingot"], -1);
  });

  it("purchases a furniture item from its vendor at the spec price", () => {
    const spec = getHarthmerePlaceableDecorSpec("bench")!;
    const entry = getHarthmereVendorEntry(spec.vendorId, "bench")!;
    const base = snapshot({ gold: 500 });
    const result = mutate("buy_from_vendor", base, {
      vendorId: spec.vendorId,
      itemId: "bench",
      count: 2,
    });
    assert.ok(result.ok, `buy failed: ${result.errors.join(",")}`);
    assert.strictEqual(result.goldDelta, -(entry.buyPrice * 2));
    assert.strictEqual(result.itemDeltas["bench"], 2);
  });

  it("exposes the new decor as owned-property placeable definitions", () => {
    const def = getHarthmereHomeDecorationDefinition("bench");
    assert.ok(def, "bench should be placeable on owned property");
    assert.strictEqual(def!.kind, "comfort");
    assert.ok(def!.allowedPropertyUses.includes("home"));
    assert.ok(def!.guidePlacement, "should have guide placement");
    // The whole new-decor set is reachable through the owned-property list.
    const ids = new Set(
      listHarthmereHomeDecorationDefinitions().map((d) => d.itemId)
    );
    for (const spec of HARTHMERE_NEW_PLACEABLE_DECOR_SPECS) {
      assert.ok(ids.has(spec.itemId), `${spec.itemId} missing from property list`);
    }
  });
});

describe("Harthmere free-world placement", () => {
  before(() => {
    ensureHarthmerePlaceableDecorCatalogue();
  });

  function freshWorld(): HarthmerePlaceableWorldState {
    return defaultHarthmerePlaceableWorldState();
  }

  it("places a held item anywhere on the terrain, consuming it", () => {
    const result = reduceHarthmerePlaceableWorldMutation(
      freshWorld(),
      worldRequest("place_object", {
        itemId: "bench",
        position: { x: 10, y: 0, z: 10 },
      }),
      { actorInventoryItems: { bench: 1 } }
    );
    assert.ok(result.ok, result.errors.join(","));
    assert.strictEqual(result.itemDeltas["bench"], -1);
    assert.ok(result.placedObjectId);
    assert.strictEqual(Object.keys(result.state.placed).length, 1);
    assert.strictEqual(
      result.state.placed[result.placedObjectId!].ownerId,
      ACTOR
    );
  });

  it("rejects placing without the item, off-bounds, or a non-placeable item", () => {
    const noItem = reduceHarthmerePlaceableWorldMutation(
      freshWorld(),
      worldRequest("place_object", { itemId: "bench", position: { x: 0, y: 0, z: 0 } }),
      { actorInventoryItems: {} }
    );
    assert.ok(!noItem.ok && noItem.errors.includes("missing_placeable_item"));

    const oob = reduceHarthmerePlaceableWorldMutation(
      freshWorld(),
      worldRequest("place_object", {
        itemId: "bench",
        position: { x: 9_999_999, y: 0, z: 0 },
      }),
      { actorInventoryItems: { bench: 1 } }
    );
    assert.ok(!oob.ok && oob.errors.includes("invalid_position"));

    // A natural/non-decor item id is not placeable through this system.
    const natural = reduceHarthmerePlaceableWorldMutation(
      freshWorld(),
      worldRequest("place_object", { itemId: "stone", position: { x: 0, y: 0, z: 0 } }),
      { actorInventoryItems: { stone: 10 } }
    );
    assert.ok(!natural.ok && natural.errors.includes("item_not_placeable"));
  });

  it("rejects overlapping placements", () => {
    const first = reduceHarthmerePlaceableWorldMutation(
      freshWorld(),
      worldRequest("place_object", { itemId: "bench", position: { x: 0, y: 0, z: 0 } }),
      { actorInventoryItems: { bench: 2 } }
    );
    const overlap = reduceHarthmerePlaceableWorldMutation(
      first.state,
      worldRequest("place_object", { itemId: "bench", position: { x: 1, y: 0, z: 0 } }),
      { actorInventoryItems: { bench: 1 } }
    );
    assert.ok(
      !overlap.ok &&
        overlap.errors.includes("placement_overlaps_existing_object")
    );
  });

  it("lets the owner move/remove, gates others unless allowEditOthers", () => {
    const placed = reduceHarthmerePlaceableWorldMutation(
      freshWorld(),
      worldRequest("place_object", { itemId: "bench", position: { x: 0, y: 0, z: 0 } }),
      { actorInventoryItems: { bench: 1 } }
    );
    const objectId = placed.placedObjectId!;

    // Another player cannot move it without permission.
    const blocked = reduceHarthmerePlaceableWorldMutation(
      placed.state,
      worldRequest("move_object", { objectId, position: { x: 20, y: 0, z: 20 } }, OTHER),
      { actorInventoryItems: {} }
    );
    assert.ok(!blocked.ok && blocked.errors.includes("not_object_owner"));

    // Owner can move it.
    const moved = reduceHarthmerePlaceableWorldMutation(
      placed.state,
      worldRequest("move_object", { objectId, position: { x: 30, y: 0, z: 30 } }),
      { actorInventoryItems: {} }
    );
    assert.ok(moved.ok, moved.errors.join(","));
    assert.strictEqual(moved.state.placed[objectId].position.x, 30);

    // Someone with edit-others (landowner/admin) may remove it.
    const removed = reduceHarthmerePlaceableWorldMutation(
      placed.state,
      worldRequest("remove_object", { objectId }, OTHER),
      { actorInventoryItems: {}, allowEditOthers: true }
    );
    assert.ok(removed.ok, removed.errors.join(","));
    assert.strictEqual(removed.itemDeltas["bench"], 1); // returned to inventory
    assert.strictEqual(Object.keys(removed.state.placed).length, 0);
  });

  it("is idempotent on requestId", () => {
    const req = worldRequest("place_object", {
      itemId: "bench",
      position: { x: 0, y: 0, z: 0 },
    });
    const first = reduceHarthmerePlaceableWorldMutation(freshWorld(), req, {
      actorInventoryItems: { bench: 1 },
    });
    const replay = reduceHarthmerePlaceableWorldMutation(first.state, req, {
      actorInventoryItems: { bench: 1 },
    });
    assert.ok(replay.ok);
    assert.deepStrictEqual(replay.itemDeltas, {}); // no double-consume
    assert.strictEqual(Object.keys(replay.state.placed).length, 1);
  });

  it("normalizes malformed persisted state", () => {
    const normalized = normalizeHarthmerePlaceableWorldState({
      placed: {
        good: {
          objectId: "good",
          itemId: "bench",
          ownerId: ACTOR,
          position: { x: 1, y: 2, z: 3 },
          rotationDegrees: 90,
          footprint: { width: 2, depth: 1, height: 1 },
          surface: "floor",
          placedAtMs: NOW_MS,
        },
        broken: { itemId: "bench" }, // no objectId/position → dropped
      },
      nextObjectNumber: 5,
    });
    assert.ok(normalized.placed.good);
    assert.strictEqual(normalized.placed.broken, undefined);
    assert.strictEqual(normalized.nextObjectNumber, 5);
  });
});
