// PROMO_SCENE_REGISTRY
//
// Promotional stills are authored cutscenes, not hand-positioned browser
// screenshots. Every entry is structurally testable without a GPU and can be
// captured individually or as part of a warm-page batch.
//
// PRESENT-DAY CAST POLICY — LOAD BEARING
// A real player or seeded ECS NPC must render through the snapshot player-like
// appearance pipeline. Generic `townsperson_*` ghosts are forbidden here: that
// fallback was the source of the blocky wrong-NPC screenshots. The only promo
// exception is the explicit eleven-boss catalog below, whose world-scale GLBs
// are the canonical, mutation-free renderer assets for cinematic staging.

import {
  validateCutsceneDef,
  type CutsceneDef,
  type CutsceneVec3,
} from "@/shared/cutscene/schema";
import {
  HARTHMERE_BOSS_VISUAL_ASSETS,
  type HarthmereBossVisualAsset,
  type HarthmereBossVisualId,
} from "@/shared/harthmere/boss_visual_assets";
import { ch1DungeonAuthoredToWorld } from "@/shared/harthmere/ch1_dungeon_terrain";

export const PROMO_SCENES_VERSION =
  "promo-scenes-v3-seed-audited-boss-staging" as const;

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

// ---------------------------------------------------------------------------
// Harthmere boss marketing stills
//
// These use the canonical world-scale GLBs generated for the actual encounter
// bosses. They are staged as client-only puppets so all eleven can be captured
// consistently without moving, spawning, damaging, or otherwise mutating an
// authoritative ECS combatant. The map positions are the bosses' encounter
// spaces; the camera paths are deliberately close, low, and three-quarter.
// ---------------------------------------------------------------------------

export interface HarthmereBossPromoSpec {
  id: HarthmereBossVisualId;
  area: string;
  stage: CutsceneVec3;
  cameraFar: CutsceneVec3;
  cameraNear: CutsceneVec3;
  timeOfDay: number;
  fov: number;
  framingBias?: number;
  /** Canonical authored yaw when the boss asset should not auto-face camera. */
  yaw?: number;
  animation?: "attack1" | "attack2";
}

