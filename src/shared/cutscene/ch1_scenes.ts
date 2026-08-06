// CHAPTER_1_AUTHORED_CUTSCENES
//
// Every Chapter 1 flashback and story cinematic, built on the shared cutscene
// generator (src/shared/cutscene/). Pure data + templates; no client imports.
//
// THE REVISION PROMISE — the single most important rule in this file:
//
//   A revised memory may ONLY re-render material the player has already seen.
//   ch1Recon Corridor (Act 3) and ch1ReconCorridorRevised (Act 6) share ONE
//   shot list, produced by one function, with a single `revised` flag that
//   changes who the woman is and what is in her hand. No new camera angle. No
//   new line. No added beat. `ch1_scenes.test.ts` asserts the shot ids,
//   durations, and camera specs are identical between the two.
//
//   If that test ever fails, we have cheated the player, and the chapter's
//   fair-play contract (journal §10.1) is broken.
//
// ENGINE NOTES:
//   * Every scene here is `clientPuppet`. Flashback actors are `ghost`
//     bindings — client-only renderer meshes with no ECS entity, negative ids,
//     no HP, never attackable, never persisted. Anima never sees them and no
//     NPC brain is paused.
//   * Present-day actors bind the real seeded ECS NPC by entity id, per the
//     native action-shot rules in docs/cutscenes.md. We do not use a ghost
//     merely to get a human-shaped actor.
//   * Story commits are outcome-gated and idempotent. Authoritative quest
//     state is committed on the server BEFORE the cinematic runs; these scenes
//     present an already-decided outcome.

import {
  conversationCutscene,
  type ConversationLine,
} from "@/shared/cutscene/templates";
import {
  validateCutsceneDef,
  type CutsceneDef,
  type CutsceneRoleBindingInput,
  type CutsceneVec3,
} from "@/shared/cutscene/schema";
import { lookAtOrientation } from "@/shared/cutscene/math";
import {
  cutsceneExpressionSequence,
  type CutsceneExpressionCue,
} from "@/shared/cutscene/expression_actions";
import { SNAPSHOT_GROVE_JACKIE_ENTITY_ID } from "@/shared/harthmere/snapshot_grove_ids";
import { CH1_ANCHORS, CH1_NPC_ENTITY_IDS } from "@/shared/harthmere/ch1_ids";
import { ch1DungeonAuthoredToWorld } from "@/shared/harthmere/ch1_dungeon_terrain";
import {
  CH1_CONSOLIDATION_ENTRY_SECONDS,
  CH1_CONSOLIDATION_ORDER,
} from "@/shared/harthmere/ch1_fragment_ledger";
import { withCh1DialogueVoices } from "@/shared/harthmere/ch1_voice";
import { SNAPSHOT_CUTSCENE_PLAYER_MESH_ASSET } from "@/shared/cutscene/puppets";

// ---------------------------------------------------------------------------
// Ids
// ---------------------------------------------------------------------------

export const CH1_SCENE_IDS = {
  ignition: "ch1-ignition",
  firstGate: "ch1-first-gate",
  persistentGate: "ch1-persistent-gate",
  overlayIveGotYou: "ch1-overlay-ive-got-you",
  reconArrival: "ch1-recon-arrival",
  reconCorridor: "ch1-recon-corridor",
  overlayContainment: "ch1-overlay-containment",
  theFlinch: "ch1-the-flinch",
  confrontation: "ch1-confrontation",
  sorrelDoor: "ch1-sorrel-door",
  theCase: "ch1-the-case",
  consolidationRevision: "ch1-consolidation-revision",
  reconIntake: "ch1-recon-intake",
  tooLate: "ch1-too-late",
  theWatchHouse: "ch1-the-watch-house",
} as const;

export type Ch1SceneId = (typeof CH1_SCENE_IDS)[keyof typeof CH1_SCENE_IDS];

export interface Ch1SceneActingCue extends CutsceneExpressionCue {
  shotId: string;
}

/**
 * Revision-one performance plan for the complete Chapter 1 catalog.
 *
 * These are deliberately authored as emotional beats rather than one emote
 * per subtitle. The player should be able to read what changed in a scene
 * without the cast looking like it is cycling an animation showcase. The two
 * Corridor renderings use the same cue list to preserve the revision promise.
 */
