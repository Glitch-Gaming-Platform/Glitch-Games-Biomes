import {
  HARTHMERE_BOSS_ATTACK_SHAPE_VISUALS,
  getHarthmereBossAttackShapeVisual,
  type HarthmereBossAreaAttackShape,
  type HarthmereBossAttackShape,
  type HarthmereBossAttackShapeVisualDefinition,
} from "@/shared/harthmere/boss_attack_shape_visuals";
import {
  HARTHMERE_AUTHORITATIVE_IMPACT_EPSILON_SECS,
  HARTHMERE_PROJECTILE_VISUALS,
  HARTHMERE_PROJECTILE_VISUAL_VERSION,
  getHarthmereProjectileVisual,
  harthmereProjectileFlightDurationSecs,
  type HarthmereProjectileVisualDefinition,
} from "@/shared/harthmere/projectile_visual_manifest";
import {
  emitHarthmereSoundEffect,
  preloadHarthmereSoundEffect,
} from "@/shared/harthmere/sound_effect_manifest";
import {
  HARTHMERE_PROJECTILE_EXPLOSION_AUDIO_PROFILE,
  resolveHarthmereProjectileLifecycleSounds,
} from "@/shared/harthmere/projectile_sound_lifecycle";
import type { HarthmereMagicChargePhase } from "@/shared/harthmere/magic_charge";
import {
  HARTHMERE_MAGIC_IMPACT_VERSION,
  harthmereMagicImpactProfile,
  type HarthmereMagicImpactProfile,
} from "@/shared/harthmere/magic_impact";
import * as THREE from "three";
import type {
  GLTF,
  GLTFLoader,
} from "three/examples/jsm/loaders/GLTFLoader.js";

type ProjectilePrototype = {
  scene: THREE.Object3D;
  animations: THREE.AnimationClip[];
};

type TrailSample = {
  position: THREE.Vector3;
  direction: THREE.Vector3;
  age: number;
  seed: number;
};

type PremiumTrail = {
  mesh: THREE.InstancedMesh;
  geometry: THREE.BufferGeometry;
  material: THREE.MeshBasicMaterial;
  samples: TrailSample[];
  accumulator: number;
  interval: number;
  lifetime: number;
  width: number;
  length: number;
  maxSamples: number;
};

type ActiveProjectile = {
  sequence: number;
  definition: HarthmereProjectileVisualDefinition;
  mount: THREE.Group;
  modelHost: THREE.Group;
  fallback: THREE.Object3D;
  trail: PremiumTrail;
  start: THREE.Vector3;
  target: THREE.Vector3;
  lastPosition: THREE.Vector3;
  elapsed: number;
  duration: number;
  visualScale: number;
  damageType?: string;
  impactRadius: number;
  result?: string;
  targetGround?: THREE.Vector3;
  finalDamage?: number;
  mixer?: THREE.AnimationMixer;
  light?: THREE.PointLight;
};

type ActiveAttackShapeEffect = {
  sequence: number;
  shapeDefinition: HarthmereBossAttackShapeVisualDefinition;
  projectileDefinition: HarthmereProjectileVisualDefinition;
  group: THREE.Group;
  modelHost: THREE.Group;
  fallback: THREE.Object3D;
  materials: THREE.Material[];
  origin: THREE.Vector3;
  target: THREE.Vector3;
  distance: number;
  radialScale: number;
  elapsed: number;
  duration: number;
  damageType?: string;
  impactRadius: number;
  result?: string;
  targetGround?: THREE.Vector3;
  finalDamage?: number;
  mixer?: THREE.AnimationMixer;
  light?: THREE.PointLight;
};

type ImpactPart = {
  object: THREE.Object3D;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
};

type BasicImpact = {
  kind: "basic";
  group: THREE.Group;
  materials: THREE.MeshBasicMaterial[];
  parts: ImpactPart[];
  light?: THREE.PointLight;
  elapsed: number;
  framesRendered: number;
  duration: number;
  radius: number;
};

type MagicImpactLayer = {
  object: THREE.Object3D;
  material: THREE.MeshBasicMaterial;
  start: number;
  end: number;
  startScale: number;
  endScale: number;
  shapeScale: THREE.Vector3;
  initialOpacity: number;
  fadePower: number;
  rotationSpeed: THREE.Vector3;
  rise: number;
};

type MagicImpactParticle = {
  initialPosition: THREE.Vector3;
  velocity: THREE.Vector3;
  initialQuaternion: THREE.Quaternion;
  spin: THREE.Vector3;
  baseScale: THREE.Vector3;
  delay: number;
  lifetime: number;
  gravity: number;
  drag: number;
};

type MagicImpactParticleBatch = {
  kind: "debris" | "sparks" | "mist" | "dust";
  mesh: THREE.InstancedMesh;
  material: THREE.MeshBasicMaterial;
  particles: MagicImpactParticle[];
  initialOpacity: number;
};

type MagicImpact = {
  kind: "magic_explosion";
  projectileId: string;
  family: HarthmereProjectileVisualDefinition["family"];
  group: THREE.Group;
  layers: MagicImpactLayer[];
  batches: MagicImpactParticleBatch[];
  light?: THREE.PointLight;
  initialLightIntensity: number;
  elapsed: number;
  framesRendered: number;
  duration: number;
  radius: number;
  profile: HarthmereMagicImpactProfile;
};

type PremiumImpact = BasicImpact | MagicImpact;

export type HarthmereMagicImpactFeedback = {
  version: typeof HARTHMERE_MAGIC_IMPACT_VERSION;
  projectileId: string;
  family: HarthmereProjectileVisualDefinition["family"];
  position: [number, number, number];
  radius: number;
  duration: number;
  cameraStrength: number;
  finalDamage?: number;
};

type ActiveMagicCharge = {
  sequence: number;
  key: string;
  definition: HarthmereProjectileVisualDefinition;
  group: THREE.Group;
  modelHost: THREE.Group;
  core: THREE.Mesh;
  shell: THREE.Mesh;
  rings: THREE.Mesh[];
  particles: THREE.InstancedMesh;
  elapsed: number;
  framesRendered: number;
  duration: number;
  power: number;
  visualScale: number;
  origin: THREE.Vector3;
  modelAttached: boolean;
  mixer?: THREE.AnimationMixer;
  light?: THREE.PointLight;
};

export type HarthmereProjectileSpawnRequest = {
  projectileId: string;
  origin: THREE.Vector3;
  target: THREE.Vector3;
  originGround?: THREE.Vector3;
  targetGround?: THREE.Vector3;
  result?: string;
  finalDamage?: number;
  attackShape?: HarthmereBossAttackShape;
  attackDistance?: number;
  hitRadius?: number;
  coneAngleDeg?: number;
  windupSecs?: number;
  authoritativeImpactSecs?: number;
  visualScale?: number;
  damageType?: string;
};

export type HarthmereMagicChargeSpawnRequest = {
  key: string;
  projectileId: string;
  origin: THREE.Vector3;
  duration: number;
  power?: number;
  visualScale?: number;
};

const FORWARD = new THREE.Vector3(0, 0, 1);
const UP = new THREE.Vector3(0, 1, 0);
const MAX_ACTIVE_PROJECTILES = 40;
const MAX_ACTIVE_ATTACK_SHAPES = 24;
const MAX_ACTIVE_IMPACTS = 28;
const MAX_ACTIVE_MAGIC_EXPLOSIONS = 12;
const MAX_ACTIVE_MAGIC_CHARGES = 16;
const MAX_PROJECTILE_LIGHTS = 10;
const MAX_IMPACT_LIGHTS = 8;

// Minimum number of rendered frames any combat visual is held for. Three frames
// survives a 14 FPS session (~214 ms) while being invisible overhead at 60 FPS.
const MIN_VISIBLE_FRAMES = 3;
const MAGIC_CHARGE_PARTICLE_COUNT = 24;
const MAGIC_CHARGE_MATRIX = new THREE.Matrix4();

function emitProjectileLaunchAndFlightSound(input: {
  definition: HarthmereProjectileVisualDefinition;
  origin: THREE.Vector3;
  target: THREE.Vector3;
  durationSeconds: number;
  damageType?: string;
}) {
  const sounds = resolveHarthmereProjectileLifecycleSounds(input);
  if (!sounds) return;
  if (sounds.explosion) {
    // Production fetches and decodes this while the projectile is still in
    // flight, so the first explosion is ready at the authoritative hit frame.
    preloadHarthmereSoundEffect(sounds.explosion);
  }
  if (sounds.launch) {
    emitHarthmereSoundEffect(sounds.launch, {
      position: input.origin.toArray(),
    });
  }
  if (sounds.flight) {
    const flightPosition = input.origin.clone().lerp(input.target, 0.45);
    emitHarthmereSoundEffect(sounds.flight, {
      position: flightPosition.toArray(),
      durationSeconds: input.durationSeconds,
      fadeOutSeconds: Math.min(0.16, input.durationSeconds * 0.28),
    });
  }
}

function emitProjectileImpactSound(input: {
  definition: HarthmereProjectileVisualDefinition;
  damageType?: string;
  contactSoundId?: string;
  position: THREE.Vector3;
  impact: PremiumImpact;
}) {
  const sounds = resolveHarthmereProjectileLifecycleSounds(input);
  const contactSoundId = input.contactSoundId ?? sounds?.impact;
  if (contactSoundId) {
    emitHarthmereSoundEffect(contactSoundId, {
      position: input.position.toArray(),
    });
  }
  if (input.impact.kind !== "magic_explosion" || !sounds?.explosion) return;
  emitHarthmereSoundEffect(sounds.explosion, {
    position: input.position.toArray(),
    durationSeconds: input.impact.duration,
    fadeOutSeconds: Math.min(0.42, input.impact.duration * 0.34),
    ...HARTHMERE_PROJECTILE_EXPLOSION_AUDIO_PROFILE,
  });
}
const MAGIC_CHARGE_POSITION = new THREE.Vector3();
const MAGIC_CHARGE_SCALE = new THREE.Vector3();
const MAGIC_CHARGE_QUATERNION = new THREE.Quaternion();
const MAGIC_IMPACT_MATRIX = new THREE.Matrix4();
const MAGIC_IMPACT_POSITION = new THREE.Vector3();
const MAGIC_IMPACT_SCALE = new THREE.Vector3();
const MAGIC_IMPACT_QUATERNION = new THREE.Quaternion();
const MAGIC_IMPACT_SPIN_QUATERNION = new THREE.Quaternion();

function effectMaterial(
  color: number,
  opacity = 1,
  blending: THREE.Blending = THREE.AdditiveBlending
) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1 || blending === THREE.AdditiveBlending,
    opacity,
    blending,
    depthWrite: blending === THREE.NormalBlending,
    toneMapped: false,
  });
}

function disposeEffectObject(object: THREE.Object3D, disposeGeometry = true) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (disposeGeometry) mesh.geometry.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
    else material.dispose();
  });
}

function clonePremiumModel(prototype: ProjectilePrototype) {
  const scene = prototype.scene.clone(true);
  scene.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const cloneMaterial = (source: THREE.Material) => {
      const material = source.clone();
      material.toneMapped = false;
      if (
        material instanceof THREE.MeshStandardMaterial ||
        material instanceof THREE.MeshPhysicalMaterial
      ) {
        material.emissiveIntensity = Math.max(0.9, material.emissiveIntensity);
      }
      return material;
    };
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(cloneMaterial)
      : cloneMaterial(mesh.material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 25;
  });
  return scene;
}

function shapeMaterialColor(
  materialName: string,
  definition: HarthmereProjectileVisualDefinition
) {
  const normalized = materialName.toLowerCase();
  if (normalized.includes("accent")) {
    return new THREE.Color(definition.secondaryColor).lerp(
      new THREE.Color(0xffffff),
      0.72
    );
  }
  if (normalized.includes("secondary")) {
    return new THREE.Color(definition.secondaryColor);
  }
  if (normalized.includes("shell")) {
    return new THREE.Color(definition.primaryColor).multiplyScalar(0.28);
  }
  return new THREE.Color(definition.primaryColor);
}

