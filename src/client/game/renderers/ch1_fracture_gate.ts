// CHAPTER_1_FRACTURE_GATE_RENDERER
//
// Draws every active Fracture Gate.
//
// ENGINE CONTRACT — this renderer is deliberately inert with respect to game
// authority, and must stay that way:
//
//   * NATIVE ECS. A gate is not an ECS entity and must never become one. It is
//     authored data (ch1_fracture_gates.ts) projected by the client. It has no
//     Health, no NpcMetadata, no inventory, and cannot be attacked, iced, or
//     persisted. Entry is a server-validated warp, not a collision.
//   * ANIMA. Nothing here touches NPC brains, spawn anchors, or
//     cinematicPauseUntil leases. Gates do not move NPCs and do not pause them.
//   * GAIA. Terrain simulation is untouched. The gate draws an emissive mesh
//     and a ground decal; it edits no voxels, spawns no shards, and does not
//     modify the sky/time-of-day clock. The Elsewhen void gap
//     (ch1_elsewhen_region.ts) is enforced by the terrain seeder, not here.
//
// Anything that changes world state on gate entry belongs in the server-side
// dungeon run handler, not in draw().

import type { Renderer } from "@/client/game/renderers/renderer_controller";
import type { Scenes } from "@/client/game/renderers/scenes";
import { addToScenes } from "@/client/game/renderers/scenes";
import type { ClientResources } from "@/client/game/resources/types";
import {
  ch1GateOpenAmount,
  ch1GateSeed,
  disposeCh1FractureGateMaterials,
  makeCh1FractureGateMaterials,
  updateCh1FractureGateMaterials,
  type Ch1GateEra,
  type Ch1GateMaterials,
} from "@/client/game/renderers/ch1_fracture_gate_material";
import {
  CH1_FRACTURE_GATES,
  type Ch1FractureGateDef,
} from "@/shared/harthmere/ch1_fracture_gates";
import { ch1Dungeon } from "@/shared/harthmere/ch1_dungeons";
import { ch1ElsewhenSlot } from "@/shared/harthmere/ch1_elsewhen_region";
import * as THREE from "three";

/** Beyond this the gate is not drawn at all. Mouths are landmarks, not fog. */
const CH1_GATE_DRAW_DISTANCE = 220;

/** Aperture dimensions in metres. A Mouth is person-sized and unwelcoming. */
const GATE_SIZES: Readonly<Record<string, { width: number; height: number }>> =
  {
    ch1_gate_fence_sighting: { width: 1.1, height: 2.0 },
    ch1_gate_desert: { width: 2.6, height: 4.2 },
    ch1_gate_winter: { width: 2.8, height: 4.4 },
    ch1_gate_prime: { width: 6.5, height: 9.0 },
  };

const GATE_ERAS: Readonly<Record<string, Ch1GateEra>> = {
  ch1_gate_fence_sighting: "unknown",
  ch1_gate_desert: "desert",
  ch1_gate_winter: "winter",
  ch1_gate_prime: "unknown",
};

/** The one that doesn't close is visibly worse than the ones that did. */
const GATE_INSTABILITY: Readonly<Record<string, number>> = {
  ch1_gate_fence_sighting: 0.35,
  ch1_gate_desert: 0.2,
  ch1_gate_winter: 0.25,
  ch1_gate_prime: 1.0,
};

export interface GateSceneObject {
  group: THREE.Group;
  materials: Ch1GateMaterials;
  aperture: THREE.Mesh;
  ground: THREE.Mesh;
  /** Wall-clock seconds at which this gate started opening. */
  openedAt: number;
}

function buildGateObject(gate: Ch1FractureGateDef): GateSceneObject {
  // A dungeon's far anchor uses the same visual identity as its Grove Mouth.
  // The synthetic `_return` id exists only so both meshes can coexist in the
  // renderer map; stripping it keeps size, palette, and motion consistent.
  const styleId = gate.id.endsWith("_return")
    ? gate.id.slice(0, -"_return".length)
    : gate.id;
  const size = GATE_SIZES[styleId] ?? { width: 2.4, height: 4.0 };
  const era = GATE_ERAS[styleId] ?? "unknown";
  const instability = GATE_INSTABILITY[styleId] ?? 0.3;
  const materials = makeCh1FractureGateMaterials({
    era,
    seed: ch1GateSeed(styleId),
    aspect: size.width / size.height,
    instability,
  });

  const group = new THREE.Group();

  // The aperture plane. Billboarded to the camera each frame so a Mouth is
  // never seen edge-on — it has no edge, it is a hole.
  const aperture = new THREE.Mesh(
    new THREE.PlaneGeometry(size.width, size.height, 1, 1),
    materials.aperture
  );
  aperture.position.set(0, size.height * 0.5, 0);
  aperture.frustumCulled = false;
  aperture.renderOrder = 3000;
  group.add(aperture);

  // Ground caustic. Flat, additive, sits just above the terrain to avoid
  // z-fighting without writing depth.
  const groundRadius = Math.max(size.width, size.height) * 1.15;
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(groundRadius, 48),
    materials.ground
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0.05, 0);
  ground.frustumCulled = false;
  ground.renderOrder = 2999;
  group.add(ground);

  group.position.set(gate.position[0], gate.position[1], gate.position[2]);

  return { group, materials, aperture, ground, openedAt: 0 };
}

