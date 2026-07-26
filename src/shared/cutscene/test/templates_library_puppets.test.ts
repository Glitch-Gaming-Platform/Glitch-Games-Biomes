import { CutsceneLibrary, CutsceneQueue } from "@/shared/cutscene/library";
import {
  isGhostPuppetId,
  mergeCutscenePuppetOverrides,
} from "@/shared/cutscene/puppets";
import { validateCutsceneDef } from "@/shared/cutscene/schema";
import {
  bossIntroCutscene,
  conversationCutscene,
  establishingFlyoverCutscene,
  heroVsCreaturesCutscene,
  questCompleteCutscene,
  revealCutscene,
} from "@/shared/cutscene/templates";
import {
  JACKIE_VS_MUCKERS_CUTSCENE_ID,
  JACKIE_VS_MUCKERS_DURATION_SECONDS,
  jackieVsMuckersCutscene,
} from "@/shared/cutscene/harthmere_scenes";
import type { HarthmereLiveCreatureBridgeRecord } from "@/shared/harthmere/live_creature_ecs_bridge";
import { HARTHMERE_JACKIE_FIGHT_MUCKER_ENTITY_IDS } from "@/shared/harthmere/live_entity_seed_ids";
import assert from "assert";

describe("cutscene templates", () => {
  it("conversation generates establishing + per-line over-shoulder coverage", () => {
    const def = conversationCutscene({
      id: "talk-1",
      name: "Talk",
      a: { kind: "player" },
      b: { kind: "entity", entityId: 42 },
      lines: [
        { speaker: "a", text: "You stole it." },
        { speaker: "b", text: "I had no choice.", emote: "talkGesture" },
        { speaker: "a", text: "There is always a choice." },
      ],
    });
    assert.strictEqual(def.shots.length, 4); // establishing + 3 lines
    assert.strictEqual(def.shots[0].id, "establishing");
    // Coverage alternates behind the listener.
    const line0 = def.shots[1];
    assert.ok(line0.camera.kind === "overShoulder");
    assert.strictEqual(line0.camera.from, "b"); // a speaks -> camera behind b
    assert.strictEqual(line0.camera.to, "a");
    const line1 = def.shots[2];
    assert.ok(line1.camera.kind === "overShoulder");
    assert.strictEqual(line1.camera.from, "a");
    // Every line shot is capped (until.maxDuration) so it can never hang.
    for (const shot of def.shots.slice(1)) {
      assert.ok(shot.until && shot.until.maxDuration >= shot.duration);
    }
    // Emote carried through.
    assert.ok(
      def.shots[2].actions.some(
        (a) => a.kind === "emote" && a.emote === "talkGesture"
      )
    );
    // Re-validates cleanly (round trip).
    assert.ok(validateCutsceneDef(def).ok);
  });

  it("conversation rejects empty line lists", () => {
    assert.throws(() =>
      conversationCutscene({
        id: "x",
        name: "x",
        a: { kind: "player" },
        b: { kind: "entity", entityId: 1 },
        lines: [],
      })
    );
  });

  it("bossIntro produces orbit reveal, roar with shake, and player resolve", () => {
    const def = bossIntroCutscene({
      id: "thaedryn-intro",
      name: "Thaedryn Awakens",
      boss: { kind: "entity", entityId: 777 },
      bossName: "Thaedryn",
      introLine: "You dare enter my domain?",
      music: "battle_music",
    });
    assert.strictEqual(def.shots.length, 3);
    assert.strictEqual(def.shots[0].camera.kind, "orbit");
    assert.ok(def.priority > 0, "boss scenes outrank ambient scenes");
    assert.strictEqual(def.settings.music, "battle_music");
    const roar = def.shots[1];
    assert.ok(roar.actions.some((a) => a.kind === "shake"));
    assert.ok(
      roar.actions.some((a) => a.kind === "emote" && a.emote === "attack1")
    );
    const resolve = def.shots[2];
    assert.ok(
      resolve.camera.kind === "overShoulder" && resolve.camera.to === "boss"
    );
    assert.ok(validateCutsceneDef(def).ok);
  });

  it("hero-versus-creatures generates an exact finite combat choreography", () => {
    const def = heroVsCreaturesCutscene({
      id: "hero-fight",
      name: "Hero Fight",
      hero: { kind: "entity", entityId: 1 },
      heroName: "Hero",
      enemies: [2, 3, 4].map((entityId) => ({
        binding: { kind: "entity" as const, entityId },
      })),
      center: [10, 20, 30],
      weaponItemId: 99,
      durationSeconds: 15,
      victoryLine: "Clear.",
    });
    assert.strictEqual(
      def.shots.reduce((total, shot) => total + shot.duration, 0),
      15
    );
    assert.strictEqual(def.settings.maxSceneDurationSeconds, 17);
    assert.strictEqual(def.settings.mode, "clientPuppet");
    assert.strictEqual(def.cast.length, 4);
    assert.ok(
      def.shots[0].actions.some(
        (action) => action.kind === "holdItem" && action.itemId === 99
      )
    );
    assert.ok(
      def.shots.some((shot) =>
        shot.actions.some(
          (action) => action.kind === "vfx" && action.effect === "combatImpact"
        )
      )
    );
    assert.ok(
      def.shots.some((shot) =>
        shot.actions.some(
          (action) => action.kind === "emote" && action.emote === "death"
        )
      )
    );
    assert.ok(validateCutsceneDef(def).ok);
    assert.throws(() =>
      heroVsCreaturesCutscene({
        id: "too-small",
        name: "Too Small",
        hero: { kind: "entity", entityId: 1 },
        heroName: "Hero",
        enemies: [2, 3].map((entityId) => ({
          binding: { kind: "entity" as const, entityId },
        })),
        center: [0, 0, 0],
      })
    );
  });

  it("authors Jackie versus three canonical Muckers as a 15-second scene", () => {
    const def = jackieVsMuckersCutscene();
    assert.strictEqual(def.id, JACKIE_VS_MUCKERS_CUTSCENE_ID);
    assert.strictEqual(
      def.shots.reduce((total, shot) => total + shot.duration, 0),
      JACKIE_VS_MUCKERS_DURATION_SECONDS
    );
    assert.strictEqual(def.cast[0].role, "hero");
    assert.strictEqual(def.cast.slice(1).length, 3);
    assert.deepStrictEqual(
      def.cast
        .slice(1)
        .map((member) =>
          member.binding.kind === "entity" ? member.binding.entityId : undefined
        ),
      HARTHMERE_JACKIE_FIGHT_MUCKER_ENTITY_IDS.map(Number)
    );
    assert.ok(
      def.cast
        .slice(1)
        .every(
          (member) => member.fallback === "skipActions" && !member.ghostAsset
        )
    );
    assert.ok(validateCutsceneDef(def).ok);
  });

  it("questComplete wires the commit hook into onEnd", () => {
    const def = questCompleteCutscene({
      id: "qc-1",
      name: "Quest Complete",
      npc: { kind: "nearestNpc", labelMatch: "elder" },
      npcName: "Elder Rowan",
      thanksLine: "The village owes you everything, traveler.",
      commitHook: {
        hook: "quest.complete",
        payload: { questId: "bible_quest_3" },
      },
    });
    assert.strictEqual(def.onEnd.commits.length, 1);
    assert.strictEqual(def.onEnd.commits[0].hook, "quest.complete");
    assert.ok(def.shots[0].until?.kind === "dialogueDone");
    assert.ok(validateCutsceneDef(def).ok);
  });

  it("flyover waypoints descend toward the landmark and frame it", () => {
    const center: [number, number, number] = [640, 64, -268];
    const def = establishingFlyoverCutscene({
      id: "town-flyover",
      name: "Harthmere",
      center,
      extent: 30,
      title: "HARTHMERE",
      timeOfDay: 0.3,
    });
    const camera = def.shots[0].camera;
    assert.ok(camera.kind === "dolly");
    assert.ok(camera.waypoints.length >= 3);
    // Heights strictly descend.
    const ys = camera.waypoints.map((w) => w.position[1]);
    for (let i = 1; i < ys.length; i += 1) {
      assert.ok(ys[i] < ys[i - 1]);
    }
    // Every waypoint carries an orientation (framing the landmark).
    assert.ok(camera.waypoints.every((w) => !!w.orientation));
    assert.strictEqual(def.settings.timeOfDay, 0.3);
    assert.ok(validateCutsceneDef(def).ok);
  });

  it("reveal rejects a from-position on top of the target", () => {
    assert.throws(() =>
      revealCutscene({
        id: "r",
        name: "r",
        target: [0, 0, 0],
        from: [0.1, 0, 0],
      })
    );
    const ok = revealCutscene({
      id: "r2",
      name: "r2",
      target: [10, 5, 10],
      line: { speaker: "", text: "What is that...?" },
      sfx: "discover",
    });
    assert.ok(validateCutsceneDef(ok).ok);
    const target = ok.cast.find((member) => member.role === "revealTarget");
    assert.equal(target?.binding.kind, "anchor");
    assert.equal(ok.shots[0].camera.kind, "dolly");
    if (ok.shots[0].camera.kind === "dolly") {
      assert.equal(ok.shots[0].camera.lookAtRole, "revealTarget");
    }
  });
});

