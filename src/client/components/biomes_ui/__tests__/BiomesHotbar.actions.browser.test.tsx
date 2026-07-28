import assert from "assert";
import { build } from "esbuild";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { chromium } from "playwright";

declare global {
  interface Window {
    __hotbarUses: number;
    __hotbarThrows: number;
  }
}

describe("BiomesHotbar rendered actions", () => {
  it("exposes touch/click primary and one-item throw actions with pending feedback", async function () {
    this.timeout(30_000);
    const tempDir = await mkdtemp(path.join(tmpdir(), "biomes-hotbar-"));
    const entryPath = path.join(tempDir, "entry.tsx");
    const bundlePath = path.join(tempDir, "bundle.js");
    const tsconfigPath = path.join(tempDir, "tsconfig.json");
    const componentPath = path
      .join(
        process.cwd(),
        "src/client/components/biomes_ui/hotbar/BiomesHotbar.tsx"
      )
      .replace(/\\/g, "/");

    await writeFile(
      entryPath,
      `
        import * as React from "react";
        import { createRoot } from "react-dom/client";
        import { BiomesHotbar } from "${componentPath}";

        window.__hotbarUses = 0;
        window.__hotbarThrows = 0;
        // Keep the pending state visible long enough to observe it reliably
        // when this browser test runs inside the larger client batch.
        const delay = () => new Promise((resolve) => window.setTimeout(resolve, 250));

        function Harness() {
          const [selectedIndex, setSelectedIndex] = React.useState(0);
          return (
            <BiomesHotbar
              slots={[
                { id: "muckwad", label: "Muckwad", icon: "■", count: 7, primaryActionLabel: "Place", canDrop: true },
                { id: "quest", label: "Protected Quest Item", icon: "!", count: 1, primaryActionLabel: "Use", canDrop: false },
                null, null, null, null, null, null, null,
              ]}
              selectedIndex={selectedIndex}
              onSelect={setSelectedIndex}
              onUse={async () => { await delay(); window.__hotbarUses += 1; }}
              onDrop={async () => { await delay(); window.__hotbarThrows += 1; }}
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
          paths: { "@/*": ["src/*"] },
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
      loader: { ".tsx": "tsx", ".ts": "ts" },
      tsconfig: tsconfigPath,
    });

    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.setContent("<html><body><div id='root'></div></body></html>");
      await page.addScriptTag({ content: await readFile(bundlePath, "utf8") });

      const place = page.getByRole("button", { name: "Place", exact: true });
      const throwOne = page.getByRole("button", {
        name: "Throw 1",
        exact: true,
      });
      assert.equal(await place.isVisible(), true);
      assert.equal(await throwOne.isVisible(), true);

      await page.keyboard.press("Space");
      assert.equal(await page.evaluate(() => window.__hotbarUses), 0);

      await place.click();
      assert.equal(
        await page.getByRole("button", { name: "Working…" }).isVisible(),
        true
      );
      await page.waitForFunction(() => window.__hotbarUses === 1);

      await throwOne.click();
      assert.equal(
        await page.getByRole("button", { name: "Throwing…" }).isVisible(),
        true
      );
      await page.waitForFunction(() => window.__hotbarThrows === 1);

      await page
        .getByRole("button", {
          name: "Slot 2: Protected Quest Item",
        })
        .click();
      assert.equal(
        await page.getByRole("button", { name: "Throw 1" }).count(),
        0
      );
      await page.getByRole("button", { name: "Cannot Throw" }).click();
      assert.equal(
        await page
          .getByRole("alert")
          .filter({ hasText: "protected and cannot be thrown" })
          .isVisible(),
        true
      );
    } finally {
      await browser.close();
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
