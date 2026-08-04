/// <reference types="mocha" />
// HARTHMERE_MOBILE_ACTION_CONTROLS (2026-08-04 mobile audit, items 1 and 14).
import {
  mobileActionButtons,
  mobileActionDisabledReason,
  mobileCombatActionForKind,
  mobilePrimaryActionLabel,
  type MobileActionAvailability,
} from "@/client/game/util/mobile_action_controls";
import assert from "assert";

const NATIVE_SHEATHED: MobileActionAvailability = {
  nativeCombatEnabled: true,
  weaponDrawn: false,
};

const NATIVE_DRAWN: MobileActionAvailability = {
  nativeCombatEnabled: true,
  weaponDrawn: true,
};

function kinds(availability: MobileActionAvailability, primary?: any) {
  return mobileActionButtons(availability, primary).map((b) => b.kind);
}

describe("mobile action controls", () => {
  it("always offers primary and secondary", () => {
    // Mining and placing are core verbs and must never depend on combat state
    // or on native ECS authority being enabled.
    assert.deepEqual(
      kinds({ nativeCombatEnabled: false, weaponDrawn: false }),
      ["primary", "secondary"]
    );
    for (const availability of [NATIVE_SHEATHED, NATIVE_DRAWN]) {
      const list = kinds(availability);
      assert.equal(list[0], "primary");
      assert.equal(list[1], "secondary");
    }
  });

  it("hides combat controls outside native ECS authority", () => {
    // The retired local combat simulator is a developer path and must not be
    // reachable from a phone HUD.
    const list = kinds({ nativeCombatEnabled: false, weaponDrawn: true });
    assert.ok(!list.includes("draw"));
    assert.ok(!list.includes("heavy"));
    assert.ok(!list.includes("spark"));
  });

  it("reveals target/heavy/spark only once the weapon is drawn", () => {
    // Mirrors the keyboard flow, where the first B/H press draws and the second
    // strikes.
    const sheathed = kinds(NATIVE_SHEATHED);
    assert.ok(sheathed.includes("draw"));
    assert.ok(!sheathed.includes("heavy"));
    assert.ok(!sheathed.includes("spark"));
    assert.ok(!sheathed.includes("target"));

    const drawn = kinds(NATIVE_DRAWN);
    for (const kind of ["draw", "target", "heavy", "spark"]) {
      assert.ok(drawn.includes(kind as any), `expected ${kind}`);
    }
  });

  it("marks primary and secondary as holdable and combat as discrete", () => {
    // Hold is what makes mining a slow block possible; the fixed 350ms hotbar
    // pulse could not do it.
    const buttons = mobileActionButtons(NATIVE_DRAWN);
    const byKind = new Map(buttons.map((b) => [b.kind, b]));
    assert.equal(byKind.get("primary")!.holdable, true);
    assert.equal(byKind.get("secondary")!.holdable, true);
    assert.equal(byKind.get("heavy")!.holdable, false);
    assert.equal(byKind.get("draw")!.holdable, false);
  });

  it("labels primary from the selected item, defaulting to Mine", () => {
    assert.equal(mobilePrimaryActionLabel(undefined), "Mine");
    assert.equal(mobilePrimaryActionLabel("place"), "Place");
    assert.equal(mobilePrimaryActionLabel("attack"), "Attack");
    assert.equal(mobilePrimaryActionLabel("cast"), "Cast");
  });

  it("routes combat buttons to the native combat actions", () => {
    assert.equal(mobileCombatActionForKind("heavy"), "heavy");
    assert.equal(mobileCombatActionForKind("spark"), "spark");
    assert.equal(mobileCombatActionForKind("primary"), undefined);
    assert.equal(mobileCombatActionForKind("draw"), undefined);
  });

  it("never disables primary or secondary", () => {
    // Combat rules that block an attack do not block chopping a tree.
    const blocked: MobileActionAvailability = {
      ...NATIVE_DRAWN,
      attackBlockedReason: "Respawn protection is active.",
      sparkBlockedReason: "Select a valid target before casting Spark.",
    };
    assert.equal(mobileActionDisabledReason("primary", blocked), undefined);
    assert.equal(mobileActionDisabledReason("secondary", blocked), undefined);
  });

  it("surfaces the shared combat block reason verbatim", () => {
    // The phone must not invent its own rules or drift from the desktop ones.
    const blocked: MobileActionAvailability = {
      ...NATIVE_DRAWN,
      attackBlockedReason: "Respawn protection is active.",
      sparkBlockedReason: "Select a valid target before casting Spark.",
    };
    assert.equal(
      mobileActionDisabledReason("heavy", blocked),
      "Respawn protection is active."
    );
    assert.equal(
      mobileActionDisabledReason("spark", blocked),
      "Select a valid target before casting Spark."
    );
  });

  it("falls back to the attack block reason for spark", () => {
    const blocked: MobileActionAvailability = {
      ...NATIVE_DRAWN,
      attackBlockedReason: "Revive or respawn before using combat actions.",
    };
    assert.equal(
      mobileActionDisabledReason("spark", blocked),
      "Revive or respawn before using combat actions."
    );
  });

  it("keeps every control uniquely identifiable for e2e", () => {
    const buttons = mobileActionButtons(NATIVE_DRAWN);
    const attributes = buttons.map((b) => b.testAttribute);
    assert.equal(new Set(attributes).size, attributes.length);
    assert.ok(attributes.every((a) => a.length > 0));
    assert.ok(buttons.every((b) => b.ariaLabel.length > 0));
  });
});
