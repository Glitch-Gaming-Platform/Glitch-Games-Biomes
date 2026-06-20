import assert from "assert";

import { BikkieIds } from "@/shared/bikkie/ids";
import {
  HARTHMERE_PLACED_COOK_STATION_RE,
  isHarthmerePlacedCookStationItem,
} from "./craftingStationCookRouting";

describe("placed crafting station cooking routing", () => {
  it("routes placed fire pits, ovens, and pots to the cooking UI", () => {
    for (const label of [
      "Campfire",
      "Camp Fire",
      "Firepit",
      "Fire Pit",
      "Stone Oven",
      "Cookpot",
      "Cooking Pot",
      "Soup Pot",
      "Pot",
    ]) {
      assert.match(label, HARTHMERE_PLACED_COOK_STATION_RE);
    }
  });
});

describe("isHarthmerePlacedCookStationItem prompt gate", () => {
  it("surfaces the cook prompt for campfires / ovens / cookpots / fire pits", () => {
    for (const displayName of [
      "Campfire",
      "Camp Fire",
      "Firepit",
      "Fire Pit",
      "Stone Oven",
      "Clay Oven",
      "Cookpot",
      "Cooking Pot",
      "Soup Pot",
      "Stew Pot",
      "Kitchen Pot",
      "Kettle",
      "Hearth",
      "Cooking Fire",
    ]) {
      assert.ok(
        isHarthmerePlacedCookStationItem({ displayName }),
        `expected "${displayName}" to be a cook station`
      );
    }
  });

  it("matches the base-game campfire by id even with no display name", () => {
    assert.ok(
      isHarthmerePlacedCookStationItem({ id: BikkieIds.campfire })
    );
    assert.ok(
      isHarthmerePlacedCookStationItem({
        id: BikkieIds.campfire,
        displayName: "",
      })
    );
  });

  it("does NOT fire for ordinary decorative pots or non-cook placeables", () => {
    for (const displayName of [
      "Flower Pot",
      "Paint Pot",
      "Honey Pot",
      "Chimney Pot",
      "Workbench",
      "Anvil",
      "Loom",
      "Wardrobe",
      "Chest",
      "Sign Post",
      "Jobs Board",
    ]) {
      assert.ok(
        !isHarthmerePlacedCookStationItem({ displayName }),
        `expected "${displayName}" NOT to be a cook station`
      );
    }
  });

  it("is safe for missing / empty items", () => {
    assert.ok(!isHarthmerePlacedCookStationItem(undefined));
    assert.ok(!isHarthmerePlacedCookStationItem(null));
    assert.ok(!isHarthmerePlacedCookStationItem({}));
    assert.ok(!isHarthmerePlacedCookStationItem({ displayName: "" }));
  });
});
