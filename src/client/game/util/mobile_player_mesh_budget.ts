// Mobile Safari has a 1.5 GiB WebContent ceiling on the validated iPhone 12
// mini. A crowded spawn can put dozens of distinct generated player GLBs in
// the camera sphere at once. The renderer used to request every mesh before it
// applied its ordinary draw limit, so merely standing at the Grove could cross
// the process ceiling before the first interaction.

export const MOBILE_REMOTE_PLAYER_MESH_LOAD_LIMIT = 8;
export const MOBILE_NPC_MESH_LOAD_LIMIT = 6;

/**
 * Return the pre-load budget for remote player meshes.
 *
 * `undefined` deliberately means "keep the existing desktop path". Phones
 * cap the number of remote avatars whose generated GLBs may be requested in a
 * frame; the local player is loaded separately and never consumes this budget.
 */
export function remotePlayerMeshLoadLimitForDevice(
  mobileDevice: boolean,
  configuredRenderLimit: number
): number | undefined {
  if (!mobileDevice) {
    return undefined;
  }
  return Math.min(
    MOBILE_REMOTE_PLAYER_MESH_LOAD_LIMIT,
    Math.max(0, Math.floor(configuredRenderLimit))
  );
}

/**
 * NPCs use the same generated player-mesh pipeline for Harthmere humans. Keep
 * the nearest small cast resident on phones; cutscene/become-NPC must-keep ids
 * are added by the renderer independently of this ordinary-world budget.
 */
export function npcMeshLoadLimitForDevice(
  mobileDevice: boolean,
  configuredRenderLimit: number
): number {
  const normalized = Math.max(0, Math.floor(configuredRenderLimit));
  return mobileDevice
    ? Math.min(MOBILE_NPC_MESH_LOAD_LIMIT, normalized)
    : normalized;
}

/**
 * Persistent Chapter 1 puppet overrides describe more actors than a phone can
 * keep as generated avatars at once. Preserve the entire authored cast on
 * desktop and during a real cutscene; ordinary mobile gameplay streams the
 * nearest actors while still applying each selected actor's override.
 */
export function preserveAllPuppetNpcsForDevice(
  mobileDevice: boolean,
  cutsceneActive: boolean
): boolean {
  return !mobileDevice || cutsceneActive;
}
