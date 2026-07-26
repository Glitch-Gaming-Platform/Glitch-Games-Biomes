// HARTHMERE_CUTSCENE_TEMPLATES
//
// The "generator" half of the cutscene system: parameterized scene archetypes
// that compile to full CutsceneDefs from live world positions. One template
// call works wherever the actors happen to stand. Each template encodes the
// cinematography rules from the design doc (start late/end early, establishing
// -> mediums -> close-ups, over-shoulder conversations, orbit reveals).

import type {
  CutsceneAction,
  CutsceneDef,
  CutsceneRoleBindingInput,
  CutsceneShot,
  CutsceneVec3,
} from "@/shared/cutscene/schema";
import {
  dialogueDurationSeconds,
  validateCutsceneDef,
} from "@/shared/cutscene/schema";
import { lookAtOrientation, v3add, v3dist } from "@/shared/cutscene/math";

function mustValidate(raw: unknown): CutsceneDef {
  const result = validateCutsceneDef(raw);
  if (!result.ok) {
    throw new Error(
      `cutscene template produced invalid def: ${result.issues
        .map((i) => `${i.path}: ${i.message}`)
        .join("; ")}`
    );
  }
  return result.def;
}

// ---------------------------------------------------------------------------
// Conversation: two actors, alternating over-shoulder coverage per line.
// ---------------------------------------------------------------------------

export interface ConversationLine {
  speaker: "a" | "b";
  text: string;
  emote?: string; // e.g. "talkGesture", "point", "laugh"
}

export function conversationCutscene(args: {
  id: string;
  name: string;
  a: CutsceneRoleBindingInput;
  b: CutsceneRoleBindingInput;
  lines: ConversationLine[];
  establishing?: boolean;
  settings?: Record<string, unknown>;
  onEnd?: unknown;
}): CutsceneDef {
  if (args.lines.length === 0) {
    throw new Error("conversationCutscene requires at least one line");
  }
  const shots: unknown[] = [];

  if (args.establishing !== false) {
    // Establishing two-shot before coverage.
    shots.push({
      id: "establishing",
      duration: 2.5,
      camera: {
        kind: "overShoulder",
        from: "a",
        to: "b",
        side: "left",
        pullout: 2.6,
      },
      transitionIn: "cut",
      actions: [
        { kind: "face", at: 0, role: "a", towards: { role: "b" } },
        { kind: "face", at: 0, role: "b", towards: { role: "a" } },
      ],
    });
  }

  for (const [i, line] of args.lines.entries()) {
    const from = line.speaker === "a" ? "b" : "a"; // camera behind the listener
    const to = line.speaker;
    const duration = dialogueDurationSeconds({ text: line.text });
    const actions: unknown[] = [
      {
        kind: "dialogue",
        at: 0.2,
        role: to,
        text: line.text,
      },
    ];
    if (line.emote) {
      actions.push({ kind: "emote", at: 0.2, role: to, emote: line.emote });
    }
    shots.push({
      id: `line-${i}`,
      duration: duration + 0.6,
      until: { kind: "dialogueDone", maxDuration: duration + 4 },
      camera: {
        kind: "overShoulder",
        from,
        to,
        side: i % 2 === 0 ? "right" : "left",
      },
      transitionIn: i === 0 && args.establishing === false ? "cut" : "blend",
      blendSeconds: 0.4,
      actions,
    });
  }

  return mustValidate({
    id: args.id,
    name: args.name,
    settings: args.settings ?? {},
    cast: [
      { role: "a", binding: args.a },
      { role: "b", binding: args.b },
    ],
    shots,
    onEnd: args.onEnd ?? {},
  });
}

// ---------------------------------------------------------------------------
// Boss intro: fade in -> low orbit reveal -> roar + shake -> whip to player.
// ---------------------------------------------------------------------------

