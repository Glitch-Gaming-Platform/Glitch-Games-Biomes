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
  revealCutscene,
} from "@/shared/cutscene/templates";
import {
  validateCutsceneDef,
  type CutsceneDef,
  type CutsceneVec3,
} from "@/shared/cutscene/schema";
import { SNAPSHOT_GROVE_JACKIE_ENTITY_ID } from "@/shared/harthmere/snapshot_grove_ids";
import { CH1_ANCHORS, CH1_NPC_ENTITY_IDS } from "@/shared/harthmere/ch1_ids";
import {
  CH1_CONSOLIDATION_ENTRY_SECONDS,
  CH1_CONSOLIDATION_ORDER,
} from "@/shared/harthmere/ch1_fragment_ledger";
import { withCh1DialogueVoices } from "@/shared/harthmere/ch1_voice";

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

function mustValidate(def: unknown): CutsceneDef {
  const result = validateCutsceneDef(def);
  if (!result.ok) {
    throw new Error(
      `invalid Chapter 1 cutscene: ${result.issues
        .map((i) => `${i.path}: ${i.message}`)
        .join("; ")}`
    );
  }
  // Attach provider-neutral voice descriptors after structural validation;
  // the client library validates the enriched scene again when registering.
  return withCh1DialogueVoices(result.def);
}

// Flashback staging. Memories are played in a neutral pocket above the Grove
// so ghost actors never intersect live terrain or seeded NPCs. Ghosts are
// client-only meshes; nothing here touches the world.
export const CH1_MEMORY_STAGE: CutsceneVec3 = [496, 140, -126];

