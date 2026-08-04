/// <reference types="mocha" />

import { harthmereHudStandingForTest } from "@/client/components/challenges/HarthmereUnifiedHUD";
import assert from "assert";
import { readFileSync } from "fs";
import path from "path";

describe("Harthmere HUD native standing", () => {
  const legacyStanding = {
    likeability: 12,
    legal: -4,
    notoriety: 3,
    notorietyFloor: 1,
  };
  const nativeStanding = {
    likeability: 240,
    legal: -180,
    notoriety: 95,
    notorietyFloor: 40,
  };

  it("uses TriggerState standing after native vitals migration", () => {
    assert.deepEqual(
      harthmereHudStandingForTest(legacyStanding, nativeStanding, true),
      nativeStanding
    );
  });

  it("keeps the legacy standing fallback before native migration", () => {
    assert.equal(
      harthmereHudStandingForTest(legacyStanding, nativeStanding, false),
      legacyStanding
    );
  });

  it("uses the authenticated native-vitals projection while TriggerState is late", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/client/components/challenges/HarthmereUnifiedHUD.tsx"
      ),
      "utf8"
    );
    assert.ok(source.includes("useHarthmereNativeVitalsProjection"));
    assert.ok(
      source.includes(
        "const nativeVitals = nativeProjection.vitals"
      )
    );
    assert.ok(source.includes("nativeProjection.hasAuthoritativeVitals"));
    assert.equal(
      source.includes(
        "nativeBiomesEcsAuthorityEnabled() && nativeTriggerState !== undefined"
      ),
      false
    );
  });
});
