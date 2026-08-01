import { makeThreeSmaaPass } from "@/client/game/renderers/passes/three_pass";
import { SharedWebGLRenderTarget } from "@/client/game/renderers/three_ext/shared_webgl_render_target";
import { makeColorMapArray } from "@/client/game/util/textures";
import { makeBasicMaterial } from "@/gen/client/game/shaders/basic";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

type SmokeResult = {
  revision: string;
  webglVersion: string;
  drawCalls: number;
  programs: number;
  mrtTextures: string[];
  parsedGltfNode: string;
  clonedSkeletonBones: string[];
  smaaSize: [number, number];
  sharedTargetSize: [number, number];
  arrayTextureFormat: string | null;
  glError: number;
};

const root = document.querySelector<HTMLElement>("#smoke-root");
if (!root) {
  throw new Error("Missing #smoke-root");
}
const smokeRoot = root;

function publish(status: "running" | "pass" | "fail", details: unknown) {
  smokeRoot.dataset.status = status;
  smokeRoot.textContent = `${status.toUpperCase()}\n${JSON.stringify(
    details,
    null,
    2
  )}`;
}

async function run(): Promise<SmokeResult> {
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
  renderer.setPixelRatio(1);
  renderer.setSize(320, 180, false);
  renderer.debug.checkShaderErrors = true;
  document.querySelector("#canvas-host")?.append(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(60, 320 / 180, 0.1, 100);
  camera.position.set(0, 0, 3);

  const visibleScene = new THREE.Scene();
  visibleScene.background = new THREE.Color(0x111827);
  visibleScene.add(
    new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshNormalMaterial()
    )
  );
  renderer.setRenderTarget(null);
  renderer.render(visibleScene, camera);

  const baseScene = new THREE.Scene();
  // Compile the actual generated base-pass wrapper. A hand-written GLSL3
  // material missed the r185 failure where Three prepended RawShaderMaterial
  // defines before the embedded shader's own #version directive.
  const baseMaterial = makeBasicMaterial({
    baseColor: [0.2, 0.7, 1.0],
    light: [0.4, 0.8, 0.2],
    spatialLighting: [0.8, 0],
  });
  baseScene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), baseMaterial));

  const depthTexture = new THREE.DepthTexture(320, 180);
  depthTexture.format = THREE.DepthFormat;
  depthTexture.type = THREE.UnsignedIntType;
  const baseTarget = new THREE.WebGLRenderTarget(320, 180, {
    count: 3,
    depthTexture,
  });
  const [color, normal, baseDepth] = baseTarget.textures;
  color.name = "Color";
  normal.name = "Normal";
  baseDepth.name = "BaseDepth";
  for (const texture of baseTarget.textures) {
    texture.type = THREE.HalfFloatType;
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
  }
  baseDepth.format = THREE.RedFormat;
  renderer.setRenderTarget(baseTarget);
  renderer.render(baseScene, camera);

  const sharedTexture = new THREE.Texture();
  const sharedTarget = new SharedWebGLRenderTarget(16, 8, sharedTexture);
  sharedTarget.setSize(64, 32);

  const arrayTexture = makeColorMapArray(
    new Uint8Array([10, 20, 30, 255]),
    1,
    1,
    1,
    4
  );

  const smaa = makeThreeSmaaPass();
  smaa.threePass.setSize(320, 180);
  const readTarget = new THREE.WebGLRenderTarget(320, 180);
  const writeTarget = new THREE.WebGLRenderTarget(320, 180);
  renderer.setRenderTarget(readTarget);
  renderer.setClearColor(0x203040, 1);
  renderer.clear(true, true, true);
  await new Promise((resolve) => setTimeout(resolve, 100));
  smaa.threePass.render(renderer, writeTarget, readTarget, 1 / 60, false);

  const gltf = await new GLTFLoader().parseAsync(
    JSON.stringify({
      asset: { version: "2.0" },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ name: "ThreeUpgradeRuntimeRoot" }],
    }),
    "/"
  );

  const skeletonRoot = new THREE.Group();
  const rootBone = new THREE.Bone();
  rootBone.name = "RuntimeRootBone";
  const childBone = new THREE.Bone();
  childBone.name = "RuntimeChildBone";
  rootBone.add(childBone);
  const skinnedMesh = new THREE.SkinnedMesh(
    new THREE.BufferGeometry(),
    new THREE.MeshBasicMaterial()
  );
  skinnedMesh.add(rootBone);
  skinnedMesh.bind(new THREE.Skeleton([rootBone, childBone]));
  skeletonRoot.add(skinnedMesh);
  const clonedSkeletonRoot = cloneSkeleton(skeletonRoot);
  const clonedSkinnedMesh = clonedSkeletonRoot.children[0] as THREE.SkinnedMesh;

  renderer.setRenderTarget(null);
  renderer.render(visibleScene, camera);
  const gl = renderer.getContext();
  const runtimeSmaa = smaa.threePass as unknown as {
    _edgesRT: THREE.WebGLRenderTarget;
  };
  const result: SmokeResult = {
    revision: THREE.REVISION,
    webglVersion: gl.getParameter(gl.VERSION),
    drawCalls: renderer.info.render.calls,
    programs: renderer.info.programs?.length ?? 0,
    mrtTextures: baseTarget.textures.map((texture) => texture.name),
    parsedGltfNode: gltf.scene.children[0]?.name ?? "",
    clonedSkeletonBones: clonedSkinnedMesh.skeleton.bones.map((bone) => bone.name),
    smaaSize: [runtimeSmaa._edgesRT.width, runtimeSmaa._edgesRT.height],
    sharedTargetSize: [sharedTarget.width, sharedTarget.height],
    arrayTextureFormat: arrayTexture.internalFormat,
    glError: gl.getError(),
  };

  if (result.revision !== "185") {
    throw new Error(`Expected Three.js revision 185, got ${result.revision}`);
  }
  if (result.mrtTextures.join(",") !== "Color,Normal,BaseDepth") {
    throw new Error(`Unexpected MRT textures: ${result.mrtTextures.join(",")}`);
  }
  if (result.parsedGltfNode !== "ThreeUpgradeRuntimeRoot") {
    throw new Error("GLTFLoader did not preserve the runtime node");
  }
  if (result.clonedSkeletonBones.length !== 2) {
    throw new Error("SkeletonUtils did not clone both bones");
  }
  if (result.smaaSize[0] !== 320 || result.smaaSize[1] !== 180) {
    throw new Error(`SMAA target size mismatch: ${result.smaaSize.join("x")}`);
  }
  if (result.sharedTargetSize[0] !== 64 || result.sharedTargetSize[1] !== 32) {
    throw new Error(
      `Shared render target size mismatch: ${result.sharedTargetSize.join("x")}`
    );
  }
  if (result.arrayTextureFormat !== "SRGB8_ALPHA8") {
    throw new Error(`Unexpected array texture format: ${result.arrayTextureFormat}`);
  }
  if (result.drawCalls < 1 || result.programs < 1 || result.glError !== gl.NO_ERROR) {
    throw new Error(
      `WebGL render failed: calls=${result.drawCalls} programs=${result.programs} glError=${result.glError}`
    );
  }

  baseTarget.dispose();
  sharedTarget.dispose();
  arrayTexture.dispose();
  smaa.threePass.dispose();
  readTarget.dispose();
  writeTarget.dispose();
  baseMaterial.dispose();
  return result;
}

publish("running", { revision: THREE.REVISION });
void run().then(
  (result) => publish("pass", result),
  (error) => publish("fail", { message: String(error), stack: error?.stack })
);