export const HARTHMERE_BOSS_PROMO_SPECS: readonly HarthmereBossPromoSpec[] =
  Object.freeze([
    {
      id: "muck_scarred_helix",
      area: "West Muck Breach",
      stage: [232, 33, -506],
      cameraFar: [222, 36, -496],
      cameraNear: [225, 35, -499],
      timeOfDay: 0.78,
      fov: 30,
      framingBias: 1.2,
      animation: "attack2",
    },
    {
      id: "gilded_bull",
      area: "Sun Court",
      stage: [2968, 44, -312],
      // Accepted Sun Court sector-proof lane. The rejected diagonal framed
      // only the court's wrong-coloured sky beyond the north aperture.
      cameraFar: [2946, 50, -304],
      cameraNear: [2951, 48, -307],
      timeOfDay: 0.38,
      fov: 36,
      framingBias: 1.15,
      animation: "attack2",
    },
    {
      id: "ninth_winter",
      area: "Ash Hall",
      stage: [3524, 65, -344],
      // Stay on the accepted Ash Hall interior axis (local z=-88).
      cameraFar: [3498, 70, -344],
      cameraNear: [3505, 69, -344],
      timeOfDay: 0.86,
      fov: 42,
      framingBias: 2.5,
      animation: "attack2",
    },
    {
      id: "failed_apprentice",
      area: "Bellward Halls — Bell Ring",
      // Authored runtime placement beside the broken handbell. The retained
      // screenshot stack disables the optional +1600 additive-town offset.
      stage: [354, 53, -313.4],
      cameraFar: [366, 58, -301],
      cameraNear: [363, 56.5, -304],
      timeOfDay: 0.73,
      fov: 35,
      framingBias: 1.3,
      yaw: Math.PI,
      animation: "attack2",
    },
    {
      id: "first_choir",
      area: "Bellward Halls — Central Choir",
      // Runtime triad floor sigil and three harmony candles.
      stage: [356, 53, -309],
      cameraFar: [370, 58, -295],
      cameraNear: [367, 56.5, -298],
      timeOfDay: 0.78,
      fov: 35,
      framingBias: 1.15,
      yaw: Math.PI,
      animation: "attack2",
    },
    {
      id: "echo_singer",
      area: "Veins of the Wyrm — Echo Hall",
      // Runtime phase-safe essence pool in Old Well / Underways.
      stage: [632, 53, -318],
      cameraFar: [616, 59, -302],
      cameraNear: [620, 56.5, -306],
      timeOfDay: 0.71,
      fov: 36,
      framingBias: 1.6,
      yaw: Math.PI,
      animation: "attack2",
    },
    {
      id: "vyrahel_vein_keeper",
      area: "Veins of the Wyrm — Spine Hall",
      // Shoot from north of the runtime rib wall so it remains backdrop.
      stage: [642, 53, -334],
      cameraFar: [656, 59, -350],
      cameraNear: [653, 56.5, -346],
      timeOfDay: 0.66,
      fov: 35,
      framingBias: 1.35,
      yaw: Math.PI,
      animation: "attack1",
    },
    {
      id: "thaedryn_bellbound",
      area: "Wyrm's Bed",
      stage: [640, 53, -268],
      // Shoot from the True-Bell side, close enough to read the dragon and
      // binding silhouettes rather than losing them in atmospheric void.
      cameraFar: [618, 64, -240],
      cameraNear: [623, 60, -247],
      timeOfDay: 0.75,
      fov: 39,
      framingBias: 3.2,
      yaw: Math.PI,
      animation: "attack2",
    },
    {
      id: "hex_wraith",
      area: "Gravewood Pale Muck",
      // Exact grounded legacy bounty marker in Gravewood Pale Muck. The
      // rejected frame used a Watchtower Muck Patch seed from a different
      // encounter family and therefore photographed the wrong scenery.
      stage: [632.924, 47, 146.321],
      cameraFar: [620, 53, 159],
      cameraNear: [624, 51, 155],
      timeOfDay: 0.74,
      fov: 30,
      framingBias: 0.9,
      animation: "attack2",
    },
    {
      id: "alpha_mucker",
      area: "Old Wood Muck Patch",
      // Exact grounded legacy bounty marker. Pull the lens outside the
      // fourteen-metre canopy; the rejected camera sat inside the boss crown.
      stage: [648.693, 57, -455],
      cameraFar: [678, 66, -428],
      cameraNear: [670, 63, -436],
      timeOfDay: 0.72,
      fov: 36,
      framingBias: 2.5,
      animation: "attack2",
    },
    {
      id: "root_crowned_dead",
      area: "Deep Old Wood",
      // Runtime public-event marker among standing stones and ritual light.
      stage: [620, 53, -505],
      // Approach from the southwest between the ancient trees. The rejected
      // northeast camera stood behind a dark terrain lip above the ritual.
      cameraFar: [603, 60, -518],
      cameraNear: [608, 57, -514],
      timeOfDay: 0.8,
      fov: 32,
      framingBias: 1.35,
      animation: "attack2",
    },
  ]);

function bossVisual(id: HarthmereBossVisualId): HarthmereBossVisualAsset {
  const visual = HARTHMERE_BOSS_VISUAL_ASSETS.find(
    (candidate) => candidate.id === id
  );
  if (!visual) {
    throw new Error(`no Harthmere boss visual is registered for ${id}`);
  }
  return visual;
}

export function harthmereBossPromoAssetUrl(id: HarthmereBossVisualId): string {
  return bossVisual(id).assetUrl.replace(/\.glb$/i, "_world.glb");
}

export function isHarthmereBossPromoGhostAsset(asset: string): boolean {
  return HARTHMERE_BOSS_VISUAL_ASSETS.some(
    (visual) => harthmereBossPromoAssetUrl(visual.id) === asset
  );
}

