// HARTHMERE_LOOT_DROP_MARKERS (audit fix, 2026-07-13)
//
// Visible, terrain-grounded world bodies for live-mode loot drops (thrown
// items, combat loot). Before this, loot drops existed ONLY as rows in the
// inventory UI tab and as an invisible 7.5-block F-prompt radius — a thrown
// item vanished from view and silently expired ("thrown voxel item not
// shown" / "missing items"). This renderer draws every available drop as a
// small glowing satchel the player can see and walk to; the F-prompt pickup
// itself still lives in `HarthmereLootDropWorldInteraction`.
//
// Data flow: `HarthmereLootDropWorldInteraction` polls the live inventory
// loot state and publishes into `harthmereLootDropWorldState`; this renderer
// only reads that store (revision-checked per frame — no polling of its own).
// Grounding mirrors the gathering-node/quest-object marker renderers: the one
// shared tri-state probe with keep-last-surface memory from
// `@/client/game/util/harthmere_entity_grounding`, so drops rest on the real
// surface instead of floating or burying.

import {
  getHarthmereWorldLootDrops,
  getHarthmereWorldLootDropsRevision,
} from "@/client/components/challenges/harthmereLootDropWorldState";
import type { Renderer } from "@/client/game/renderers/renderer_controller";
import type { Scenes } from "@/client/game/renderers/scenes";
import { addToScenes } from "@/client/game/renderers/scenes";
import type { ClientResources } from "@/client/game/resources/types";
import { harthmereGroundedFeetYWithMemory } from "@/client/game/util/harthmere_entity_grounding";
import type { HarthmereInventoryLootDrop } from "@/shared/harthmere/mmo_inventory_loot_authority";
import * as THREE from "three";

export const HARTHMERE_LOOT_DROP_MARKER_VERSION =
  "harthmere-loot-drop-markers" as const;

const LOOT_DROP_ACCENT = 0xf4c66a; // matches the F-prompt's gold accent

function material(color: number, opacity = 1) {
  return new THREE.MeshBasicMaterial({
    color,
    opacity,
    transparent: opacity < 1,
  });
}

export function createHarthmereLootDropMesh(
  drop: HarthmereInventoryLootDrop
): THREE.Group {
  const group = new THREE.Group();
  group.name = `Loot drop ${drop.dropId} ${HARTHMERE_LOOT_DROP_MARKER_VERSION}`;
  const position = drop.position ?? { x: 0, y: 0, z: 0 };
  group.position.set(position.x, position.y ?? 0, position.z);

  // A small satchel: dark base sack + gold strap + hovering glow cube so the
  // drop reads from a distance without blocking movement.
  const sack = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.4, 0.5),
    material(0x4a3826)
  );
  sack.name = "Loot drop sack";
  sack.position.set(0, 0.2, 0);
  sack.frustumCulled = false;
  group.add(sack);

  const strap = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.09, 0.56),
    material(LOOT_DROP_ACCENT)
  );
  strap.name = "Loot drop strap";
  strap.position.set(0, 0.3, 0);
  strap.frustumCulled = false;
  group.add(strap);

  const glow = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.2, 0.2),
    // Keep the whole marker in the opaque scene. A translucent child makes
    // addToScenes classify one root as both `three` and `translucent`, which
    // production logs as a mixed-scene mesh and can skip the drop marker.
    material(0xffe8a6)
  );
  glow.name = "Loot drop glow";
  glow.position.set(0, 0.75, 0);
  glow.rotation.set(0.5, 0.5, 0.2);
  glow.frustumCulled = false;
  group.add(glow);

  const light = new THREE.PointLight(LOOT_DROP_ACCENT, 0.5, 5, 1.8);
  light.name = "Loot drop light";
  light.position.set(0, 0.7, 0);
  group.add(light);

  // World XZ + authored Y hint used by per-frame terrain grounding.
  group.userData.harthmereLootDropId = drop.dropId;
  group.userData.harthmereLootDropWorldXZ = [position.x, position.z];
  group.userData.harthmereLootDropHintY = position.y ?? 0;
  return group;
}

export class HarthmereLootDropMarkerRenderer implements Renderer {
  public readonly name = HARTHMERE_LOOT_DROP_MARKER_VERSION;
  private readonly root = new THREE.Group();
  private readonly meshes = new Map<string, THREE.Group>();
  private lastSeenRevision = -1;
  private elapsed = 0;
  // Per-column last-grounded surface memory (same grounder as NPCs/items).
  private readonly groundedFeetYByColumn = new Map<string, number>();

  constructor(private readonly resources?: ClientResources) {
    this.root.name = `harthmere-loot-drop-markers root ${HARTHMERE_LOOT_DROP_MARKER_VERSION}`;
  }

  draw(scenes: Scenes, dt: number): void {
    addToScenes(scenes, this.root);
    this.elapsed += Math.min(dt, 0.05);
    this.reconcileDrops();
    this.groundAndAnimateDrops();
  }

  // Add meshes for new drops, dispose meshes for claimed/expired ones. Only
  // runs when the store revision changed — zero per-frame cost otherwise.
  private reconcileDrops(): void {
    const revision = getHarthmereWorldLootDropsRevision();
    if (revision === this.lastSeenRevision) {
      return;
    }
    this.lastSeenRevision = revision;
    const drops = getHarthmereWorldLootDrops();
    const liveIds = new Set(drops.map((drop) => drop.dropId));
    for (const [dropId, mesh] of this.meshes) {
      if (!liveIds.has(dropId)) {
        this.root.remove(mesh);
        mesh.traverse((child) => {
          const asMesh = child as THREE.Mesh;
          asMesh.geometry?.dispose?.();
          (asMesh.material as THREE.Material | undefined)?.dispose?.();
        });
        this.meshes.delete(dropId);
      }
    }
    for (const drop of drops) {
      if (this.meshes.has(drop.dropId)) continue;
      const mesh = createHarthmereLootDropMesh(drop);
      this.meshes.set(drop.dropId, mesh);
      this.root.add(mesh);
    }
  }

  // Rest each drop on the real terrain surface; bob the glow gently so the
  // drop catches the eye. Hidden while its terrain column is unknown (never
  // shown buried at the raw throw Y).
  private groundAndAnimateDrops(): void {
    if (!this.resources) {
      return;
    }
    for (const mesh of this.meshes.values()) {
      const xz = mesh.userData.harthmereLootDropWorldXZ as
        | [number, number]
        | undefined;
      const hintY = mesh.userData.harthmereLootDropHintY as number | undefined;
      if (!xz || hintY === undefined) {
        continue;
      }
      const feetY = harthmereGroundedFeetYWithMemory(
        this.resources,
        this.groundedFeetYByColumn,
        xz[0],
        xz[1],
        hintY,
        false
      );
      if (feetY !== undefined) {
        mesh.position.y = feetY;
        mesh.visible = true;
      } else {
        mesh.visible = false;
      }
      const glow = mesh.getObjectByName("Loot drop glow");
      if (glow) {
        glow.position.y = 0.75 + Math.sin(this.elapsed * 2.2) * 0.08;
        glow.rotation.y += 0.01;
      }
    }
  }
}

export function makeHarthmereLootDropMarkersRenderer(
  resources?: ClientResources
) {
  return new HarthmereLootDropMarkerRenderer(resources);
}