describe("cutscene library and queue", () => {
  it("library rejects invalid defs and returns registered ones", () => {
    const lib = new CutsceneLibrary();
    assert.throws(() => lib.register({ id: "bad" }));
    const def = lib.register({
      id: "ok",
      name: "Ok",
      cast: [{ role: "player", binding: { kind: "player" } }],
      shots: [
        {
          id: "s",
          duration: 1,
          camera: { kind: "static", position: [0, 0, 0] },
        },
      ],
    });
    assert.strictEqual(lib.get("ok"), def);
    assert.strictEqual(lib.list().length, 1);
  });

  function mkDef(id: string, priority = 0) {
    const lib = new CutsceneLibrary();
    return lib.register({
      id,
      name: id,
      priority,
      cast: [{ role: "player", binding: { kind: "player" } }],
      shots: [
        {
          id: "s",
          duration: 1,
          camera: { kind: "static", position: [0, 0, 0] },
        },
      ],
    });
  }

  it("queue never overlaps: first starts, later requests wait in priority order", () => {
    const queue = new CutsceneQueue();
    assert.ok(queue.request({ def: mkDef("a") }));
    assert.strictEqual(queue.request({ def: mkDef("b", 1) }), undefined);
    assert.strictEqual(queue.request({ def: mkDef("c", 5) }), undefined);
    // Priority order on drain.
    assert.strictEqual(queue.onFinished()?.id, "c");
    assert.strictEqual(queue.onFinished()?.id, "b");
    assert.strictEqual(queue.onFinished(), undefined);
  });

  it("queue dedupes by id against active and pending scenes", () => {
    const queue = new CutsceneQueue();
    const def = mkDef("dup");
    assert.ok(queue.request({ def }));
    assert.strictEqual(queue.request({ def }), undefined);
    assert.strictEqual(queue.pending.length, 0, "duplicate id dropped");
    const other = mkDef("other");
    queue.request({ def: other });
    queue.request({ def: other });
    assert.strictEqual(queue.pending.length, 1);
  });

  it("hard-preempts the active scene only when priority is higher", () => {
    const queue = new CutsceneQueue();
    let preemptions = 0;
    const delegate = { preemptActive: () => (preemptions += 1) };
    queue.request({ def: mkDef("ambient", 0) }, delegate);
    queue.request({ def: mkDef("also-ambient", 0), preempt: true }, delegate);
    assert.strictEqual(preemptions, 0, "equal priority must not preempt");
    queue.request({ def: mkDef("boss", 10), preempt: true }, delegate);
    assert.strictEqual(preemptions, 1, "higher priority preempts");
  });
});

