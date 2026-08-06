import { playerAirborneAnimationLayers } from "@/client/game/util/player_animations";
import assert from "assert";

describe("airborne player attack animation layering", () => {
  it("keeps attack arms visible over jump and fall locomotion", () => {
    assert.deepEqual(playerAirborneAnimationLayers("attack1"), {
      arms: "ifIdle",
      notArms: "apply",
    });
    assert.deepEqual(playerAirborneAnimationLayers("attack2"), {
      arms: "ifIdle",
      notArms: "apply",
    });
    assert.deepEqual(playerAirborneAnimationLayers("dance"), {
      arms: "apply",
      notArms: "apply",
    });
  });
});
