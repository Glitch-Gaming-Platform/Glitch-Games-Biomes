import type {
  ReadonlyInventory,
  ReadonlyTriggerState,
  TriggerState,
} from "@/shared/ecs/gen/components";
import type {
  Item,
  ItemAndCount,
  OwnedItemReference,
} from "@/shared/ecs/gen/types";
import { countOf } from "@/shared/game/items";
export {
  HARTHMERE_ARROW_DAMAGE,
  HARTHMERE_ARROW_ITEM_ID,
  HARTHMERE_BOW_ATTACK_TIMING,
  HARTHMERE_BOW_COOLDOWN_MS,
} from "@/shared/harthmere/harthmere_bow_contract";
import {
  HARTHMERE_ARROW_ITEM_ID,
  HARTHMERE_BOW_COOLDOWN_MS,
} from "@/shared/harthmere/harthmere_bow_contract";
import { harthmereNativeItemCombatProfile } from "@/shared/harthmere/harthmere_native_combat";
import {
  harthmereNativeBiomesIdForItemId,
  harthmereNativeItemIdForBiomesId,
} from "@/shared/harthmere/harthmere_native_item_ids";
import {
  getHarthmerePremiumWeapon,
  type HarthmerePremiumWeaponDefinition,
} from "@/shared/harthmere/premium_weapon_catalog";
import type { BiomesId } from "@/shared/ids";

export const HARTHMERE_RESOURCE_ATTACK_RECEIPT_TTL_MS = 10_000;

export type HarthmereRangedResourceKind = "arrow" | "mana";

export interface HarthmereRangedResourceReceipt {
  attackTimeMs: number;
  authorizedAtMs: number;
  itemId: BiomesId | undefined;
  targetId: BiomesId | undefined;
  kind: HarthmereRangedResourceKind | undefined;
  used: boolean;
  lastResourceAttackAtMs: number;
}

// These values live under the existing native-combat TriggerState root. They are
// deliberately separate from combo cadence: firing a paid projectile and later
// resolving its hit are two phases of the same attack, not two attacks.
const HARTHMERE_RANGED_RESOURCE_ATTACK_TIME_MS_KEY =
  8_740_000_000_000_010 as BiomesId;
const HARTHMERE_RANGED_RESOURCE_AUTHORIZED_AT_MS_KEY =
  8_740_000_000_000_011 as BiomesId;
const HARTHMERE_RANGED_RESOURCE_ITEM_ID_KEY = 8_740_000_000_000_012 as BiomesId;
const HARTHMERE_RANGED_RESOURCE_TARGET_ID_KEY =
  8_740_000_000_000_013 as BiomesId;
const HARTHMERE_RANGED_RESOURCE_KIND_KEY = 8_740_000_000_000_014 as BiomesId;
const HARTHMERE_RANGED_RESOURCE_USED_KEY = 8_740_000_000_000_015 as BiomesId;
const HARTHMERE_LAST_RANGED_RESOURCE_ATTACK_AT_MS_KEY =
  8_740_000_000_000_016 as BiomesId;

const RESOURCE_KIND_CODE: Readonly<
  Record<HarthmereRangedResourceKind, number>
> = {
  arrow: 1,
  mana: 2,
};

function resourceKindFromCode(
  value: unknown
): HarthmereRangedResourceKind | undefined {
  switch (Math.trunc(Number(value) || 0)) {
    case 1:
      return "arrow";
    case 2:
      return "mana";
    default:
      return undefined;
  }
}

export function harthmereBowWeaponDefinition(
  item: Pick<Item, "id"> | undefined
): HarthmerePremiumWeaponDefinition | undefined {
  if (!item) return undefined;
  const semanticItemId =
    harthmereNativeItemIdForBiomesId(Number(item.id)) ?? String(item.id);
  const weapon = getHarthmerePremiumWeapon(semanticItemId);
  return weapon?.family === "bow" ? weapon : undefined;
}

export function isHarthmereBowWeapon(item: Pick<Item, "id"> | undefined) {
  return harthmereBowWeaponDefinition(item) !== undefined;
}

export function harthmereRangedResourceKind(
  item: Pick<Item, "id"> | undefined
): HarthmereRangedResourceKind | undefined {
  if (isHarthmereBowWeapon(item)) return "arrow";
  const profile = harthmereNativeItemCombatProfile(item);
  return profile?.kind === "spell" && profile.manaCost > 0 ? "mana" : undefined;
}

export function harthmereRangedResourceCooldownMs(
  item: Pick<Item, "id"> | undefined
) {
  if (isHarthmereBowWeapon(item)) return HARTHMERE_BOW_COOLDOWN_MS;
  const profile = harthmereNativeItemCombatProfile(item);
  return Math.max(1, Math.round((profile?.intervalSecs ?? 1) * 1000));
}

export function harthmereMagicManaCost(item: Pick<Item, "id"> | undefined) {
  const profile = harthmereNativeItemCombatProfile(item);
  return profile?.kind === "spell" ? Math.max(0, profile.manaCost) : 0;
}

export function findHarthmereBackpackArrow(
  inventory: Pick<ReadonlyInventory, "items"> | undefined
): { ref: OwnedItemReference; stack: ItemAndCount } | undefined {
  const arrowId = harthmereNativeBiomesIdForItemId(HARTHMERE_ARROW_ITEM_ID);
  if (!arrowId || !inventory) return undefined;
  for (let idx = 0; idx < inventory.items.length; idx += 1) {
    const stack = inventory.items[idx];
    if (stack?.item.id === arrowId && stack.count > 0n) {
      return { ref: { kind: "item", idx }, stack: stack as ItemAndCount };
    }
  }
  return undefined;
}

