// HARTHMERE_JOBS_BOARD_PROCEDURAL_MARKER_V144
//
// A bulletproof procedural renderer for the two Harthmere jobs boards.
// Earlier patches placed the boards using OBJ assets (`obj_kiosk`,
// `obj_shop_simple`, `obj_sign_post`...), but the snapshot-built runtime
// policy in `harthmere_assets.ts` filters out anything whose label matches
// /kiosk|shop|sign|building/ — the kiosks were silently dropped. Even with
// that filter widened to allow "Jobs Board" placements, the OBJ-based
// approach is fragile: a missing texture, a broken material, or a future
// filter widening can hide it again.
//
// This renderer builds the boards from raw THREE primitives (no asset load,
// no MTL parser, no OBJ loader, no scene-merge policy). The polished shape is
// a Grove public-service notice board:
//
//                    [ small animated pennant ]
//                [ voxel-block "JOBS" title rail ]
//      [lantern] [ framed posting board + paper notices ] [lantern]
//                 [ visible access step / interaction glow ]
//                         [ stone base, no collision ]
//
// Total footprint ~6.6m wide × 6.5m tall. Coordinates match the proximity-gate
// XZ + the player's reported feet Y so the kiosk renders exactly where the map
// pointer says it does.

import type { Renderer } from "@/client/game/renderers/renderer_controller";
import type { Scenes } from "@/client/game/renderers/scenes";
import { addToScenes } from "@/client/game/renderers/scenes";
import {
  HARTHMERE_BUSINESS_OUTPOSTS_V1,
  harthmereBusinessOutpostJobsBoardPositionV1,
} from "@/shared/harthmere/business_customer_simulator_v1";
import * as THREE from "three";

export const HARTHMERE_JOBS_BOARD_PROCEDURAL_MARKER_VERSION_V144 =
  "harthmere-jobs-board-procedural-marker-v144" as const;
export const HARTHMERE_JOBS_BOARD_PROCEDURAL_POLISH_VERSION_V146 =
  "harthmere-jobs-board-procedural-polish-v146" as const;
export const HARTHMERE_JOBS_BOARD_WANTED_NOTICE_GRAPHIC_VERSION_V148 =
  "harthmere-jobs-board-wanted-notice-graphic-v148" as const;
export const HARTHMERE_JOBS_BOARD_FRONT_FLIP_YAW_V147 = Math.PI;

export interface HarthmereJobsBoardMarkerLocationV144 {
  id: string;
  label: string;
  x: number;
  y: number;
  z: number;
  accentColor: number;
}

export const HARTHMERE_JOBS_BOARD_MARKER_LOCATIONS_V144: readonly HarthmereJobsBoardMarkerLocationV144[] = [
  {
    id: "harthmere_grove_market_jobs_board",
    label: "Grove Jobs Board",
    x: 501.99486179104775,
    y: 70,
    z: -132.00350672753194,
    // Bright cyan-blue so it pops against the Grove's pink/green palette.
    accentColor: 0x4cc9ff,
  },
  {
    id: "harthmere_town_market_jobs_board",
    label: "Harthmere Jobs Board",
    x: 1046,
    y: 65,
    z: -202,
    // Warm amber for the Harthmere market district.
    accentColor: 0xffb74d,
  },
  ...HARTHMERE_BUSINESS_OUTPOSTS_V1.map((outpost, index) => {
    const position = harthmereBusinessOutpostJobsBoardPositionV1(outpost);
    const palette = [0x4cc9ff, 0xffb74d, 0xf472b6, 0x84cc16, 0xc084fc];
    return {
      id: `${outpost.outpostId}_jobs_board`,
      label: `${outpost.displayName} Jobs Board`,
      x: position.x,
      y: position.y,
      z: position.z,
      accentColor: palette[index % palette.length],
    } satisfies HarthmereJobsBoardMarkerLocationV144;
  }),
];

function createHarthmereJobsBoardMaterialV146(color: THREE.Color, opacity = 1) {
  return new THREE.MeshBasicMaterial({
    color,
    opacity,
    transparent: opacity < 1,
  });
}

function addHarthmereJobsBoardBoxV146(
  group: THREE.Group,
  name: string,
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.MeshBasicMaterial,
  part: string
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.userData.harthmereJobsBoardPart = part;
  mesh.userData.harthmereJobsBoardPolishVersion =
    HARTHMERE_JOBS_BOARD_PROCEDURAL_POLISH_VERSION_V146;
  group.add(mesh);
  return mesh;
}

