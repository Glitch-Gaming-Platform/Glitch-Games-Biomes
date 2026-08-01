import type { Renderer } from "@/client/game/renderers/renderer_controller";
import type { Scenes } from "@/client/game/renderers/scenes";
import {
  harthmereBusinessOutpostRuntimeOffsetForTest,
} from "@/client/game/renderers/local_dev/harthmere_business_outpost_buildings";
import {
  HARTHMERE_BUSINESS_OUTPOSTS,
  HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS,
  harthmereBusinessOutpostBusinessId,
} from "@/shared/harthmere/business_customer_simulator";
import * as THREE from "three";

export const HARTHMERE_BUSINESS_BOARD_PROCEDURAL_MARKER_VERSION =
  "harthmere-business-board-procedural-marker" as const;
export const HARTHMERE_BUSINESS_BOARD_PROCEDURAL_POLISH_VERSION =
  "harthmere-business-board-compact-service-list" as const;

const BUSINESS_BOARD_ACCENTS = [
  0x4cc9ff,
  0xffd54f,
  0x8ce99a,
  0xff8fab,
  0xb197fc,
  0xffb74d,
] as const;

export interface HarthmereBusinessBoardMarkerLocation
{
  id: string;
  label: string;
  x: number;
  y: number;
  z: number;
  accentColor: number;
  outpostId: string;
  businessType: string;
  businessId: string;
  yaw: number;
}

export const HARTHMERE_BUSINESS_BOARD_INTERACTION_RADIUS = 9;

export const HARTHMERE_BUSINESS_BOARD_MARKER_LOCATIONS: readonly HarthmereBusinessBoardMarkerLocation[] =
  HARTHMERE_BUSINESS_OUTPOSTS.map((outpost, index) => {
    const record =
      HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS[outpost.outpostId];
    const point = record.dashboardAccessPoint.position;
    return {
      id: `${outpost.outpostId}:procedural-business-board`,
      outpostId: outpost.outpostId,
      businessType: outpost.businessType,
      businessId: harthmereBusinessOutpostBusinessId(outpost.outpostId),
      label: `${outpost.displayName} Business Board`,
      x: point.x,
      y: point.y,
      z: point.z,
      yaw: outpost.position.rot,
      accentColor:
        BUSINESS_BOARD_ACCENTS[index % BUSINESS_BOARD_ACCENTS.length],
    };
  });

export function nearestHarthmereBusinessBoardPhysicalPrompt(
  playerPosition:
    | {
        x: number;
        y?: number;
        z: number;
      }
    | undefined,
) {
  if (!playerPosition) return undefined;
  let best: HarthmereBusinessBoardMarkerLocation | undefined;
  let bestDistance = Infinity;
  for (const location of HARTHMERE_BUSINESS_BOARD_MARKER_LOCATIONS) {
    const distance = Math.hypot(
      location.x - playerPosition.x,
      location.z - playerPosition.z,
    );
    if (
      distance > HARTHMERE_BUSINESS_BOARD_INTERACTION_RADIUS ||
      distance >= bestDistance
    ) {
      continue;
    }
    const dy = Math.abs((playerPosition.y ?? location.y) - location.y);
    if (dy > 5) continue;
    best = location;
    bestDistance = distance;
  }
  return best
    ? {
        id: best.id,
        outpostId: best.outpostId,
        businessType: best.businessType,
        businessId: best.businessId,
        displayName: best.label,
        position: { x: best.x, y: best.y, z: best.z },
        radius: HARTHMERE_BUSINESS_BOARD_INTERACTION_RADIUS,
        distance: bestDistance,
      }
    : undefined;
}

function material(color: number, opacity = 1) {
  return new THREE.MeshBasicMaterial({
    color,
    opacity,
    transparent: opacity < 1,
  });
}

function box(
  group: THREE.Group,
  name: string,
  size: [number, number, number],
  position: [number, number, number],
  mat: THREE.MeshBasicMaterial,
  part: string,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.frustumCulled = false;
  mesh.userData.harthmereBusinessBoardPart = part;
  mesh.userData.harthmereBusinessBoardMarkerVersion =
    HARTHMERE_BUSINESS_BOARD_PROCEDURAL_MARKER_VERSION;
  mesh.userData.harthmereBusinessBoardPolishVersion =
    HARTHMERE_BUSINESS_BOARD_PROCEDURAL_POLISH_VERSION;
  group.add(mesh);
  return mesh;
}

