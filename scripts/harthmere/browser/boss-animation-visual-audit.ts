import { AnimationSystem } from "@/client/game/util/animation_system";
import { harthmereBossAttacksForLabel } from "@/shared/harthmere/boss_attack_catalog";
import { HARTHMERE_BOSS_VISUAL_ASSETS } from "@/shared/harthmere/boss_visual_assets";
import type { HarthmereBossAreaAttackShape } from "@/shared/harthmere/boss_attack_shape_visuals";
import { getHarthmereBossAttackShapeVisual } from "@/shared/harthmere/boss_attack_shape_visuals";
import {
  getHarthmereProjectileVisual,
  type HarthmereProjectileVisualDefinition,
} from "@/shared/harthmere/projectile_visual_manifest";
import { HarthmereProjectileVisualRuntime } from "@/client/game/renderers/local_dev/harthmere_projectiles";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

declare global {
  interface Window {
    __harthmereBossAnimationVisualAudit?: {
      ready: boolean;
      bossId: string;
      bossName: string;
      states: Array<{
        name: string;
        clipName: string;
        trackCount: number;
        motionScore: number;
        phaseA: number;
        phaseB: number;
        graphicAssetUrl?: string;
        graphicTrackCount: number;
        graphicVisibilityScore: number;
        productionRuntimeVisibilityScore: number;
        productionRuntimeLoadedRealAsset: boolean;
      }>;
      failures: string[];
    };
  }
}

const TILE_WIDTH = 520;
const TILE_HEIGHT = 390;
const SAMPLE_PHASES = [0.08, 0.28, 0.52, 0.76, 0.92] as const;
const MINIMUM_VISUAL_MOTION_SCORE = 0.00025;
const MINIMUM_GRAPHIC_VISIBILITY_SCORE = 0.00012;
const MINIMUM_PRODUCTION_RUNTIME_VISIBILITY_SCORE = 0.00008;

const params = new URLSearchParams(window.location.search);
const requestedBoss = params.get("boss") ?? HARTHMERE_BOSS_VISUAL_ASSETS[0].id;
const requestedState = params.get("state");
const boss =
  HARTHMERE_BOSS_VISUAL_ASSETS.find(
    (candidate) =>
      candidate.id === requestedBoss || candidate.displayName === requestedBoss
  ) ?? HARTHMERE_BOSS_VISUAL_ASSETS[0];
const attacks = harthmereBossAttacksForLabel(boss.displayName) ?? [];

document.title = `${boss.displayName} animation visual audit`;
document.body.innerHTML = `
  <main>
    <header>
      <div>
        <p class="eyebrow">Native ECS / Anima boss animation audit</p>
        <h1>${boss.displayName}</h1>
        <p>${boss.id} · ${boss.worldSize.join(" × ")} metres · walk plus ${
  attacks.length
} attacks</p>
      </div>
      <div id="status" class="status">Loading GLB…</div>
    </header>
    <section id="grid" class="grid" aria-label="Animation comparison frames"></section>
  </main>
`;

