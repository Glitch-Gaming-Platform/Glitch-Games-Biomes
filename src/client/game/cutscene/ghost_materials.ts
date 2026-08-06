// Authored cinematic creatures carry their final PBR/voxel palette in the
// GLTF. Replacing those materials with the player shader turns every material
// slot into the same flat gray surface, which is especially destructive for
// the Harthmere boss marketing puppets.

export function preserveAuthoredCutsceneGhostMaterials(asset: string): boolean {
  const pathname = asset.split(/[?#]/, 1)[0]?.replaceAll("\\", "/") ?? "";
  return pathname.startsWith("/assets/harthmere/glb/bosses/");
}
