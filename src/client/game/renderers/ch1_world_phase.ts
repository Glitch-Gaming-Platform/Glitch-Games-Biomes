import type { Renderer } from "@/client/game/renderers/renderer_controller";
import type { Scenes } from "@/client/game/renderers/scenes";
import { addToScenes } from "@/client/game/renderers/scenes";
import type { ClientResources } from "@/client/game/resources/types";
import { CH1_ANCHORS } from "@/shared/harthmere/ch1_ids";
import * as THREE from "three";

let activeEffectIds = new Set<string>();
let anchorReadUntilMs = 0;

export function setCh1WorldPhaseEffectIds(ids: Iterable<string> | undefined) {
  activeEffectIds = new Set(ids ?? []);
}

export function setCh1AnchorReadUntilMs(untilMs: number) {
  anchorReadUntilMs = Math.max(0, untilMs);
}

function material(color: number, emissive = 0) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: emissive ? 0.45 : 0,
    roughness: 0.68,
    metalness: 0.42,
  });
}

function buildCollectiveTransport() {
  const root = new THREE.Group();
  root.name = "Chapter 1 Collective medical transport";
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(4.8, 2.2, 2.3),
    material(0x243b38)
  );
  body.position.y = 1.5;
  root.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 1.8, 2.1),
    material(0x304f4b)
  );
  cabin.position.set(2.1, 1.65, 0);
  root.add(cabin);
  for (const z of [-0.78, 0.78]) {
    const window = new THREE.Mesh(
      new THREE.BoxGeometry(0.82, 0.72, 0.05),
      material(0x9ce9df, 0x4ecdc4)
    );
    window.position.set(2.45, 1.85, z);
    root.add(window);
  }
  for (const x of [-1.55, 1.55]) {
    for (const z of [-1.12, 1.12]) {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.58, 0.58, 0.34, 16),
        material(0x111716)
      );
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, 0.58, z);
      root.add(wheel);
    }
  }
  const [x, y, z] = CH1_ANCHORS.returnstone_pad_office;
  root.position.set(x, y + 0.1, z + 5);
  root.rotation.y = -0.4;
  return root;
}

const ANCHOR_READ_POINTS = [
  CH1_ANCHORS.mosslawn_song_stones,
  CH1_ANCHORS.biome_anchor_leak,
  CH1_ANCHORS.gate_desert,
  CH1_ANCHORS.gate_winter,
  CH1_ANCHORS.gate_fence_sighting,
] as const;

function buildAnchorReadMarkers() {
  return ANCHOR_READ_POINTS.map((point, index) => {
    const root = new THREE.Group();
    root.name = `Chapter 1 anchor stress ${index}`;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(3.5 + index * 0.25, 0.09, 8, 48),
      new THREE.MeshBasicMaterial({
        color: index === 0 ? 0xfbbf24 : 0x67e8f9,
        transparent: true,
        opacity: 0.82,
        depthWrite: false,
      })
    );
    ring.rotation.x = Math.PI / 2;
    root.add(ring);
    for (let spokeIndex = 0; spokeIndex < 4; spokeIndex += 1) {
      const spoke = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.04, 7 + index * 0.5),
        new THREE.MeshBasicMaterial({
          color: 0x67e8f9,
          transparent: true,
          opacity: 0.38,
          depthWrite: false,
        })
      );
      spoke.rotation.y = (Math.PI / 4) * spokeIndex;
      root.add(spoke);
    }
    root.position.set(point[0], point[1] + 0.12, point[2]);
    return root;
  });
}

export function makeCh1WorldPhaseRenderer(
  resources: ClientResources
): Renderer {
  const transport = buildCollectiveTransport();
  const anchorReadMarkers = buildAnchorReadMarkers();
  return {
    name: "chapter1WorldPhase",
    draw(scenes: Scenes) {
      const localPlayer = resources.get("/scene/local_player");
      const position = localPlayer?.player?.position;
      // Warp/respawn transitions briefly retain the local-player resource while
      // clearing its simulation position. This renderer is decorative and must
      // skip that frame instead of taking the entire game loop down by indexing
      // an undefined tuple.
      if (
        !position ||
        position.length < 3 ||
        position.some((coordinate) => !Number.isFinite(coordinate))
      ) {
        return;
      }
      if (activeEffectIds.has("collective_transport_parked")) {
        const distance = Math.hypot(
          position[0] - transport.position.x,
          position[1] - transport.position.y,
          position[2] - transport.position.z
        );
        if (distance <= 240) addToScenes(scenes, transport);
      }
      if (Date.now() < anchorReadUntilMs) {
        for (const marker of anchorReadMarkers) {
          const distance = Math.hypot(
            position[0] - marker.position.x,
            position[1] - marker.position.y,
            position[2] - marker.position.z
          );
          if (distance <= 360) addToScenes(scenes, marker);
        }
      }
    },
  };
}