function addHarthmereJobsBoardLetterV146(
  group: THREE.Group,
  letter: "J" | "O" | "B" | "S",
  x: number,
  y: number,
  material: THREE.MeshBasicMaterial
) {
  const cell = 0.18;
  const depth = 0.055;
  const patterns: Record<"J" | "O" | "B" | "S", readonly [number, number][]> = {
    J: [
      [0, 0],
      [1, 0],
      [2, 0],
      [1, 1],
      [1, 2],
      [1, 3],
      [0, 4],
      [1, 4],
    ],
    O: [
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
      [2, 1],
      [0, 2],
      [2, 2],
      [0, 3],
      [2, 3],
      [0, 4],
      [1, 4],
      [2, 4],
    ],
    B: [
      [0, 0],
      [1, 0],
      [0, 1],
      [2, 1],
      [0, 2],
      [1, 2],
      [0, 3],
      [2, 3],
      [0, 4],
      [1, 4],
    ],
    S: [
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
      [0, 2],
      [1, 2],
      [2, 2],
      [2, 3],
      [0, 4],
      [1, 4],
      [2, 4],
    ],
  };

  const letterGroup = new THREE.Group();
  letterGroup.name = `Jobs Board voxel letter ${letter}`;
  letterGroup.userData.harthmereJobsBoardPart = "title_letter";
  letterGroup.userData.harthmereJobsBoardLetter = letter;
  letterGroup.userData.harthmereJobsBoardPolishVersion =
    HARTHMERE_JOBS_BOARD_PROCEDURAL_POLISH_VERSION_V146;
  letterGroup.position.set(x, y, 0.315);

  for (const [col, row] of patterns[letter]) {
    addHarthmereJobsBoardBoxV146(
      letterGroup,
      `Jobs Board ${letter} block`,
      [cell, cell, depth],
      [(col - 1) * cell, (2 - row) * cell, 0],
      material,
      "title_letter_block"
    );
  }
  group.add(letterGroup);
}

