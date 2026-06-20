import assert from "assert";
import {
  BIOMES_UI_ACTIVE_MINIMAP_PIN_EDGE_CLASS,
  BIOMES_UI_ACTIVE_MINIMAP_PIN_ROOT_CLASS,
  BIOMES_UI_ACTIVE_MINIMAP_PIN_Z_INDEX,
  biomesUIActiveMiniMapPinClassName,
  biomesUIActiveMiniMapPinCss,
  biomesUIActiveMiniMapPinHasFinitePosition,
  biomesUIActiveMiniMapPinLabel,
} from "@/client/components/map/markers/biomes_ui_active_minimap_pin";
import { HARTHMERE_BUSINESS_MINIMAP_PIN_Z_INDEX } from "@/client/components/map/markers/harthmere_business_minimap_pins";

describe("BiomesUI active minimap pin V146", () => {
  it("uses a compact waypoint marker instead of the oversized diamond", () => {
    const css = biomesUIActiveMiniMapPinCss();
    assert.match(css, /height:\s*1rem/);
    assert.match(css, /width:\s*1rem/);
    assert.doesNotMatch(css, /rotate\(45deg\)\s*scale\(1\.28\)/);
    assert.doesNotMatch(css, /h-4|w-4|text-\[9px\]/);
  });

  it("adds an edge state when the destination is clipped to the minimap rim", () => {
    assert.equal(
      biomesUIActiveMiniMapPinClassName(false),
      BIOMES_UI_ACTIVE_MINIMAP_PIN_ROOT_CLASS
    );
    assert.equal(
      biomesUIActiveMiniMapPinClassName(true),
      `${BIOMES_UI_ACTIVE_MINIMAP_PIN_ROOT_CLASS} ${BIOMES_UI_ACTIVE_MINIMAP_PIN_EDGE_CLASS}`
    );
    assert.match(
      biomesUIActiveMiniMapPinCss(),
      new RegExp(`\\.${BIOMES_UI_ACTIVE_MINIMAP_PIN_EDGE_CLASS}`)
    );
  });

  it("renders above ordinary Harthmere business minimap pins", () => {
    assert.ok(
      BIOMES_UI_ACTIVE_MINIMAP_PIN_Z_INDEX >
        HARTHMERE_BUSINESS_MINIMAP_PIN_Z_INDEX
    );
  });

  it("guards malformed saved destinations", () => {
    assert.equal(
      biomesUIActiveMiniMapPinHasFinitePosition([1, 2, 3]),
      true
    );
    assert.equal(
      biomesUIActiveMiniMapPinHasFinitePosition([1, Number.NaN, 3]),
      false
    );
    assert.equal(
      biomesUIActiveMiniMapPinHasFinitePosition([1, Infinity, 3]),
      false
    );
    assert.equal(
      biomesUIActiveMiniMapPinHasFinitePosition(["1", 2, 3]),
      false
    );
    assert.equal(biomesUIActiveMiniMapPinHasFinitePosition(undefined), false);
    assert.equal(biomesUIActiveMiniMapPinHasFinitePosition([1, 2]), false);
  });

  it("normalizes marker labels for readable tooltips", () => {
    assert.equal(
      biomesUIActiveMiniMapPinLabel("  Grove   Jobs\nBoard  "),
      "Grove Jobs Board"
    );
    assert.equal(biomesUIActiveMiniMapPinLabel(""), "Marked destination");
    assert.ok(
      biomesUIActiveMiniMapPinLabel("a".repeat(100)).length <= 64
    );
  });
});
