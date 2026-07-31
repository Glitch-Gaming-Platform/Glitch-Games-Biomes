import {
  HARTHMERE_BOSS_ATTACK_SHAPE_VISUALS,
  getHarthmereBossAttackShapeVisual,
  type HarthmereBossAreaAttackShape,
  type HarthmereBossAttackShape,
  type HarthmereBossAttackShapeVisualDefinition,
} from "@/shared/harthmere/boss_attack_shape_visuals";
import {
  HARTHMERE_PROJECTILE_VISUALS,
  HARTHMERE_PROJECTILE_VISUAL_VERSION,
  getHarthmereProjectileVisual,
  type HarthmereProjectileVisualDefinition,
} from "@/shared/harthmere/projectile_visual_manifest";
import {
  emitHarthmereSoundEffect,
  HARTHMERE_PROJECTILE_SOUND_MAP,
} from "@/shared/harthmere/sound_effect_manifest";
import * as THREE from "three";
import type { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

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
  geometry: THREE.BoxGeometry;
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
  result?: string;
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
  result?: string;
  mixer?: THREE.AnimationMixer;
  light?: THREE.PointLight;
};

type ImpactPart = {
  object: THREE.Object3D;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
};

type PremiumImpact = {
  group: THREE.Group;
  materials: THREE.MeshBasicMaterial[];
  parts: ImpactPart[];
  light?: THREE.PointLight;
  elapsed: number;
  duration: number;
  radius: number;
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
};

const FORWARD = new THREE.Vector3(0, 0, 1);
const UP = new THREE.Vector3(0, 1, 0);
const MAX_ACTIVE_PROJECTILES = 40;
const MAX_ACTIVE_ATTACK_SHAPES = 24;
const MAX_ACTIVE_IMPACTS = 28;
const MAX_PROJECTILE_LIGHTS = 10;
const MAX_IMPACT_LIGHTS = 8;

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
    width: meteor ? 0.24 : boss ? 0.18 : physical ? 0.055 : 0.11,
    length: fast ? 0.52 : physical ? 0.3 : meteor ? 0.48 : 0.25,
    maxSamples: THREE.MathUtils.clamp(Math.ceil(lifetime / interval), 9, 26),
  };
}

function makeTrail(definition: HarthmereProjectileVisualDefinition) {
  const profile = trailProfile(definition);
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = effectMaterial(
    definition.family === "physical"
      ? definition.primaryColor
      : definition.secondaryColor,
    definition.family === "physical" ? 0.48 : 0.68,
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
  }
  return offset;
}

