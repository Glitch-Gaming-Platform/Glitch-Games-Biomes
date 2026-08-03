/// <reference types="mocha" />
import {
  harthmereNativeCombatKeyInputSource,
  routeHarthmereCombatKeyForAuthority,
  type HarthmereCombatKeyAction,
} from "@/client/components/challenges/harthmereNativeCombatKeyRouting";
import assert from "assert";

describe("Harthmere native combat key routing", () => {
  it("routes native authority through canonical game input, never the legacy simulator", () => {
    const native: HarthmereCombatKeyAction[] = [];
    const legacy: HarthmereCombatKeyAction[] = [];

    const routes = (["basic", "heavy", "spark"] as const).map((action) =>
      routeHarthmereCombatKeyForAuthority({
        action,
        nativeEcsAuthority: true,
        dispatchNativeInput: (nativeAction) => native.push(nativeAction),
        performLegacyAttack: (legacyAction) => legacy.push(legacyAction),
      })
    );

    assert.deepEqual(routes, [
      "native_ecs_input",
      "native_ecs_input",
      "native_ecs_input",
    ]);
    assert.deepEqual(native, ["basic", "heavy", "spark"]);
    assert.deepEqual(legacy, []);
  });

  it("retains the simulator only when native ECS authority is disabled", () => {
    const native: HarthmereCombatKeyAction[] = [];
    const legacy: HarthmereCombatKeyAction[] = [];

    const route = routeHarthmereCombatKeyForAuthority({
      action: "heavy",
      nativeEcsAuthority: false,
      dispatchNativeInput: (action) => native.push(action),
      performLegacyAttack: (action) => legacy.push(action),
    });

    assert.equal(route, "legacy_combat_simulator");
    assert.deepEqual(native, []);
    assert.deepEqual(legacy, ["heavy"]);
  });

  it("keeps each native key action identifiable in input diagnostics", () => {
    assert.equal(
      harthmereNativeCombatKeyInputSource("basic"),
      "harthmere-native-combat-key:basic"
    );
    assert.equal(
      harthmereNativeCombatKeyInputSource("heavy"),
      "harthmere-native-combat-key:heavy"
    );
    assert.equal(
      harthmereNativeCombatKeyInputSource("spark"),
      "harthmere-native-combat-key:spark"
    );
  });
});
