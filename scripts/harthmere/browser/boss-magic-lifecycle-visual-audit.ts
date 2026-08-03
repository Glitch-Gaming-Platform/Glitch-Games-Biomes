import { HarthmereProjectileVisualRuntime } from "@/client/game/renderers/local_dev/harthmere_projectiles";
import { harthmereBossAttacksForLabel } from "@/shared/harthmere/boss_attack_catalog";
import { harthmereBossMagicPresentation } from "@/shared/harthmere/boss_magic_presentation";
import { getHarthmereBossAttackShapeVisual } from "@/shared/harthmere/boss_attack_shape_visuals";
import { HARTHMERE_BOSS_VISUAL_ASSETS } from "@/shared/harthmere/boss_visual_assets";
import {
  harthmereMagicChargeDurationSecs,
  harthmereMagicChargePower,
  isHarthmereMagicAttack,
} from "@/shared/harthmere/magic_charge";
import { getHarthmereProjectileVisual } from "@/shared/harthmere/projectile_visual_manifest";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

type RuntimeSnapshot = {
  loadedCount?: number;
  failedIds?: string[];
  active?: Array<{
    projectileId: string;
    position: number[];
    usingFallback: boolean;
    visualScale: number;
  }>;
  activeShapes?: Array<{
    projectileId: string;
    attackShape: string;
    position: number[];
  }>;
  activeMagicCharges?: Array<{
    projectileId: string;
    position: number[];
    visualScale: number;
    modelAttached: boolean;
  }>;
  activeMagicExplosions?: Array<{
    projectileId: string;
    position: number[];
    radius: number;
  }>;
  magicExplosionCount?: number;
};

declare global {
  interface Window {
    __harthmereProjectileVisuals?: RuntimeSnapshot;
    __harthmereBossMagicLifecycleAudit?: {
      ready: boolean;
      bossId: string;
      bossName: string;
      worldSize: number[];
      magicAttackCount: number;
      results: Array<{
        abilityId: string;
        attackName: string;
        shape: string;
        projectileId: string;
        chargeTimeSecs: number;
        chargeVisualScale: number;
        projectileVisualScale: number;
        bodySurfaceDistance: number;
        chargeVisibilityScore: number;
        travelVisibilityScore: number;
        impactVisibilityScore: number;
        pathMovesTowardPlayer: boolean;
        magicExplosionCount: number;
        explosionRadius: number;
        loadedRealProjectile: boolean;
        failures: string[];
      }>;
      failures: string[];
    };
  }
}

const WIDTH = 500;
const HEIGHT = 330;
const MINIMUM_VISIBILITY_SCORE = 0.00006;
const params = new URLSearchParams(window.location.search);
const requestedBoss = params.get("boss") ?? HARTHMERE_BOSS_VISUAL_ASSETS[0].id;
const boss =
  HARTHMERE_BOSS_VISUAL_ASSETS.find(
    (candidate) =>
      candidate.id === requestedBoss || candidate.displayName === requestedBoss
  ) ?? HARTHMERE_BOSS_VISUAL_ASSETS[0];
const attacks = (harthmereBossAttacksForLabel(boss.displayName) ?? []).filter(
  isHarthmereMagicAttack
);

document.title = `${boss.displayName} magic lifecycle audit`;
document.body.innerHTML = `
  <main>
    <header>
      <div>
        <p class="eyebrow">Native ECS / Anima boss magic lifecycle audit</p>
        <h1>${boss.displayName}</h1>
        <p>${boss.worldSize.join(" × ")} metres · ${
          attacks.length
        } magic attacks · charge → travel/shape → hit explosion → low-FPS contact</p>
      </div>
      <div id="status" class="status">Loading boss and spell assets…</div>
    </header>
    <section id="grid" class="grid"></section>
  </main>
`;

