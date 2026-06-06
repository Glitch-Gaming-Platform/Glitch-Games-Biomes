/// <reference types="mocha" />

import assert from "assert";
import {
  validateHarthmereGatherAttempt,
  type HarthmereGatheringValidationInput,
} from "@/client/components/challenges/LocalDevHarthmereWorldAuthority";

const orchardGatherAttempt: HarthmereGatheringValidationInput = {
  nodeDefinition: {
    id: "harthmere_orchard_softwood",
    name: "Orchard Softwood Branches",
    position: [468, 53, -118],
    requiredTool: "woodcutters_axe",
    requiredSkill: 1,
    profession: "woodcutting",
    category: "wood",
  },
  playerState: {
    playerId: "test-player",
    position: [468, 53, -118],
  },
  hasRequiredTool: true,
  professionLevel: 1,
  cooldownReady: true,
};

describe("LocalDevHarthmereWorldAuthority gathering validation", () => {
  it("keeps missing gathering tools as a visible requirement failure", () => {
    const result = validateHarthmereGatherAttempt({
      ...orchardGatherAttempt,
      hasRequiredTool: false,
    });

    assert.equal(result.ok, false);
    if (result.ok) {
      throw new Error("expected missing tool to fail");
    }
    assert.equal(result.code, "missing_tool");
    assert.match(result.message, /requires the correct gathering tool/i);
    assert.deepEqual(result.evidence, ["woodcutters_axe"]);
  });

  it("passes the same node once the required gathering tool is present", () => {
    const result = validateHarthmereGatherAttempt(orchardGatherAttempt);

    assert.equal(result.ok, true);
    if (!result.ok) {
      throw new Error(`expected gather validation to pass: ${result.message}`);
    }
    assert.equal(
      result.transactionId.startsWith("gather_harthmere_orchard_softwood_"),
      true
    );
  });
});