export const CH1_SCENE_ACTING_CUES = Object.freeze({
  [CH1_SCENE_IDS.ignition]: [
    { shotId: "it-stands-up", role: "augur9", expression: "getUp", at: 0.15 },
  ],
  [CH1_SCENE_IDS.firstGate]: [
    {
      shotId: "the-card-goes-hot",
      role: "player",
      expression: "recoil",
      at: 0.35,
      faceTowardsRole: "seam",
    },
    {
      shotId: "the-card-goes-hot",
      role: "jackie",
      expression: "nervousness",
      at: 0.6,
      faceTowardsRole: "seam",
    },
    {
      shotId: "youve-seen-one-before",
      role: "jackie",
      expression: "uncertainty",
      at: 0.15,
      faceTowardsRole: "player",
    },
    {
      shotId: "not-this-small",
      role: "player",
      expression: "shock",
      at: 0.1,
      faceTowardsRole: "seam",
    },
  ],
  [CH1_SCENE_IDS.persistentGate]: [
    {
      shotId: "reveal",
      role: "rook",
      expression: "guard",
      at: 0.15,
      faceTowardsRole: "revealTarget",
    },
    {
      shotId: "rook-says-it",
      role: "rook",
      expression: "determined",
      at: 0.1,
      faceTowardsRole: "player",
    },
  ],
  [CH1_SCENE_IDS.overlayIveGotYou]: [
    {
      shotId: "corridor",
      role: "player",
      expression: "fear",
      at: 0.2,
      faceTowardsRole: "hand",
    },
    {
      shotId: "corridor",
      role: "hand",
      expression: "determined",
      at: 0.3,
      faceTowardsRole: "player",
    },
    {
      shotId: "the-hand",
      role: "hand",
      expression: "comeHere",
      at: 0.15,
      faceTowardsRole: "player",
    },
  ],
  [CH1_SCENE_IDS.reconArrival]: [
    {
      shotId: "rain-on-the-road",
      role: "carrier",
      expression: "determined",
      at: 0.2,
      faceTowardsRole: "roadhouse",
    },
    {
      shotId: "rain-on-the-road",
      role: "player",
      expression: "injury",
      at: 0.15,
    },
    {
      shotId: "she-does-not-stop",
      role: "carrier",
      expression: "exhaustion",
      at: 0.2,
      faceTowardsRole: "roadhouse",
    },
  ],
  [CH1_SCENE_IDS.reconCorridor]: [
    {
      shotId: "smoke-on-the-ceiling",
      role: "player",
      expression: "fear",
      at: 0.2,
      faceTowardsRole: "woman",
    },
    {
      shotId: "smoke-on-the-ceiling",
      role: "woman",
      expression: "terror",
      at: 0.25,
      faceTowardsRole: "player",
    },
    {
      shotId: "she-is-running",
      role: "woman",
      expression: "determined",
      at: 0.1,
      faceTowardsRole: "player",
    },
    {
      shotId: "dont-look-at-her",
      role: "man",
      expression: "comeHere",
      at: 0.15,
      faceTowardsRole: "player",
    },
    {
      shotId: "dont-look-at-her",
      role: "player",
      expression: "stagger",
      at: 0.6,
      faceTowardsRole: "door",
    },
  ],
  [`${CH1_SCENE_IDS.reconCorridor}-revised`]: [
    {
      shotId: "smoke-on-the-ceiling",
      role: "player",
      expression: "fear",
      at: 0.2,
      faceTowardsRole: "woman",
    },
    {
      shotId: "smoke-on-the-ceiling",
      role: "woman",
      expression: "terror",
      at: 0.25,
      faceTowardsRole: "player",
    },
    {
      shotId: "she-is-running",
      role: "woman",
      expression: "determined",
      at: 0.1,
      faceTowardsRole: "player",
    },
    {
      shotId: "dont-look-at-her",
      role: "man",
      expression: "comeHere",
      at: 0.15,
      faceTowardsRole: "player",
    },
    {
      shotId: "dont-look-at-her",
      role: "player",
      expression: "stagger",
      at: 0.6,
      faceTowardsRole: "door",
    },
  ],
  [CH1_SCENE_IDS.overlayContainment]: [
    {
      shotId: "reveal",
      role: "player",
      expression: "exhaustion",
      at: 0.5,
      faceTowardsRole: "calla",
    },
    {
      shotId: "calla-sees-it",
      role: "calla",
      expression: "shock",
      at: 0.1,
      faceTowardsRole: "player",
    },
    {
      shotId: "calla-sees-it",
      role: "player",
      expression: "relief",
      at: 0.3,
      faceTowardsRole: "calla",
    },
  ],
  [CH1_SCENE_IDS.theFlinch]: [
    {
      shotId: "establishing",
      role: "a",
      expression: "shock",
      at: 0.2,
      faceTowardsRole: "b",
    },
    {
      shotId: "establishing",
      role: "b",
      expression: "recoil",
      at: 0.4,
      faceTowardsRole: "a",
    },
    { shotId: "line-0", role: "a", expression: "nervousness", at: 0.1 },
    { shotId: "line-1", role: "a", expression: "frustration", at: 0.1 },
    { shotId: "line-2", role: "a", expression: "sighing", at: 0.1 },
  ],
  [CH1_SCENE_IDS.confrontation]: [
    {
      shotId: "establishing",
      role: "a",
      expression: "shame",
      at: 0.2,
      faceTowardsRole: "b",
    },
    {
      shotId: "establishing",
      role: "b",
      expression: "anger",
      at: 0.3,
      faceTowardsRole: "a",
    },
    { shotId: "line-0", role: "a", expression: "uncertainty", at: 0.1 },
    { shotId: "line-1", role: "a", expression: "determined", at: 0.1 },
    { shotId: "line-2", role: "b", expression: "anger", at: 0.1 },
    { shotId: "line-3", role: "a", expression: "shame", at: 0.1 },
    { shotId: "line-4", role: "a", expression: "determined", at: 0.1 },
  ],
  [CH1_SCENE_IDS.sorrelDoor]: [
    {
      shotId: "establishing",
      role: "a",
      expression: "annoyance",
      at: 0.2,
      faceTowardsRole: "b",
    },
    {
      shotId: "establishing",
      role: "b",
      expression: "uncertainty",
      at: 0.3,
      faceTowardsRole: "a",
    },
    { shotId: "line-0", role: "a", expression: "annoyance", at: 0.1 },
    { shotId: "line-1", role: "a", expression: "surprise", at: 0.1 },
    { shotId: "line-2", role: "a", expression: "determined", at: 0.1 },
    { shotId: "line-3", role: "a", expression: "sadness", at: 0.1 },
    { shotId: "line-4", role: "a", expression: "shock", at: 0.1 },
    { shotId: "line-5", role: "a", expression: "sighing", at: 0.1 },
    { shotId: "line-6", role: "a", expression: "determined", at: 0.1 },
  ],
  [CH1_SCENE_IDS.theCase]: [
    {
      shotId: "establishing",
      role: "a",
      expression: "determined",
      at: 0.2,
      faceTowardsRole: "b",
    },
    {
      shotId: "establishing",
      role: "b",
      expression: "uncertainty",
      at: 0.3,
      faceTowardsRole: "a",
    },
    { shotId: "line-0", role: "a", expression: "apology", at: 0.1 },
    { shotId: "line-1", role: "a", expression: "determined", at: 0.1 },
    { shotId: "line-2", role: "a", expression: "determined", at: 0.1 },
    { shotId: "line-3", role: "a", expression: "frustration", at: 0.1 },
    { shotId: "line-4", role: "a", expression: "sadness", at: 0.1 },
    { shotId: "line-5", role: "a", expression: "uncertainty", at: 0.1 },
    { shotId: "line-6", role: "a", expression: "determined", at: 0.1 },
  ],
  [CH1_SCENE_IDS.consolidationRevision]: [
    {
      shotId: "the-word",
      role: "lou",
      expression: "relief",
      at: 0.1,
      faceTowardsRole: "player",
    },
    {
      shotId: "the-word",
      role: "player",
      expression: "recoil",
      at: 1.7,
      faceTowardsRole: "lou",
    },
    {
      shotId: "the-word",
      role: "lou",
      expression: "shame",
      at: 1.8,
      faceTowardsRole: "player",
    },
  ],
  [CH1_SCENE_IDS.reconIntake]: [
    {
      shotId: "the-room",
      role: "player",
      expression: "anger",
      at: 0.3,
      faceTowardsRole: "lou",
    },
    {
      shotId: "the-room",
      role: "lou",
      expression: "shame",
      at: 0.2,
      faceTowardsRole: "player",
    },
    {
      shotId: "the-argument",
      role: "lou",
      expression: "uncertainty",
      at: 0.1,
      faceTowardsRole: "player",
    },
    {
      shotId: "the-kind-version",
      role: "lou",
      expression: "apology",
      at: 0.1,
      faceTowardsRole: "player",
    },
  ],
  [CH1_SCENE_IDS.tooLate]: [
    {
      shotId: "establishing",
      role: "a",
      expression: "exhaustion",
      at: 0.2,
      faceTowardsRole: "b",
    },
    {
      shotId: "establishing",
      role: "b",
      expression: "anger",
      at: 0.3,
      faceTowardsRole: "a",
    },
    { shotId: "line-0", role: "a", expression: "shame", at: 0.1 },
    { shotId: "line-1", role: "a", expression: "determined", at: 0.1 },
    { shotId: "line-2", role: "a", expression: "determined", at: 0.1 },
    { shotId: "line-3", role: "a", expression: "frustration", at: 0.1 },
    { shotId: "line-4", role: "a", expression: "defeat", at: 0.1 },
  ],
  [CH1_SCENE_IDS.theWatchHouse]: [
    {
      shotId: "establishing",
      role: "a",
      expression: "exhaustion",
      at: 0.2,
      faceTowardsRole: "b",
    },
    {
      shotId: "establishing",
      role: "b",
      expression: "uncertainty",
      at: 0.3,
      faceTowardsRole: "a",
    },
    { shotId: "line-0", role: "a", expression: "sighing", at: 0.1 },
    { shotId: "line-1", role: "a", expression: "shame", at: 0.1 },
    { shotId: "line-2", role: "a", expression: "sadness", at: 0.1 },
    { shotId: "line-3", role: "a", expression: "apology", at: 0.1 },
    { shotId: "line-4", role: "a", expression: "shame", at: 0.1 },
    { shotId: "line-5", role: "a", expression: "determined", at: 0.1 },
    { shotId: "line-6", role: "a", expression: "ready", at: 0.1 },
  ],
}) satisfies Readonly<Record<string, readonly Ch1SceneActingCue[]>>;

/**
 * The Act 6 consolidation objective is one production cinematic sequence.
 * The ledger revision unlocks the fair-play re-render of the corridor and then
 * the previously omitted fourteen-hour intake memory. Keeping the ids here
 * makes browser playback and coverage tests share one order.
 */
export const CH1_CONSOLIDATION_PLAYBACK_SEQUENCE = Object.freeze([
  CH1_SCENE_IDS.consolidationRevision,
  `${CH1_SCENE_IDS.reconCorridor}-revised`,
  CH1_SCENE_IDS.reconIntake,
]);

function validateCh1Scene(def: unknown, phase: string): CutsceneDef {
  const result = validateCutsceneDef(def);
  if (!result.ok) {
    throw new Error(
      `invalid Chapter 1 cutscene (${phase}): ${result.issues
        .map((i) => `${i.path}: ${i.message}`)
        .join("; ")}`
    );
  }
  return result.def;
}

function withCh1SafeCoverage(def: CutsceneDef): CutsceneDef {
  return {
    ...def,
    shots: def.shots.map((shot, index) => ({
      ...shot,
      // Chapter 1 is dialogue- and memory-heavy. Hard cuts between authored
      // cameras read as camera teleports on lower-frame-rate clients, so all
      // interior cuts use the runtime's shortest-path position/orientation
      // blend. The opening remains covered by the normal prewarm fade, and
      // explicitly authored fades remain fades.
      transitionIn:
        index === 0 ? "fade" : shot.transitionIn === "fade" ? "fade" : "blend",
      blendSeconds:
        index === 0 ? shot.blendSeconds : Math.max(0.55, shot.blendSeconds),
      camera:
        shot.camera.kind === "overShoulder" && shot.camera.pullout < 2.2
          ? { ...shot.camera, pullout: 2.2 }
          : shot.camera,
    })),
  };
}

