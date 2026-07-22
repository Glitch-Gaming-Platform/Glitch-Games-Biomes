import assert from "assert";
import {
  HARTHMERE_PLAYER_LIKE_NPC_COSMETIC_RESET_VERSION,
  prepareHarthmerePlayerLikeNpcForUniqueAppearance,
} from "../player_like_npc_cosmetics";

describe("player-like NPC cosmetic seed preparation", () => {
  const entity = {
    id: 123,
    label: { text: "Unique NPC" },
    appearance_component: { appearance: { skin_color_id: "skin_color_0" } },
    wearing: { items: new Map() },
  };

  it("omits shared defaults when creating a new player-like NPC", () => {
    const prepared = prepareHarthmerePlayerLikeNpcForUniqueAppearance(
      entity,
      "create"
    );
    assert.equal(prepared.appearance_component, undefined);
    assert.equal(prepared.wearing, undefined);
    assert.equal(prepared.label.text, "Unique NPC");
  });

  it("uses explicit nulls to remove shared defaults from an existing NPC", () => {
    const prepared = prepareHarthmerePlayerLikeNpcForUniqueAppearance(
      entity,
      "update"
    );
    assert.equal(prepared.appearance_component, null);
    assert.equal(prepared.wearing, null);
    assert.equal(
      HARTHMERE_PLAYER_LIKE_NPC_COSMETIC_RESET_VERSION,
      "harthmere-player-like-npc-cosmetic-reset-v2"
    );
  });
});
