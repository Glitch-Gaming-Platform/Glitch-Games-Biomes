const MINIMUM_CAMERA_DEPTH_RANGE = 0.01;

/**
 * Keep a perspective camera's far plane strictly beyond its near plane.
 *
 * Three.js produces a singular projection matrix when `far === 0`. During the
 * first renderer tick the far-plane fade transition can still be at zero;
 * passing that matrix to Voxeloo's frustum sharder makes its synchronous scan
 * iterate invalid bounds and wedges the browser main thread.
 */
export function safeCameraFarPlane(near: number, proposedFar: number) {
  const safeNear = Number.isFinite(near) ? Math.max(0, near) : 0.1;
  const minimumFar = safeNear + MINIMUM_CAMERA_DEPTH_RANGE;
  return Number.isFinite(proposedFar)
    ? Math.max(minimumFar, proposedFar)
    : minimumFar;
}
