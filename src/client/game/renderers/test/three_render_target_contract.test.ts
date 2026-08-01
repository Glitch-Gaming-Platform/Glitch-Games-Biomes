import { SceneBasePass } from "@/client/game/renderers/passes/scene_base_pass";
import { createNewScene } from "@/client/game/renderers/scenes";
import { DepthPeeledMesh } from "@/client/game/renderers/three_ext/depth_peeled_mesh";
import { SharedWebGLRenderTarget } from "@/client/game/renderers/three_ext/shared_webgl_render_target";
import { makeBasicMaterial } from "@/gen/client/game/shaders/basic";
import { BasicShaders } from "@/gen/client/game/shaders/basic_shaders";
import { makeSkyColorTransmittanceMaterial } from "@/gen/client/game/shaders/postprocessing/sky_color_transmittance";
import { SkyColorTransmittanceShaders } from "@/gen/client/game/shaders/postprocessing/sky_color_transmittance_shaders";
import { makeWaterMaterial } from "@/gen/client/game/shaders/water";
import { WaterShaders } from "@/gen/client/game/shaders/water_shaders";
import assert from "assert";
import * as THREE from "three";

const VERTEX_SHADER = `
  precision highp float;
  attribute vec3 position;
  void main() {
    gl_Position = vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;
  void main() {
    gl_FragColor = vec4(1.0);
  }
`;

describe("Three.js render-target contract", () => {
  it("lets Three emit GLSL3 before generated RawShaderMaterial prefixes", () => {
    const cases = [
      {
        name: "base pass",
        material: makeBasicMaterial({}),
        shaders: BasicShaders,
      },
      {
        name: "water pass",
        material: makeWaterMaterial({}),
        shaders: WaterShaders,
      },
      {
        name: "postprocessing pass",
        material: makeSkyColorTransmittanceMaterial({}),
        shaders: SkyColorTransmittanceShaders,
      },
    ];

    for (const { name, material, shaders } of cases) {
      assert.equal(material.glslVersion, THREE.GLSL3, name);
      assert.doesNotMatch(shaders.vertexShader, /^\s*#version\s/m, name);
      assert.doesNotMatch(shaders.fragmentShader, /^\s*#version\s/m, name);
      material.dispose();
    }
  });

  it("creates the base pass MRT with color, normal, base-depth, and depth outputs", () => {
    const depthTexture = new THREE.DepthTexture(1, 1);
    const selectedTargets: Array<THREE.WebGLRenderTarget | null> = [];
    const renderer = {
      getPixelRatio: () => 2,
      getSize: (target: THREE.Vector2) => target.set(320, 180),
      setRenderTarget: (target: THREE.WebGLRenderTarget | null) =>
        selectedTargets.push(target),
    };
    const pass = new SceneBasePass(
      { getCamera: () => new THREE.PerspectiveCamera() },
      "base",
      [createNewScene()]
    );
    pass.composer = {
      renderer,
      getSharedBuffer: (name: string) =>
        name === "depth" ? depthTexture : undefined,
    } as any;

    pass.generateBuffers(false);

    const target = pass.multiTarget!;
    assert.ok(target instanceof THREE.WebGLRenderTarget);
    assert.equal(target.width, 640);
    assert.equal(target.height, 360);
    assert.equal(target.depthTexture, depthTexture);
    assert.equal(target.textures.length, 3);
    assert.deepEqual(
      target.textures.map((texture) => texture.name),
      ["Color", "Normal", "BaseDepth"]
    );
    assert.deepEqual(
      target.textures.map((texture) => texture.type),
      [THREE.HalfFloatType, THREE.HalfFloatType, THREE.HalfFloatType]
    );
    assert.deepEqual(
      target.textures.map((texture) => texture.minFilter),
      [THREE.NearestFilter, THREE.NearestFilter, THREE.NearestFilter]
    );
    assert.equal(target.textures[2].format, THREE.RedFormat);
    assert.equal(pass.outputs.get("color"), target.textures[0]);
    assert.equal(pass.outputs.get("depth"), depthTexture);
    assert.equal(pass.outputs.get("normal"), target.textures[1]);
    assert.equal(pass.outputs.get("baseDepth"), target.textures[2]);

    assert.equal(pass.applyRenderTarget(false), true);
    assert.equal(selectedTargets.at(-1), pass.multiTarget);
    assert.equal(pass.applyRenderTarget(true), true);
    assert.equal(selectedTargets.at(-1), null);

    pass.destroyBuffers();
    assert.equal(pass.multiTarget, undefined);
  });

  it("preserves an externally shared color texture across target resizing", () => {
    const sharedTexture = new THREE.Texture();
    const target = new SharedWebGLRenderTarget(16, 8, sharedTexture);

    assert.equal(target.texture, sharedTexture);
    target.setSize(32, 24);
    assert.equal(target.texture, sharedTexture);
    assert.equal(target.width, 32);
    assert.equal(target.height, 24);
    assert.deepEqual(target.viewport.toArray(), [0, 0, 32, 24]);
    assert.deepEqual(target.scissor.toArray(), [0, 0, 32, 24]);
  });

  it("copies shared render-target state without cloning the color texture", () => {
    const sourceDepth = new THREE.DepthTexture(64, 32);
    const source = new THREE.WebGLRenderTarget(64, 32, {
      depthTexture: sourceDepth,
    });
    source.samples = 4;
    const target = new SharedWebGLRenderTarget(
      1,
      1,
      new THREE.Texture()
    );

    target.copy(source);

    assert.equal(target.width, 64);
    assert.equal(target.height, 32);
    assert.equal(target.texture, source.texture);
    assert.notEqual(target.depthTexture, sourceDepth);
    assert.equal(target.samples, 4);
  });

  it("keeps depth-peeled geometry, uniforms, and culling behavior aligned", () => {
    const geometry = new THREE.BufferGeometry();
    const material = new THREE.RawShaderMaterial({
      uniforms: { time: { value: 1 } },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      side: THREE.DoubleSide,
    });
    const peeled = new DepthPeeledMesh(geometry, material);

    assert.equal(peeled.geometry, geometry);
    assert.equal(peeled.depthMesh.geometry, geometry);
    assert.equal(peeled.depthMaterial.uniforms, material.uniforms);
    assert.equal(peeled.depthMaterial.side, THREE.DoubleSide);
    assert.equal(peeled.frustumCulled, false);
    assert.equal(peeled.depthMesh.frustumCulled, false);

    material.uniforms = { time: { value: 2 } };
    peeled.updateDepthMaterial();
    assert.equal(peeled.depthMaterial.uniforms, material.uniforms);
  });
});