function cloneBossAttackShapeModel(
  prototype: ProjectilePrototype,
  definition: HarthmereProjectileVisualDefinition
) {
  const scene = prototype.scene.clone(true);
  const materials: THREE.Material[] = [];
  scene.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const cloneMaterial = (source: THREE.Material) => {
      const material = source.clone();
      const color = shapeMaterialColor(material.name, definition);
      if (
        material instanceof THREE.MeshStandardMaterial ||
        material instanceof THREE.MeshPhysicalMaterial
      ) {
        material.color.copy(color);
        material.emissive.copy(color);
        material.emissiveIntensity = material.name
          .toLowerCase()
          .includes("accent")
          ? 2.6
          : 1.45;
        material.roughness = Math.min(material.roughness, 0.3);
      } else if (material instanceof THREE.MeshBasicMaterial) {
        material.color.copy(color);
      }
      material.transparent = true;
      material.depthWrite = false;
      material.blending = THREE.AdditiveBlending;
      material.toneMapped = false;
      materials.push(material);
      return material;
    };
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(cloneMaterial)
      : cloneMaterial(mesh.material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 26;
  });
  return { scene, materials };
}

function makeAttackShapeLoadingSilhouette(
  shape: HarthmereBossAreaAttackShape,
  definition: HarthmereProjectileVisualDefinition
) {
  const group = new THREE.Group();
  group.name = `harthmere-boss-shape-loading-${shape}-${definition.id}`;
  const primary = effectMaterial(definition.primaryColor, 0.72);
  const secondary = effectMaterial(definition.secondaryColor, 0.9);
  if (shape === "beam") {
    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.065, 1, 8),
      secondary
    );
    core.rotation.x = Math.PI / 2;
    core.position.z = 0.5;
    group.add(core);
  } else if (shape === "cone") {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.62, 1, 12, 1, true),
      primary
    );
    cone.rotation.x = Math.PI / 2;
    cone.position.z = 0.5;
    group.add(cone);
  } else {
    const ringCount = shape === "self_aoe" ? 3 : 4;
    for (let index = 0; index < ringCount; index += 1) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(
          (index + 1) / ringCount,
          index === ringCount - 1 ? 0.025 : 0.014,
          4,
          24
        ),
        index % 2 ? primary : secondary
      );
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
    }
  }
  return group;
}

function setEffectOpacity(material: THREE.Material, opacity: number) {
  const transparent = material as THREE.Material & { opacity?: number };
  if (transparent.opacity !== undefined) {
    transparent.opacity = opacity;
  }
}

function makeLoadingSilhouette(
  definition: HarthmereProjectileVisualDefinition
) {
  const group = new THREE.Group();
  group.name = `harthmere-premium-projectile-loading-${definition.id}`;
  if (definition.family === "physical") {
    const shaft = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.06, 1.1),
      effectMaterial(definition.primaryColor, 0.85, THREE.NormalBlending)
    );
    const head = new THREE.Mesh(
      new THREE.ConeGeometry(0.13, 0.34, 4),
      effectMaterial(definition.secondaryColor, 0.95)
    );
    head.rotation.x = Math.PI / 2;
    head.position.z = 0.71;
    group.add(shaft, head);
  } else {
    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.22, 0),
      effectMaterial(definition.primaryColor, 0.95)
    );
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.025, 4, 12),
      effectMaterial(definition.secondaryColor, 0.8)
    );
    ring.rotation.x = Math.PI / 2;
    group.add(core, ring);
  }
  group.scale.setScalar(definition.scale);
  return group;
}

function trailProfile(definition: HarthmereProjectileVisualDefinition) {
  const fast = definition.speed >= 40;
  const physical = definition.family === "physical";
  const boss = definition.family === "boss";
  const meteor = definition.id === "meteor";
  const lifetime = meteor ? 0.42 : boss ? 0.36 : physical ? 0.17 : 0.27;
  const interval = fast ? 0.012 : physical ? 0.018 : 0.016;
  return {
    interval,
    lifetime,
    width: meteor
      ? 0.21
      : boss
        ? 0.16
        : physical
          ? 0.048
          : definition.family === "sonic" || definition.family === "mark"
            ? 0.14
            : 0.095,
    length: fast ? 0.48 : physical ? 0.34 : meteor ? 0.52 : 0.24,
    maxSamples: THREE.MathUtils.clamp(Math.ceil(lifetime / interval), 9, 26),
  };
}

function trailGeometry(definition: HarthmereProjectileVisualDefinition) {
  if (definition.family === "fire") {
    return new THREE.TetrahedronGeometry(0.72, 0);
  }
  if (definition.family === "sonic" || definition.family === "mark") {
    return new THREE.TorusGeometry(0.58, 0.11, 4, 12);
  }
  if (definition.family === "nature") {
    const geometry = new THREE.ConeGeometry(0.5, 1, 4);
    geometry.rotateX(Math.PI / 2);
    return geometry;
  }
  if (
    ["arcane", "holy", "dark", "hex", "boss", "gravity"].includes(
      definition.family
    )
  ) {
    return new THREE.OctahedronGeometry(0.65, 0);
  }
  return new THREE.BoxGeometry(1, 1, 1);
}

function makeTrail(definition: HarthmereProjectileVisualDefinition) {
  const profile = trailProfile(definition);
  const geometry = trailGeometry(definition);
  const material = effectMaterial(
    definition.family === "physical"
      ? definition.primaryColor
      : definition.family === "fire" || definition.family === "holy"
        ? definition.primaryColor
        : definition.secondaryColor,
    definition.family === "physical" ? 0.42 : 0.64,
    definition.id === "bandit_archer_shot"
      ? THREE.NormalBlending
      : THREE.AdditiveBlending
  );
  const mesh = new THREE.InstancedMesh(geometry, material, profile.maxSamples);
  mesh.name = `harthmere-premium-trail-${definition.id}`;
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.renderOrder = 24;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  return {
    mesh,
    geometry,
    material,
    samples: [],
    accumulator: 0,
    ...profile,
  } satisfies PremiumTrail;
}

function trailDrift(
  definition: HarthmereProjectileVisualDefinition,
  sample: TrailSample
) {
  const offset = new THREE.Vector3();
  if (definition.family === "fire") {
    offset.y = sample.age * 0.55;
  } else if (definition.family === "lightning") {
    offset.set(
      Math.sin(sample.seed * 2.3) * 0.07,
      Math.cos(sample.seed * 1.7) * 0.07,
      0
    );
  } else if (definition.family === "nature") {
    offset.x = Math.sin(sample.seed + sample.age * 10) * 0.055;
    offset.y = sample.age * 0.18;
  } else if (definition.family === "sonic") {
    offset.x = Math.sin(sample.seed + sample.age * 14) * 0.09;
    offset.y = Math.cos(sample.seed + sample.age * 14) * 0.09;
  } else if (definition.family === "dark" || definition.family === "hex") {
    offset.y = Math.sin(sample.seed + sample.age * 8) * 0.06;
    offset.x = Math.cos(sample.seed * 0.7 + sample.age * 7) * 0.035;
  } else if (definition.family === "holy") {
    offset.y = sample.age * 0.24;
  } else if (definition.family === "arcane") {
    offset.x = Math.sin(sample.seed + sample.age * 9) * 0.04;
    offset.y = Math.cos(sample.seed * 1.2 + sample.age * 9) * 0.04;
  } else if (definition.family === "gravity") {
    offset.multiplyScalar(Math.max(0, 1 - sample.age / 0.3));
  }
  return offset;
}

function updateTrail(
  trail: PremiumTrail,
  definition: HarthmereProjectileVisualDefinition,
  position: THREE.Vector3,
  direction: THREE.Vector3,
  dt: number,
  elapsed: number,
  visualScale = 1
) {
  trail.accumulator += dt;
  while (trail.accumulator >= trail.interval) {
    trail.accumulator -= trail.interval;
    trail.samples.unshift({
      position: position.clone(),
      direction: direction.clone(),
      age: 0,
      seed: elapsed * 19.17 + trail.samples.length * 1.31,
    });
  }
  for (const sample of trail.samples) sample.age += dt;
  trail.samples = trail.samples
    .filter((sample) => sample.age < trail.lifetime)
    .slice(0, trail.maxSamples);

  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  for (let index = 0; index < trail.samples.length; index += 1) {
    const sample = trail.samples[index];
    const fade = Math.max(0.03, 1 - sample.age / trail.lifetime);
    const samplePosition = sample.position
      .clone()
      .add(trailDrift(definition, sample));
    rotation.setFromUnitVectors(FORWARD, sample.direction);
    const width = trail.width * fade * visualScale;
    scale.set(width, width, trail.length * fade * visualScale);
    matrix.compose(samplePosition, rotation, scale);
    trail.mesh.setMatrixAt(index, matrix);
  }
  trail.mesh.count = trail.samples.length;
  trail.mesh.instanceMatrix.needsUpdate = true;
}

function impactMaterials(definition: HarthmereProjectileVisualDefinition) {
  const physical = definition.family === "physical";
  return [
    effectMaterial(
      definition.primaryColor,
      0.95,
      physical ? THREE.NormalBlending : THREE.AdditiveBlending
    ),
    effectMaterial(definition.secondaryColor, 0.86),
    effectMaterial(
      new THREE.Color(definition.secondaryColor).multiplyScalar(0.24).getHex(),
      0.62,
      THREE.NormalBlending
    ),
  ];
}

function addImpactRing(
  group: THREE.Group,
  material: THREE.Material,
  radius: number,
  rotation: THREE.Euler
) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, Math.max(0.018, radius * 0.09), 4, 18),
    material
  );
  ring.rotation.copy(rotation);
  group.add(ring);
  return ring;
}

function addImpactPart(
  group: THREE.Group,
  parts: ImpactPart[],
  object: THREE.Object3D,
  velocity: THREE.Vector3,
  spin: THREE.Vector3
) {
  group.add(object);
  parts.push({ object, velocity, spin });
}

function makePremiumImpact(
  definition: HarthmereProjectileVisualDefinition,
  position: THREE.Vector3,
  phase: "launch" | "impact",
  result?: string,
  addLight = true
) {
  const group = new THREE.Group();
  group.name = `harthmere-premium-${phase}-${definition.id}`;
  group.position.copy(position);
  const missed = /miss|dodge|evade|out_of_range/.test(result ?? "");
  const smokeLike = definition.id === "smoke_bomb_throw";
  const physical = definition.family === "physical";
  const energyLike = definition.family === "energy";
  const materials = impactMaterials(definition);
  const parts: ImpactPart[] = [];
  const radius =
    phase === "launch"
      ? Math.max(0.16, definition.impactRadius * 0.2)
      : definition.impactRadius;

  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(phase === "launch" ? 0.08 : 0.16, 0),
    materials[0]
  );
  group.add(core);

  const ringCount = smokeLike
    ? phase === "impact"
      ? 2
      : 0
    : physical
      ? phase === "impact"
        ? 1
        : 0
      : energyLike
        ? 2
        : definition.family === "sonic" || definition.family === "boss"
          ? 3
          : definition.family === "holy" || definition.id === "consecrate"
            ? 2
            : 1;
  for (let index = 0; index < ringCount; index += 1) {
    addImpactRing(
      group,
      materials[index % 2],
      0.25 + index * 0.15,
      new THREE.Euler(Math.PI / 2, index * 0.35, index * 0.42)
    );
  }

  const count =
    phase === "launch"
      ? 5
      : smokeLike
        ? 12
        : energyLike
          ? 14
          : definition.id === "meteor"
            ? 18
            : definition.family === "boss"
              ? 16
              : 10;
  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / count;
    const direction = new THREE.Vector3(
      Math.cos(angle),
      smokeLike
        ? 0.35 + (index % 4) * 0.18
        : definition.family === "holy"
          ? 0.4 + (index % 3) * 0.18
          : definition.family === "fire"
            ? 0.22 + (index % 4) * 0.12
            : definition.family === "lightning"
              ? (index % 3) * 0.3 - 0.25
              : Math.sin(index * 1.9) * 0.16,
      Math.sin(angle)
    ).normalize();
    const rootLike = definition.family === "nature";
    const boltLike = definition.family === "lightning";
    const geometry = smokeLike
      ? new THREE.DodecahedronGeometry(0.16 + (index % 3) * 0.035, 0)
      : energyLike
        ? new THREE.OctahedronGeometry(0.11, 0)
        : rootLike
          ? new THREE.ConeGeometry(0.045, 0.48, 4)
          : boltLike
            ? new THREE.BoxGeometry(0.035, 0.035, 0.5)
            : new THREE.BoxGeometry(
                definition.family === "physical" ? 0.055 : 0.075,
                definition.family === "physical" ? 0.055 : 0.075,
                definition.family === "physical" ? 0.32 : 0.22
              );
    const shard = new THREE.Mesh(
      geometry,
      materials[
        smokeLike
          ? 2
          : definition.family === "fire" && index % 4 === 3
            ? 2
            : index % 2
      ]
    );
    shard.position.copy(direction).multiplyScalar(0.18 + (index % 3) * 0.05);
    shard.quaternion.setFromUnitVectors(FORWARD, direction);
    addImpactPart(
      group,
      parts,
      shard,
      direction.multiplyScalar(
        phase === "launch"
          ? 0.7
          : smokeLike
            ? 0.55 + (index % 3) * 0.16
            : energyLike
              ? 2.8
              : definition.id === "meteor"
                ? 3.8
                : definition.family === "boss"
                  ? 3.0
                  : 2.0
      ),
      new THREE.Vector3(2 + (index % 3), 2.6 + (index % 4), 1.4)
    );
  }

  const light = addLight
    ? new THREE.PointLight(
        definition.primaryColor,
        missed ? definition.lightIntensity * 0.35 : definition.lightIntensity,
        Math.max(2.5, radius * 4.5),
        2
      )
    : undefined;
  if (light) group.add(light);
  const duration =
    phase === "launch"
      ? 0.14
      : smokeLike
        ? 1.2
        : energyLike
          ? THREE.MathUtils.clamp(0.42 + radius * 0.1, 0.48, 0.82)
          : definition.id === "consecrate"
            ? 1.0
            : definition.id === "meteor" || definition.family === "boss"
              ? 0.82
              : THREE.MathUtils.clamp(0.3 + radius * 0.08, 0.34, 0.62);
  return {
    kind: "basic",
    group,
    materials,
    parts,
    light,
    elapsed: 0,
    framesRendered: 0,
    duration: missed ? Math.min(duration, 0.24) : duration,
    radius,
  } satisfies BasicImpact;
}

