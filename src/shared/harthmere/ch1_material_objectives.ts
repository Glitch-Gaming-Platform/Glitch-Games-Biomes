import {
  ch1ProvisioningFor,
  type Ch1ProvisioningRequirement,
} from "@/shared/harthmere/ch1_fracture_gates";
import type { Ch1QuestStep } from "@/shared/harthmere/ch1_quests";

export interface Ch1MaterialItemOption {
  itemId: string;
  itemName: string;
}

export interface Ch1ObjectiveMaterialRequirement {
  label: string;
  count: number;
  /** Any one option satisfies this requirement category. */
  options: readonly Ch1MaterialItemOption[];
}

const PROVISIONING_OPTIONS: Readonly<
  Record<string, readonly Ch1MaterialItemOption[]>
> = Object.freeze({
  water: [{ itemId: "clean_water", itemName: "Clean Water" }],
  food: [{ itemId: "road_ration", itemName: "Road Ration" }],
  cooked: [{ itemId: "hearty_stew", itemName: "Hearty Stew" }],
  forage: [{ itemId: "herb_bundle", itemName: "Herb Bundle" }],
  light: [{ itemId: "wall_lantern", itemName: "Wall Lantern" }],
  repair_kit: [{ itemId: "road_repair_kit", itemName: "Road Repair Kit" }],
  bandage: [{ itemId: "field_medkit", itemName: "Field Medkit" }],
  fuel: [{ itemId: "coal", itemName: "Coal" }],
  cold_gear: [{ itemId: "patched_cloak", itemName: "Patched Mudden Cloak" }],
  rope: [{ itemId: "rope", itemName: "Rope" }],
  iron: [{ itemId: "iron_ingot", itemName: "Iron Ingot" }],
});

function provisioningMaterialRequirement(
  requirement: Ch1ProvisioningRequirement
): Ch1ObjectiveMaterialRequirement | undefined {
  const options = PROVISIONING_OPTIONS[requirement.key];
  return options?.length
    ? {
        label: requirement.label,
        count: requirement.quantity,
        options,
      }
    : undefined;
}

/**
 * Player-acquirable materials for the current Chapter 1 objective.
 *
 * Story-owned inventory (tea, the core cell, Compound B, Sorrel's ledger) is
 * deliberately excluded: those items are granted by prior Chapter 1 steps and
 * must never be presented as ordinary buy/craft/gather commodities.
 */
export function ch1ObjectiveMaterialRequirements(
  step: Ch1QuestStep
): readonly Ch1ObjectiveMaterialRequirement[] {
  const direct = (step.inventoryRequirements ?? [])
    .filter((requirement) => !requirement.itemId.startsWith("item_"))
    .map((requirement) => ({
      label: requirement.label,
      count: requirement.count,
      options: [
        {
          itemId: requirement.itemId,
          itemName: requirement.label,
        },
      ],
    }));
  if (direct.length) return direct;

  const gateId =
    step.id === "provision"
      ? "ch1_gate_desert"
      : step.id === "provision_winter"
      ? "ch1_gate_winter"
      : undefined;
  if (!gateId) return [];
  return (ch1ProvisioningFor(gateId)?.requirements ?? []).flatMap(
    (requirement) => provisioningMaterialRequirement(requirement) ?? []
  );
}
