import type { ClientContextSubset } from "@/client/game/context";
import type { ClientInput } from "@/client/game/context_managers/input";
import { throwInventoryItem } from "@/client/game/helpers/inventory";
import type { BiomesId } from "@/shared/ids";
import type { Item } from "@/shared/game/item";
import { describeHotbarPrimaryAction } from "./hotbarAction";

function waitForSelectionRender() {
  return new Promise<void>((resolve) => {
    if (typeof window !== "undefined" && window.requestAnimationFrame) {
      window.requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}

/** Drive the original native InteractScript after the hotbar index changes. */
export async function activateNativeHotbarPrimaryAction(input: {
  gameInput: ClientInput;
  item: Item;
  slotIndex: number;
  waitForSelection?: () => Promise<void>;
}) {
  const action = describeHotbarPrimaryAction(input.item);
  await (input.waitForSelection ?? waitForSelectionRender)();
  await input.gameInput.pulseMotion(
    "primary_hold",
    action.holdDurationMs,
    `biomes-ui-hotbar:${input.slotIndex}`
  );
}

/** Throw one unit from a native stack; never omit count and eject the stack. */
export async function throwOneNativeHotbarItem(
  deps: ClientContextSubset<
    "events" | "resources" | "clientConfig" | "voxeloo" | "gardenHose"
  >,
  playerId: BiomesId,
  slotIndex: number,
  throwItem = throwInventoryItem
) {
  return throwItem(deps, playerId, { kind: "hotbar", idx: slotIndex }, 1n);
}