function withCh1Acting(def: CutsceneDef): CutsceneDef {
  const cues = (
    CH1_SCENE_ACTING_CUES as Readonly<
      Record<string, readonly Ch1SceneActingCue[]>
    >
  )[def.id];
  if (!cues?.length) {
    throw new Error(`${def.id}: missing Chapter 1 acting plan`);
  }

  const castRoles = new Set(def.cast.map((member) => member.role));
  const shotIds = new Set(def.shots.map((shot) => shot.id));
  const cuesByShot = new Map<string, CutsceneExpressionCue[]>();
  for (const { shotId, ...cue } of cues) {
    if (!shotIds.has(shotId)) {
      throw new Error(
        `${def.id}: acting cue references missing shot ${shotId}`
      );
    }
    if (!castRoles.has(cue.role)) {
      throw new Error(`${def.id}/${shotId}: unknown acting role ${cue.role}`);
    }
    if (cue.faceTowardsRole && !castRoles.has(cue.faceTowardsRole)) {
      throw new Error(
        `${def.id}/${shotId}: unknown facing role ${cue.faceTowardsRole}`
      );
    }
    const shotCues = cuesByShot.get(shotId) ?? [];
    shotCues.push(cue);
    cuesByShot.set(shotId, shotCues);
  }

  return {
    ...def,
    shots: def.shots.map((shot) => ({
      ...shot,
      actions: [
        ...shot.actions,
        ...cutsceneExpressionSequence(cuesByShot.get(shot.id) ?? []),
      ],
    })),
  };
}

function mustValidate(def: unknown): CutsceneDef {
  const structured = validateCh1Scene(def, "authored");
  const performed = withCh1Acting(withCh1SafeCoverage(structured));
  const voiced = withCh1DialogueVoices(performed);
  return validateCh1Scene(voiced, "performed");
}

// Flashback staging. The Greenlamp marker proved to be its outdoor frontage,
// complete with vendor interface boards, not the clinic corridor. Use the
// measured enclosed road-house aisle as the reconstruction set: it keeps the
// client-puppet grounded and every -4m..+9m corridor role inside real voxels.
export const CH1_MEMORY_STAGE: CutsceneVec3 = [
  ...CH1_ANCHORS.memory_corridor_stage,
];

function stageOffset(dx: number, dy: number, dz: number): CutsceneVec3 {
  return [
    CH1_MEMORY_STAGE[0] + dx,
    CH1_MEMORY_STAGE[1] + dy,
    CH1_MEMORY_STAGE[2] + dz,
  ];
}

function worldOffset(
  origin: readonly [number, number, number],
  dx: number,
  dy: number,
  dz: number
): CutsceneVec3 {
  return [origin[0] + dx, origin[1] + dy, origin[2] + dz];
}

interface Ch1ConversationStage {
  actor: CutsceneVec3;
  player: CutsceneVec3;
  label: string;
}

/**
 * Present-day dialogue must remain visible even when a catalog audit or a
 * temporarily absent ECS actor cannot use the normal story projection. The
 * exact entity is still the primary binding; the renderer-valid ghost is only
 * a client-puppet fallback, and both paths are staged at the authored hilly
 * world coordinate before the first camera samples them.
 */
function stagedCh1ConversationCutscene(args: {
  id: Ch1SceneId;
  name: string;
  actor: CutsceneRoleBindingInput;
  stage: Ch1ConversationStage;
  lines: readonly ConversationLine[];
  settings?: Record<string, unknown>;
}): CutsceneDef {
  const base = conversationCutscene({
    id: args.id,
    name: args.name,
    a: args.actor,
    b: { kind: "player" },
    lines: [...args.lines],
    settings: args.settings,
  });
  return {
    ...base,
    cast: [
      ...base.cast.map((member) =>
        member.role === "a"
          ? {
              ...member,
              required: true,
              fallback: "ghost" as const,
              ghostAsset: SNAPSHOT_CUTSCENE_PLAYER_MESH_ASSET,
            }
          : member
      ),
      {
        role: "conversation-stage",
        binding: {
          kind: "anchor",
          position: args.stage.actor,
          height: 1.8,
          label: args.stage.label,
        },
        // These are the schema defaults. Keep them explicit so the helper's
        // already-validated cast output and this anchor share one TS shape.
        required: true,
        fallback: "skipActions",
      },
    ],
    shots: base.shots.map((shot, index) => ({
      ...shot,
      actions:
        index === 0
          ? [
              {
                kind: "teleport" as const,
                at: 0,
                role: "a",
                to: args.stage.actor,
              },
              {
                kind: "teleport" as const,
                at: 0,
                role: "b",
                to: args.stage.player,
              },
              ...shot.actions,
            ]
          : shot.actions,
    })),
  };
}

// ---------------------------------------------------------------------------
// Act 0 — the ignition
// ---------------------------------------------------------------------------

/**
 * The last beat of Muck vs. Machine. The repaired robot stands up, focuses on
 * the player's face, tries to resume a log, and fails — and what comes out is
 * the player's own voice, badly artifacted, mid-sentence.
 *
 * The chapter starts on that sound.
 */
export function ch1IgnitionCutscene(): CutsceneDef {
  return mustValidate({
    id: CH1_SCENE_IDS.ignition,
    name: "Custodian Recognized",
    priority: 20,
    settings: {
      // No `music` override here: settings.music selects a track, and the
      // chapter's first beat wants silence. Silence is expressed by the
      // `music` ACTION with track: null in the final shot, which the director
      // restores afterwards.
      letterbox: true,
      skipAfterSeconds: 3,
      commitOn: ["completed", "skipped"],
    },
    cast: [
      { role: "player", binding: { kind: "player" } },
      {
        role: "augur9",
        binding: {
          kind: "entity",
          entityId: Number(CH1_NPC_ENTITY_IDS.augur9),
        },
        required: true,
        fallback: "ghost",
        ghostAsset: "npcs/robot",
      },
    ],
    shots: [
      {
        id: "it-stands-up",
        duration: 3.2,
        camera: {
          kind: "orbit",
          role: "augur9",
          radius: 3.4,
          height: 1.6,
          startAngle: 0.4,
          endAngle: 1.5,
        },
        transitionIn: "fade",
        actions: [
          {
            kind: "sfx",
            at: 0.1,
            name: "snapshot.robot.power",
            atRole: "augur9",
          },
        ],
      },
      {
        id: "it-looks-at-you",
        duration: 4.5,
        until: { kind: "dialogueDone", maxDuration: 9 },
        camera: {
          kind: "overShoulder",
          from: "player",
          to: "augur9",
          // The player and repaired robot start at interaction distance. The
          // old 1.6 framing put the camera inside the player's head on the
          // production model instead of reading as a reaction two-shot.
          pullout: 2.4,
        },
        transitionIn: "blend",
        blendSeconds: 0.5,
        actions: [
          { kind: "face", at: 0, role: "augur9", towards: { role: "player" } },
          {
            kind: "dialogue",
            at: 0.4,
            role: "augur9",
            speaker: "AUGUR-9",
            text: "…custodian recognized. Resuming log entry four hundred and—",
          },
        ],
      },
      {
        id: "your-own-voice",
        duration: 4.0,
        camera: {
          kind: "overShoulder",
          from: "player",
          to: "augur9",
          side: "right",
          pullout: 3,
        },
        transitionIn: "cut",
        actions: [
          { kind: "music", at: 0.0, track: null },
          {
            kind: "sfx",
            at: 0.1,
            name: "snapshot.log.artifact",
            atRole: "augur9",
          },
          {
            kind: "dialogue",
            at: 0.3,
            speaker: "A recording",
            text: "— and if anyone is hearing this after the fact, then I was right, and I am very sorry, and you need to start with the anchors —",
          },
          {
            kind: "shake",
            at: 0.2,
            magnitude: 0.03,
            repeats: 3,
            durationMs: 700,
          },
          { kind: "fade", at: 3.4, direction: "out", duration: 0.6 },
        ],
      },
    ],
    onEnd: {
      commits: [
        { hook: "ch1.begin", payload: { chapter: "ch1_identity" } },
        { hook: "ch1.unlockLedger", payload: {} },
      ],
    },
  });
}

// ---------------------------------------------------------------------------
// Act 1 — the fence line
// ---------------------------------------------------------------------------