function stageOffset(dx: number, dy: number, dz: number): CutsceneVec3 {
  return [
    CH1_MEMORY_STAGE[0] + dx,
    CH1_MEMORY_STAGE[1] + dy,
    CH1_MEMORY_STAGE[2] + dz,
  ];
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
          kind: "nearestNpc",
          labelMatch: "Mucked Robot|AUGUR-9",
          within: 24,
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
          { kind: "emote", at: 0.2, role: "augur9", emote: "workLoop" },
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
          pullout: 1.6,
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
        camera: { kind: "pov", role: "player", lookAtRole: "augur9" },
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
  return mustValidate({
    id: CH1_SCENE_IDS.firstGate,
    name: "The Fence Line Seam",
    priority: 15,
    settings: { letterbox: true, timeOfDay: 0.78 },
    cast: [
      { role: "player", binding: { kind: "player" } },
      {
        role: "jackie",
        binding: {
          kind: "entity",
          entityId: Number(SNAPSHOT_GROVE_JACKIE_ENTITY_ID),
        },
        required: false,
        fallback: "skipActions",
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
          kind: "overShoulder",
          from: "player",
          to: "seam",
          pullout: 2.2,
        },
        transitionIn: "cut",
        actions: [
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
            { position: [514, 73, -198] },
            { position: [518, 72.5, -203] },
          ],
          easing: "easeInOut",
          lookAtRole: "seam",
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
          kind: "overShoulder",
          from: "seam",
          to: "jackie",
          pullout: 2.0,
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
          kind: "overShoulder",
          from: "jackie",
          to: "player",
          pullout: 1.7,
        },
        transitionIn: "blend",
        actions: [
          {
            kind: "dialogue",
            at: 0.2,
            role: "player",
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
  return withCh1DialogueVoices(
    revealCutscene({
      id: CH1_SCENE_IDS.persistentGate,
      name: "It Did Not Close",
      target: CH1_ANCHORS.gate_desert as unknown as CutsceneVec3,
      from: [
        CH1_ANCHORS.gate_desert[0] - 9,
        CH1_ANCHORS.gate_desert[1] + 4,
        CH1_ANCHORS.gate_desert[2] - 9,
      ],
      line: {
        speaker: "Halden Rook",
        text: "Two years I have watched these open on your side of the river and never once on mine.",
      },
      sfx: "snapshot.gate.hum",
    })
  );
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
          asset: "townsperson_clergy",
          family: "human",
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
        camera: { kind: "pov", role: "player", eyeHeight: 1.55 },
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
        camera: { kind: "pov", role: "player", eyeHeight: 1.5 },
        transitionIn: "blend",
        blendSeconds: 0.4,
        actions: [
          {
            kind: "dialogue",
            at: 0.4,
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
  // Ghost assets must be keys in the live-creature renderer catalogue. The
  // earlier `townsperson_ranger` label was narrative shorthand, not a shipped
  // asset key, so revised Jackie could disappear from real captures.
  const womanAsset = revised ? "townsperson_market" : "townsperson_undead";
  const womanSpeaker = revised ? "Jackie" : "A woman, running";

  // What is in her hand. Act 3 never names it. Act 6 names it and names
  // nothing else.
  const handLine = revised
    ? "It is the vial you had analysed. The one you reported her for."
    : "There is something in her hand.";

  const behindSpeaker = revised ? "Dr. Lucien Ardan" : "A voice behind you";

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
          asset: womanAsset,
          family: "human",
          spawnAt: stageOffset(0, 0, 9),
        },
      },
      {
        role: "man",
        binding: {
          kind: "ghost",
          asset: "townsperson_clergy",
          family: "human",
          spawnAt: stageOffset(0, 0, -1.6),
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
        camera: { kind: "pov", role: "player", eyeHeight: 1.55 },
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
          kind: "pov",
          role: "player",
          eyeHeight: 1.5,
          lookAtRole: "woman",
        },
        transitionIn: "cut",
        actions: [
          { kind: "face", at: 0, role: "woman", towards: { role: "player" } },
          {
            kind: "moveTo",
            at: 0.1,
            role: "woman",
            to: { role: "player" },
            speed: 4.2,
            arriveWithin: 2.0,
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
          kind: "pov",
          role: "player",
          eyeHeight: 1.45,
          lookAtRole: "woman",
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
          position: stageOffset(2.4, 1.7, -3.0),
          lookAtRole: "woman",
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
  return mustValidate({
    id: CH1_SCENE_IDS.reconArrival,
    name: "The Night You Came",
    priority: 25,
    settings: {
      letterbox: true,
      lockPlayer: true,
      timeOfDay: 0.95,
      skipAfterSeconds: 5,
    },
    cast: [
      { role: "player", binding: { kind: "player" } },
      {
        role: "carrier",
        binding: {
          kind: "ghost",
          asset: "townsperson_market",
          family: "human",
          spawnAt: stageOffset(0, 0, 12),
        },
      },
      {
        role: "roadhouse",
        binding: {
          kind: "anchor",
          position: stageOffset(0, 0, -6),
          height: 4,
          label: "The road-house",
        },
      },
    ],
    shots: [
      {
        id: "rain-on-the-road",
        duration: 3.4,
        camera: {
          kind: "dolly",
          waypoints: [
            { position: stageOffset(6, 3.2, 14) },
            { position: stageOffset(3.5, 2.4, 6) },
          ],
          easing: "easeInOut",
          lookAtRole: "carrier",
        },
        transitionIn: "fade",
        actions: [
          { kind: "sfx", at: 0, name: "snapshot.rain.heavy" },
          {
            kind: "moveTo",
            at: 0.2,
            role: "carrier",
            to: { role: "roadhouse" },
            speed: 1.9,
            timeoutSeconds: 12,
            timeoutFallback: "skip",
          },
        ],
      },
      {
        id: "she-does-not-stop",
        duration: 4.0,
        camera: { kind: "trackRole", role: "carrier", offset: [2.6, 1.9, 3.4] },
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
          kind: "trackRole",
          role: "carrier",
          offset: [-2.4, 2.1, 3.0],
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
          kind: "orbit",
          role: "carrier",
          radius: 4.2,
          height: 2.6,
          startAngle: 0.2,
          endAngle: 1.9,
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
  return withCh1DialogueVoices(
    revealCutscene({
      id: CH1_SCENE_IDS.overlayContainment,
      name: "Thirty-One Seconds",
      target: CH1_ANCHORS.ashline_refinery_intake as unknown as CutsceneVec3,
      from: [
        CH1_ANCHORS.ashline_refinery_intake[0] - 6,
        CH1_ANCHORS.ashline_refinery_intake[1] + 3.5,
        CH1_ANCHORS.ashline_refinery_intake[2] - 6,
      ],
      line: {
        speaker: "Foreman Calla Ashe",
        text: "How did you do that?",
      },
      sfx: "snapshot.containment.settle",
    })
  );
}

// ---------------------------------------------------------------------------
// Act 3 / 4 / 5 — present-day conversations
// ---------------------------------------------------------------------------

export function ch1TheFlinchCutscene(): CutsceneDef {
  return withCh1DialogueVoices(
    conversationCutscene({
      id: CH1_SCENE_IDS.theFlinch,
      name: "Three Days",
      a: { kind: "entity", entityId: Number(SNAPSHOT_GROVE_JACKIE_ENTITY_ID) },
      b: { kind: "player" },
      lines: [
        {
          speaker: "a",
          text: "You were gone three days.",
          emote: "talkGesture",
        },
        { speaker: "a", text: "Three. Days." },
        { speaker: "a", text: "Right. Okay." },
      ],
      settings: { letterbox: true, timeOfDay: 0.25 },
    })
  );
}

export function ch1ConfrontationCutscene(): CutsceneDef {
  return withCh1DialogueVoices(
    conversationCutscene({
      id: CH1_SCENE_IDS.confrontation,
      name: "Ask Me In a Month",
      a: { kind: "entity", entityId: Number(SNAPSHOT_GROVE_JACKIE_ENTITY_ID) },
      b: { kind: "player" },
      lines: [
        { speaker: "b", text: "What have you been putting in the tea?" },
        { speaker: "a", text: "It's medicine.", emote: "talkGesture" },
        { speaker: "b", text: "Medicine for what?" },
        { speaker: "a", text: "You need to keep taking it." },
        { speaker: "b", text: "That is not an answer." },
        { speaker: "a", text: "Ask me again in a month." },
      ],
      settings: { letterbox: true },
    })
  );
}

export function ch1SorrelDoorCutscene(): CutsceneDef {
  return withCh1DialogueVoices(
    conversationCutscene({
      id: CH1_SCENE_IDS.sorrelDoor,
      name: "The Bar-Slot",
      a: { kind: "entity", entityId: Number(CH1_NPC_ENTITY_IDS.nadia_sorrel) },
      b: { kind: "player" },
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
  return withCh1DialogueVoices(
    conversationCutscene({
      id: CH1_SCENE_IDS.theCase,
      name: "The Case",
      a: { kind: "entity", entityId: Number(CH1_NPC_ENTITY_IDS.lou_ardan) },
      b: { kind: "player" },
      lines: [
        {
          speaker: "a",
          text: "They know who you are. I want you to hear that from me and not from a form.",
          emote: "talkGesture",
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
      settings: { letterbox: true, skipAfterSeconds: 8 },
    })
  );
}

export function ch1TooLateCutscene(): CutsceneDef {
  return withCh1DialogueVoices(
    conversationCutscene({
      id: CH1_SCENE_IDS.tooLate,
      name: "Too Late",
      a: { kind: "entity", entityId: Number(CH1_NPC_ENTITY_IDS.lou_ardan) },
      b: { kind: "player" },
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
      settings: { letterbox: true, skipAfterSeconds: 8 },
    })
  );
}

export function ch1WatchHouseCutscene(): CutsceneDef {
  return withCh1DialogueVoices(
    conversationCutscene({
      id: CH1_SCENE_IDS.theWatchHouse,
      name: "The Watch House",
      a: { kind: "entity", entityId: Number(SNAPSHOT_GROVE_JACKIE_ENTITY_ID) },
      b: { kind: "player" },
      lines: [
        { speaker: "a", text: "Did he take it?" },
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
      settings: { letterbox: true, timeOfDay: 0.1, skipAfterSeconds: 10 },
    })
  );
}

// ---------------------------------------------------------------------------
// Act 6 — the consolidation revision sequence
//
// Six ledger entries rewrite themselves in front of the player, one at a time,
// with no input accepted. This is the chapter's cinematic payload.
// ---------------------------------------------------------------------------

export function ch1ConsolidationRevisionCutscene(): CutsceneDef {
  const shots = CH1_CONSOLIDATION_ORDER.map((fragmentId, index) => ({
    id: `revision-${index}-${fragmentId}`,
    duration: CH1_CONSOLIDATION_ENTRY_SECONDS,
    camera: {
      kind: "pov" as const,
      role: "player",
      eyeHeight: 1.6,
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
      hideHud: false,
      letterbox: true,
      invulnerablePlayer: true,
      commitOn: ["completed", "skipped"],
      maxSceneDurationSeconds: 90,
    },
    cast: [{ role: "player", binding: { kind: "player" } }],
    shots: [
      {
        id: "the-word",
        duration: 3.0,
        camera: { kind: "pov", role: "player", eyeHeight: 1.6 },
        transitionIn: "cut",
        actions: [
          {
            kind: "dialogue",
            at: 0.2,
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
        camera: { kind: "pov", role: "player", eyeHeight: 1.6 },
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
          asset: "townsperson_clergy",
          family: "human",
          spawnAt: stageOffset(0, 0, 2.2),
        },
      },
    ],
    shots: [
      {
        id: "the-room",
        duration: 4.0,
        camera: { kind: "pov", role: "player", eyeHeight: 1.2 },
        transitionIn: "fade",
        actions: [
          { kind: "teleport", at: 0, role: "player", to: CH1_MEMORY_STAGE },
          { kind: "face", at: 0, role: "player", towards: { role: "lou" } },
          { kind: "fov", at: 0, fov: 68 },
          {
            kind: "dialogue",
            at: 0.5,
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
          from: "lou",
          to: "player",
          pullout: 1.4,
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
