import assert from "assert";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BIOMES_HUD_VISIBILITY_OPTIONS_V1,
  biomesHUDVisibilitySnapshotWithDefaultsForTest,
  biomesHUDVisibilityStorageKeyForTest,
  readBiomesHUDVisibilitySettingV1,
  setBiomesHUDVisibilitySettingV1,
  shouldShowBiomesHUDElementForTest,
  toggledBiomesHUDVisibilitySnapshotForTest,
} from "../hudVisibilitySettings";
import { OptionsControlsSurfaceForTest } from "../tabs/OptionsControlsSurface";
import { DEFAULT_TAB_SHORTCUTS } from "../shortcuts/BiomesShortcuts";
import { zTypesafeLocalStorageSchema } from "@/client/util/typed_local_storage";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, String(value));
  }
}

function withMemoryLocalStorage(run: () => void) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: new MemoryStorage(),
  });
  try {
    run();
  } finally {
    if (previous) {
      Object.defineProperty(globalThis, "localStorage", previous);
    } else {
      delete (globalThis as { localStorage?: Storage }).localStorage;
    }
  }
}

describe("BiomesUI HUD visibility settings", () => {
  it("defaults every HUD visibility option on", () => {
    const snapshot = biomesHUDVisibilitySnapshotWithDefaultsForTest();
    for (const option of BIOMES_HUD_VISIBILITY_OPTIONS_V1) {
      assert.equal(snapshot[option.id], true, `${option.id} should default on`);
      assert.equal(
        shouldShowBiomesHUDElementForTest(undefined, option.id),
        true
      );
    }
  });

  it("persists each visibility toggle through the typed storage schema", () => {
    withMemoryLocalStorage(() => {
      for (const option of BIOMES_HUD_VISIBILITY_OPTIONS_V1) {
        assert.equal(readBiomesHUDVisibilitySettingV1(option.id), true);
        setBiomesHUDVisibilitySettingV1(option.id, false);
        assert.equal(readBiomesHUDVisibilitySettingV1(option.id), false);
        setBiomesHUDVisibilitySettingV1(option.id, true);
        assert.equal(readBiomesHUDVisibilitySettingV1(option.id), true);
        assert.equal(
          zTypesafeLocalStorageSchema.shape[
            biomesHUDVisibilityStorageKeyForTest(option.id)
          ].safeParse(false).success,
          true
        );
      }
    });
  });

  it("toggles individual HUD entries without changing the other defaults", () => {
    for (const option of BIOMES_HUD_VISIBILITY_OPTIONS_V1) {
      const snapshot = toggledBiomesHUDVisibilitySnapshotForTest(
        undefined,
        option.id,
        false
      );
      assert.equal(snapshot[option.id], false);
      for (const other of BIOMES_HUD_VISIBILITY_OPTIONS_V1) {
        if (other.id !== option.id) {
          assert.equal(snapshot[other.id], true);
        }
      }
    }
  });

  it("renders HUD controls in Options without the old dummy accessibility switches", () => {
    const html = renderToStaticMarkup(
      <OptionsControlsSurfaceForTest
        showPerformanceHUD={true}
        graphicsQuality="auto"
        effectsVolume={100}
        musicVolume={50}
        voiceVolume={50}
        hudVisibility={biomesHUDVisibilitySnapshotWithDefaultsForTest()}
        shortcuts={DEFAULT_TAB_SHORTCUTS}
      />
    );
    for (const option of BIOMES_HUD_VISIBILITY_OPTIONS_V1) {
      assert.ok(html.includes(`data-biomes-hud-setting-id="${option.id}"`));
      assert.ok(html.includes(option.label));
    }
    assert.ok(html.includes("Show Performance Stats"));
    assert.ok(html.includes("Sound Effects"));
    assert.equal(html.includes("High-contrast highlights"), false);
    assert.equal(html.includes("Screen-reader friendly captions"), false);
  });

  it("reflects off toggles as unchecked controls in the Options surface", () => {
    const html = renderToStaticMarkup(
      <OptionsControlsSurfaceForTest
        showPerformanceHUD={true}
        graphicsQuality="auto"
        effectsVolume={100}
        musicVolume={50}
        voiceVolume={50}
        hudVisibility={biomesHUDVisibilitySnapshotWithDefaultsForTest({
          objectives: false,
          hotbar: false,
        })}
        shortcuts={DEFAULT_TAB_SHORTCUTS}
      />
    );
    const objectivesInput =
      html.match(
        /<input[^>]*data-biomes-hud-setting-id="objectives"[^>]*>/
      )?.[0] ?? "";
    const miniMapInput =
      html.match(
        /<input[^>]*data-biomes-hud-setting-id="miniMap"[^>]*>/
      )?.[0] ?? "";
    const hotbarInput =
      html.match(/<input[^>]*data-biomes-hud-setting-id="hotbar"[^>]*>/)?.[0] ??
      "";
    assert.ok(objectivesInput);
    assert.ok(miniMapInput);
    assert.ok(hotbarInput);
    assert.equal(objectivesInput.includes("checked"), false);
    assert.equal(hotbarInput.includes("checked"), false);
    assert.equal(miniMapInput.includes("checked"), true);
  });
});
