import { BasePassMaterial } from "@/client/game/renderers/base_pass_material";
import { PunchthroughMaterial } from "@/client/game/renderers/punchthrough_material";
import {
  addToScenes,
  combineScenes,
  createNewScene,
  createNewScenes,
  sceneForMaterial,
  scenesForObject,
} from "@/client/game/renderers/scenes";
import { log } from "@/shared/logging";
import assert from "assert";
import * as THREE from "three";

const VERTEX_SHADER = `
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;
  void main() {
    gl_FragColor = vec4(1.0);
  }
`;

function baseMaterial(uniforms: Record<string, THREE.IUniform> = {}) {
  return new BasePassMaterial({
    uniforms,
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
  });
}

function punchthroughMaterial() {
  return new PunchthroughMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
  });
}

describe("Three.js scene routing contract", () => {
  it("routes engine material families to their required render passes", () => {
    assert.equal(sceneForMaterial(baseMaterial()), "base");
    assert.equal(sceneForMaterial(punchthroughMaterial()), "punchthrough");
    assert.equal(
      sceneForMaterial(new THREE.MeshBasicMaterial({ transparent: true })),
      "translucent"
    );
    assert.equal(sceneForMaterial(new THREE.MeshBasicMaterial()), "three");

    const water = new THREE.MeshBasicMaterial() as THREE.MeshBasicMaterial & {
      sceneType: string;
    };
    water.sceneType = "water";
    assert.equal(sceneForMaterial(water), "water");
  });

  it("recognizes every material in a multi-material mesh", () => {
    const allBase = new THREE.Mesh(new THREE.BufferGeometry(), [
      baseMaterial(),
      baseMaterial(),
    ]);
    assert.deepEqual([...scenesForObject(allBase)], ["base"]);

    const mixed = new THREE.Mesh(new THREE.BufferGeometry(), [
      baseMaterial(),
      new THREE.MeshBasicMaterial(),
    ]);
    assert.deepEqual([...scenesForObject(mixed)].sort(), ["base", "three"]);
  });

  it("keeps ordinary mixed roots in the stock Three.js pass", () => {
    const root = new THREE.Group();
    root.name = "mixed-stock-root";
    root.add(
      new THREE.Mesh(new THREE.BufferGeometry(), baseMaterial()),
      new THREE.Mesh(
        new THREE.BufferGeometry(),
        new THREE.MeshBasicMaterial()
      )
    );

    const scenes = createNewScenes();
    const originalError = log.error;
    (log as typeof log & { error: (...args: unknown[]) => void }).error =
      () => {};
    try {
      addToScenes(scenes, root);
    } finally {
      (log as typeof log & { error: typeof originalError }).error =
        originalError;
    }

    assert.ok(scenes.three.children.includes(root));
    assert.equal(scenes.base.children.length, 0);
  });

  it("retains the emergency base-pass fallback for marked player roots", () => {
    const root = new THREE.Group();
    root.name = "mixed-player-root";
    root.userData.harthmerePlayerAvatarBasePassMaterialsVersion =
      "harthmere-player-avatar-base-pass-materials";
    root.add(
      new THREE.Mesh(new THREE.BufferGeometry(), baseMaterial()),
      new THREE.Mesh(
        new THREE.BufferGeometry(),
        new THREE.MeshBasicMaterial()
      )
    );

    const scenes = createNewScenes();
    const originalError = log.error;
    (log as typeof log & { error: (...args: unknown[]) => void }).error =
      () => {};
    try {
      addToScenes(scenes, root);
    } finally {
      (log as typeof log & { error: typeof originalError }).error =
        originalError;
    }

    assert.ok(scenes.base.children.includes(root));
    assert.equal(scenes.three.children.length, 0);
  });

  it("collects raw-shader dependency uniforms during scene insertion", () => {
    const material = baseMaterial({
      time: { value: 0 },
      fogStart: { value: 0 },
      cameraFar: { value: 0 },
      ignoredUniform: { value: 0 },
    });
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    const scenes = createNewScenes();

    addToScenes(scenes, mesh);

    assert.ok(scenes.base.materialDependencies.get("time")?.has(material));
    assert.ok(
      scenes.base.materialDependencies.get("fogStart")?.has(material)
    );
    assert.ok(
      scenes.base.materialDependencies.get("cameraFar")?.has(material)
    );
    assert.equal(
      scenes.base.materialDependencies.has("ignoredUniform" as never),
      false
    );
  });

  it("combines scene children and dependency sets without losing identity", () => {
    const first = createNewScene();
    const second = createNewScene();
    const firstMaterial = baseMaterial({ time: { value: 0 } });
    const secondMaterial = baseMaterial({ time: { value: 1 } });
    addToScenes(
      { ...createNewScenes(), base: first },
      new THREE.Mesh(new THREE.BufferGeometry(), firstMaterial)
    );
    addToScenes(
      { ...createNewScenes(), base: second },
      new THREE.Mesh(new THREE.BufferGeometry(), secondMaterial)
    );

    const combined = combineScenes(first, second);

    assert.deepEqual(combined.children, [first, second]);
    assert.ok(combined.materialDependencies.get("time")?.has(firstMaterial));
    assert.ok(combined.materialDependencies.get("time")?.has(secondMaterial));
  });
});
