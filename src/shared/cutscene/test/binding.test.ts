import type {
  CutsceneEntityView,
  CutsceneWorldIndex,
} from "@/shared/cutscene/binding";
import { resolveCast } from "@/shared/cutscene/binding";
import { validateCutsceneDef } from "@/shared/cutscene/schema";
import type { CutsceneDef } from "@/shared/cutscene/schema";
import assert from "assert";

function makeWorld(entities: CutsceneEntityView[]): CutsceneWorldIndex {
  return {
    playerId: 7,
    playerPosition: [0, 0, 0],
    playerHeight: 1.8,
    entity: (id) => entities.find((e) => e.id === id),
    npcsNear: (position, radius) =>
      entities.filter((e) => {
        if (!e.position) return false;
        const d = Math.hypot(
          e.position[0] - position[0],
          e.position[1] - position[1],
          e.position[2] - position[2]
        );
        return d <= radius;
      }),
  };
}

function def(cast: unknown[]): CutsceneDef {
  const result = validateCutsceneDef({
    id: "bind-test",
    name: "Bind Test",
    cast,
    shots: [
      { id: "s", duration: 1, camera: { kind: "static", position: [0, 5, 0] } },
    ],
  });
  assert.ok(result.ok, JSON.stringify(!result.ok && result.issues));
  return result.def;
}

