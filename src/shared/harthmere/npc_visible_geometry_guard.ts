// HARTHMERE_NPC_VISIBLE_GEOMETRY_GUARD96
//
// Node-safe helpers that decide whether a resolved NPC scene actually contains
// renderable geometry. The client NPC mesh resolver (src/client/game/resources/
// npcs.ts) uses these to guarantee that *every* NPC render path falls back to a
// visible voxel body when an authored/generated asset loads but produces no
// drawable geometry — otherwise those NPCs show up as a floating nameplate with
// an invisible body.
//
// This module intentionally depends only on `three` (which imports cleanly in
// Node) so the guard logic can be unit-tested without pulling in the full client
// renderer stack.

export const HARTHMERE_NPC_VISIBLE_GEOMETRY_GUARD_VERSION =
  "harthmere-npc-visible-geometry-guard" as const;

// Minimum renderable vertices a scene must contain to count as "visible". A
// single rounded voxel box is well above this; an empty/transparent mannequin
// or a stripped GLTF scene falls below it.
export const HARTHMERE_NPC_MIN_RENDERABLE_VERTICES = 24;

export interface HarthmereNpcVisibleGeometryStats {
  visibleMeshes: number;
  renderableVertices: number;
}

// Structural (duck-typed) view of just the bits of a three.js object we need.
// Using structural typing keeps this module free of a hard three dependency at
// the type level while still working on real THREE.Object3D instances.
interface TraversableObject3DLike {
  traverse(callback: (object: unknown) => void): void;
}

function asMeshLike(object: unknown): {
  isMesh?: boolean;
  visible?: boolean;
  geometry?: { getAttribute?: (name: string) => { count?: number } | undefined };
  material?: unknown;
} | undefined {
  if (object && typeof object === "object" && (object as any).isMesh === true) {
    return object as any;
  }
  return undefined;
}

function materialIsVisible(material: unknown): boolean {
  if (!material) {
    // No material assigned still renders with a default material.
    return true;
  }
  const visible = (material as any).visible;
  const opacity = (material as any).opacity;
  return visible !== false && (typeof opacity === "number" ? opacity : 1) > 0.03;
}

export function harthmereNpcVisibleGeometryStatsForScene(
  scene: TraversableObject3DLike | undefined | null
): HarthmereNpcVisibleGeometryStats {
  let visibleMeshes = 0;
  let renderableVertices = 0;
  if (!scene || typeof scene.traverse !== "function") {
    return { visibleMeshes, renderableVertices };
  }
  scene.traverse((object) => {
    const mesh = asMeshLike(object);
    if (!mesh || mesh.visible === false) {
      return;
    }
    const position = mesh.geometry?.getAttribute?.("position");
    const count = position?.count ?? 0;
    if (!count) {
      return;
    }
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    if (!materials.some((material) => materialIsVisible(material))) {
      return;
    }
    visibleMeshes += 1;
    renderableVertices += count;
  });
  return { visibleMeshes, renderableVertices };
}

export function harthmereNpcSceneNeedsVisibleFallback(
  scene: TraversableObject3DLike | undefined | null,
  minRenderableVertices: number = HARTHMERE_NPC_MIN_RENDERABLE_VERTICES
): boolean {
  const stats = harthmereNpcVisibleGeometryStatsForScene(scene);
  return stats.visibleMeshes === 0 || stats.renderableVertices < minRenderableVertices;
}
