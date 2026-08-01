import {
  HARTHMERE_MAGIC_CHARGE_EVENT,
  HARTHMERE_MAGIC_CHARGE_VERSION,
  type HarthmereMagicChargeEventDetail,
} from "@/shared/harthmere/magic_charge";

export function dispatchHarthmereMagicCharge(
  detail: HarthmereMagicChargeEventDetail
) {
  if (typeof window === "undefined") {
    return;
  }
  const normalized = {
    version: HARTHMERE_MAGIC_CHARGE_VERSION,
    ...detail,
  } satisfies HarthmereMagicChargeEventDetail;
  window.dispatchEvent(
    new CustomEvent(HARTHMERE_MAGIC_CHARGE_EVENT, { detail: normalized })
  );
  const win = window as typeof window & {
    __harthmereMagicChargeLog?: HarthmereMagicChargeEventDetail[];
  };
  win.__harthmereMagicChargeLog = [
    normalized,
    ...(win.__harthmereMagicChargeLog ?? []),
  ].slice(0, 120);
}

export function harthmereMagicChargeId(input: {
  casterKind: "player" | "npc";
  casterEntityId?: number;
  abilityId?: string;
  castTime: number;
}) {
  return [
    input.casterKind,
    input.casterEntityId ?? "local",
    input.abilityId ?? "magic",
    input.castTime.toFixed(3),
  ].join(":");
}
