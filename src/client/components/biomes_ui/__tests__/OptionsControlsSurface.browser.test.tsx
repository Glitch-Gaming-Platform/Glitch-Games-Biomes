import assert from "assert";
import { build } from "esbuild";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { chromium } from "playwright";

declare global {
  interface Window {
    __selectedMicrophoneDeviceId: string;
    __microphoneInputEnabled: boolean;
    __npcSpeechProvider: string;
  }
}

describe("BiomesUI Options browser voice controls", () => {
  it("lets the player switch microphones and disables the selector when mic input is off", async function () {
    this.timeout(30_000);

    const tempDir = await mkdtemp(path.join(tmpdir(), "biomes-options-"));
    const entryPath = path.join(tempDir, "entry.tsx");
    const bundlePath = path.join(tempDir, "bundle.js");
    const tsconfigPath = path.join(tempDir, "tsconfig.json");
    const componentPath = path
      .join(
        process.cwd(),
        "src/client/components/biomes_ui/tabs/OptionsControlsSurface.tsx"
      )
      .replace(/\\/g, "/");
    const hudPath = path
      .join(
        process.cwd(),
        "src/client/components/biomes_ui/hudVisibilitySettings.ts"
      )
      .replace(/\\/g, "/");
    const shortcutsPath = path
      .join(
        process.cwd(),
        "src/client/components/biomes_ui/shortcuts/BiomesShortcuts.ts"
      )
      .replace(/\\/g, "/");

    await writeFile(
      entryPath,
      `
        import * as React from "react";
        import { createRoot } from "react-dom/client";
        import { OptionsControlsSurfaceForTest } from "${componentPath}";
        import { biomesHUDVisibilitySnapshotWithDefaultsForTest } from "${hudPath}";
        import { DEFAULT_TAB_SHORTCUTS } from "${shortcutsPath}";

        window.__selectedMicrophoneDeviceId = "";
        window.__microphoneInputEnabled = true;
        window.__npcSpeechProvider = "elevenlabs";

        function Harness() {
          const [selectedMicrophoneDeviceId, setSelectedMicrophoneDeviceId] = React.useState("");
          const [microphoneInputEnabled, setMicrophoneInputEnabled] = React.useState(true);
          const [npcSpeechEnabled, setNpcSpeechEnabled] = React.useState(true);
          const [npcSpeechProvider, setNpcSpeechProvider] = React.useState("elevenlabs");
          React.useEffect(() => {
            window.__selectedMicrophoneDeviceId = selectedMicrophoneDeviceId;
            window.__microphoneInputEnabled = microphoneInputEnabled;
            window.__npcSpeechProvider = npcSpeechProvider;
          }, [selectedMicrophoneDeviceId, microphoneInputEnabled, npcSpeechProvider]);
          return (
            <OptionsControlsSurfaceForTest
              showPerformanceHUD={true}
              graphicsQuality="auto"
              effectsVolume={100}
              musicVolume={50}
              voiceVolume={50}
              npcSpeechEnabled={npcSpeechEnabled}
              onNpcSpeechEnabledChange={setNpcSpeechEnabled}
              npcSpeechProvider={npcSpeechProvider}
              onNpcSpeechProviderChange={setNpcSpeechProvider}
              microphoneInputEnabled={microphoneInputEnabled}
              onMicrophoneInputEnabledChange={setMicrophoneInputEnabled}
              microphoneDevices={[
                { deviceId: "", label: "Browser Default" },
                { deviceId: "studio-mic", label: "Studio Mic" },
                { deviceId: "headset-mic", label: "Headset Mic" },
              ]}
              selectedMicrophoneDeviceId={selectedMicrophoneDeviceId}
              onMicrophoneDeviceChange={setSelectedMicrophoneDeviceId}
              hudVisibility={biomesHUDVisibilitySnapshotWithDefaultsForTest()}
              shortcuts={DEFAULT_TAB_SHORTCUTS}
            />
          );
        }

        createRoot(document.getElementById("root")).render(<Harness />);
      `
    );
    await writeFile(
      tsconfigPath,
      JSON.stringify({
        compilerOptions: {
          jsx: "react",
          baseUrl: process.cwd(),
          paths: {
            "@/*": ["src/*"],
          },
        },
      })
    );

    await build({
      entryPoints: [entryPath],
      outfile: bundlePath,
      bundle: true,
      absWorkingDir: process.cwd(),
      nodePaths: [path.join(process.cwd(), "node_modules")],
      platform: "browser",
      format: "iife",
      jsx: "transform",
      jsxFactory: "React.createElement",
      jsxFragment: "React.Fragment",
      loader: { ".tsx": "tsx", ".ts": "ts" },
      tsconfig: tsconfigPath,
    });

    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({
        viewport: { width: 720, height: 520 },
      });
      const browserErrors: string[] = [];
      page.on("pageerror", (error) =>
        browserErrors.push(error.stack ?? error.message)
      );
      page.on("console", (message) => {
        if (message.type() === "error") {
          browserErrors.push(message.text());
        }
      });
      await page.setContent(`
        <html>
          <body><div id="root"></div></body>
        </html>
      `);
      await page.addScriptTag({ content: await readFile(bundlePath, "utf8") });

      const microphoneSelect = page.getByLabel("Microphone", { exact: true });
      const voiceProviderSelect = page.getByLabel("NPC Voice Provider");

      assert.equal(await voiceProviderSelect.inputValue(), "elevenlabs");
      await voiceProviderSelect.selectOption("openai");
      assert.equal(
        await page.evaluate(() => window.__npcSpeechProvider),
        "openai"
      );
      await page.getByLabel("NPC Speech").uncheck();
      assert.equal(await voiceProviderSelect.isDisabled(), true);
      await page.getByLabel("NPC Speech").check();
      assert.equal(await voiceProviderSelect.isDisabled(), false);

      await microphoneSelect.selectOption("studio-mic");
      assert.equal(
        await page.evaluate(() => window.__selectedMicrophoneDeviceId),
        "studio-mic"
      );

      await microphoneSelect.selectOption("headset-mic");
      assert.equal(
        await page.evaluate(() => window.__selectedMicrophoneDeviceId),
        "headset-mic"
      );

      await page.getByLabel("Microphone Input").uncheck();
      assert.equal(
        await page.evaluate(() => window.__microphoneInputEnabled),
        false
      );
      assert.equal(await microphoneSelect.isDisabled(), true);

      await page.getByLabel("Microphone Input").check();
      assert.equal(await microphoneSelect.isDisabled(), false);
      assert.equal(browserErrors.join("\n"), "");
    } finally {
      await browser.close();
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
