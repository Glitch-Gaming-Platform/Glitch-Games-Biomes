// PROMO_SCENE_REGISTRY
//
// Promotional stills are authored cutscenes, not hand-positioned browser
// screenshots. Every entry is structurally testable without a GPU and can be
// captured individually or as part of a warm-page batch.
//
// PRESENT-DAY CAST POLICY — LOAD BEARING
// A real player or seeded ECS NPC must render through the snapshot player-like
// appearance pipeline. Generic `townsperson_*` ghosts are forbidden here: that
// fallback was the source of the blocky wrong-NPC screenshots. Ghost bindings
// remain valid only for actual memory/flashback scenes in ch1_scenes.ts.

import {
  validateCutsceneDef,
  type CutsceneDef,
  type CutsceneVec3,
} from "@/shared/cutscene/schema";
import { ch1DungeonAuthoredToWorld } from "@/shared/harthmere/ch1_dungeon_terrain";

export const PROMO_SCENES_VERSION =
  "promo-scenes-v2-real-cast-landscape-batch" as const;

export interface PromoBrand {
  /** Always the game name. Rendered large, top-left. */
  title: string;
  /** Small monospace kicker under the title. */
  subtitle: string;
  /** Exact single-line campaign lockup, when requested. */
  headline?: string;
}

export interface PromoSceneDef {
  /** The `?cutscenePromo=<id>` query value. */
  id: string;
  shotId: string;
  captureAt: number;
  captureAtMax: number;
  filename: string;
  brand: PromoBrand;
  observer: { position: CutsceneVec3; orientation: [number, number] };
  build: () => Promise<CutsceneDef> | CutsceneDef;
  /** Warm-page capture groups, e.g. chapter1-sectors or chapter1-all. */
  groups?: readonly string[];
}

type DungeonId = "ch1_dungeon_desert" | "ch1_dungeon_winter";
type AuthoredPoint = readonly [number, number, number];

function world(dungeonId: DungeonId, point: AuthoredPoint): CutsceneVec3 {
  return ch1DungeonAuthoredToWorld(dungeonId, {
    x: point[0],
    y: point[1],
    z: point[2],
  });
}

function validPromoScene(raw: unknown, id: string): CutsceneDef {
  const result = validateCutsceneDef(raw);
  if (!result.ok) {
    throw new Error(
      `${id} is invalid: ${result.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join("; ")}`
    );
  }
  return result.def;
}

function safePromoSettings(timeOfDay: number, prewarmTimeoutSeconds = 12) {
  return {
    skippable: false,
    skipAfterSeconds: 20,
    lockPlayer: true,
    hideHud: true,
    letterbox: false,
    invulnerablePlayer: true,
    timeOfDay,
    mode: "clientPuppet" as const,
    prewarmTimeoutSeconds,
    commitOn: [] as const,
    maxSceneDurationSeconds: 20,
  };
}

// ---------------------------------------------------------------------------
// Gate traversal marketing still
// ---------------------------------------------------------------------------

const DESERT_GATE_ANCHOR: CutsceneVec3 = [648, 57, -462];

