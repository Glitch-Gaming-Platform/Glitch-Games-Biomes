/// <reference types="mocha" />

import assert from "assert";
import * as THREE from "three";
import {
  harthmereNpcSceneNeedsVisibleFallbackV1,
  harthmereNpcVisibleGeometryStatsForSceneV1,
  HARTHMERE_NPC_MIN_RENDERABLE_VERTICES_V1,
} from "../npc_visible_geometry_guard_v1";

function meshWithVertices(count: number, material?: THREE.Material): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(count * 3), 3)
  );
  return new THREE.Mesh(geometry, material ?? new THREE.MeshBasicMaterial());
}

describe("harthmere npc visible geometry guard", () => {
  it("flags an empty scene as needing a visible fallback", () => {
    const scene = new THREE.Group();
    assert.equal(harthmereNpcSceneNeedsVisibleFallbackV1(scene), true);
    const stats = harthmereNpcVisibleGeometryStatsForSceneV1(scene);
    assert.equal(stats.visibleMeshes, 0);
    assert.equal(stats.renderableVertices, 0);
  });

  it("flags a nullish scene as needing a visible fallback", () => {
    assert.equal(harthmereNpcSceneNeedsVisibleFallbackV1(undefined), true);
    assert.equal(harthmereNpcSceneNeedsVisibleFallbackV1(null), true);
  });

  it("does not require a fallback for a scene with real renderable geometry", () => {
    const scene = new THREE.Group();
    scene.add(meshWithVertices(36));
    assert.equal(harthmereNpcSceneNeedsVisibleFallbackV1(scene), false);
    const stats = harthmereNpcVisibleGeometryStatsForSceneV1(scene);
    assert.equal(stats.visibleMeshes, 1);
    assert.equal(stats.renderableVertices, 36);
  });

  it("treats a fully transparent mannequin as invisible", () => {
    const scene = new THREE.Group();
    scene.add(
      meshWithVertices(
        64,
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })
      )
    );
    assert.equal(harthmereNpcSceneNeedsVisibleFallbackV1(scene), true);
  });

  it("treats an explicitly hidden mesh as invisible", () => {
    const scene = new THREE.Group();
    const mesh = meshWithVertices(64);
    mesh.visible = false;
    scene.add(mesh);
    assert.equal(harthmereNpcSceneNeedsVisibleFallbackV1(scene), true);
  });

  it("requires a fallback when geometry is below the minimum vertex threshold", () => {
    const scene = new THREE.Group();
    scene.add(meshWithVertices(HARTHMERE_NPC_MIN_RENDERABLE_VERTICES_V1 - 1));
    assert.equal(harthmereNpcSceneNeedsVisibleFallbackV1(scene), true);
  });
});
