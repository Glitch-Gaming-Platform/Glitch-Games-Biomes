import { humanReadableHarthmereIdentifier } from "@/shared/harthmere/harthmere_readable_names";

export function readableMapMarkerLabelForTest(landmark: any): string {
  const raw = [
    landmark?.label,
    landmark?.displayName,
    landmark?.name,
    landmark?.title,
    landmark?.entity_description?.text,
  ].find((value) => typeof value === "string" && value.trim().length > 0);
  const fallback = String(landmark?.id ?? "Unknown Marker");
  const value = String(raw ?? fallback).trim();
  return humanReadableHarthmereIdentifier(value, "Unknown Marker");
}
