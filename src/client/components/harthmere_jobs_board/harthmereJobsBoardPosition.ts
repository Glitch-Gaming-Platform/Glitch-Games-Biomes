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

/**
 * Proximity alone is not an interaction target. Require the board/object to be
 * inside a forward cone so F cannot open whichever station happens to be
 * nearest behind the player or off to the side.
 */
export function harthmereWorldTargetIsFaced(
  camera: unknown,
  target: HarthmereJobsBoardPoint | undefined,
  minimumDot = 0.55
) {
  if (!target) return false;
  const position = harthmereJobsBoardCameraPosition(camera);
  const record = camera as { view?: unknown } | undefined;
  const view = pointFromMaybeMethod(record?.view);
  if (!position || !view) return false;
  const dx = target.x - position.x;
  const dy = (target.y ?? position.y ?? 0) - (position.y ?? 0);
  const dz = target.z - position.z;
  const distance = Math.hypot(dx, dy, dz);
  const viewLength = Math.hypot(view.x, view.y ?? 0, view.z);
  if (distance === 0 || viewLength === 0) return true;
  const dot =
    (dx * view.x + dy * (view.y ?? 0) + dz * view.z) / (distance * viewLength);
  return Number.isFinite(dot) && dot >= minimumDot;
}