describe("cutscene puppet overrides", () => {
  const base: HarthmereLiveCreatureBridgeRecord[] = [
    {
      id: 42,
      at: [1, 2, 3],
      yaw: 0,
      family: "town_human",
      asset: "townsperson_market",
      scale: 1,
      label: "The Doc",
      hp: 20,
      maxHp: 20,
    },
    {
      id: 43,
      at: [9, 9, 9],
      yaw: 1,
      family: "mucker",
      asset: "townsperson_undead",
      scale: 1,
      label: "Mucker",
    },
  ] as never;

  it("replaces position/yaw for overridden real entities, passes others through", () => {
    const merged = mergeCutscenePuppetOverrides(base, [
      {
        id: 42,
        at: [5, 5, 5],
        yaw: 2,
        animation: "talkGesture",
        animationTime: 0.75,
        moving: true,
        motionTime: 2,
      },
    ]);
    assert.strictEqual(merged.length, 2);
    const doc = merged.find((r) => r.id === 42)!;
    assert.deepStrictEqual(doc.at, [5, 5, 5]);
    assert.strictEqual(doc.yaw, 2);
    assert.strictEqual(doc.label, "The Doc"); // everything else preserved
    assert.strictEqual(doc.hp, 20);
    assert.strictEqual(doc.animation, "talkGesture");
    assert.strictEqual(doc.animationTime, 0.75);
    assert.strictEqual(doc.moving, true);
    assert.strictEqual(doc.cinematic, true);
    const mucker = merged.find((r) => r.id === 43)!;
    assert.deepStrictEqual(mucker.at, [9, 9, 9]);
  });

  it("appends ghost records with negative ids and no hp (never targetable)", () => {
    const merged = mergeCutscenePuppetOverrides(base, [
      {
        id: -1000001,
        at: [0, 0, 0],
        yaw: 0,
        ghost: {
          asset: "townsperson_clergy",
          family: "town_human",
          label: "Spirit",
        },
      },
    ]);
    assert.strictEqual(merged.length, 3);
    const ghost = merged.find((r) => r.id === -1000001)!;
    assert.strictEqual(ghost.asset, "townsperson_clergy");
    assert.strictEqual(ghost.hp, undefined);
    assert.strictEqual(ghost.cinematic, true);
    assert.ok(isGhostPuppetId(ghost.id));
  });

  it("drops overrides for entities that are no longer rendered", () => {
    const merged = mergeCutscenePuppetOverrides(base, [
      { id: 999, at: [1, 1, 1], yaw: 0 }, // despawned entity, no ghost info
    ]);
    assert.strictEqual(merged.length, 2, "no invented records");
  });

  it("no overrides = identity copy", () => {
    const merged = mergeCutscenePuppetOverrides(base, []);
    assert.deepStrictEqual(merged, base);
    assert.notStrictEqual(merged, base);
  });
});