function bossFrameFocus(
  spec: HarthmereBossPromoSpec,
  visual: HarthmereBossVisualAsset
): CutsceneVec3 {
  const dx = spec.stage[0] - spec.cameraNear[0];
  const dz = spec.stage[2] - spec.cameraNear[2];
  const length = Math.max(0.001, Math.hypot(dx, dz));
  const screenRightX = dz / length;
  const screenRightZ = -dx / length;
  const bias =
    spec.framingBias ?? Math.min(4, Math.max(0.8, visual.worldSize[0] * 0.2));
  return [
    spec.stage[0] - screenRightX * bias,
    spec.stage[1] + visual.worldSize[1] * 0.48,
    spec.stage[2] - screenRightZ * bias,
  ];
}

function bossPromoScene(spec: HarthmereBossPromoSpec): CutsceneDef {
  const visual = bossVisual(spec.id);
  const bossRole = `boss_${spec.id}`;
  const frameFocus = bossFrameFocus(spec, visual);
  return validPromoScene(
    {
      id: `promo-boss-${spec.id.replaceAll("_", "-")}`,
      name: `${visual.displayName} Marketing Hero Still`,
      version: 1,
      priority: 100_000,
      settings: safePromoSettings(spec.timeOfDay, 18),
      cast: [
        {
          role: bossRole,
          binding: {
            kind: "ghost",
            asset: harthmereBossPromoAssetUrl(spec.id),
            family: "quest_creature",
            spawnAt: spec.stage,
            height: visual.worldSize[1],
          },
          required: true,
        },
        {
          role: "frameFocus",
          binding: {
            kind: "anchor",
            position: frameFocus,
            height: 0,
            label: `${visual.displayName} hero framing target`,
          },
        },
        {
          role: "cameraFacing",
          binding: {
            kind: "anchor",
            position: spec.cameraNear,
            height: 0,
            label: `${visual.displayName} camera eyeline`,
          },
        },
      ],
      shots: [
        {
          id: "boss-hero",
          duration: 4.5,
          camera: {
            kind: "dolly",
            waypoints: [
              { position: spec.cameraFar },
              { position: spec.cameraNear },
            ],
            lookAtRole: "frameFocus",
            easing: "easeInOut",
          },
          actions: [
            { kind: "fov", at: 0, fov: spec.fov },
            {
              kind: "teleport",
              at: 0,
              role: bossRole,
              to: spec.stage,
              ...(spec.yaw === undefined ? {} : { faceYaw: spec.yaw }),
            },
            ...(spec.yaw === undefined
              ? [
                  {
                    kind: "face" as const,
                    at: 0.05,
                    role: bossRole,
                    towards: { role: "cameraFacing" },
                  },
                ]
              : []),
            {
              kind: "emote",
              at: 1.35,
              role: bossRole,
              emote: spec.animation ?? "attack2",
            },
          ],
        },
      ],
      onEnd: { placements: [], commits: [] },
    },
    `promo-boss-${spec.id}`
  );
}

const HARTHMERE_BOSS_PROMO_SCENES: readonly PromoSceneDef[] =
  HARTHMERE_BOSS_PROMO_SPECS.map((spec) => {
    const visual = bossVisual(spec.id);
    return {
      id: `boss-${spec.id.replaceAll("_", "-")}`,
      shotId: "boss-hero",
      captureAt: 2.05,
      captureAtMax: 4.25,
      filename: `biomes-harthmere-boss-${spec.id.replaceAll("_", "-")}.png`,
      brand: {
        title: "Biomes",
        subtitle: `HARTHMERE BOSS // ${visual.displayName.toUpperCase()} // ${spec.area.toUpperCase()}`,
      },
      observer: {
        position: spec.cameraFar,
        orientation: [-0.1, 0],
      },
      build: () => bossPromoScene(spec),
      groups: ["boss-marketing"],
    };
  });

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
  ...HARTHMERE_BOSS_PROMO_SCENES,
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
    for (const member of def.cast) {
      if (member.binding.kind !== "ghost") {
        continue;
      }
      const approvedBossPuppet =
        scene.groups?.includes("boss-marketing") &&
        member.binding.family === "quest_creature" &&
        isHarthmereBossPromoGhostAsset(member.binding.asset);
      if (!approvedBossPuppet) {
        errors.push(
          `${scene.id}: promotional/present-day scenes may not use generic ghost NPCs`
        );
      }
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
