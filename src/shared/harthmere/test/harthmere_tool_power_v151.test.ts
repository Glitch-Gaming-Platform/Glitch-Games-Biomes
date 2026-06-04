/// <reference types="mocha" />

import assert from "assert";

import {
  harthmereEquippedToolPowerV151,
  harthmereRepairToolGateV151,
  harthmereToolBaseValueForTierV151,
} from "@/shared/harthmere/mmo_inventory_authority_v1";
import {
  harthmereJobRequirementToolSubObjectiveV151,
} from "@/shared/harthmere/mmo_jobs_board_authority_v1";
import {
  HARTHMERE_CRAFTING_TOOLS_V1,
  ensureHarthmereProductionCraftingCatalogueV1,
} from "@/shared/harthmere/mmo_crafting_catalogue_v1";

ensureHarthmereProductionCraftingCatalogueV1();

describe("HARTHMERE_TOOL_POWER_V151 — tiered, equip-gated tools", () => {
  describe("harthmereToolBaseValueForTierV151 (greater impact costs more)", () => {
    it("scales cost up with tier", () => {
      const t1 = harthmereToolBaseValueForTierV151(1, 0);
      const t2 = harthmereToolBaseValueForTierV151(2, 0);
      const t3 = harthmereToolBaseValueForTierV151(3, 0);
      assert.ok(t2 > t1, "tier 2 costs more than tier 1");
      assert.ok(t3 > t2, "tier 3 costs more than tier 2");
    });

    it("adds cost for higher power", () => {
      assert.ok(
        harthmereToolBaseValueForTierV151(1, 40) >
          harthmereToolBaseValueForTierV151(1, 0)
      );
    });
  });

  describe("harthmereEquippedToolPowerV151 (must be equipped)", () => {
    it("returns zero power when nothing is equipped", () => {
      const out = harthmereEquippedToolPowerV151({ equipment: {} }, "destroy");
      assert.equal(out.power, 0);
      assert.equal(out.itemId, undefined);
    });

    it("returns the equipped destroy tool's damage", () => {
      const out = harthmereEquippedToolPowerV151(
        { equipment: { main_hand: HARTHMERE_CRAFTING_TOOLS_V1.silverPick } },
        "destroy",
        "damage"
      );
      assert.equal(out.itemId, HARTHMERE_CRAFTING_TOOLS_V1.silverPick);
      assert.equal(out.power, 40);
      assert.equal(out.tier, 3);
    });

    it("picks the strongest of several equipped tools for the action", () => {
      const out = harthmereEquippedToolPowerV151(
        {
          equipment: {
            main_hand: HARTHMERE_CRAFTING_TOOLS_V1.pickaxe, // damage 10
            off_hand: HARTHMERE_CRAFTING_TOOLS_V1.stonePick, // damage 22
          },
        },
        "destroy",
        "damage"
      );
      assert.equal(out.power, 22);
    });

    it("does not count a tool of a different action", () => {
      const out = harthmereEquippedToolPowerV151(
        { equipment: { main_hand: HARTHMERE_CRAFTING_TOOLS_V1.repairMallet } },
        "destroy",
        "damage"
      );
      assert.equal(out.power, 0);
    });
  });

  describe("harthmereRepairToolGateV151 (repair needs an equipped repair tool)", () => {
    it("fails when no repair tool is equipped", () => {
      const gate = harthmereRepairToolGateV151({ equipment: {} });
      assert.equal(gate.ok, false);
      if (!gate.ok) {
        assert.equal(gate.reason, "no_repair_tool_equipped");
      }
    });

    it("passes and reports repair power for an equipped repair tool", () => {
      const gate = harthmereRepairToolGateV151({
        equipment: {
          main_hand: HARTHMERE_CRAFTING_TOOLS_V1.reinforcedRepairKit,
        },
      });
      assert.equal(gate.ok, true);
      if (gate.ok) {
        assert.equal(gate.toolItemId, HARTHMERE_CRAFTING_TOOLS_V1.reinforcedRepairKit);
        assert.equal(gate.repairPower, 4);
        assert.equal(gate.tier, 2);
      }
    });
  });

  describe("harthmereJobRequirementToolSubObjectiveV151 (missing-tool sub-objective)", () => {
    it("returns a sub-objective when the repair tool is not equipped", () => {
      const sub = harthmereJobRequirementToolSubObjectiveV151({
        requirements: [{ itemId: "softwood_log", count: 3, requiredToolAction: "repair" }],
        hasEquippedToolForAction: () => false,
      });
      assert.ok(sub);
      assert.equal(sub?.requiredToolAction, "repair");
    });

    it("returns nothing when the repair tool is equipped", () => {
      const sub = harthmereJobRequirementToolSubObjectiveV151({
        requirements: [{ itemId: "softwood_log", count: 3, requiredToolAction: "repair" }],
        hasEquippedToolForAction: () => true,
      });
      assert.equal(sub, undefined);
    });

    it("ignores requirements with no tool need", () => {
      const sub = harthmereJobRequirementToolSubObjectiveV151({
        requirements: [{ itemId: "wild_berries", count: 6 }],
        hasEquippedToolForAction: () => false,
      });
      assert.equal(sub, undefined);
    });
  });
});
