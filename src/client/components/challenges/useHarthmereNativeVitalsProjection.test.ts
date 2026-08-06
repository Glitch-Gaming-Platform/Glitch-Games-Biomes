/// <reference types="mocha" />

import {
  normalizeHarthmereNativeVitalsHeartbeatForTest,
  resolveHarthmereNativeVitalsProjectionForTest,
} from "@/client/components/challenges/useHarthmereNativeVitalsProjection";
import { readHarthmereNativeVitals } from "@/shared/harthmere/harthmere_native_vitals";
import assert from "assert";

describe("Harthmere native vitals client projection", () => {
  it("uses the authenticated heartbeat when ECS components have not synchronized", () => {
    const heartbeat = normalizeHarthmereNativeVitalsHeartbeatForTest(
      {
        ok: true,
        mana: 160,
        maxMana: 160,
        stamina: 80.75,
        maxStamina: 140,
        breath: 45,
        maxBreath: 45,
        hp: 240,
        maxHp: 240,
      },
      1234
    );
    assert.ok(heartbeat);
    const projection = resolveHarthmereNativeVitalsProjectionForTest({
      heartbeat,
    });
    assert.equal(projection.source, "heartbeat");
    assert.equal(projection.hasAuthoritativeVitals, true);
    assert.equal(projection.hasAuthoritativeHealth, true);
    assert.equal(projection.vitals.stamina, 80.75);
    assert.equal(projection.vitals.maxStamina, 140);
    assert.deepEqual(projection.health, { hp: 240, maxHp: 240 });
  });

  it("keeps synchronized ECS fields ahead of the heartbeat", () => {
    const ecsVitals = {
      ...readHarthmereNativeVitals(undefined),
      stamina: 70,
      maxStamina: 150,
    };
    const heartbeat = normalizeHarthmereNativeVitalsHeartbeatForTest({
      ok: true,
      mana: 100,
      maxMana: 100,
      stamina: 80,
      maxStamina: 140,
      breath: 45,
      maxBreath: 45,
      hp: 200,
      maxHp: 240,
    });
    const projection = resolveHarthmereNativeVitalsProjectionForTest({
      ecsVitals,
      ecsHealth: { hp: 180, maxHp: 240 },
      heartbeat,
    });
    assert.equal(projection.source, "ecs");
    assert.equal(projection.vitals.stamina, 70);
    assert.deepEqual(projection.health, { hp: 180, maxHp: 240 });
  });

  it("uses a newer REST/optimistic receipt while ECS sync is stalled", () => {
    const ecsVitals = {
      ...readHarthmereNativeVitals(undefined),
      stamina: 14,
      maxStamina: 20,
    };
    const heartbeat = normalizeHarthmereNativeVitalsHeartbeatForTest(
      {
        ok: true,
        mana: 100,
        maxMana: 100,
        stamina: 11,
        maxStamina: 20,
        breath: 45,
        maxBreath: 45,
        hp: 100,
        maxHp: 100,
      },
      2_000
    );
    const projection = resolveHarthmereNativeVitalsProjectionForTest({
      ecsVitals,
      ecsHealth: { hp: 100, maxHp: 100 },
      ecsReceivedAtMs: 1_000,
      heartbeat,
    });
    assert.equal(projection.vitals.stamina, 11);
  });

  it("rejects malformed or unsuccessful heartbeat payloads", () => {
    assert.equal(
      normalizeHarthmereNativeVitalsHeartbeatForTest({ ok: false }),
      undefined
    );
    assert.equal(
      normalizeHarthmereNativeVitalsHeartbeatForTest({
        ok: true,
        mana: 100,
      }),
      undefined
    );
  });
});
