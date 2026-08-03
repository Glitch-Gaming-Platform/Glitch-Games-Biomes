import assert from "assert";
import fs from "fs";
import path from "path";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HarthmereMaterialAcquisitionGuide } from "../HarthmereMaterialAcquisitionGuide";

describe("HarthmereMaterialAcquisitionGuide", () => {
  it("keeps compact crafting guidance readable instead of squeezing three columns", () => {
    const html = renderToStaticMarkup(
      <HarthmereMaterialAcquisitionGuide
        itemId="wood_plank"
        itemName="Wood Plank"
        count={4}
        compact
      />
    );

    assert.ok(html.includes('data-material-guide-layout="stacked"'));
    assert.ok(html.includes('data-material-route-layout="readable"'));
    assert.ok(html.includes("Buy Wood Plank at Keylot Property Office"));
    assert.ok(
      html.includes("grid-template-columns:max-content minmax(0, 1fr)")
    );
    assert.ok(html.includes("grid-column:1 / -1"));
    assert.ok(html.includes("Show on map"));
    assert.ok(html.includes("Map coordinates: X"));
    assert.ok(html.includes("data-material-route-world-position="));
  });

  it("shows the live grounded coordinates for Chapter 1 Grove suppliers", () => {
    const html = renderToStaticMarkup(
      <HarthmereMaterialAcquisitionGuide
        itemId="scrap_metal"
        itemName="Scrap Metal"
        count={4}
        ownerQuestId="ch1_a1_q03_stand_him_up"
        ownerStepId="gather_parts"
      />
    );

    assert.ok(html.includes("Buy Scrap Metal at Luis"));
    assert.ok(html.includes("Map coordinates: X 486, Y 70, Z -209"));
    assert.ok(
      html.includes(
        'aria-label="Show Luis for Scrap Metal at X 486, Y 70, Z -209 on map"'
      )
    );
  });

  it("allows the guide to wrap onto its own row in the native crafting detail", () => {
    const craftingCss = fs.readFileSync(
      path.join(process.cwd(), "src/client/styles/crafting.css"),
      "utf8"
    );
    assert.match(
      craftingCss,
      /\.crafting-detail \.ingredients \.ingredient \{[\s\S]*?display: flex;[\s\S]*?flex-wrap: wrap;/
    );
  });
});