const style = document.createElement("style");
style.textContent = `
  :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #071019; color: #edf8f4; }
  main { width: 100%; max-width: 1580px; margin: 0 auto; padding: 26px 28px 48px; }
  header { display: flex; align-items: end; justify-content: space-between; gap: 24px; padding: 18px 22px; margin-bottom: 18px; border: 1px solid #355059; border-radius: 16px; background: linear-gradient(135deg, #142832, #111923); }
  h1 { margin: 2px 0 5px; font: 700 31px/1.1 Georgia, serif; color: #fff1bd; }
  p { margin: 4px 0; color: #a9c9c7; }
  .eyebrow { color: #91dfc6; text-transform: uppercase; letter-spacing: .12em; font-size: 11px; font-weight: 800; }
  .status { min-width: 230px; padding: 10px 14px; border-radius: 999px; background: #243841; color: #f6d783; text-align: center; font-weight: 800; }
  .status.pass { background: #173f31; color: #99f2bc; }
  .status.fail { background: #4c2228; color: #ffb5b5; }
  .grid { display: grid; gap: 18px; }
  article { padding: 15px; border: 1px solid #30474f; border-radius: 16px; background: #101b24; box-shadow: 0 10px 30px #0007; }
  article.fail { border-color: #c2525a; }
  .attack-head { display: flex; align-items: end; justify-content: space-between; gap: 16px; margin-bottom: 10px; }
  h2 { margin: 0; color: #f8edbe; font-size: 19px; }
  .meta { margin-top: 3px; color: #8fb7b3; font-size: 12px; }
  .score { color: #9aebbb; font-weight: 800; font-size: 13px; }
  article.fail .score { color: #ff9fa7; }
  .frames { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  figure { position: relative; margin: 0; border: 1px solid #294047; border-radius: 11px; overflow: hidden; background: #081117; }
  canvas { display: block; width: 100%; height: auto; }
  figcaption { position: absolute; left: 8px; top: 8px; padding: 5px 7px; border-radius: 6px; background: #071019e6; color: #eef8f5; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; }
  .frame-score { position: absolute; right: 8px; bottom: 8px; padding: 4px 6px; border-radius: 6px; background: #071019e6; color: #a9d6d0; font-size: 10px; }
`;
document.head.append(style);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(1);
renderer.setSize(WIDTH, HEIGHT, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.domElement.style.position = "fixed";
renderer.domElement.style.left = "-10000px";
document.body.append(renderer.domElement);
const loader = new GLTFLoader();

function copyFrame() {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(renderer.domElement, 0, 0);
  return {
    canvas,
    imageData: context.getImageData(0, 0, WIDTH, HEIGHT),
  };
}

function pixelDifference(a: ImageData, b: ImageData) {
  let changed = 0;
  for (let index = 0; index < a.data.length; index += 4) {
    const delta =
      Math.abs(a.data[index] - b.data[index]) +
      Math.abs(a.data[index + 1] - b.data[index + 1]) +
      Math.abs(a.data[index + 2] - b.data[index + 2]);
    if (delta > 34) changed += 1;
  }
  return changed / (a.width * a.height);
}

function advance(runtime: HarthmereProjectileVisualRuntime, seconds: number) {
  const steps = Math.max(1, Math.ceil(seconds / 0.05));
  const dt = seconds / steps;
  for (let index = 0; index < steps; index += 1) runtime.update(dt);
}

function playerTargetForAttack(attack: (typeof attacks)[number]) {
  const useX = boss.worldSize[0] <= boss.worldSize[2];
  const halfNarrow = (useX ? boss.worldSize[0] : boss.worldSize[2]) * 0.5;
  const desired =
    attack.attackShape === "self_aoe"
      ? Math.max(
          halfNarrow + 2,
          Math.min(attack.attackDistance * 0.75, attack.hitRadius * 0.65)
        )
      : Math.max(halfNarrow + 4, attack.attackDistance * 0.78);
  const distance = Math.min(attack.attackDistance - 0.2, desired);
  return new THREE.Vector3(useX ? distance : 0, 1.05, useX ? 0 : distance);
}

function cloneBossAtPhase(
  gltf: Awaited<ReturnType<GLTFLoader["loadAsync"]>>,
  clipNames: string[],
  phase: number
) {
  const model = cloneSkeleton(gltf.scene);
  const sourceBounds = new THREE.Box3().setFromObject(model, true);
  const sourceSize = sourceBounds.getSize(new THREE.Vector3());
  model.scale.set(
    boss.worldSize[0] / Math.max(0.001, sourceSize.x),
    boss.worldSize[1] / Math.max(0.001, sourceSize.y),
    boss.worldSize[2] / Math.max(0.001, sourceSize.z)
  );
  model.updateMatrixWorld(true);
  const scaledBounds = new THREE.Box3().setFromObject(model, true);
  const center = scaledBounds.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -scaledBounds.min.y, -center.z);
  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.castShadow = true;
    child.receiveShadow = true;
    child.frustumCulled = false;
  });
  const clip = clipNames
    .map((name) => gltf.animations.find((candidate) => candidate.name === name))
    .find(Boolean);
  if (clip) {
    const mixer = new THREE.AnimationMixer(model);
    mixer.clipAction(clip).play();
    mixer.setTime(clip.duration * phase);
  }
  return model;
}

