import { shouldInstallHarthmereNativeEcsE2E } from "@/client/game/e2e/harthmere_native_ecs_e2e";
import assert from "assert";

describe("Harthmere native ECS browser E2E bridge", () => {
  it("is available only on an explicit local test URL", () => {
    for (const hostname of ["localhost", "127.0.0.1", "::1"]) {
      assert.equal(
        shouldInstallHarthmereNativeEcsE2E({
          hostname,
          search: "?harthmere_native_ecs_e2e=1",
        }),
        true
      );
    }
  });

  it("cannot be enabled by a production URL or an unrelated query", () => {
    assert.equal(
      shouldInstallHarthmereNativeEcsE2E({
        hostname: "www.glitch.fun",
        search: "?harthmere_native_ecs_e2e=1",
      }),
      false
    );
    assert.equal(
      shouldInstallHarthmereNativeEcsE2E({
        hostname: "localhost",
        search: "?e2e=1",
      }),
      false
    );
  });
});
