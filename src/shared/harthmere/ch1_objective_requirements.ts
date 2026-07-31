import {
  ch1CheckProvisioning,
  ch1ProvisioningFor,
} from "@/shared/harthmere/ch1_fracture_gates";
import {
  ch1ProvisioningCarriedFromInventory,
  type Ch1LiveGateRuntimeState,
} from "@/shared/harthmere/ch1_live_gate";
import {
  CH1_GROVE_SUPPLIER_ROUTE,
  ch1NextSupplierRouteStop,
} from "@/shared/harthmere/ch1_objective_routes";
import type { Ch1QuestStep } from "@/shared/harthmere/ch1_quests";

export const CH1_REQUIRED_GROVE_JOB_COMPLETIONS = 3;

export interface Ch1ObjectiveRequirementState {
  ready: boolean;
  current: number;
  total: number;
  reason?: string;
  /** Let the underlying board/vendor interaction own F until evidence exists. */
  blocksChapterInteraction: boolean;
  /** The client may submit completion as soon as the evidence is ready. */
  autoCompleteWhenReady: boolean;
}

function inventoryRequirements(input: {
  step: Ch1QuestStep;
  inventory: Readonly<Record<string, number>>;
}): Ch1ObjectiveRequirementState | undefined {
  const requirements = input.step.inventoryRequirements;
  if (!requirements?.length) return undefined;
  const missing = requirements.flatMap((requirement) => {
    const have = Math.max(
      0,
      Math.trunc(Number(input.inventory[requirement.itemId] ?? 0))
    );
    return have >= requirement.count
      ? []
      : [`${requirement.label}: ${have}/${requirement.count}`];
  });
  const current = requirements.length - missing.length;
  return {
    ready: missing.length === 0,
    current,
    total: requirements.length,
    reason: missing.length
      ? `Still needed — ${missing.join(", ")}.`
      : undefined,
    blocksChapterInteraction: false,
    autoCompleteWhenReady: false,
  };
}

export function ch1ObjectiveRequirementState(input: {
  step: Ch1QuestStep;
  runtime: Ch1LiveGateRuntimeState;
  inventory: Readonly<Record<string, number>>;
  completedGroveJobs: number;
  vendorTransactions: Readonly<Record<string, number>>;
}): Ch1ObjectiveRequirementState | undefined {
  const direct = inventoryRequirements(input);
  if (direct) return direct;

  if (input.step.id === "take_jobs") {
    const current = Math.min(
      CH1_REQUIRED_GROVE_JOB_COMPLETIONS,
      Math.max(0, Math.trunc(input.completedGroveJobs))
    );
    return {
      ready: current >= CH1_REQUIRED_GROVE_JOB_COMPLETIONS,
      current,
      total: CH1_REQUIRED_GROVE_JOB_COMPLETIONS,
      reason:
        current < CH1_REQUIRED_GROVE_JOB_COMPLETIONS
          ? `Complete ${
              CH1_REQUIRED_GROVE_JOB_COMPLETIONS - current
            } more Grove job${
              CH1_REQUIRED_GROVE_JOB_COMPLETIONS - current === 1 ? "" : "s"
            } from the board.`
          : undefined,
      blocksChapterInteraction: current < CH1_REQUIRED_GROVE_JOB_COMPLETIONS,
      autoCompleteWhenReady: true,
    };
  }

  if (input.step.id === "meet_the_suppliers") {
    const next = ch1NextSupplierRouteStop(input.vendorTransactions);
    const current = CH1_GROVE_SUPPLIER_ROUTE.filter(
      (supplier) => Number(input.vendorTransactions[supplier.vendorId] ?? 0) > 0
    ).length;
    return {
      ready: !next,
      current,
      total: CH1_GROVE_SUPPLIER_ROUTE.length,
      reason: next ? `Trade with ${next.label} at least once.` : undefined,
      blocksChapterInteraction: Boolean(next),
      autoCompleteWhenReady: true,
    };
  }

  const gateId =
    input.step.id === "provision"
      ? "ch1_gate_desert"
      : input.step.id === "provision_winter"
      ? "ch1_gate_winter"
      : undefined;
  if (gateId) {
    const provisioning = ch1ProvisioningFor(gateId);
    const result = ch1CheckProvisioning(
      gateId,
      ch1ProvisioningCarriedFromInventory(input.inventory)
    );
    const total = provisioning?.requirements.length ?? 0;
    const current = Math.max(0, total - result.missing.length);
    return {
      ready: result.ok,
      current,
      total,
      reason: result.ok
        ? undefined
        : `Pack check — ${result.missing
            .slice(0, 4)
            .map((row) => `${row.label} ${row.have}/${row.need}`)
            .join(", ")}${result.missing.length > 4 ? ", …" : ""}.`,
      blocksChapterInteraction: false,
      autoCompleteWhenReady: false,
    };
  }

  return undefined;
}
