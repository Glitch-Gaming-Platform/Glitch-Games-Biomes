import type { ReadonlyEmote } from "@/shared/ecs/gen/components";
import type { ReadonlyOptionalDamageSource } from "@/shared/ecs/gen/types";
import type { ReadonlyVec3 } from "@/shared/math/types";
import * as THREE from "three";

export const HARTHMERE_MELEE_HIT_SPARK_EFFECT_VERSION =
  "harthmere-melee-hit-spark-effect-v1" as const;
export const HARTHMERE_MELEE_HIT_SPARK_DURATION_SECONDS = 0.2;

export function isHarthmereMeleeAttackEmote(emote: ReadonlyEmote | undefined) {
  return emote?.emote_type === "attack1" || emote?.emote_type === "attack2";
}

export function shouldShowHarthmereMeleeHitSpark(input: {
  damageSource: ReadonlyOptionalDamageSource;
  damageTime: number | undefined;
  attackerIsPlayer: boolean;
  attackerEmote: ReadonlyEmote | undefined;
}) {
  const { damageSource, damageTime, attackerIsPlayer, attackerEmote } = input;
  if (
    damageSource?.kind !== "attack" ||
    damageTime === undefined ||
    !attackerIsPlayer ||
    !isHarthmereMeleeAttackEmote(attackerEmote) ||
    !attackerEmote
  ) {
    return false;
  }
  return (
    damageTime >= attackerEmote.emote_start_time - 0.05 &&
    damageTime <= attackerEmote.emote_expiry_time + 0.05
  );
}

export function harthmereMeleeHitSparkPresentation(elapsedSeconds: number): {
  visible: boolean;
  opacity: number;
  scale: number;
} {
  const progress = Math.max(
    0,
    elapsedSeconds / HARTHMERE_MELEE_HIT_SPARK_DURATION_SECONDS
  );
  if (progress >= 1) {
    return { visible: false, opacity: 0, scale: 1 };
  }
  const pop = 1 - Math.pow(1 - Math.min(1, progress / 0.22), 3);
  const fade = progress <= 0.45 ? 1 : 1 - (progress - 0.45) / 0.55;
  return {
    visible: true,
    opacity: Math.max(0, Math.min(1, fade)),
    scale: 0.28 + pop * 0.72,
  };
}

export function harthmereMeleeHitSparkContactPosition(input: {
  center: ReadonlyVec3;
  bodyHeight: number;
  damageDirection: ReadonlyVec3 | undefined;
}): [number, number, number] {
  const { center, bodyHeight, damageDirection } = input;
  const dx = Number(damageDirection?.[0] ?? 0);
  const dz = Number(damageDirection?.[2] ?? 0);
  const horizontalLength = Math.hypot(dx, dz);
  const surfaceOffset = Math.max(0.12, Math.min(0.38, bodyHeight * 0.14));
  const facingX = horizontalLength > 1e-6 ? dx / horizontalLength : 0;
  const facingZ = horizontalLength > 1e-6 ? dz / horizontalLength : 0;
  return [
    center[0] - facingX * surfaceOffset,
    center[1] + bodyHeight * 0.13,
    center[2] - facingZ * surfaceOffset,
  ];
}

let sharedSparkTexture: THREE.CanvasTexture | undefined;

function drawSparkRay(
  context: CanvasRenderingContext2D,
  angle: number,
  innerRadius: number,
  outerRadius: number,
  width: number,
  alpha: number
) {
  const innerX = Math.cos(angle) * innerRadius;
  const innerY = Math.sin(angle) * innerRadius;
  const outerX = Math.cos(angle) * outerRadius;
  const outerY = Math.sin(angle) * outerRadius;
  const gradient = context.createLinearGradient(innerX, innerY, outerX, outerY);
  gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
  gradient.addColorStop(0.35, `rgba(255,242,173,${alpha * 0.95})`);
  gradient.addColorStop(1, "rgba(255,166,45,0)");
  context.beginPath();
  context.moveTo(innerX, innerY);
  context.lineTo(outerX, outerY);
  context.lineCap = "round";
  context.lineWidth = width;
  context.strokeStyle = gradient;
  context.stroke();
}

