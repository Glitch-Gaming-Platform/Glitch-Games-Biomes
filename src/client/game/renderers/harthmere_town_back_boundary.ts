// HARTHMERE_TOWN_BACK_BOUNDARY (client visual)
//
// One wall, on one side of Harthmere.
//
// The dungeon horizon draws a BOX because a dungeon is closed on all sides.
// Harthmere is open on three: the connector road from the main world enters
// from the west, and north/south are the town's own approaches. Drawing a box
// here would visibly wall a player in on sides they are free to walk through,
// so this is a single PlaneGeometry facing west, standing at the back
// boundary.
//
// Shared with the dungeon wall (see ch1_dungeon_horizon_boundary.ts for the
// reasoning behind each):
//   * RGB constant, pattern as ALPHA — reads as a field, not wallpaper.
//   * Quintic depth fade so it stays out of your sightlines until you are
//     nearly touching it.
//   * Triplanar UVs from world position, so the pattern holds a constant
//     real-world scale across a wall ~770 voxels wide.
//   * Proximity culled well inside the fade distance.
//
// DIFFERENT ON PURPOSE: the tint. The dungeon walls borrow their aperture's
// palette because they are time-bleed edges. Harthmere's back wall is a
// political border — the edge of the land the kingdom will not open — so it
// takes Harthmere's own cold iron-grey rather than any Exotic Matter colour.
// Harthmere would find a glowing barrier obscene.
//
// ENGINE CONTRACT: draws a mesh. Not an ECS entity, moves no NPC, edits no
// voxel, owns no collision — `harthmereTownBackBoundarySlabs()` feeds the
// ordinary solver.

import type { Renderer } from "@/client/game/renderers/renderer_controller";
import type { Scenes } from "@/client/game/renderers/scenes";
import { addToScenes } from "@/client/game/renderers/scenes";
import type { ClientResources } from "@/client/game/resources/types";
import {
  HARTHMERE_TOWN_BACK_BOUNDARY_X,
  HARTHMERE_TOWN_BACK_WALL_TOP_Y,
  HARTHMERE_TOWN_BACKDROP_MAX_Z,
  HARTHMERE_TOWN_BACKDROP_MIN_Z,
  HARTHMERE_TOWN_GROUND_Y,
  HARTHMERE_BACK_WALL_DRAW_DISTANCE,
  HARTHMERE_BACK_WALL_FADE_DISTANCE,
  harthmereBackWallDistance,
  harthmereTownAuthoredToWorldX,
} from "@/shared/harthmere/harthmere_town_horizon";
import * as THREE from "three";

// Constants and cull maths live in the SHARED module so their contract is
// testable without the client graph. Re-exported for renderer call sites.
export {
  HARTHMERE_BACK_WALL_DRAW_DISTANCE,
  HARTHMERE_BACK_WALL_FADE_DISTANCE,
  harthmereBackWallDistance,
};

/** Harthmere's own colour: cold worked iron. Not an Exotic Matter glow. */
const HARTHMERE_BACK_WALL_TINT: readonly [number, number, number] = [
  0.62, 0.66, 0.72,
];

// NB: no backticks inside these GLSL template literals — a backtick in a
// shader COMMENT silently terminates the string and swc reports a confusing
// "Expected a semicolon" pointing at the next line of GLSL.
const WALL_VERT = /* glsl */ `
varying vec2 _texCoord;
void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  // The wall faces west, so its own plane is YZ: derive UVs from world Z and Y
  // directly. That keeps the pattern at a constant real-world scale across a
  // wall hundreds of voxels wide, which default plane UVs would stretch.
  _texCoord = vec2(worldPos.z, worldPos.y);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const WALL_FRAG = /* glsl */ `
precision highp float;
uniform vec3  uTint;
uniform float uTime;
uniform float uFadeDistance;
uniform float uFadePower;
uniform float uFadeOpacity;
varying vec2 _texCoord;

// Procedural: zero texture memory, nothing to ship. Quantised into bands so it
// stays chunky and voxel-appropriate rather than a smooth photoreal shimmer.
float pattern(vec2 uv, float t) {
  vec2 p = uv * 0.22;
  float a = sin(p.x + t * 0.21);
  float b = sin(p.y - t * 0.17);
  float c = sin((p.x - p.y) * 0.5 + t * 0.09);
  float v = (a * b + c) * 0.5 + 0.5;
  return floor(v * 5.0) / 5.0;
}

