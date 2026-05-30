/// <reference types="mocha" />

import assert from "assert";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BiomesUIShopAmountStepper,
  BiomesUIShopChrome,
  BiomesUIShopSection,
} from "../BiomesUIShopChrome";
import { BIOMES_UI_THEME_CSS } from "@/client/components/biomes_ui/theme/biomesUITheme";

describe("BiomesUI shop chrome", () => {
  it("renders shop surfaces as BiomesUI dialogs with no text inputs", () => {
    const html = renderToStaticMarkup(
      <BiomesUIShopChrome
        title="Raq's Shop"
        eyebrow="Shop Interface"
        variant="container"
        subtitle="Buy with Bling."
      >
        <BiomesUIShopSection title="Listings" meta="1 available">
          <BiomesUIShopAmountStepper
            label="Quantity"
            value={2}
            min={1}
            max={20}
            onChange={() => {}}
          />
        </BiomesUIShopSection>
      </BiomesUIShopChrome>
    );

    assert.ok(html.includes('role="dialog"'));
    assert.ok(html.includes('data-biomes-ui-shop="container"'));
    assert.ok(html.includes("Raq&#x27;s Shop"));
    assert.ok(html.includes("Increase Quantity"));
    assert.ok(html.includes("Decrease Quantity"));
    assert.equal(html.includes("<input"), false);
  });

  it("ships responsive BiomesUI shop styling and stable slot controls", () => {
    assert.ok(BIOMES_UI_THEME_CSS.includes(".biomes-ui-shop-screen__body"));
    assert.ok(BIOMES_UI_THEME_CSS.includes(".biomes-ui-shop-slot-button"));
    assert.ok(BIOMES_UI_THEME_CSS.includes(".biomes-ui-shop-stepper"));
    assert.ok(BIOMES_UI_THEME_CSS.includes("@media (max-width: 768px)"));
    assert.ok(BIOMES_UI_THEME_CSS.includes("min-height: 92px"));
  });

  it("marks the stepper as an arrow-key group for mobile and keyboard control", () => {
    const html = renderToStaticMarkup(
      <BiomesUIShopAmountStepper
        label="Price"
        value={1}
        min={1}
        max={999}
        onChange={() => {}}
      />
    );
    assert.ok(html.includes('role="group"'));
    assert.ok(html.includes('aria-label="Price"'));
    assert.ok(html.includes('aria-label="Increase Price"'));
    assert.ok(html.includes('aria-label="Decrease Price"'));
    assert.ok(html.includes("<output"));
  });
});