function dungeonPortalScene(): CutsceneDef {
  const gate = DESERT_GATE_ANCHOR;
  const gateCentre: CutsceneVec3 = [gate[0], gate[1] + 2.1, gate[2]];
  const playerAt: CutsceneVec3 = [gate[0] - 1.6, gate[1], gate[2] + 4.4];
  const beyondGate: CutsceneVec3 = [gate[0] + 0.25, gate[1], gate[2] - 3.2];
  const camFar: CutsceneVec3 = [gate[0] - 4.8, gate[1] + 1.75, gate[2] + 8.9];
  const camNear: CutsceneVec3 = [gate[0] - 3.5, gate[1] + 1.68, gate[2] + 6.8];

  return validPromoScene(
    {
      id: "promo-dungeon-portal",
      name: "Player Crossing a Fracture Gate Promotional Still",
      version: 2,
      priority: 100_000,
      settings: safePromoSettings(0.78, 10),
      cast: [
        { role: "player", binding: { kind: "player" }, required: true },
        {
          role: "gate",
          binding: {
            kind: "anchor",
            position: gateCentre,
            height: 4.2,
            label: "The Old Wood Aperture",
          },
        },
        {
          role: "beyondGate",
          binding: {
            kind: "anchor",
            position: beyondGate,
            height: 1.8,
            label: "Beyond the Old Wood Aperture",
          },
        },
      ],
      shots: [
        {
          id: "portal-crossing",
          duration: 6,
          camera: {
            kind: "dolly",
            waypoints: [{ position: camFar }, { position: camNear }],
            lookAtRole: "gate",
            easing: "easeInOut",
          },
          actions: [
            { kind: "fov", at: 0, fov: 38 },
            { kind: "teleport", at: 0, role: "player", to: playerAt },
            {
              kind: "moveTo",
              at: 0.25,
              role: "player",
              to: { role: "beyondGate" },
              speed: 2.15,
              arriveWithin: 0.35,
              timeoutSeconds: 8,
              timeoutFallback: "teleport",
            },
            { kind: "sfx", at: 0.2, name: "snapshot.gate.hum", atRole: "gate" },
            {
              kind: "shake",
              at: 1.4,
              magnitude: 0.012,
              repeats: 6,
              durationMs: 2200,
            },
          ],
        },
      ],
      onEnd: { placements: [], commits: [] },
    },
    "promo-dungeon-portal"
  );
}

// ---------------------------------------------------------------------------
// Dungeon action marketing stills — real authenticated player only
//
// Arbitrary far-away ECS NPC ids are not guaranteed to be in the client's
// streamed interest set, even when the records exist. Marketing shots therefore
// use the authenticated player plus environmental action. They never downgrade
// a missing NPC to a generic humanoid body.
// ---------------------------------------------------------------------------

function sandThatRemembersScene(): CutsceneDef {
  const playerAt = world("ch1_dungeon_desert", [168, 3, -54]);
  const playerGoal = world("ch1_dungeon_desert", [184, 3, -55]);
  const marketFocus = world("ch1_dungeon_desert", [181, 5, -58]);
  const sandImpact = world("ch1_dungeon_desert", [198, 4, -42]);
  // Stay inside the authored market court. The old camera began on the south
  // volume boundary, so the still was mostly foreground floor and unloaded
  // horizon instead of the player, oasis court, and market architecture.
  const cameraFar = world("ch1_dungeon_desert", [157, 9, -44]);
  const cameraNear = world("ch1_dungeon_desert", [163, 7, -49]);

  return validPromoScene(
    {
      id: "promo-ch1-sand-that-remembers",
      name: "The Sand That Remembers Landscape Action Still",
      version: 2,
      priority: 100_000,
      settings: safePromoSettings(0.31),
      cast: [
        { role: "player", binding: { kind: "player" }, required: true },
        {
          role: "playerGoal",
          binding: { kind: "anchor", position: playerGoal, height: 1.8 },
        },
        {
          role: "marketFocus",
          binding: {
            kind: "anchor",
            position: marketFocus,
            height: 2.4,
            label: "The Salt Market oasis court",
          },
        },
        {
          role: "sandImpact",
          binding: { kind: "anchor", position: sandImpact, height: 1.1 },
        },
      ],
      shots: [
        {
          id: "market-action",
          duration: 6,
          camera: {
            kind: "dolly",
            waypoints: [{ position: cameraFar }, { position: cameraNear }],
            lookAtRole: "marketFocus",
            easing: "easeInOut",
          },
          actions: [
            { kind: "fov", at: 0, fov: 39 },
            { kind: "teleport", at: 0, role: "player", to: playerAt },
            {
              kind: "moveTo",
              at: 0.35,
              role: "player",
              to: { role: "playerGoal" },
              speed: 3.1,
              arriveWithin: 0.5,
              timeoutSeconds: 6,
              timeoutFallback: "teleport",
            },
            {
              kind: "vfx",
              at: 1.8,
              effect: "combatImpact",
              atRole: "sandImpact",
              scale: 2.25,
            },
            {
              kind: "shake",
              at: 1.85,
              magnitude: 0.014,
              repeats: 3,
              durationMs: 480,
            },
          ],
        },
      ],
      onEnd: { placements: [], commits: [] },
    },
    "promo-ch1-sand-that-remembers"
  );
}