/**
 * Which gates exist right now is server-authoritative story state
 * (ch1ActiveGates over the player's flags). It is passed in as a getter rather
 * than read from a client resource so this renderer stays a pure projection —
 * it draws what it is told and never decides whether a Mouth is open.
 */
export type Ch1ActiveGateIds = () => ReadonlySet<string> | undefined;

// The last set published by the server for this player. `undefined` means the
// client has not been told yet, in which case the renderer draws nothing new
// but keeps whatever is already staged — a story sync hiccup must not make a
// gate the player is standing next to blink out.
let publishedActiveGateIds: ReadonlySet<string> | undefined;
let publishedActiveDungeonRunId: string | undefined;

export interface Ch1FractureGateRenderDiagnostic {
  id: string;
  kind: "entry" | "exit";
  active: boolean;
  visible: boolean;
  distanceMeters: number;
  open: number;
  /** Shader clock proving the swirl is advancing rather than a static card. */
  animationSeconds: number;
  position: readonly [number, number, number];
}

let lastRenderSnapshot: {
  atMs: number;
  activeIds?: string[];
  gates: Ch1FractureGateRenderDiagnostic[];
} = { atMs: 0, gates: [] };

/** Called by the Chapter 1 story-state sync when flags change. */
export function setCh1ActiveGateIds(ids: Iterable<string> | undefined): void {
  publishedActiveGateIds = ids === undefined ? undefined : new Set(ids);
}

/** Called by the same story-state sync when a server-authorized run changes. */
export function setCh1ActiveDungeonRunId(runId: string | undefined): void {
  publishedActiveDungeonRunId = runId;
}

export function ch1ActiveGateIdsForRender(): ReadonlySet<string> | undefined {
  return publishedActiveGateIds;
}

/**
 * The dungeon the player is currently inside, if any. Shared with the horizon
 * boundary renderer so both read the SAME server-published run id rather than
 * each deciding for itself.
 */
export function ch1ActiveDungeonRunIdForRender(): string | undefined {
  return publishedActiveDungeonRunId;
}

function activeReturnGate(): Ch1FractureGateDef | undefined {
  if (!publishedActiveDungeonRunId) return;
  const dungeon = ch1Dungeon(publishedActiveDungeonRunId);
  const slot = ch1ElsewhenSlot(publishedActiveDungeonRunId);
  const source = dungeon
    ? CH1_FRACTURE_GATES.find((gate) => gate.id === dungeon.gateId)
    : undefined;
  if (!dungeon || !slot || !source) return;
  return {
    ...source,
    id: `${source.id}_return`,
    name: `${source.name} — Far Anchor`,
    position: [...slot.departure],
    // The far anchor remains until the server accepts the exit. It may not
    // self-close while the player is stranded in a warp-only region.
    behavior: "persistent",
    openSeconds: undefined,
  };
}

/**
 * Frame-level renderer evidence for the local browser E2E bridge. This is a
 * read-only projection of work the production renderer already performed; it
 * never creates a gate or changes story state.
 */
export function ch1FractureGateRenderSnapshot() {
  return {
    atMs: lastRenderSnapshot.atMs,
    activeIds: lastRenderSnapshot.activeIds
      ? [...lastRenderSnapshot.activeIds]
      : undefined,
    gates: lastRenderSnapshot.gates.map((gate) => ({ ...gate })),
  };
}