const style = document.createElement("style");
style.textContent = `
  :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #091017; color: #eef7f2; }
  main { width: 1160px; margin: 0 auto; padding: 28px 32px 48px; }
  header { display: flex; align-items: end; justify-content: space-between; gap: 24px; padding: 18px 22px; margin-bottom: 20px; border: 1px solid #31464a; border-radius: 16px; background: linear-gradient(135deg, #14252a, #111922); }
  h1 { margin: 2px 0 4px; font: 700 32px/1.1 Georgia, serif; color: #fff7d0; }
  p { margin: 4px 0; color: #acc7c4; }
  .eyebrow { color: #8dd6bd; text-transform: uppercase; letter-spacing: .13em; font-size: 11px; font-weight: 800; }
  .status { min-width: 180px; padding: 10px 14px; border-radius: 999px; background: #203239; color: #f5d989; text-align: center; font-weight: 800; }
  .status.pass { background: #173c2e; color: #9af0bb; }
  .status.fail { background: #4b2227; color: #ffb7b7; }
  .grid { display: grid; gap: 18px; }
  article { padding: 16px; border: 1px solid #2d4147; border-radius: 16px; background: #101a22; box-shadow: 0 10px 30px #0007; }
  article.fail { border-color: #b84d55; }
  .state-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 10px; }
  h2 { margin: 0; font-size: 19px; color: #f7edbd; }
  .metadata { color: #8fb4b1; font-size: 12px; }
  .score { font-weight: 800; color: #9be7bd; }
  article.fail .score { color: #ff9f9f; }
  .frames { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  figure { position: relative; margin: 0; overflow: hidden; border-radius: 12px; border: 1px solid #26373d; background: #071014; }
  canvas { display: block; width: 100%; height: auto; }
  figcaption { position: absolute; left: 10px; top: 9px; padding: 5px 8px; border-radius: 7px; background: #071014d9; color: #dfeeed; font-size: 11px; font-weight: 800; }
  .visual-label { position: absolute; right: 10px; bottom: 10px; max-width: 230px; padding: 5px 8px; border-radius: 7px; background: #071014e8; color: #b8d7d3; font-size: 10px; text-align: right; }
`;
document.head.append(style);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: false,
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(1);
renderer.setSize(TILE_WIDTH, TILE_HEIGHT, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.domElement.style.position = "fixed";
renderer.domElement.style.left = "-10000px";
document.body.append(renderer.domElement);

const loader = new GLTFLoader();

function framingForBox(box: THREE.Box3) {
  return {
    size: box.getSize(new THREE.Vector3()),
    center: box.getCenter(new THREE.Vector3()),
    groundY: box.min.y,
  };
}

function makeScene(
  model: THREE.Object3D,
  framing: ReturnType<typeof framingForBox>
) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101c29);
  scene.fog = new THREE.Fog(0x101c29, 45, 110);
  scene.add(new THREE.HemisphereLight(0xbfe8ff, 0x172114, 2.3));
  const key = new THREE.DirectionalLight(0xfff0ce, 4.2);
  key.position.set(8, 14, 10);
  key.castShadow = true;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x75b7ff, 2.4);
  rim.position.set(-10, 8, -8);
  scene.add(rim);

  const { size, center, groundY } = framing;
  model.position.x -= center.x;
  model.position.y -= groundY;
  model.position.z -= center.z;
  model.rotation.y = Math.PI * 0.12;
  scene.add(model);

  const span = Math.max(size.x, size.y, size.z, 1);
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(span * 0.9, 48),
    new THREE.MeshStandardMaterial({ color: 0x192722, roughness: 0.95 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.025;
  ground.receiveShadow = true;
  scene.add(ground);
  const grid = new THREE.GridHelper(span * 1.7, 18, 0x52706b, 0x243b3a);
  grid.position.y = 0.005;
  scene.add(grid);

  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  const camera = new THREE.PerspectiveCamera(
    35,
    TILE_WIDTH / TILE_HEIGHT,
    0.05,
    500
  );
  const distance =
    (span / (2 * Math.tan(THREE.MathUtils.degToRad(17.5)))) * 1.32;
  camera.position.set(distance * 0.46, size.y * 0.58, distance);
  camera.lookAt(0, Math.max(0.5, size.y * 0.46), 0);
  return { scene, camera };
}

function pixelDifference(a: ImageData, b: ImageData) {
  let changed = 0;
  for (let index = 0; index < a.data.length; index += 4) {
    const delta =
      Math.abs(a.data[index] - b.data[index]) +
      Math.abs(a.data[index + 1] - b.data[index + 1]) +
      Math.abs(a.data[index + 2] - b.data[index + 2]);
    if (delta > 38) changed += 1;
  }
  return changed / (a.width * a.height);
}

function copyRendererFrame() {
  const canvas = document.createElement("canvas");
  canvas.width = TILE_WIDTH;
  canvas.height = TILE_HEIGHT;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(renderer.domElement, 0, 0);
  return {
    canvas,
    imageData: context.getImageData(0, 0, TILE_WIDTH, TILE_HEIGHT),
  };
}

type AttackGraphic = {
  kind: "projectile" | HarthmereBossAreaAttackShape;
  assetUrl: string;
  animationClip?: string;
  label: string;
  projectile: HarthmereProjectileVisualDefinition;
};

function cloneGraphicMaterial(
  source: THREE.Material,
  projectile: HarthmereProjectileVisualDefinition
) {
  const material = source.clone();
  const name = material.name.toLowerCase();
  const color = new THREE.Color(
    name.includes("secondary") || name.includes("accent")
      ? projectile.secondaryColor
      : projectile.primaryColor
  );
  if (
    material instanceof THREE.MeshStandardMaterial ||
    material instanceof THREE.MeshPhysicalMaterial
  ) {
    material.color.copy(color);
    material.emissive.copy(color);
    material.emissiveIntensity = 1.8;
    material.roughness = Math.min(material.roughness, 0.35);
  } else if (material instanceof THREE.MeshBasicMaterial) {
    material.color.copy(color);
  }
  material.transparent = true;
  material.opacity = Math.max(0.78, material.opacity);
  material.depthWrite = false;
  return material;
}

function placeAttackGraphic(input: {
  scene: THREE.Scene;
  gltf: Awaited<ReturnType<GLTFLoader["loadAsync"]>>;
  definition: AttackGraphic;
  framing: ReturnType<typeof framingForBox>;
  phase: number;
}) {
  const graphic = cloneSkeleton(input.gltf.scene);
  graphic.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.material = Array.isArray(child.material)
      ? child.material.map((material) =>
          cloneGraphicMaterial(material, input.definition.projectile)
        )
      : cloneGraphicMaterial(child.material, input.definition.projectile);
    child.frustumCulled = false;
    child.renderOrder = 24;
  });
  let graphicTrackCount = 0;
  const clip = input.definition.animationClip
    ? input.gltf.animations.find(
        (candidate) => candidate.name === input.definition.animationClip
      ) ?? input.gltf.animations[0]
    : input.gltf.animations[0];
  if (clip) {
    const mixer = new THREE.AnimationMixer(graphic);
    const action = mixer.clipAction(clip);
    action.play();
    mixer.setTime(clip.duration * input.phase);
    graphicTrackCount = clip.tracks.length;
  }
  graphic.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(graphic, true);
  const center = bounds.getCenter(new THREE.Vector3());
  graphic.position.sub(center);
  const graphicSize = bounds.getSize(new THREE.Vector3());
  const longest = Math.max(graphicSize.x, graphicSize.y, graphicSize.z, 0.001);
  const { size } = input.framing;
  const span = Math.max(size.x, size.y, size.z, 1);

  if (input.definition.kind === "projectile") {
    const desiredSize = THREE.MathUtils.clamp(span * 0.17, 0.8, 2.5);
    graphic.scale.setScalar(
      (desiredSize / longest) * input.definition.projectile.scale
    );
    graphic.position.add(
      new THREE.Vector3(
        THREE.MathUtils.lerp(-span * 0.42, span * 0.42, input.phase),
        Math.max(0.65, size.y * 0.46) +
          Math.sin(input.phase * Math.PI) * span * 0.08,
        span * 0.23
      )
    );
    graphic.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(1, 0.05, 0.12).normalize()
    );
    graphic.rotation.z +=
      input.phase * input.definition.projectile.spinRadiansPerSecond;
  } else if (
    input.definition.kind === "beam" ||
    input.definition.kind === "cone"
  ) {
    const desiredLength = span * 0.82;
    const radial = input.definition.kind === "beam" ? span * 0.12 : span * 0.46;
    graphic.scale.set(
      radial / Math.max(graphicSize.x, 0.001),
      radial / Math.max(graphicSize.y, 0.001),
      desiredLength / Math.max(graphicSize.z, 0.001)
    );
    graphic.position.add(
      new THREE.Vector3(
        0,
        input.definition.kind === "beam" ? size.y * 0.48 : 0.08,
        -desiredLength * 0.12
      )
    );
  } else {
    const desiredDiameter =
      input.definition.kind === "self_aoe" ? span * 1.08 : span * 0.78;
    graphic.scale.setScalar(desiredDiameter / longest);
    graphic.position.add(
      new THREE.Vector3(
        input.definition.kind === "ground_aoe" ? span * 0.22 : 0,
        0.08,
        span * 0.12
      )
    );
  }
  const light = new THREE.PointLight(
    input.definition.projectile.primaryColor,
    Math.max(2.2, input.definition.projectile.lightIntensity),
    Math.max(4, span * 1.2),
    2
  );
  light.position.copy(graphic.position);
  input.scene.add(graphic, light);
  return graphicTrackCount;
}

