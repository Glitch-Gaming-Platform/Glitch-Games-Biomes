import { reactPlayerPlaybackReady } from "@/client/components/reactPlayerPlayback";
import assert from "assert";
import { build } from "esbuild";
import { readFileSync } from "fs";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { chromium } from "playwright";

describe("safe React Player autoplay", () => {
  it("waits for the mounted provider URL before autoplaying", () => {
    assert.equal(
      reactPlayerPlaybackReady(
        "https://www.twitch.tv/biomes",
        undefined,
        false
      ),
      false
    );
    assert.equal(
      reactPlayerPlaybackReady(
        "https://www.twitch.tv/biomes",
        "https://www.twitch.tv/biomes",
        false
      ),
      true
    );
  });

  it("remains paused while the media settings modal owns the player", () => {
    assert.equal(
      reactPlayerPlaybackReady(
        "https://www.twitch.tv/biomes",
        "https://www.twitch.tv/biomes",
        true
      ),
      false
    );
  });

  it("gates every in-game React Player autoplay surface on loaded metadata", () => {
    for (const relativePath of [
      "src/client/components/SpatialMediaPlayer.tsx",
      "src/client/components/modals/VideoSettingsScreen.tsx",
    ]) {
      const source = readFileSync(
        path.join(process.cwd(), relativePath),
        "utf8"
      );
      assert.match(source, /onLoadedMetadata=/, relativePath);
      assert.match(source, /reactPlayerPlaybackReady\(/, relativePath);
      assert.doesNotMatch(source, /playing=\{true\}/, relativePath);
    }
  });

  it("mounts the real Twitch provider paused and plays only after its iframe exists", async function () {
    this.timeout(60_000);
    const tempDir = await mkdtemp(
      path.join(tmpdir(), "biomes-safe-react-player-")
    );
    const entryPath = path.join(tempDir, "entry.tsx");
    const bundlePath = path.join(tempDir, "bundle.js");
    const helperPath = path.join(
      process.cwd(),
      "src/client/components/reactPlayerPlayback.ts"
    );
    await writeFile(
      entryPath,
      `
        import React, { useEffect, useState } from "react";
        import { createRoot } from "react-dom/client";
        import ReactPlayer from "react-player";
        import { reactPlayerPlaybackReady } from ${JSON.stringify(helperPath)};

        const source = "https://www.twitch.tv/biomes";
        function Harness() {
          const [readySource, setReadySource] = useState();
          useEffect(() => setReadySource(undefined), []);
          return React.createElement(ReactPlayer, {
            src: source,
            playing: reactPlayerPlaybackReady(source, readySource),
            muted: true,
            onLoadedMetadata: () => setReadySource(source),
          });
        }
        createRoot(document.getElementById("root")).render(
          React.createElement(Harness)
        );
      `,
      "utf8"
    );

    let browser;
    try {
      await build({
        entryPoints: [entryPath],
        outfile: bundlePath,
        bundle: true,
        platform: "browser",
        format: "iife",
        jsx: "automatic",
        nodePaths: [path.join(process.cwd(), "node_modules")],
        logLevel: "silent",
      });
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(String(error)));
      await page.route(/twitch\.tv|ttvnw\.net|jtvnw\.net/i, (route) =>
        route.abort("blockedbyclient")
      );
      await page.setContent('<div id="root"></div>');
      await page.addScriptTag({ content: await readFile(bundlePath, "utf8") });
      await page.waitForFunction(() => {
        const player = document.querySelector("twitch-video") as
          (HTMLElement & { paused?: boolean }) | null;
        return Boolean(player?.shadowRoot?.querySelector("iframe"));
      });
      assert.equal(
        await page.$eval(
          "twitch-video",
          (player) => (player as HTMLElement & { paused?: boolean }).paused
        ),
        true,
        "Twitch should remain paused during its unsafe mount turn"
      );

      await page.$eval("twitch-video", (player) =>
        player.dispatchEvent(new Event("loadedmetadata"))
      );
      await page.waitForFunction(() => {
        const player = document.querySelector("twitch-video") as
          (HTMLElement & { paused?: boolean }) | null;
        return player?.paused === false;
      });
      assert.equal(
        pageErrors.some((error) => /contentWindow/i.test(error)),
        false,
        pageErrors.join("\n")
      );
    } finally {
      await browser?.close();
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