function makeScene(
  gltf: Awaited<ReturnType<GLTFLoader["loadAsync"]>>,
  target: THREE.Vector3,
  clipNames: string[],
  clipPhase: number
) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c1722);
  scene.fog = new THREE.Fog(0x0c1722, 65, 190);
  scene.add(new THREE.HemisphereLight(0xc7ecff, 0x172019, 2.4));
  const key = new THREE.DirectionalLight(0xffefc8, 4.4);
  key.position.set(-12, 20, 16);
  key.castShadow = true;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x6cbcff, 2.8);
  rim.position.set(18, 11, -18);
  scene.add(rim);
  const model = cloneBossAtPhase(gltf, clipNames, clipPhase);
  scene.add(model);
  const root = new THREE.Group();
  root.name = "boss-magic-production-runtime";
  scene.add(root);

  const span = Math.max(
    boss.worldSize[0],
    boss.worldSize[1],
    boss.worldSize[2],
    Math.abs(target.x) + boss.worldSize[0] * 0.5,
    Math.abs(target.z) + boss.worldSize[2] * 0.5
  );
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(span * 0.9, 64),
    new THREE.MeshStandardMaterial({ color: 0x182821, roughness: 0.96 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.03;
  scene.add(ground);
  const grid = new THREE.GridHelper(span * 1.7, 24, 0x55766f, 0x263f3d);
  grid.position.y = 0.01;
  scene.add(grid);
  const targetMarker = new THREE.Group();
  const targetCore = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.3, 1.15, 4, 8),
    new THREE.MeshStandardMaterial({
      color: 0xf1e5d1,
      emissive: 0x4f3825,
      emissiveIntensity: 0.5,
    })
  );
  targetCore.position.y = 0.85;
  targetMarker.add(targetCore);
  const targetRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.72, 0.045, 6, 28),
    new THREE.MeshBasicMaterial({ color: 0x67e5ff })
  );
  targetRing.rotation.x = Math.PI / 2;
  targetMarker.add(targetRing);
  targetMarker.position.set(target.x, 0.03, target.z);
  scene.add(targetMarker);

  const targetDirection = target.clone().setY(0);
  if (targetDirection.lengthSq() < 0.0001) targetDirection.set(0, 0, 1);
  targetDirection.normalize();
  const side = new THREE.Vector3(-targetDirection.z, 0, targetDirection.x);
  const lookAt = target.clone().multiplyScalar(0.38);
  lookAt.y = boss.worldSize[1] * 0.38;
  const camera = new THREE.PerspectiveCamera(38, WIDTH / HEIGHT, 0.05, 500);
  camera.position
    .copy(target)
    .addScaledVector(targetDirection, Math.max(6, span * 0.14))
    .addScaledVector(side, span * 0.18);
  camera.position.y = Math.max(4.5, boss.worldSize[1] * 0.48);
  camera.lookAt(lookAt);
  return { scene, camera, root };
}

function focusCameraOnTarget(
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3,
  phase: "telegraph" | "impact"
) {
  const outward = target.clone().setY(0);
  if (outward.lengthSq() < 0.0001) outward.set(0, 0, 1);
  outward.normalize();
  const side = new THREE.Vector3(-outward.z, 0, outward.x);
  const bossCharacteristicSize = Math.cbrt(
    boss.worldSize[0] * boss.worldSize[1] * boss.worldSize[2]
  );
  camera.position
    .copy(target)
    .addScaledVector(
      outward,
      Math.max(4.5, bossCharacteristicSize * (phase === "impact" ? 0.5 : 0.65))
    )
    .addScaledVector(side, Math.max(2.8, bossCharacteristicSize * 0.36));
  camera.position.y = target.y + Math.max(3.2, bossCharacteristicSize * 0.38);
  camera.lookAt(target.x, Math.max(0.75, target.y), target.z);
}

async function waitForAssetTurn() {
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  );
}

async function waitForRealProjectile(
  runtime: HarthmereProjectileVisualRuntime
) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    runtime.update(0);
    const active = window.__harthmereProjectileVisuals?.active?.[0];
    if (active && !active.usingFallback) return true;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve())
    );
  }
  return false;
}

