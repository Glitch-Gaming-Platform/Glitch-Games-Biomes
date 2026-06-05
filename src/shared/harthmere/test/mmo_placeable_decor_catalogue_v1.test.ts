import assert from "assert";
import {
  getHarthmereCraftingRecipeV1,
  getHarthmereItemDefinitionV1,
  getHarthmereVendorEntryV1,
  reduceHarthmereInventoryMutationV1,
  type HarthmereInventoryMutationKindV1,
  type HarthmereInventoryMutationRequestV1,
  type HarthmereInventorySnapshotV1,
} from "../mmo_inventory_authority_v1";
import {
  HARTHMERE_NEW_PLACEABLE_DECOR_SPECS_V1,
  HARTHMERE_PLACEABLE_DECOR_SPECS_V1,
  defaultHarthmerePlaceableWorldStateV1,
  ensureHarthmerePlaceableDecorCatalogueV1,
  getHarthmerePlaceableDecorSpecV1,
  normalizeHarthmerePlaceableWorldStateV1,
  placeableDecorRecipeIdV1,
  reduceHarthmerePlaceableWorldMutationV1,
  type HarthmerePlaceableWorldStateV1,
} from "../mmo_placeable_decor_catalogue_v1";
import {
  getHarthmereHomeDecorationDefinitionV1,
  listHarthmereHomeDecorationDefinitionsV1,
} from "../home_decoration_authority_v1";

const NOW_MS = 1_760_500_000_000;
const ACTOR = "decor_player_1";
const OTHER = "decor_player_2";

function snapshot(
  overrides: Partial<HarthmereInventorySnapshotV1> = {}
): HarthmereInventorySnapshotV1 {
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
  kind: HarthmereInventoryMutationKindV1,
  base: HarthmereInventorySnapshotV1,
  overrides: Partial<HarthmereInventoryMutationRequestV1>,
  playerSkills: Record<string, { level: number }> = {}
) {
  return reduceHarthmereInventoryMutationV1(
    {
      requestId: `decor-test-${kind}`,
      actorId: ACTOR,
      kind,
      nowMs: NOW_MS,
      ...overrides,
    } as HarthmereInventoryMutationRequestV1,
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
    ensureHarthmerePlaceableDecorCatalogueV1();
  });

  it("registers item + recipe + vendor entry for every NEW decor spec", () => {
    for (const spec of HARTHMERE_NEW_PLACEABLE_DECOR_SPECS_V1) {
      const def = getHarthmereItemDefinitionV1(spec.itemId);
      assert.ok(def, `missing item def for ${spec.itemId}`);
      assert.strictEqual(def!.baseValue, spec.price);

      if (spec.station && spec.inputs) {
        const recipe = getHarthmereCraftingRecipeV1(
          placeableDecorRecipeIdV1(spec.itemId)
        );
        assert.ok(recipe, `missing recipe for ${spec.itemId}`);
        assert.strictEqual(recipe!.outputItemId, spec.itemId);
        assert.ok(recipe!.requiredStationId, `${spec.itemId} has no station`);
      }

      const entry = getHarthmereVendorEntryV1(spec.vendorId, spec.itemId);
      assert.ok(entry, `missing vendor entry for ${spec.itemId}`);
      assert.strictEqual(entry!.buyPrice, spec.price);
      assert.ok(entry!.sellPrice < entry!.buyPrice);
      assert.ok(entry!.sellPrice >= 1);
    }
  });

  it("adds purchase entries for existing stations/decor without duplicating their recipe", () => {
    const existing = HARTHMERE_PLACEABLE_DECOR_SPECS_V1.filter((s) => s.existing);
    assert.ok(existing.length > 0, "expected some existing-item decor specs");
    for (const spec of existing) {
      // A purchase entry exists...
      const entry = getHarthmereVendorEntryV1(spec.vendorId, spec.itemId);
      assert.ok(entry, `existing item ${spec.itemId} should be purchasable`);
      // ...but we did NOT mint a duplicate placement recipe for it.
      assert.strictEqual(
        getHarthmereCraftingRecipeV1(placeableDecorRecipeIdV1(spec.itemId)),
        undefined,
        `existing item ${spec.itemId} must not get a duplicate decor recipe`
      );
    }
  });

  it("crafts a furniture item from materials at its station", () => {
    const recipeId = placeableDecorRecipeIdV1("bench");
    const recipe = getHarthmereCraftingRecipeV1(recipeId)!;
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
    const spec = getHarthmerePlaceableDecorSpecV1("bench")!;
    const entry = getHarthmereVendorEntryV1(spec.vendorId, "bench")!;
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
    const def = getHarthmereHomeDecorationDefinitionV1("bench");
    assert.ok(def, "bench should be placeable on owned property");
    assert.strictEqual(def!.kind, "comfort");
    assert.ok(def!.allowedPropertyUses.includes("home"));
    assert.ok(def!.guidePlacement, "should have guide placement");
    // The whole new-decor set is reachable through the owned-property list.
    const ids = new Set(
      listHarthmereHomeDecorationDefinitionsV1().map((d) => d.itemId)
    );
    for (const spec of HARTHMERE_NEW_PLACEABLE_DECOR_SPECS_V1) {
      assert.ok(ids.has(spec.itemId), `${spec.itemId} missing from property list`);
    }
  });
});