export const makeCh1FractureGateRenderer = (
  resources: ClientResources,
  activeGateIds: Ch1ActiveGateIds
): Renderer => {
  const objects = new Map<string, GateSceneObject>();

  return {
    name: "ch1FractureGate",

    draw(scenes: Scenes, _dt: number) {
      const clock = resources.get("/clock");
      const localPlayer = resources.get("/scene/local_player");
      const camera = resources.get("/scene/camera");
      const playerPos = localPlayer.player.position;
      const active = activeGateIds();
      const returnGate = activeReturnGate();
      const renderGates = returnGate
        ? [...CH1_FRACTURE_GATES, returnGate]
        : CH1_FRACTURE_GATES;
      const frame: Ch1FractureGateRenderDiagnostic[] = [];

      // `undefined` means story state has not synchronized yet. Drawing every
      // authored gate in that state leaked Act 2/5/6 portals into a fresh
      // session. Keep staged meshes out of the scene until the authoritative
      // active-id set arrives, matching the contract above this renderer.
      if (!active) {
        for (const stale of objects.values()) {
          disposeCh1FractureGateMaterials(stale.materials);
        }
        objects.clear();
        lastRenderSnapshot = {
          atMs: performance.now(),
          activeIds: undefined,
          gates: [],
        };
        return;
      }

      // Remove a far-anchor mesh immediately after a successful exit. It is a
      // synthetic render projection, so it is not present in the authored gate
      // list on the next frame and would otherwise remain cached forever.
      const renderIds = new Set(renderGates.map((gate) => gate.id));
      for (const [id, stale] of objects) {
        if (!renderIds.has(id)) {
          disposeCh1FractureGateMaterials(stale.materials);
          objects.delete(id);
        }
      }

      for (const gate of renderGates) {
        const kind = gate.id.endsWith("_return") ? "exit" : "entry";
        const gateIsActive = kind === "exit" || active.has(gate.id);
        if (!gateIsActive) {
          const stale = objects.get(gate.id);
          if (stale) {
            disposeCh1FractureGateMaterials(stale.materials);
            objects.delete(gate.id);
          }
          frame.push({
            id: gate.id,
            kind,
            active: false,
            visible: false,
            distanceMeters: Math.hypot(
              gate.position[0] - playerPos[0],
              gate.position[2] - playerPos[2]
            ),
            open: 0,
            animationSeconds: 0,
            position: gate.position,
          });
          continue;
        }

        const dx = gate.position[0] - playerPos[0];
        const dz = gate.position[2] - playerPos[2];
        const distanceMeters = Math.hypot(dx, dz);
        if (distanceMeters > CH1_GATE_DRAW_DISTANCE) {
          frame.push({
            id: gate.id,
            kind,
            active: true,
            visible: false,
            distanceMeters,
            open: 0,
            animationSeconds: 0,
            position: gate.position,
          });
          continue;
        }

        let obj = objects.get(gate.id);
        if (!obj) {
          obj = buildGateObject(gate);
          obj.openedAt = clock.time;
          objects.set(gate.id, obj);
        }

        const elapsed = clock.time - obj.openedAt;
        const open = ch1GateOpenAmount({
          elapsedSeconds: elapsed,
          closesAfterSeconds:
            gate.behavior === "transient" ? gate.openSeconds : undefined,
        });

        if (open <= 0 && gate.behavior === "transient" && elapsed > 0.5) {
          // The ninety seconds are up. Drop it; the story flag decides whether
          // it ever comes back.
          disposeCh1FractureGateMaterials(obj.materials);
          objects.delete(gate.id);
          frame.push({
            id: gate.id,
            kind,
            active: true,
            visible: false,
            distanceMeters,
            open,
            animationSeconds: clock.time,
            position: gate.position,
          });
          continue;
        }

        updateCh1FractureGateMaterials(obj.materials, {
          time: clock.time,
          open,
        });

        // Billboard the aperture about Y only. Keeping it upright preserves
        // the vesica silhouette; full billboarding makes it swim.
        const camPos = camera.three.position;
        obj.aperture.rotation.y = Math.atan2(
          camPos.x - gate.position[0],
          camPos.z - gate.position[2]
        );

        addToScenes(scenes, obj.group);
        frame.push({
          id: gate.id,
          kind,
          active: true,
          visible: true,
          distanceMeters,
          open,
          animationSeconds: clock.time,
          position: gate.position,
        });
      }

      lastRenderSnapshot = {
        atMs: performance.now(),
        activeIds: [...active, ...(returnGate ? [returnGate.id] : [])],
        gates: frame,
      };
    },
  };
};

/** Exposed for teardown tests and client shutdown. */
export function disposeCh1FractureGateRenderer(
  objects: Map<string, GateSceneObject>
): void {
  for (const obj of objects.values()) {
    disposeCh1FractureGateMaterials(obj.materials);
  }
  objects.clear();
}
