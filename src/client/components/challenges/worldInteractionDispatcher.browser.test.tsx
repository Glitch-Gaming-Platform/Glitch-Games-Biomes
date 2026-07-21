import assert from "assert";
import { build } from "esbuild";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { chromium } from "playwright";

describe("world interaction dispatcher browser integration", () => {
  it("does not loop when a component passes a fresh candidate object", async function () {
    this.timeout(30_000);

    const tempDir = await mkdtemp(
      path.join(tmpdir(), "biomes-world-interaction-")
    );
    const entryPath = path.join(tempDir, "entry.tsx");
    const bundlePath = path.join(tempDir, "bundle.js");
    const tsconfigPath = path.join(tempDir, "tsconfig.json");
    const dispatcherPath = path
      .join(
        process.cwd(),
        "src/client/components/challenges/worldInteractionDispatcher.ts"
      )
      .replace(/\\/g, "/");

    try {
      await writeFile(
        entryPath,
        `
          import * as React from "react";
          import { createRoot } from "react-dom/client";
          import { useWorldInteractionCandidate } from "${dispatcherPath}";

          window.__worldInteractionRenderCount = 0;

          function Harness() {
            window.__worldInteractionRenderCount += 1;
            const ownsInteraction = useWorldInteractionCandidate({
              id: "unstable-candidate",
              priority: 100,
              keyCodes: ["KeyF"],
              onInteract: () => undefined,
            });
            return (
              <div data-owns-interaction={ownsInteraction ? "yes" : "no"} />
            );
          }

          createRoot(document.getElementById("root")).render(<Harness />);
        `
      );
      await writeFile(
        tsconfigPath,
        JSON.stringify({ compilerOptions: { jsx: "react" } })
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
        const page = await browser.newPage();
        const browserErrors: string[] = [];
        page.on("pageerror", (error) =>
          browserErrors.push(error.stack ?? error.message)
        );
        page.on("console", (message) => {
          if (message.type() === "error") {
            browserErrors.push(message.text());
          }
        });
        await page.setContent(
          `<html><body><div id="root"></div></body></html>`
        );
        await page.addScriptTag({
          content: await readFile(bundlePath, "utf8"),
        });
        await page.waitForFunction(
          () =>
            document
              .querySelector("[data-owns-interaction]")
              ?.getAttribute("data-owns-interaction") === "yes"
        );
        await page.waitForTimeout(100);

        const renderCount = await page.evaluate(
          () => window.__worldInteractionRenderCount
        );
        assert.deepEqual(browserErrors, []);
        assert.ok(
          renderCount <= 4,
          `expected a bounded render count, received ${renderCount}`
        );
      } finally {
        await browser.close();
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

declare global {
  interface Window {
    __worldInteractionRenderCount: number;
  }
}
