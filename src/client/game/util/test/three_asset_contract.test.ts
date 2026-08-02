import {
  KTX2_TRANSCODER_PATH,
  createGltfLoader,
  gltfToThree,
  parseGltf,
} from "@/client/game/util/gltf_helpers";
import {
  makeBlockBufferGeometry,
  makeGroupBufferGeometry,
} from "@/client/game/util/meshes";
import {
  makeBufferTexture,
  makeColorMap,
  makeColorMapArray,
} from "@/client/game/util/textures";
import assert from "assert";
import { readFile } from "fs/promises";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

describe("Three.js asset and geometry contract", () => {
  it("parses the minimal GLTF scene shape consumed by game resources", async () => {
    const gltf = await parseGltf(
      JSON.stringify({
        asset: { version: "2.0" },
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [{ name: "UpgradeContractRoot" }],
      })
    );

    assert.equal(gltf.scene.name, "");
    assert.equal(gltf.scene.children[0].name, "UpgradeContractRoot");
    assert.equal(gltfToThree(gltf), gltf.scene);
  });

  it("clones skinned meshes with independent bones and skeleton state", () => {
    const root = new THREE.Group();
    const bone = new THREE.Bone();
    bone.name = "RootBone";
    const childBone = new THREE.Bone();
    childBone.name = "ChildBone";
    bone.add(childBone);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([0, 0, 0], 3)
    );
    geometry.setAttribute(
      "skinIndex",
      new THREE.Uint16BufferAttribute([0, 0, 0, 0], 4)
    );
    geometry.setAttribute(
      "skinWeight",
      new THREE.Float32BufferAttribute([1, 0, 0, 0], 4)
    );
    const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial());
    mesh.name = "SkinnedBody";
    mesh.add(bone);
    mesh.bind(new THREE.Skeleton([bone, childBone]));
    root.add(mesh);

    const clonedRoot = cloneSkeleton(root);
    const clonedMesh = clonedRoot.getObjectByName(
      "SkinnedBody"
    ) as THREE.SkinnedMesh;

    assert.ok(clonedMesh instanceof THREE.SkinnedMesh);
    assert.notEqual(clonedMesh, mesh);
    assert.notEqual(clonedMesh.skeleton, mesh.skeleton);
    assert.notEqual(clonedMesh.skeleton.bones[0], mesh.skeleton.bones[0]);
    assert.deepEqual(
      clonedMesh.skeleton.bones.map((entry) => entry.name),
      ["RootBone", "ChildBone"]
    );
  });

  it("loads and clones the Indisworm creature and poison projectile on r185", async function () {
    this.timeout(20_000);
    const creatureSource = await readFile(
      "src/galois/data/npcs/indisworm.gltf",
      "utf8"
    );
    const projectileBuffer = await readFile(
      "public/assets/harthmere/glb/projectiles/indisworm_poison_spit.glb"
    );
    const originalProgressEvent = globalThis.ProgressEvent;
    class TestProgressEvent extends Event {
      readonly lengthComputable: boolean;
      readonly loaded: number;
      readonly total: number;

      constructor(type: string, init: ProgressEventInit = {}) {
        super(type);
        this.lengthComputable = init.lengthComputable ?? false;
        this.loaded = init.loaded ?? 0;
        this.total = init.total ?? 0;
      }
    }
    if (!originalProgressEvent) {
      globalThis.ProgressEvent =
        TestProgressEvent as unknown as typeof ProgressEvent;
    }
    let creature: Awaited<ReturnType<typeof parseGltf>>;
    let projectile: Awaited<ReturnType<typeof parseGltf>>;
    try {
      creature = await parseGltf(creatureSource);
      projectile = await parseGltf(
        projectileBuffer.buffer.slice(
          projectileBuffer.byteOffset,
          projectileBuffer.byteOffset + projectileBuffer.byteLength
        ) as ArrayBuffer
      );
    } finally {
      if (originalProgressEvent) {
        globalThis.ProgressEvent = originalProgressEvent;
      } else {
        delete (globalThis as { ProgressEvent?: typeof ProgressEvent })
          .ProgressEvent;
      }
    }
    assert.deepEqual(creature.animations.map(({ name }) => name).sort(), [
      "Attack",
      "Death",
      "HitReact",
      "Idle",
      "RangedAttack",
      "Run",
      "Walk",
    ]);

    const socket = creature.scene.getObjectByName("Socket_Mouth");
    assert.ok((socket as THREE.Bone | undefined)?.isBone);

    const creatureMeshes: THREE.SkinnedMesh[] = [];
    creature.scene.traverse((object) => {
      const mesh = object as THREE.SkinnedMesh;
      if (mesh.isSkinnedMesh) creatureMeshes.push(mesh);
    });
    assert.ok(creatureMeshes.length > 0);
    for (const mesh of creatureMeshes) {
      const positions = mesh.geometry.getAttribute("position");
      const skinIndices = mesh.geometry.getAttribute("skinIndex");
      const skinWeights = mesh.geometry.getAttribute("skinWeight");
      assert.ok(positions);
      assert.equal(skinIndices?.count, positions.count);
      assert.equal(skinWeights?.count, positions.count);
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const material of materials) {
        const standardMaterial = material as THREE.MeshStandardMaterial;
        assert.ok(standardMaterial.isMeshStandardMaterial);
        if (standardMaterial.map) {
          assert.equal(standardMaterial.map.colorSpace, THREE.SRGBColorSpace);
        }
        if (standardMaterial.emissiveMap) {
          assert.equal(
            standardMaterial.emissiveMap.colorSpace,
            THREE.SRGBColorSpace
          );
        }
      }
    }

    const creatureClone = cloneSkeleton(creature.scene);
    const clonedSocket = creatureClone.getObjectByName("Socket_Mouth");
    const clonedMesh = creatureClone.getObjectByName(
      creatureMeshes[0].name
    ) as THREE.SkinnedMesh;
    assert.ok((clonedSocket as THREE.Bone | undefined)?.isBone);
    assert.notEqual(clonedSocket, socket);
    assert.ok(clonedMesh.isSkinnedMesh);
    assert.notEqual(clonedMesh.skeleton, creatureMeshes[0].skeleton);
    assert.notEqual(
      clonedMesh.skeleton.bones[0],
      creatureMeshes[0].skeleton.bones[0]
    );

    const mixer = new THREE.AnimationMixer(creature.scene);
    for (const clip of creature.animations) {
      assert.equal(mixer.clipAction(clip).getClip().name, clip.name);
    }
    mixer.stopAllAction();
    mixer.uncacheRoot(creature.scene);

    assert.deepEqual(
      projectile.animations.map(({ name }) => name),
      ["FlightLoop_24"]
    );
    assert.ok(
      projectile.scene.getObjectByName("ProjectileRoot_indisworm_poison_spit")
    );
    let projectileMeshCount = 0;
    projectile.scene.traverse((object) => {
      if (!(object as THREE.Mesh).isMesh) return;
      const mesh = object as THREE.Mesh;
      projectileMeshCount += 1;
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const material of materials) {
        const standardMaterial = material as THREE.MeshStandardMaterial;
        assert.ok(standardMaterial.isMeshStandardMaterial);
        if (standardMaterial.map) {
          assert.equal(standardMaterial.map.colorSpace, THREE.SRGBColorSpace);
        }
      }
    });
    assert.ok(projectileMeshCount > 0);
  });

  it("preserves interleaved voxel and group geometry layouts", () => {
    const block = makeBlockBufferGeometry(
      new Float32Array([0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0]),
      new Uint32Array([0, 1, 0]),
      6
    );
    const blockPosition = block.getAttribute(
      "position"
    ) as THREE.InterleavedBufferAttribute;
    assert.equal(blockPosition.itemSize, 3);
    assert.equal(blockPosition.count, 2);
    assert.equal(blockPosition.data.stride, 6);
    assert.equal(block.getAttribute("texCoord").itemSize, 2);
    assert.equal(block.getAttribute("direction").itemSize, 1);
    assert.equal(block.index?.count, 3);

    const group = makeGroupBufferGeometry(
      new Float32Array([0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0]),
      new Uint32Array([0, 1, 0]),
      8
    );
    const groupPosition = group.getAttribute(
      "position"
    ) as THREE.InterleavedBufferAttribute;
    assert.equal(groupPosition.count, 2);
    assert.equal(groupPosition.data.stride, 8);
    assert.equal(group.getAttribute("normal").itemSize, 3);
    assert.equal(group.getAttribute("uv").itemSize, 2);
  });

  it("retains integer, array, and sRGB texture formats", () => {
    const color = makeColorMap(new Uint8Array([10, 20, 30]), 1, 1, 3);
    assert.ok(color.image.data);
    assert.deepEqual(Array.from(color.image.data!), [10, 20, 30, 255]);
    assert.equal(color.format, THREE.RGBAFormat);
    assert.equal(color.internalFormat, "SRGB8_ALPHA8");
    assert.equal(color.type, THREE.UnsignedByteType);

    const colorArray = makeColorMapArray(
      new Uint8Array([1, 2, 3, 4]),
      1,
      1,
      1,
      4
    );
    assert.ok(colorArray instanceof THREE.DataArrayTexture);
    assert.equal(colorArray.internalFormat, "SRGB8_ALPHA8");

    const integers = makeBufferTexture(new Uint32Array([7]), 1, 1);
    assert.equal(integers.format, THREE.RedIntegerFormat);
    assert.equal(integers.internalFormat, "R32UI");
    assert.equal(integers.type, THREE.UnsignedIntType);
  });

  it("keeps the Three.js add-on modules used by production importable", () => {
    assert.ok(new GLTFLoader() instanceof GLTFLoader);
    assert.ok(new FBXLoader() instanceof FBXLoader);
    assert.ok(new MTLLoader() instanceof MTLLoader);
    assert.ok(new OBJLoader() instanceof OBJLoader);

    const rounded = new RoundedBoxGeometry(1, 1, 1, 2, 0.1);
    assert.ok(rounded.getAttribute("position").count > 0);

    const quad = new FullScreenQuad(new THREE.MeshBasicMaterial());
    assert.ok(quad.material instanceof THREE.MeshBasicMaterial);
    quad.dispose();

    const originalImage = globalThis.Image;
    class TestImage {
      onload: (() => void) | null = null;
      #src = "";

      set src(value: string) {
        this.#src = value;
        this.onload?.();
      }

      get src() {
        return this.#src;
      }
    }
    (globalThis as typeof globalThis & { Image: typeof Image }).Image =
      TestImage as unknown as typeof Image;
    try {
      const smaa = new SMAAPass();
      smaa.setSize(16, 16);
      const runtimeSmaa = smaa as unknown as {
        _edgesRT: THREE.WebGLRenderTarget;
        _weightsRT: THREE.WebGLRenderTarget;
      };
      assert.equal(runtimeSmaa._edgesRT.width, 16);
      assert.equal(runtimeSmaa._weightsRT.height, 16);
      smaa.setSize(32, 24);
      assert.equal(runtimeSmaa._edgesRT.width, 32);
      assert.equal(runtimeSmaa._weightsRT.height, 24);
      smaa.dispose();
    } finally {
      if (originalImage) {
        (globalThis as typeof globalThis & { Image: typeof Image }).Image =
          originalImage;
      } else {
        delete (globalThis as any).Image;
      }
    }

    assert.equal(THREE.SRGBColorSpace, "srgb");
  });

  it("enables Meshopt decoding and packages the matching Basis transcoder", async () => {
    const loader = createGltfLoader();
    assert.ok(loader.meshoptDecoder);
    assert.equal(KTX2_TRANSCODER_PATH, "/three/basis/");

    const [publicJs, publicWasm, packageJs, packageWasm] = await Promise.all([
      readFile("public/three/basis/basis_transcoder.js"),
      readFile("public/three/basis/basis_transcoder.wasm"),
      readFile(
        "node_modules/three/examples/jsm/libs/basis/basis_transcoder.js"
      ),
      readFile(
        "node_modules/three/examples/jsm/libs/basis/basis_transcoder.wasm"
      ),
    ]);
    assert.ok(publicJs.byteLength > 0);
    assert.ok(publicWasm.byteLength > 0);
    assert.deepEqual(publicJs, packageJs);
    assert.deepEqual(publicWasm, packageWasm);
  });
});