function updateTrail(
  trail: PremiumTrail,
  definition: HarthmereProjectileVisualDefinition,
  position: THREE.Vector3,
  direction: THREE.Vector3,
  dt: number,
  elapsed: number
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
    const width = trail.width * fade;
    scale.set(width, width, trail.length * fade);
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

  const ringCount =
    definition.family === "sonic" || definition.family === "boss"
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
      : definition.id === "meteor"
      ? 18
      : definition.family === "boss"
      ? 16
      : 10;
  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / count;
    const direction = new THREE.Vector3(
      Math.cos(angle),
      definition.family === "holy"
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
    const geometry = rootLike
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
      materials[definition.family === "fire" && index % 4 === 3 ? 2 : index % 2]
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
      : definition.id === "consecrate"
      ? 1.0
      : definition.id === "meteor" || definition.family === "boss"
      ? 0.82
      : THREE.MathUtils.clamp(0.3 + radius * 0.08, 0.34, 0.62);
  return {
    group,
    materials,
    parts,
    light,
    elapsed: 0,
    duration: missed ? Math.min(duration, 0.24) : duration,
    radius,
  } satisfies PremiumImpact;
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
  private readonly impacts: PremiumImpact[] = [];
  private nextSequence = 1;
  private spawnedCount = 0;
  private impactCount = 0;

  constructor(
    private readonly root: THREE.Object3D,
    private readonly loader: GLTFLoader,
    private readonly debug?: (
      event: string,
      payload: Record<string, unknown>
    ) => void
  ) {}

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
            definition.lightIntensity,
            Math.max(2.5, definition.impactRadius * 4),
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
      duration: THREE.MathUtils.clamp(
        start.distanceTo(target) / definition.speed,
        0.16,
        1.12
      ),
      result: request.result,
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
    const launchSound = HARTHMERE_PROJECTILE_SOUND_MAP[definition.id]?.launch;
    if (launchSound) {
      emitHarthmereSoundEffect(launchSound, {
        position: request.origin.toArray(),
      });
    }

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
      result: request.result,
      finalDamage: request.finalDamage,
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
      duration: THREE.MathUtils.clamp(
        Math.max(0.35, request.windupSecs ?? 0.7) + 0.36,
        0.62,
        2.15
      ),
      result: request.result,
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

    const launchSound =
      HARTHMERE_PROJECTILE_SOUND_MAP[projectileDefinition.id]?.launch;
    if (launchSound) {
      emitHarthmereSoundEffect(launchSound, {
        position: group.position.toArray(),
      });
    }

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
    while (this.impacts.length >= MAX_ACTIVE_IMPACTS) {
      const stale = this.impacts.shift()!;
      this.root.remove(stale.group);
      disposeEffectObject(stale.group, true);
    }
    this.impacts.push(impact);
    this.root.add(impact.group);
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

  update(dt: number) {
    const safeDt = THREE.MathUtils.clamp(dt, 0, 0.05);
    for (let index = this.active.length - 1; index >= 0; index -= 1) {
      const projectile = this.active[index];
      projectile.elapsed += safeDt;
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
        projectile.elapsed
      );
      if (progress >= 1) {
        this.active.splice(index, 1);
        this.finishProjectile(projectile);
      }
    }

    for (let index = this.activeShapes.length - 1; index >= 0; index -= 1) {
      const effect = this.activeShapes[index];
      effect.elapsed += safeDt;
      effect.mixer?.update(safeDt);
      const progress = Math.min(1, effect.elapsed / effect.duration);
      this.updateAttackShapeTransform(effect, progress);
      if (progress >= 1) {
        this.activeShapes.splice(index, 1);
        this.finishAttackShape(effect);
      }
    }

    for (let index = this.impacts.length - 1; index >= 0; index -= 1) {
      const impact = this.impacts[index];
      impact.elapsed += safeDt;
      const progress = Math.min(1, impact.elapsed / impact.duration);
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
      if (progress >= 1) {
        this.impacts.splice(index, 1);
        this.root.remove(impact.group);
        disposeEffectObject(impact.group, true);
      }
    }
    this.publishDebugSnapshot();
  }

  private finishAttackShape(effect: ActiveAttackShapeEffect) {
    const impactPosition = effect.group.position.clone();
    if (
      effect.shapeDefinition.shape === "beam" ||
      effect.shapeDefinition.shape === "cone"
    ) {
      impactPosition.add(
        new THREE.Vector3(0, 0, effect.distance).applyQuaternion(
          effect.group.quaternion
        )
      );
    }
    this.addImpact(
      makePremiumImpact(
        effect.projectileDefinition,
        impactPosition,
        "impact",
        effect.result,
        this.impacts.filter((entry) => entry.light).length < MAX_IMPACT_LIGHTS
      )
    );
    this.impactCount += 1;
    const impactSound =
      HARTHMERE_PROJECTILE_SOUND_MAP[effect.projectileDefinition.id]?.impact;
    if (impactSound) {
      emitHarthmereSoundEffect(impactSound, {
        position: impactPosition.toArray(),
      });
    }
    this.removeAttackShape(effect);
    this.debug?.("renderer.boss_attack_shape.impact", {
      projectileId: effect.projectileDefinition.id,
      attackShape: effect.shapeDefinition.shape,
      position: impactPosition.toArray(),
      result: effect.result,
    });
  }

  private finishProjectile(projectile: ActiveProjectile) {
    this.addImpact(
      makePremiumImpact(
        projectile.definition,
        projectile.target,
        "impact",
        projectile.result,
        this.impacts.filter((entry) => entry.light).length < MAX_IMPACT_LIGHTS
      )
    );
    this.impactCount += 1;
    const mappedSounds =
      HARTHMERE_PROJECTILE_SOUND_MAP[projectile.definition.id];
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
    if (impactSound) {
      emitHarthmereSoundEffect(impactSound, {
        position: projectile.target.toArray(),
      });
    }
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
      runtime: "premium-clean-room-v3-boss-shapes",
      manifestCount: HARTHMERE_PROJECTILE_VISUALS.length,
      loadedOrLoading: this.prototypes.size,
      loadedCount: this.loadedPrototypeIds.size,
      loadedIds: [...this.loadedPrototypeIds].sort(),
      failedIds: [...this.failedPrototypeIds].sort(),
      loadedOrLoadingShapes: this.shapePrototypes.size,
      active: this.active.map((entry) => ({
        sequence: entry.sequence,
        projectileId: entry.definition.id,
        progress: Math.min(1, entry.elapsed / entry.duration),
        position: entry.mount.position.toArray(),
        usingFallback: entry.fallback.parent === entry.modelHost,
      })),
      activeShapes: this.activeShapes.map((entry) => ({
        sequence: entry.sequence,
        projectileId: entry.projectileDefinition.id,
        attackShape: entry.shapeDefinition.shape,
        progress: Math.min(1, entry.elapsed / entry.duration),
        position: entry.group.position.toArray(),
      })),
      impacts: this.impacts.length,
      spawnedCount: this.spawnedCount,
      impactCount: this.impactCount,
    };
  }
}