function longWinterMouthScene(): CutsceneDef {
  const playerAt = world("ch1_dungeon_winter", [226, 1, -88]);
  const playerGoal = world("ch1_dungeon_winter", [247, 1, -88]);
  const iceFocus = world("ch1_dungeon_winter", [250, 3, -88]);
  const offAxisImpact = world("ch1_dungeon_winter", [274, 2, -98]);
  // Look down the Whale Road itself. Shooting from the south volume boundary
  // made the player microscopic and exposed the un-authored void beyond the
  // fjord shell.
  const cameraFar = world("ch1_dungeon_winter", [210, 7, -88]);
  const cameraNear = world("ch1_dungeon_winter", [218, 6, -88]);

  return validPromoScene(
    {
      id: "promo-ch1-long-winter-mouth",
      name: "The Long Winter Mouth Fjord Action Still",
      version: 2,
      priority: 100_000,
      settings: safePromoSettings(0.84),
      cast: [
        { role: "player", binding: { kind: "player" }, required: true },
        {
          role: "playerGoal",
          binding: { kind: "anchor", position: playerGoal, height: 1.8 },
        },
        {
          role: "iceFocus",
          binding: {
            kind: "anchor",
            position: iceFocus,
            height: 2.4,
            label: "The Whale Road",
          },
        },
        {
          role: "offAxisImpact",
          binding: { kind: "anchor", position: offAxisImpact, height: 1.2 },
        },
      ],
      shots: [
        {
          id: "fjord-action",
          duration: 6,
          camera: {
            kind: "dolly",
            waypoints: [{ position: cameraFar }, { position: cameraNear }],
            lookAtRole: "iceFocus",
            easing: "easeInOut",
          },
          actions: [
            { kind: "fov", at: 0, fov: 38 },
            { kind: "teleport", at: 0, role: "player", to: playerAt },
            {
              kind: "moveTo",
              at: 0.25,
              role: "player",
              to: { role: "playerGoal" },
              speed: 3.4,
              arriveWithin: 0.5,
              timeoutSeconds: 6,
              timeoutFallback: "teleport",
            },
            {
              kind: "vfx",
              at: 1.9,
              effect: "combatImpact",
              atRole: "offAxisImpact",
              scale: 2.35,
            },
            {
              kind: "shake",
              at: 1.95,
              magnitude: 0.015,
              repeats: 3,
              durationMs: 520,
            },
          ],
        },
      ],
      onEnd: { placements: [], commits: [] },
    },
    "promo-ch1-long-winter-mouth"
  );
}

// ---------------------------------------------------------------------------
// Every-sector proof registry
// ---------------------------------------------------------------------------

interface DungeonSectorProofSpec {
  id: string;
  filename: string;
  dungeonId: DungeonId;
  dungeonName: string;
  zoneName: string;
  focus: AuthoredPoint;
  player: AuthoredPoint;
  cameraFar: AuthoredPoint;
  cameraNear: AuthoredPoint;
  timeOfDay: number;
  fov?: number;
}

