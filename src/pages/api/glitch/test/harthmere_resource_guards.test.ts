import assert from "assert";
import {
  redactedGlitchApiPathForLogV1,
  shouldAcceptBehaviorTelemetryFailureV139,
  shouldFallbackBehaviorBulkStatusV138,
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
});
