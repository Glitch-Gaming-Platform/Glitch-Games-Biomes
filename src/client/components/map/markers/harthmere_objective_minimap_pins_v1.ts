// HARTHMERE_OBJECTIVE_MINIMAP_PINS_V1
//
// The full BiomesUI map shows accepted jobs-board jobs and live-entity-helper
// quests as landmarks, but the minimap historically rendered only snapshot-grove
// / business / property markers + the single user-set active pin. So a player
// who accepted a job or helper quest got NO passive minimap guidance toward it.
// This pure mapper turns those BiomesUI landmarks into minimap pins (the React
// minimap component renders them), giving the minimap parity with the big map.

export interface HarthmereObjectiveMiniMapPinV1 {
  key: string;
  markerId: string;
  label: string;
  position: [number, number, number];
}

export function harthmereObjectiveMiniMapPinsFromLandmarksV1(
  landmarks: ReadonlyArray<{
    id?: unknown;
    label?: unknown;
    position?: unknown;
  }>
): HarthmereObjectiveMiniMapPinV1[] {
  const seen = new Set<string>();
  const pins: HarthmereObjectiveMiniMapPinV1[] = [];
  for (const landmark of landmarks) {
    const id = String(landmark?.id ?? "").trim();
    const position = landmark?.position;
    if (!id || seen.has(id) || !Array.isArray(position) || position.length < 3) {
      continue;
    }
    const x = Number(position[0]);
    const y = Number(position[1]);
    const z = Number(position[2]);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      continue;
    }
    seen.add(id);
    const label = String(landmark?.label ?? "").trim() || "Objective";
    pins.push({ key: id, markerId: id, label, position: [x, y, z] });
  }
  return pins;
}
