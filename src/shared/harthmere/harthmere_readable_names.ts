// Shared last-line defense against leaking internal ids into player-facing UI.
// Registered content labels should still win whenever they exist; this helper
// is for dynamic/fallback labels assembled from marker and item identifiers.

import { CH1_FRAGMENTS } from "@/shared/harthmere/ch1_fragment_ledger";
import { CH1_ITEMS } from "@/shared/harthmere/ch1_items";

const CHAPTER1_CANONICAL_LABELS = new Map<string, string>([
  ...CH1_ITEMS.map((item) => [item.id, item.name] as const),
  ...CH1_FRAGMENTS.map((fragment) => [fragment.id, fragment.title] as const),
]);

const TECHNICAL_PREFIXES = [
  /^(?:jobs?_board_marker|jobs?_board|map_marker)[_:\-]+/i,
  /^(?:harthmere_owner|harthmere_business_outpost|business_outpost)[_:\-]+/i,
  /^(?:harthmere|grove|npc|econ)[_:\-]+/i,
  /^(?:outpost|marker)[_:\-]+/i,
];

function looksMachineReadable(value: string) {
  return (
    /[_/]/.test(value) ||
    /^(?:jobs?_board|map_marker|harthmere|grove|npc|econ|outpost|marker)[-:]/i.test(
      value
    )
  );
}

function readableIdentifierFragment(value: string) {
  let normalized = value.trim();
  let stripped = true;
  while (stripped) {
    stripped = false;
    for (const prefix of TECHNICAL_PREFIXES) {
      const next = normalized.replace(prefix, "");
      if (next !== normalized) {
        normalized = next;
        stripped = true;
      }
    }
  }
  return normalized
    .replace(/[:/_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function humanReadableHarthmereIdentifier(
  value: unknown,
  fallback = "Unknown"
) {
  const text = String(value ?? "").trim() || fallback;
  const canonical = CHAPTER1_CANONICAL_LABELS.get(text);
  if (canonical) return canonical;
  const parts = text.split(/(\s+[—–]\s+|:\s+)/);
  return parts
    .map((part) =>
      looksMachineReadable(part.trim())
        ? readableIdentifierFragment(part)
        : part
    )
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}
