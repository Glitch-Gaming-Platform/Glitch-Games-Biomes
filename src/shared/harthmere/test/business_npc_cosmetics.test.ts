/// <reference types="mocha" />

import assert from "assert";
import {
  HARTHMERE_BUSINESS_CUSTOMER_NPCS,
  HARTHMERE_BUSINESS_OUTPOSTS,
} from "../business_customer_simulator";
import {
  HARTHMERE_BUSINESS_NPC_GROVE_COSMETIC_VERSION,
  harthmereBusinessCustomerCharacterAppearance,
  harthmereBusinessOutpostStaffAppearance,
  harthmereBusinessOutpostStaffAsset,
  harthmereBusinessOutpostStaffRole,
} from "../business_npc_cosmetics";

const REQUIRED_CLOTHING_SLOTS = [
  "head",
  "torso",
  "legs",
  "feet",
  "belt",
] as const;
const EXPECTED_OUTPOST_STAFF_PRESENTATION = {
  outpost_refinery_ashline: [
    "townsperson_dockhand",
    "farmer",
    "blacksmith_apron",
  ],
  outpost_biome_repair_north: [
    "townsperson_dockhand",
    "farmer",
    "blacksmith_apron",
  ],
  outpost_design_glassyard: ["townsperson_market", "merchant", "merchant_coat"],
  outpost_security_redoubt: [
    "townsperson_guard",
    "guard",
    "guard_tabard_armor",
  ],
  outpost_portal_eastgate: ["townsperson_courier", "merchant", "river_tunic"],
  outpost_rare_foods_southplot: ["townsperson_farmer", "farmer", "work_apron"],
  outpost_tools_cinderlane: [
    "townsperson_dockhand",
    "farmer",
    "blacksmith_apron",
  ],
  outpost_magic_moonstall: ["townsperson_clergy", "clergy", "scholar_robe"],
  outpost_exploration_westtrail: [
    "townsperson_hunter",
    "hunter",
    "hunter_jerkin",
  ],
  outpost_property_keylot: ["townsperson_market", "merchant", "merchant_coat"],
  outpost_trader_brightcart: [
    "townsperson_market",
    "merchant",
    "merchant_coat",
  ],
  outpost_hunter_ridgecooler: ["townsperson_hunter", "hunter", "hunter_jerkin"],
  outpost_clinic_greenlamp: [
    "townsperson_clergy",
    "clergy",
    "field_medic_coat",
  ],
  outpost_teleport_returnstone: [
    "townsperson_courier",
    "merchant",
    "river_tunic",
  ],
  outpost_sanitation_clearbarrel: [
    "townsperson_dockhand",
    "farmer",
    "blacksmith_apron",
  ],
  outpost_repair_hingehall: [
    "townsperson_dockhand",
    "farmer",
    "blacksmith_apron",
  ],
  outpost_restaurant_redpot: ["townsperson_farmer", "farmer", "work_apron"],
  outpost_courier_stampspur: ["townsperson_courier", "merchant", "river_tunic"],
  outpost_hospitality_lanternrest: [
    "townsperson_market",
    "merchant",
    "merchant_coat",
  ],
} as const;