async function measureProductionRuntimeGraphic(definition: AttackGraphic) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101c29);
  scene.add(new THREE.HemisphereLight(0xcceaff, 0x152018, 2.4));
  const key = new THREE.DirectionalLight(0xffefd0, 3.5);
  key.position.set(6, 10, 8);
  scene.add(key);
  const root = new THREE.Group();
  scene.add(root);
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(7, 48),
    new THREE.MeshStandardMaterial({ color: 0x1b2925, roughness: 0.95 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const grid = new THREE.GridHelper(13, 20, 0x52706b, 0x243b3a);
  grid.position.y = 0.01;
  scene.add(grid);
  const camera = new THREE.PerspectiveCamera(
    38,
    TILE_WIDTH / TILE_HEIGHT,
    0.05,
    100
  );
  camera.position.set(8, 7, 11);
  camera.lookAt(0, 1.2, 0);
  renderer.render(scene, camera);
  const baseline = copyRendererFrame().imageData;

  const runtime = new HarthmereProjectileVisualRuntime(root, new GLTFLoader());
  const spawned = runtime.spawn({
    projectileId: definition.projectile.id,
    origin: new THREE.Vector3(-3.5, 1.5, -2.5),
    target: new THREE.Vector3(3.5, 1.2, 2.5),
    originGround: new THREE.Vector3(-1, 0.04, -1),
    targetGround: new THREE.Vector3(1.5, 0.04, 1),
    result: "hit",
    finalDamage: 50,
    attackShape: definition.kind,
    attackDistance: 8,
    hitRadius: 3.2,
    coneAngleDeg: 72,
    windupSecs: 1.2,
  });
  if (!spawned) {
    return { visibilityScore: 0, loadedRealAsset: false };
  }

  const deadline = Date.now() + 2500;
  let loadedRealAsset = false;
  do {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve())
    );
    loadedRealAsset = true;
    root.traverse((child) => {
      if (child.name.includes("-loading-")) loadedRealAsset = false;
    });
  } while (!loadedRealAsset && Date.now() < deadline);
  for (let index = 0; index < 12; index += 1) runtime.update(0.05);
  renderer.render(scene, camera);
  const rendered = copyRendererFrame().imageData;
  return {
    visibilityScore: pixelDifference(baseline, rendered),
    loadedRealAsset,
  };
}