function impactNoise(seed: number, index: number, salt: number) {
  const value = Math.sin(
    (seed + 1) * 12.9898 + (index + 1) * 78.233 + salt * 37.719
  );
  return value - Math.floor(value);
}

function impactDirection(seed: number, index: number, salt: number) {
  const azimuth = impactNoise(seed, index, salt) * Math.PI * 2;
  const y = impactNoise(seed, index, salt + 1) * 1.45 - 0.35;
  const horizontal = Math.sqrt(Math.max(0.05, 1 - Math.min(0.95, y * y)));
  return new THREE.Vector3(
    Math.cos(azimuth) * horizontal,
    y,
    Math.sin(azimuth) * horizontal
  ).normalize();
}

function magicMistColor(definition: HarthmereProjectileVisualDefinition) {
  const primary = new THREE.Color(definition.primaryColor);
  switch (definition.family) {
    case "fire":
      return primary.lerp(new THREE.Color(0x24120f), 0.72).getHex();
    case "lightning":
      return primary.lerp(new THREE.Color(0xd8f7ff), 0.55).getHex();
    case "holy":
      return primary.lerp(new THREE.Color(0xfff4c2), 0.5).getHex();
    case "nature":
      return primary.lerp(new THREE.Color(0x17351f), 0.55).getHex();
    case "dark":
    case "hex":
    case "gravity":
    case "boss":
      return primary.lerp(new THREE.Color(0x100c1d), 0.62).getHex();
    default:
      return primary.lerp(new THREE.Color(0x251a38), 0.38).getHex();
  }
}

function addMagicImpactLayer(
  group: THREE.Group,
  object: THREE.Object3D,
  material: THREE.MeshBasicMaterial,
  input: Omit<MagicImpactLayer, "object" | "material" | "shapeScale"> & {
    shapeScale?: THREE.Vector3;
  }
) {
  object.visible = false;
  object.scale.setScalar(0.001);
  object.renderOrder = 31;
  group.add(object);
  return {
    object,
    material,
    ...input,
    shapeScale: input.shapeScale?.clone() ?? new THREE.Vector3(1, 1, 1),
  } satisfies MagicImpactLayer;
}

function makeMagicImpactBatch(input: {
  group: THREE.Group;
  kind: MagicImpactParticleBatch["kind"];
  geometry: THREE.BufferGeometry;
  particles: MagicImpactParticle[];
  colors: number[];
  opacity: number;
  blending?: THREE.Blending;
}) {
  const material = effectMaterial(
    0xffffff,
    input.opacity,
    input.blending ?? THREE.AdditiveBlending
  );
  material.depthWrite = false;
  const mesh = new THREE.InstancedMesh(
    input.geometry,
    material,
    input.particles.length
  );
  mesh.name = `magic-impact-${input.kind}`;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.renderOrder = input.kind === "mist" || input.kind === "dust" ? 29 : 32;
  for (let index = 0; index < input.particles.length; index += 1) {
    mesh.setColorAt(
      index,
      new THREE.Color(input.colors[index % input.colors.length])
    );
    MAGIC_IMPACT_MATRIX.compose(
      input.particles[index].initialPosition,
      input.particles[index].initialQuaternion,
      MAGIC_IMPACT_SCALE.setScalar(0.001)
    );
    mesh.setMatrixAt(index, MAGIC_IMPACT_MATRIX);
  }
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.instanceMatrix.needsUpdate = true;
  input.group.add(mesh);
  return {
    kind: input.kind,
    mesh,
    material,
    particles: input.particles,
    initialOpacity: input.opacity,
  } satisfies MagicImpactParticleBatch;
}

function debrisParticles(input: {
  profile: HarthmereMagicImpactProfile;
  direction: THREE.Vector3;
  seed: number;
}) {
  const particles: MagicImpactParticle[] = [];
  for (let index = 0; index < input.profile.debrisCount; index += 1) {
    const radial = impactDirection(input.seed, index, 11);
    radial.y += input.profile.upwardBias;
    radial.addScaledVector(input.direction, input.profile.directionalBias);
    radial.normalize();
    const speed =
      input.profile.debrisSpeed *
      (0.62 + impactNoise(input.seed, index, 12) * 0.68);
    const size = THREE.MathUtils.clamp(
      input.profile.radius *
        (0.038 + impactNoise(input.seed, index, 13) * 0.035),
      0.045,
      0.32
    );
    particles.push({
      initialPosition: radial
        .clone()
        .multiplyScalar(input.profile.radius * 0.08),
      velocity: radial.multiplyScalar(speed),
      initialQuaternion: new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
          impactNoise(input.seed, index, 14) * Math.PI,
          impactNoise(input.seed, index, 15) * Math.PI,
          impactNoise(input.seed, index, 16) * Math.PI
        )
      ),
      spin: new THREE.Vector3(
        3 + impactNoise(input.seed, index, 17) * 6,
        2 + impactNoise(input.seed, index, 18) * 7,
        3 + impactNoise(input.seed, index, 19) * 5
      ),
      baseScale: new THREE.Vector3(
        size * (0.65 + impactNoise(input.seed, index, 20) * 0.7),
        size * (0.65 + impactNoise(input.seed, index, 21) * 0.7),
        size * (1 + impactNoise(input.seed, index, 22) * 1.4)
      ),
      delay: impactNoise(input.seed, index, 23) * 0.055,
      lifetime:
        input.profile.durationSecs *
        (0.46 + impactNoise(input.seed, index, 24) * 0.3),
      gravity: input.profile.gravity,
      drag: 0.55 + impactNoise(input.seed, index, 25) * 0.45,
    });
  }
  return particles;
}

function sparkParticles(input: {
  profile: HarthmereMagicImpactProfile;
  direction: THREE.Vector3;
  seed: number;
}) {
  const particles: MagicImpactParticle[] = [];
  for (let index = 0; index < input.profile.sparkCount; index += 1) {
    const radial = impactDirection(input.seed, index, 31);
    if (input.profile.family === "holy") radial.y = Math.abs(radial.y) + 0.25;
    radial.addScaledVector(
      input.direction,
      input.profile.directionalBias * 0.72
    );
    radial.normalize();
    const speed =
      input.profile.sparkSpeed *
      (0.68 + impactNoise(input.seed, index, 32) * 0.62);
    const width = THREE.MathUtils.clamp(
      input.profile.radius * 0.012,
      0.018,
      0.075
    );
    const length = THREE.MathUtils.clamp(
      input.profile.radius * (0.13 + impactNoise(input.seed, index, 33) * 0.13),
      0.18,
      1.25
    );
    particles.push({
      initialPosition: radial
        .clone()
        .multiplyScalar(input.profile.radius * 0.05),
      velocity: radial.clone().multiplyScalar(speed),
      initialQuaternion: new THREE.Quaternion().setFromUnitVectors(
        FORWARD,
        radial
      ),
      spin: new THREE.Vector3(
        impactNoise(input.seed, index, 34) * 2,
        impactNoise(input.seed, index, 35) * 2,
        4 + impactNoise(input.seed, index, 36) * 8
      ),
      baseScale: new THREE.Vector3(width, width, length),
      delay: impactNoise(input.seed, index, 37) * 0.075,
      lifetime: 0.28 + impactNoise(input.seed, index, 38) * 0.3,
      gravity:
        input.profile.family === "lightning"
          ? 0.2
          : input.profile.gravity * 0.2,
      drag: 0.35 + impactNoise(input.seed, index, 39) * 0.35,
    });
  }
  return particles;
}

function mistParticles(input: {
  profile: HarthmereMagicImpactProfile;
  seed: number;
}) {
  const particles: MagicImpactParticle[] = [];
  for (let index = 0; index < input.profile.mistCount; index += 1) {
    const radial = impactDirection(input.seed, index, 51);
    radial.y = Math.abs(radial.y) * 0.35;
    const size = THREE.MathUtils.clamp(
      input.profile.radius * (0.1 + impactNoise(input.seed, index, 52) * 0.08),
      0.16,
      0.85
    );
    particles.push({
      initialPosition: radial
        .clone()
        .multiplyScalar(input.profile.radius * 0.18),
      velocity: new THREE.Vector3(
        radial.x * (0.35 + impactNoise(input.seed, index, 53) * 0.45),
        0.35 + impactNoise(input.seed, index, 54) * 0.7,
        radial.z * (0.35 + impactNoise(input.seed, index, 55) * 0.45)
      ),
      initialQuaternion: new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, impactNoise(input.seed, index, 56) * Math.PI, 0)
      ),
      spin: new THREE.Vector3(
        0.2,
        (impactNoise(input.seed, index, 57) - 0.5) * 1.4,
        0.15
      ),
      baseScale: new THREE.Vector3(
        size * (0.8 + impactNoise(input.seed, index, 58) * 0.6),
        size * (0.7 + impactNoise(input.seed, index, 59) * 0.6),
        size * (0.8 + impactNoise(input.seed, index, 60) * 0.6)
      ),
      delay: 0.1 + impactNoise(input.seed, index, 61) * 0.18,
      lifetime:
        input.profile.durationSecs *
        (0.64 + impactNoise(input.seed, index, 62) * 0.28),
      gravity: -0.28,
      drag: 0.9,
    });
  }
  return particles;
}

function dustParticles(input: {
  profile: HarthmereMagicImpactProfile;
  seed: number;
  groundOffsetY: number;
}) {
  const particles: MagicImpactParticle[] = [];
  for (let index = 0; index < input.profile.dustCount; index += 1) {
    const angle =
      (index / input.profile.dustCount) * Math.PI * 2 +
      impactNoise(input.seed, index, 71) * 0.55;
    const radial = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const size = THREE.MathUtils.clamp(
      input.profile.radius *
        (0.07 + impactNoise(input.seed, index, 72) * 0.055),
      0.12,
      0.62
    );
    particles.push({
      initialPosition: radial
        .clone()
        .multiplyScalar(input.profile.radius * 0.12)
        .setY(input.groundOffsetY),
      velocity: new THREE.Vector3(
        radial.x * (0.8 + impactNoise(input.seed, index, 73) * 1.2),
        0.12 + impactNoise(input.seed, index, 74) * 0.32,
        radial.z * (0.8 + impactNoise(input.seed, index, 75) * 1.2)
      ),
      initialQuaternion: new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, angle, 0)
      ),
      spin: new THREE.Vector3(0, (index % 2 ? -1 : 1) * 0.7, 0),
      baseScale: new THREE.Vector3(size * 1.65, size * 0.42, size),
      delay: 0.035 + impactNoise(input.seed, index, 76) * 0.12,
      lifetime: 0.58 + impactNoise(input.seed, index, 77) * 0.42,
      gravity: 0.65,
      drag: 1.15,
    });
  }
  return particles;
}

