import {
  dialogueDurationSeconds,
  validateCutsceneDef,
} from "@/shared/cutscene/schema";
import assert from "assert";

function baseDef(overrides: Record<string, unknown> = {}) {
  return {
    id: "test-scene",
    name: "Test Scene",
    cast: [
      { role: "player", binding: { kind: "player" } },
      { role: "npc", binding: { kind: "entity", entityId: 42 } },
    ],
    shots: [
      {
        id: "shot-1",
        duration: 3,
        camera: { kind: "overShoulder", from: "player", to: "npc" },
        actions: [
          { kind: "dialogue", at: 0.5, role: "npc", text: "Hello there." },
        ],
      },
    ],
    ...overrides,
  };
}

describe("cutscene schema", () => {
  it("accepts a minimal valid definition and applies defaults", () => {
    const result = validateCutsceneDef(baseDef());
    assert.ok(result.ok);
    assert.strictEqual(result.def.version, 1);
    assert.strictEqual(result.def.settings.skippable, true);
    assert.strictEqual(result.def.settings.lockPlayer, true);
    assert.strictEqual(result.def.settings.mode, "clientPuppet");
    assert.strictEqual(result.def.settings.skipAfterSeconds, 3);
    assert.strictEqual(result.def.shots[0].transitionIn, "cut");
    assert.deepStrictEqual(result.def.onEnd.placements, []);
  });

  it("rejects unknown roles referenced by cameras", () => {
    const result = validateCutsceneDef(
      baseDef({
        shots: [
          {
            id: "s",
            duration: 2,
            camera: { kind: "orbit", role: "ghost-of-nobody", radius: 5 },
          },
        ],
      })
    );
    assert.ok(!result.ok);
    assert.ok(result.issues.some((i) => i.message.includes("unknown role")));
  });

  it("rejects unknown roles referenced by actions (incl. target refs)", () => {
    const result = validateCutsceneDef(
      baseDef({
        shots: [
          {
            id: "s",
            duration: 2,
            camera: { kind: "static", position: [0, 5, 0] },
            actions: [
              { kind: "moveTo", role: "npc", to: { role: "nobody" } },
              { kind: "emote", role: "nobody", emote: "wave" },
            ],
          },
        ],
      })
    );
    assert.ok(!result.ok);
    assert.strictEqual(
      result.issues.filter((i) => i.message.includes("unknown role")).length,
      2
    );
  });

  it("rejects duplicate shot ids and duplicate roles", () => {
    const dupShots = validateCutsceneDef(
      baseDef({
        shots: [
          {
            id: "s",
            duration: 1,
            camera: { kind: "static", position: [0, 0, 0] },
          },
          {
            id: "s",
            duration: 1,
            camera: { kind: "static", position: [0, 0, 0] },
          },
        ],
      })
    );
    assert.ok(!dupShots.ok);
    const dupRoles = validateCutsceneDef(
      baseDef({
        cast: [
          { role: "npc", binding: { kind: "player" } },
          { role: "npc", binding: { kind: "entity", entityId: 1 } },
        ],
      })
    );
    assert.ok(!dupRoles.ok);
  });

  it("rejects more than one player binding", () => {
    const result = validateCutsceneDef(
      baseDef({
        cast: [
          { role: "a", binding: { kind: "player" } },
          { role: "b", binding: { kind: "player" } },
        ],
        shots: [
          {
            id: "s",
            duration: 1,
            camera: { kind: "static", position: [0, 0, 0] },
          },
        ],
      })
    );
    assert.ok(!result.ok);
    assert.ok(result.issues.some((i) => i.message.includes("at most one")));
  });

  it("rejects actions scheduled past the shot budget", () => {
    const result = validateCutsceneDef(
      baseDef({
        shots: [
          {
            id: "s",
            duration: 2,
            camera: { kind: "static", position: [0, 0, 0] },
            actions: [{ kind: "sfx", at: 5, name: "boom" }],
          },
        ],
      })
    );
    assert.ok(!result.ok);
    assert.ok(result.issues.some((i) => i.message.includes("budget")));
  });

  it("allows late actions inside an until.maxDuration budget", () => {
    const result = validateCutsceneDef(
      baseDef({
        shots: [
          {
            id: "s",
            duration: 2,
            until: { kind: "dialogueDone", maxDuration: 8 },
            camera: { kind: "static", position: [0, 0, 0] },
            actions: [{ kind: "sfx", at: 5, name: "boom" }],
          },
        ],
      })
    );
    assert.ok(result.ok);
  });

  it("rejects until.maxDuration below shot.duration", () => {
    const result = validateCutsceneDef(
      baseDef({
        shots: [
          {
            id: "s",
            duration: 5,
            until: { kind: "dialogueDone", maxDuration: 2 },
            camera: { kind: "static", position: [0, 0, 0] },
          },
        ],
      })
    );
    assert.ok(!result.ok);
  });

  it("rejects invalid emote names but accepts player emotes and NPC runtime clips", () => {
    const bad = validateCutsceneDef(
      baseDef({
        shots: [
          {
            id: "s",
            duration: 2,
            camera: { kind: "static", position: [0, 0, 0] },
            actions: [{ kind: "emote", role: "npc", emote: "breakdance9000" }],
          },
        ],
      })
    );
    assert.ok(!bad.ok);
    for (const emote of [
      "wave",
      "attack1",
      "talkGesture",
      "workLoop",
      "smithWork",
      "cookWork",
      "dockWork",
      "healerWork",
      "guardPatrolIdle",
      "hitReact",
      "death",
    ]) {
      const good = validateCutsceneDef(
        baseDef({
          shots: [
            {
              id: "s",
              duration: 2,
              camera: { kind: "static", position: [0, 0, 0] },
              actions: [{ kind: "emote", role: "npc", at: 0, emote }],
            },
          ],
        })
      );
      assert.ok(good.ok, `emote ${emote} should validate`);
    }
  });

  it("rejects ghost fallback without a ghostAsset", () => {
    const result = validateCutsceneDef(
      baseDef({
        cast: [
          {
            role: "npc",
            binding: { kind: "entity", entityId: 1 },
            fallback: "ghost",
          },
        ],
        shots: [
          {
            id: "s",
            duration: 1,
            camera: { kind: "static", position: [0, 0, 0] },
          },
        ],
      })
    );
    assert.ok(!result.ok);
    assert.ok(result.issues.some((i) => i.message.includes("ghostAsset")));
  });

  it("rejects onEnd placements for unknown roles", () => {
    const result = validateCutsceneDef(
      baseDef({ onEnd: { placements: [{ role: "mystery" }] } })
    );
    assert.ok(!result.ok);
  });

  it("rejects dolly cameras with fewer than two waypoints", () => {
    const result = validateCutsceneDef(
      baseDef({
        shots: [
          {
            id: "s",
            duration: 2,
            camera: { kind: "dolly", waypoints: [{ position: [0, 0, 0] }] },
          },
        ],
      })
    );
    assert.ok(!result.ok);
  });

  it("rejects non-finite coordinates and effectively unbounded durations", () => {
    const coordinate = validateCutsceneDef(
      baseDef({
        shots: [
          {
            id: "s",
            duration: 1,
            camera: { kind: "static", position: [Infinity, 0, 0] },
          },
        ],
      })
    );
    assert.ok(!coordinate.ok);
    const duration = validateCutsceneDef(
      baseDef({
        shots: [
          {
            id: "s",
            duration: Infinity,
            camera: { kind: "static", position: [0, 0, 0] },
          },
        ],
      })
    );
    assert.ok(!duration.ok);
  });

  it("validates regular expressions before cast binding", () => {
    const result = validateCutsceneDef(
      baseDef({
        cast: [
          {
            role: "npc",
            binding: { kind: "nearestNpc", labelMatch: "[broken" },
          },
        ],
      })
    );
    assert.ok(!result.ok);
    assert.ok(result.issues.some((issue) => issue.path.includes("labelMatch")));
  });

  it("supports static world anchors but rejects puppeteering them", () => {
    const cameraOnly = validateCutsceneDef(
      baseDef({
        cast: [
          {
            role: "tower",
            binding: { kind: "anchor", position: [10, 20, 30] },
          },
        ],
        shots: [
          {
            id: "s",
            duration: 1,
            camera: {
              kind: "static",
              position: [0, 20, 0],
              lookAtRole: "tower",
            },
          },
        ],
      })
    );
    assert.ok(cameraOnly.ok);
    const moving = validateCutsceneDef(
      baseDef({
        cast: [
          {
            role: "tower",
            binding: { kind: "anchor", position: [10, 20, 30] },
          },
        ],
        shots: [
          {
            id: "s",
            duration: 1,
            camera: { kind: "trackRole", role: "tower" },
            actions: [{ kind: "teleport", role: "tower", to: [0, 0, 0] }],
          },
        ],
      })
    );
    assert.ok(!moving.ok);
    const equipped = validateCutsceneDef(
      baseDef({
        cast: [
          {
            role: "tower",
            binding: { kind: "anchor", position: [10, 20, 30] },
          },
        ],
        shots: [
          {
            id: "s",
            duration: 1,
            camera: { kind: "trackRole", role: "tower" },
            actions: [
              { kind: "holdItem", role: "tower", itemId: 4537020877770159 },
            ],
          },
        ],
      })
    );
    assert.ok(!equipped.ok);
  });

  it("accepts native held-item actions and explicit unequip", () => {
    const result = validateCutsceneDef(
      baseDef({
        shots: [
          {
            id: "s",
            duration: 2,
            camera: { kind: "trackRole", role: "npc" },
            actions: [
              {
                kind: "holdItem",
                at: 0,
                role: "npc",
                itemId: 4537020877770159,
              },
              { kind: "holdItem", at: 1, role: "npc", itemId: null },
            ],
          },
        ],
      })
    );
    assert.ok(result.ok);
  });

  it("requires actorArrived to have a matching moveTo and capture ids to be unique", () => {
    const noMove = validateCutsceneDef(
      baseDef({
        shots: [
          {
            id: "s",
            duration: 1,
            until: { kind: "actorArrived", role: "npc", maxDuration: 2 },
            camera: { kind: "trackRole", role: "npc" },
          },
        ],
      })
    );
    assert.ok(!noMove.ok);
    const duplicateCapture = validateCutsceneDef(
      baseDef({
        shots: [
          {
            id: "s",
            duration: 1,
            camera: { kind: "static", position: [0, 0, 0] },
            actions: [
              { kind: "capture", captureId: "hero", at: 0.2 },
              { kind: "capture", captureId: "hero", at: 0.4 },
            ],
          },
        ],
      })
    );
    assert.ok(!duplicateCapture.ok);
  });

  it("requires VFX to target a position or a known role", () => {
    const missingTarget = validateCutsceneDef(
      baseDef({
        shots: [
          {
            id: "s",
            duration: 1,
            camera: { kind: "static", position: [0, 0, 0] },
            actions: [{ kind: "vfx", effect: "exoticMatterCreation", at: 0.1 }],
          },
        ],
      })
    );
    assert.ok(!missingTarget.ok);

    const targeted = validateCutsceneDef(
      baseDef({
        shots: [
          {
            id: "s",
            duration: 1,
            camera: { kind: "static", position: [0, 0, 0] },
            actions: [
              {
                kind: "vfx",
                effect: "exoticMatterCreation",
                atRole: "npc",
              },
            ],
          },
        ],
      })
    );
    assert.ok(targeted.ok);

    const combatImpact = validateCutsceneDef(
      baseDef({
        shots: [
          {
            id: "s",
            duration: 1,
            camera: { kind: "static", position: [0, 0, 0] },
            actions: [{ kind: "vfx", effect: "combatImpact", atRole: "npc" }],
          },
        ],
      })
    );
    assert.ok(combatImpact.ok);
  });

  it("computes reading-speed subtitle durations, clamped", () => {
    assert.strictEqual(dialogueDurationSeconds({ text: "x", duration: 4 }), 4);
    assert.strictEqual(dialogueDurationSeconds({ text: "Hi." }), 1.5);
    const long = dialogueDurationSeconds({
      text: Array(100).fill("word").join(" "),
    });
    assert.strictEqual(long, 8);
    const mid = dialogueDurationSeconds({
      text: "This is a ten word sentence for the duration test.",
    });
    assert.ok(mid > 1.5 && mid < 8);
  });
});
