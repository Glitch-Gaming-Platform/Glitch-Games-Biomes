import assert from "assert";
import {
  redactedGlitchApiPathForLogV1,
  shouldAcceptBehaviorTelemetryFailureV139,
  shouldFallbackBehaviorBulkStatusV138,
  shouldRunGlitchHarthmereOperationAsyncV1,
  shouldUseRedisHarthmereSessionStoreV1,
} from "../harthmere";

describe("glitch harthmere resource guards", () => {
  it("does not fan out auth failures from bulk telemetry", () => {
    assert.equal(shouldFallbackBehaviorBulkStatusV138(401), false);
    assert.equal(shouldFallbackBehaviorBulkStatusV138(403), false);
  });

  it("keeps compatibility fallback for unsupported/conflicting bulk telemetry", () => {
    assert.equal(shouldFallbackBehaviorBulkStatusV138(404), true);
    assert.equal(shouldFallbackBehaviorBulkStatusV138(409), true);
    assert.equal(shouldFallbackBehaviorBulkStatusV138(500), false);
  });

  it("accepts optional telemetry failures that would otherwise cause retries", () => {
    assert.equal(shouldAcceptBehaviorTelemetryFailureV139(408), true);
    assert.equal(shouldAcceptBehaviorTelemetryFailureV139(429), true);
    assert.equal(shouldAcceptBehaviorTelemetryFailureV139(500), true);
    assert.equal(shouldAcceptBehaviorTelemetryFailureV139(504), true);
    assert.equal(shouldAcceptBehaviorTelemetryFailureV139(401), false);
    assert.equal(shouldAcceptBehaviorTelemetryFailureV139(403), false);
    assert.equal(shouldAcceptBehaviorTelemetryFailureV139(404), false);
  });

  it("redacts install identifiers from Glitch API log paths", () => {
    const path =
      "/titles/42de534c-600f-4228-af9e-b69faef94cce/installs/install:abc-123/saves";
    assert.equal(
      redactedGlitchApiPathForLogV1(path),
      "/titles/:uuid/installs/install::id/saves"
    );
  });

  it("runs only slow non-critical Glitch operations asynchronously", () => {
    assert.equal(
      shouldRunGlitchHarthmereOperationAsyncV1("submitProgression"),
      true
    );
    assert.equal(
      shouldRunGlitchHarthmereOperationAsyncV1("heartbeatInstall"),
      true
    );
    assert.equal(shouldRunGlitchHarthmereOperationAsyncV1("storeSave"), false);
    assert.equal(
      shouldRunGlitchHarthmereOperationAsyncV1("recordEvents"),
      true
    );
    assert.equal(shouldRunGlitchHarthmereOperationAsyncV1("validate"), false);
    assert.equal(shouldRunGlitchHarthmereOperationAsyncV1("listSaves"), false);
    assert.equal(
      shouldRunGlitchHarthmereOperationAsyncV1("submitProgression", {
        GLITCH_HARTHMERE_ASYNC_API_OPS: "0",
      } as unknown as NodeJS.ProcessEnv),
      false
    );
  });

  it("enables Redis-backed Harthmere sessions in production-like Redis runtimes", () => {
    assert.equal(
      shouldUseRedisHarthmereSessionStoreV1({
        GLITCH_RUNTIME: "1",
      } as unknown as NodeJS.ProcessEnv),
      true
    );
    assert.equal(
      shouldUseRedisHarthmereSessionStoreV1({
        REDIS_HOST: "10.0.0.12",
      } as unknown as NodeJS.ProcessEnv),
      true
    );
    assert.equal(
      shouldUseRedisHarthmereSessionStoreV1({
        GLITCH_RUNTIME: "1",
        GLITCH_HARTHMERE_SESSION_STORE: "memory",
      } as unknown as NodeJS.ProcessEnv),
      false
    );
  });
});
