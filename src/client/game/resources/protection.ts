import type { ClientContext } from "@/client/game/context";
import type { Scenes } from "@/client/game/renderers/scenes";
import { addToScenes } from "@/client/game/renderers/scenes";
import type {
  ClientResourceDeps,
  ClientResourcesBuilder,
} from "@/client/game/resources/types";
import type { AssetPath } from "@/galois/interface/asset_paths";
import { resolveAssetUrl } from "@/galois/interface/asset_paths";
import {
  makeHexagonalBloomMaterial,
  updateHexagonalBloomMaterial,
} from "@/gen/client/game/shaders/hexagonal_bloom";
import {
  makeProtectionMaterial,
  updateProtectionMaterial,
} from "@/gen/client/game/shaders/protection";
import { makeDisposable } from "@/shared/disposable";
import type { Entity } from "@/shared/ecs/gen/entities";
import type { BiomesId } from "@/shared/ids";
import { log } from "@/shared/logging";
import { anchorAndSizeToAABB, unionAABB } from "@/shared/math/linear";
import type { AABB, Vec2, Vec3, Vec4 } from "@/shared/math/types";
import type { RegistryLoader } from "@/shared/registry";
import { fireAndForget } from "@/shared/util/async";
import * as THREE from "three";

export type ProtectionBoundary = {
  aabb?: AABB;
  fields: AABB[];
};

export type ProtectionMapBoundary = {
  border: [Vec2, Vec2][];
  interior: [Vec2, Vec2][];
};

export interface ProtectionMesh {
  three: THREE.Mesh;
  update(playerPos: Vec3, fadeOut: number, time: number): void;
  draw(scenes: Scenes): void;
}

export interface ProtectionMaterial {
  three: THREE.Material;
  update(playerPos: Vec3, fadeOut: number, time: number): void;
}

function getEntityAABB(deps: ClientResourceDeps, id: BiomesId) {
  const pos = deps.get("/ecs/c/position", id)?.v;
  if (pos) {
    const size = deps.get("/ecs/c/size", id)?.v;
    if (size) {
      return anchorAndSizeToAABB(pos, size);
    }
  }
}

function protectionFields(deps: ClientResourceDeps, fieldIds: BiomesId[]) {
  const aabbs: AABB[] = [];
  for (const fieldId of fieldIds) {
    const aabb = getEntityAABB(deps, fieldId);
    if (aabb) {
      aabbs.push(aabb);
    }
  }
  return aabbs;
}

function robotFields(deps: ClientResourceDeps, robots: Entity[]) {
  const fieldIds = [];
  for (const robot of robots) {
    const fieldId = robot.projects_protection?.protectionChildId;
    if (fieldId) {
      fieldIds.push(fieldId);
    }
  }
  return protectionFields(deps, fieldIds);
}

function aabbUnion(aabbs: AABB[]) {
  let ret = undefined;
  for (const aabb of aabbs) {
    ret = unionAABB(aabb, ret ?? aabb);
  }
  return ret;
}

function genCreatorBoundary(deps: ClientResourceDeps, creator: BiomesId) {
  const robots = deps.get("/ecs/robots_by_creator_id", creator);
  const fields = robotFields(deps, robots);
  return { aabb: aabbUnion(fields), fields };
}

function genLandmarkBoundary(deps: ClientResourceDeps, landmark: string) {
  const robots = deps.get("/ecs/robots_by_landmark_name", landmark);
  const fields = robotFields(deps, robots);
  return { aabb: aabbUnion(fields), fields };
}

function genTeamBoundary(deps: ClientResourceDeps, id: BiomesId) {
  const ids = deps
    .get("/ecs/protection_by_team_id", id)
    .map((entity) => entity.id);
  const fields = protectionFields(deps, ids);
  return {
    aabb: aabbUnion(fields),
    fields,
  };
}

function genRobotBoundary(deps: ClientResourceDeps, id: BiomesId) {
  const landmark = deps.get("/ecs/c/landmark", id);
  if (landmark?.override_name) {
    return deps.get("/protection/landmark_boundary", landmark.override_name);
  }

  const protection = deps.get("/ecs/c/projects_protection", id);
  if (protection?.protectionChildId) {
    const fieldId = protection.protectionChildId;

    // Merge by appropriate ACL grouping if possible.
    const acl = deps.get("/ecs/c/acl_component", fieldId)?.acl;
    if (acl) {
      if (acl.creatorTeam?.[0]) {
        return deps.get("/protection/team_boundary", acl.creatorTeam[0]);
      } else if (acl.creator?.[0]) {
        return deps.get("/protection/creator_boundary", acl.creator[0]);
      }
    }

    // If ACL based merge didn't work, render the field on its own.
    const fields = protectionFields(deps, [fieldId]);
    return { aabb: aabbUnion(fields), fields };
  }

  return { fields: [] };
}

function genProtectionTexture(deps: ClientResourceDeps) {
  const tweaks = deps.get("/tweaks");
  const loader = new THREE.TextureLoader();
  const textureUrl = tweaks.protectionField.texture as AssetPath;
  const texture = loader.load(resolveAssetUrl(textureUrl));
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;

  return makeDisposable(texture, () => {
    texture.dispose();
  });
}

