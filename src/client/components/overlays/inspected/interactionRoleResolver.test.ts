import assert from "assert";
import { resolveNativePlaceableInteractionRole } from "./interactionRoleResolver";

describe("native placeable F-role resolver", () => {
  it("routes every supported native capability to its typed interface", () => {
    const cases = [
      [{ isMailbox: true }, "mailbox"],
      [{ isShopContainer: true }, "shop"],
      [{ isContainer: true }, "container"],
      [{ isCraftingStation: true }, "crafting_station"],
      [{ isCookStation: true }, "crafting_station"],
      [{ isDoor: true }, "door"],
      [{ isReadable: true }, "readable"],
      [{ isCustomizableTextSign: true }, "text_sign"],
      [{ isOutfitStand: true }, "outfit_stand"],
      [{ isMediaPlayer: true }, "media"],
      [{ isMinigame: true }, "minigame"],
      [{ isFrame: true }, "frame"],
      [{}, "inspect"],
    ] as const;

    for (const [capabilities, expected] of cases) {
      assert.equal(
        resolveNativePlaceableInteractionRole(capabilities),
        expected
      );
    }
  });

  it("keeps specific capabilities ahead of broad visual archetypes", () => {
    assert.equal(
      resolveNativePlaceableInteractionRole({
        isMailbox: true,
        isContainer: true,
        isFrame: true,
      }),
      "mailbox"
    );
    assert.equal(
      resolveNativePlaceableInteractionRole({
        isShopContainer: true,
        isContainer: true,
        isFrame: true,
      }),
      "shop"
    );
    assert.equal(
      resolveNativePlaceableInteractionRole({
        isContainer: true,
        isFrame: true,
      }),
      "container"
    );
    assert.equal(
      resolveNativePlaceableInteractionRole({
        isCookStation: true,
        isFrame: true,
      }),
      "crafting_station"
    );
  });
});