function phaseFigure(label: string, canvas: HTMLCanvasElement, score: number) {
  const figure = document.createElement("figure");
  figure.append(canvas);
  const caption = document.createElement("figcaption");
  caption.textContent = label;
  figure.append(caption);
  const scoreLabel = document.createElement("span");
  scoreLabel.className = "frame-score";
  scoreLabel.textContent = `${(score * 100).toFixed(2)}% changed pixels`;
  figure.append(scoreLabel);
  return figure;
}

async function renderAttack(
  gltf: Awaited<ReturnType<GLTFLoader["loadAsync"]>>,
  attack: (typeof attacks)[number]
) {
  const projectile = getHarthmereProjectileVisual(attack.projectileVisualId)!;
  const shape = getHarthmereBossAttackShapeVisual(attack.attackShape);
  await Promise.all([
    loader.loadAsync(projectile.assetUrl),
    shape ? loader.loadAsync(shape.assetUrl) : Promise.resolve(undefined),
  ]);
  const target = playerTargetForAttack(attack);
  const presentation = harthmereBossMagicPresentation({
    position: [0, 0, 0],
    size: boss.worldSize,
    targetPoint: target.toArray() as [number, number, number],
  });
  const origin = new THREE.Vector3(...presentation.origin);
  const chargeTimeSecs = harthmereMagicChargeDurationSecs(attack);
  const power = harthmereMagicChargePower(attack);
  const chargeScene = makeScene(
    gltf,
    target,
    [
      "HarthmereBodyMagicChannel_Aligned_30",
      "ChannelMagic",
      "BasicMagic",
      "RangedAttack",
      "Idle",
    ],
    0.58
  );
  renderer.render(chargeScene.scene, chargeScene.camera);
  const chargeBaseline = copyFrame();
  const chargeRuntime = new HarthmereProjectileVisualRuntime(
    chargeScene.root,
    new GLTFLoader()
  );
  chargeRuntime.spawnMagicCharge({
    key: `${boss.id}:${attack.abilityId}`,
    projectileId: projectile.id,
    origin,
    duration: chargeTimeSecs,
    power,
    visualScale: presentation.chargeVisualScale,
  });
  await waitForAssetTurn();
  advance(chargeRuntime, chargeTimeSecs * 0.62);
  renderer.render(chargeScene.scene, chargeScene.camera);
  const chargeFrame = copyFrame();
  const chargeSnapshot = window.__harthmereProjectileVisuals;

  const attackClips = [
    attack.specialAnimationClip ?? "",
    attack.animationClip,
    "RangedAttack",
    "AreaAttack",
    "Attack",
  ].filter(Boolean);
  const travelScene = makeScene(gltf, target, attackClips, 0.42);
  if (attack.attackShape === "ground_aoe") {
    focusCameraOnTarget(travelScene.camera, target, "telegraph");
  }
  renderer.render(travelScene.scene, travelScene.camera);
  const travelBaseline = copyFrame();
  const travelRuntime = new HarthmereProjectileVisualRuntime(
    travelScene.root,
    new GLTFLoader()
  );
  travelRuntime.spawn({
    projectileId: projectile.id,
    origin,
    target,
    originGround: new THREE.Vector3(0, 0.03, 0),
    targetGround: new THREE.Vector3(target.x, 0.03, target.z),
    result: "hit",
    finalDamage: attack.attackDamage,
    damageType: attack.damageType,
    attackShape: attack.attackShape,
    attackDistance: attack.attackDistance,
    hitRadius: attack.hitRadius,
    coneAngleDeg: attack.coneAngleDeg,
    windupSecs: attack.castTimeSecs,
    visualScale: presentation.projectileVisualScale,
  });
  await waitForAssetTurn();
  if (attack.attackShape === "projectile") {
    await waitForRealProjectile(travelRuntime);
  }
  advance(travelRuntime, attack.castTimeSecs * 0.48);
  renderer.render(travelScene.scene, travelScene.camera);
  const travelFrame = copyFrame();
  const travelSnapshot = window.__harthmereProjectileVisuals;

  const impactScene = makeScene(gltf, target, attackClips, 0.82);
  focusCameraOnTarget(
    impactScene.camera,
    attack.attackShape === "self_aoe" ? new THREE.Vector3(0, 0.5, 0) : target,
    "impact"
  );
  renderer.render(impactScene.scene, impactScene.camera);
  const impactBaseline = copyFrame();
  const impactRuntime = new HarthmereProjectileVisualRuntime(
    impactScene.root,
    new GLTFLoader()
  );
  impactRuntime.spawn({
    projectileId: projectile.id,
    origin,
    target,
    originGround: new THREE.Vector3(0, 0.03, 0),
    targetGround: new THREE.Vector3(target.x, 0.03, target.z),
    result: "hit",
    finalDamage: attack.attackDamage,
    damageType: attack.damageType,
    attackShape: attack.attackShape,
    attackDistance: attack.attackDistance,
    hitRadius: attack.hitRadius,
    coneAngleDeg: attack.coneAngleDeg,
    windupSecs: attack.castTimeSecs,
    visualScale: presentation.projectileVisualScale,
  });
  await waitForAssetTurn();
  advance(impactRuntime, attack.castTimeSecs + 0.14);
  renderer.render(impactScene.scene, impactScene.camera);
  const impactFrame = copyFrame();
  const impactSnapshot = window.__harthmereProjectileVisuals;

  const lowFpsScene = makeScene(gltf, target, attackClips, 0.82);
  focusCameraOnTarget(
    lowFpsScene.camera,
    attack.attackShape === "self_aoe" ? new THREE.Vector3(0, 0.5, 0) : target,
    "impact"
  );
  renderer.render(lowFpsScene.scene, lowFpsScene.camera);
  const lowFpsBaseline = copyFrame();
  const lowFpsRuntime = new HarthmereProjectileVisualRuntime(
    lowFpsScene.root,
    new GLTFLoader()
  );
  lowFpsRuntime.spawn({
    projectileId: projectile.id,
    origin,
    target,
    originGround: new THREE.Vector3(0, 0.03, 0),
    targetGround: new THREE.Vector3(target.x, 0.03, target.z),
    result: "hit",
    finalDamage: attack.attackDamage,
    damageType: attack.damageType,
    attackShape: attack.attackShape,
    attackDistance: attack.attackDistance,
    hitRadius: attack.hitRadius,
    coneAngleDeg: attack.coneAngleDeg,
    windupSecs: attack.castTimeSecs,
    authoritativeImpactSecs: attack.castTimeSecs,
    visualScale: presentation.projectileVisualScale,
  });
  // Simulate one rendered frame arriving exactly at authoritative impact.
  // Before the wall-time fix this advanced only 50 ms and left damage nearly
  // a full second ahead of the projectile at production's recorded 1 FPS.
  lowFpsRuntime.update(attack.castTimeSecs);
  renderer.render(lowFpsScene.scene, lowFpsScene.camera);
  const lowFpsFrame = copyFrame();
  const lowFpsSnapshot = window.__harthmereProjectileVisuals;

  const chargeVisibilityScore = pixelDifference(
    chargeBaseline.imageData,
    chargeFrame.imageData
  );
  const travelVisibilityScore = pixelDifference(
    travelBaseline.imageData,
    travelFrame.imageData
  );
  const impactVisibilityScore = pixelDifference(
    impactBaseline.imageData,
    impactFrame.imageData
  );
  const lowFpsImpactVisibilityScore = pixelDifference(
    lowFpsBaseline.imageData,
    lowFpsFrame.imageData
  );
  const activeProjectile = travelSnapshot?.active?.[0];
  const activeShape = travelSnapshot?.activeShapes?.[0];
  const originDistance = origin.distanceTo(target);
  const travelDistance = activeProjectile
    ? new THREE.Vector3(
        ...(activeProjectile.position as [number, number, number])
      ).distanceTo(target)
    : originDistance;
  const pathMovesTowardPlayer =
    attack.attackShape === "projectile"
      ? Boolean(activeProjectile && travelDistance < originDistance * 0.9)
      : Boolean(activeShape);
  const explosion = impactSnapshot?.activeMagicExplosions?.[0];
  const failures: string[] = [];
  if (chargeVisibilityScore < MINIMUM_VISIBILITY_SCORE)
    failures.push("charge not visible");
  if (!chargeSnapshot?.activeMagicCharges?.length)
    failures.push("charge runtime inactive");
  if (travelVisibilityScore < MINIMUM_VISIBILITY_SCORE)
    failures.push("travel/shape not visible");
  if (!pathMovesTowardPlayer) failures.push("travel does not approach player");
  if (impactVisibilityScore < MINIMUM_VISIBILITY_SCORE)
    failures.push("impact explosion not visible");
  if ((impactSnapshot?.magicExplosionCount ?? 0) !== 1)
    failures.push("magic explosion counter did not advance once");
  if (!explosion) failures.push("no active hit explosion");
  if (lowFpsImpactVisibilityScore < MINIMUM_VISIBILITY_SCORE)
    failures.push("low-FPS impact not visible");
  if ((lowFpsSnapshot?.magicExplosionCount ?? 0) !== 1)
    failures.push("low-FPS wall-time frame did not resolve contact");
  if (
    (lowFpsSnapshot?.active?.length ?? 0) > 0 ||
    (lowFpsSnapshot?.activeShapes?.length ?? 0) > 0
  )
    failures.push("low-FPS projectile remained behind authoritative impact");
  if ((impactSnapshot?.failedIds?.length ?? 0) > 0)
    failures.push(`asset failures: ${impactSnapshot?.failedIds?.join(", ")}`);
  const loadedRealProjectile =
    attack.attackShape === "projectile"
      ? activeProjectile?.usingFallback === false
      : true;
  if (!loadedRealProjectile) failures.push("projectile remained on fallback");

  const article = document.createElement("article");
  if (failures.length) article.className = "fail";
  article.innerHTML = `
    <div class="attack-head">
      <div>
        <h2>${attack.displayName}</h2>
        <div class="meta">${attack.abilityId} · ${attack.attackShape} · ${
          attack.damageType
        } · ${projectile.id} · charge ${chargeTimeSecs.toFixed(
          2
        )}s · scale ${presentation.chargeVisualScale.toFixed(
          2
        )} / projectile ${presentation.projectileVisualScale.toFixed(2)}</div>
      </div>
      <div class="score">${
        failures.length
          ? failures.join(" · ")
          : "charge, travel, and explosion pass"
      }</div>
    </div>
    <div class="frames"></div>
  `;
  const frames = article.querySelector(".frames")!;
  frames.append(
    phaseFigure("1 · visual charge", chargeFrame.canvas, chargeVisibilityScore),
    phaseFigure(
      "2 · travel / shape",
      travelFrame.canvas,
      travelVisibilityScore
    ),
    phaseFigure("3 · hit explosion", impactFrame.canvas, impactVisibilityScore),
    phaseFigure(
      "4 · one-frame low-FPS contact",
      lowFpsFrame.canvas,
      lowFpsImpactVisibilityScore
    )
  );
  document.querySelector("#grid")!.append(article);

  return {
    abilityId: attack.abilityId,
    attackName: attack.displayName,
    shape: attack.attackShape,
    projectileId: projectile.id,
    chargeTimeSecs,
    chargeVisualScale: presentation.chargeVisualScale,
    projectileVisualScale: presentation.projectileVisualScale,
    bodySurfaceDistance: presentation.horizontalBodySurfaceDistance,
    chargeVisibilityScore,
    travelVisibilityScore,
    impactVisibilityScore,
    lowFpsImpactVisibilityScore,
    pathMovesTowardPlayer,
    magicExplosionCount: impactSnapshot?.magicExplosionCount ?? 0,
    explosionRadius: explosion?.radius ?? 0,
    loadedRealProjectile,
    failures,
  };
}