export const CH1_DUNGEON_SECTOR_PROOFS: readonly DungeonSectorProofSpec[] =
  Object.freeze([
    {
      id: "d1-dune-threshold",
      filename: "proof-d1-dune-threshold.png",
      dungeonId: "ch1_dungeon_desert",
      dungeonName: "The Sand That Remembers",
      zoneName: "Dune Threshold",
      focus: [65, 20, -55],
      player: [50, 19, -58],
      cameraFar: [43, 25, -32],
      cameraNear: [48, 23, -37],
      timeOfDay: 0.28,
      fov: 42,
    },
    {
      id: "d1-salt-market",
      filename: "proof-d1-salt-market.png",
      dungeonId: "ch1_dungeon_desert",
      dungeonName: "The Sand That Remembers",
      zoneName: "The Salt Market",
      focus: [179, 5, -58],
      player: [166, 3, -54],
      cameraFar: [157, 9, -44],
      cameraNear: [163, 7, -49],
      timeOfDay: 0.31,
      fov: 40,
    },
    {
      id: "d1-cistern-stair",
      filename: "proof-d1-cistern-stair.png",
      dungeonId: "ch1_dungeon_desert",
      dungeonName: "The Sand That Remembers",
      zoneName: "The Cistern Stair",
      focus: [249, -18, -56],
      player: [239, -21, -54],
      cameraFar: [230, -16, -49],
      cameraNear: [234, -17, -51],
      timeOfDay: 0.58,
      fov: 41,
    },
    {
      id: "d1-hall-of-weights",
      filename: "proof-d1-hall-of-weights.png",
      dungeonId: "ch1_dungeon_desert",
      dungeonName: "The Sand That Remembers",
      zoneName: "The Hall of Weights",
      focus: [296, -19, -56],
      player: [286, -21, -52],
      cameraFar: [280, -17, -56],
      cameraNear: [284, -18, -56],
      timeOfDay: 0.52,
      fov: 39,
    },
    {
      id: "d1-sun-court",
      filename: "proof-d1-sun-court.png",
      dungeonId: "ch1_dungeon_desert",
      dungeonName: "The Sand That Remembers",
      zoneName: "The Sun Court",
      focus: [342, -18, -56],
      player: [329, -21, -52],
      cameraFar: [322, -14, -48],
      cameraNear: [327, -16, -51],
      timeOfDay: 0.38,
      fov: 40,
    },
    {
      id: "d1-seed-vault",
      filename: "proof-d1-seed-vault.png",
      dungeonId: "ch1_dungeon_desert",
      dungeonName: "The Sand That Remembers",
      zoneName: "The Seed Vault",
      focus: [386, -18, -56],
      player: [377, -21, -53],
      cameraFar: [370, -17, -56],
      cameraNear: [374, -18, -56],
      timeOfDay: 0.61,
      fov: 38,
    },
    {
      id: "d1-long-walk",
      filename: "proof-d1-long-walk.png",
      dungeonId: "ch1_dungeon_desert",
      dungeonName: "The Sand That Remembers",
      zoneName: "The Long Walk",
      focus: [463, 3, -54],
      player: [441, 1, -53],
      cameraFar: [423, 7, -52],
      cameraNear: [431, 5, -53],
      timeOfDay: 0.72,
      fov: 43,
    },
    {
      id: "d2-ice-shelf",
      filename: "proof-d2-ice-shelf.png",
      dungeonId: "ch1_dungeon_winter",
      dungeonName: "The Long Winter Mouth",
      zoneName: "The Ice Shelf Landing",
      focus: [53, 4, -88],
      player: [42, 1, -89],
      cameraFar: [30, 8, -78],
      cameraNear: [36, 7, -82],
      timeOfDay: 0.79,
      fov: 42,
    },
    {
      id: "d2-drowned-longhouse",
      filename: "proof-d2-drowned-longhouse.png",
      dungeonId: "ch1_dungeon_winter",
      dungeonName: "The Long Winter Mouth",
      zoneName: "The Drowned Longhouse",
      focus: [117, -6, -88],
      // The feast dais is the only supported surface above the flooded floor;
      // placing the actor at floor level hid the whole body under the ice.
      player: [116, -8, -88],
      cameraFar: [87, -4, -88],
      cameraNear: [92, -5, -88],
      timeOfDay: 0.88,
      fov: 40,
    },
    {
      id: "d2-hanged-wood",
      filename: "proof-d2-hanged-wood.png",
      dungeonId: "ch1_dungeon_winter",
      dungeonName: "The Long Winter Mouth",
      zoneName: "The Hanged Wood",
      focus: [179, 7, -111],
      player: [166, 1, -99],
      cameraFar: [145, 8, -88],
      cameraNear: [151, 7, -92],
      timeOfDay: 0.83,
      fov: 42,
    },
    {
      id: "d2-whale-road",
      filename: "proof-d2-whale-road.png",
      dungeonId: "ch1_dungeon_winter",
      dungeonName: "The Long Winter Mouth",
      zoneName: "The Whale Road",
      focus: [250, 3, -88],
      player: [231, 1, -88],
      cameraFar: [210, 7, -88],
      cameraNear: [218, 6, -88],
      timeOfDay: 0.84,
      fov: 40,
    },
    {
      id: "d2-sorrels-camp",
      filename: "proof-d2-sorrels-camp.png",
      dungeonId: "ch1_dungeon_winter",
      dungeonName: "The Long Winter Mouth",
      zoneName: "Sorrel's Camp",
      focus: [308, 5, -88],
      player: [294, 1, -88],
      // Frame the west entrance, actor, shed front, and weather mast from
      // inside the authored camp instead of placing the camera across void.
      cameraFar: [292, 7, -88],
      cameraNear: [294, 6, -88],
      timeOfDay: 0.76,
      fov: 39,
    },
    {
      id: "d2-ash-hall",
      filename: "proof-d2-ash-hall.png",
      dungeonId: "ch1_dungeon_winter",
      dungeonName: "The Long Winter Mouth",
      zoneName: "The Ash Hall",
      focus: [390, 4, -88],
      player: [375, 1, -92],
      // The hall's story is inside: roof posts, hearth dais, and occupied
      // scale. The previous distant exterior angle was mostly dark void.
      cameraFar: [362, 5, -88],
      cameraNear: [368, 5, -88],
      timeOfDay: 0.9,
      fov: 39,
    },
    {
      id: "d2-breaking-year",
      filename: "proof-d2-breaking-year.png",
      dungeonId: "ch1_dungeon_winter",
      dungeonName: "The Long Winter Mouth",
      zoneName: "The Breaking Year",
      focus: [449, 3, -88],
      player: [434, 1, -88],
      // Look east along the complete surfaced village lane so houses frame the
      // player on both sides and no un-authored horizon enters the shot.
      cameraFar: [418, 8, -88],
      cameraNear: [426, 6, -88],
      timeOfDay: 0.68,
      fov: 42,
    },
  ]);

