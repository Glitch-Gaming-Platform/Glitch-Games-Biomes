/// <reference types="mocha" />
import {
  harthmereIncomingExternalAttack,
  harthmerePvpBasicDamage,
  harthmerePvpPlayersInArc,
} from "@/client/components/challenges/harthmerePvpHitRules";
import type { BiomesId } from "@/shared/ids";
import assert from "assert";

const A = 1001 as BiomesId;
const B = 1002 as BiomesId;
const LOCAL = 9000 as BiomesId;

describe("harthmere PvP swing arc", () => {
  it("hits a player directly in front within range", () => {
    const hits = harthmerePvpPlayersInArc({
      origin: [0, 0],
      forward: [0, -1],
      players: [{ id: A, pos: [0, -2] }],
      range: 3,
      cosHalfAngle: Math.cos((135 * Math.PI) / 360),
    });
    assert.deepEqual(hits, [A]);
  });

  it("misses a player out of range", () => {
    const hits = harthmerePvpPlayersInArc({
      origin: [0, 0],
      forward: [0, -1],
      players: [{ id: A, pos: [0, -10] }],
      range: 3,
      cosHalfAngle: Math.cos((135 * Math.PI) / 360),
    });
    assert.deepEqual(hits, []);
  });

  it("misses a player behind the attacker (outside the arc, beyond contact)", () => {
    const hits = harthmerePvpPlayersInArc({
      origin: [0, 0],
      forward: [0, -1],
      players: [{ id: A, pos: [0, 2.8] }],
      range: 3,
      cosHalfAngle: Math.cos((135 * Math.PI) / 360),
    });
    assert.deepEqual(hits, []);
  });

  it("hits multiple players in the arc (area swing)", () => {
    const hits = harthmerePvpPlayersInArc({
      origin: [0, 0],
      forward: [0, -1],
      players: [
        { id: A, pos: [0.5, -1.5] },
        { id: B, pos: [-0.5, -1.2] },
      ],
      range: 3,
      cosHalfAngle: Math.cos((135 * Math.PI) / 360),
    });
    assert.deepEqual(hits.sort(), [A, B].sort());
  });
});

describe("harthmere PvP damage", () => {
  it("scales with attack, with a floor and ceiling", () => {
    assert.equal(harthmerePvpBasicDamage(0), 10);
    assert.ok(harthmerePvpBasicDamage(100) > 10);
    assert.equal(harthmerePvpBasicDamage(100000), 120);
  });

  it("treats invalid attack stats as the floor", () => {
    assert.equal(harthmerePvpBasicDamage(NaN), 10);
    assert.equal(harthmerePvpBasicDamage(-50), 10);
  });
});

describe("harthmere incoming PvP damage (victim side)", () => {
  const base = {
    localPlayerId: LOCAL,
    damageSourceKind: "attack",
    attacker: A,
    lastDamageAmount: 25,
    lastDamageTime: 500,
    alreadyProcessedTime: undefined as number | undefined,
  };

  it("reflects a fresh external attack from another player", () => {
    assert.deepEqual(harthmereIncomingExternalAttack(base), {
      damage: 25,
      attacker: A,
    });
  });

  it("ignores non-attack damage sources (fall/drown/etc.)", () => {
    assert.equal(
      harthmereIncomingExternalAttack({ ...base, damageSourceKind: "fall" }),
      undefined
    );
  });

  it("ignores self-inflicted damage", () => {
    assert.equal(
      harthmereIncomingExternalAttack({ ...base, attacker: LOCAL }),
      undefined
    );
  });

  it("de-dupes an already-processed damage timestamp", () => {
    assert.equal(
      harthmereIncomingExternalAttack({ ...base, alreadyProcessedTime: 500 }),
      undefined
    );
  });

  it("processes a newer hit after a prior one", () => {
    assert.deepEqual(
      harthmereIncomingExternalAttack({
        ...base,
        lastDamageTime: 800,
        alreadyProcessedTime: 500,
      }),
      { damage: 25, attacker: A }
    );
  });

  it("ignores zero/negative damage amounts", () => {
    assert.equal(
      harthmereIncomingExternalAttack({ ...base, lastDamageAmount: 0 }),
      undefined
    );
  });
});