async function run() {
  const gltf = await loader.loadAsync(boss.assetUrl);
  const results = [];
  for (const attack of attacks) results.push(await renderAttack(gltf, attack));
  const failures = results.flatMap((result) =>
    result.failures.map((failure) => `${result.attackName}: ${failure}`)
  );
  window.__harthmereBossMagicLifecycleAudit = {
    ready: true,
    bossId: boss.id,
    bossName: boss.displayName,
    worldSize: [...boss.worldSize],
    magicAttackCount: attacks.length,
    results,
    failures,
  };
  const status = document.querySelector("#status")!;
  status.textContent = failures.length
    ? `${failures.length} lifecycle failures`
    : `${results.length}/${results.length} magic attacks pass`;
  status.className = `status ${failures.length ? "fail" : "pass"}`;
}

run().catch((error) => {
  const message = String((error as Error)?.stack ?? error);
  const status = document.querySelector("#status")!;
  status.textContent = "Audit failed";
  status.className = "status fail";
  document.querySelector("#grid")!.textContent = message;
  window.__harthmereBossMagicLifecycleAudit = {
    ready: true,
    bossId: boss.id,
    bossName: boss.displayName,
    worldSize: [...boss.worldSize],
    magicAttackCount: attacks.length,
    results: [],
    failures: [message],
  };
});
