import assert from "assert";

import {
  GROVE_ECONOMY_STARTER_LANDMARKS_V1,
} from "@/shared/harthmere/grove_economy_starter_v1";
import { isHarthmereInspectableWorldObjectV1 } from "@/shared/harthmere/harthmere_world_object_inspectable_v1";
import {
  harthmereObjectInteractionForLabelV1,
  isHarthmereContainerObjectLabelV1,
} from "@/shared/harthmere/object_interaction_semantics_v1";

// Every world-object type the F key must work with, paired with a representative
// in-world label. The label deliberately avoids "living" words (baker, cook,
// guard, mucker, ...) so it is not vetoed by the living-object exemption.
const PROP_LABELS: ReadonlyArray<readonly [string, string]> = [
  ["crate", "Grove Supply Crate"],
  ["chest", "Grove Supply Chest"],
  ["box", "Old Supply Box"],
  ["satchel", "Mail Satchel"],
  ["bin", "First-Aid Bin"],
  ["board", "Lesson Board"],
  ["post", "Road Post"],
  ["stake", "Claim Stake"],
  ["fence", "Garden Fence"],
  ["table", "Project Table"],
  ["desk", "Trade Desk"],
  ["mirror", "Locks Mirror"],
  ["stone", "Boundary Stone"],
  ["dummy", "Practice Dummy"],
  ["ring", "Sparring Ring"],
  ["flag", "Route Flag"],
  ["cart", "Supply Cart"],
  ["workbench", "Fountain Workbench"],
  ["oven", "Stone Oven"],
  ["mailbag", "Mailbag Stand"],
  ["cookpot", "Camp Cookpot"],
  ["patch", "Berry Patch"],
  ["platform", "Service Platform"],
  ["tower", "Service Tower"],
  ["office", "Market Office"],
  ["well", "Wishing Well"],
  ["gate", "Garden Gate"],
  ["door", "Storehouse Door"],
];

describe("world-object F interaction: all prop types", () => {
  for (const [keyword, label] of PROP_LABELS) {
    it(`shows the F prompt for "${keyword}" (label "${label}")`, () => {
      // isHarthmereInspectableWorldObjectV1 is the gate that decides whether the
      // object becomes an inspect candidate (i.e. whether the F prompt appears).
      assert.equal(
        isHarthmereInspectableWorldObjectV1({ label }),
        true,
        `${label} should be an inspectable world object`
      );
      // And it must resolve to a concrete interaction with a prompt title.
      const interaction = harthmereObjectInteractionForLabelV1({ label });
      assert.ok(interaction, `${label} should resolve to an interaction`);
      assert.equal(typeof interaction.title, "string");
      assert.ok(interaction.title.length > 0);
    });
  }

  it("classifies container props as containers and non-containers otherwise", () => {
    for (const container of [
      "Grove Supply Crate",
      "Grove Supply Chest",
      "Old Supply Box",
      "Mail Satchel",
      "First-Aid Bin",
    ]) {
      assert.equal(
        isHarthmereContainerObjectLabelV1({ label: container }),
        true,
        `${container} should be a container`
      );
    }
    for (const nonContainer of [
      "Garden Gate",
      "Storehouse Door",
      "Wishing Well",
      "Lesson Board",
    ]) {
      assert.equal(
        isHarthmereContainerObjectLabelV1({ label: nonContainer }),
        false,
        `${nonContainer} should not be a container`
      );
    }
  });

  it("does NOT treat living/NPC labels as world objects", () => {
    for (const living of ["Jackie", "Mucked Robot", "Foreman Calla Ashe", "Road Mucker"]) {
      assert.equal(
        isHarthmereInspectableWorldObjectV1({ label: living }),
        false,
        `${living} should not be an inspectable world object`
      );
    }
  });
});

describe("world-object F interaction: door/gate/well/chest candidates exist", () => {
  it("the previously-missing prop types now have authored candidate landmarks", () => {
    const newProps = [
      "econ_grove_supply_chest",
      "econ_grove_storehouse_door",
      "econ_grove_garden_gate",
      "econ_grove_wishing_well",
    ];
    for (const id of newProps) {
      const landmark = GROVE_ECONOMY_STARTER_LANDMARKS_V1.find(
        (l) => l.id === id
      );
      assert.ok(landmark, `missing authored landmark ${id}`);
      assert.notEqual(landmark!.kind, "npc");
      assert.equal(
        isHarthmereInspectableWorldObjectV1({ label: landmark!.label }),
        true,
        `${landmark!.label} landmark should be an inspectable world object`
      );
    }
  });
});