function addSignatureMagicImpactLayers(input: {
  group: THREE.Group;
  layers: MagicImpactLayer[];
  profile: HarthmereMagicImpactProfile;
  definition: HarthmereProjectileVisualDefinition;
  groundOffsetY: number;
  direction: THREE.Vector3;
}) {
  const { group, layers, profile, definition } = input;
  const add = (
    object: THREE.Object3D,
    color: number,
    options: Omit<MagicImpactLayer, "object" | "material" | "shapeScale"> & {
      shapeScale?: THREE.Vector3;
    }
  ) => {
    const material = effectMaterial(color, options.initialOpacity);
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh) {
      const previous = mesh.material;
      if (Array.isArray(previous)) previous.forEach((entry) => entry.dispose());
      else previous.dispose();
      mesh.material = material;
    }
    layers.push(addMagicImpactLayer(group, object, material, options));
  };

  if (profile.silhouette === "eruption") {
    for (let index = 0; index < 3; index += 1) {
      const angle = (index / 3) * Math.PI * 2 + 0.35;
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.18, 0.9, 5),
        effectMaterial(0xffffff)
      );
      flame.position.set(
        Math.cos(angle) * profile.radius * 0.09,
        input.groundOffsetY + profile.radius * 0.12,
        Math.sin(angle) * profile.radius * 0.09
      );
      add(
        flame,
        index === 1 ? definition.primaryColor : definition.secondaryColor,
        {
          start: 0.025 + index * 0.018,
          end: Math.min(0.72, profile.durationSecs * 0.48),
          startScale: 0.08,
          endScale: profile.radius * (1.15 + index * 0.13),
          initialOpacity: 0.8 - index * 0.08,
          fadePower: 1.7,
          rotationSpeed: new THREE.Vector3(0, index % 2 ? -2.2 : 2.4, 0),
          rise: profile.radius * (0.22 + index * 0.05),
          shapeScale: new THREE.Vector3(0.72, 1.5, 0.72),
        }
      );
    }
    return;
  }

  if (profile.silhouette === "crackle") {
    for (let index = 0; index < 6; index += 1) {
      const angle = (index / 6) * Math.PI * 2 + index * 0.17;
      const radial = new THREE.Vector3(
        Math.cos(angle),
        index % 2 ? 0.28 : -0.12,
        Math.sin(angle)
      ).normalize();
      const bolt = new THREE.Mesh(
        new THREE.BoxGeometry(0.045, 0.045, 0.82),
        effectMaterial(0xffffff)
      );
      bolt.quaternion.setFromUnitVectors(FORWARD, radial);
      bolt.position.copy(radial).multiplyScalar(profile.radius * 0.12);
      add(bolt, index % 2 ? definition.primaryColor : 0xffffff, {
        start: 0.018 + index * 0.008,
        end: 0.34 + (index % 3) * 0.04,
        startScale: 0.15,
        endScale: profile.radius * (1.25 + (index % 2) * 0.22),
        initialOpacity: 0.92,
        fadePower: 2.4,
        rotationSpeed: new THREE.Vector3(0, 0, index % 2 ? -2.4 : 2.8),
        rise: 0,
      });
    }
    return;
  }

  if (profile.silhouette === "pillar") {
    add(
      new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.34, 1, 8),
        effectMaterial(0xffffff)
      ),
      definition.primaryColor,
      {
        start: 0.018,
        end: Math.min(0.86, profile.durationSecs * 0.58),
        startScale: 0.12,
        endScale: profile.radius * 1.6,
        initialOpacity: 0.76,
        fadePower: 1.9,
        rotationSpeed: new THREE.Vector3(0, 1.4, 0),
        rise: profile.radius * 0.12,
        shapeScale: new THREE.Vector3(0.62, 1.9, 0.62),
      }
    );
    return;
  }

  if (profile.silhouette === "root_burst") {
    for (let index = 0; index < 8; index += 1) {
      const angle = (index / 8) * Math.PI * 2;
      const radial = new THREE.Vector3(
        Math.cos(angle),
        0.22 + (index % 2) * 0.14,
        Math.sin(angle)
      ).normalize();
      const root = new THREE.Mesh(
        new THREE.ConeGeometry(0.085, 0.7, 4),
        effectMaterial(0xffffff)
      );
      root.quaternion.setFromUnitVectors(UP, radial);
      root.position
        .copy(radial)
        .multiplyScalar(profile.radius * 0.12)
        .setY(input.groundOffsetY + profile.radius * 0.04);
      add(
        root,
        index % 3 ? definition.primaryColor : definition.secondaryColor,
        {
          start: 0.04 + index * 0.012,
          end: 0.58 + (index % 2) * 0.08,
          startScale: 0.08,
          endScale: profile.radius * (1.05 + (index % 3) * 0.1),
          initialOpacity: 0.76,
          fadePower: 1.8,
          rotationSpeed: new THREE.Vector3(0, 0.35 * (index % 2 ? -1 : 1), 0),
          rise: 0,
          shapeScale: new THREE.Vector3(0.72, 1.25, 0.72),
        }
      );
    }
    return;
  }

  if (profile.silhouette === "reticle") {
    for (let index = 0; index < 4; index += 1) {
      const angle = (index / 4) * Math.PI * 2;
      const tick = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.045, 0.07),
        effectMaterial(0xffffff)
      );
      tick.position.set(
        Math.cos(angle) * profile.radius * 0.24,
        input.groundOffsetY + 0.05,
        Math.sin(angle) * profile.radius * 0.24
      );
      tick.rotation.y = -angle;
      add(
        tick,
        index % 2 ? definition.primaryColor : definition.secondaryColor,
        {
          start: 0.035 + index * 0.014,
          end: 0.62,
          startScale: 0.12,
          endScale: profile.radius * 1.4,
          initialOpacity: 0.84,
          fadePower: 1.8,
          rotationSpeed: new THREE.Vector3(0, index % 2 ? -0.9 : 0.9, 0),
          rise: 0,
        }
      );
    }
    return;
  }

  if (profile.silhouette === "smoke_bloom") {
    for (let index = 0; index < 5; index += 1) {
      const angle = (index / 5) * Math.PI * 2 + 0.25;
      const cloud = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.24 + (index % 2) * 0.06, 0),
        effectMaterial(0xffffff)
      );
      cloud.position.set(
        Math.cos(angle) * profile.radius * 0.14,
        input.groundOffsetY + profile.radius * (0.08 + (index % 3) * 0.05),
        Math.sin(angle) * profile.radius * 0.14
      );
      add(
        cloud,
        index % 2 ? definition.secondaryColor : definition.primaryColor,
        {
          start: 0.035 + index * 0.028,
          end: Math.min(1.05, profile.durationSecs * 0.82),
          startScale: 0.08,
          endScale: profile.radius * (1.5 + (index % 3) * 0.18),
          initialOpacity: 0.48 - (index % 2) * 0.08,
          fadePower: 1.15,
          rotationSpeed: new THREE.Vector3(
            0.18 * (index % 2 ? -1 : 1),
            0.65 * (index % 2 ? -1 : 1),
            0.12
          ),
          rise: profile.radius * (0.18 + (index % 2) * 0.07),
          shapeScale: new THREE.Vector3(1.45, 0.7, 1.45),
        }
      );
    }
    return;
  }

  if (
    profile.silhouette === "implosion" ||
    profile.silhouette === "singularity"
  ) {
    const aperture = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.055, 6, 32),
      effectMaterial(0xffffff)
    );
    aperture.rotation.x = Math.PI / 2;
    aperture.position.y = input.groundOffsetY + profile.radius * 0.08;
    add(aperture, definition.secondaryColor, {
      start: 0.03,
      end: Math.min(0.9, profile.durationSecs * 0.62),
      startScale: profile.radius * (3.2 + profile.power * 0.8),
      endScale: profile.radius * 0.18,
      initialOpacity: 0.9,
      fadePower: 1.35,
      rotationSpeed: new THREE.Vector3(
        0.25,
        profile.silhouette === "singularity" ? 3.8 : 2.1,
        -0.3
      ),
      rise: profile.silhouette === "singularity" ? -profile.radius * 0.04 : 0,
      shapeScale: new THREE.Vector3(1.25, 0.55, 1.25),
    });
    return;
  }

  if (profile.silhouette === "cataclysm") {
    for (let index = 0; index < 8; index += 1) {
      const radial = impactDirection(97, index, 401);
      radial.y = Math.abs(radial.y) + 0.18;
      radial.normalize();
      const spike = new THREE.Mesh(
        new THREE.ConeGeometry(0.075, 0.78, 4),
        effectMaterial(0xffffff)
      );
      spike.quaternion.setFromUnitVectors(UP, radial);
      add(
        spike,
        index % 2 ? definition.primaryColor : definition.secondaryColor,
        {
          start: 0.02 + index * 0.009,
          end: 0.68,
          startScale: 0.08,
          endScale: profile.radius * 1.45,
          initialOpacity: 0.82,
          fadePower: 1.8,
          rotationSpeed: new THREE.Vector3(
            index * 0.12,
            -index * 0.1,
            index * 0.08
          ),
          rise: profile.radius * 0.04,
        }
      );
    }
  }
}