export function ch1FirstGateCutscene(): CutsceneDef {
  const seam = CH1_ANCHORS.gate_fence_sighting;
  // These are separately measured feet positions on the sloped shelf. Keep
  // their distinct Y values instead of flattening the conversation to seam Y.
  const jackieStage: CutsceneVec3 = [539, 70, -215];
  const playerStage: CutsceneVec3 = [536, 69, -218];
  const seamFocus: CutsceneVec3 = [seam[0], seam[1] + 1.7, seam[2]];
  const jackieFocus: CutsceneVec3 = [
    jackieStage[0],
    jackieStage[1] + 1.5,
    jackieStage[2],
  ];
  const playerFocus: CutsceneVec3 = [
    playerStage[0],
    playerStage[1] + 1.5,
    playerStage[2],
  ];
  // The eastern approach is occupied by the building that blocked revision 1.
  // Cover the shelf from the open western side and keep the aperture behind
  // the actors instead of shooting through the wall.
  const openingCamera: CutsceneVec3 = [550, 74, -230];
  const openingFocus: CutsceneVec3 = [539.5, 70.8, -217.5];
  const seamFarCamera: CutsceneVec3 = [554, 75, -232];
  const seamNearCamera: CutsceneVec3 = [550, 73, -228];
  const playerCamera: CutsceneVec3 = [548, 72.5, -227];
  return mustValidate({
    id: CH1_SCENE_IDS.firstGate,
    name: "The Fence Line Seam",
    priority: 15,
    settings: { letterbox: true, timeOfDay: 0.64 },
    cast: [
      { role: "player", binding: { kind: "player" } },
      {
        role: "jackie",
        binding: {
          kind: "entity",
          entityId: Number(SNAPSHOT_GROVE_JACKIE_ENTITY_ID),
        },
        required: true,
        fallback: "ghost",
        ghostAsset: SNAPSHOT_CUTSCENE_PLAYER_MESH_ASSET,
      },
      {
        role: "seam",
        binding: {
          kind: "anchor",
          position: CH1_ANCHORS.gate_fence_sighting as unknown as CutsceneVec3,
          height: 2,
          label: "The Fence Line Seam",
        },
      },
    ],
    shots: [
      {
        id: "the-card-goes-hot",
        duration: 2.4,
        camera: {
          kind: "static",
          position: openingCamera,
          // Open on the people reacting to the seam, not a wall-sized close-up
          // of the seam itself. The next shot owns the aperture reveal.
          orientation: lookAtOrientation(openingCamera, openingFocus),
        },
        transitionIn: "cut",
        actions: [
          { kind: "teleport", at: 0, role: "player", to: playerStage },
          { kind: "teleport", at: 0, role: "jackie", to: jackieStage },
          { kind: "face", at: 0, role: "jackie", towards: { role: "seam" } },
          { kind: "sfx", at: 0.0, name: "snapshot.card.warm" },
          { kind: "fov", at: 0.4, fov: 62 },
        ],
      },
      {
        id: "the-seam",
        duration: 4.2,
        camera: {
          kind: "dolly",
          waypoints: [
            {
              position: seamFarCamera,
              orientation: lookAtOrientation(seamFarCamera, seamFocus),
            },
            {
              position: seamNearCamera,
              orientation: lookAtOrientation(seamNearCamera, seamFocus),
            },
          ],
          easing: "easeInOut",
        },
        transitionIn: "blend",
        blendSeconds: 0.6,
        actions: [
          { kind: "sfx", at: 0.1, name: "snapshot.gate.hum", atRole: "seam" },
          {
            kind: "shake",
            at: 0.2,
            magnitude: 0.02,
            repeats: 6,
            durationMs: 1800,
          },
        ],
      },
      {
        id: "youve-seen-one-before",
        duration: 4.5,
        until: { kind: "dialogueDone", maxDuration: 9 },
        camera: {
          kind: "static",
          position: seamNearCamera,
          orientation: lookAtOrientation(seamNearCamera, jackieFocus),
        },
        transitionIn: "blend",
        actions: [
          { kind: "face", at: 0, role: "jackie", towards: { role: "player" } },
          {
            kind: "dialogue",
            at: 0.3,
            role: "jackie",
            speaker: "Jackie",
            text: "…You've seen one before.",
          },
        ],
      },
      {
        id: "not-this-small",
        duration: 3.6,
        until: { kind: "dialogueDone", maxDuration: 7 },
        camera: {
          kind: "static",
          position: playerCamera,
          orientation: lookAtOrientation(playerCamera, playerFocus),
        },
        transitionIn: "blend",
        actions: [
          {
            kind: "dialogue",
            at: 0.2,
            role: "player",
            speaker: "You",
            text: "Not this small.",
          },
          { kind: "sfx", at: 1.6, name: "snapshot.memory.echo" },
        ],
      },
    ],
    onEnd: {
      commits: [
        {
          hook: "ch1.recoverFragment",
          payload: { fragmentId: "frag_a1_echo_get_back" },
        },
      ],
    },
  });
}

