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
  if (raw) {
    return value;
  }
  return value
    .replace(/^npc[_:-]+/i, "")
    .replace(/^grove[_:-]+/i, "")
    .replace(/^harthmere[_:-]+/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
