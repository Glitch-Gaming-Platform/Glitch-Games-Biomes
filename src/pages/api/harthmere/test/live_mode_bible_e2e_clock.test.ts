import assert from "assert";
import { harthmereLiveModeBibleE2ENowMsForTest } from "../live_mode";

describe("live_mode Bible E2E clock", () => {
  const nowMs = 1_785_313_000_000;

  it("pins a valid game hour only for token-authenticated loopback E2E", () => {
    const value = harthmereLiveModeBibleE2ENowMsForTest({
      requestedHour: 21,
      nowMs,
      nativeEcsE2EEnabled: true,
      configuredToken: "secret",
      suppliedToken: "secret",
      hostHeader: "127.0.0.1:3017",
    });
    assert.notEqual(value, undefined);
    assert.equal(
      (((value as number) % (20 * 60 * 1000)) / (20 * 60 * 1000)) * 24,
      21
    );
  });

  it("rejects disabled, remote, mistokened, and invalid-hour requests", () => {
    const base = {
      requestedHour: 21,
      nowMs,
      nativeEcsE2EEnabled: true,
      configuredToken: "secret",
      suppliedToken: "secret",
      hostHeader: "localhost:3017",
    };
    assert.equal(
      harthmereLiveModeBibleE2ENowMsForTest({
        ...base,
        nativeEcsE2EEnabled: false,
      }),
      undefined
    );
    assert.equal(
      harthmereLiveModeBibleE2ENowMsForTest({
        ...base,
        hostHeader: "game.example.com",
      }),
      undefined
    );
    assert.equal(
      harthmereLiveModeBibleE2ENowMsForTest({
        ...base,
        suppliedToken: "wrong",
      }),
      undefined
    );
    assert.equal(
      harthmereLiveModeBibleE2ENowMsForTest({
        ...base,
        requestedHour: 24,
      }),
      undefined
    );
  });
});
