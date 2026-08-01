import type {
  ReadonlyHarthmereMaterialStorage,
  ReadonlyInventory,
} from "@/shared/ecs/gen/components";
import { CH1_ITEMS } from "@/shared/harthmere/ch1_items";
import { CH1_QUESTS } from "@/shared/harthmere/ch1_quests";
import { harthmereNativeItemIdForBiomesId } from "@/shared/harthmere/harthmere_native_item_ids";

const CH1_PLOT_ITEM_IDS = new Set(CH1_ITEMS.map((item) => item.id));

/** Read spendable Chapter 1 inventory directly from native ECS. */
export function readCh1NativeInventoryCounts(
  entity: { inventory(): ReadonlyInventory | undefined } | undefined
): Record<string, number> {
  const counts: Record<string, number> = {};
  const inventory = entity?.inventory?.();
  for (const stack of [
    ...(inventory?.items ?? []),
    ...(inventory?.hotbar ?? []),
  ]) {
    if (!stack) continue;
    const itemId = harthmereNativeItemIdForBiomesId(stack.item.id);
    if (!itemId) continue;
    counts[itemId] = (counts[itemId] ?? 0) + Number(stack.count);
  }
  return counts;
}

/** Read Chapter 1 materials auto-deposited by vendors into native storage. */
export function readCh1NativeMaterialStorageCounts(
  entity:
    | {
        harthmereMaterialStorage():
          | ReadonlyHarthmereMaterialStorage
          | undefined;
      }
    | undefined
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const stack of entity?.harthmereMaterialStorage?.()?.items.values() ??
    []) {
    const itemId = harthmereNativeItemIdForBiomesId(stack.item.id);
    if (!itemId) continue;
    counts[itemId] = (counts[itemId] ?? 0) + Number(stack.count);
  }
  return counts;
}

export function combineCh1NativeItemCounts(
  ...sources: ReadonlyArray<Readonly<Record<string, number>>>
): Record<string, number> {
  const combined: Record<string, number> = {};
  for (const source of sources) {
    for (const [itemId, count] of Object.entries(source)) {
      combined[itemId] =
        (combined[itemId] ?? 0) + Math.max(0, Math.trunc(count));
    }
  }
  return combined;
}

export function chapter1NativeInventoryTakeSourcesForTest(input: {
  required: readonly { itemId: string; nativeId: number; count: number }[];
  inventory: Readonly<Record<string, number>>;
  materialStorage: Readonly<Record<string, number>>;
}) {
  const inventory: Array<(typeof input.required)[number]> = [];
  const materialStorage: Array<(typeof input.required)[number]> = [];
  const missing: Array<{ itemId: string; count: number }> = [];
  for (const required of input.required) {
    let remaining = Math.max(0, Math.trunc(required.count));
    const fromInventory = Math.min(
      remaining,
      Math.max(0, Math.trunc(input.inventory[required.itemId] ?? 0))
    );
    if (fromInventory > 0) {
      inventory.push({ ...required, count: fromInventory });
      remaining -= fromInventory;
    }
    const fromStorage = Math.min(
      remaining,
      Math.max(0, Math.trunc(input.materialStorage[required.itemId] ?? 0))
    );
    if (fromStorage > 0) {
      materialStorage.push({ ...required, count: fromStorage });
      remaining -= fromStorage;
    }
    if (remaining > 0)
      missing.push({ itemId: required.itemId, count: remaining });
  }
  return { inventory, materialStorage, missing };
}

/** Chapter 1 objectives cannot consume an item while it is in overflow. */
export function readCh1NativeOverflowCounts(
  entity: { inventory(): ReadonlyInventory | undefined } | undefined
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const stack of entity?.inventory?.()?.overflow.values() ?? []) {
    const itemId = harthmereNativeItemIdForBiomesId(stack.item.id);
    if (!itemId) continue;
    counts[itemId] = (counts[itemId] ?? 0) + Number(stack.count);
  }
  return counts;
}

export function chapter1NativeInventoryRepairPlanForTest(input: {
  expected: Readonly<Record<string, number>>;
  available: Readonly<Record<string, number>>;
  overflow?: Readonly<Record<string, number>>;
}) {
  const moveFromOverflow: Array<{ itemId: string; count: number }> = [];
  const grant: Array<{ itemId: string; count: number }> = [];
  for (const item of CH1_ITEMS) {
    const expected = Math.max(0, Math.trunc(input.expected[item.id] ?? 0));
    const available = Math.max(0, Math.trunc(input.available[item.id] ?? 0));
    let missing = Math.max(0, expected - available);
    if (missing === 0) continue;
    const overflow = Math.max(0, Math.trunc(input.overflow?.[item.id] ?? 0));
    const movable = Math.min(missing, overflow);
    if (movable > 0) {
      moveFromOverflow.push({ itemId: item.id, count: movable });
      missing -= movable;
    }
    if (missing > 0) grant.push({ itemId: item.id, count: missing });
  }
  return { moveFromOverflow, grant };
}

/**
 * Recover the minimum plot-item inventory implied by native quest progress.
 *
 * Older/partially committed Chapter 1 saves can have a fired native quest leaf
 * without the corresponding durable story effect. The durable inventory mirror
 * alone then says the reward never existed, so the next objective deadlocks on
 * an item the chapter itself was responsible for granting. Only infer items that
 * the *current* objective requires and that an earlier fired leaf granted. This
 * repairs the entitlement without recreating unrelated collectibles or external
 * resources the player is expected to gather themselves.
 */
export function chapter1ProgressExpectedPlotInventoryForTest(input: {
  durable: Readonly<Record<string, number>>;
  activeQuestId?: string;
  activeStepId?: string;
  fired: (questId: string, stepIndex: number) => boolean;
}): Record<string, number> {
  const expected = { ...input.durable };
  if (!input.activeQuestId || !input.activeStepId) return expected;

  const activeQuestIndex = CH1_QUESTS.findIndex(
    (quest) => quest.id === input.activeQuestId
  );
  const activeQuest = CH1_QUESTS[activeQuestIndex];
  const activeStepIndex = activeQuest?.steps.findIndex(
    (step) => step.id === input.activeStepId
  );
  if (!activeQuest || activeStepIndex === undefined || activeStepIndex < 0) {
    return expected;
  }

  for (const requirement of activeQuest.steps[activeStepIndex]
    .inventoryRequirements ?? []) {
    if (!CH1_PLOT_ITEM_IDS.has(requirement.itemId)) continue;
    let entitlement = 0;
    outer: for (
      let questIndex = 0;
      questIndex < CH1_QUESTS.length;
      questIndex++
    ) {
      const quest = CH1_QUESTS[questIndex];
      for (let stepIndex = 0; stepIndex < quest.steps.length; stepIndex++) {
        if (questIndex === activeQuestIndex && stepIndex === activeStepIndex) {
          break outer;
        }
        if (!input.fired(quest.id, stepIndex)) continue;
        const step = quest.steps[stepIndex];
        entitlement += (step.grants ?? []).filter(
          (itemId) => itemId === requirement.itemId
        ).length;
        if (step.consumeInventoryRequirements) {
          entitlement -= (step.inventoryRequirements ?? [])
            .filter((candidate) => candidate.itemId === requirement.itemId)
            .reduce((sum, candidate) => sum + candidate.count, 0);
        }
        entitlement = Math.max(0, entitlement);
      }
    }
    if (entitlement >= requirement.count) {
      expected[requirement.itemId] = Math.max(
        requirement.count,
        Math.trunc(expected[requirement.itemId] ?? 0)
      );
    }
  }
  return expected;
}