export function harthmereBackpackArrowCount(
  inventory: Pick<ReadonlyInventory, "items"> | undefined
) {
  const arrowId = harthmereNativeBiomesIdForItemId(HARTHMERE_ARROW_ITEM_ID);
  if (!arrowId || !inventory) return 0n;
  return inventory.items.reduce(
    (total, stack) => total + (stack?.item.id === arrowId ? stack.count : 0n),
    0n
  );
}

export function oneHarthmereArrow() {
  const arrowId = harthmereNativeBiomesIdForItemId(HARTHMERE_ARROW_ITEM_ID);
  return arrowId ? countOf(arrowId, 1n) : undefined;
}

export function readHarthmereRangedResourceReceipt(
  state: ReadonlyTriggerState | TriggerState | undefined
): HarthmereRangedResourceReceipt {
  // Keep this import boundary acyclic: the root value is stable and public, but
  // the receipt module does not alter the combat-progression interface.
  const root = 8_740_000_000_000_001 as BiomesId;
  const values = state?.by_root.get(root);
  const itemIdValue = Math.trunc(
    Number(values?.get(HARTHMERE_RANGED_RESOURCE_ITEM_ID_KEY) ?? 0) || 0
  );
  const targetIdValue = Math.trunc(
    Number(values?.get(HARTHMERE_RANGED_RESOURCE_TARGET_ID_KEY) ?? 0) || 0
  );
  return {
    attackTimeMs: Math.max(
      0,
      Math.trunc(
        Number(
          values?.get(HARTHMERE_RANGED_RESOURCE_ATTACK_TIME_MS_KEY) ?? 0
        ) || 0
      )
    ),
    authorizedAtMs: Math.max(
      0,
      Math.trunc(
        Number(
          values?.get(HARTHMERE_RANGED_RESOURCE_AUTHORIZED_AT_MS_KEY) ?? 0
        ) || 0
      )
    ),
    itemId: itemIdValue > 0 ? (itemIdValue as BiomesId) : undefined,
    targetId: targetIdValue > 0 ? (targetIdValue as BiomesId) : undefined,
    kind: resourceKindFromCode(values?.get(HARTHMERE_RANGED_RESOURCE_KIND_KEY)),
    used: Number(values?.get(HARTHMERE_RANGED_RESOURCE_USED_KEY) ?? 0) === 1,
    lastResourceAttackAtMs: Math.max(
      0,
      Math.trunc(
        Number(
          values?.get(HARTHMERE_LAST_RANGED_RESOURCE_ATTACK_AT_MS_KEY) ?? 0
        ) || 0
      )
    ),
  };
}

export function writeHarthmereRangedResourceReceipt(
  state: TriggerState,
  changes: Partial<HarthmereRangedResourceReceipt>
) {
  const root = 8_740_000_000_000_001 as BiomesId;
  const next = { ...readHarthmereRangedResourceReceipt(state), ...changes };
  let values = state.by_root.get(root);
  if (!values) {
    values = new Map();
    state.by_root.set(root, values);
  }
  values.set(
    HARTHMERE_RANGED_RESOURCE_ATTACK_TIME_MS_KEY,
    Math.max(0, Math.trunc(next.attackTimeMs))
  );
  values.set(
    HARTHMERE_RANGED_RESOURCE_AUTHORIZED_AT_MS_KEY,
    Math.max(0, Math.trunc(next.authorizedAtMs))
  );
  values.set(HARTHMERE_RANGED_RESOURCE_ITEM_ID_KEY, Number(next.itemId ?? 0));
  values.set(
    HARTHMERE_RANGED_RESOURCE_TARGET_ID_KEY,
    Number(next.targetId ?? 0)
  );
  values.set(
    HARTHMERE_RANGED_RESOURCE_KIND_KEY,
    next.kind ? RESOURCE_KIND_CODE[next.kind] : 0
  );
  values.set(HARTHMERE_RANGED_RESOURCE_USED_KEY, next.used ? 1 : 0);
  values.set(
    HARTHMERE_LAST_RANGED_RESOURCE_ATTACK_AT_MS_KEY,
    Math.max(0, Math.trunc(next.lastResourceAttackAtMs))
  );
  return readHarthmereRangedResourceReceipt(state);
}

export function harthmereRangedResourceReceiptMatches(
  state: ReadonlyTriggerState | TriggerState | undefined,
  input: {
    attackTime: number | undefined;
    itemId: BiomesId | undefined;
    targetId: BiomesId | undefined;
    nowMs: number;
  }
) {
  if (!Number.isFinite(input.attackTime)) return false;
  const receipt = readHarthmereRangedResourceReceipt(state);
  const attackTimeMs = Math.round(Number(input.attackTime) * 1000);
  return Boolean(
    receipt.kind &&
    !receipt.used &&
    receipt.attackTimeMs === attackTimeMs &&
    receipt.itemId === input.itemId &&
    receipt.targetId === input.targetId &&
    input.nowMs >= receipt.authorizedAtMs &&
    input.nowMs - receipt.authorizedAtMs <=
      HARTHMERE_RESOURCE_ATTACK_RECEIPT_TTL_MS
  );
}

export function consumeHarthmereRangedResourceReceipt(state: TriggerState) {
  return writeHarthmereRangedResourceReceipt(state, { used: true });
}
