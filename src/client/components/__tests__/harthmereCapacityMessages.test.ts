/// <reference types="mocha" />

import assert from "assert";
import { harthmerePlayerCapacityMessage } from "@/client/components/harthmere_capacity_messages";

describe("Harthmere player-facing capacity messages", () => {
  const capacityCodes = [
    "cooking_rejected:queue_full",
    "cooking_rejected:inventory_full",
    "crafting_rejected:output_stack_size_exceeded",
    "equipment_rejected:inventory_full",
    "mail_claim_rejected:inventory_full",
    "bank_rejected:bank_full",
    "bank_rejected:max_slots_reached",
    "bank_rejected:account_bank_full",
    "bank_rejected:inventory_full",
    "bank_rejected:material_storage_full",
    "bank_capacity_full",
    "guild_rejected:guild_bank_full",
    "guild_rejected:inventory_full",
    "guild_rejected:guild_bank_max_slots_reached",
    "guild_rejected:guild_member_cap_reached",
    "guild_rejected:daily_withdraw_limit_exceeded",
    "economy_rejected:owner_business_limit_reached",
    "economy_rejected:business_storage_full",
    "economy_rejected:business_storage_full_for_recipe_output",
    "economy_rejected:business_employee_capacity_full",
    "economy_rejected:destination_storage_full",
    "economy_rejected:market_buyer_storage_full",
    "economy_rejected:business_branch_automation_slots_full",
    "economy_rejected:branch_warehouse_full",
    "economy_rejected:branch_staff_slots_full",
    "inventory_full_or_stack_exceeded",
    "guild_vault_full_or_stack_exceeded",
    "business_inventory_full_or_stack_exceeded",
    "target_inventory_full_or_stack_exceeded",
    "target_inventory_full",
    "buyer_inventory_full",
    "buyer_stack_size_exceeded",
    "loadout_slot_limit_exceeded",
    "plot_coverage_limit_exceeded",
    "plot_height_limit_exceeded:32",
    "plot_ownership_limit_reached",
    "home_decoration_rejected:decoration_limit_reached",
  ];

  it("covers every capacity rejection with human-readable guidance", () => {
    for (const code of capacityCodes) {
      const message = harthmerePlayerCapacityMessage(code);
      assert.ok(message, `missing player message for ${code}`);
      assert.equal(message?.includes("_"), false, code);
      assert.equal(message?.includes(":"), false, code);
      assert.equal(
        /\b(?:backend|mutation|payload|rejected|server)\b/i.test(message ?? ""),
        false,
        code
      );
      assert.match(message ?? "", /[.!?]$/, code);
      assert.ok((message?.length ?? 0) > 25, code);
    }
  });

  it("does not claim unrelated failures are capacity problems", () => {
    assert.equal(
      harthmerePlayerCapacityMessage("guild_rejected:missing_permission"),
      undefined
    );
  });
});
