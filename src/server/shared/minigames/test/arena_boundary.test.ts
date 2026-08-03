import { arenaBoundaryFromMarkerPoints } from "@/server/shared/minigames/util";
import assert from "assert";

describe("Spleef arena boundaries", () => {
  it("contains associated placeables that extend past marker centers", () => {
    assert.deepEqual(
      arenaBoundaryFromMarkerPoints(
        [
          [281, 121, 240],
          [291, 126, 250],
        ],
        [
          [
            [280.5, 122, 239.5],
            [281.5, 122, 240.5],
          ],
        ]
      ),
      [
        [280, 121, 239],
        [292, 126, 251],
      ]
    );
  });
});
