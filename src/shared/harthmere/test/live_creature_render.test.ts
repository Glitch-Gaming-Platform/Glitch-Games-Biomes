/// <reference types="mocha" />
import {
  HARTHMERE_LIVE_CREATURE_RESPAWN_MAX_MS,
  HARTHMERE_LIVE_CREATURE_RESPAWN_MIN_MS,
  harthmereLiveCreatureRenderFamily,
  harthmereLiveCreatureRespawnAt,
  harthmereLiveCreatureRespawnDelayMs,
  harthmereLiveCreatureShouldRespawn,
} from "@/shared/harthmere/live_creature_render";
import assert from "assert";

describe("harthmereLiveCreatureRenderFamily", () => {
  it("maps structured seed kinds to families", () => {
    assert.equal(
      harthmereLiveCreatureRenderFamily({ kind: "robot_sentinel" }),
      "robot"
    );
    assert.equal(
      harthmereLiveCreatureRenderFamily({
        kind: "ambient_muck_monster",
        combatKind: "hex",
      }),
      "hex"
    );
    assert.equal(
      harthmereLiveCreatureRenderFamily({
        kind: "ambient_muck_monster",
        combatKind: "mux",
      }),
      "mucker"
    );
    assert.equal(
      harthmereLiveCreatureRenderFamily({
        kind: "ambient_livestock",
        species: "cow",
      }),
      "animal"
    );
    assert.equal(
      harthmereLiveCreatureRenderFamily({ kind: "ambient_muck_monster" }),
      "mucker"
    );
  });

  it("flags quest creatures distinctly", () => {
    assert.equal(
      harthmereLiveCreatureRenderFamily({
        kind: "ambient_muck_monster",
        isQuestCreature: true,
      }),
      "quest_creature"
    );
  });

  it("falls back to label text", () => {
    assert.equal(
      harthmereLiveCreatureRenderFamily({ label: "Old Wood Mucker 13" }),
      "mucker"
    );
    assert.equal(
      harthmereLiveCreatureRenderFamily({ label: "Gravewood Hexer 2" }),
      "hex"
    );
    assert.equal(
      harthmereLiveCreatureRenderFamily({ label: "Mucked Restoro Bot" }),
      "robot"
    );
    assert.equal(
      harthmereLiveCreatureRenderFamily({ label: "Wild Boar" }),
      "animal"
    );
    assert.equal(
      harthmereLiveCreatureRenderFamily({ label: "Something Else" }),
      "live_entity"
    );
  });
});

describe("harthmere live creature respawn timing", () => {
  it("uses the one-hour animal respawn delay", () => {
    assert.equal(
      harthmereLiveCreatureRespawnDelayMs(() => 0),
      HARTHMERE_LIVE_CREATURE_RESPAWN_MIN_MS
    );
    assert.equal(
      harthmereLiveCreatureRespawnDelayMs(() => 1),
      HARTHMERE_LIVE_CREATURE_RESPAWN_MAX_MS
    );
    assert.equal(
      harthmereLiveCreatureRespawnDelayMs(() => 0.5),
      60 * 60 * 1000
    );
  });

  it("clamps out-of-range rng", () => {
    assert.equal(
      harthmereLiveCreatureRespawnDelayMs(() => -5),
      HARTHMERE_LIVE_CREATURE_RESPAWN_MIN_MS
    );
    assert.equal(
      harthmereLiveCreatureRespawnDelayMs(() => 99),
      HARTHMERE_LIVE_CREATURE_RESPAWN_MAX_MS
    );
  });

  it("computes an absolute respawn time and eligibility", () => {
    const killedAtMs = 1_000_000;
    const respawnAtMs = harthmereLiveCreatureRespawnAt({
      killedAtMs,
      rng: () => 0,
    });
    assert.equal(
      respawnAtMs,
      killedAtMs + HARTHMERE_LIVE_CREATURE_RESPAWN_MIN_MS
    );
    assert.equal(
      harthmereLiveCreatureShouldRespawn({
        nowMs: respawnAtMs - 1,
        respawnAtMs,
      }),
      false
    );
    assert.equal(
      harthmereLiveCreatureShouldRespawn({ nowMs: respawnAtMs, respawnAtMs }),
      true
    );
  });
});