function makeAaaMagicImpact(input: {
  definition: HarthmereProjectileVisualDefinition;
  position: THREE.Vector3;
  direction: THREE.Vector3;
  targetGround?: THREE.Vector3;
  result?: string;
  finalDamage?: number;
  damageType?: string;
  impactRadius?: number;
  seed: number;
  addLight: boolean;
}) {
  const profile = harthmereMagicImpactProfile({
    projectileVisualId: input.definition.id,
    family: input.definition.family,
    damageType: input.damageType,
    result: input.result,
    impactRadius: input.impactRadius ?? input.definition.impactRadius,
    lightIntensity: input.definition.lightIntensity,
    finalDamage: input.finalDamage,
  });
  if (!profile) return undefined;

  const group = new THREE.Group();
  group.name = `harthmere-aaa-magic-impact-${input.definition.id}`;
  group.position.copy(input.position);
  const direction = input.direction.clone();
  if (direction.lengthSq() < 0.0001) direction.copy(UP);
  direction.normalize();
  const groundOffsetY = input.targetGround
    ? input.targetGround.y - input.position.y + 0.04
    : -Math.min(0.55, profile.radius * 0.28);
  const layers: MagicImpactLayer[] = [];

  const flashMaterial = effectMaterial(0xffffff, 1);
  layers.push(
    addMagicImpactLayer(
      group,
      new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 1), flashMaterial),
      flashMaterial,
      {
        start: 0,
        end: profile.flashDurationSecs,
        startScale: 0.12,
        endScale: profile.radius * 4.4,
        initialOpacity: 1,
        fadePower: 1.8,
        rotationSpeed: new THREE.Vector3(8, 11, 5),
        rise: 0,
      }
    )
  );

  const coreMaterial = effectMaterial(
    new THREE.Color(input.definition.primaryColor)
      .lerp(new THREE.Color(0xffffff), 0.34)
      .getHex(),
    0.96
  );
  const coreShapeScale = new THREE.Vector3(...profile.coreStretch);
  const coreStartScale = profile.implosion
    ? profile.radius * (2.4 + profile.power * 0.65)
    : 0.2;
  const coreEndScale = profile.implosion ? 0.12 : profile.radius * 2.35;
  layers.push(
    addMagicImpactLayer(
      group,
      new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1), coreMaterial),
      coreMaterial,
      {
        start: 0.012,
        end: Math.min(0.58, profile.durationSecs * 0.4),
        startScale: coreStartScale,
        endScale: coreEndScale,
        initialOpacity: 0.96,
        fadePower: 1.15,
        rotationSpeed: new THREE.Vector3(3.2, 5.4, -2.2),
        rise: profile.family === "fire" ? profile.radius * 0.16 : 0,
        shapeScale: coreShapeScale,
      }
    )
  );

  const shellMaterial = effectMaterial(input.definition.secondaryColor, 0.62);
  shellMaterial.wireframe = true;
  layers.push(
    addMagicImpactLayer(
      group,
      new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), shellMaterial),
      shellMaterial,
      {
        start: 0.025,
        end: Math.min(0.72, profile.durationSecs * 0.48),
        startScale: profile.implosion ? profile.radius * 3.35 : 0.3,
        endScale: profile.implosion ? 0.18 : profile.radius * 2.9,
        initialOpacity:
          profile.silhouette === "wave" || profile.silhouette === "reticle"
            ? 0.42
            : 0.62,
        fadePower: 2.15,
        rotationSpeed: new THREE.Vector3(-2.4, 3.8, 1.8),
        rise: 0,
        shapeScale: coreShapeScale.clone().multiplyScalar(1.08),
      }
    )
  );

  for (let index = 0; index < profile.ringCount; index += 1) {
    const material = effectMaterial(
      index % 2
        ? input.definition.primaryColor
        : input.definition.secondaryColor,
      0.82 - index * 0.08
    );
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.025 + index * 0.006, 5, 32),
      material
    );
    const groundDominant = [
      "wave",
      "root_burst",
      "reticle",
      "singularity",
    ].includes(profile.silhouette);
    if (groundDominant) {
      ring.rotation.x = Math.PI / 2;
      ring.rotation.y = index * 0.32;
      ring.position.y = groundOffsetY + 0.035 + index * 0.018;
    } else if (profile.silhouette === "pillar") {
      ring.rotation.x = Math.PI / 2;
      ring.position.y = groundOffsetY + profile.radius * (0.08 + index * 0.13);
    } else if (profile.silhouette === "crackle") {
      ring.rotation.set(
        Math.PI / (2 + index * 0.3),
        index * 1.05,
        index * 0.66
      );
    } else if (index === 0) {
      ring.rotation.x = Math.PI / 2;
      ring.position.y = groundOffsetY + 0.04;
    } else if (index === 1) {
      ring.quaternion.setFromUnitVectors(FORWARD, direction);
    } else {
      ring.rotation.set(
        Math.PI / (2.4 + index * 0.2),
        index * 0.72,
        index * 0.48
      );
    }
    layers.push(
      addMagicImpactLayer(group, ring, material, {
        start: 0.028 + index * 0.026,
        end: Math.min(0.82, 0.46 + index * 0.09 + profile.power * 0.12),
        startScale: profile.implosion
          ? profile.radius * profile.ringSpread * (3.4 + index * 0.38)
          : 0.2,
        endScale: profile.implosion
          ? profile.radius * (0.14 + index * 0.04)
          : profile.radius *
            profile.ringSpread *
            (2.2 + index * (groundDominant ? 0.62 : 0.42)),
        initialOpacity: 0.82 - index * 0.08,
        fadePower: 1.65,
        rotationSpeed: new THREE.Vector3(
          index === 0 ? 0 : 0.45,
          index % 2 ? -1.3 : 1.1,
          index === 0 ? 0.4 : -0.7
        ),
        rise: index === 0 ? 0 : profile.radius * 0.03 * index,
      })
    );
  }

  addSignatureMagicImpactLayers({
    group,
    layers,
    profile,
    definition: input.definition,
    groundOffsetY,
    direction,
  });

  const debris = makeMagicImpactBatch({
    group,
    kind: "debris",
    geometry: new THREE.BoxGeometry(1, 1, 1),
    particles: debrisParticles({ profile, direction, seed: input.seed }),
    colors: [
      input.definition.primaryColor,
      input.definition.secondaryColor,
      new THREE.Color(input.definition.primaryColor)
        .lerp(new THREE.Color(0xffffff), 0.3)
        .getHex(),
    ],
    opacity: 0.94,
  });
  const sparks = makeMagicImpactBatch({
    group,
    kind: "sparks",
    geometry: new THREE.BoxGeometry(1, 1, 1),
    particles: sparkParticles({ profile, direction, seed: input.seed + 101 }),
    colors: [
      0xffffff,
      input.definition.secondaryColor,
      input.definition.primaryColor,
    ],
    opacity: 0.96,
  });
  const mist = makeMagicImpactBatch({
    group,
    kind: "mist",
    geometry: new THREE.BoxGeometry(1, 1, 1),
    particles: mistParticles({ profile, seed: input.seed + 211 }),
    colors: [
      magicMistColor(input.definition),
      new THREE.Color(input.definition.secondaryColor)
        .multiplyScalar(0.42)
        .getHex(),
    ],
    opacity: profile.family === "lightning" ? 0.32 : 0.5,
    blending:
      profile.family === "lightning"
        ? THREE.AdditiveBlending
        : THREE.NormalBlending,
  });
  const dust = makeMagicImpactBatch({
    group,
    kind: "dust",
    geometry: new THREE.BoxGeometry(1, 1, 1),
    particles: dustParticles({
      profile,
      seed: input.seed + 307,
      groundOffsetY,
    }),
    colors: [
      new THREE.Color(input.definition.primaryColor)
        .multiplyScalar(0.32)
        .getHex(),
      new THREE.Color(input.definition.secondaryColor)
        .multiplyScalar(0.28)
        .getHex(),
    ],
    opacity: 0.46,
    blending: THREE.NormalBlending,
  });

  const light = input.addLight
    ? new THREE.PointLight(
        input.definition.primaryColor,
        profile.lightIntensity,
        Math.max(5, profile.radius * 5.5),
        2
      )
    : undefined;
  if (light) {
    light.position.y = profile.radius * 0.12;
    group.add(light);
  }

  return {
    kind: "magic_explosion",
    projectileId: input.definition.id,
    family: input.definition.family,
    group,
    layers,
    batches: [debris, sparks, mist, dust],
    light,
    initialLightIntensity: profile.lightIntensity,
    elapsed: 0,
    framesRendered: 0,
    duration: profile.durationSecs,
    radius: profile.radius,
    profile,
  } satisfies MagicImpact;
}

function updateMagicImpactLayer(
  layer: MagicImpactLayer,
  elapsed: number,
  dt: number
) {
  if (elapsed < layer.start || elapsed > layer.end) {
    layer.object.visible = false;
    return;
  }
  layer.object.visible = true;
  const progress = THREE.MathUtils.clamp(
    (elapsed - layer.start) / Math.max(0.001, layer.end - layer.start),
    0,
    1
  );
  const easeOut = 1 - Math.pow(1 - progress, 3);
  layer.object.scale
    .copy(layer.shapeScale)
    .multiplyScalar(
      THREE.MathUtils.lerp(layer.startScale, layer.endScale, easeOut)
    );
  layer.object.position.y += layer.rise * dt;
  layer.object.rotation.x += layer.rotationSpeed.x * dt;
  layer.object.rotation.y += layer.rotationSpeed.y * dt;
  layer.object.rotation.z += layer.rotationSpeed.z * dt;
  layer.material.opacity =
    layer.initialOpacity * Math.pow(Math.max(0, 1 - progress), layer.fadePower);
}

function updateMagicImpactBatch(
  batch: MagicImpactParticleBatch,
  elapsed: number
) {
  let maximumOpacity = 0;
  for (let index = 0; index < batch.particles.length; index += 1) {
    const particle = batch.particles[index];
    const age = elapsed - particle.delay;
    if (age < 0 || age > particle.lifetime) {
      MAGIC_IMPACT_MATRIX.compose(
        particle.initialPosition,
        particle.initialQuaternion,
        MAGIC_IMPACT_SCALE.setScalar(0.001)
      );
      batch.mesh.setMatrixAt(index, MAGIC_IMPACT_MATRIX);
      continue;
    }
    const progress = THREE.MathUtils.clamp(age / particle.lifetime, 0, 1);
    const travel =
      particle.drag > 0.001
        ? (1 - Math.exp(-particle.drag * age)) / particle.drag
        : age;
    MAGIC_IMPACT_POSITION.copy(particle.initialPosition).addScaledVector(
      particle.velocity,
      travel
    );
    MAGIC_IMPACT_POSITION.y -= 0.5 * particle.gravity * age * age;
    MAGIC_IMPACT_SPIN_QUATERNION.setFromEuler(
      new THREE.Euler(
        particle.spin.x * age,
        particle.spin.y * age,
        particle.spin.z * age
      )
    );
    MAGIC_IMPACT_QUATERNION.copy(particle.initialQuaternion).multiply(
      MAGIC_IMPACT_SPIN_QUATERNION
    );
    const appear = THREE.MathUtils.smoothstep(progress, 0, 0.08);
    const disappear = 1 - THREE.MathUtils.smoothstep(progress, 0.58, 1);
    const expansion =
      batch.kind === "mist" || batch.kind === "dust"
        ? 1 + progress * (batch.kind === "mist" ? 1.15 : 0.48)
        : 1 - progress * (batch.kind === "sparks" ? 0.42 : 0.18);
    const scale = Math.max(0.001, appear * disappear * expansion);
    MAGIC_IMPACT_SCALE.copy(particle.baseScale).multiplyScalar(scale);
    MAGIC_IMPACT_MATRIX.compose(
      MAGIC_IMPACT_POSITION,
      MAGIC_IMPACT_QUATERNION,
      MAGIC_IMPACT_SCALE
    );
    batch.mesh.setMatrixAt(index, MAGIC_IMPACT_MATRIX);
    maximumOpacity = Math.max(maximumOpacity, disappear);
  }
  batch.material.opacity = batch.initialOpacity * maximumOpacity;
  batch.mesh.instanceMatrix.needsUpdate = true;
}

export class HarthmereProjectileVisualRuntime {
  private readonly prototypes = new Map<string, Promise<ProjectilePrototype>>();
  private readonly loadedPrototypeIds = new Set<string>();
  private readonly failedPrototypeIds = new Set<string>();
  private readonly shapePrototypes = new Map<
    HarthmereBossAreaAttackShape,
    Promise<ProjectilePrototype>
  >();
  private readonly active: ActiveProjectile[] = [];
  private readonly activeShapes: ActiveAttackShapeEffect[] = [];
  private readonly activeMagicCharges: ActiveMagicCharge[] = [];
  private readonly impacts: PremiumImpact[] = [];
  private nextSequence = 1;
  private spawnedCount = 0;
  private impactCount = 0;
  private magicChargeStartedCount = 0;
  private magicChargeReleasedCount = 0;
  private magicChargeCancelledCount = 0;
  private magicExplosionCount = 0;

  constructor(
    private readonly root: THREE.Object3D,
    private readonly loader: GLTFLoader,
    private readonly debug?: (
      event: string,
      payload: Record<string, unknown>
    ) => void,
    private readonly magicImpactFeedback?: (
      feedback: HarthmereMagicImpactFeedback
    ) => void
  ) {}

  /**
   * True while anything in this layer still needs to be drawn.
   *
   * HARTHMERE_COMBAT_VFX_ALWAYS_ON: the host renderer uses this to decide
   * whether to attach its root to the scene on frames where the town half of
   * the renderer has nothing to draw (production, where the runtime-asset gate
   * is off). Without it, combat VFX are spawned into a detached group.
   */
  hasActiveVisuals() {
    return (
      this.active.length > 0 ||
      this.activeShapes.length > 0 ||
      this.activeMagicCharges.length > 0 ||
      this.impacts.length > 0
    );
  }

  preloadAll() {
    for (const definition of HARTHMERE_PROJECTILE_VISUALS) {
      void this.load(definition);
    }
    for (const definition of HARTHMERE_BOSS_ATTACK_SHAPE_VISUALS) {
      void this.loadShape(definition);
    }
  }