export function bossIntroCutscene(args: {
  id: string;
  name: string;
  boss: CutsceneRoleBindingInput;
  bossName?: string;
  introLine?: string;
  orbitRadius?: number;
  music?: string;
  onEnd?: unknown;
}): CutsceneDef {
  const radius = args.orbitRadius ?? 7;
  const shots: unknown[] = [
    {
      id: "reveal-orbit",
      duration: 4.5,
      camera: {
        kind: "orbit",
        role: "boss",
        radius,
        height: 1.2, // low angle: menace
        startAngle: Math.PI * 0.15,
        endAngle: Math.PI * 0.85,
      },
      transitionIn: "fade",
      actions: [
        ...(args.introLine
          ? [
              {
                kind: "dialogue",
                at: 1.2,
                speaker: args.bossName ?? "???",
                text: args.introLine,
              },
            ]
          : []),
      ],
    },
    {
      id: "roar",
      duration: 2.2,
      camera: { kind: "trackRole", role: "boss", offset: [0, 1.6, 4.5] },
      transitionIn: "blend",
      blendSeconds: 0.5,
      actions: [
        { kind: "emote", at: 0.2, role: "boss", emote: "attack1" },
        {
          kind: "shake",
          at: 0.35,
          magnitude: 0.08,
          repeats: 5,
          durationMs: 900,
        },
        { kind: "sfx", at: 0.3, name: "boss_roar", atRole: "boss" },
      ],
    },
    {
      id: "player-resolve",
      duration: 1.8,
      camera: {
        kind: "overShoulder",
        from: "player",
        to: "boss",
        side: "right",
        pullout: 2.2,
      },
      transitionIn: "blend",
      blendSeconds: 0.4,
      actions: [
        { kind: "face", at: 0, role: "player", towards: { role: "boss" } },
      ],
    },
  ];

  return mustValidate({
    id: args.id,
    name: args.name,
    priority: 10, // boss moments outrank ambient scenes
    settings: {
      music: args.music,
      skippable: true,
    },
    cast: [
      { role: "boss", binding: args.boss },
      { role: "player", binding: { kind: "player" } },
    ],
    shots,
    onEnd: args.onEnd ?? {},
  });
}

// ---------------------------------------------------------------------------
// Hero versus creatures: a reusable three-shot combat vignette.
// ---------------------------------------------------------------------------

export interface HeroCombatEnemy {
  binding: CutsceneRoleBindingInput;
  /** Renderer-native stand-in used only if the exact ECS creature is absent. */
  ghostAsset?: string;
}

/**
 * Generate a finite combat scene with an encirclement, exchange, and finishing
 * beat. The timing scales from a 15-second reference choreography so future
 * hero fights need only canonical cast bindings, a stage center, and a weapon.
 * All attacks, reactions, deaths, and VFX are visual client puppetry; health,
 * drops, Anima decisions, Gaia, and ECS transforms remain authoritative.
 */