function buildDefaultProtectionMaterial(deps: ClientResourceDeps) {
  const tweaks = deps.get("/tweaks");
  const texture = deps.get("/protection/texture");

  // Build the mesh material.
  const material = makeProtectionMaterial({
    // pattern
    patternTexture: texture,
    texScale: [
      tweaks.protectionField.textureScale,
      tweaks.protectionField.textureScale,
    ],
    opacity: tweaks.protectionField.opacity,

    // modified by render loop as well
    fadeOut: 1.0,

    // Ring: ring around the player when they get close
    ringColor: [0.25, 1.0, 0.55, 1.0] as Vec4,
    ringFadeDistance: 50.0,
    ringFadePower: 4000.0,
    ringSize: tweaks.protectionField.ring ? 1.5 : 0.0,

    // Close: fade in when player gets close
    closeFadeDistance: 100.0,
    closeFadePower: 10.0,

    // Add a bit of opaqueness when very close
    closePlaneDistance: 3.0,
    closePlaneAlpha: tweaks.protectionField.highlight !== "none" ? 0.75 : 0.0,
    pixelHighlight: tweaks.protectionField.highlight === "pixel",

    // Tweak options
    fadeOutOpacityOnly: tweaks.protectionField.fadeOutOpacityOnly,
    hideBehindCharacter: tweaks.protectionField.hideBehindCharacter,
  });
  material.polygonOffset = true;
  material.polygonOffsetFactor = -4;

  return makeDisposable(
    {
      three: material,
      update: (playerPos: Vec3, fadeOut: number) => {
        updateProtectionMaterial(material, { playerPos, fadeOut });
      },
    },
    () => {
      material.dispose();
    }
  );
}

function buildHexagonalBloomMaterial(deps: ClientResourceDeps) {
  const tweaks = deps.get("/tweaks");

  // Build the mesh material.
  const material = makeHexagonalBloomMaterial({
    fadeOut: 1.0,
    playerPos: [0.0, 0.0, 0.0],
    maxIntensity: tweaks.protectionField.hexIntensity,
    hexThickness: tweaks.protectionField.hexThickness,
    hexSmoothing: tweaks.protectionField.hexSmoothing,
    hexGridScale: tweaks.protectionField.hexGridScale,
    quantization: tweaks.protectionField.hexQuantization,
    shimmeryBrightness: tweaks.protectionField.hexShimmerBrightness,
    shimmerySpeed: tweaks.protectionField.hexShimmerSpeed,
    shimmeryFatness: tweaks.protectionField.hexShimmerFatness,
    shimmeryFrequency: tweaks.protectionField.hexShimmerFrequency,
    heightScaling: tweaks.protectionField.heightScaling,
    hexColor: [1.3, 0.9, 2.5],
  });
  material.polygonOffset = true;
  material.polygonOffsetFactor = -4;

  return makeDisposable(
    {
      three: material,
      update: (playerPos: Vec3, fadeOut: number, time: number) => {
        updateHexagonalBloomMaterial(material, { playerPos, fadeOut, time });
      },
    },
    () => {
      material.dispose();
    }
  );
}

function genProtectionMaterial(deps: ClientResourceDeps) {
  const tweaks = deps.get("/tweaks");
  if (tweaks.protectionField.shader == "hexagonal_bloom") {
    return buildHexagonalBloomMaterial(deps);
  } else {
    return buildDefaultProtectionMaterial(deps);
  }
}

// HARTHMERE_CAYLEY_LAZY_LOAD (2026-08-04 asset loading audit, finding 3)
//
// The protection field geometry helpers live in `protection_geometry.ts`, which
// statically imports the 5.74 MB cayley numerics WASM. Because webpack is
// configured with `asyncWebAssembly`, a static import here would make this
// module -- and therefore `resources/init.ts`, and therefore client boot --
// await that download. Protection fields are cosmetic and most sessions never
// see one, so the module is pulled in on first use instead.
//
// While it is loading, the generators below return "nothing to draw". The
// `/protection/geometry_ready` global resource is flipped once the import
// resolves, and because every generator reads it, the resource system
// re-generates them at that point. That is the same dependency-injection
// pattern the rest of the resource layer uses; no polling, no timers.
type ProtectionGeometryModule =
  typeof import("@/client/game/resources/protection_geometry");

let protectionGeometry: ProtectionGeometryModule | undefined;
let protectionGeometryLoad: Promise<void> | undefined;
let onProtectionGeometryReady: (() => void) | undefined;

/**
 * Returns the geometry module if it is already resident, otherwise starts
 * loading it and returns undefined. Never throws: a failed load leaves
 * protection fields undrawn rather than breaking the frame.
 */