describe("cutscene cast binding", () => {
  it("binds the player role", () => {
    const res = resolveCast(
      def([{ role: "hero", binding: { kind: "player" } }]),
      makeWorld([])
    );
    assert.ok(res.ok);
    const actor = res.actors.get("hero");
    assert.ok(actor?.kind === "player" && actor.entityId === 7);
  });

  it("binds an exact entity id when alive", () => {
    const res = resolveCast(
      def([{ role: "elder", binding: { kind: "entity", entityId: 42 } }]),
      makeWorld([{ id: 42, position: [1, 0, 1], alive: true, height: 2.1 }])
    );
    assert.ok(res.ok);
    const actor = res.actors.get("elder");
    assert.ok(actor?.kind === "entity" && actor.entityId === 42);
    assert.strictEqual((actor as { height: number }).height, 2.1);
  });

  it("cancels the scene when a required entity is dead", () => {
    const res = resolveCast(
      def([{ role: "elder", binding: { kind: "entity", entityId: 42 } }]),
      makeWorld([{ id: 42, position: [1, 0, 1], alive: false }])
    );
    assert.ok(!res.ok);
    assert.ok(res.cancelReason?.includes("elder"));
  });

  it("marks optional unresolved roles as unbound instead of cancelling", () => {
    const res = resolveCast(
      def([
        {
          role: "extra",
          binding: { kind: "entity", entityId: 99 },
          required: false,
        },
      ]),
      makeWorld([])
    );
    assert.ok(res.ok);
    assert.strictEqual(res.actors.get("extra")?.kind, "unbound");
  });

  it("falls back to a ghost stand-in when configured", () => {
    const res = resolveCast(
      def([
        {
          role: "elder",
          binding: { kind: "entity", entityId: 42 },
          fallback: "ghost",
          ghostAsset: "townsperson_clergy",
        },
      ]),
      makeWorld([])
    );
    assert.ok(res.ok);
    const actor = res.actors.get("elder");
    assert.ok(actor?.kind === "ghost");
    assert.strictEqual(actor.asset, "townsperson_clergy");
    assert.ok(actor.ghostId < 0, "ghost ids must be negative");
  });

  it("nearestNpc picks the closest matching candidate by label and type", () => {
    const world = makeWorld([
      { id: 1, label: "Town Guard", position: [10, 0, 0], npcTypeId: 5 },
      { id: 2, label: "Town Guard", position: [3, 0, 0], npcTypeId: 5 },
      { id: 3, label: "Merchant", position: [1, 0, 0], npcTypeId: 6 },
      {
        id: 4,
        label: "Town Guard",
        position: [2, 0, 0],
        npcTypeId: 5,
        alive: false,
      },
    ]);
    const res = resolveCast(
      def([
        {
          role: "guard",
          binding: { kind: "nearestNpc", labelMatch: "guard", within: 64 },
        },
      ]),
      world
    );
    assert.ok(res.ok);
    const actor = res.actors.get("guard");
    assert.ok(actor?.kind === "entity" && actor.entityId === 2);

    const byType = resolveCast(
      def([
        {
          role: "merchant",
          binding: { kind: "nearestNpc", npcTypeId: 6, within: 64 },
        },
      ]),
      world
    );
    assert.ok(byType.ok);
    const merchant = byType.actors.get("merchant");
    assert.ok(merchant?.kind === "entity" && merchant.entityId === 3);
  });

  it("nearestNpc respects the search radius", () => {
    const res = resolveCast(
      def([
        {
          role: "guard",
          binding: { kind: "nearestNpc", labelMatch: "guard", within: 5 },
        },
      ]),
      makeWorld([{ id: 1, label: "Town Guard", position: [50, 0, 0] }])
    );
    assert.ok(!res.ok); // required by default -> cancel
  });

  it("explicit ghost bindings always resolve with unique negative ids", () => {
    const res = resolveCast(
      def([
        {
          role: "spirit1",
          binding: {
            kind: "ghost",
            asset: "townsperson_clergy",
            spawnAt: [1, 2, 3],
          },
        },
        {
          role: "spirit2",
          binding: { kind: "ghost", asset: "townsperson_market" },
        },
      ]),
      makeWorld([])
    );
    assert.ok(res.ok);
    const a = res.actors.get("spirit1");
    const b = res.actors.get("spirit2");
    assert.ok(a?.kind === "ghost" && b?.kind === "ghost");
    assert.notStrictEqual(a.ghostId, b.ghostId);
    assert.deepStrictEqual(a.spawnAt, [1, 2, 3]);
    // No spawnAt -> spawns near the player.
    assert.deepStrictEqual(b.spawnAt, [0, 0, 0]);
  });

  it("resolves world anchors without requiring an ECS entity", () => {
    const res = resolveCast(
      def([
        {
          role: "gate",
          binding: {
            kind: "anchor",
            position: [12, 4, 9],
            height: 6,
            label: "North Gate",
          },
        },
      ]),
      makeWorld([])
    );
    assert.ok(res.ok);
    const actor = res.actors.get("gate");
    assert.ok(actor?.kind === "anchor");
    assert.deepStrictEqual(actor.position, [12, 4, 9]);
  });

  it("never binds two roles to the same live actor", () => {
    const res = resolveCast(
      def([
        { role: "a", binding: { kind: "nearestNpc", labelMatch: "guard" } },
        { role: "b", binding: { kind: "nearestNpc", labelMatch: "guard" } },
      ]),
      makeWorld([{ id: 42, label: "Guard", position: [1, 0, 1], isNpc: true }])
    );
    assert.ok(!res.ok);
    assert.ok(res.cancelReason?.includes("b"));
  });

  it("allocates distinct nearest NPCs when several candidates match", () => {
    const res = resolveCast(
      def([
        {
          role: "guardA",
          binding: { kind: "nearestNpc", labelMatch: "guard" },
        },
        {
          role: "guardB",
          binding: { kind: "nearestNpc", labelMatch: "guard" },
        },
      ]),
      makeWorld([
        { id: 41, label: "Guard", position: [1, 0, 0], isNpc: true },
        { id: 42, label: "Guard", position: [2, 0, 0], isNpc: true },
      ])
    );
    assert.ok(res.ok);
    const first = res.actors.get("guardA");
    const second = res.actors.get("guardB");
    assert.ok(first?.kind === "entity" && first.entityId === 41);
    assert.ok(second?.kind === "entity" && second.entityId === 42);
  });

  it("allows non-NPC entities as camera targets but rejects puppet actions", () => {
    const world = makeWorld([
      { id: 42, label: "Ancient Door", position: [1, 0, 1], isNpc: false },
    ]);
    assert.ok(
      resolveCast(
        def([{ role: "door", binding: { kind: "entity", entityId: 42 } }]),
        world
      ).ok
    );
    const parsed = validateCutsceneDef({
      id: "move-door",
      name: "Move Door",
      cast: [{ role: "door", binding: { kind: "entity", entityId: 42 } }],
      shots: [
        {
          id: "s",
          duration: 1,
          camera: { kind: "trackRole", role: "door" },
          actions: [{ kind: "teleport", role: "door", to: [2, 0, 2] }],
        },
      ],
    });
    assert.ok(parsed.ok);
    assert.ok(!resolveCast(parsed.def, world).ok);
  });
});
