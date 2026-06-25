export type BiomesUIStaminaWarningLevel = "none" | "low" | "critical";

function safeNumber(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function biomesUIStaminaWarningLevelForTest(
  staminaValue: unknown,
  staminaMax: unknown
): BiomesUIStaminaWarningLevel {
  const value = Math.max(0, safeNumber(staminaValue, 0));
  const max = Math.max(1, safeNumber(staminaMax, 1));
  const ratio = value / max;
  if (ratio <= 0.1) return "critical";
  if (ratio <= 0.25) return "low";
  return "none";
}