function sectorProofScene(spec: DungeonSectorProofSpec): CutsceneDef {
  const focus = world(spec.dungeonId, spec.focus);
  const playerAt = world(spec.dungeonId, spec.player);
  const cameraFar = world(spec.dungeonId, spec.cameraFar);
  const cameraNear = world(spec.dungeonId, spec.cameraNear);
  return validPromoScene(
    {
      id: `promo-sector-${spec.id}`,
      name: `${spec.zoneName} Sector Proof`,
      version: 1,
      priority: 100_000,
      settings: safePromoSettings(spec.timeOfDay),
      cast: [
        { role: "player", binding: { kind: "player" }, required: true },
        {
          role: "sector",
          binding: {
            kind: "anchor",
            position: focus,
            height: 2.2,
            label: spec.zoneName,
          },
        },
      ],
      shots: [
        {
          id: "sector-proof",
          duration: 4,
          camera: {
            kind: "dolly",
            waypoints: [{ position: cameraFar }, { position: cameraNear }],
            lookAtRole: "sector",
            easing: "easeInOut",
          },
          actions: [
            { kind: "fov", at: 0, fov: spec.fov ?? 41 },
            { kind: "teleport", at: 0, role: "player", to: playerAt },
            {
              kind: "face",
              at: 0,
              role: "player",
              towards: { role: "sector" },
            },
          ],
        },
      ],
      onEnd: { placements: [], commits: [] },
    },
    `promo-sector-${spec.id}`
  );
}