// Build the kiosk group for one board. Returns a THREE.Group rooted at the
// world feet position — caller does not need to translate.
export function createHarthmereJobsBoardKioskMeshV144(
  location: HarthmereJobsBoardMarkerLocationV144,
): THREE.Group {
  const group = new THREE.Group();
  group.name = `${location.label} kiosk ${HARTHMERE_JOBS_BOARD_PROCEDURAL_MARKER_VERSION_V144}`;
  group.position.set(location.x, location.y, location.z);
  group.userData.harthmereJobsBoardMarkerVersion =
    HARTHMERE_JOBS_BOARD_PROCEDURAL_MARKER_VERSION_V144;
  group.userData.harthmereJobsBoardPolishVersion =
    HARTHMERE_JOBS_BOARD_PROCEDURAL_POLISH_VERSION_V146;
  group.userData.harthmereJobsBoardGraphicVersion =
    HARTHMERE_JOBS_BOARD_WANTED_NOTICE_GRAPHIC_VERSION_V148;
  group.userData.harthmereJobsBoardGraphicSource =
    "wanted_board_notice_graphic";
  group.userData.harthmereJobsBoardMarkerId = location.id;
  group.userData.harthmereJobsBoardFrontYaw =
    HARTHMERE_JOBS_BOARD_FRONT_FLIP_YAW_V147;
  group.rotation.y = HARTHMERE_JOBS_BOARD_FRONT_FLIP_YAW_V147;

  const accent = new THREE.Color(location.accentColor);
  const deepAccent = accent.clone().multiplyScalar(0.58);
  const darkWood = new THREE.Color(0x3d2b23);
  const warmWood = new THREE.Color(0x9d7047);
  const stone = new THREE.Color(0xaab0b8);
  const darkStone = new THREE.Color(0x6f7885);
  const parchment = new THREE.Color(0xf3dfb1);
  const parchmentAlt = new THREE.Color(0xe9c98d);
  const warrantRed = new THREE.Color(0xb6374b);
  const noticeBlue = new THREE.Color(0xb9d7dd);
  const ink = new THREE.Color(0x233047);
  const gold = new THREE.Color(0xffd54f);
  const moss = new THREE.Color(0x577f5b);
  const glow = accent.clone().lerp(new THREE.Color(0xffffff), 0.45);

  const mats = {
    accent: createHarthmereJobsBoardMaterialV146(accent),
    deepAccent: createHarthmereJobsBoardMaterialV146(deepAccent),
    darkWood: createHarthmereJobsBoardMaterialV146(darkWood),
    warmWood: createHarthmereJobsBoardMaterialV146(warmWood),
    stone: createHarthmereJobsBoardMaterialV146(stone),
    darkStone: createHarthmereJobsBoardMaterialV146(darkStone),
    parchment: createHarthmereJobsBoardMaterialV146(parchment),
    parchmentAlt: createHarthmereJobsBoardMaterialV146(parchmentAlt),
    warrantRed: createHarthmereJobsBoardMaterialV146(warrantRed),
    noticeBlue: createHarthmereJobsBoardMaterialV146(noticeBlue),
    ink: createHarthmereJobsBoardMaterialV146(ink),
    gold: createHarthmereJobsBoardMaterialV146(gold),
    moss: createHarthmereJobsBoardMaterialV146(moss),
    glow: createHarthmereJobsBoardMaterialV146(glow),
  };

  // Stone plinth and access step: the front step makes the interaction point
  // obvious without registering collision.
  addHarthmereJobsBoardBoxV146(
    group,
    "Jobs Board stone plinth",
    [6.6, 0.38, 4.2],
    [0, 0.19, 0],
    mats.stone,
    "stone_plinth"
  );
  addHarthmereJobsBoardBoxV146(
    group,
    "Jobs Board dark stone shadow course",
    [6.9, 0.16, 4.45],
    [0, 0.08, 0],
    mats.darkStone,
    "stone_plinth_shadow"
  );
  addHarthmereJobsBoardBoxV146(
    group,
    "Jobs Board front access step",
    [2.6, 0.2, 0.85],
    [0, 0.52, 2.35],
    mats.darkStone,
    "front_access_step"
  );
  addHarthmereJobsBoardBoxV146(
    group,
    "Jobs Board interaction glow tile",
    [1.45, 0.04, 0.5],
    [0, 0.66, 2.42],
    mats.glow,
    "interaction_glow"
  );

  // Main framed notice board.
  addHarthmereJobsBoardBoxV146(
    group,
    "Jobs Board back plank",
    [5.35, 3.25, 0.28],
    [0, 2.78, 0],
    mats.deepAccent,
    "notice_board_back"
  );
  addHarthmereJobsBoardBoxV146(
    group,
    "Jobs Board warm timber face",
    [5.02, 2.92, 0.12],
    [0, 2.78, 0.21],
    mats.warmWood,
    "notice_board_face"
  );
  for (const x of [-2.78, 2.78]) {
    addHarthmereJobsBoardBoxV146(
      group,
      "Jobs Board carved side post",
      [0.46, 4.35, 0.55],
      [x, 2.5, 0],
      mats.darkWood,
      "side_post"
    );
    addHarthmereJobsBoardBoxV146(
      group,
      "Jobs Board post cap",
      [0.72, 0.34, 0.74],
      [x, 4.86, 0],
      mats.gold,
      "post_cap"
    );
  }
  for (const y of [1.16, 4.4]) {
    addHarthmereJobsBoardBoxV146(
      group,
      "Jobs Board horizontal frame rail",
      [5.95, 0.38, 0.52],
      [0, y, 0],
      mats.darkWood,
      "frame_rail"
    );
  }

  // Header plaque with readable voxel letters. It is a world prop, so these
  // are block-built instead of font/text geometry.
  addHarthmereJobsBoardBoxV146(
    group,
    "Jobs Board title plaque",
    [3.55, 0.88, 0.16],
    [0, 4.42, 0.31],
    mats.gold,
    "title_plaque"
  );
  addHarthmereJobsBoardLetterV146(group, "J", -1.15, 4.42, mats.ink);
  addHarthmereJobsBoardLetterV146(group, "O", -0.38, 4.42, mats.ink);
  addHarthmereJobsBoardLetterV146(group, "B", 0.39, 4.42, mats.ink);
  addHarthmereJobsBoardLetterV146(group, "S", 1.16, 4.42, mats.ink);

  // Posted notices: varied sizes, pinned corners, and ink rows so it reads as
  // an actual public job board from a player camera.
  const notices = [
    [-1.65, 3.36, 1.06, 0.82, mats.parchment, 0.2],
    [-0.42, 3.32, 1.02, 0.78, mats.parchmentAlt, -0.12],
    [0.82, 3.34, 1.18, 0.82, mats.parchment, 0.08],
    [1.78, 3.18, 0.62, 1.02, mats.parchmentAlt, -0.18],
    [-1.92, 2.24, 0.76, 0.96, mats.parchmentAlt, -0.08],
    [-0.88, 2.18, 0.96, 0.76, mats.parchment, 0.12],
    [0.28, 2.15, 0.84, 0.96, mats.parchmentAlt, 0.18],
    [1.34, 2.17, 0.98, 0.78, mats.parchment, -0.1],
    [-1.22, 1.42, 1.1, 0.52, mats.parchment, 0.04],
    [0.22, 1.42, 1.08, 0.52, mats.parchmentAlt, -0.06],
    [1.55, 1.43, 0.9, 0.55, mats.parchment, 0.09],
  ] as const;

  for (let index = 0; index < notices.length; index += 1) {
    const [x, y, width, height, material, rotation] = notices[index];
    const note = addHarthmereJobsBoardBoxV146(
      group,
      "Jobs Board posted notice",
      [width, height, 0.055],
      [x, y, 0.32],
      material,
      "posted_notice"
    );
    note.rotation.z = rotation;
    for (let line = 0; line < 3; line += 1) {
      const stripeWidth = width * (line === 2 ? 0.46 : 0.65);
      const stripe = addHarthmereJobsBoardBoxV146(
        group,
        "Jobs Board notice ink line",
        [stripeWidth, 0.035, 0.018],
        [
          x - width * 0.03,
          y + height * 0.2 - line * height * 0.18,
          0.37,
        ],
        mats.ink,
        "notice_ink_line"
      );
      stripe.rotation.z = rotation;
    }
    for (const pinX of [-width * 0.36, width * 0.36]) {
      const pin = addHarthmereJobsBoardBoxV146(
        group,
        "Jobs Board notice pin",
        [0.11, 0.11, 0.025],
        [x + pinX, y + height * 0.34, 0.39],
        mats.gold,
        "notice_pin"
      );
      pin.rotation.z = rotation;
    }
  }

  // Canopy, pennant, and small side ribbons make the prop recognizable at
  // spawn/fountain distance without looking like an unpolished debug monitor.
  addHarthmereJobsBoardBoxV146(
    group,
    "Jobs Board roof beam",
    [6.25, 0.34, 0.78],
    [0, 5.02, 0],
    mats.darkWood,
    "roof_beam"
  );
  addHarthmereJobsBoardBoxV146(
    group,
    "Jobs Board moss roof trim",
    [5.85, 0.18, 0.86],
    [0, 5.28, -0.04],
    mats.noticeBlue,
    "roof_trim"
  );
  addHarthmereJobsBoardBoxV146(
    group,
    "Jobs Board pennant pole",
    [0.16, 1.35, 0.16],
    [0, 5.92, 0],
    mats.darkWood,
    "pennant_pole"
  );
  const banner = addHarthmereJobsBoardBoxV146(
    group,
    "Jobs Board animated pennant",
    [2.35, 0.72, 0.08],
    [1.0, 6.22, 0],
    mats.accent,
    "animated_banner"
  );
  banner.userData.harthmereJobsBoardAnimatedBanner = true;

  for (const x of [-2.02, 2.02]) {
    addHarthmereJobsBoardBoxV146(
      group,
      "Jobs Board side ribbon",
      [0.38, 0.82, 0.07],
      [x, 4.82, 0.36],
      mats.accent,
      "side_ribbon"
    );
  }

  // Wanted-board graphic pass: jobs boards now share the same public notice
  // board read as the farming/wanted boards in the world: mixed papers, a
  // prominent red warrant, and a blue roof strip. Functionality remains the
  // jobs-board proximity gate; this is purely the reusable map prop graphic.
  addHarthmereJobsBoardBoxV146(
    group,
    "Jobs Board wanted graphic red warrant",
    [0.62, 0.92, 0.065],
    [1.42, 2.08, 0.43],
    mats.warrantRed,
    "wanted_board_warrant_notice"
  );
  addHarthmereJobsBoardBoxV146(
    group,
    "Jobs Board wanted graphic blue permit",
    [0.7, 1.0, 0.06],
    [0.74, 3.28, 0.43],
    mats.noticeBlue,
    "wanted_board_blue_notice"
  );
  addHarthmereJobsBoardBoxV146(
    group,
    "Jobs Board wanted graphic yellow slip",
    [0.42, 0.32, 0.06],
    [-1.82, 3.58, 0.43],
    mats.gold,
    "wanted_board_yellow_notice"
  );
  addHarthmereJobsBoardBoxV146(
    group,
    "Jobs Board wanted graphic source marker",
    [0.08, 0.08, 0.08],
    [0, 0.82, 2.16],
    mats.warrantRed,
    "wanted_board_graphic_marker"
  ).visible = false;

  // Lanterns in front and behind the prop make it easy to see from both
  // approach directions around the fountain path.
  for (const lx of [-3.0, 3.0]) {
    for (const lz of [-1.78, 1.78]) {
      addHarthmereJobsBoardBoxV146(
        group,
        "Jobs Board lantern post",
        [0.16, 1.32, 0.16],
        [lx, 1.18, lz],
        mats.darkWood,
        "lantern_post"
      );
      addHarthmereJobsBoardBoxV146(
        group,
        "Jobs Board lantern cap",
        [0.46, 0.16, 0.46],
        [lx, 1.91, lz],
        mats.darkWood,
        "lantern_cap"
      );
      addHarthmereJobsBoardBoxV146(
        group,
        "Jobs Board warm lantern",
        [0.36, 0.42, 0.36],
        [lx, 1.66, lz],
        mats.gold,
        "lantern_glow"
      );
    }
  }

  // A small floating point-light right above the board. The meshes use
  //    unlit materials so the board remains visible even if local lighting is
  //    dim or a scene pass changes, but this still helps nearby terrain read.
  const light = new THREE.PointLight(location.accentColor, 1.4, 18, 1.6);
  light.name = "Jobs Board soft proximity light";
  light.userData.harthmereJobsBoardPart = "soft_proximity_light";
  light.userData.harthmereJobsBoardPolishVersion =
    HARTHMERE_JOBS_BOARD_PROCEDURAL_POLISH_VERSION_V146;
  light.position.set(0, 5.8, 0.75);
  group.add(light);

  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = false;
      obj.receiveShadow = true;
      obj.frustumCulled = false;
    }
  });

  return group;
}