export function createHarthmereBusinessBoardMarkerMesh(
  location: HarthmereBusinessBoardMarkerLocation,
): THREE.Group {
  const offset = harthmereBusinessOutpostRuntimeOffsetForTest();
  const group = new THREE.Group();
  group.name = `${location.label} ${HARTHMERE_BUSINESS_BOARD_PROCEDURAL_MARKER_VERSION}`;
  group.position.set(location.x + offset.x, location.y, location.z + offset.z);
  group.rotation.y = location.yaw;
  group.userData.harthmereBusinessBoardMarkerVersion =
    HARTHMERE_BUSINESS_BOARD_PROCEDURAL_MARKER_VERSION;
  group.userData.harthmereBusinessBoardPolishVersion =
    HARTHMERE_BUSINESS_BOARD_PROCEDURAL_POLISH_VERSION;
  group.userData.harthmereBusinessBoardMarkerId = location.id;
  group.userData.harthmereBusinessBoardOutpostId = location.outpostId;
  group.userData.harthmereBusinessBoardBusinessType = location.businessType;
  group.userData.harthmereBusinessBoardRuntimeOffset = offset;

  const accent = new THREE.Color(location.accentColor);
  const mats = {
    frame: material(0x34241c),
    wood: material(0x8a6742),
    face: material(0xc19a62),
    dark: material(0x182033),
    paper: material(0xf0ddb2),
    paperAlt: material(0xe5c78d),
    check: material(location.accentColor),
    glow: material(accent.clone().lerp(new THREE.Color(0xffffff), 0.42).getHex()),
    stone: material(0x9da6ad),
  };

  box(group, "Business Board low stone base", [4.1, 0.22, 1.2], [0, 0.11, 0], mats.stone, "stone_base");
  box(group, "Business Board left post", [0.28, 2.65, 0.28], [-1.85, 1.5, 0], mats.frame, "post");
  box(group, "Business Board right post", [0.28, 2.65, 0.28], [1.85, 1.5, 0], mats.frame, "post");
  box(group, "Business Board service list face", [3.35, 2.38, 0.18], [0, 1.72, -0.04], mats.face, "service_list_face");
  box(group, "Business Board top rail", [3.75, 0.28, 0.26], [0, 3.02, -0.02], mats.wood, "top_rail");
  box(group, "Business Board title strip", [2.38, 0.22, 0.09], [0, 2.72, -0.16], mats.dark, "title_strip");
  box(group, "Business Board use F tile", [0.52, 0.48, 0.1], [1.35, 2.72, -0.18], mats.glow, "use_f_tile");

  for (let i = 0; i < 5; i += 1) {
    const y = 2.34 - i * 0.38;
    const rowMat = i % 2 === 0 ? mats.paper : mats.paperAlt;
    box(group, `Business Board listed service ${i + 1}`, [2.72, 0.26, 0.08], [0.12, y, -0.18], rowMat, "service_row");
    box(group, `Business Board service checkbox ${i + 1}`, [0.18, 0.18, 0.09], [-1.2, y, -0.24], mats.check, "service_checkbox");
    box(group, `Business Board service title line ${i + 1}`, [1.08, 0.045, 0.1], [-0.42, y + 0.045, -0.25], mats.dark, "service_text_line");
    box(group, `Business Board service detail line ${i + 1}`, [0.78, 0.035, 0.1], [-0.57, y - 0.055, -0.25], mats.dark, "service_text_line");
    box(group, `Business Board payout/status chip ${i + 1}`, [0.44, 0.08, 0.1], [1.08, y, -0.25], mats.check, "status_chip");
  }

  box(group, "Business Board front access glow", [1.35, 0.035, 0.74], [0, 0.25, -0.76], mats.glow, "front_access_glow");
  const light = new THREE.PointLight(location.accentColor, 0.7, 8, 1.8);
  light.name = "Business Board compact glow";
  light.position.set(0, 2.6, -0.65);
  light.userData.harthmereBusinessBoardPart = "soft_prompt_light";
  light.userData.harthmereBusinessBoardMarkerVersion =
    HARTHMERE_BUSINESS_BOARD_PROCEDURAL_MARKER_VERSION;
  group.add(light);

  group.traverse((child) => {
    child.userData.harthmereBusinessBoardMarkerId = location.id;
  });
  return group;
}

export class HarthmereBusinessBoardMarkerRenderer implements Renderer {
  public readonly name = HARTHMERE_BUSINESS_BOARD_PROCEDURAL_MARKER_VERSION;
  private readonly root = new THREE.Group();

  constructor() {
    this.root.name = `harthmere-business-board-markers root ${HARTHMERE_BUSINESS_BOARD_PROCEDURAL_MARKER_VERSION}`;
    for (const location of HARTHMERE_BUSINESS_BOARD_MARKER_LOCATIONS) {
      const marker = createHarthmereBusinessBoardMarkerMesh(location);
      this.root.add(marker);
    }
    this.publishDebugBridge();
  }

  draw(scenes: Scenes, _dt: number): void {
    // Procedural board materials are all stock Three.js materials. Direct
    // routing avoids two full hierarchy traversals in addToScenes().
    scenes.three.add(this.root);
  }

  private publishDebugBridge(): void {
    if (typeof window !== "undefined") {
      (window as any).__harthmereBusinessBoardMarkerDebug = {
        version: HARTHMERE_BUSINESS_BOARD_PROCEDURAL_MARKER_VERSION,
        boards: () =>
          HARTHMERE_BUSINESS_BOARD_MARKER_LOCATIONS.map((location) => ({
            id: location.id,
            label: location.label,
            outpostId: location.outpostId,
            businessType: location.businessType,
            position: [location.x, location.y, location.z],
            visible: this.root.children.some(
              (child) =>
                child.userData.harthmereBusinessBoardMarkerId ===
                  location.id && child.visible !== false,
            ),
          })),
      };
    }
  }
}

export function makeHarthmereBusinessBoardMarkerRenderer() {
  return new HarthmereBusinessBoardMarkerRenderer();
}