export function heroVsCreaturesCutscene(args: {
  id: string;
  name: string;
  hero: CutsceneRoleBindingInput;
  heroName: string;
  enemies: readonly HeroCombatEnemy[];
  center: CutsceneVec3;
  weaponItemId?: number;
  durationSeconds?: number;
  victoryLine?: string;
  music?: string;
  timeOfDay?: number;
}): CutsceneDef {
  if (args.enemies.length < 3 || args.enemies.length > 4) {
    throw new Error("heroVsCreaturesCutscene requires three or four enemies");
  }
  const total = args.durationSeconds ?? 15;
  if (!Number.isFinite(total) || total < 9 || total > 60) {
    throw new Error("heroVsCreaturesCutscene duration must be 9–60 seconds");
  }
  const scaleTime = (seconds: number) => (seconds * total) / 15;
  const revealDuration = scaleTime(4);
  const exchangeDuration = scaleTime(6);
  const finishDuration = total - revealDuration - exchangeDuration;
  const [x, y, z] = args.center;
  const enemyRoles = args.enemies.map((_, index) => `enemy${index + 1}`);
  const enemyPositions: CutsceneVec3[] = [
    [x - 2.6, y, z - 1.5],
    [x + 2.8, y, z - 0.9],
    [x + 0.7, y, z + 3.1],
    [x - 3.1, y, z + 2.4],
  ];
  const openingActions: unknown[] = [
    { kind: "fov", at: 0, fov: 50 },
    { kind: "teleport", at: 0, role: "hero", to: args.center },
    ...(args.weaponItemId === undefined
      ? []
      : [
          {
            kind: "holdItem",
            at: 0,
            role: "hero",
            itemId: args.weaponItemId,
          },
        ]),
  ];
  for (const [index, role] of enemyRoles.entries()) {
    openingActions.push(
      { kind: "teleport", at: 0, role, to: enemyPositions[index] },
      { kind: "face", at: 0, role, towards: { role: "hero" } }
    );
  }
  openingActions.push({
    kind: "face",
    at: 0,
    role: "hero",
    towards: { role: enemyRoles[0] },
  });
  for (const [index, role] of enemyRoles.entries()) {
    openingActions.push({
      kind: "emote",
      at: scaleTime(2.35 + index * 0.32),
      role,
      emote: index % 2 === 0 ? "attack1" : "attack2",
    });
  }

  const exchangeActions: unknown[] = [
    { kind: "fov", at: 0, fov: 43 },
    { kind: "emote", at: scaleTime(0.35), role: "hero", emote: "attack1" },
    {
      kind: "emote",
      at: scaleTime(0.6),
      role: enemyRoles[0],
      emote: "hitReact",
    },
    {
      kind: "vfx",
      at: scaleTime(0.62),
      effect: "combatImpact",
      atRole: enemyRoles[0],
    },
    {
      kind: "shake",
      at: scaleTime(0.62),
      magnitude: 0.035,
      repeats: 3,
      durationMs: 420,
    },
    {
      kind: "emote",
      at: scaleTime(1.28),
      role: enemyRoles[0],
      emote: "death",
    },
    {
      kind: "emote",
      at: scaleTime(1.55),
      role: enemyRoles[1],
      emote: "attack1",
    },
    { kind: "emote", at: scaleTime(1.82), role: "hero", emote: "hitReact" },
    { kind: "emote", at: scaleTime(2.42), role: "hero", emote: "attack2" },
    {
      kind: "emote",
      at: scaleTime(2.7),
      role: enemyRoles[1],
      emote: "hitReact",
    },
    {
      kind: "vfx",
      at: scaleTime(2.72),
      effect: "combatImpact",
      atRole: enemyRoles[1],
    },
    {
      kind: "emote",
      at: scaleTime(3.38),
      role: enemyRoles[1],
      emote: "death",
    },
    {
      kind: "moveTo",
      at: scaleTime(3.1),
      role: enemyRoles[2],
      to: { role: "hero" },
      speed: 1.6,
      arriveWithin: 1.35,
      timeoutSeconds: scaleTime(2.2),
      timeoutFallback: "skip",
    },
    {
      kind: "emote",
      at: scaleTime(4.12),
      role: enemyRoles[2],
      emote: "attack2",
    },
    { kind: "emote", at: scaleTime(4.58), role: "hero", emote: "attack1" },
    {
      kind: "emote",
      at: scaleTime(4.88),
      role: enemyRoles[2],
      emote: "hitReact",
    },
    {
      kind: "vfx",
      at: scaleTime(4.9),
      effect: "combatImpact",
      atRole: enemyRoles[2],
    },
  ];

  // A fourth enemy is optional; keep it visibly threatening during the main
  // exchange without changing the three-beat choreography for smaller packs.
  if (enemyRoles[3]) {
    exchangeActions.push(
      {
        kind: "moveTo",
        at: scaleTime(2.9),
        role: enemyRoles[3],
        to: { role: "hero" },
        speed: 1.35,
        arriveWithin: 1.8,
        timeoutSeconds: scaleTime(2.6),
        timeoutFallback: "skip",
      },
      {
        kind: "emote",
        at: scaleTime(4.4),
        role: enemyRoles[3],
        emote: "attack1",
      }
    );
  }

  const finalEnemy = enemyRoles[2];
  const finishActions: unknown[] = [
    { kind: "fov", at: 0, fov: 38 },
    { kind: "face", at: 0, role: "hero", towards: { role: finalEnemy } },
    { kind: "face", at: 0, role: finalEnemy, towards: { role: "hero" } },
    { kind: "emote", at: scaleTime(0.22), role: finalEnemy, emote: "attack2" },
    { kind: "emote", at: scaleTime(0.5), role: "hero", emote: "hitReact" },
    { kind: "emote", at: scaleTime(1.18), role: "hero", emote: "attack2" },
    { kind: "emote", at: scaleTime(1.48), role: finalEnemy, emote: "hitReact" },
    {
      kind: "vfx",
      at: scaleTime(1.5),
      effect: "combatImpact",
      atRole: finalEnemy,
    },
    {
      kind: "shake",
      at: scaleTime(1.5),
      magnitude: 0.055,
      repeats: 4,
      durationMs: 620,
    },
    { kind: "emote", at: scaleTime(2.02), role: finalEnemy, emote: "death" },
    {
      kind: "emote",
      at: scaleTime(2.65),
      role: "hero",
      emote: "guardPatrolIdle",
    },
    ...(args.victoryLine
      ? [
          {
            kind: "dialogue",
            at: scaleTime(2.72),
            role: "hero",
            speaker: args.heroName,
            text: args.victoryLine,
            duration: Math.max(1, finishDuration - scaleTime(2.9)),
          },
        ]
      : []),
  ];
  if (enemyRoles[3]) {
    finishActions.unshift({
      kind: "emote",
      at: scaleTime(0.08),
      role: enemyRoles[3],
      emote: "death",
    });
  }

  return mustValidate({
    id: args.id,
    name: args.name,
    version: 1,
    priority: 20,
    settings: {
      skippable: true,
      skipAfterSeconds: 3,
      lockPlayer: true,
      hideHud: true,
      letterbox: true,
      invulnerablePlayer: true,
      mode: "clientPuppet",
      music: args.music ?? "battle_music",
      timeOfDay: args.timeOfDay ?? 0.68,
      commitOn: [],
      // The cinematic shots total exactly `total`; the slightly larger safety
      // ceiling prevents the runtime's hard >= guard from aborting on the exact
      // final timeline tick or a tiny floating-point overshoot.
      maxSceneDurationSeconds: Math.min(900, total + 2),
    },
    cast: [
      { role: "hero", binding: args.hero, required: true },
      ...args.enemies.map((enemy, index) =>
        enemy.ghostAsset
          ? {
              role: enemyRoles[index],
              binding: enemy.binding,
              required: true,
              // Fallbacks are opt-in because a generic humanoid silently
              // replacing a creature makes otherwise-valid promo footage lie.
              fallback: "ghost" as const,
              ghostAsset: enemy.ghostAsset,
            }
          : {
              role: enemyRoles[index],
              binding: enemy.binding,
              required: true,
              fallback: "skipActions" as const,
            }
      ),
    ],
    shots: [
      {
        id: "encircled",
        duration: revealDuration,
        camera: {
          kind: "orbit",
          role: "hero",
          radius: 8,
          height: 2.4,
          startAngle: Math.PI * 0.12,
          endAngle: Math.PI * 0.78,
          easing: "easeInOut",
        },
        transitionIn: "fade",
        actions: openingActions,
      },
      {
        id: "breakthrough",
        duration: exchangeDuration,
        camera: {
          kind: "dolly",
          waypoints: [
            { position: [x - 7, y + 2.5, z + 5.8] },
            { position: [x - 4.4, y + 1.8, z + 2.8] },
            { position: [x + 5.6, y + 1.7, z + 4.2] },
          ],
          lookAtRole: "hero",
          easing: "easeInOut",
        },
        transitionIn: "blend",
        blendSeconds: 0.35,
        actions: exchangeActions,
      },
      {
        id: "road-clear",
        duration: finishDuration,
        camera: {
          kind: "static",
          position: [x + 6.8, y + 2.3, z + 6.2],
          lookAtRole: "hero",
        },
        transitionIn: "blend",
        blendSeconds: 0.3,
        actions: finishActions,
      },
    ],
    onEnd: { placements: [], commits: [] },
  });
}

