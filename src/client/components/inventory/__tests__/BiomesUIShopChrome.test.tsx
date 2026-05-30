/// <reference types="mocha" />

import assert from "assert";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BiomesUIShopAmountStepper,
  BiomesUIShopChrome,
  BiomesUIShopSection,
  closeBiomesUIShopPointerLockV1,
  openBiomesUIShopPointerLockV1,
} from "../BiomesUIShopChrome";
import { BIOMES_UI_THEME_CSS } from "@/client/components/biomes_ui/theme/biomesUITheme";
import { RovingGrid } from "@/client/components/biomes_ui/nav/RovingGrid";
import { ShadowedImage } from "@/client/components/system/ShadowedImage";

describe("BiomesUI shop chrome", () => {
  it("renders shop surfaces as BiomesUI dialogs with pointer and keyboard policies", () => {
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
    assert.ok(html.includes('data-pointer-lock-policy="unlock-while-open"'));
    assert.ok(html.includes('data-mouse-policy="show-while-open"'));
    assert.ok(html.includes('data-keyboard-navigation="roving-grid-and-enter"'));
    assert.ok(html.includes("Raq&#x27;s Shop"));
    assert.ok(html.includes("Increase Quantity"));
    assert.ok(html.includes("Decrease Quantity"));
    assert.equal(html.includes("<input"), false);
  });

  it("ships responsive BiomesUI shop styling and stable slot controls", () => {
    assert.ok(BIOMES_UI_THEME_CSS.includes(".biomes-ui-shop-screen__body"));
    assert.ok(BIOMES_UI_THEME_CSS.includes(".biomes-ui-shop-slot-button"));
    assert.ok(BIOMES_UI_THEME_CSS.includes(".biomes-ui-shop-stepper"));
    assert.ok(BIOMES_UI_THEME_CSS.includes(".biomes-ui-shop-inventory-pane"));
    assert.ok(BIOMES_UI_THEME_CSS.includes("--cell-width: clamp"));
    assert.ok(BIOMES_UI_THEME_CSS.includes("@media (max-width: 768px)"));
    assert.ok(BIOMES_UI_THEME_CSS.includes("min-height: 92px"));
  });

  it("renders a fallback source for shop avatars without an image", () => {
    const html = renderToStaticMarkup(
      <ShadowedImage
        extraClassNames="avatar"
        src={undefined}
        fallbackSrc="/hud/avatar-placeholder.png"
      />
    );

    assert.ok(html.includes('src="/hud/avatar-placeholder.png"'));
  });

  it("returns pointer lock only when the shop opened from locked gameplay", () => {
    const calls: string[] = [];
    let locked = true;
    const manager = {
      isLocked() {
        return locked;
      },
      unlock() {
        calls.push("unlock");
        locked = false;
      },
      focusAndLock() {
        calls.push("focusAndLock");
        locked = true;
      },
    };
    const shouldReturn = { current: false };

    openBiomesUIShopPointerLockV1(manager, shouldReturn);
    closeBiomesUIShopPointerLockV1(manager, shouldReturn);
    closeBiomesUIShopPointerLockV1(manager, shouldReturn);

    assert.deepEqual(calls, ["unlock", "focusAndLock"]);
  });

  it("does not force pointer lock when the player opened shop while unlocked", () => {
    const calls: string[] = [];
    const manager = {
      isLocked: () => false,
      unlock: () => calls.push("unlock"),
      focusAndLock: () => calls.push("focusAndLock"),
    };
    const shouldReturn = { current: false };

    openBiomesUIShopPointerLockV1(manager, shouldReturn);
    closeBiomesUIShopPointerLockV1(manager, shouldReturn);

    assert.deepEqual(calls, ["unlock"]);
  });

  it("keeps slot grids in the roving-tabindex keyboard pattern", () => {
    const html = renderToStaticMarkup(
      <RovingGrid
        ariaLabel="Shop keyboard grid"
        items={[
          ["a", "b"],
          ["c", "d"],
        ]}
        renderCell={(item, _coords, cell) => (
          <button
            ref={cell.ref}
            tabIndex={cell.tabIndex}
            onFocus={cell.onFocus}
            onClick={cell.onClick}
            onKeyDown={cell.onKeyDown}
          >
            {item}
          </button>
        )}
      />
    );

    assert.ok(html.includes('role="grid"'));
    assert.ok(html.includes('role="row"'));
    assert.ok(html.includes('tabindex="0"'));
    assert.ok(html.includes('tabindex="-1"'));
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
