// HARTHMERE_BUSINESS_OWNER_DISTINCT_LOOK:
// Business owners (the shopkeepers the player walks up to — Doctor Hana
// Greenlamp, the clinic co-owner, the smith, the foreman, ...) used to fall
// back to a generic, often hatless auto-derived outfit, which is why some read
// as "bland" next to the staff/customers who wear explicit role clothing.
// These tests lock in that every owner now gets a distinctive, role-appropriate
// outfit WITH a hat, that the role mapping matches the business, and that the
// result is deterministic so a given shopkeeper always looks the same.
import assert from "assert";

import {
  groveBusinessRoleClothing,
  harthmereBusinessOwnerRoleClothing,
  roleForBusinessText,
} from "@/shared/harthmere/business_npc_cosmetics";
import { HARTHMERE_BUSINESS_OWNER_NPC_SEEDS } from "@/shared/harthmere/business_owner_npc_seed";

describe("harthmere business owner distinct look", () => {
  it("maps business text to the expected character role", () => {
    assert.equal(roleForBusinessText("town security defense"), "guard");
    assert.equal(roleForBusinessText("wilds hunter exploration"), "hunter");
    assert.equal(roleForBusinessText("medical clinic doctor"), "clergy");
    assert.equal(roleForBusinessText("farming food restaurant"), "farmer");
    assert.equal(roleForBusinessText("general trade market"), "merchant");
  });

  it("gives every owner a hat (head slot) and a torso", () => {
    assert.ok(
      HARTHMERE_BUSINESS_OWNER_NPC_SEEDS.length > 0,
      "expected at least one owner seed"
    );
    for (const seed of HARTHMERE_BUSINESS_OWNER_NPC_SEEDS) {
      const { clothing } = harthmereBusinessOwnerRoleClothing({
        businessType: seed.businessType,
        roleTitle: seed.roleTitle,
      });
      assert.ok(
        clothing.head?.id,
        `owner ${seed.displayName} (${seed.businessType}) should wear a hat`
      );
      assert.ok(
        clothing.torso?.id,
        `owner ${seed.displayName} (${seed.businessType}) should wear a torso piece`
      );
    }
  });

  it("dresses the clinic owner (Doctor Hana Greenlamp) as a medic, not generic", () => {
    const hana = HARTHMERE_BUSINESS_OWNER_NPC_SEEDS.find((s) =>
      s.displayName.includes("Hana Greenlamp")
    );
    assert.ok(hana, "expected the Greenlamp clinic owner seed to exist");
    const { role, clothing } = harthmereBusinessOwnerRoleClothing({
      businessType: hana.businessType,
      roleTitle: hana.roleTitle,
    });
    assert.equal(role, "clergy");
    // The clergy/medic outfit pairs a cap with the field medic coat.
    assert.equal(clothing.torso?.id, "field_medic_coat");
    assert.ok(clothing.head?.id, "the doctor should wear a cap");
  });

  it("produces visual variety across owners (not all the same hat)", () => {
    const hats = new Set(
      HARTHMERE_BUSINESS_OWNER_NPC_SEEDS.map(
        (seed) =>
          harthmereBusinessOwnerRoleClothing({
            businessType: seed.businessType,
            roleTitle: seed.roleTitle,
          }).clothing.head?.id
      )
    );
    assert.ok(
      hats.size >= 2,
      `expected owners to wear a variety of hats, got ${[...hats].join(", ")}`
    );
  });

  it("is deterministic for a given owner", () => {
    const seed = HARTHMERE_BUSINESS_OWNER_NPC_SEEDS[0];
    const a = harthmereBusinessOwnerRoleClothing({
      businessType: seed.businessType,
      roleTitle: seed.roleTitle,
    });
    const b = harthmereBusinessOwnerRoleClothing({
      businessType: seed.businessType,
      roleTitle: seed.roleTitle,
    });
    assert.deepEqual(a.clothing, b.clothing);
    assert.equal(a.role, b.role);
  });

  it("matches the same role-clothing generator the staff/customers use", () => {
    // The owner helper must not diverge from the proven staff/customer lookup —
    // it is literally the same role → clothing table, so owners blend in with
    // the rest of the Grove townsfolk instead of looking like a separate class.
    const text = "medical clinic doctor";
    const role = roleForBusinessText(text);
    const direct = groveBusinessRoleClothing(role, text);
    const viaOwner = harthmereBusinessOwnerRoleClothing({
      businessType: "medical_clinic",
      roleTitle: "doctor",
    });
    assert.equal(viaOwner.clothing.torso?.id, direct.torso?.id);
    assert.equal(viaOwner.clothing.head?.id, direct.head?.id);
  });
});
