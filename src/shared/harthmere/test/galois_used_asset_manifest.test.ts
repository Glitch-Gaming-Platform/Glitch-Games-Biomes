import assert from "assert";
import fs from "fs";
import path from "path";
import { HARTHMERE_PREMIUM_WEAPONS } from "@/shared/harthmere/premium_weapon_catalog";

type UsedAssetEntry = {
  logicalPath: string;
  sourcePath: string;
  kind: "glb" | "gltf" | "obj" | "fbx" | "image";
  convertedPath?: string;
  usedBy: string[];
};

const root = process.cwd();
const dataRoot = path.join(root, "src/galois/data");
const manifest = JSON.parse(
  fs.readFileSync(
    path.join(dataRoot, "harthmere/used_assets.generated.json"),
    "utf8"
  )
) as { entries: UsedAssetEntry[] };
const assetVersions = JSON.parse(
  fs.readFileSync(
    path.join(root, "src/galois/js/interface/gen/asset_versions.json"),
    "utf8"
  )
) as { paths: Record<string, string> };

describe("used Harthmere Galois assets", () => {
  it("contains only unique, attributable, existing source files", () => {
    const logicalPaths = new Set<string>();
    for (const entry of manifest.entries) {
      assert.ok(!logicalPaths.has(entry.logicalPath), entry.logicalPath);
      logicalPaths.add(entry.logicalPath);
      assert.ok(entry.usedBy.length > 0, entry.logicalPath);
      assert.ok(
        fs.existsSync(path.resolve(dataRoot, entry.sourcePath)),
        entry.sourcePath
      );
      if (entry.kind === "obj" || entry.kind === "fbx") {
        assert.ok(entry.convertedPath, entry.logicalPath);
        assert.ok(
          fs.existsSync(path.resolve(dataRoot, entry.convertedPath!)),
          entry.convertedPath
        );
      }
    }
  });

  it("publishes every used asset into the local static bucket", () => {
    for (const entry of manifest.entries) {
      const publicPath = assetVersions.paths[entry.logicalPath];
      assert.ok(publicPath, `missing index entry: ${entry.logicalPath}`);
      assert.ok(
        fs.existsSync(
          path.join(root, "public/buckets/biomes-static", publicPath)
        ),
        `missing local export: ${entry.logicalPath}`
      );
    }
  });

  it("includes every reachable premium weapon icon without the unused contact sheet", () => {
    const logicalPaths = new Set(
      manifest.entries.map((entry) => entry.logicalPath)
    );
    for (const weapon of HARTHMERE_PREMIUM_WEAPONS) {
      assert.ok(
        logicalPaths.has(`harthmere/weapon_icons/${weapon.id}.png`),
        weapon.id
      );
    }
    assert.ok(!logicalPaths.has("harthmere/weapon_icons/contact_sheet.png"));
  });
});