async function renderState(input: {
  name: string;
  clipName: string;
  graphic?: AttackGraphic;
  isWalk: boolean;
  gltf: Awaited<ReturnType<GLTFLoader["loadAsync"]>>;
}) {
  const graphicGltf = input.graphic
    ? await loader.loadAsync(input.graphic.assetUrl)
    : undefined;
  const productionRuntime = input.graphic
    ? await measureProductionRuntimeGraphic(input.graphic)
    : { visibilityScore: 0, loadedRealAsset: true };
  const poses: Array<{
    phase: number;
    model: THREE.Object3D;
    mixer: THREE.AnimationMixer;
    action: THREE.AnimationAction;
  }> = [];
  const animationBounds = new THREE.Box3();
  animationBounds.makeEmpty();
  for (const phase of SAMPLE_PHASES) {
    const model = cloneSkeleton(input.gltf.scene);
    let mixer: THREE.AnimationMixer;
    let action: THREE.AnimationAction | undefined;
    if (input.isWalk) {
      const system = new AnimationSystem(
        {
          idle: { fileAnimationName: "Idle" },
          walk: { fileAnimationName: input.clipName },
        },
        { all: { re: /.*/ } }
      );
      const state = system.newState(model, input.gltf.animations);
      mixer = state.mixer;
      action = state.actions.all.walk;
    } else {
      mixer = new THREE.AnimationMixer(model);
      const clip = input.gltf.animations.find(
        (candidate) => candidate.name === input.clipName
      );
      action = clip ? mixer.clipAction(clip) : undefined;
    }
    if (!action) {
      throw new Error(`${input.name} is missing clip ${input.clipName}`);
    }
    action.enabled = true;
    action.setEffectiveWeight(1);
    action.play();
    mixer.setTime(action.getClip().duration * phase);
    model.updateMatrixWorld(true);
    animationBounds.union(new THREE.Box3().setFromObject(model, true));
    poses.push({ phase, model, mixer, action });
  }
  const framing = framingForBox(animationBounds);
  const samples: Array<{
    phase: number;
    canvas: HTMLCanvasElement;
    imageData: ImageData;
    bodyImageData: ImageData;
    trackCount: number;
    graphicTrackCount: number;
    graphicVisibilityScore: number;
  }> = [];
  for (const { phase, model, mixer, action } of poses) {
    const { scene, camera } = makeScene(model, framing);
    renderer.render(scene, camera);
    const bodyFrame = copyRendererFrame();
    const graphicTrackCount =
      input.graphic && graphicGltf
        ? placeAttackGraphic({
            scene,
            gltf: graphicGltf,
            definition: input.graphic,
            framing,
            phase,
          })
        : 0;
    renderer.render(scene, camera);
    const frame = copyRendererFrame();
    samples.push({
      phase,
      ...frame,
      bodyImageData: bodyFrame.imageData,
      trackCount: action.getClip().tracks.length,
      graphicTrackCount,
      graphicVisibilityScore: input.graphic
        ? pixelDifference(bodyFrame.imageData, frame.imageData)
        : 0,
    });
    mixer.stopAllAction();
    mixer.uncacheRoot(model);
  }

  let bestA = samples[0];
  let bestB = samples[1];
  let motionScore = 0;
  for (let left = 0; left < samples.length; left += 1) {
    for (let right = left + 1; right < samples.length; right += 1) {
      const score = pixelDifference(
        samples[left].bodyImageData,
        samples[right].bodyImageData
      );
      if (score > motionScore) {
        motionScore = score;
        bestA = samples[left];
        bestB = samples[right];
      }
    }
  }

  const article = document.createElement("article");
  const graphicVisibilityScore = Math.max(
    ...samples.map((sample) => sample.graphicVisibilityScore)
  );
  const graphicTrackCount = Math.max(
    ...samples.map((sample) => sample.graphicTrackCount)
  );
  const passes =
    motionScore >= MINIMUM_VISUAL_MOTION_SCORE &&
    (!input.graphic ||
      (graphicVisibilityScore >= MINIMUM_GRAPHIC_VISIBILITY_SCORE &&
        productionRuntime.loadedRealAsset &&
        productionRuntime.visibilityScore >=
          MINIMUM_PRODUCTION_RUNTIME_VISIBILITY_SCORE));
  if (!passes) article.className = "fail";
  article.innerHTML = `
    <div class="state-head">
      <div>
        <h2>${input.name}</h2>
        <div class="metadata">clip ${input.clipName} · ${
    bestA.trackCount
  } bound tracks${
    input.graphic
      ? ` · real ${input.graphic.kind} GLB ${(
          graphicVisibilityScore * 100
        ).toFixed(2)}% visible`
      : ""
  }${
    input.graphic
      ? ` · production renderer ${(
          productionRuntime.visibilityScore * 100
        ).toFixed(2)}% visible`
      : ""
  }</div>
      </div>
      <div class="score">visual motion ${(motionScore * 100).toFixed(2)}%</div>
    </div>
    <div class="frames"></div>
  `;
  const frames = article.querySelector(".frames")!;
  for (const frame of [bestA, bestB]) {
    const figure = document.createElement("figure");
    figure.append(frame.canvas);
    const caption = document.createElement("figcaption");
    caption.textContent = `${Math.round(frame.phase * 100)}% of clip`;
    figure.append(caption);
    if (input.graphic) {
      const label = document.createElement("span");
      label.className = "visual-label";
      label.textContent = `${input.graphic.label} · actual GLB`;
      figure.append(label);
    }
    frames.append(figure);
  }
  document.querySelector("#grid")!.append(article);
  return {
    name: input.name,
    clipName: input.clipName,
    trackCount: bestA.trackCount,
    motionScore,
    phaseA: bestA.phase,
    phaseB: bestB.phase,
    graphicAssetUrl: input.graphic?.assetUrl,
    graphicTrackCount,
    graphicVisibilityScore,
    productionRuntimeVisibilityScore: productionRuntime.visibilityScore,
    productionRuntimeLoadedRealAsset: productionRuntime.loadedRealAsset,
    passes,
  };
}

