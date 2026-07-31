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
