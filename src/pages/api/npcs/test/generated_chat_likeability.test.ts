/// <reference types="mocha" />
/// <reference types="node" />

import assert from "assert";
import { generatedChatLikeabilityForOptionV1 } from "@/pages/api/npcs/generated_chat";
import { harthmereFallbackNpcOptionsV143 } from "@/shared/harthmere/npc_dialog_fallback_v143";

describe("generated NPC chat likeability classification", () => {
  it("marks friendly, neutral, and rude generated options with HUD-ready deltas", () => {
    assert.equal(
      generatedChatLikeabilityForOptionV1("Compliment Ruthe's steady eye"),
      6
    );
    assert.equal(
      generatedChatLikeabilityForOptionV1("Ask about this place"),
      0
    );
    assert.equal(generatedChatLikeabilityForOptionV1("Call Ruthe useless"), -8);
    assert.equal(generatedChatLikeabilityForOptionV1("Close"), 0);
  });

  it("keeps authored fallback ask options neutral", () => {
    const ask = harthmereFallbackNpcOptionsV143({
      name: "Ruthe",
      description: "Harthmere lookout",
    }).find((option) => option.name === "Ask about this place");

    assert.equal(ask?.likeability, 0);
  });
});
