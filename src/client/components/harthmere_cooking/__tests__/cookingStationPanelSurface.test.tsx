import assert from "assert";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createHarthmereCookVisibleRecipes,
  harthmereCookRecipeDetail,
} from "../cookingStationLiveAdapter";
import { HarthmereCookingStationSurfaceForTest } from "../HarthmereCookingStationPanel";

describe("HarthmereCookingStationPanel surface", () => {
  it("renders a structured, readable cooking station UI without farming recipes", () => {
    const inventory = { raw_meat: 2 };
    const recipes = createHarthmereCookVisibleRecipes(inventory, "campfire");
    const detail = harthmereCookRecipeDetail(
      "grilled_meat",
      inventory,
      "campfire",
      1
    );
    assert.ok(detail);

    const html = renderToStaticMarkup(
      <HarthmereCookingStationSurfaceForTest
        compact
        request={{
          label: "Campfire",
          stationKind: "campfire",
        }}
        recipes={recipes}
        jobs={[
          {
            jobId: "job-1",
            recipeId: "grilled_meat",
            displayName: "Grilled Meat",
            count: 1,
            status: "cooking",
            startedAtMs: 0,
            readyAtMs: 45_000,
            progress: 0.45,
            outputs: { grilled_meat: 1 },
          },
        ]}
        detail={detail}
        selectedRecipeId="grilled_meat"
        count={1}
        maxCookable={detail!.maxCookable}
        canCook={detail!.canCook}
        hydrated
        updatedAtMs={20_000}
      />
    );

    assert.ok(html.includes('data-harthmere-cooking-surface="refined"'));
    assert.ok(html.includes('data-harthmere-cooking-recipes="true"'));
    assert.ok(html.includes('data-harthmere-cooking-detail="true"'));
    assert.ok(html.includes('data-harthmere-cooking-queue="true"'));
    assert.ok(html.includes("Campfire"));
    assert.ok(html.includes("Grilled Meat"));
    assert.ok(html.includes("Station Queue"));
    assert.ok(html.includes("Ready"));
    assert.ok(html.includes("Raw Meat"));

    const visibleText = html.replace(/<[^>]*>/g, " ");
    assert.ok(!/Seed|Fertilizer/.test(visibleText), visibleText);
    assert.ok(!/\b\d{6,}\b/.test(visibleText), visibleText);
  });
});