async function run() {
  const gltf = await loader.loadAsync(boss.assetUrl);
  const states = [
    {
      name: "Walk cycle",
      clipName: "Walk",
      isWalk: true,
    },
    ...attacks.map((attack) => {
      const shapeVisual = getHarthmereBossAttackShapeVisual(attack.attackShape);
      const projectileVisual = getHarthmereProjectileVisual(
        attack.projectileVisualId
      );
      if (!projectileVisual) {
        throw new Error(
          `${boss.displayName}.${attack.displayName} has no projectile graphic`
        );
      }
      return {
        name: attack.displayName,
        clipName: attack.specialAnimationClip ?? attack.animationClip,
        graphic: {
          kind: shapeVisual?.shape ?? "projectile",
          assetUrl: shapeVisual?.assetUrl ?? projectileVisual.assetUrl,
          animationClip: shapeVisual?.animationClip ?? "FlightLoop_24",
          label: `${attack.attackShape} · ${attack.damageType}`,
          projectile: projectileVisual,
        } satisfies AttackGraphic,
        isWalk: false,
      };
    }),
  ].filter(
    (state) =>
      !requestedState ||
      state.name === requestedState ||
      state.clipName === requestedState
  );
  const results = [];
  for (const state of states) {
    results.push(
      await renderState({
        ...state,
        gltf,
      })
    );
  }
  const failures = results
    .filter((result) => !result.passes)
    .map((result) => `${result.name}: no visible pose change`);
  const status = document.querySelector("#status")!;
  window.__harthmereBossAnimationVisualAudit = {
    ready: true,
    bossId: boss.id,
    bossName: boss.displayName,
    states: results.map(({ passes: _passes, ...result }) => result),
    failures,
  };
  status.textContent = failures.length
    ? `${failures.length} visual failures`
    : `${results.length}/${results.length} visibly animated`;
  status.className = `status ${failures.length ? "fail" : "pass"}`;
}

run().catch((error) => {
  const message = String((error as Error)?.stack ?? error);
  const status = document.querySelector("#status")!;
  status.textContent = "Audit failed";
  status.className = "status fail";
  document.querySelector("#grid")!.textContent = message;
  window.__harthmereBossAnimationVisualAudit = {
    ready: true,
    bossId: boss.id,
    bossName: boss.displayName,
    states: [],
    failures: [message],
  };
});
