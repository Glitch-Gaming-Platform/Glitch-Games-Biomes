import assert from "assert";
import {
  BIOMES_UI_ACTIVE_MINIMAP_PIN_EDGE_CLASS_V146,
  BIOMES_UI_ACTIVE_MINIMAP_PIN_ROOT_CLASS_V146,
  BIOMES_UI_ACTIVE_MINIMAP_PIN_Z_INDEX_V146,
  biomesUIActiveMiniMapPinClassNameV146,
  biomesUIActiveMiniMapPinCssV146,
  biomesUIActiveMiniMapPinHasFinitePositionV146,
  biomesUIActiveMiniMapPinLabelV146,
} from "@/client/components/map/markers/biomes_ui_active_minimap_pin_v146";
import { HARTHMERE_BUSINESS_MINIMAP_PIN_Z_INDEX_V1 } from "@/client/components/map/markers/harthmere_business_minimap_pins_v1";

describe("BiomesUI active minimap pin V146", () => {
  it("uses a compact waypoint marker instead of the oversized diamond", () => {
    const css = biomesUIActiveMiniMapPinCssV146();
    assert.match(css, /height:\s*1rem/);
    assert.match(css, /width:\s*1rem/);
    assert.doesNotMatch(css, /rotate\(45deg\)\s*scale\(1\.28\)/);
    assert.doesNotMatch(css, /h-4|w-4|text-\[9px\]/);
  });

  it("adds an edge state when the destination is clipped to the minimap rim", () => {
    assert.equal(
      biomesUIActiveMiniMapPinClassNameV146(false),
      BIOMES_UI_ACTIVE_MINIMAP_PIN_ROOT_CLASS_V146
    );
    assert.equal(
      biomesUIActiveMiniMapPinClassNameV146(true),
      `${BIOMES_UI_ACTIVE_MINIMAP_PIN_ROOT_CLASS_V146} ${BIOMES_UI_ACTIVE_MINIMAP_PIN_EDGE_CLASS_V146}`
    );
    assert.match(
      biomesUIActiveMiniMapPinCssV146(),
      new RegExp(`\\.${BIOMES_UI_ACTIVE_MINIMAP_PIN_EDGE_CLASS_V146}`)
    );
  });

  it("renders above ordinary Harthmere business minimap pins", () => {
    assert.ok(
      BIOMES_UI_ACTIVE_MINIMAP_PIN_Z_INDEX_V146 >
        HARTHMERE_BUSINESS_MINIMAP_PIN_Z_INDEX_V1
    );
  });

  it("guards malformed saved destinations", () => {
    assert.equal(
      biomesUIActiveMiniMapPinHasFinitePositionV146([1, 2, 3]),
      true
    );
    assert.equal(
      biomesUIActiveMiniMapPinHasFinitePositionV146([1, Number.NaN, 3]),
      false
    );
    assert.equal(
      biomesUIActiveMiniMapPinHasFinitePositionV146([1, Infinity, 3]),
      false
    );
    assert.equal(
      biomesUIActiveMiniMapPinHasFinitePositionV146(["1", 2, 3]),
      false
    );
    assert.equal(biomesUIActiveMiniMapPinHasFinitePositionV146(undefined), false);
    assert.equal(biomesUIActiveMiniMapPinHasFinitePositionV146([1, 2]), false);
  });

  it("normalizes marker labels for readable tooltips", () => {
    assert.equal(
      biomesUIActiveMiniMapPinLabelV146("  Grove   Jobs\nBoard  "),
      "Grove Jobs Board"
    );
    assert.equal(biomesUIActiveMiniMapPinLabelV146(""), "Marked destination");
    assert.ok(
      biomesUIActiveMiniMapPinLabelV146("a".repeat(100)).length <= 64
    );
  });
});