  private load(definition: HarthmereProjectileVisualDefinition) {
    let pending = this.prototypes.get(definition.id);
    if (!pending) {
      pending = this.loader.loadAsync(definition.assetUrl).then(
        (gltf: GLTF) => {
          this.loadedPrototypeIds.add(definition.id);
          this.failedPrototypeIds.delete(definition.id);
          return {
            scene: gltf.scene,
            animations: gltf.animations,
          };
        },
        (error: unknown) => {
          this.prototypes.delete(definition.id);
          this.loadedPrototypeIds.delete(definition.id);
          this.failedPrototypeIds.add(definition.id);
          this.debug?.("renderer.projectile.asset_failed", {
            projectileId: definition.id,
            assetUrl: definition.assetUrl,
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }
      );
      this.prototypes.set(definition.id, pending);
    }
    return pending;
  }

  private loadShape(definition: HarthmereBossAttackShapeVisualDefinition) {
    let pending = this.shapePrototypes.get(definition.shape);
    if (!pending) {
      pending = this.loader.loadAsync(definition.assetUrl).then(
        (gltf: GLTF) => ({
          scene: gltf.scene,
          animations: gltf.animations,
        }),
        (error: unknown) => {
          this.shapePrototypes.delete(definition.shape);
          this.debug?.("renderer.boss_attack_shape.asset_failed", {
            attackShape: definition.shape,
            assetUrl: definition.assetUrl,
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }
      );
      this.shapePrototypes.set(definition.shape, pending);
    }
    return pending;
  }

  spawnMagicCharge(request: HarthmereMagicChargeSpawnRequest) {
    const definition = getHarthmereProjectileVisual(request.projectileId);
    if (
      !definition ||
      !Number.isFinite(request.duration) ||
      request.duration <= 0
    ) {
      return false;
    }
    if (this.activeMagicCharges.some(({ key }) => key === request.key)) {
      return true;
    }
    while (this.activeMagicCharges.length >= MAX_ACTIVE_MAGIC_CHARGES) {
      this.removeMagicCharge(this.activeMagicCharges.shift()!);
    }

    const group = new THREE.Group();
    group.name = `harthmere-magic-charge-${definition.id}-${this.nextSequence}`;
    group.position.copy(request.origin);

    const modelHost = new THREE.Group();
    modelHost.name = "authored-projectile-core";
    group.add(modelHost);

    const coreMaterial = effectMaterial(definition.primaryColor, 0.92);
    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.24, 2),
      coreMaterial
    );
    core.name = "magic-charge-core";
    group.add(core);

    const shellMaterial = effectMaterial(definition.secondaryColor, 0.38);
    shellMaterial.wireframe = true;
    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.5, 1),
      shellMaterial
    );
    shell.name = "magic-charge-shell";
    group.add(shell);

    const rings: THREE.Mesh[] = [];
    for (let index = 0; index < 3; index += 1) {
      const material = effectMaterial(
        index % 2 === 0 ? definition.primaryColor : definition.secondaryColor,
        0.58
      );
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.68 + index * 0.16, 0.022, 6, 32),
        material
      );
      ring.name = `magic-charge-ring-${index + 1}`;
      ring.rotation.set(
        index === 0 ? Math.PI / 2 : Math.PI / 3,
        index === 1 ? Math.PI / 2 : index * 0.55,
        index * 0.7
      );
      rings.push(ring);
      group.add(ring);
    }

    const particleMaterial = effectMaterial(definition.secondaryColor, 0.82);
    const particles = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.075, 0.075, 0.075),
      particleMaterial,
      MAGIC_CHARGE_PARTICLE_COUNT
    );
    particles.name = "magic-charge-voxel-particles";
    particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    particles.frustumCulled = false;
    group.add(particles);

    const light = new THREE.PointLight(definition.primaryColor, 0.8, 4.5, 2);
    group.add(light);
    this.root.add(group);

    const charge: ActiveMagicCharge = {
      sequence: this.nextSequence++,
      key: request.key,
      definition,
      group,
      modelHost,
      core,
      shell,
      rings,
      particles,
      elapsed: 0,
      framesRendered: 0,
      duration: request.duration,
      power: THREE.MathUtils.clamp(Number(request.power ?? 0), 0, 1),
      visualScale: THREE.MathUtils.clamp(
        Number(request.visualScale ?? 1),
        0.65,
        4
      ),
      origin: request.origin.clone(),
      modelAttached: false,
      light,
    };
    this.activeMagicCharges.push(charge);
    this.magicChargeStartedCount += 1;
    this.updateMagicChargeTransform(charge, 0);

    void this.load(definition)
      .then((prototype) => {
        if (!this.activeMagicCharges.includes(charge)) return;
        const scene = clonePremiumModel(prototype);
        scene.scale.setScalar(definition.scale * 0.34);
        charge.modelHost.add(scene);
        charge.modelAttached = true;
        const clip =
          prototype.animations.find(({ name }) => name === "FlightLoop_24") ??
          prototype.animations[0];
        if (clip) {
          charge.mixer = new THREE.AnimationMixer(scene);
          charge.mixer.clipAction(clip).play();
        }
      })
      .catch(() => {
        // The charge effect remains fully readable through its core, rings,
        // particles, and light even if a projectile asset is unavailable.
      });

    this.debug?.("renderer.magic_charge.start", {
      key: request.key,
      projectileId: definition.id,
      duration: request.duration,
      power: charge.power,
      visualScale: charge.visualScale,
      origin: request.origin.toArray(),
    });
    return true;
  }

  endMagicCharge(
    key: string,
    phase: Exclude<HarthmereMagicChargePhase, "start">
  ) {
    const index = this.activeMagicCharges.findIndex(
      (charge) => charge.key === key
    );
    if (index < 0) {
      return false;
    }
    const [charge] = this.activeMagicCharges.splice(index, 1);
    if (phase === "release") {
      this.magicChargeReleasedCount += 1;
    } else {
      this.magicChargeCancelledCount += 1;
    }
    this.removeMagicCharge(charge);
    this.debug?.(`renderer.magic_charge.${phase}`, {
      key,
      projectileId: charge.definition.id,
      elapsed: charge.elapsed,
      duration: charge.duration,
    });
    return true;
  }

  spawn(request: HarthmereProjectileSpawnRequest) {
    const definition = getHarthmereProjectileVisual(request.projectileId);
    if (!definition) {
      return false;
    }
    const shapeDefinition = getHarthmereBossAttackShapeVisual(
      request.attackShape
    );
    if (shapeDefinition) {
      return this.spawnAttackShape(request, definition, shapeDefinition);
    }
    if (request.origin.distanceToSquared(request.target) < 0.04) {
      return false;
    }
    while (this.active.length >= MAX_ACTIVE_PROJECTILES) {
      this.removeProjectile(this.active.shift()!);
    }

    const start = request.origin.clone();
    const target = request.target.clone();
    const visualScale = THREE.MathUtils.clamp(
      Number(request.visualScale ?? 1),
      0.75,
      2.75
    );
    if (["meteor", "consecrate", "entangling_roots"].includes(definition.id)) {
      target.y -= 0.65;
    }
    if (definition.id === "meteor") {
      start.copy(target).add(new THREE.Vector3(-3.4, 8.5, -2.4));
    } else if (definition.id === "consecrate") {
      start.copy(target).add(new THREE.Vector3(0, 4.2, 0));
    }

    const mount = new THREE.Group();
    mount.name = `harthmere-premium-projectile-${definition.id}-${this.nextSequence}`;
    mount.scale.setScalar(visualScale);
    const modelHost = new THREE.Group();
    const fallback = makeLoadingSilhouette(definition);
    modelHost.add(fallback);
    mount.add(modelHost);
    this.root.add(mount);

    const trail = makeTrail(definition);
    this.root.add(trail.mesh);
    const light =
      this.active.filter((entry) => entry.light).length <
        MAX_PROJECTILE_LIGHTS && definition.lightIntensity > 1.25
        ? new THREE.PointLight(
            definition.primaryColor,
            definition.lightIntensity * (0.9 + (visualScale - 1) * 0.3),
            Math.max(2.5, definition.impactRadius * 4) * Math.sqrt(visualScale),
            2
          )
        : undefined;
    if (light) modelHost.add(light);

    const projectile: ActiveProjectile = {
      sequence: this.nextSequence++,
      definition,
      mount,
      modelHost,
      fallback,
      trail,
      start,
      target,
      lastPosition: start.clone(),
      elapsed: 0,
      duration: harthmereProjectileFlightDurationSecs({
        distanceMeters: start.distanceTo(target),
        speedMetersPerSecond: definition.speed,
        authoritativeImpactSecs:
          request.authoritativeImpactSecs ??
          (Number(request.windupSecs) > 0 ? request.windupSecs : undefined),
      }),
      visualScale,
      damageType: request.damageType,
      impactRadius:
        Number.isFinite(request.hitRadius) && (request.hitRadius ?? 0) > 0
          ? request.hitRadius!
          : definition.impactRadius,
      result: request.result,
      targetGround: request.targetGround?.clone(),
      finalDamage: request.finalDamage,
      light,
    };
    this.active.push(projectile);
    this.spawnedCount += 1;
    this.updateTransform(projectile, 0);
    this.addImpact(
      makePremiumImpact(
        definition,
        request.origin,
        "launch",
        request.result,
        this.impacts.filter((entry) => entry.light).length < MAX_IMPACT_LIGHTS
      )
    );
    emitProjectileLaunchAndFlightSound({
      definition,
      origin: request.origin,
      target,
      durationSeconds: projectile.duration,
      damageType: request.damageType,
    });

    void this.load(definition)
      .then((prototype) => {
        if (!this.active.includes(projectile)) return;
        const scene = clonePremiumModel(prototype);
        scene.scale.setScalar(definition.scale);
        projectile.modelHost.remove(projectile.fallback);
        disposeEffectObject(projectile.fallback, true);
        projectile.modelHost.add(scene);
        const clip =
          prototype.animations.find(
            (entry) => entry.name === "FlightLoop_24"
          ) ?? prototype.animations[0];
        if (clip) {
          projectile.mixer = new THREE.AnimationMixer(scene);
          projectile.mixer.clipAction(clip).play();
        }
      })
      .catch(() => {
        // The loading silhouette remains for this flight and load() permits a retry.
      });

    this.debug?.("renderer.projectile.spawn", {
      projectileId: definition.id,
      assetUrl: definition.assetUrl,
      origin: request.origin.toArray(),
      visualStart: start.toArray(),
      target: target.toArray(),
      duration: projectile.duration,
      visualScale: projectile.visualScale,
      result: request.result,
      finalDamage: request.finalDamage,
      damageType: request.damageType,
      impactRadius: projectile.impactRadius,
    });
    return true;
  }

  private spawnAttackShape(
    request: HarthmereProjectileSpawnRequest,
    projectileDefinition: HarthmereProjectileVisualDefinition,
    shapeDefinition: HarthmereBossAttackShapeVisualDefinition
  ) {
    while (this.activeShapes.length >= MAX_ACTIVE_ATTACK_SHAPES) {
      this.removeAttackShape(this.activeShapes.shift()!);
    }

    const origin = request.origin.clone();
    const target = request.target.clone();
    const direction = target.clone().sub(origin);
    if (direction.lengthSq() < 0.0001) {
      direction.copy(FORWARD);
    }
    const measuredDistance = Math.max(0.25, direction.length());
    direction.normalize();
    const distance =
      shapeDefinition.shape === "cone" &&
      Number.isFinite(request.attackDistance) &&
      (request.attackDistance ?? 0) > 0
        ? request.attackDistance!
        : measuredDistance;
    const hitRadius =
      Number.isFinite(request.hitRadius) && (request.hitRadius ?? 0) > 0
        ? request.hitRadius!
        : Math.max(1, projectileDefinition.impactRadius);
    const coneAngleDeg =
      Number.isFinite(request.coneAngleDeg) && (request.coneAngleDeg ?? 0) > 0
        ? request.coneAngleDeg!
        : 60;
    const radialScale =
      shapeDefinition.shape === "cone"
        ? (Math.tan(THREE.MathUtils.degToRad(coneAngleDeg / 2)) * distance) /
          shapeDefinition.baseRadius
        : hitRadius / shapeDefinition.baseRadius;

    const group = new THREE.Group();
    group.name = `harthmere-boss-attack-shape-${shapeDefinition.shape}-${projectileDefinition.id}-${this.nextSequence}`;
    const modelHost = new THREE.Group();
    const fallback = makeAttackShapeLoadingSilhouette(
      shapeDefinition.shape,
      projectileDefinition
    );
    modelHost.add(fallback);
    group.add(modelHost);

    if (shapeDefinition.shape === "beam" || shapeDefinition.shape === "cone") {
      group.position.copy(origin);
      group.quaternion.setFromUnitVectors(FORWARD, direction);
    } else if (shapeDefinition.shape === "ground_aoe") {
      group.position.copy(request.targetGround ?? target);
      if (!request.targetGround) group.position.y -= 1;
    } else {
      group.position.copy(request.originGround ?? origin);
      if (!request.originGround) group.position.y -= 1;
    }
    this.root.add(group);

    const light =
      this.activeShapes.filter((entry) => entry.light).length <
        MAX_PROJECTILE_LIGHTS && projectileDefinition.lightIntensity > 1.1
        ? new THREE.PointLight(
            projectileDefinition.primaryColor,
            projectileDefinition.lightIntensity * 0.8,
            Math.max(3, hitRadius * 2.5),
            2
          )
        : undefined;
    if (light) group.add(light);

    const effect: ActiveAttackShapeEffect = {
      sequence: this.nextSequence++,
      shapeDefinition,
      projectileDefinition,
      group,
      modelHost,
      fallback,
      materials: [],
      origin,
      target,
      distance,
      radialScale,
      elapsed: 0,
      // Area/beam telegraphs resolve when Anima resolves damage. The previous
      // extra 0.36 seconds let the graphic linger past the authoritative hit.
      duration:
        Number.isFinite(request.authoritativeImpactSecs) &&
        Number(request.authoritativeImpactSecs) >= 0
          ? THREE.MathUtils.clamp(
              Number(request.authoritativeImpactSecs),
              HARTHMERE_AUTHORITATIVE_IMPACT_EPSILON_SECS,
              2.15
            )
          : THREE.MathUtils.clamp(
              request.windupSecs && request.windupSecs > 0
                ? request.windupSecs
                : Math.max(0.7, distance / projectileDefinition.speed),
              0.62,
              2.15
            ),
      damageType: request.damageType,
      impactRadius: hitRadius,
      result: request.result,
      targetGround: request.targetGround?.clone(),
      finalDamage: request.finalDamage,
      light,
    };
    this.activeShapes.push(effect);
    this.spawnedCount += 1;
    this.updateAttackShapeTransform(effect, 0);
    this.addImpact(
      makePremiumImpact(
        projectileDefinition,
        shapeDefinition.shape === "ground_aoe" ? group.position : origin,
        "launch",
        request.result,
        this.impacts.filter((entry) => entry.light).length < MAX_IMPACT_LIGHTS
      )
    );

    emitProjectileLaunchAndFlightSound({
      definition: projectileDefinition,
      origin: group.position,
      target,
      durationSeconds: effect.duration,
      damageType: request.damageType,
    });

    void this.loadShape(shapeDefinition)
      .then((prototype) => {
        if (!this.activeShapes.includes(effect)) return;
        const { scene, materials } = cloneBossAttackShapeModel(
          prototype,
          projectileDefinition
        );
        effect.modelHost.remove(effect.fallback);
        disposeEffectObject(effect.fallback, true);
        effect.modelHost.add(scene);
        effect.materials = materials;
        const clip =
          prototype.animations.find(
            (entry) => entry.name === shapeDefinition.animationClip
          ) ?? prototype.animations[0];
        if (clip) {
          effect.mixer = new THREE.AnimationMixer(scene);
          effect.mixer.clipAction(clip).play();
        }
      })
      .catch(() => {
        // The readable primitive silhouette remains if the premium GLB fails.
      });

    this.debug?.("renderer.boss_attack_shape.spawn", {
      projectileId: projectileDefinition.id,
      attackShape: shapeDefinition.shape,
      assetUrl: shapeDefinition.assetUrl,
      origin: origin.toArray(),
      target: target.toArray(),
      hitRadius,
      coneAngleDeg,
      distance,
      duration: effect.duration,
      result: request.result,
      finalDamage: request.finalDamage,
    });
    return true;
  }

  private addImpact(impact: PremiumImpact) {
    if (impact.kind === "magic_explosion") {
      while (
        this.impacts.filter(({ kind }) => kind === "magic_explosion").length >=
        MAX_ACTIVE_MAGIC_EXPLOSIONS
      ) {
        const staleIndex = this.impacts.findIndex(
          ({ kind }) => kind === "magic_explosion"
        );
        if (staleIndex < 0) break;
        const [stale] = this.impacts.splice(staleIndex, 1);
        this.removeImpact(stale);
      }
    }
    while (this.impacts.length >= MAX_ACTIVE_IMPACTS) {
      const stale = this.impacts.shift()!;
      this.removeImpact(stale);
    }
    this.impacts.push(impact);
    this.root.add(impact.group);
  }

  private removeImpact(impact: PremiumImpact) {
    this.root.remove(impact.group);
    disposeEffectObject(impact.group, true);
  }

  private addResolvedImpact(input: {
    definition: HarthmereProjectileVisualDefinition;
    position: THREE.Vector3;
    direction: THREE.Vector3;
    targetGround?: THREE.Vector3;
    result?: string;
    finalDamage?: number;
    damageType?: string;
    impactRadius?: number;
    seed: number;
  }) {
    const addLight =
      this.impacts.filter((entry) => entry.light).length < MAX_IMPACT_LIGHTS;
    const impact =
      makeAaaMagicImpact({
        ...input,
        addLight,
      }) ??
      makePremiumImpact(
        input.definition,
        input.position,
        "impact",
        input.result,
        addLight
      );
    this.addImpact(impact);
    if (impact.kind !== "magic_explosion") return impact;

    this.magicExplosionCount += 1;
    const feedback: HarthmereMagicImpactFeedback = {
      version: HARTHMERE_MAGIC_IMPACT_VERSION,
      projectileId: impact.projectileId,
      family: impact.family,
      position: input.position.toArray() as [number, number, number],
      radius: impact.radius,
      duration: impact.duration,
      cameraStrength: impact.profile.cameraStrength,
      finalDamage: input.finalDamage,
    };
    this.magicImpactFeedback?.(feedback);
    this.debug?.("renderer.magic_impact.explosion", {
      ...feedback,
      ringCount: impact.profile.ringCount,
      debrisCount: impact.profile.debrisCount,
      sparkCount: impact.profile.sparkCount,
      mistCount: impact.profile.mistCount,
      dustCount: impact.profile.dustCount,
    });
    return impact;
  }

  private updateTransform(projectile: ActiveProjectile, progress: number) {
    const eased = 1 - Math.pow(1 - progress, 2);
    const position = projectile.start.clone().lerp(projectile.target, eased);
    position.y +=
      Math.sin(progress * Math.PI) * projectile.definition.arcHeight;
    const flightDirection = projectile.target
      .clone()
      .sub(projectile.start)
      .normalize();
    const right = new THREE.Vector3()
      .crossVectors(flightDirection, UP)
      .normalize();
    const envelope = Math.sin(progress * Math.PI);
    if (projectile.definition.family === "lightning") {
      position.addScaledVector(
        right,
        Math.sin(progress * Math.PI * 20 + projectile.sequence) *
          0.09 *
          envelope
      );
    } else if (projectile.definition.family === "sonic") {
      position.addScaledVector(
        right,
        Math.sin(progress * Math.PI * 9) * 0.18 * envelope
      );
      position.y += Math.cos(progress * Math.PI * 9) * 0.08 * envelope;
    } else if (
      projectile.definition.family === "arcane" ||
      projectile.definition.family === "dark" ||
      projectile.definition.family === "hex"
    ) {
      position.addScaledVector(
        right,
        Math.sin(progress * Math.PI * 6 + projectile.sequence) *
          0.085 *
          envelope
      );
    } else if (projectile.definition.family === "boss") {
      position.addScaledVector(
        right,
        Math.cos(progress * Math.PI * 7) * 0.2 * envelope
      );
      position.y += Math.sin(progress * Math.PI * 7) * 0.14 * envelope;
    }

    const tangent = position.clone().sub(projectile.lastPosition);
    if (tangent.lengthSq() < 0.000001) {
      tangent.copy(projectile.target).sub(projectile.start);
    }
    tangent.normalize();
    projectile.mount.position.copy(position);
    projectile.mount.quaternion.setFromUnitVectors(FORWARD, tangent);
    projectile.modelHost.rotation.z =
      projectile.elapsed * projectile.definition.spinRadiansPerSecond;
    projectile.lastPosition.copy(position);
  }

  private updateAttackShapeTransform(
    effect: ActiveAttackShapeEffect,
    progress: number
  ) {
    const reveal = THREE.MathUtils.smoothstep(progress, 0, 0.28);
    const fade = 1 - THREE.MathUtils.smoothstep(progress, 0.72, 1);
    const pulse = 1 + Math.sin(progress * Math.PI * 6) * 0.035;
    if (
      effect.shapeDefinition.shape === "beam" ||
      effect.shapeDefinition.shape === "cone"
    ) {
      effect.modelHost.scale.set(
        effect.radialScale * pulse,
        effect.radialScale * pulse,
        (effect.distance / effect.shapeDefinition.baseLength) * reveal
      );
    } else {
      effect.modelHost.scale.setScalar(effect.radialScale * reveal * pulse);
      effect.group.rotation.y += 0.012 * reveal;
    }
    for (const material of effect.materials) {
      setEffectOpacity(material, fade);
    }
    effect.fallback.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      for (const material of materials) setEffectOpacity(material, fade);
    });
    if (effect.light) {
      effect.light.intensity =
        effect.projectileDefinition.lightIntensity * 0.8 * fade;
    }
  }

  private updateMagicChargeTransform(
    charge: ActiveMagicCharge,
    progress: number
  ) {
    const gathered = THREE.MathUtils.smoothstep(progress, 0, 0.72);
    const maximum = THREE.MathUtils.smoothstep(progress, 0.7, 1);
    const pulse = 1 + Math.sin(charge.elapsed * (5 + charge.power * 4)) * 0.08;
    const scale = (0.42 + gathered * (0.78 + charge.power * 0.34)) * pulse;
    charge.group.position.copy(charge.origin);
    charge.group.scale.setScalar(charge.visualScale);
    charge.core.scale.setScalar(scale);
    charge.core.rotation.x += 0.018 + charge.power * 0.012;
    charge.core.rotation.y += 0.026 + charge.power * 0.018;
    charge.shell.scale.setScalar(scale * (1.35 + maximum * 0.18));
    charge.shell.rotation.x -= 0.012;
    charge.shell.rotation.y += 0.02;

    for (let index = 0; index < charge.rings.length; index += 1) {
      const ring = charge.rings[index];
      const direction = index % 2 === 0 ? 1 : -1;
      ring.rotation.z += direction * (0.012 + index * 0.005);
      ring.rotation.y += direction * 0.009;
      const inward = 1.45 - gathered * 0.48 + maximum * 0.1;
      ring.scale.setScalar(inward * pulse);
      const material = ring.material as THREE.MeshBasicMaterial;
      material.opacity = 0.24 + gathered * 0.5;
    }

    const orbitRadius = 1.48 - gathered * 0.72;
    for (let index = 0; index < MAGIC_CHARGE_PARTICLE_COUNT; index += 1) {
      const normalized = index / MAGIC_CHARGE_PARTICLE_COUNT;
      const layer = index % 3;
      const angle =
        normalized * Math.PI * 2 +
        charge.elapsed * (1.2 + layer * 0.24) * (layer === 1 ? -1 : 1);
      const radius = orbitRadius * (0.72 + layer * 0.15);
      MAGIC_CHARGE_POSITION.set(
        Math.cos(angle) * radius,
        Math.sin(angle * 2 + layer) * (0.35 + gathered * 0.24),
        Math.sin(angle) * radius
      );
      const particleScale =
        (0.58 + gathered * 0.85 + maximum * 0.35) * (0.8 + (index % 5) * 0.07);
      MAGIC_CHARGE_SCALE.setScalar(particleScale);
      MAGIC_CHARGE_QUATERNION.setFromEuler(
        new THREE.Euler(angle * 0.5, angle, -angle * 0.3)
      );
      MAGIC_CHARGE_MATRIX.compose(
        MAGIC_CHARGE_POSITION,
        MAGIC_CHARGE_QUATERNION,
        MAGIC_CHARGE_SCALE
      );
      charge.particles.setMatrixAt(index, MAGIC_CHARGE_MATRIX);
    }
    charge.particles.instanceMatrix.needsUpdate = true;
    const particleMaterial = charge.particles
      .material as THREE.MeshBasicMaterial;
    particleMaterial.opacity = 0.35 + gathered * 0.58;

    charge.modelHost.rotation.y += 0.02 + charge.power * 0.025;
    charge.modelHost.rotation.z -= 0.012;
    charge.modelHost.scale.setScalar(0.68 + gathered * 0.5);
    if (charge.light) {
      charge.light.intensity =
        0.8 +
        gathered * charge.definition.lightIntensity * (0.65 + charge.power);
      charge.light.distance = 4.5 + gathered * (3 + charge.power * 4);
    }
  }

  update(dt: number) {
    // Lifecycle progress must follow wall time because Anima resolves damage
    // on that same clock. Capping it to 50 ms per rendered frame made a
    // one-second Fireball take about twenty seconds visually at 1 FPS while
    // authoritative damage still landed after one second. Keep the cap only
    // for mixer/particle integration so a stalled frame cannot explode trails.
    const timelineDt = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    const safeDt = THREE.MathUtils.clamp(timelineDt, 0, 0.05);
    // Wall-clock progress alone cannot guarantee the player ever SEES an
    // effect. A captured session ran at 14 FPS, where one frame is 71 ms: any
    // visual whose duration is shorter than a frame reaches progress >= 1 on
    // its very first update and is destroyed before it has been drawn a
    // meaningful number of times. That is why projectiles, impacts and charges
    // could be "fired" — with their GLB and sound correctly requested — and
    // still never appear on screen.
    //
    // Holding every combat visual for a minimum number of RENDERED FRAMES
    // rather than a minimum number of seconds makes visibility independent of
    // frame rate. At 60 FPS this is ~50 ms and changes nothing, because these
    // effects are already longer than that; at 14 FPS it is ~214 ms and is the
    // difference between a visible telegraph and nothing at all.
    const holdForVisibility = <T extends { framesRendered: number }>(
      visual: T,
      progress: number
    ) => {
      visual.framesRendered += 1;
      return progress >= 1 && visual.framesRendered >= MIN_VISIBLE_FRAMES;
    };
    for (
      let index = this.activeMagicCharges.length - 1;
      index >= 0;
      index -= 1
    ) {
      const charge = this.activeMagicCharges[index];
      charge.elapsed += timelineDt;
      charge.mixer?.update(safeDt);
      const progress = Math.min(1, charge.elapsed / charge.duration);
      this.updateMagicChargeTransform(charge, progress);
      if (holdForVisibility(charge, progress)) {
        this.activeMagicCharges.splice(index, 1);
        this.magicChargeReleasedCount += 1;
        this.removeMagicCharge(charge);
      }
    }
    for (let index = this.active.length - 1; index >= 0; index -= 1) {
      const projectile = this.active[index];
      projectile.elapsed += timelineDt;
      projectile.mixer?.update(safeDt);
      const progress = Math.min(1, projectile.elapsed / projectile.duration);
      this.updateTransform(projectile, progress);
      const direction = projectile.target
        .clone()
        .sub(projectile.start)
        .normalize();
      updateTrail(
        projectile.trail,
        projectile.definition,
        projectile.mount.position,
        direction,
        safeDt,
        projectile.elapsed,
        projectile.visualScale
      );
      // Contact follows authoritative wall time. If a low-FPS frame arrives
      // after the hit, finish immediately and create the impact visual; the
      // impact itself is held for MIN_VISIBLE_FRAMES below.
      if (progress >= 1) {
        this.active.splice(index, 1);
        this.finishProjectile(projectile);
      }
    }

    for (let index = this.activeShapes.length - 1; index >= 0; index -= 1) {
      const effect = this.activeShapes[index];
      effect.elapsed += timelineDt;
      effect.mixer?.update(safeDt);
      const progress = Math.min(1, effect.elapsed / effect.duration);
      this.updateAttackShapeTransform(effect, progress);
      // Beam/cone/area contact is authoritative too. Holding the telegraph
      // here delays the visible impact past Anima's damage receipt.
      if (progress >= 1) {
        this.activeShapes.splice(index, 1);
        this.finishAttackShape(effect);
      }
    }

    for (let index = this.impacts.length - 1; index >= 0; index -= 1) {
      const impact = this.impacts[index];
      impact.elapsed += safeDt;
      const progress = Math.min(1, impact.elapsed / impact.duration);
      if (impact.kind === "magic_explosion") {
        for (const layer of impact.layers) {
          updateMagicImpactLayer(layer, impact.elapsed, safeDt);
        }
        for (const batch of impact.batches) {
          updateMagicImpactBatch(batch, impact.elapsed);
        }
        if (impact.light) {
          const flashBoost =
            impact.elapsed <= impact.profile.flashDurationSecs ? 1.35 : 1;
          impact.light.intensity =
            impact.initialLightIntensity *
            flashBoost *
            Math.pow(Math.max(0, 1 - progress), 2.4);
        }
      } else {
        const bloom = Math.sin(progress * Math.PI);
        impact.group.scale.setScalar(
          0.18 + impact.radius * (0.42 + bloom * 0.68)
        );
        impact.group.rotation.y += safeDt * 5.5;
        impact.group.rotation.z -= safeDt * 3.2;
        for (const part of impact.parts) {
          part.object.position.addScaledVector(
            part.velocity,
            safeDt * (1 - progress * 0.55)
          );
          part.object.rotation.x += part.spin.x * safeDt;
          part.object.rotation.y += part.spin.y * safeDt;
          part.object.rotation.z += part.spin.z * safeDt;
        }
        for (const material of impact.materials) {
          material.opacity = Math.max(0, 1 - progress);
        }
        if (impact.light) {
          impact.light.intensity *= Math.pow(0.02, safeDt / impact.duration);
        }
      }
      if (holdForVisibility(impact, progress)) {
        this.impacts.splice(index, 1);
        this.removeImpact(impact);
      }
    }
    this.publishDebugSnapshot();
  }

  private finishAttackShape(effect: ActiveAttackShapeEffect) {
    const impactPosition = effect.group.position.clone();
    if (effect.shapeDefinition.shape === "cone") {
      // The cone telegraph intentionally extends to its maximum dodge range,
      // but the hit explosion belongs on the authoritative aimed player. A
      // closer target otherwise sees the explosion several metres behind
      // them, which is especially obvious on long boss breath attacks.
      impactPosition.copy(effect.target);
    } else if (effect.shapeDefinition.shape === "beam") {
      impactPosition.add(
        new THREE.Vector3(0, 0, effect.distance).applyQuaternion(
          effect.group.quaternion
        )
      );
    }
    const impact = this.addResolvedImpact({
      definition: effect.projectileDefinition,
      position: impactPosition,
      direction: impactPosition.clone().sub(effect.origin),
      targetGround: effect.targetGround,
      result: effect.result,
      finalDamage: effect.finalDamage,
      damageType: effect.damageType,
      impactRadius: effect.impactRadius,
      seed: effect.sequence,
    });
    this.impactCount += 1;
    emitProjectileImpactSound({
      definition: effect.projectileDefinition,
      damageType: effect.damageType,
      position: impactPosition,
      impact,
    });
    this.removeAttackShape(effect);
    this.debug?.("renderer.boss_attack_shape.impact", {
      projectileId: effect.projectileDefinition.id,
      attackShape: effect.shapeDefinition.shape,
      position: impactPosition.toArray(),
      result: effect.result,
    });
  }

  private finishProjectile(projectile: ActiveProjectile) {
    const impact = this.addResolvedImpact({
      definition: projectile.definition,
      position: projectile.target,
      direction: projectile.target.clone().sub(projectile.start),
      targetGround: projectile.targetGround,
      result: projectile.result,
      finalDamage: projectile.finalDamage,
      damageType: projectile.damageType,
      impactRadius: projectile.impactRadius,
      seed: projectile.sequence,
    });
    this.impactCount += 1;
    const mappedSounds = resolveHarthmereProjectileLifecycleSounds({
      definition: projectile.definition,
      damageType: projectile.damageType,
    });
    const missed = /miss|dodge|evade|out_of_range/.test(
      projectile.result ?? ""
    );
    const impactSound =
      missed &&
      [
        "hunter_bow_shot",
        "quick_shot",
        "aimed_shot",
        "multi_shot",
        "bandit_archer_shot",
      ].includes(projectile.definition.id)
        ? "arrow_impact_hard"
        : mappedSounds?.impact;
    emitProjectileImpactSound({
      definition: projectile.definition,
      damageType: projectile.damageType,
      contactSoundId: impactSound,
      position: projectile.target,
      impact,
    });
    this.removeProjectile(projectile);
    this.debug?.("renderer.projectile.impact", {
      projectileId: projectile.definition.id,
      target: projectile.target.toArray(),
      result: projectile.result,
      radius: projectile.definition.impactRadius,
    });
  }

  private removeProjectile(projectile: ActiveProjectile) {
    this.root.remove(projectile.mount);
    this.root.remove(projectile.trail.mesh);
    projectile.mixer?.stopAllAction();
    projectile.mount.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
      else material.dispose();
    });
    if (projectile.fallback.parent) {
      projectile.fallback.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) mesh.geometry.dispose();
      });
    }
    projectile.trail.geometry.dispose();
    projectile.trail.material.dispose();
  }

  private removeMagicCharge(charge: ActiveMagicCharge) {
    this.root.remove(charge.group);
    charge.mixer?.stopAllAction();
    disposeEffectObject(charge.group, true);
  }

  private removeAttackShape(effect: ActiveAttackShapeEffect) {
    this.root.remove(effect.group);
    effect.mixer?.stopAllAction();
    effect.group.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
      else material.dispose();
    });
    if (effect.fallback.parent) {
      effect.fallback.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) mesh.geometry.dispose();
      });
    }
  }

  private publishDebugSnapshot() {
    if (typeof window === "undefined") return;
    (
      window as typeof window & {
        __harthmereProjectileVisuals?: Record<string, unknown>;
      }
    ).__harthmereProjectileVisuals = {
      version: HARTHMERE_PROJECTILE_VISUAL_VERSION,
      runtime: "premium-clean-room-v5-signature-impacts",
      magicImpactVersion: HARTHMERE_MAGIC_IMPACT_VERSION,
      manifestCount: HARTHMERE_PROJECTILE_VISUALS.length,
      loadedOrLoading: this.prototypes.size,
      loadedCount: this.loadedPrototypeIds.size,
      loadedIds: [...this.loadedPrototypeIds].sort(),
      failedIds: [...this.failedPrototypeIds].sort(),
      loadedOrLoadingShapes: this.shapePrototypes.size,
      active: this.active.map((entry) => ({
        sequence: entry.sequence,
        projectileId: entry.definition.id,
        origin: entry.start.toArray(),
        progress: Math.min(1, entry.elapsed / entry.duration),
        position: entry.mount.position.toArray(),
        usingFallback: entry.fallback.parent === entry.modelHost,
        visualScale: entry.visualScale,
      })),
      activeMagicCharges: this.activeMagicCharges.map((entry) => ({
        sequence: entry.sequence,
        key: entry.key,
        projectileId: entry.definition.id,
        progress: Math.min(1, entry.elapsed / entry.duration),
        elapsed: entry.elapsed,
        duration: entry.duration,
        power: entry.power,
        visualScale: entry.visualScale,
        position: entry.group.position.toArray(),
        modelAttached: entry.modelAttached,
      })),
      magicChargeStartedCount: this.magicChargeStartedCount,
      magicChargeReleasedCount: this.magicChargeReleasedCount,
      magicChargeCancelledCount: this.magicChargeCancelledCount,
      activeShapes: this.activeShapes.map((entry) => ({
        sequence: entry.sequence,
        projectileId: entry.projectileDefinition.id,
        attackShape: entry.shapeDefinition.shape,
        progress: Math.min(1, entry.elapsed / entry.duration),
        position: entry.group.position.toArray(),
      })),
      activeMagicExplosions: this.impacts
        .filter(
          (entry): entry is MagicImpact => entry.kind === "magic_explosion"
        )
        .map((entry) => ({
          projectileId: entry.projectileId,
          family: entry.family,
          progress: Math.min(1, entry.elapsed / entry.duration),
          position: entry.group.position.toArray(),
          radius: entry.radius,
          ringCount: entry.profile.ringCount,
          debrisCount: entry.profile.debrisCount,
          sparkCount: entry.profile.sparkCount,
          mistCount: entry.profile.mistCount,
          dustCount: entry.profile.dustCount,
        })),
      magicExplosionCount: this.magicExplosionCount,
      impacts: this.impacts.length,
      spawnedCount: this.spawnedCount,
      impactCount: this.impactCount,
    };
  }
}
