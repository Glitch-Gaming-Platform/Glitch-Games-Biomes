import { HarthmereProjectileVisualRuntime } from "@/client/game/renderers/local_dev/harthmere_projectiles";
import { harthmereMagicChargeDurationSecs } from "@/shared/harthmere/magic_charge";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

type RuntimeSnapshot = {
  active?: Array<{ usingFallback: boolean; position: number[] }>;
  activeMagicCharges?: unknown[];
  activeMagicExplosions?: unknown[];
  magicExplosionCount?: number;
  failedIds?: string[];
};

declare global {
  interface Window {
    __harthmereProjectileVisuals?: RuntimeSnapshot;
    __harthmereHexFireballAudit?: {
      ready: boolean;
      status: "pass" | "fail";
      chargeTimeSecs: number;
      scores: Record<string, number>;
      failures: string[];
    };
  }
}

const WIDTH = 520;
const HEIGHT = 340;
const MINIMUM_VISIBILITY = 0.00006;
const HEX_FIREBALL_IMPACT_SECS = 1;
const origin = new THREE.Vector3(0.7, 1.55, 0);
const target = new THREE.Vector3(7.5, 1, 0);
const attack = {
  damageType: "fire" as const,
  projectileVisualId: "fireball",
  attackDamage: 63,
  cooldownSecs: 20,
  attackShape: "projectile" as const,
};
const chargeTimeSecs = harthmereMagicChargeDurationSecs(attack);

document.body.innerHTML = `<main><header><div><p class="eyebrow">Native ECS / Anima ordinary Hex audit</p><h1>Hex Fireball</h1><p>real tracked Hex rig · charge → flight → impact → one-frame low-FPS contact</p></div><div id="status">Loading…</div></header><section id="frames"></section></main>`;
const style = document.createElement("style");
style.textContent = `
  :root { color-scheme: dark; font-family: Inter, system-ui, sans-serif; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #071019; color: #eef8f4; }
  main { max-width: 1500px; margin: auto; padding: 28px; }
  header { display:flex; align-items:end; justify-content:space-between; gap:20px; padding:20px 24px; border:1px solid #394f5d; border-radius:18px; background:linear-gradient(135deg,#182632,#101823); }
  h1 { margin:2px 0 4px; font:700 34px/1.1 Georgia,serif; color:#fff0bd; }
  p { margin:4px 0; color:#a9c9c7; }
  .eyebrow { color:#91dfc6; text-transform:uppercase; letter-spacing:.13em; font-size:11px; font-weight:800; }
  #status { padding:11px 18px; border-radius:999px; background:#263844; color:#ffe09c; font-weight:800; }
  #status.pass { background:#173f31; color:#99f2bc; }
  #status.fail { background:#4c2228; color:#ffb5b5; }
  #frames { display:grid; grid-template-columns:repeat(2,1fr); gap:16px; margin-top:18px; }
  figure { position:relative; margin:0; border:1px solid #30474f; border-radius:16px; overflow:hidden; background:#101b24; }
  canvas { display:block; width:100%; height:auto; }
  figcaption { position:absolute; left:12px; top:12px; padding:7px 9px; border-radius:7px; background:#071019e6; font-weight:800; text-transform:uppercase; letter-spacing:.06em; }
  .score { position:absolute; right:12px; bottom:12px; padding:6px 8px; border-radius:7px; background:#071019e6; color:#a9d6d0; }
`;
document.head.append(style);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(1);
renderer.setSize(WIDTH, HEIGHT, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.style.position = "fixed";
renderer.domElement.style.left = "-10000px";
document.body.append(renderer.domElement);
const loader = new GLTFLoader();

function sceneFor(
  gltf: Awaited<ReturnType<GLTFLoader["loadAsync"]>>,
  attackPhase: number
) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1824);
  scene.add(new THREE.HemisphereLight(0xcde9ff, 0x3d493d, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2.8);
  sun.position.set(5, 9, 8);
  scene.add(sun);
  const grid = new THREE.GridHelper(22, 22, 0x50776d, 0x273f3b);
  scene.add(grid);

  const root = new THREE.Group();
  scene.add(root);
  const hex = cloneSkeleton(gltf.scene);
  const bounds = new THREE.Box3().setFromObject(hex, true);
  const size = bounds.getSize(new THREE.Vector3());
  const scale = 2.35 / Math.max(0.001, size.y);
  hex.scale.setScalar(scale);
  hex.updateMatrixWorld(true);
  const scaled = new THREE.Box3().setFromObject(hex, true);
  const center = scaled.getCenter(new THREE.Vector3());
  hex.position.set(-center.x, -scaled.min.y, -center.z);
  root.add(hex);
  const clip =
    gltf.animations.find(({ name }) => name === "Attack") ?? gltf.animations[0];
  if (clip) {
    const mixer = new THREE.AnimationMixer(hex);
    const action = mixer.clipAction(clip);
    action.play();
    mixer.setTime(clip.duration * attackPhase);
  }

  const player = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.38, 1.1, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0xf4f1df, roughness: 0.75 })
  );
  player.position.copy(target).setY(0.93);
  root.add(player);

  const camera = new THREE.PerspectiveCamera(42, WIDTH / HEIGHT, 0.1, 80);
  camera.position.set(4.5, 4.1, 10.5);
  camera.lookAt(3.6, 1.1, 0);
  return { scene, root, camera };
}

