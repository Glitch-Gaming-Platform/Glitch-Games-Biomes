// CHAPTER_1_DUNGEON_HORIZON_BOUNDARY (client visual)
//
// The wall at the edge of a dungeon. One box, one shader, one draw call.
//
// This is deliberately modelled on the world-boundary renderer, because that
// solved the same problem well:
//
//   * ONE BoxGeometry sized to the playable AABB, `DoubleSide` (you are always
//     inside it), `polygonOffset` biased toward the camera so it cannot
//     z-fight the terrain it hugs.
//   * The texture contributes ALPHA ONLY; RGB is a constant tint. That is what
//     makes it read as an energy field rather than a painted surface.
//   * A quintic depth fade — `pow(1 - d/fadeDistance, 5)`. Effectively
//     invisible until ~15 m, then ramps hard. The barrier stays out of your
//     sightlines while you play and is unmistakable when you are about to walk
//     into it.
//   * Triplanar UVs derived from world position via the face's own tangent
//     frame, so the pattern holds a constant real-world scale on a box that is
//     hundreds of voxels across. A stretched default UV on geometry this size
//     looks like a bug.
//   * Culled unless the player is near a face — a single `min` over six
//     distances, thresholded inside the shader's fade distance so the box
//     always pops in while still fully transparent.
//
// WHERE IT DELIBERATELY DIFFERS
// The world edge is violet, because it is a fact about the universe. A dungeon
// boundary is a fact about the APERTURE: only so much of the past came through.
// So it is tinted per era from the gate's own palette — bronze for Nerash-Utu,
// pale blue for Hrafnsfjörðr — which visually ties the wall to the portal that
// created it.
//
// ENGINE CONTRACT: identical to the gate renderer. This draws a mesh. It is not
// an ECS entity, it moves no NPC, it edits no voxel, and it does not own
// collision — `ch1HorizonBoundarySlabs()` feeds the ordinary solver, exactly as
// the world boundary feeds it.

import type { Renderer } from "@/client/game/renderers/renderer_controller";
import type { Scenes } from "@/client/game/renderers/scenes";
import { addToScenes } from "@/client/game/renderers/scenes";
import type { ClientResources } from "@/client/game/resources/types";
import {
  ch1DungeonAuthoredToWorld,
  CH1_DUNGEON_TERRAIN,
} from "@/shared/harthmere/ch1_dungeon_terrain";
import {
  CH1_HORIZON_DRAW_DISTANCE,
  CH1_HORIZON_FADE_DISTANCE,
  ch1HorizonDistanceToNearestFace,
  ch1HorizonEra,
  ch1PlayableBounds,
} from "@/shared/harthmere/ch1_dungeon_horizon";
import * as THREE from "three";

// The fade/draw distances and the cull maths live in the SHARED horizon module
// so their contract is testable in ~1 s without the client graph. Re-exported
// here for renderer call sites.
export {
  CH1_HORIZON_DRAW_DISTANCE,
  CH1_HORIZON_FADE_DISTANCE,
  ch1HorizonDistanceToNearestFace,
};

// NB: no backticks inside these GLSL template literals — a backtick in a
// shader COMMENT silently terminates the string and swc reports a confusing
// "Expected a semicolon" pointing at the next line of GLSL.
const BOUNDARY_VERT = /* glsl */ `
varying vec2 _texCoord;
varying vec3 _worldPos;
void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  _worldPos = worldPos.xyz;
  // Triplanar UVs from the face's own tangent frame. The normal.yzx cyclic
  // swizzle is valid for the six axis-aligned box normals and is branch-free.
  vec3 tangent   = normal.yzx;
  vec3 cotangent = cross(normal, normal.yzx);
  _texCoord = vec2(dot(tangent, worldPos.xyz), dot(cotangent, worldPos.xyz));
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const BOUNDARY_FRAG = /* glsl */ `
precision highp float;
uniform vec3  uTint;
uniform float uTime;
uniform float uFadeDistance;
uniform float uFadePower;
uniform float uFadeOpacity;
varying vec2 _texCoord;
varying vec3 _worldPos;

// Procedural stand-in for the boundary pattern texture: a slow drifting
// interference of two axis waves. Keeping it procedural means zero texture
// memory and no asset to ship, and the quantization step keeps it chunky and
// voxel-appropriate rather than a smooth photoreal shimmer.
float pattern(vec2 uv, float t) {
  vec2 p = uv * 0.25;
  float a = sin(p.x + t * 0.35);
  float b = sin(p.y - t * 0.27);
  float c = sin((p.x + p.y) * 0.5 + t * 0.11);
  float v = (a * b + c) * 0.5 + 0.5;
  // Quantise to voxel-sized bands.
  return floor(v * 6.0) / 6.0;
}