export class HarthmereJobsBoardMarkerRendererV144 implements Renderer {
  public readonly name = HARTHMERE_JOBS_BOARD_PROCEDURAL_MARKER_VERSION_V144;
  private readonly root = new THREE.Group();
  // Slow per-frame banner sway so the boards have a tiny bit of life.
  private elapsed = 0;
  private readonly banners: THREE.Object3D[] = [];

  constructor() {
    this.root.name = `harthmere-jobs-board-markers root ${HARTHMERE_JOBS_BOARD_PROCEDURAL_MARKER_VERSION_V144}`;
    for (const location of HARTHMERE_JOBS_BOARD_MARKER_LOCATIONS_V144) {
      const kiosk = createHarthmereJobsBoardKioskMeshV144(location);
      this.root.add(kiosk);
      kiosk.traverse((child) => {
        if (child.userData.harthmereJobsBoardAnimatedBanner) {
          this.banners.push(child);
        }
      });
    }
  }

  draw(scenes: Scenes, dt: number): void {
    // RendererController recreates Scenes on canvas attach/reconnect. Always
    // re-add this tiny root so a surviving renderer cannot leave the board
    // attached to an old scene and appear invisible after reload.
    addToScenes(scenes, this.root);
    this.elapsed += dt;
    for (const banner of this.banners) {
      banner.rotation.y = Math.sin(this.elapsed * 1.4) * 0.18;
    }
    if (typeof window !== "undefined") {
      (window as any).__harthmereJobsBoardMarkerDebugV144 = {
        version: HARTHMERE_JOBS_BOARD_PROCEDURAL_MARKER_VERSION_V144,
        polishVersion: HARTHMERE_JOBS_BOARD_PROCEDURAL_POLISH_VERSION_V146,
        graphicVersion: HARTHMERE_JOBS_BOARD_WANTED_NOTICE_GRAPHIC_VERSION_V148,
        boards: () =>
          HARTHMERE_JOBS_BOARD_MARKER_LOCATIONS_V144.map((location) => ({
            id: location.id,
            label: location.label,
            position: [location.x, location.y, location.z],
            visible: this.root.children.some(
              (child) =>
                child.userData.harthmereJobsBoardMarkerId === location.id &&
                child.visible !== false
            ),
          })),
      };
    }
  }
}

export function makeHarthmereJobsBoardMarkerRendererV144() {
  return new HarthmereJobsBoardMarkerRendererV144();
}
