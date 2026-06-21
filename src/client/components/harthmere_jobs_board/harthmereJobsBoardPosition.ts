import {
  normalizeHarthmereJobsBoardPoint,
  type HarthmereJobsBoardPoint,
} from "./jobsBoardLiveAdapter";

function pointFromMaybeMethod(
  value: unknown
): HarthmereJobsBoardPoint | undefined {
  if (typeof value === "function") {
    try {
      return normalizeHarthmereJobsBoardPoint(value());
    } catch {
      return undefined;
    }
  }
  return normalizeHarthmereJobsBoardPoint(value);
}

export function harthmereJobsBoardPlayerPosition(
  localPlayer: unknown,
  camera: unknown
): HarthmereJobsBoardPoint | undefined {
  const player = localPlayer as Record<string, unknown> | undefined;
  return (
    normalizeHarthmereJobsBoardPoint(player?.position) ??
    normalizeHarthmereJobsBoardPoint(
      player?.player && (player.player as any).position
    ) ??
    normalizeHarthmereJobsBoardPoint(player?.centerPos) ??
    pointFromMaybeMethod((player as any)?.player?.centerPos) ??
    pointFromMaybeMethod((player as any)?.pos) ??
    harthmereJobsBoardCameraPosition(camera)
  );
}

export function harthmereJobsBoardCameraPosition(
  camera: unknown
): HarthmereJobsBoardPoint | undefined {
  const record = camera as Record<string, unknown> | undefined;
  return (
    normalizeHarthmereJobsBoardPoint(record?.pos) ??
    pointFromMaybeMethod((record as any)?.pos) ??
    normalizeHarthmereJobsBoardPoint(
      (record as any)?.three?.position?.toArray?.()
    ) ??
    normalizeHarthmereJobsBoardPoint((record as any)?.three?.position) ??
    normalizeHarthmereJobsBoardPoint(record?.position)
  );
}