function assertFullGroveCosmeticContract(
  label: string,
  appearance: ReturnType<typeof harthmereBusinessOutpostStaffAppearance>,
  sourceKind: "staff" | "customer"
) {
  assert.equal(
    appearance.species,
    "human",
    `${label} should be a humanoid townsperson`
  );
  assert.ok(
    appearance.source?.includes(
      `${HARTHMERE_BUSINESS_NPC_GROVE_COSMETIC_VERSION}:${sourceKind}`
    ),
    `${label} should use the Grove business cosmetic source`
  );
  assert.equal(
    appearance.source?.includes("harthmere-business-outpost-procedural-staff"),
    false,
    `${label} should not use the old business-outpost-only appearance source`
  );

  for (const field of [
    appearance.face.hairStyle,
    appearance.face.hairColor,
    appearance.face.eyeColor,
    appearance.face.faceShape,
    appearance.face.eyeShape,
    appearance.face.browStyle,
    appearance.face.noseStyle,
    appearance.face.mouthStyle,
    appearance.face.cheekStyle,
    appearance.face.accessory,
    appearance.body.bodyType,
    appearance.body.bodyHeight,
    appearance.body.shoulderWidth,
    appearance.body.armLength,
    appearance.body.legLength,
    appearance.body.stance,
    appearance.body.outfitColor,
  ]) {
    assert.ok(
      String(field).length > 0,
      `${label} has an incomplete face/body cosmetic field`
    );
  }

  for (const slot of REQUIRED_CLOTHING_SLOTS) {
    const item = appearance.clothing[slot];
    assert.ok(
      item,
      `${label} should have Bikkie-style clothing in slot ${slot}`
    );
    assert.equal(
      item?.renderMode,
      "threejs",
      `${label} ${slot} should use the procedural clothing renderer`
    );
  }
}

describe("business_npc_cosmetics", () => {
  it("creates business outpost staff as Grove-style procedural townspeople with full cosmetics", () => {
    const signatures = new Set<string>();
    for (const outpost of HARTHMERE_BUSINESS_OUTPOSTS) {
      const asset = harthmereBusinessOutpostStaffAsset(outpost);
      assert.ok(
        asset.startsWith("townsperson_"),
        `${outpost.outpostId} must use the same procedural townsperson renderer family as Grove NPCs`
      );
      assert.notEqual(asset, "player");
      assert.notEqual(asset, "remote_player");

      const appearance = harthmereBusinessOutpostStaffAppearance(outpost);
      const expected =
        EXPECTED_OUTPOST_STAFF_PRESENTATION[
          outpost.outpostId as keyof typeof EXPECTED_OUTPOST_STAFF_PRESENTATION
        ];
      assert.ok(
        expected,
        `${outpost.outpostId} must have an exact staff presentation contract`
      );
      assert.equal(
        asset,
        expected[0],
        `${outpost.outpostId} uses the wrong staff renderer family`
      );
      assert.equal(
        harthmereBusinessOutpostStaffRole(outpost),
        expected[1],
        `${outpost.outpostId} uses the wrong staff role`
      );
      assert.equal(
        appearance.clothing.torso?.id,
        expected[2],
        `${outpost.outpostId} uses the wrong business outfit`
      );
      assertFullGroveCosmeticContract(outpost.outpostId, appearance, "staff");
      signatures.add(
        JSON.stringify({
          face: appearance.face,
          body: appearance.body,
          clothing: Object.fromEntries(
            Object.entries(appearance.clothing).map(([slot, item]) => [
              slot,
              item?.id,
            ])
          ),
        })
      );
    }
    assert.equal(
      signatures.size,
      HARTHMERE_BUSINESS_OUTPOSTS.length,
      "each outpost staff NPC should have a distinct face/body/clothing signature"
    );
  });

  it("can promote every customer-only NPC design into the same Grove cosmetic schema", () => {
    const signatures = new Set<string>();
    for (const npc of HARTHMERE_BUSINESS_CUSTOMER_NPCS) {
      assert.equal(npc.customerOnly, true);
      assert.equal(npc.mapPlacement, "none");
      const appearance = harthmereBusinessCustomerCharacterAppearance(npc);
      assertFullGroveCosmeticContract(npc.npcId, appearance, "customer");
      signatures.add(
        JSON.stringify({
          face: appearance.face,
          body: appearance.body,
          clothing: Object.fromEntries(
            Object.entries(appearance.clothing).map(([slot, item]) => [
              slot,
              item?.id,
            ])
          ),
        })
      );
    }
    assert.equal(
      signatures.size,
      HARTHMERE_BUSINESS_CUSTOMER_NPCS.length,
      "every customer should remain visually unique after conversion to the Grove cosmetic schema"
    );
  });
});