void main() {
  float fragDepth = gl_FragCoord.z / gl_FragCoord.w;
  float alphaFromPattern = pattern(_texCoord, uTime);
  float fade = pow(max(0.0, 1.0 - fragDepth / uFadeDistance), uFadePower);
  float opacity = clamp(fade * (uFadeOpacity + alphaFromPattern), 0.0, 1.0);
  if (opacity <= 0.001) {
    discard;
  }
  // RGB constant; the pattern is opacity only.
  gl_FragColor = vec4(uTint, opacity);
}
`;

interface BackWall {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  worldX: number;
  minZ: number;
  maxZ: number;
}

function buildBackWall(): BackWall {
  const worldX = harthmereTownAuthoredToWorldX(HARTHMERE_TOWN_BACK_BOUNDARY_X);
  const minZ = HARTHMERE_TOWN_BACKDROP_MIN_Z;
  const maxZ = HARTHMERE_TOWN_BACKDROP_MAX_Z;
  // Start below ground so there is no gap where the wall meets sloped terrain.
  const bottomY = HARTHMERE_TOWN_GROUND_Y - 24;
  const topY = HARTHMERE_TOWN_BACK_WALL_TOP_Y;

  const width = maxZ - minZ;
  const height = topY - bottomY;

  const material = new THREE.ShaderMaterial({
    vertexShader: WALL_VERT,
    fragmentShader: WALL_FRAG,
    transparent: true,
    depthWrite: false,
    // Single plane: the player only ever sees its west face, but DoubleSide
    // costs nothing here and avoids an invisible wall if a camera clips past.
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: {
      // Explicit args rather than a spread: THREE.Color is overloaded, and
      // spreading a readonly tuple into an overloaded constructor is exactly
      // the sort of thing that resolves fine today and breaks on a three
      // upgrade. The sibling dungeon renderer does the same.
      uTint: {
        value: new THREE.Color(
          HARTHMERE_BACK_WALL_TINT[0],
          HARTHMERE_BACK_WALL_TINT[1],
          HARTHMERE_BACK_WALL_TINT[2]
        ),
      },
      uTime: { value: 0 },
      uFadeDistance: { value: HARTHMERE_BACK_WALL_FADE_DISTANCE },
      uFadePower: { value: 5 },
      uFadeOpacity: { value: 0.8 },
    },
  });
  material.polygonOffset = true;
  material.polygonOffsetFactor = -4;

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    material
  );
  // PlaneGeometry is built in the XY plane. Rotating +90 deg about Y maps its
  // width axis onto world Z, so the quad stands in the YZ plane at worldX —
  // which is what we want. Its normal ends up along +X (east); DoubleSide
  // means the west face the player actually looks at still renders.
  mesh.rotation.y = Math.PI / 2;
  mesh.position.set(worldX, bottomY + height / 2, minZ + width / 2);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2990;
  return { mesh, material, worldX, minZ, maxZ };
}

export const makeHarthmereTownBackBoundaryRenderer = (
  resources: ClientResources
): Renderer => {
  let wall: BackWall | undefined;

  return {
    name: "harthmereTownBackBoundary",

    draw(scenes: Scenes, _dt: number) {
      const localPlayer = resources.get("/scene/local_player");
      const position = localPlayer.player.position as [number, number, number];

      // Cheap reject before building anything: most of the game is nowhere
      // near Harthmere's back wall, and the Grove must not pay for it.
      const worldX = harthmereTownAuthoredToWorldX(
        HARTHMERE_TOWN_BACK_BOUNDARY_X
      );
      if (
        Math.abs(position[0] - worldX) > HARTHMERE_BACK_WALL_DRAW_DISTANCE ||
        position[2] < HARTHMERE_TOWN_BACKDROP_MIN_Z ||
        position[2] > HARTHMERE_TOWN_BACKDROP_MAX_Z
      ) {
        if (wall) {
          wall.material.dispose();
          wall.mesh.geometry.dispose();
          wall = undefined;
        }
        return;
      }

      if (!wall) {
        wall = buildBackWall();
      }
      const distance = harthmereBackWallDistance(
        position,
        wall.worldX,
        wall.minZ,
        wall.maxZ
      );
      if (distance > HARTHMERE_BACK_WALL_DRAW_DISTANCE) {
        return;
      }
      wall.material.uniforms.uTime.value = resources.get("/clock").time;
      addToScenes(scenes, wall.mesh);
    },
  };
};