// ---------------------------------------------------------------------------
// Quest complete: NPC gesture + reward beat, short push-in.
// ---------------------------------------------------------------------------

export function questCompleteCutscene(args: {
  id: string;
  name: string;
  npc: CutsceneRoleBindingInput;
  npcName?: string;
  thanksLine: string;
  commitHook?: { hook: string; payload?: unknown };
  onEndPlacements?: unknown[];
}): CutsceneDef {
  const duration = dialogueDurationSeconds({ text: args.thanksLine });
  return mustValidate({
    id: args.id,
    name: args.name,
    settings: { letterbox: true, skippable: true },
    cast: [
      { role: "npc", binding: args.npc },
      { role: "player", binding: { kind: "player" } },
    ],
    shots: [
      {
        id: "thanks",
        duration: duration + 1,
        until: { kind: "dialogueDone", maxDuration: duration + 5 },
        camera: { kind: "overShoulder", from: "player", to: "npc" },
        actions: [
          { kind: "face", at: 0, role: "npc", towards: { role: "player" } },
          { kind: "emote", at: 0.3, role: "npc", emote: "questGesture" },
          {
            kind: "dialogue",
            at: 0.3,
            role: "npc",
            speaker: args.npcName,
            text: args.thanksLine,
          },
        ],
      },
      {
        id: "reward",
        duration: 1.6,
        camera: { kind: "trackRole", role: "player", offset: [0, 1.5, 3] },
        transitionIn: "blend",
        actions: [
          { kind: "sfx", at: 0.2, name: "quest_complete" },
          { kind: "emote", at: 0.3, role: "player", emote: "flex" },
        ],
      },
    ],
    onEnd: {
      placements: args.onEndPlacements ?? [],
      commits: args.commitHook ? [args.commitHook] : [],
    },
  });
}

