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
// no MTL parser, no OBJ loader, no scene-merge policy). The shape is:
//
//                       [   FAT BLUE FLAG TOP   ]
//                                |
//      [STAND]   [    BIG BLUE POSTING MONITOR    ]   [STAND]
//                   (yellow "JOB" plaque on front,
//                    framed by white scroll squares)
//                                |
//                       [ STONE BASE PLATFORM ]
//                       /\          /\
//                     [LAMP]      [LAMP]
//
// Total footprint ~6m wide × 5m tall. Coordinates match the proximity-gate
// XZ + the player's reported feet Y so the kiosk renders exactly where the
// map pointer says it does.

import type { Renderer } from "@/client/game/renderers/renderer_controller";
import type { Scenes } from "@/client/game/renderers/scenes";
import { addToScenes } from "@/client/game/renderers/scenes";
import * as THREE from "three";

export const HARTHMERE_JOBS_BOARD_PROCEDURAL_MARKER_VERSION_V144 =
  "harthmere-jobs-board-procedural-marker-v144" as const;

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
];

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
  group.userData.harthmereJobsBoardMarkerId = location.id;

  const accent = new THREE.Color(location.accentColor);
  const wood = new THREE.Color(0x7a4a2c);
  const stone = new THREE.Color(0xb0b4ba);
  const parchment = new THREE.Color(0xf6e6c2);
  const ink = new THREE.Color(0x1f2a44);
  const gold = new THREE.Color(0xffd54f);

  const mat = (color: THREE.Color) =>
    new THREE.MeshBasicMaterial({
      color,
    });

  // 1. Stone base platform — 6m × 0.5m × 4m, centered on the feet position.
  const base = new THREE.Mesh(new THREE.BoxGeometry(6, 0.5, 4), mat(stone));
  base.position.y = 0.25;
  group.add(base);

  // 2. Two wood stands flanking the board, 0.6m × 4m tall, 5m apart.
  for (const standX of [-2.4, 2.4]) {
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4, 0.6), mat(wood));
    stand.position.set(standX, 2.0 + 0.5, 0);
    group.add(stand);
  }

  // 3. The main "monitor" — a big slab between the stands.
  const monitor = new THREE.Mesh(new THREE.BoxGeometry(4.8, 3.0, 0.4), mat(accent));
  monitor.position.set(0, 2.0 + 0.5, 0);
  group.add(monitor);

  // 4. A yellow plaque on the monitor's front face that reads "JOBS".
  const plaque = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.9, 0.05),
    mat(gold),
  );
  plaque.position.set(0, 3.2, 0.22);
  group.add(plaque);

  // 5. Three rows of parchment squares to look like posted notices.
  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const note = new THREE.Mesh(
        new THREE.BoxGeometry(1.0, 0.7, 0.03),
        mat(parchment),
      );
      note.position.set((col - 1) * 1.3, 1.9 - row * 0.95, 0.22);
      group.add(note);
      // "ink" stripe for text.
      const inkStripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.05, 0.005),
        mat(ink),
      );
      inkStripe.position.set((col - 1) * 1.3, 1.9 - row * 0.95 - 0.1, 0.245);
      group.add(inkStripe);
    }
  }

  // 6. A wide banner/flag sitting on top of the monitor, raised on a pole.
  const pole = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.0, 0.2), mat(wood));
  pole.position.set(0, 5.5, 0);
  group.add(pole);
  const banner = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 1.2, 0.1),
    mat(accent),
  );
  banner.position.set(0.9, 5.8, 0);
  group.add(banner);

  // 7. Four ground lamps in a square around the kiosk so the player can
  //    see it from any angle, day or night.
  for (const lx of [-3.0, 3.0]) {
    for (const lz of [-1.8, 1.8]) {
      const lampPost = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 1.6, 0.18),
        mat(wood),
      );
      lampPost.position.set(lx, 0.8 + 0.5, lz);
      group.add(lampPost);
      const lampHead = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.5, 0.5),
        mat(gold),
      );
      lampHead.position.set(lx, 1.8 + 0.5, lz);
      group.add(lampHead);
    }
  }

  // 8. A small floating point-light right above the monitor. The meshes use
  //    unlit materials so the board remains visible even if local lighting is
  //    dim or a scene pass changes, but this still helps nearby terrain read.
  const light = new THREE.PointLight(location.accentColor, 1.4, 18, 1.6);
  light.position.set(0, 6.0, 0.5);
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
      const banner = kiosk.children.find(
        (c) =>
          c instanceof THREE.Mesh &&
          (c.geometry as THREE.BoxGeometry).parameters?.width === 3.6,
      );
      if (banner) this.banners.push(banner);
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
  }
}

export function makeHarthmereJobsBoardMarkerRendererV144() {
  return new HarthmereJobsBoardMarkerRendererV144();
}
