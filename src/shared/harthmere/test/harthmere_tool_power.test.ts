/// <reference types="mocha" />

import assert from "assert";

import {
  harthmereEquippedToolPower,
  harthmereRepairToolGate,
  harthmereToolBaseValueForTier,
} from "@/shared/harthmere/mmo_inventory_authority";
import {
  harthmereJobRequirementToolSubObjective,
} from "@/shared/harthmere/mmo_jobs_board_authority";
import {
  HARTHMERE_CRAFTING_TOOLS,
  ensureHarthmereProductionCraftingCatalogue,
} from "@/shared/harthmere/mmo_crafting_catalogue";

ensureHarthmereProductionCraftingCatalogue();

describe("HARTHMERE_TOOL_POWER — tiered, equip-gated tools", () => {
  describe("harthmereToolBaseValueForTier (greater impact costs more)", () => {
    it("scales cost up with tier", () => {
      const t1 = harthmereToolBaseValueForTier(1, 0);
      const t2 = harthmereToolBaseValueForTier(2, 0);
      const t3 = harthmereToolBaseValueForTier(3, 0);
      assert.ok(t2 > t1, "tier 2 costs more than tier 1");
      assert.ok(t3 > t2, "tier 3 costs more than tier 2");
    });

    it("adds cost for higher power", () => {
      assert.ok(
        harthmereToolBaseValueForTier(1, 40) >
          harthmereToolBaseValueForTier(1, 0)
      );
    });
  });

  describe("harthmereEquippedToolPower (must be equipped)", () => {
    it("returns zero power when nothing is equipped", () => {
      const out = harthmereEquippedToolPower({ equipment: {} }, "destroy");
      assert.equal(out.power, 0);
      assert.equal(out.itemId, undefined);
    });

    it("returns the equipped destroy tool's damage", () => {
      const out = harthmereEquippedToolPower(
        { equipment: { main_hand: HARTHMERE_CRAFTING_TOOLS.silverPick } },
        "destroy",
        "damage"
      );
      assert.equal(out.itemId, HARTHMERE_CRAFTING_TOOLS.silverPick);
      assert.equal(out.power, 40);
      assert.equal(out.tier, 3);
    });

    it("picks the strongest of several equipped tools for the action", () => {
      const out = harthmereEquippedToolPower(
        {
          equipment: {
            main_hand: HARTHMERE_CRAFTING_TOOLS.pickaxe, // damage 10
            off_hand: HARTHMERE_CRAFTING_TOOLS.stonePick, // damage 22
          },
        },
        "destroy",
        "damage"
      );
      assert.equal(out.power, 22);
    });

    it("does not count a tool of a different action", () => {
      const out = harthmereEquippedToolPower(
        { equipment: { main_hand: HARTHMERE_CRAFTING_TOOLS.repairMallet } },
        "destroy",
        "damage"
      );
      assert.equal(out.power, 0);
    });
  });

  describe("harthmereRepairToolGate (repair needs an equipped repair tool)", () => {
    it("fails when no repair tool is equipped", () => {
      const gate = harthmereRepairToolGate({ equipment: {} });
      assert.equal(gate.ok, false);
      if (!gate.ok) {
        assert.equal(gate.reason, "no_repair_tool_equipped");
      }
    });

    it("passes and reports repair power for an equipped repair tool", () => {
      const gate = harthmereRepairToolGate({
        equipment: {
          main_hand: HARTHMERE_CRAFTING_TOOLS.reinforcedRepairKit,
        },
      });
      assert.equal(gate.ok, true);
      if (gate.ok) {
        assert.equal(gate.toolItemId, HARTHMERE_CRAFTING_TOOLS.reinforcedRepairKit);
        assert.equal(gate.repairPower, 4);
        assert.equal(gate.tier, 2);
      }
    });
  });

  describe("harthmereJobRequirementToolSubObjective (missing-tool sub-objective)", () => {
    it("returns a sub-objective when the repair tool is not equipped", () => {
      const sub = harthmereJobRequirementToolSubObjective({
        requirements: [{ itemId: "softwood_log", count: 3, requiredToolAction: "repair" }],
        hasEquippedToolForAction: () => false,
      });
      assert.ok(sub);
      assert.equal(sub?.requiredToolAction, "repair");
    });

    it("returns nothing when the repair tool is equipped", () => {
      const sub = harthmereJobRequirementToolSubObjective({
        requirements: [{ itemId: "softwood_log", count: 3, requiredToolAction: "repair" }],
        hasEquippedToolForAction: () => true,
      });
      assert.equal(sub, undefined);
    });

    it("ignores requirements with no tool need", () => {
      const sub = harthmereJobRequirementToolSubObjective({
        requirements: [{ itemId: "wild_berries", count: 6 }],
        hasEquippedToolForAction: () => false,
      });
      assert.equal(sub, undefined);
    });
  });
});