// ---------------------------------------------------------------------------
// Establishing flyover: crane-down dolly around a landmark AABB.
// ---------------------------------------------------------------------------

export function establishingFlyoverCutscene(args: {
  id: string;
  name: string;
  center: CutsceneVec3;
  extent?: number; // approximate landmark radius
  title?: string; // optional subtitle, e.g. the town name
  timeOfDay?: number;
}): CutsceneDef {
  const extent = Math.max(8, args.extent ?? 24);
  const high = extent * 1.6;
  const mid = extent * 0.9;
  // A descending three-quarter arc, every waypoint framing the landmark.
  const positions: CutsceneVec3[] = [
    v3add(args.center, [extent * 1.8, high, extent * 1.8]),
    v3add(args.center, [-extent * 1.4, mid, extent * 1.5]),
    v3add(args.center, [-extent * 1.1, extent * 0.45, -extent * 1.2]),
  ];
  const waypoints = positions.map((position) => ({
    position,
    orientation: lookAtOrientation(position, args.center),
  }));
  const actions: unknown[] = [];
  if (args.title) {
    actions.push({ kind: "dialogue", at: 1.2, speaker: "", text: args.title });
  }
  return mustValidate({
    id: args.id,
    name: args.name,
    settings: {
      timeOfDay: args.timeOfDay,
      invulnerablePlayer: true,
    },
    cast: [{ role: "player", binding: { kind: "player" } }],
    shots: [
      {
        id: "flyover",
        duration: 7,
        camera: {
          kind: "dolly",
          waypoints,
          easing: "easeInOut",
        },
        transitionIn: "fade",
        actions,
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Reveal: slow push-in on a world position (door, crate, clue).
// ---------------------------------------------------------------------------

export function revealCutscene(args: {
  id: string;
  name: string;
  target: CutsceneVec3;
  from?: CutsceneVec3;
  line?: { speaker?: string; text: string };
  sfx?: string;
}): CutsceneDef {
  const from = args.from ?? v3add(args.target, [4.5, 2.2, 4.5]);
  const near = v3add(args.target, [1.6, 1.2, 1.6]);
  if (v3dist(from, args.target) < 0.5) {
    throw new Error("revealCutscene: from too close to target");
  }
  const actions: CutsceneAction[] = [];
  if (args.sfx) {
    actions.push({ kind: "sfx", at: 0.4, name: args.sfx } as CutsceneAction);
  }
  if (args.line) {
    actions.push({
      kind: "dialogue",
      at: 0.8,
      speaker: args.line.speaker,
      text: args.line.text,
    } as CutsceneAction);
  }
  const shot: unknown = {
    id: "reveal",
    duration: 3.2,
    camera: {
      kind: "dolly",
      waypoints: [{ position: from }, { position: near }],
      easing: "easeInOut",
      // Make the subject explicit. Falling back to "look along the path"
      // happened to work for ideal geometry, but terrain collision recovery
      // can lift the camera without recomputing that implicit aim and leave a
      // capture staring into empty sky.
      lookAtRole: "revealTarget",
    },
    transitionIn: "fade",
    actions,
  };
  const shots: unknown[] = [shot];
  return mustValidate({
    id: args.id,
    name: args.name,
    cast: [
      { role: "player", binding: { kind: "player" } },
      {
        role: "revealTarget",
        binding: {
          kind: "anchor",
          position: args.target,
          height: 1,
          label: `${args.name} reveal target`,
        },
      },
    ],
    shots: shots as CutsceneShot[],
  });
}