describe("Harthmere free-world placement", () => {
  before(() => {
    ensureHarthmerePlaceableDecorCatalogueV1();
  });

  function freshWorld(): HarthmerePlaceableWorldStateV1 {
    return defaultHarthmerePlaceableWorldStateV1();
  }

  it("places a held item anywhere on the terrain, consuming it", () => {
    const result = reduceHarthmerePlaceableWorldMutationV1(
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
    const noItem = reduceHarthmerePlaceableWorldMutationV1(
      freshWorld(),
      worldRequest("place_object", { itemId: "bench", position: { x: 0, y: 0, z: 0 } }),
      { actorInventoryItems: {} }
    );
    assert.ok(!noItem.ok && noItem.errors.includes("missing_placeable_item"));

    const oob = reduceHarthmerePlaceableWorldMutationV1(
      freshWorld(),
      worldRequest("place_object", {
        itemId: "bench",
        position: { x: 9_999_999, y: 0, z: 0 },
      }),
      { actorInventoryItems: { bench: 1 } }
    );
    assert.ok(!oob.ok && oob.errors.includes("invalid_position"));

    // A natural/non-decor item id is not placeable through this system.
    const natural = reduceHarthmerePlaceableWorldMutationV1(
      freshWorld(),
      worldRequest("place_object", { itemId: "stone", position: { x: 0, y: 0, z: 0 } }),
      { actorInventoryItems: { stone: 10 } }
    );
    assert.ok(!natural.ok && natural.errors.includes("item_not_placeable"));
  });

  it("rejects overlapping placements", () => {
    const first = reduceHarthmerePlaceableWorldMutationV1(
      freshWorld(),
      worldRequest("place_object", { itemId: "bench", position: { x: 0, y: 0, z: 0 } }),
      { actorInventoryItems: { bench: 2 } }
    );
    const overlap = reduceHarthmerePlaceableWorldMutationV1(
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
    const placed = reduceHarthmerePlaceableWorldMutationV1(
      freshWorld(),
      worldRequest("place_object", { itemId: "bench", position: { x: 0, y: 0, z: 0 } }),
      { actorInventoryItems: { bench: 1 } }
    );
    const objectId = placed.placedObjectId!;

    // Another player cannot move it without permission.
    const blocked = reduceHarthmerePlaceableWorldMutationV1(
      placed.state,
      worldRequest("move_object", { objectId, position: { x: 20, y: 0, z: 20 } }, OTHER),
      { actorInventoryItems: {} }
    );
    assert.ok(!blocked.ok && blocked.errors.includes("not_object_owner"));

    // Owner can move it.
    const moved = reduceHarthmerePlaceableWorldMutationV1(
      placed.state,
      worldRequest("move_object", { objectId, position: { x: 30, y: 0, z: 30 } }),
      { actorInventoryItems: {} }
    );
    assert.ok(moved.ok, moved.errors.join(","));
    assert.strictEqual(moved.state.placed[objectId].position.x, 30);

    // Someone with edit-others (landowner/admin) may remove it.
    const removed = reduceHarthmerePlaceableWorldMutationV1(
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
    const first = reduceHarthmerePlaceableWorldMutationV1(freshWorld(), req, {
      actorInventoryItems: { bench: 1 },
    });
    const replay = reduceHarthmerePlaceableWorldMutationV1(first.state, req, {
      actorInventoryItems: { bench: 1 },
    });
    assert.ok(replay.ok);
    assert.deepStrictEqual(replay.itemDeltas, {}); // no double-consume
    assert.strictEqual(Object.keys(replay.state.placed).length, 1);
  });

  it("normalizes malformed persisted state", () => {
    const normalized = normalizeHarthmerePlaceableWorldStateV1({
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