void main() {
  float fragDepth = gl_FragCoord.z / gl_FragCoord.w;   // ~view-space distance
  float alphaFromPattern = pattern(_texCoord, uTime);
  float fade = pow(max(0.0, 1.0 - fragDepth / uFadeDistance), uFadePower);
  float opacity = clamp(fade * (uFadeOpacity + alphaFromPattern), 0.0, 1.0);
  if (opacity <= 0.001) {
    discard;
  }
  // RGB is CONSTANT. The pattern is opacity only — that is what makes this an
  // energy field instead of wallpaper.
  gl_FragColor = vec4(uTint, opacity);
}
`;

interface HorizonBoundaryObject {
  dungeonId: string;
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  /** World-space AABB used for the proximity cull. */
  min: [number, number, number];
  max: [number, number, number];
}

function buildBoundary(dungeonId: string): HorizonBoundaryObject | undefined {
  const terrain = CH1_DUNGEON_TERRAIN.find((t) => t.dungeonId === dungeonId);
  const era = ch1HorizonEra(dungeonId);
  if (!terrain || !era) {
    return undefined;
  }
  const bounds = ch1PlayableBounds(terrain);
  const min = ch1DungeonAuthoredToWorld(dungeonId, {
    x: bounds.x0,
    y: bounds.y0,
    z: bounds.z0,
  }) as [number, number, number];
  const max = ch1DungeonAuthoredToWorld(dungeonId, {
    x: bounds.x1,
    y: bounds.y1,
    z: bounds.z1,
  }) as [number, number, number];

  const size: [number, number, number] = [
    max[0] - min[0],
    max[1] - min[1],
    max[2] - min[2],
  ];
  const material = new THREE.ShaderMaterial({
    vertexShader: BOUNDARY_VERT,
    fragmentShader: BOUNDARY_FRAG,
    transparent: true,
    depthWrite: false,
    // You are always INSIDE the box, so the inward faces must render.
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: {
      uTint: {
        value: new THREE.Color(
          era.boundaryColour[0],
          era.boundaryColour[1],
          era.boundaryColour[2]
        ),
      },
      uTime: { value: 0 },
      uFadeDistance: { value: CH1_HORIZON_FADE_DISTANCE },
      // Quintic: ~0.1% opacity at 30 m, 24% at 10 m, 88% at 1 m.
      uFadePower: { value: 5 },
      uFadeOpacity: { value: 0.85 },
    },
  });
  // Bias toward the camera so the wall never z-fights the ground it hugs.
  material.polygonOffset = true;
  material.polygonOffsetFactor = -4;

  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2
  );
  mesh.frustumCulled = false;
  mesh.renderOrder = 2990;
  return { dungeonId, mesh, material, min, max };
}


/**
 * Which dungeon the player is currently inside, if any. Published by the same
 * story-state sync that owns gate visibility; the renderer never decides.
 */
export type Ch1ActiveDungeonRunId = () => string | undefined;

export const makeCh1DungeonHorizonBoundaryRenderer = (
  resources: ClientResources,
  activeDungeonRunId: Ch1ActiveDungeonRunId
): Renderer => {
  const objects = new Map<string, HorizonBoundaryObject>();

  return {
    name: "ch1DungeonHorizonBoundary",

    draw(scenes: Scenes, _dt: number) {
      const runId = activeDungeonRunId();
      // Outside a dungeon there is no boundary to draw. Dispose eagerly: the
      // Grove should never pay for dungeon geometry.
      if (!runId) {
        for (const stale of objects.values()) {
          stale.material.dispose();
          stale.mesh.geometry.dispose();
        }
        objects.clear();
        return;
      }

      let object = objects.get(runId);
      if (!object) {
        const built = buildBoundary(runId);
        if (!built) {
          return;
        }
        // Only one dungeon boundary can be live at a time.
        for (const stale of objects.values()) {
          stale.material.dispose();
          stale.mesh.geometry.dispose();
        }
        objects.clear();
        objects.set(runId, built);
        object = built;
      }

      const clock = resources.get("/clock");
      const localPlayer = resources.get("/scene/local_player");
      const position = localPlayer.player.position as [number, number, number];

      const distance = ch1HorizonDistanceToNearestFace(
        position,
        object.min,
        object.max
      );
      // Comfortably inside the shader's 40 m fade, so the box always pops in
      // while still fully transparent.
      if (distance > CH1_HORIZON_DRAW_DISTANCE) {
        return;
      }
      object.material.uniforms.uTime.value = clock.time;
      addToScenes(scenes, object.mesh);
    },
  };
};