export function ch1PersistentGateCutscene(): CutsceneDef {
  const target = CH1_ANCHORS.gate_desert as unknown as CutsceneVec3;
  const targetFocus: CutsceneVec3 = [target[0], target[1] + 1.7, target[2]];
  const revealCamera: CutsceneVec3 = [658, 62, -472];
  const rookStage: CutsceneVec3 = [644, 54, -458];
  const playerStage: CutsceneVec3 = [648, 54, -454];
  const dialogueCamera: CutsceneVec3 = [654, 60, -450];
  const dialogueFocus: CutsceneVec3 = [
    rookStage[0],
    rookStage[1] + 1.5,
    rookStage[2],
  ];
  return mustValidate({
    id: CH1_SCENE_IDS.persistentGate,
    name: "It Did Not Close",
    settings: {
      letterbox: true,
      hideHud: true,
      invulnerablePlayer: true,
      timeOfDay: 0.64,
    },
    cast: [
      { role: "player", binding: { kind: "player" } },
      {
        role: "rook",
        binding: {
          kind: "entity",
          entityId: Number(CH1_NPC_ENTITY_IDS.halden_rook),
        },
        required: true,
        fallback: "ghost",
        ghostAsset: SNAPSHOT_CUTSCENE_PLAYER_MESH_ASSET,
      },
      {
        role: "revealTarget",
        binding: {
          kind: "anchor",
          position: target,
          height: 2,
          label: "The Persistent Gate",
        },
      },
    ],
    shots: [
      {
        id: "reveal",
        duration: 3.2,
        camera: {
          kind: "static",
          position: revealCamera,
          orientation: lookAtOrientation(revealCamera, targetFocus),
        },
        transitionIn: "fade",
        blendSeconds: 0.5,
        actions: [
          { kind: "teleport", at: 0, role: "rook", to: rookStage },
          { kind: "teleport", at: 0, role: "player", to: playerStage },
          {
            kind: "face",
            at: 0,
            role: "rook",
            towards: { role: "revealTarget" },
          },
          { kind: "sfx", at: 0.4, name: "snapshot.gate.hum" },
        ],
      },
      {
        id: "rook-says-it",
        duration: 5.2,
        until: { kind: "dialogueDone", maxDuration: 10 },
        camera: {
          kind: "static",
          position: dialogueCamera,
          orientation: lookAtOrientation(dialogueCamera, dialogueFocus),
        },
        transitionIn: "blend",
        blendSeconds: 0.5,
        actions: [
          { kind: "face", at: 0, role: "rook", towards: { role: "player" } },
          {
            kind: "dialogue",
            at: 0.25,
            role: "rook",
            speaker: "Halden Rook",
            text: "Two years I have watched these open on your side of the river and never once on mine.",
          },
        ],
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Act 2 — "I've got you"
// ---------------------------------------------------------------------------

/**
 * The overlay that fires within seconds of meeting Lou. A corridor drawn over
 * the clinic wall, smoke on the ceiling, a hand on the shoulder.
 *
 * Everything in it is TRUE. He did carry the player out. He carried them out
 * afterwards. The Act 6 revision adds nothing — it only lets the player see
 * whose hand it was, which they were never actually shown.
 */
export function ch1OverlayIveGotYouCutscene(): CutsceneDef {
  const wideCamera = stageOffset(2.4, 1.7, -3);
  const wideFocus = stageOffset(0.4, 1.35, 1.1);
  const handCamera = stageOffset(2.4, 1.8, 0.2);
  const handFocus = stageOffset(0.8, 1.4, 2.6);
  return mustValidate({
    id: CH1_SCENE_IDS.overlayIveGotYou,
    name: "I've Got You",
    priority: 12,
    settings: {
      letterbox: true,
      timeOfDay: 0.02,
      lockPlayer: true,
      skipAfterSeconds: 4,
    },
    cast: [
      { role: "player", binding: { kind: "player" } },
      {
        role: "hand",
        binding: {
          kind: "ghost",
          asset: SNAPSHOT_CUTSCENE_PLAYER_MESH_ASSET,
          family: "human",
          appearanceSourceEntityId: Number(CH1_NPC_ENTITY_IDS.lou_ardan),
          // The renderer stand-in represents the arm/voice at the player's
          // shoulder. Keep enough distance for a readable POV silhouette;
          // the old 1.4m placement filled the entire frame with one face.
          spawnAt: stageOffset(0.8, 0, 2.6),
        },
      },
    ],
    shots: [
      {
        id: "corridor",
        duration: 3.0,
        camera: {
          kind: "static",
          position: wideCamera,
          orientation: lookAtOrientation(wideCamera, wideFocus),
        },
        transitionIn: "fade",
        actions: [
          // Flashback cameras sample the client-puppet position, so stage the
          // player explicitly instead of depending on where gameplay happened
          // to trigger the memory.
          { kind: "teleport", at: 0, role: "player", to: CH1_MEMORY_STAGE },
          { kind: "face", at: 0, role: "player", towards: { role: "hand" } },
          { kind: "sfx", at: 0.0, name: "snapshot.alarm.distant" },
          { kind: "fov", at: 0.0, fov: 78 },
          {
            kind: "shake",
            at: 0.3,
            magnitude: 0.035,
            repeats: 5,
            durationMs: 1400,
          },
        ],
      },
      {
        id: "the-hand",
        duration: 5.0,
        until: { kind: "dialogueDone", maxDuration: 9 },
        camera: {
          kind: "static",
          position: handCamera,
          orientation: lookAtOrientation(handCamera, handFocus),
        },
        transitionIn: "blend",
        blendSeconds: 0.4,
        actions: [
          {
            kind: "dialogue",
            at: 0.4,
            role: "hand",
            speaker: "A voice behind you",
            text: "I've got you. Walk.",
          },
          { kind: "fade", at: 4.2, direction: "out", duration: 0.7 },
        ],
      },
    ],
    onEnd: {
      commits: [
        {
          hook: "ch1.recoverFragment",
          payload: { fragmentId: "frag_a2_overlay_ive_got_you" },
        },
      ],
    },
  });
}

// ---------------------------------------------------------------------------
// Act 3 / Act 6 — THE CORRIDOR
//
// One shot list. Two renderings. This is the chapter.
// ---------------------------------------------------------------------------

export interface Ch1CorridorOptions {
  /**
   * false => Act 3. The woman's face is not resolved; the syringe reads as a
   *          weapon; the voice behind you is unidentified.
   * true  => Act 6. Identical camera, identical timing, identical lines.
   *          The woman is legible and the object in her hand is named.
   */
  revised: boolean;
}

/**
 * Builds the corridor reconstruction. Both variants MUST produce identical
 * shot ids, durations, transitions, and camera specs — only ghost asset
 * resolution and subtitle attribution differ.
 */
export function ch1CorridorCutscene(opts: Ch1CorridorOptions): CutsceneDef {
  const { revised } = opts;

  // The woman: unresolved in Act 3, Jackie in Act 6. Same position, same
  // motion, same timing. Only the mesh and the label change.
  // Human memories always use the original snapshot/generated PlayerMesh
  // pipeline. The prior townsperson aliases could be intercepted by the
  // procedural Three.js NPC creator before the bridge canonicalized them.
  const womanAppearanceSourceEntityId = revised
    ? Number(SNAPSHOT_GROVE_JACKIE_ENTITY_ID)
    : undefined;
  const womanSpeaker = revised ? "Jackie" : "A woman, running";

  // What is in her hand. Act 3 never names it. Act 6 names it and names
  // nothing else.
  const handLine = revised
    ? "It is the vial you had analysed. The one you reported her for."
    : "There is something in her hand.";

  const behindSpeaker = revised ? "Dr. Lucien Ardan" : "A voice behind you";
  const openingCamera = stageOffset(2.4, 1.8, -2.5);
  const openingFocus = stageOffset(0, 2.1, 3.2);
  const runningCamera = stageOffset(2.2, 1.7, 1.5);
  const runningFocus = stageOffset(0, 1.45, 3.4);
  const escapeCamera = stageOffset(2.4, 1.7, -1.8);
  const escapeFocus = stageOffset(0.2, 1.35, 0.3);
  const doorCamera = stageOffset(2.4, 1.7, -3);
  const doorFocus = stageOffset(0, 1.4, 2.8);

  return mustValidate({
    id: revised
      ? `${CH1_SCENE_IDS.reconCorridor}-revised`
      : CH1_SCENE_IDS.reconCorridor,
    name: revised ? "The Corridor (Revised)" : "The Corridor",
    priority: 30,
    settings: {
      letterbox: true,
      lockPlayer: true,
      timeOfDay: 0.02,
      skipAfterSeconds: 6,
      invulnerablePlayer: true,
      commitOn: ["completed", "skipped"],
    },
    cast: [
      { role: "player", binding: { kind: "player" } },
      {
        role: "woman",
        binding: {
          kind: "ghost",
          asset: SNAPSHOT_CUTSCENE_PLAYER_MESH_ASSET,
          family: "human",
          appearanceSourceEntityId: womanAppearanceSourceEntityId,
          // Keep her inside the visible aisle. The former +9m mark landed on
          // the road-house shell edge, so both renderings showed an empty room.
          spawnAt: stageOffset(0, 0, 4),
        },
      },
      {
        role: "man",
        binding: {
          kind: "ghost",
          asset: SNAPSHOT_CUTSCENE_PLAYER_MESH_ASSET,
          family: "human",
          appearanceSourceEntityId: Number(CH1_NPC_ENTITY_IDS.lou_ardan),
          spawnAt: stageOffset(0.8, 0, -1.6),
        },
      },
      {
        role: "door",
        binding: {
          kind: "anchor",
          position: stageOffset(0, 0, -4),
          height: 2.2,
          label: "The door behind you",
        },
      },
    ],
    shots: [
      {
        id: "smoke-on-the-ceiling",
        duration: 3.0,
        camera: {
          kind: "static",
          position: openingCamera,
          orientation: lookAtOrientation(openingCamera, openingFocus),
        },
        transitionIn: "fade",
        actions: [
          { kind: "teleport", at: 0, role: "player", to: CH1_MEMORY_STAGE },
          { kind: "face", at: 0, role: "player", towards: { role: "woman" } },
          { kind: "fov", at: 0, fov: 80 },
          { kind: "sfx", at: 0.0, name: "snapshot.alarm.close" },
          {
            kind: "shake",
            at: 0.2,
            magnitude: 0.04,
            repeats: 6,
            durationMs: 1600,
          },
        ],
      },
      {
        id: "she-is-running",
        duration: 4.2,
        until: { kind: "dialogueDone", maxDuration: 8 },
        camera: {
          kind: "static",
          position: runningCamera,
          orientation: lookAtOrientation(runningCamera, runningFocus),
        },
        transitionIn: "cut",
        actions: [
          { kind: "face", at: 0, role: "woman", towards: { role: "player" } },
          {
            kind: "moveTo",
            at: 0.1,
            role: "woman",
            to: { role: "player" },
            speed: 1.2,
            arriveWithin: 2.2,
            timeoutSeconds: 6,
            timeoutFallback: "skip",
          },
          {
            kind: "dialogue",
            at: 0.4,
            speaker: womanSpeaker,
            text: handLine,
          },
        ],
      },
      {
        id: "dont-look-at-her",
        duration: 4.6,
        until: { kind: "dialogueDone", maxDuration: 9 },
        camera: {
          kind: "static",
          position: escapeCamera,
          orientation: lookAtOrientation(escapeCamera, escapeFocus),
        },
        transitionIn: "cut",
        actions: [
          {
            kind: "dialogue",
            at: 0.2,
            speaker: behindSpeaker,
            text: "I've got you, walk, don't look at her, walk—",
          },
          {
            kind: "moveTo",
            at: 0.6,
            role: "player",
            to: { role: "door" },
            speed: 1.8,
            arriveWithin: 0.8,
            timeoutSeconds: 5,
            timeoutFallback: "skip",
          },
          {
            kind: "shake",
            at: 0.6,
            magnitude: 0.05,
            repeats: 8,
            durationMs: 2000,
          },
        ],
      },
      {
        id: "the-door",
        duration: 2.8,
        camera: {
          kind: "static",
          position: doorCamera,
          orientation: lookAtOrientation(doorCamera, doorFocus),
        },
        transitionIn: "blend",
        blendSeconds: 0.4,
        actions: [
          { kind: "sfx", at: 0.2, name: "snapshot.door.close" },
          { kind: "fade", at: 1.9, direction: "out", duration: 0.8 },
        ],
      },
    ],
    onEnd: {
      commits: revised
        ? []
        : [
            {
              hook: "ch1.recoverFragment",
              payload: { fragmentId: "frag_a3_recon_corridor" },
            },
          ],
    },
  });
}

export const ch1ReconCorridorCutscene = () =>
  ch1CorridorCutscene({ revised: false });
export const ch1ReconCorridorRevisedCutscene = () =>
  ch1CorridorCutscene({ revised: true });

// ---------------------------------------------------------------------------
// Act 2 — the arrival reconstruction (the player builds this one themselves)
// ---------------------------------------------------------------------------

export function ch1ReconArrivalCutscene(): CutsceneDef {
  const arrivalStart: CutsceneVec3 = [472.8, 70, -146];
  const carriedPlayerStart: CutsceneVec3 = [473.8, 70, -145.2];
  const arrivalStop: CutsceneVec3 = [473, 70, -140.5];
  const carriedPlayerStop: CutsceneVec3 = [474.2, 70, -139.8];
  const carrierFocus: CutsceneVec3 = [
    arrivalStop[0],
    arrivalStop[1] + 1.25,
    arrivalStop[2],
  ];
  const openingCamera: CutsceneVec3 = [481, 71.5, -145];
  const openingFocus: CutsceneVec3 = [473.4, 70.9, -143.5];
  const alvaCamera: CutsceneVec3 = [480, 71.8, -144];
  const helsaCamera: CutsceneVec3 = [468, 71.8, -144];
  const allixCamera: CutsceneVec3 = [474, 73, -148];
  return mustValidate({
    id: CH1_SCENE_IDS.reconArrival,
    name: "The Night You Came",
    priority: 25,
    settings: {
      letterbox: true,
      lockPlayer: true,
      timeOfDay: 0.72,
      skipAfterSeconds: 5,
    },
    cast: [
      { role: "player", binding: { kind: "player" } },
      {
        role: "carrier",
        binding: {
          kind: "ghost",
          asset: SNAPSHOT_CUTSCENE_PLAYER_MESH_ASSET,
          family: "human",
          appearanceSourceEntityId: Number(SNAPSHOT_GROVE_JACKIE_ENTITY_ID),
          spawnAt: arrivalStart,
        },
      },
      {
        role: "roadhouse",
        binding: {
          kind: "anchor",
          position: arrivalStop,
          height: 4,
          label: "The road-house door",
        },
      },
      {
        role: "carriedStop",
        binding: {
          kind: "anchor",
          position: carriedPlayerStop,
          height: 1.4,
          label: "The carried player's arrival mark",
        },
      },
    ],
    shots: [
      {
        id: "rain-on-the-road",
        duration: 3.4,
        camera: {
          kind: "static",
          position: openingCamera,
          orientation: lookAtOrientation(openingCamera, openingFocus),
        },
        transitionIn: "fade",
        actions: [
          { kind: "sfx", at: 0, name: "snapshot.rain.heavy" },
          {
            kind: "teleport",
            at: 0,
            role: "player",
            to: carriedPlayerStart,
          },
          {
            kind: "moveTo",
            at: 0.2,
            role: "carrier",
            to: { role: "roadhouse" },
            speed: 1.9,
            timeoutSeconds: 12,
            timeoutFallback: "skip",
          },
          {
            kind: "moveTo",
            at: 0.2,
            role: "player",
            to: { role: "carriedStop" },
            speed: 1.9,
            arriveWithin: 1.2,
            timeoutSeconds: 12,
            timeoutFallback: "skip",
          },
        ],
      },
      {
        id: "she-does-not-stop",
        duration: 4.0,
        camera: {
          kind: "static",
          position: alvaCamera,
          orientation: lookAtOrientation(alvaCamera, carrierFocus),
        },
        transitionIn: "blend",
        blendSeconds: 0.5,
        actions: [
          {
            kind: "dialogue",
            at: 0.3,
            speaker: "Alva",
            text: "She didn't stop to rest. People who are helping stop to rest.",
          },
        ],
      },
      {
        id: "put-the-lamps-out",
        duration: 3.8,
        camera: {
          kind: "static",
          position: helsaCamera,
          orientation: lookAtOrientation(helsaCamera, carrierFocus),
        },
        transitionIn: "blend",
        blendSeconds: 0.4,
        actions: [
          {
            kind: "dialogue",
            at: 0.2,
            speaker: "Helsa",
            text: "She asked me to put the lamps out, not down.",
          },
        ],
      },
      {
        id: "the-way-with-no-windows",
        duration: 4.2,
        camera: {
          kind: "static",
          position: allixCamera,
          orientation: lookAtOrientation(allixCamera, carrierFocus),
        },
        transitionIn: "blend",
        blendSeconds: 0.4,
        actions: [
          {
            kind: "dialogue",
            at: 0.2,
            speaker: "Allix",
            text: "From up top, she took the long way. She chose the way with no windows.",
          },
          { kind: "fade", at: 3.4, direction: "out", duration: 0.7 },
        ],
      },
    ],
    onEnd: {
      commits: [
        {
          hook: "ch1.recoverFragment",
          payload: { fragmentId: "frag_a2_recon_arrival" },
        },
      ],
    },
  });
}

// ---------------------------------------------------------------------------
// Act 4 — thirty-one seconds
// ---------------------------------------------------------------------------

export function ch1OverlayContainmentCutscene(): CutsceneDef {
  const target = CH1_ANCHORS.ashline_refinery_intake as unknown as CutsceneVec3;
  const focus: CutsceneVec3 = [target[0], target[1] + 1.7, target[2]];
  const revealCamera: CutsceneVec3 = [
    target[0] - 8,
    target[1] + 3,
    target[2] - 8,
  ];
  const callaStage =
    CH1_ANCHORS.ashline_foreman_post as unknown as CutsceneVec3;
  const playerStage: CutsceneVec3 = [675, 67, -51];
  const dialogueCamera: CutsceneVec3 = [678, 69, -49];
  const callaFocus: CutsceneVec3 = [
    callaStage[0],
    callaStage[1] + 1.5,
    callaStage[2],
  ];
  return mustValidate({
    id: CH1_SCENE_IDS.overlayContainment,
    name: "Thirty-One Seconds",
    settings: {
      letterbox: true,
      hideHud: true,
      invulnerablePlayer: true,
      timeOfDay: 0.68,
    },
    cast: [
      { role: "player", binding: { kind: "player" } },
      {
        role: "calla",
        binding: {
          kind: "entity",
          entityId: Number(CH1_NPC_ENTITY_IDS.calla_ashe),
        },
        required: true,
        fallback: "ghost",
        ghostAsset: SNAPSHOT_CUTSCENE_PLAYER_MESH_ASSET,
      },
      {
        role: "revealTarget",
        binding: {
          kind: "anchor",
          position: target,
          height: 2,
          label: "Ashline refinery intake",
        },
      },
    ],
    shots: [
      {
        id: "reveal",
        duration: 3.2,
        camera: {
          kind: "static",
          position: revealCamera,
          orientation: lookAtOrientation(revealCamera, focus),
        },
        transitionIn: "fade",
        actions: [
          { kind: "teleport", at: 0, role: "calla", to: callaStage },
          { kind: "teleport", at: 0, role: "player", to: playerStage },
          { kind: "face", at: 0, role: "calla", towards: { role: "player" } },
          { kind: "sfx", at: 0.4, name: "snapshot.containment.settle" },
        ],
      },
      {
        id: "calla-sees-it",
        duration: 4.0,
        until: { kind: "dialogueDone", maxDuration: 8 },
        camera: {
          kind: "static",
          position: dialogueCamera,
          orientation: lookAtOrientation(dialogueCamera, callaFocus),
        },
        transitionIn: "blend",
        blendSeconds: 0.45,
        actions: [
          { kind: "face", at: 0, role: "calla", towards: { role: "player" } },
          {
            kind: "dialogue",
            at: 0.25,
            role: "calla",
            speaker: "Foreman Calla Ashe",
            text: "How did you do that?",
          },
        ],
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Act 3 / 4 / 5 — present-day conversations
// ---------------------------------------------------------------------------

export function ch1TheFlinchCutscene(): CutsceneDef {
  return mustValidate(
    stagedCh1ConversationCutscene({
      id: CH1_SCENE_IDS.theFlinch,
      name: "Three Days",
      actor: {
        kind: "entity",
        entityId: Number(SNAPSHOT_GROVE_JACKIE_ENTITY_ID),
      },
      stage: {
        actor: worldOffset(CH1_ANCHORS.gate_desert, -4, 0, 4),
        player: worldOffset(CH1_ANCHORS.gate_desert, 0, 0, 8),
        label: "Three Days gate conversation",
      },
      lines: [
        { speaker: "a", text: "You were gone three days." },
        { speaker: "a", text: "Three. Days." },
        { speaker: "a", text: "Right. Okay." },
      ],
      settings: { letterbox: true, timeOfDay: 0.25 },
    })
  );
}

export function ch1ConfrontationCutscene(): CutsceneDef {
  return mustValidate(
    stagedCh1ConversationCutscene({
      id: CH1_SCENE_IDS.confrontation,
      name: "Ask Me In a Month",
      actor: {
        kind: "entity",
        entityId: Number(SNAPSHOT_GROVE_JACKIE_ENTITY_ID),
      },
      stage: {
        actor: [...CH1_ANCHORS.roadhouse_table],
        player: worldOffset(CH1_ANCHORS.roadhouse_table, 2.5, 0, 2.5),
        label: "Road-House confrontation",
      },
      lines: [
        { speaker: "a", text: "It's medicine." },
        { speaker: "a", text: "You need to keep taking it." },
        { speaker: "b", text: "Why should I trust you?" },
        { speaker: "a", text: "You shouldn't. Not yet." },
        { speaker: "a", text: "Ask me again in a month." },
      ],
      settings: { letterbox: true },
    })
  );
}

export function ch1SorrelDoorCutscene(): CutsceneDef {
  const actor = ch1DungeonAuthoredToWorld("ch1_dungeon_winter", {
    x: 308,
    y: 1,
    z: -88,
  });
  return mustValidate(
    stagedCh1ConversationCutscene({
      id: CH1_SCENE_IDS.sorrelDoor,
      name: "The Bar-Slot",
      actor: {
        kind: "entity",
        entityId: Number(CH1_NPC_ENTITY_IDS.nadia_sorrel),
      },
      stage: {
        actor: [...actor],
        player: worldOffset(actor, 2.5, 0, 2.5),
        label: "Sorrel's barred camp door",
      },
      lines: [
        {
          speaker: "a",
          text: "Whatever you're selling, the answer is no and the door is barred.",
        },
        { speaker: "a", text: "…Say that again." },
        { speaker: "a", text: "Say it again." },
        { speaker: "a", text: "Eleven years. You look — " },
        { speaker: "a", text: "You don't know who I am." },
        { speaker: "a", text: "Right. Fine." },
        {
          speaker: "a",
          text: "Then we'll do it the slow way. I have four months of notes, and you have a hole where your head used to be.",
        },
      ],
      settings: { letterbox: true, timeOfDay: 0.3 },
    })
  );
}

export function ch1TheCaseCutscene(): CutsceneDef {
  return mustValidate(
    stagedCh1ConversationCutscene({
      id: CH1_SCENE_IDS.theCase,
      name: "The Case",
      actor: {
        kind: "entity",
        entityId: Number(CH1_NPC_ENTITY_IDS.lou_ardan),
      },
      stage: {
        actor: [...CH1_ANCHORS.returnstone_pad_office],
        player: worldOffset(CH1_ANCHORS.returnstone_pad_office, 2.5, 0, 2.5),
        label: "Returnstone case handover",
      },
      lines: [
        {
          speaker: "a",
          text: "They know who you are. I want you to hear that from me and not from a form.",
        },
        {
          speaker: "a",
          text: "I didn't tell them. You can check that, and you should.",
        },
        {
          speaker: "a",
          text: "Publish it and you are right. Loudly, permanently, historically right.",
        },
        {
          speaker: "a",
          text: "Then the shutdown happens in a panic, not a sequence. In about eleven days.",
        },
        {
          speaker: "a",
          text: "Four hundred million homes, not houses. Homes in pockets, with no doors once the anchors drop.",
        },
        {
          speaker: "a",
          text: "Or you give it to me, and we do it slowly, and nobody has to know your name.",
        },
        {
          speaker: "a",
          text: "You've been right for eleven years. I'm asking you to be useful for one afternoon.",
        },
      ],
      settings: {
        letterbox: true,
        skipAfterSeconds: 8,
        timeOfDay: 0.62,
      },
    })
  );
}

export function ch1TooLateCutscene(): CutsceneDef {
  return mustValidate(
    stagedCh1ConversationCutscene({
      id: CH1_SCENE_IDS.tooLate,
      name: "Too Late",
      actor: {
        kind: "entity",
        entityId: Number(CH1_NPC_ENTITY_IDS.lou_ardan),
      },
      stage: {
        actor: [...CH1_ANCHORS.returnstone_pad_office],
        player: worldOffset(CH1_ANCHORS.returnstone_pad_office, 2.5, 0, 2.5),
        label: "Returnstone departure",
      },
      lines: [
        {
          speaker: "a",
          text: "I was given a choice between your mind and four hundred million homes.",
        },
        { speaker: "a", text: "I chose a third thing." },
        {
          speaker: "a",
          text: "You are alive and unhurt. Every one of those homes still has power.",
        },
        {
          speaker: "a",
          text: "I would like someone, once, to tell me what the better answer was.",
        },
        {
          speaker: "a",
          text: "You could not answer eleven years ago either. I really did wait for it.",
        },
      ],
      settings: {
        letterbox: true,
        skipAfterSeconds: 8,
        timeOfDay: 0.62,
      },
    })
  );
}

export function ch1WatchHouseCutscene(): CutsceneDef {
  const actorStage: CutsceneVec3 = [472, 70, -149.5];
  const playerStage: CutsceneVec3 = [474, 70, -147];
  const roomCamera: CutsceneVec3 = [470.5, 71.8, -146.2];
  const roomFocus: CutsceneVec3 = [473, 71.3, -148.2];
  const speakerCamera: CutsceneVec3 = [475.3, 71.7, -146.2];
  const speakerFocus: CutsceneVec3 = [472, 71.4, -149.5];
  const scene = stagedCh1ConversationCutscene({
    id: CH1_SCENE_IDS.theWatchHouse,
    name: "The Watch House",
    actor: {
      kind: "entity",
      entityId: Number(SNAPSHOT_GROVE_JACKIE_ENTITY_ID),
    },
    stage: {
      actor: actorStage,
      player: playerStage,
      label: "Grove Watch House conversation",
    },
    lines: [
      { speaker: "a", text: "Okay." },
      {
        speaker: "a",
        text: "I could have told you on day one. You'd have believed me for about a week.",
      },
      {
        speaker: "a",
        text: "Then it would have made me a liar in your own head. You would have walked to him anyway, except angrier and alone.",
      },
      {
        speaker: "a",
        text: "So I fed you the cure and I let you hate me on your own schedule.",
      },
      {
        speaker: "a",
        text: "That was the whole plan. It was not a good one.",
      },
      {
        speaker: "a",
        text: "I'm not owed an apology. I'd have done the same in your shoes with the same memories, and I'd have done it faster.",
      },
      {
        speaker: "a",
        text: "But I'd like to get out of this room. They've got a two-day head start and I know where that transport goes.",
      },
    ],
    settings: { letterbox: true, timeOfDay: 0.55, skipAfterSeconds: 10 },
  });
  return mustValidate({
    ...scene,
    shots: scene.shots.map((shot, index) => ({
      ...shot,
      camera: {
        kind: "static" as const,
        position: index === 0 ? roomCamera : speakerCamera,
        orientation: lookAtOrientation(
          index === 0 ? roomCamera : speakerCamera,
          index === 0 ? roomFocus : speakerFocus
        ),
      },
    })),
  });
}

// ---------------------------------------------------------------------------
// Act 6 — the consolidation revision sequence
//
// Six ledger entries rewrite themselves in front of the player, one at a time,
// with no input accepted. This is the chapter's cinematic payload.
// ---------------------------------------------------------------------------

export function ch1ConsolidationRevisionCutscene(): CutsceneDef {
  const louStage: CutsceneVec3 = [...CH1_ANCHORS.returnstone_pad_office];
  const playerStage = worldOffset(
    CH1_ANCHORS.returnstone_pad_office,
    2.5,
    0,
    2.5
  );
  const shots = CH1_CONSOLIDATION_ORDER.map((fragmentId, index) => ({
    id: `revision-${index}-${fragmentId}`,
    duration: CH1_CONSOLIDATION_ENTRY_SECONDS,
    camera: {
      kind: "overShoulder" as const,
      from: "player",
      to: "lou",
      side: index % 2 === 0 ? ("left" as const) : ("right" as const),
      pullout: 2.8,
    },
    transitionIn: index === 0 ? ("fade" as const) : ("blend" as const),
    blendSeconds: 0.35,
    actions: [
      // The ledger diff itself is a registered client hook: the overlay owns
      // the text animation, the director owns the timing. Keeping it a hook
      // means the pure runtime stays renderable in tests and capture.
      {
        kind: "custom" as const,
        at: 0.0,
        hook: "ch1.reviseLedgerEntry",
        payload: { fragmentId, index },
      },
      {
        kind: "sfx" as const,
        at: 0.05,
        name: "snapshot.memory.revise",
      },
      {
        kind: "shake" as const,
        at: 0.0,
        magnitude: 0.018,
        repeats: 2,
        durationMs: 420,
      },
    ],
  }));

  return mustValidate({
    id: CH1_SCENE_IDS.consolidationRevision,
    name: "Seven",
    priority: 100,
    settings: {
      // The player does not get to look away from this one until it has said
      // what it has to say. Accessibility skip still applies after 10s.
      skippable: false,
      skipAfterSeconds: 10,
      lockPlayer: true,
      hideHud: true,
      letterbox: true,
      invulnerablePlayer: true,
      commitOn: ["completed", "skipped"],
      maxSceneDurationSeconds: 90,
      timeOfDay: 0.62,
    },
    cast: [
      { role: "player", binding: { kind: "player" } },
      {
        role: "lou",
        binding: {
          kind: "entity",
          entityId: Number(CH1_NPC_ENTITY_IDS.lou_ardan),
        },
        required: true,
        fallback: "ghost",
        ghostAsset: SNAPSHOT_CUTSCENE_PLAYER_MESH_ASSET,
      },
      {
        role: "consolidation-stage",
        binding: {
          kind: "anchor",
          position: louStage,
          height: 1.8,
          label: "Returnstone consolidation stage",
        },
      },
    ],
    shots: [
      {
        id: "the-word",
        duration: 3.0,
        camera: {
          kind: "overShoulder",
          from: "player",
          to: "lou",
          side: "left",
          pullout: 2.4,
        },
        transitionIn: "cut",
        actions: [
          { kind: "teleport", at: 0, role: "lou", to: louStage },
          { kind: "teleport", at: 0, role: "player", to: playerStage },
          { kind: "face", at: 0, role: "lou", towards: { role: "player" } },
          { kind: "face", at: 0, role: "player", towards: { role: "lou" } },
          {
            kind: "dialogue",
            at: 0.2,
            role: "lou",
            speaker: "Dr. Lucien Ardan",
            text: "Thank you. You've done the right thing here, Seven.",
          },
          { kind: "music", at: 0.0, track: null },
          { kind: "sfx", at: 2.4, name: "snapshot.memory.consolidate" },
        ],
      },
      ...shots,
      {
        id: "the-card",
        duration: 4.0,
        camera: {
          kind: "overShoulder",
          from: "player",
          to: "lou",
          side: "right",
          pullout: 3,
        },
        transitionIn: "blend",
        blendSeconds: 0.5,
        actions: [
          { kind: "custom", at: 0.0, hook: "ch1.renameCard", payload: {} },
          {
            kind: "dialogue",
            at: 0.4,
            speaker: "Custodian Key 7",
            text: "Anchor Zero.",
          },
          { kind: "fade", at: 3.2, direction: "out", duration: 0.8 },
        ],
      },
    ],
    onEnd: {
      commits: [
        { hook: "ch1.applyConsolidation", payload: {} },
        {
          hook: "ch1.recoverFragment",
          payload: { fragmentId: "frag_a6_the_intake_window" },
        },
      ],
    },
  });
}

/** The intake window: the fourteen hours that were never in his case notes. */
export function ch1ReconIntakeCutscene(): CutsceneDef {
  const roomCamera = stageOffset(2.4, 1.7, -3);
  const roomFocus = stageOffset(0, 1.35, 1.1);
  return mustValidate({
    id: CH1_SCENE_IDS.reconIntake,
    name: "Fourteen Hours",
    priority: 100,
    settings: {
      skippable: false,
      skipAfterSeconds: 10,
      lockPlayer: true,
      letterbox: true,
      timeOfDay: 0.02,
      invulnerablePlayer: true,
    },
    cast: [
      { role: "player", binding: { kind: "player" } },
      {
        role: "lou",
        binding: {
          kind: "ghost",
          asset: SNAPSHOT_CUTSCENE_PLAYER_MESH_ASSET,
          family: "human",
          appearanceSourceEntityId: Number(CH1_NPC_ENTITY_IDS.lou_ardan),
          spawnAt: stageOffset(0, 0, 2.2),
        },
      },
    ],
    shots: [
      {
        id: "the-room",
        duration: 4.0,
        camera: {
          kind: "static",
          position: roomCamera,
          orientation: lookAtOrientation(roomCamera, roomFocus),
        },
        transitionIn: "fade",
        actions: [
          { kind: "teleport", at: 0, role: "player", to: CH1_MEMORY_STAGE },
          { kind: "face", at: 0, role: "player", towards: { role: "lou" } },
          { kind: "fov", at: 0, fov: 68 },
          {
            kind: "dialogue",
            at: 0.5,
            role: "player",
            speaker: "You",
            text: "I didn't sign that.",
          },
        ],
      },
      {
        id: "the-argument",
        duration: 4.4,
        until: { kind: "dialogueDone", maxDuration: 8 },
        camera: {
          kind: "overShoulder",
          from: "player",
          to: "lou",
          pullout: 1.6,
        },
        transitionIn: "blend",
        blendSeconds: 0.4,
        actions: [
          { kind: "face", at: 0, role: "lou", towards: { role: "player" } },
          {
            kind: "dialogue",
            at: 0.3,
            role: "lou",
            speaker: "Dr. Lucien Ardan",
            text: "No. You didn't.",
          },
        ],
      },
      {
        id: "the-kind-version",
        duration: 5.2,
        until: { kind: "dialogueDone", maxDuration: 9 },
        camera: {
          kind: "overShoulder",
          from: "player",
          to: "lou",
          pullout: 2.4,
        },
        transitionIn: "cut",
        actions: [
          {
            kind: "dialogue",
            at: 0.3,
            role: "lou",
            speaker: "Dr. Lucien Ardan",
            text: "I'm sorry. This is the kind version.",
          },
          { kind: "sfx", at: 2.2, name: "snapshot.alarm.close" },
          { kind: "fade", at: 4.2, direction: "out", duration: 1.0 },
        ],
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const CH1_SCENE_FACTORIES: ReadonlyMap<string, () => CutsceneDef> =
  new Map<string, () => CutsceneDef>([
    [CH1_SCENE_IDS.ignition, ch1IgnitionCutscene],
    [CH1_SCENE_IDS.firstGate, ch1FirstGateCutscene],
    [CH1_SCENE_IDS.persistentGate, ch1PersistentGateCutscene],
    [CH1_SCENE_IDS.overlayIveGotYou, ch1OverlayIveGotYouCutscene],
    [CH1_SCENE_IDS.reconArrival, ch1ReconArrivalCutscene],
    [CH1_SCENE_IDS.reconCorridor, ch1ReconCorridorCutscene],
    [`${CH1_SCENE_IDS.reconCorridor}-revised`, ch1ReconCorridorRevisedCutscene],
    [CH1_SCENE_IDS.overlayContainment, ch1OverlayContainmentCutscene],
    [CH1_SCENE_IDS.theFlinch, ch1TheFlinchCutscene],
    [CH1_SCENE_IDS.confrontation, ch1ConfrontationCutscene],
    [CH1_SCENE_IDS.sorrelDoor, ch1SorrelDoorCutscene],
    [CH1_SCENE_IDS.theCase, ch1TheCaseCutscene],
    [CH1_SCENE_IDS.consolidationRevision, ch1ConsolidationRevisionCutscene],
    [CH1_SCENE_IDS.reconIntake, ch1ReconIntakeCutscene],
    [CH1_SCENE_IDS.tooLate, ch1TooLateCutscene],
    [CH1_SCENE_IDS.theWatchHouse, ch1WatchHouseCutscene],
  ]);

export function ch1AllScenes(): CutsceneDef[] {
  return [...CH1_SCENE_FACTORIES.values()].map((f) => f());
}