function ensureProtectionGeometry(): ProtectionGeometryModule | undefined {
  if (protectionGeometry) {
    return protectionGeometry;
  }
  if (!protectionGeometryLoad) {
    protectionGeometryLoad =
      import("@/client/game/resources/protection_geometry")
        .then((loaded) => {
          protectionGeometry = loaded;
          onProtectionGeometryReady?.();
        })
        .catch((error) => {
          log.warn("Failed to load protection field geometry (cayley WASM)", {
            error,
          });
          // Allow a later request to retry rather than pinning the failure.
          protectionGeometryLoad = undefined;
        });
  }
  return undefined;
}

/** Test seam: report whether the lazy module has been pulled in yet. */
export function protectionGeometryLoadedForTest() {
  return protectionGeometry !== undefined;
}

/**
 * The border of a single rectangle, without touching WASM.
 *
 * This is the robot placement preview's only case, and it is the one that has to
 * feel instant -- the player is holding the robot and moving it around. The
 * general union-of-rectangles outline needs the lazily loaded module.
 */
function singleRectBorder([min, max]: [Vec2, Vec2]): [Vec2, Vec2][] {
  const [x0, z0] = min;
  const [x1, z1] = max;
  return [
    [
      [x0, z0],
      [x1, z0],
    ],
    [
      [x1, z0],
      [x1, z1],
    ],
    [
      [x1, z1],
      [x0, z1],
    ],
    [
      [x0, z1],
      [x0, z0],
    ],
  ];
}

function genProtectionMesh(deps: ClientResourceDeps, id: BiomesId) {
  const tweaks = deps.get("/tweaks");
  if (tweaks.protectionField.shader === "none") {
    return;
  }
  // Depend on the flag so this regenerates when the geometry module arrives.
  deps.get("/protection/geometry_ready");
  const geometry = ensureProtectionGeometry();
  if (!geometry) {
    return;
  }

  if (tweaks.protectionField.hideWhenCameraHeld) {
    const selection = deps.get("/hotbar/selection");
    if (selection.kind === "camera") {
      return;
    }
  }

  const { aabb, fields } = deps.get("/protection/boundary", id);
  if (!aabb) {
    return;
  }

  // Build and return a new mesh Build and return a new mesh
  // TODO: Replace aabb below with fields once toQuads is good to go.
  const material = deps.get("/protection/material");
  const bufferGeometry = geometry.buildProtectionGeometry(fields);
  const three = new THREE.Mesh(bufferGeometry, material.three);
  return makeDisposable(
    {
      three,
      update(playerPos: Vec3, fadeOut: number, time: number) {
        material.update(playerPos, fadeOut, time);
      },
      draw(scenes: Scenes) {
        addToScenes(scenes, three);
      },
    },
    () => {
      // The lazily imported module is process-wide; only this mesh's concrete
      // BufferGeometry is owned by the resource instance.
      bufferGeometry.dispose();
    }
  );
}

export function getRobotProtectionBoundary(
  fields: AABB[]
): ProtectionMapBoundary {
  // Take the xz face of each field AABB.
  const interior: [Vec2, Vec2][] = [];
  for (const aabb of fields) {
    interior.push([
      [aabb[0][0], aabb[0][2]],
      [aabb[1][0], aabb[1][2]],
    ]);
  }

  // HARTHMERE_CAYLEY_LAZY_LOAD: a single field -- the robot placement preview,
  // and the common case for a lone robot -- is just the four edges of one
  // rectangle, so it never waits for (or downloads) the WASM. Merged fields need
  // the real union outline; until that module lands the map simply draws the
  // interior without its border.
  if (interior.length === 0) {
    return { interior, border: [] };
  }
  if (interior.length === 1) {
    return { interior, border: singleRectBorder(interior[0]) };
  }
  const geometry = ensureProtectionGeometry();
  return {
    interior,
    border: geometry ? geometry.unionRectBorder(interior) : [],
  };
}

function genRobotMapBoundary(deps: ClientResourceDeps, id: BiomesId) {
  const { aabb, fields } = deps.get("/protection/boundary", id);
  if (!aabb) {
    return;
  }
  // Re-generate once the union-outline module is available.
  deps.get("/protection/geometry_ready");

  return getRobotProtectionBoundary(fields);
}

export function addProtectionResources(
  loader: RegistryLoader<ClientContext>,
  builder: ClientResourcesBuilder
) {
  // HARTHMERE_CAYLEY_LAZY_LOAD: flipped once the geometry module resolves; the
  // protection generators depend on it, so the resource system regenerates them
  // at that moment instead of leaving the field permanently undrawn.
  builder.addGlobal("/protection/geometry_ready", { ready: false });
  onProtectionGeometryReady = () => {
    fireAndForget(
      loader
        .get("resources")
        .then((resources) =>
          resources.set("/protection/geometry_ready", { ready: true })
        )
    );
  };

  builder.add("/protection/creator_boundary", genCreatorBoundary);
  builder.add("/protection/landmark_boundary", genLandmarkBoundary);
  builder.add("/protection/team_boundary", genTeamBoundary);
  builder.add("/protection/boundary", genRobotBoundary);
  builder.add("/protection/map_boundary", genRobotMapBoundary);
  builder.add("/protection/material", genProtectionMaterial);
  builder.add("/protection/texture", genProtectionTexture);
  builder.add("/protection/mesh", genProtectionMesh);
}