function sparkTexture() {
  if (sharedSparkTexture) {
    return sharedSparkTexture;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to create Harthmere melee hit-spark canvas");
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.translate(canvas.width / 2, canvas.height / 2);

  const halo = context.createRadialGradient(0, 0, 2, 0, 0, 78);
  halo.addColorStop(0, "rgba(255,255,255,1)");
  halo.addColorStop(0.12, "rgba(255,250,210,0.98)");
  halo.addColorStop(0.34, "rgba(255,204,83,0.62)");
  halo.addColorStop(1, "rgba(255,151,32,0)");
  context.fillStyle = halo;
  context.beginPath();
  context.arc(0, 0, 78, 0, Math.PI * 2);
  context.fill();

  for (let index = 0; index < 16; index += 1) {
    const angle = (Math.PI * 2 * index) / 16 + 0.09;
    const longRay = index % 4 === 0;
    drawSparkRay(
      context,
      angle,
      longRay ? 8 : 13,
      longRay ? 111 : index % 2 === 0 ? 76 : 56,
      longRay ? 5.2 : index % 2 === 0 ? 3.2 : 2.1,
      longRay ? 1 : 0.82
    );
  }

  const core = context.createRadialGradient(-2, -3, 0, 0, 0, 27);
  core.addColorStop(0, "rgba(255,255,255,1)");
  core.addColorStop(0.34, "rgba(255,255,224,1)");
  core.addColorStop(0.7, "rgba(255,213,91,0.92)");
  core.addColorStop(1, "rgba(255,156,35,0)");
  context.fillStyle = core;
  context.beginPath();
  context.arc(0, 0, 28, 0, Math.PI * 2);
  context.fill();

  for (const [x, y, radius, alpha] of [
    [-70, -22, 3.4, 0.85],
    [63, -48, 2.5, 0.72],
    [76, 38, 2.8, 0.78],
    [-50, 61, 2.2, 0.64],
    [29, 72, 1.8, 0.58],
  ] as const) {
    context.fillStyle = `rgba(255,226,126,${alpha})`;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();

  sharedSparkTexture = new THREE.CanvasTexture(canvas);
  sharedSparkTexture.colorSpace = THREE.SRGBColorSpace;
  sharedSparkTexture.minFilter = THREE.LinearFilter;
  sharedSparkTexture.magFilter = THREE.LinearFilter;
  sharedSparkTexture.needsUpdate = true;
  return sharedSparkTexture;
}

export class HarthmereMeleeHitSparkEffect {
  readonly three = new THREE.Group();
  private readonly material: THREE.SpriteMaterial;
  private readonly sprite: THREE.Sprite;
  private readonly basePosition = new THREE.Vector3();

  constructor(
    private readonly startedAtSeconds: number,
    private readonly bodyHeight: number
  ) {
    this.material = new THREE.SpriteMaterial({
      map: sparkTexture(),
      transparent: true,
      opacity: 1,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
      rotation: (((startedAtSeconds * 17.0) % 1) - 0.5) * 0.22,
    });
    this.sprite = new THREE.Sprite(this.material);
    this.sprite.renderOrder = 10_040;
    this.three.name = "harthmere-confirmed-melee-hit-spark";
    this.three.userData.harthmereMeleeHitSpark = {
      version: HARTHMERE_MELEE_HIT_SPARK_EFFECT_VERSION,
      style: "compact-white-gold-contact-starburst",
      durationSeconds: HARTHMERE_MELEE_HIT_SPARK_DURATION_SECONDS,
      confirmedMeleeOnly: true,
      containsText: false,
    };
    this.three.add(this.sprite);
  }

  setContactPosition(position: ReadonlyVec3) {
    this.basePosition.fromArray(position);
  }

  tick(nowSeconds: number) {
    const state = harthmereMeleeHitSparkPresentation(
      Math.max(0, nowSeconds - this.startedAtSeconds)
    );
    this.three.visible = state.visible;
    if (!state.visible) {
      return false;
    }
    const size = Math.max(0.18, Math.min(0.42, this.bodyHeight * 0.22));
    this.three.position.copy(this.basePosition);
    this.sprite.scale.setScalar(size * state.scale);
    this.material.opacity = state.opacity;
    return true;
  }

  dispose() {
    this.material.dispose();
    this.three.removeFromParent();
  }
}