function copyFrame() {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(renderer.domElement, 0, 0);
  return { canvas, imageData: context.getImageData(0, 0, WIDTH, HEIGHT) };
}

function difference(a: ImageData, b: ImageData) {
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

function addFigure(
  label: string,
  frame: ReturnType<typeof copyFrame>,
  score: number
) {
  const figure = document.createElement("figure");
  figure.append(frame.canvas);
  const caption = document.createElement("figcaption");
  caption.textContent = label;
  figure.append(caption);
  const scoreNode = document.createElement("span");
  scoreNode.className = "score";
  scoreNode.textContent = `${(score * 100).toFixed(2)}% changed pixels`;
  figure.append(scoreNode);
  document.querySelector("#frames")!.append(figure);
}

async function assetTurn() {
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  );
}

async function run() {
  const gltf = await loader.loadAsync("/hexer.gltf");
  const scores: Record<string, number> = {};
  const failures: string[] = [];

  const charge = sceneFor(gltf, 0.2);
  renderer.render(charge.scene, charge.camera);
  const chargeBase = copyFrame();
  const chargeRuntime = new HarthmereProjectileVisualRuntime(
    charge.root,
    loader
  );
  chargeRuntime.spawnMagicCharge({
    key: "ordinary-hex:fireball",
    projectileId: "fireball",
    origin,
    duration: chargeTimeSecs,
    power: 0.65,
  });
  await assetTurn();
  chargeRuntime.update(chargeTimeSecs * 0.64);
  renderer.render(charge.scene, charge.camera);
  const chargeFrame = copyFrame();
  scores.charge = difference(chargeBase.imageData, chargeFrame.imageData);
  if (!window.__harthmereProjectileVisuals?.activeMagicCharges?.length)
    failures.push("charge runtime inactive");

  const flight = sceneFor(gltf, 0.54);
  renderer.render(flight.scene, flight.camera);
  const flightBase = copyFrame();
  const flightRuntime = new HarthmereProjectileVisualRuntime(
    flight.root,
    loader
  );
  flightRuntime.spawn({
    projectileId: "fireball",
    origin,
    target,
    result: "hit",
    finalDamage: attack.attackDamage,
    damageType: attack.damageType,
    windupSecs: HEX_FIREBALL_IMPACT_SECS,
    authoritativeImpactSecs: HEX_FIREBALL_IMPACT_SECS,
  });
  await assetTurn();
  for (let index = 0; index < 10; index += 1) {
    flightRuntime.update(0);
    if (
      window.__harthmereProjectileVisuals?.active?.[0]?.usingFallback === false
    )
      break;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve())
    );
  }
  flightRuntime.update(0.52);
  renderer.render(flight.scene, flight.camera);
  const flightFrame = copyFrame();
  scores.flight = difference(flightBase.imageData, flightFrame.imageData);
  if (window.__harthmereProjectileVisuals?.active?.[0]?.usingFallback !== false)
    failures.push("real Fireball GLB did not attach");

  const impact = sceneFor(gltf, 0.82);
  renderer.render(impact.scene, impact.camera);
  const impactBase = copyFrame();
  const impactRuntime = new HarthmereProjectileVisualRuntime(
    impact.root,
    loader
  );
  impactRuntime.spawn({
    projectileId: "fireball",
    origin,
    target,
    result: "hit",
    finalDamage: attack.attackDamage,
    damageType: attack.damageType,
    authoritativeImpactSecs: HEX_FIREBALL_IMPACT_SECS,
  });
  impactRuntime.update(HEX_FIREBALL_IMPACT_SECS);
  renderer.render(impact.scene, impact.camera);
  const impactFrame = copyFrame();
  scores.impact = difference(impactBase.imageData, impactFrame.imageData);
  if ((window.__harthmereProjectileVisuals?.magicExplosionCount ?? 0) !== 1)
    failures.push("normal impact did not resolve exactly once");

  const lowFps = sceneFor(gltf, 0.82);
  renderer.render(lowFps.scene, lowFps.camera);
  const lowFpsBase = copyFrame();
  const lowFpsRuntime = new HarthmereProjectileVisualRuntime(
    lowFps.root,
    loader
  );
  lowFpsRuntime.spawn({
    projectileId: "fireball",
    origin,
    target,
    result: "hit",
    finalDamage: attack.attackDamage,
    damageType: attack.damageType,
    authoritativeImpactSecs: HEX_FIREBALL_IMPACT_SECS,
  });
  lowFpsRuntime.update(HEX_FIREBALL_IMPACT_SECS);
  renderer.render(lowFps.scene, lowFps.camera);
  const lowFpsFrame = copyFrame();
  scores.lowFps = difference(lowFpsBase.imageData, lowFpsFrame.imageData);
  const lowFpsSnapshot = window.__harthmereProjectileVisuals;
  if ((lowFpsSnapshot?.magicExplosionCount ?? 0) !== 1)
    failures.push("one-frame low-FPS contact did not resolve");
  if ((lowFpsSnapshot?.active?.length ?? 0) > 0)
    failures.push("Fireball remained behind authoritative contact");
  if ((lowFpsSnapshot?.failedIds?.length ?? 0) > 0)
    failures.push("projectile asset failed");

  for (const [name, score] of Object.entries(scores)) {
    if (score < MINIMUM_VISIBILITY) failures.push(`${name} not visible`);
  }
  addFigure("1 · visible Hex charge", chargeFrame, scores.charge);
  addFigure("2 · real Fireball in flight", flightFrame, scores.flight);
  addFigure("3 · authoritative hit explosion", impactFrame, scores.impact);
  addFigure("4 · one-frame low-FPS contact", lowFpsFrame, scores.lowFps);

  const status = document.querySelector("#status")!;
  status.textContent = failures.length
    ? failures.join(" · ")
    : "4/4 phases pass";
  status.className = failures.length ? "fail" : "pass";
  window.__harthmereHexFireballAudit = {
    ready: true,
    status: failures.length ? "fail" : "pass",
    chargeTimeSecs,
    scores,
    failures,
  };
}

run().catch((error) => {
  const failures = [String((error as Error)?.stack ?? error)];
  const status = document.querySelector("#status")!;
  status.textContent = "Audit failed";
  status.className = "fail";
  window.__harthmereHexFireballAudit = {
    ready: true,
    status: "fail",
    chargeTimeSecs,
    scores: {},
    failures,
  };
});
