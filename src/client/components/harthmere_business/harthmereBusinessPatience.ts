export type HarthmereBusinessPatienceUrgency =
  "steady" | "warning" | "critical" | "expired";

export interface HarthmereBusinessPatienceDisplay {
  total: number;
  remaining: number;
  ratio: number;
  percent: number;
  urgency: HarthmereBusinessPatienceUrgency;
  label: string;
}

function wholeNonNegative(value: number, fallback: number) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
}

export function harthmereBusinessPatienceDisplay(
  patience: number,
  patienceRemaining: number
): HarthmereBusinessPatienceDisplay {
  const total = Math.max(1, wholeNonNegative(patience, 1));
  const remaining = Math.min(total, wholeNonNegative(patienceRemaining, total));
  const ratio = remaining / total;
  const urgency: HarthmereBusinessPatienceUrgency =
    remaining === 0
      ? "expired"
      : ratio <= 0.25
        ? "critical"
        : ratio <= 0.5
          ? "warning"
          : "steady";
  return {
    total,
    remaining,
    ratio,
    percent: Math.round(ratio * 100),
    urgency,
    label:
      remaining === 0
        ? "Out of patience"
        : `${remaining} second${remaining === 1 ? "" : "s"} left`,
  };
}

export function harthmereBusinessCustomerDisplayName(npcId: string) {
  const normalized = npcId.replace(/^customer_/, "").replace(/[_-]+/g, " ");
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
