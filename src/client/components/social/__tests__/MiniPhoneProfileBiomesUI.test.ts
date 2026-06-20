/// <reference types="mocha" />

import assert from "assert";
import { BIOMES_UI_THEME_CSS } from "@/client/components/biomes_ui/theme/biomesUITheme";
import { nextBiomesProfileFocusIndexForKey } from "../biomesProfileKeyboard";

describe("BiomesUI player profile", () => {
  it("ships BiomesUI profile shell, responsive layout, and keyboard styling", () => {
    assert.ok(BIOMES_UI_THEME_CSS.includes(".biomes-profile-screen"));
    assert.ok(BIOMES_UI_THEME_CSS.includes(".mini-phone.profile"));
    assert.ok(BIOMES_UI_THEME_CSS.includes(".biomes-profile-action"));
    assert.ok(BIOMES_UI_THEME_CSS.includes(".biomes-profile-post-grid"));
    assert.ok(BIOMES_UI_THEME_CSS.includes("@media (max-width: 980px)"));
    assert.ok(BIOMES_UI_THEME_CSS.includes("grid-template-columns: 1fr"));
  });

  it("moves profile focus with arrow keys and wraps like the other BiomesUI surfaces", () => {
    assert.equal(
      nextBiomesProfileFocusIndexForKey({
        key: "ArrowRight",
        currentIndex: 0,
        itemCount: 4,
      }),
      1
    );
    assert.equal(
      nextBiomesProfileFocusIndexForKey({
        key: "ArrowDown",
        currentIndex: 3,
        itemCount: 4,
      }),
      0
    );
    assert.equal(
      nextBiomesProfileFocusIndexForKey({
        key: "ArrowLeft",
        currentIndex: 0,
        itemCount: 4,
      }),
      3
    );
    assert.equal(
      nextBiomesProfileFocusIndexForKey({
        key: "Home",
        currentIndex: 2,
        itemCount: 4,
      }),
      0
    );
    assert.equal(
      nextBiomesProfileFocusIndexForKey({
        key: "End",
        currentIndex: 1,
        itemCount: 4,
      }),
      3
    );
    assert.equal(
      nextBiomesProfileFocusIndexForKey({
        key: "ArrowRight",
        currentIndex: 0,
        itemCount: 0,
      }),
      -1
    );
  });
});
