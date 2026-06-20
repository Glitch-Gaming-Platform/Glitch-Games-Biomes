import assert from "assert";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BIOMES_HUD_VISIBILITY_OPTIONS,
  biomesHUDVisibilitySnapshotWithDefaultsForTest,
  biomesHUDVisibilityStorageKeyForTest,
  readBiomesHUDVisibilitySetting,
  setBiomesHUDVisibilitySetting,
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
    for (const option of BIOMES_HUD_VISIBILITY_OPTIONS) {
      assert.equal(snapshot[option.id], true, `${option.id} should default on`);
      assert.equal(
        shouldShowBiomesHUDElementForTest(undefined, option.id),
        true
      );
    }
  });

  it("persists each visibility toggle through the typed storage schema", () => {
    withMemoryLocalStorage(() => {
      for (const option of BIOMES_HUD_VISIBILITY_OPTIONS) {
        assert.equal(readBiomesHUDVisibilitySetting(option.id), true);
        setBiomesHUDVisibilitySetting(option.id, false);
        assert.equal(readBiomesHUDVisibilitySetting(option.id), false);
        setBiomesHUDVisibilitySetting(option.id, true);
        assert.equal(readBiomesHUDVisibilitySetting(option.id), true);
        assert.equal(
          zTypesafeLocalStorageSchema.shape[
            biomesHUDVisibilityStorageKeyForTest(option.id)
          ].safeParse(false).success,
          true
        );
      }
      assert.equal(
        zTypesafeLocalStorageSchema.shape[
          "settings.voice.microphoneDeviceId"
        ].safeParse("studio-mic").success,
        true
      );
      assert.equal(
        zTypesafeLocalStorageSchema.shape[
          "settings.voice.npcSpeechEnabled"
        ].safeParse(false).success,
        true
      );
      assert.equal(
        zTypesafeLocalStorageSchema.shape[
          "settings.voice.microphoneInputEnabled"
        ].safeParse(false).success,
        true
      );
    });
  });

  it("toggles individual HUD entries without changing the other defaults", () => {
    for (const option of BIOMES_HUD_VISIBILITY_OPTIONS) {
      const snapshot = toggledBiomesHUDVisibilitySnapshotForTest(
        undefined,
        option.id,
        false
      );
      assert.equal(snapshot[option.id], false);
      for (const other of BIOMES_HUD_VISIBILITY_OPTIONS) {
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
        microphoneDevices={[
          { deviceId: "", label: "Browser Default" },
          { deviceId: "studio", label: "Studio Mic" },
        ]}
        selectedMicrophoneDeviceId="studio"
        hudVisibility={biomesHUDVisibilitySnapshotWithDefaultsForTest()}
        shortcuts={DEFAULT_TAB_SHORTCUTS}
      />
    );
    for (const option of BIOMES_HUD_VISIBILITY_OPTIONS) {
      assert.ok(html.includes(`data-biomes-hud-setting-id="${option.id}"`));
      assert.ok(html.includes(option.label));
    }
    assert.ok(html.includes("Show Performance Stats"));
    assert.ok(html.includes("Sound Effects"));
    assert.ok(html.includes("NPC Speech"));
    assert.ok(html.includes("Microphone Input"));
    assert.ok(html.includes("Microphone"));
    assert.ok(html.includes("Studio Mic"));
    assert.ok(html.includes('aria-label="NPC Speech"'));
    assert.ok(html.includes('aria-label="Microphone Input"'));
    assert.ok(html.includes('aria-label="Microphone"'));
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

  it("renders voice and microphone toggles on by default and disables microphone controls when off", () => {
    const defaultHtml = renderToStaticMarkup(
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
    const npcSpeechInput =
      defaultHtml.match(/<input[^>]*aria-label="NPC Speech"[^>]*>/)?.[0] ?? "";
    const microphoneInput =
      defaultHtml.match(
        /<input[^>]*aria-label="Microphone Input"[^>]*>/
      )?.[0] ?? "";
    assert.ok(npcSpeechInput.includes("checked"));
    assert.ok(microphoneInput.includes("checked"));

    const disabledHtml = renderToStaticMarkup(
      <OptionsControlsSurfaceForTest
        showPerformanceHUD={true}
        graphicsQuality="auto"
        effectsVolume={100}
        musicVolume={50}
        voiceVolume={50}
        npcSpeechEnabled={false}
        microphoneInputEnabled={false}
        hudVisibility={biomesHUDVisibilitySnapshotWithDefaultsForTest()}
        shortcuts={DEFAULT_TAB_SHORTCUTS}
      />
    );
    const disabledNpcSpeechInput =
      disabledHtml.match(/<input[^>]*aria-label="NPC Speech"[^>]*>/)?.[0] ?? "";
    const disabledMicrophoneInput =
      disabledHtml.match(
        /<input[^>]*aria-label="Microphone Input"[^>]*>/
      )?.[0] ?? "";
    const microphoneSelect =
      disabledHtml.match(/<select[^>]*aria-label="Microphone"[^>]*>/)?.[0] ??
      "";
    assert.equal(disabledNpcSpeechInput.includes("checked"), false);
    assert.equal(disabledMicrophoneInput.includes("checked"), false);
    assert.ok(microphoneSelect.includes("disabled"));
  });
});
