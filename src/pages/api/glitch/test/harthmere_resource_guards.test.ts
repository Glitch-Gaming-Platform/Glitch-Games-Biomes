import assert from "assert";
import {
  redactedGlitchApiPathForLog,
  shouldAcceptBehaviorTelemetryFailure,
  shouldFallbackBehaviorBulkStatus,
  shouldRunGlitchHarthmereOperationAsync,
  shouldUseRedisHarthmereSessionStore,
} from "../harthmere";

describe("glitch harthmere resource guards", () => {
  it("does not fan out auth failures from bulk telemetry", () => {
    assert.equal(shouldFallbackBehaviorBulkStatus(401), false);
    assert.equal(shouldFallbackBehaviorBulkStatus(403), false);
  });

  it("keeps compatibility fallback for unsupported/conflicting bulk telemetry", () => {
    assert.equal(shouldFallbackBehaviorBulkStatus(404), true);
    assert.equal(shouldFallbackBehaviorBulkStatus(409), true);
    assert.equal(shouldFallbackBehaviorBulkStatus(500), false);
  });

  it("accepts optional telemetry failures that would otherwise cause retries", () => {
    assert.equal(shouldAcceptBehaviorTelemetryFailure(408), true);
    assert.equal(shouldAcceptBehaviorTelemetryFailure(429), true);
    assert.equal(shouldAcceptBehaviorTelemetryFailure(500), true);
    assert.equal(shouldAcceptBehaviorTelemetryFailure(504), true);
    assert.equal(shouldAcceptBehaviorTelemetryFailure(401), false);
    assert.equal(shouldAcceptBehaviorTelemetryFailure(403), false);
    assert.equal(shouldAcceptBehaviorTelemetryFailure(404), false);
  });

  it("redacts install identifiers from Glitch API log paths", () => {
    const path =
      "/titles/42de534c-600f-4228-af9e-b69faef94cce/installs/install:abc-123/saves";
    assert.equal(
      redactedGlitchApiPathForLog(path),
      "/titles/:uuid/installs/install::id/saves"
    );
  });

  it("runs only slow non-critical Glitch operations asynchronously", () => {
    assert.equal(
      shouldRunGlitchHarthmereOperationAsync("submitProgression"),
      true
    );
    assert.equal(
      shouldRunGlitchHarthmereOperationAsync("heartbeatInstall"),
      true
    );
    assert.equal(shouldRunGlitchHarthmereOperationAsync("storeSave"), false);
    assert.equal(
      shouldRunGlitchHarthmereOperationAsync("recordEvents"),
      true
    );
    assert.equal(shouldRunGlitchHarthmereOperationAsync("validate"), false);
    assert.equal(shouldRunGlitchHarthmereOperationAsync("listSaves"), false);
    assert.equal(
      shouldRunGlitchHarthmereOperationAsync("submitProgression", {
        GLITCH_HARTHMERE_ASYNC_API_OPS: "0",
      } as unknown as NodeJS.ProcessEnv),
      false
    );
  });

  it("enables Redis-backed Harthmere sessions in production-like Redis runtimes", () => {
    assert.equal(
      shouldUseRedisHarthmereSessionStore({
        GLITCH_RUNTIME: "1",
      } as unknown as NodeJS.ProcessEnv),
      true
    );
    assert.equal(
      shouldUseRedisHarthmereSessionStore({
        REDIS_HOST: "10.0.0.12",
      } as unknown as NodeJS.ProcessEnv),
      true
    );
    assert.equal(
      shouldUseRedisHarthmereSessionStore({
        GLITCH_RUNTIME: "1",
        GLITCH_HARTHMERE_SESSION_STORE: "memory",
      } as unknown as NodeJS.ProcessEnv),
      false
    );
  });
});
