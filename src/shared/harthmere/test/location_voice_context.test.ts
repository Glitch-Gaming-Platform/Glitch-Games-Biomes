import {
  harthmereLocationVoiceMetadataForPosition,
} from "@/shared/harthmere/location_voice_context";
import assert from "assert";

describe("Harthmere voice location metadata", () => {
  it("identifies the Grove jobs board from player position", () => {
    const location = harthmereLocationVoiceMetadataForPosition([
      486, 70, -209,
    ]);
    assert.equal(location?.id, "grove_job_board");
    assert.match(location?.story ?? "", /work|notices|contracts/i);
  });

  it("falls back to the wider Harthmere wilds outside named town zones", () => {
    const location = harthmereLocationVoiceMetadataForPosition([
      900, 54, -700,
    ]);
    assert.equal(location?.id, "harthmere_wilds");
  });
});