const SECTOR_PROMO_SCENES: readonly PromoSceneDef[] =
  CH1_DUNGEON_SECTOR_PROOFS.map((spec) => ({
    id: `sector-${spec.id}`,
    shotId: "sector-proof",
    // Static sector proofs still need enough time for the real player body and
    // the closer native-terrain interest set to settle before capture.
    captureAt: 2.6,
    captureAtMax: 3.8,
    filename: spec.filename,
    brand: {
      title: "Biomes",
      subtitle: `SECTOR PROOF // ${spec.dungeonName.toUpperCase()} // ${spec.zoneName.toUpperCase()}`,
    },
    observer: {
      position: world(spec.dungeonId, spec.cameraFar),
      orientation: [-0.08, 2.3],
    },
    build: () => sectorProofScene(spec),
    groups: [
      "chapter1-sectors",
      "chapter1-finish",
      "chapter1-all",
      // The Dune Threshold proof already passed visual review and has no
      // runtime decor. Keep it out of the repair batch so fixing streaming and
      // decor does not re-test a known-good still.
      ...(spec.id === "d1-dune-threshold"
        ? []
        : (["chapter1-visual-repair"] as const)),
      ...(["d2-sorrels-camp", "d2-ash-hall", "d2-breaking-year"].includes(
        spec.id
      )
        ? (["chapter1-winter-final-resume"] as const)
        : []),
    ],
  }));

export const PROMO_SCENES: readonly PromoSceneDef[] = Object.freeze([
  {
    id: "dungeon-portal",
    shotId: "portal-crossing",
    // The player is mid-stride and partially overlapping the aperture.
    captureAt: 2.25,
    captureAtMax: 5.8,
    filename: "biomes-gate-traversal.png",
    brand: { title: "Biomes", subtitle: "", headline: "Biomes" },
    observer: { position: [644, 60, -455], orientation: [-0.12, 0.35] },
    build: dungeonPortalScene,
    groups: ["chapter1-marketing", "chapter1-all"],
  },
  {
    id: "ch1-sand-that-remembers",
    shotId: "market-action",
    captureAt: 2.15,
    captureAtMax: 5.8,
    filename: "the-sand-that-remembers-biomes.png",
    brand: {
      title: "Biomes",
      subtitle: "CHAPTER 1 // IDENTITY",
      headline: "The Sand That Remembers | Biomes",
    },
    observer: {
      position: world("ch1_dungeon_desert", [157, 9, -44]),
      orientation: [-0.1, 2.35],
    },
    build: sandThatRemembersScene,
    groups: [
      "chapter1-marketing",
      "chapter1-finish",
      "chapter1-all",
      "chapter1-visual-repair",
    ],
  },
  {
    id: "ch1-long-winter-mouth",
    shotId: "fjord-action",
    captureAt: 2.2,
    captureAtMax: 5.8,
    filename: "the-long-winter-mouth-biomes.png",
    brand: {
      title: "Biomes",
      subtitle: "CHAPTER 1 // IDENTITY",
      headline: "The Long Winter Mouth | Biomes",
    },
    observer: {
      position: world("ch1_dungeon_winter", [210, 7, -88]),
      orientation: [-0.08, 2.35],
    },
    build: longWinterMouthScene,
    groups: [
      "chapter1-marketing",
      "chapter1-finish",
      "chapter1-all",
      "chapter1-visual-repair",
    ],
  },
  ...SECTOR_PROMO_SCENES,
]);

export function promoSceneById(id: string): PromoSceneDef | undefined {
  return PROMO_SCENES.find((scene) => scene.id === id);
}

export function promoScenesInGroup(group: string): readonly PromoSceneDef[] {
  return PROMO_SCENES.filter((scene) => scene.groups?.includes(group));
}

/** Clamp an art-direction ?captureAt= override to the scene's own window. */
export function promoCaptureAt(
  scene: PromoSceneDef,
  requested: string | null
): number {
  if (requested === null || requested.trim() === "") {
    return scene.captureAt;
  }
  const value = Number(requested);
  if (!Number.isFinite(value)) {
    return scene.captureAt;
  }
  return Math.min(scene.captureAtMax, Math.max(0, value));
}

/** The /at/ deep link that loads the page ready to capture this still. */
export function promoCaptureUrl(
  scene: PromoSceneDef,
  origin = "http://localhost:3000",
  extra: Record<string, string> = {}
): string {
  const [x, y, z] = scene.observer.position;
  const [pitch, yaw] = scene.observer.orientation;
  const params = new URLSearchParams({
    hideChrome: "1",
    allowSoftwareWebGL: "1",
    cutscenePromo: scene.id,
    captureRun: "1",
    ...extra,
  });
  return `${origin.replace(
    /\/+$/,
    ""
  )}/at/${x}/${y}/${z}/${pitch}/${yaw}?${params}`;
}

