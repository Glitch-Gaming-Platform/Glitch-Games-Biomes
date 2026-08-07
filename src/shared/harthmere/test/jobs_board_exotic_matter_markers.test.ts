import assert from "assert";

import { harthmereJobsBoardQuestMarkerRuntimePositionForId } from "@/shared/harthmere/jobs_board_quest_marker_positions";

describe("Jobs Board Exotic Matter marker coordinates", () => {
  it("applies the additive offset once to town caves", () => {
    assert.deepEqual(
      harthmereJobsBoardQuestMarkerRuntimePositionForId(
        "exotic_antihydrogen_old_well_01"
      )?.position,
      [1996, 48, -240]
    );
  });

  it("keeps original-map Indisworm cavern deposits unshifted and underground", () => {
    assert.deepEqual(
      harthmereJobsBoardQuestMarkerRuntimePositionForId(
        "exotic_antihydrogen_deep_spindle_01"
      )?.position,
      [710, -34, -385]
    );
    assert.deepEqual(
      harthmereJobsBoardQuestMarkerRuntimePositionForId(
        "exotic_antihydrogen_harthmere_far_hollow_41"
      )?.position,
      [972, 13, -674]
    );
  });
});
