import assert from "assert";
import { readableMapMarkerLabelForTest } from "@/client/components/biomes_ui/adapters/mapMarkerLabels";

describe("map marker labels", () => {
  it("never exposes underscore-based marker ids as labels", () => {
    const label = readableMapMarkerLabelForTest({
      id: "marker_1",
      label:
        "Get Sealed Package — harthmere_business_outpost_sanitation_clearbarrel",
    });
    assert.equal(label, "Get Sealed Package — Sanitation Clearbarrel");
    assert.ok(!label.includes("_"));
  });

  it("keeps authored labels unchanged", () => {
    assert.equal(
      readableMapMarkerLabelForTest({
        id: "coop_supply_box",
        label: "Old Supply Box",
      }),
      "Old Supply Box"
    );
  });
});
