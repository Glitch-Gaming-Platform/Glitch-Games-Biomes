import assert from "assert";
import { biomesUIStaminaWarningLevelForTest } from "../staminaWarning";

describe("Biomes UI stamina warning", () => {
  it("escalates the warning level as stamina gets close to zero", () => {
    assert.equal(biomesUIStaminaWarningLevelForTest(40, 100), "none");
    assert.equal(biomesUIStaminaWarningLevelForTest(25, 100), "low");
    assert.equal(biomesUIStaminaWarningLevelForTest(10, 100), "critical");
    assert.equal(biomesUIStaminaWarningLevelForTest(0.4, 108), "critical");
  });
});
