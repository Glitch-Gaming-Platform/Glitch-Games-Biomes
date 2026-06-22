import assert from "assert";
import { build } from "esbuild";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { chromium } from "playwright";

declare global {
  interface Window {
    __harthmereDeathScreenVersion?: string | null;
    __harthmereRespawnClicked?: boolean;
  }
}

describe("Harthmere death screen browser render", () => {
  it("renders the Grove respawn overlay for an HP-zero death state", async function () {
    this.timeout(45_000);

    const tempDir = await mkdtemp(path.join(tmpdir(), "biomes-death-screen-"));
    const entryPath = path.join(tempDir, "entry.tsx");
    const bundlePath = path.join(tempDir, "bundle.js");
    const tsconfigPath = path.join(tempDir, "tsconfig.json");
    const deathScreenViewPath = path
      .join(
        process.cwd(),
        "src/client/components/challenges/HarthmereDeathScreenOverlayView.tsx"
      )
      .replace(/\\/g, "/");

    try {
      await writeFile(
        entryPath,
        `
          import * as React from "react";
          import { createRoot } from "react-dom/client";
          import {
            HARTHMERE_DEATH_SCREEN_VERSION,
            HarthmereDeathScreenOverlayView,
          } from "${deathScreenViewPath}";

          function Harness() {
            React.useEffect(() => {
              window.__harthmereDeathScreenVersion =
                document
                  .querySelector("[data-harthmere-death-screen-version]")
                  ?.getAttribute("data-harthmere-death-screen-version") ?? null;
            });
            return (
              <HarthmereDeathScreenOverlayView
                cause="You are gone too soon. drowning."
                consequence="and were claimed by Deep Water"
                downedSeconds={0}
                onRespawn={() => {
                  window.__harthmereRespawnClicked = true;
                }}
              />
            );
          }

          createRoot(document.getElementById("root")).render(<Harness />);
          window.__harthmereDeathScreenVersion = HARTHMERE_DEATH_SCREEN_VERSION;
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
          viewport: { width: 960, height: 640 },
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
        await page.route("http://harthmere-death-screen.test/", (route) =>
          route.fulfill({
            contentType: "text/html",
            body: "<html><body><div id=\"root\"></div></body></html>",
          })
        );
        await page.goto("http://harthmere-death-screen.test/");
        await page.addScriptTag({ content: await readFile(bundlePath, "utf8") });

        const overlay = page.locator("[data-harthmere-death-screen-version]");
        await overlay.waitFor({ state: "visible" });
        assert.equal(
          await overlay.getAttribute("data-harthmere-death-screen-version"),
          "harthmere-death-screen-grove-respawn"
        );
        assert.ok(
          await page
            .getByRole("button", { name: /Resurrect at The Grove/i })
            .isVisible()
        );
        await page
          .getByRole("button", { name: /Resurrect at The Grove/i })
          .click();
        assert.equal(
          await page.evaluate(() => window.__harthmereRespawnClicked),
          true
        );
        assert.deepEqual(browserErrors, []);
      } finally {
        await browser.close();
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
