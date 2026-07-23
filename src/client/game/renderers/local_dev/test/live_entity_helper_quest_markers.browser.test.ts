/// <reference types="mocha" />

import assert from "assert";
import { build } from "esbuild";
import { existsSync, statSync } from "fs";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { chromium } from "playwright";

describe("live entity helper quest marker browser flow", () => {
  it("clicks through boss accept and clear without pre-spawning the encounter", async function () {
    this.timeout(45_000);

    const tempDir = await mkdtemp(
      path.join(tmpdir(), "biomes-live-helper-marker-")
    );
    const entryPath = path.join(tempDir, "entry.ts");
    const bundlePath = path.join(tempDir, "bundle.js");
    const tsconfigPath = path.join(tempDir, "tsconfig.json");

    await writeFile(
      entryPath,
      `
        import { setHarthmereLocalDevUserScope } from "${path
          .join(
            process.cwd(),
            "src/client/components/challenges/LocalDevHarthmereUserScope.ts"
          )
          .replace(/\\/g, "/")}";
        import {
          activeLiveEntityHelperQuestMarkerIds,
          writeLiveEntityHelperQuestState,
        } from "${path
          .join(
            process.cwd(),
            "src/client/components/challenges/LocalDevLiveEntityHelperQuestState.ts"
          )
          .replace(/\\/g, "/")}";
        import {
          LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID,
          isLiveEntityHelperMuckBossSpawnMarker,
          liveEntityHelperQuestTargetMarkerForKind,
        } from "${path
          .join(
            process.cwd(),
            "src/shared/harthmere/live_entity_helper_quests.ts"
          )
          .replace(/\\/g, "/")}";

        setHarthmereLocalDevUserScope("browser-helper-marker-test");

        function sample() {
          const activeIds = activeLiveEntityHelperQuestMarkerIds();
          const marker = liveEntityHelperQuestTargetMarkerForKind("hard_boss");
          document.body.dataset.visible = String(
            activeIds.has(LIVE_ENTITY_HELPER_MUCK_BOSS_MARKER_ID)
          );
          document.body.dataset.inMuck = String(
            isLiveEntityHelperMuckBossSpawnMarker(marker)
          );
          document.body.dataset.position = marker?.position.join(",");
        }

        document.getElementById("accept")!.addEventListener("click", () => {
          writeLiveEntityHelperQuestState({
            active: {
              "live-helper:browser-hard-boss:hard_boss": {
                questId: "live-helper:browser-hard-boss:hard_boss",
                kind: "hard_boss",
                entityId: "browser-hard-boss",
                giverName: "Remote Helper",
                at: Date.now(),
              },
            },
            completed: {},
          });
          sample();
        });

        document.getElementById("clear")!.addEventListener("click", () => {
          writeLiveEntityHelperQuestState({ active: {}, completed: {} });
          sample();
        });

        sample();
      `
    );
    await writeFile(
      tsconfigPath,
      JSON.stringify({
        compilerOptions: {
          jsx: "react",
        },
      })
    );

    const resolveRepoAlias = (specifier: string) => {
      const base = path.join(process.cwd(), "src", specifier.slice(2));
      for (const candidate of [
        `${base}.ts`,
        `${base}.tsx`,
        `${base}.js`,
        path.join(base, "index.ts"),
        path.join(base, "index.tsx"),
        base,
      ]) {
        if (existsSync(candidate) && statSync(candidate).isFile()) {
          return candidate;
        }
      }
      return base;
    };

    await build({
      entryPoints: [entryPath],
      outfile: bundlePath,
      bundle: true,
      absWorkingDir: process.cwd(),
      nodePaths: [path.join(process.cwd(), "node_modules")],
      platform: "browser",
      format: "iife",
      loader: { ".tsx": "tsx", ".ts": "ts" },
      tsconfig: tsconfigPath,
      plugins: [
        {
          name: "repo-path-alias",
          setup(pluginBuild) {
            pluginBuild.onResolve({ filter: /^@\// }, (args) => ({
              path: resolveRepoAlias(args.path),
            }));
          },
        },
      ],
    });

    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({
        viewport: { width: 900, height: 600 },
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
      await page.route("http://live-helper-marker.test/", (route) =>
        route.fulfill({
          contentType: "text/html",
          body: `
            <html>
              <body>
                <button id="accept">Accept Boss Quest</button>
                <button id="clear">Clear Quest</button>
              </body>
            </html>
          `,
        })
      );
      await page.goto("http://live-helper-marker.test/");
      await page.addScriptTag({ content: await readFile(bundlePath, "utf8") });
      assert.deepEqual(browserErrors, []);
      await page.waitForFunction(
        () => document.body.dataset.visible !== undefined
      );

      assert.equal(
        await page.locator("body").getAttribute("data-visible"),
        "false"
      );
      assert.equal(
        await page.locator("body").getAttribute("data-in-muck"),
        "true"
      );
      assert.equal(
        await page.locator("body").getAttribute("data-position"),
        "1844,53,-506"
      );

      await page.getByRole("button", { name: "Accept Boss Quest" }).click();
      assert.equal(
        await page.locator("body").getAttribute("data-visible"),
        "true"
      );

      await page.getByRole("button", { name: "Clear Quest" }).click();
      assert.equal(
        await page.locator("body").getAttribute("data-visible"),
        "false"
      );
    } finally {
      await browser.close();
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
