/**
 * Converts authoritative capacity rejection codes into player-facing guidance.
 * Keep the backend code available in response payloads for diagnostics, but do
 * not make a player interpret snake case, reducer prefixes, or storage models.
 */
export function harthmerePlayerCapacityMessage(
  value: unknown
): string | undefined {
  const code = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!code) return undefined;

  if (code.includes("guild_bank_max_slots_reached")) {
    return "The guild bank is fully upgraded. Remove or consolidate items before depositing more.";
  }
  if (code.includes("guild_member_cap_reached")) {
    return "This guild has reached its member limit. A member must leave before someone else can join.";
  }
  if (code.includes("daily_withdraw_limit_exceeded")) {
    return "You have reached your guild bank withdrawal limit for today. Try again after the daily reset or ask an officer.";
  }
  if (
    code.includes("guild_vault_full_or_stack_exceeded") ||
    code.includes("guild_bank_full") ||
    code.includes("guild_vault_full")
  ) {
    return "The guild bank has no room for that item. Remove an item or make room in its existing stack.";
  }
  if (code.includes("target_inventory_full_or_stack_exceeded")) {
    return "The other player's backpack has no room for that item. Ask them to free a slot or make room in its stack.";
  }
  if (code.includes("target_inventory_full")) {
    return "The other player's backpack is full. Ask them to free a slot and try again.";
  }
  if (code.includes("market_buyer_storage_full")) {
    return "The buyer's business storage is full, so the sale was not completed.";
  }
  if (code.includes("destination_storage_full")) {
    return "The destination business has no storage space for that shipment.";
  }
  if (code.includes("business_storage_full_for_recipe_output")) {
    return "The business needs storage space for the finished goods before production can start.";
  }
  if (
    code.includes("business_inventory_full_or_stack_exceeded") ||
    code.includes("business_storage_full")
  ) {
    return "The business has no storage space for that item. Remove stock or make room in its existing stack.";
  }
  if (code.includes("branch_warehouse_full")) {
    return "The branch warehouse is full. Remove stock before sending more.";
  }
  if (code.includes("business_branch_automation_slots_full")) {
    return "This branch has no open automation slots. Remove an automation or unlock another slot.";
  }
  if (code.includes("branch_staff_slots_full")) {
    return "This branch has no open staff slots. Unassign a worker or unlock another slot.";
  }
  if (code.includes("business_employee_capacity_full")) {
    return "This business has reached its staff limit. Dismiss a worker before hiring another.";
  }
  if (code.includes("owner_business_limit_reached")) {
    return "You already own the maximum number of businesses. Close or transfer one before opening another.";
  }
  if (code.includes("account_bank_full")) {
    return "Your account bank is full. Remove or consolidate an item before depositing more.";
  }
  if (code.includes("material_storage_full")) {
    return "Your material storage is full. Use or remove materials before adding more.";
  }
  if (code.includes("bank_stack_size_exceeded")) {
    return "That item stack in the bank is at its limit. Use another bank slot or move some items out.";
  }
  if (code.includes("bank_rejected:max_slots_reached")) {
    return "Your personal bank is fully upgraded. Remove or consolidate items before depositing more.";
  }
  if (code.includes("bank_capacity_full") || code.includes("bank_full")) {
    return "Your personal bank is full. Remove or consolidate an item before depositing more.";
  }
  if (code.includes("plot_coverage_limit_exceeded")) {
    return "That building covers too much of this plot. Choose a smaller blueprint or a larger plot.";
  }
  if (code.includes("plot_height_limit_exceeded")) {
    return "That building is too tall for this plot. Choose a shorter blueprint or a plot with a higher limit.";
  }
  if (code.includes("plot_ownership_limit_reached")) {
    return "You already own the maximum number of plots. Release a plot before claiming another.";
  }
  if (code.includes("loadout_slot_limit_exceeded")) {
    return "Your ability loadout is full. Remove an ability before adding another.";
  }
  if (code.includes("decoration_limit_reached")) {
    return "This home has reached its decoration limit. Remove a decoration before placing another.";
  }
  if (code.includes("cooking_rejected:inventory_full")) {
    return "Your backpack is full. Free a backpack slot before collecting this dish.";
  }
  if (code.includes("cooking_rejected:queue_full")) {
    return "This station's cooking queue is full. Collect or cancel a dish before starting another.";
  }
  if (code.includes("mail_claim_rejected:inventory_full")) {
    return "Your backpack is full. Free a backpack slot before claiming this mail.";
  }
  if (code.includes("equipment_rejected:inventory_full")) {
    return "Your backpack is full. Free a backpack slot before changing equipment.";
  }
  if (code.includes("bank_rejected:inventory_full")) {
    return "Your backpack is full. Free a backpack slot before withdrawing this item.";
  }
  if (code.includes("vendor_rejected:inventory_full")) {
    return "Your backpack is full. Free a backpack slot before buying this item.";
  }
  if (code.includes("queue_full")) {
    return "This station's queue is full. Finish, collect, or cancel an item before adding another.";
  }
  if (
    code.includes("inventory_full_or_stack_exceeded") ||
    code.includes("output_stack_size_exceeded") ||
    code.includes("inventory_stack_size_exceeded") ||
    code.includes("stack_size_exceeded")
  ) {
    return "Your backpack has no room for that item. Free a slot or make room in its existing stack.";
  }
  if (code.includes("inventory_full") || code.includes("backpack_full")) {
    return "Your backpack is full. Free a backpack slot and try again.";
  }
  if (code.includes("max_slots_reached")) {
    return "This storage is already fully upgraded. Remove or consolidate items before adding more.";
  }

  return undefined;
}