/**
 * Gated local visual-test entry point for a registered still.
 *
 * Do not hand a fresh browser the raw observer URL. An observer page can render
 * WebGL while still showing "Login to Play"; in that state there is no live
 * player, no player-followed terrain/ECS interest set, and therefore no valid
 * distant capture. The auth bridge establishes the test player first and then
 * redirects to the exact raw URL above.
 */
export function promoCaptureAuthUrl(
  scene: PromoSceneDef,
  origin = "http://localhost:3000",
  extra: Record<string, string> = {},
  username = "Chapter1Marketing"
): string {
  const base = origin.replace(/\/+$/, "");
  const capture = new URL(promoCaptureUrl(scene, base, extra));
  return promoVisualAuthUrl(
    `${capture.pathname}${capture.search}`,
    base,
    username
  );
}

function promoVisualAuthUrl(
  next: string,
  base: string,
  username: string
): string {
  const params = new URLSearchParams({
    username,
    next,
  });
  return `${base}/dev/harthmere-visual-auth?${params}`;
}

/**
 * One authenticated warm-page URL for a complete capture group.
 * The first scene supplies only the initial observer route; promo_capture.ts
 * moves the live streaming observer before every scene in the group.
 */
export function promoBatchCaptureAuthUrl(
  group: string,
  origin = "http://localhost:3000",
  extra: Record<string, string> = {},
  username = "Chapter1Marketing"
): string {
  const scenes = promoScenesInGroup(group);
  if (scenes.length === 0) {
    throw new Error(`unknown or empty promo capture group "${group}"`);
  }
  const first = scenes[0]!;
  const base = origin.replace(/\/+$/, "");
  const [x, y, z] = first.observer.position;
  const [pitch, yaw] = first.observer.orientation;
  const params = new URLSearchParams({
    hideChrome: "1",
    allowSoftwareWebGL: "1",
    cutscenePromoBatch: group,
    captureRun: "1",
    ...extra,
  });
  const next = `/at/${x}/${y}/${z}/${pitch}/${yaw}?${params}`;
  return promoVisualAuthUrl(next, base, username);
}

/** Structural validation for every registered promo scene. */
export async function validatePromoScenes(): Promise<string[]> {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const scene of PROMO_SCENES) {
    if (seen.has(scene.id)) {
      errors.push(`duplicate promo scene id "${scene.id}"`);
    }
    seen.add(scene.id);
    if (scene.brand.title !== "Biomes") {
      errors.push(`${scene.id}: promo stills must be branded Biomes`);
    }
    if (!/\.png$/.test(scene.filename)) {
      errors.push(`${scene.id}: promo filenames should be .png`);
    }
    if (scene.captureAt < 0 || scene.captureAt > scene.captureAtMax) {
      errors.push(`${scene.id}: captureAt is outside its own ceiling`);
    }

    let def: CutsceneDef;
    try {
      def = await scene.build();
    } catch (error) {
      errors.push(
        `${scene.id}: build() threw — ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      continue;
    }
    const shot = def.shots.find((candidate) => candidate.id === scene.shotId);
    if (!shot) {
      errors.push(`${scene.id}: shotId "${scene.shotId}" is not in the scene`);
    } else if (scene.captureAtMax > shot.duration) {
      errors.push(`${scene.id}: captureAtMax exceeds shot duration`);
    }
    if (def.cast.some((member) => member.binding.kind === "ghost")) {
      errors.push(
        `${scene.id}: promotional/present-day scenes may not use generic ghost NPCs`
      );
    }
    if (def.settings.mode !== "clientPuppet") {
      errors.push(`${scene.id}: promo stills must be clientPuppet`);
    }
    if (def.settings.commitOn.length > 0 || def.onEnd.commits.length > 0) {
      errors.push(
        `${scene.id}: a promotional frame must never commit story state`
      );
    }
    if (def.onEnd.placements.length > 0) {
      errors.push(`${scene.id}: promo stills must not publish end placements`);
    }
  }
  return errors;
}
