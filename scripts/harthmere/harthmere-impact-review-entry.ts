import { HarthmereProjectileVisualRuntime } from "@/client/game/renderers/local_dev/harthmere_projectiles";
import { getHarthmereProjectileVisual } from "@/shared/harthmere/projectile_visual_manifest";
import * as THREE from "three";

type ReviewCase = {
  id: string;
  label: string;
  projectileId: string;
  damageType?: string;
  finalDamage: number;
  hitRadius?: number;
};

const REVIEW_CASES: ReviewCase[] = [
  { id: "physical", label: "Physical Hit", projectileId: "hunter_bow_shot", damageType: "piercing", finalDamage: 42 },
  { id: "energy", label: "Energy Burst", projectileId: "photon_sidearm_pulse", damageType: "energy", finalDamage: 58 },
  { id: "smoke_bloom", label: "Smoke Bloom", projectileId: "smoke_bomb_throw", finalDamage: 24, hitRadius: 1.8 },
  { id: "arcane_prism", label: "Arcane Prism", projectileId: "spark", damageType: "arcane", finalDamage: 72 },
  { id: "fire_eruption", label: "Fire Eruption", projectileId: "fireball", damageType: "fire", finalDamage: 86 },
  { id: "lightning_crackle", label: "Lightning Crackle", projectileId: "lightning_bolt", damageType: "lightning", finalDamage: 82 },
  { id: "holy_pillar", label: "Holy Pillar", projectileId: "holy_light", damageType: "holy", finalDamage: 78 },
  { id: "dark_implosion", label: "Dark Implosion", projectileId: "life_drain", damageType: "dark", finalDamage: 80 },
  { id: "hex_implosion", label: "Hex Implosion", projectileId: "hex_bolt", damageType: "hex", finalDamage: 84 },
  { id: "nature_root_burst", label: "Nature Root Burst", projectileId: "entangling_roots", damageType: "nature", finalDamage: 76 },
  { id: "sonic_wave", label: "Sonic Wavefront", projectileId: "mocking_verse", damageType: "sonic", finalDamage: 70 },
  { id: "mark_reticle", label: "Hunter Reticle", projectileId: "hunters_mark", finalDamage: 68 },
  { id: "gravity_singularity", label: "Gravity Singularity", projectileId: "singularity_lance_beam", damageType: "gravity", finalDamage: 135, hitRadius: 4.8 },
  { id: "boss_cataclysm", label: "Boss Cataclysm", projectileId: "thaedryn_resonance", finalDamage: 150, hitRadius: 4.2 },
];

function addBackdrop(scene: THREE.Scene) {
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(2.8, 48),
    new THREE.MeshBasicMaterial({ color: 0x111723, transparent: true, opacity: 0.84 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.68;
  scene.add(floor);

  const horizon = new THREE.Mesh(
    new THREE.TorusGeometry(1.35, 0.012, 4, 48),
    new THREE.MeshBasicMaterial({ color: 0x2c3850, transparent: true, opacity: 0.38 })
  );
  horizon.rotation.x = Math.PI / 2;
  horizon.position.y = -0.66;
  scene.add(horizon);
}

function renderReview(card: HTMLElement, review: ReviewCase) {
  const canvas = card.querySelector("canvas");
  if (!(canvas instanceof HTMLCanvasElement)) return;
  const definition = getHarthmereProjectileVisual(review.projectileId);
  if (!definition) throw new Error(`Missing projectile ${review.projectileId}`);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070a11);
  addBackdrop(scene);
  const effectRoot = new THREE.Group();
  scene.add(effectRoot);
  const runtime = new HarthmereProjectileVisualRuntime(
    effectRoot,
    { loadAsync: async () => new Promise(() => {}) } as never
  );
  const impact = (runtime as unknown as {
    addResolvedImpact(input: Record<string, unknown>): {
      radius: number;
      profile?: { silhouette?: string };
    };
  }).addResolvedImpact({
    definition,
    position: new THREE.Vector3(0, 0, 0),
    direction: new THREE.Vector3(0.25, 0.04, 1).normalize(),
    targetGround: new THREE.Vector3(0, -0.64, 0),
    result: "hit",
    finalDamage: review.finalDamage,
    damageType: review.damageType,
    impactRadius: review.hitRadius ?? definition.impactRadius,
    seed: REVIEW_CASES.indexOf(review) + 11,
  });

  for (let index = 0; index < 11; index += 1) runtime.update(1 / 60);
  effectRoot.scale.setScalar(1 / Math.max(1, impact.radius * 0.78));
  effectRoot.rotation.y = -0.18;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(1);
  renderer.setSize(300, 220, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const camera = new THREE.PerspectiveCamera(42, 300 / 220, 0.01, 50);
  camera.position.set(3.25, 2.35, 4.4);
  camera.lookAt(0, 0.02, 0);
  renderer.render(scene, camera);

  card.dataset.silhouette = impact.profile?.silhouette ?? "basic";
  card.dataset.radius = impact.radius.toFixed(2);
  const meta = card.querySelector(".impact-meta");
  if (meta) {
    meta.textContent = `${impact.profile?.silhouette?.replaceAll("_", " ") ?? "premium impact"} · radius ${impact.radius.toFixed(2)}m`;
  }
}

function main() {
  const root = document.querySelector("#impact-grid");
  if (!root) throw new Error("Missing impact grid");
  for (const review of REVIEW_CASES) {
    const card = document.createElement("article");
    card.className = "impact-card";
    card.dataset.impactId = review.id;
    card.innerHTML = `<canvas width="300" height="220"></canvas><div class="impact-label">${review.label}</div><div class="impact-meta"></div>`;
    root.appendChild(card);
    renderReview(card, review);
  }
  document.body.dataset.ready = "true";
  (window as typeof window & { __harthmereImpactReviewReady?: boolean }).__harthmereImpactReviewReady = true;
}

main();
