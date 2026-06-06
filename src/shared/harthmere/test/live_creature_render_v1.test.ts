/// <reference types="mocha" />
import {
  HARTHMERE_LIVE_CREATURE_RESPAWN_MAX_MS_V1,
  HARTHMERE_LIVE_CREATURE_RESPAWN_MIN_MS_V1,
  harthmereLiveCreatureRenderFamilyV1,
  harthmereLiveCreatureRespawnAtV1,
  harthmereLiveCreatureRespawnDelayMsV1,
  harthmereLiveCreatureShouldRespawnV1,
} from "@/shared/harthmere/live_creature_render_v1";
import assert from "assert";

describe("harthmereLiveCreatureRenderFamilyV1", () => {
  it("maps structured seed kinds to families", () => {
    assert.equal(
      harthmereLiveCreatureRenderFamilyV1({ kind: "robot_sentinel" }),
      "robot"
    );
    assert.equal(
      harthmereLiveCreatureRenderFamilyV1({
        kind: "ambient_muck_monster",
        combatKind: "hex",
      }),
      "hex"
    );
    assert.equal(
      harthmereLiveCreatureRenderFamilyV1({
        kind: "ambient_muck_monster",
        combatKind: "mux",
      }),
      "mucker"
    );
    assert.equal(
      harthmereLiveCreatureRenderFamilyV1({
        kind: "ambient_livestock",
        species: "cow",
      }),
      "animal"
    );
    assert.equal(
      harthmereLiveCreatureRenderFamilyV1({ kind: "ambient_muck_monster" }),
      "mucker"
    );
  });

  it("flags quest creatures distinctly", () => {
    assert.equal(
      harthmereLiveCreatureRenderFamilyV1({
        kind: "ambient_muck_monster",
        isQuestCreature: true,
      }),
      "quest_creature"
    );
  });

  it("falls back to label text", () => {
    assert.equal(
      harthmereLiveCreatureRenderFamilyV1({ label: "Old Wood Mucker 13" }),
      "mucker"
    );
    assert.equal(
      harthmereLiveCreatureRenderFamilyV1({ label: "Gravewood Hexer 2" }),
      "hex"
    );
    assert.equal(
      harthmereLiveCreatureRenderFamilyV1({ label: "Mucked Restoro Bot" }),
      "robot"
    );
    assert.equal(
      harthmereLiveCreatureRenderFamilyV1({ label: "Wild Boar" }),
      "animal"
    );
    assert.equal(
      harthmereLiveCreatureRenderFamilyV1({ label: "Something Else" }),
      "live_entity"
    );
  });
});

describe("harthmere live creature respawn timing", () => {
  it("delay stays within the 30-60 minute window", () => {
    assert.equal(
      harthmereLiveCreatureRespawnDelayMsV1(() => 0),
      HARTHMERE_LIVE_CREATURE_RESPAWN_MIN_MS_V1
    );
    assert.equal(
      harthmereLiveCreatureRespawnDelayMsV1(() => 1),
      HARTHMERE_LIVE_CREATURE_RESPAWN_MAX_MS_V1
    );
    const mid = harthmereLiveCreatureRespawnDelayMsV1(() => 0.5);
    assert.ok(
      mid > HARTHMERE_LIVE_CREATURE_RESPAWN_MIN_MS_V1 &&
        mid < HARTHMERE_LIVE_CREATURE_RESPAWN_MAX_MS_V1
    );
  });

  it("clamps out-of-range rng", () => {
    assert.equal(
      harthmereLiveCreatureRespawnDelayMsV1(() => -5),
      HARTHMERE_LIVE_CREATURE_RESPAWN_MIN_MS_V1
    );
    assert.equal(
      harthmereLiveCreatureRespawnDelayMsV1(() => 99),
      HARTHMERE_LIVE_CREATURE_RESPAWN_MAX_MS_V1
    );
  });

  it("computes an absolute respawn time and eligibility", () => {
    const killedAtMs = 1_000_000;
    const respawnAtMs = harthmereLiveCreatureRespawnAtV1({
      killedAtMs,
      rng: () => 0,
    });
    assert.equal(
      respawnAtMs,
      killedAtMs + HARTHMERE_LIVE_CREATURE_RESPAWN_MIN_MS_V1
    );
    assert.equal(
      harthmereLiveCreatureShouldRespawnV1({
        nowMs: respawnAtMs - 1,
        respawnAtMs,
      }),
      false
    );
    assert.equal(
      harthmereLiveCreatureShouldRespawnV1({ nowMs: respawnAtMs, respawnAtMs }),
      true
    );
  });
});
