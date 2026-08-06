import type { HarthmereNpcStaggerKind } from "@/shared/npc/stagger";
import type { ReadonlyVec3 } from "@/shared/math/types";
import * as THREE from "three";

export const HARTHMERE_NPC_STAGGER_GRAPHICS_VERSION =
  "harthmere-npc-stagger-graphics-v1" as const;

const STYLE = {
  light: { color: 0xffdc78, shards: 6, scale: 0.8 },
  medium: { color: 0xff9f43, shards: 8, scale: 1.05 },
  heavy: { color: 0xff5c35, shards: 12, scale: 1.35 },
} as const satisfies Record<
  HarthmereNpcStaggerKind,
  { color: number; shards: number; scale: number }
>;

export class HarthmereNpcStaggerEffect {
  readonly three = new THREE.Group();
  private readonly material: THREE.MeshBasicMaterial;
  private readonly ring: THREE.Mesh;
  private readonly shardGeometry: THREE.BoxGeometry;
  private readonly ringGeometry: THREE.TorusGeometry;
  private readonly shards: Array<{
    mesh: THREE.Mesh;
    direction: THREE.Vector3;
    spin: THREE.Vector3;
  }> = [];

  constructor(
    readonly kind: HarthmereNpcStaggerKind,
    readonly startTime: number,
    readonly expiryTime: number,
    direction: ReadonlyVec3,
    bodyScale = 1
  ) {
    const style = STYLE[kind];
    const scale = Math.max(0.4, bodyScale) * style.scale;
    this.three.name = `harthmere-npc-stagger-${kind}`;
    this.three.userData.harthmereStaggerGraphics = {
      version: HARTHMERE_NPC_STAGGER_GRAPHICS_VERSION,
      kind,
      startTime,
      expiryTime,
      directional: true,
      voxelShards: style.shards,
    };
    this.material = new THREE.MeshBasicMaterial({
      color: style.color,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.ringGeometry = new THREE.TorusGeometry(
      0.42 * scale,
      0.045 * scale,
      6,
      20
    );
    this.ring = new THREE.Mesh(this.ringGeometry, this.material);
    this.ring.name = "stagger-poise-break-ring";
    this.three.add(this.ring);

    this.shardGeometry = new THREE.BoxGeometry(
      0.07 * scale,
      0.07 * scale,
      0.2 * scale
    );
    for (let i = 0; i < style.shards; i += 1) {
      const angle = (i / style.shards) * Math.PI * 2;
      const mesh = new THREE.Mesh(this.shardGeometry, this.material);
      mesh.name = `stagger-voxel-shard-${i}`;
      const shardDirection = new THREE.Vector3(
        Math.cos(angle),
        Math.sin(angle) * 0.72,
        0.35 + (i % 3) * 0.12
      ).normalize();
      this.shards.push({
        mesh,
        direction: shardDirection,
        spin: new THREE.Vector3(
          0.8 + (i % 2) * 0.45,
          1.1 + (i % 3) * 0.25,
          0.65 + (i % 4) * 0.2
        ),
      });
      this.three.add(mesh);
    }

    const impactDirection = new THREE.Vector3(
      Number(direction[0]) || 0,
      Number(direction[1]) || 0,
      Number(direction[2]) || 1
    );
    if (impactDirection.lengthSq() < 1e-6) impactDirection.set(0, 0, 1);
    impactDirection.normalize();
    this.three.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      impactDirection
    );
    this.three.renderOrder = 14;
  }

  tick(nowSeconds: number) {
    const duration = Math.max(0.001, this.expiryTime - this.startTime);
    const progress = THREE.MathUtils.clamp(
      (nowSeconds - this.startTime) / duration,
      0,
      1
    );
    const burst = 1 - Math.pow(1 - progress, 3);
    const fade = Math.pow(1 - progress, 1.6);
    this.material.opacity = fade;
    this.ring.scale.setScalar(0.45 + burst * 1.9);
    this.ring.rotation.z = progress * 0.55;
    for (let i = 0; i < this.shards.length; i += 1) {
      const shard = this.shards[i];
      const distance = (0.18 + i * 0.012) * (0.4 + burst * 2.2);
      shard.mesh.position.copy(shard.direction).multiplyScalar(distance);
      shard.mesh.rotation.set(
        shard.spin.x * progress,
        shard.spin.y * progress,
        shard.spin.z * progress
      );
      shard.mesh.scale.setScalar(Math.max(0.05, fade));
    }
    this.three.visible = nowSeconds >= this.startTime && progress < 1;
    return this.three.visible;
  }

  dispose() {
    this.three.removeFromParent();
    this.ringGeometry.dispose();
    this.shardGeometry.dispose();
    this.material.dispose();
  }
}
