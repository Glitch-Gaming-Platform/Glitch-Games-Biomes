import { readFileSync } from "fs";
import path from "path";
import assert from "assert";
import { createHash } from "crypto";

interface AnimationDocument {
  animations: Array<{
    name: string;
    extras?: Record<string, unknown>;
  }>;
}

function readGlbJson(buffer: Buffer): AnimationDocument {
  assert.equal(buffer.toString("utf8", 0, 4), "glTF");
  assert.equal(buffer.readUInt32LE(4), 2);
  const jsonLength = buffer.readUInt32LE(12);
  return JSON.parse(
    buffer
      .toString("utf8", 20, 20 + jsonLength)
      .replace(/\u0000+$/g, "")
      .trim()
  ) as AnimationDocument;
}

describe("published Harthmere ranged body animations", () => {
  it("keeps melee and expression clips while publishing the 0.280s bow release", () => {
    const versions = JSON.parse(
      readFileSync(
        path.join(
          process.cwd(),
          "src/galois/js/interface/gen/asset_versions.json"
        ),
        "utf8"
      )
    ) as { paths: Record<string, string> };
    const publishedRelativePath = versions.paths["wearables/animations"];
    const publishedPath = path.join(
      process.cwd(),
      "public/buckets/biomes-static",
      publishedRelativePath
    );
    const publishedBytes = readFileSync(publishedPath);
    const glb = readGlbJson(publishedBytes);
    const expectedHash = path.basename(publishedPath).split(".")[1];

    assert.equal(
      createHash("md5").update(publishedBytes).digest("hex"),
      expectedHash,
      "the runtime index must name the byte-exact published animation artifact"
    );

    const byName = new Map(glb.animations.map((clip) => [clip.name, clip]));
    const release = byName.get("HarthmereBodyRangedRelease_Aligned_30");

    assert.equal(release?.extras?.impactSeconds, 0.28);
    assert.equal(release?.extras?.durationSeconds, 0.5);
    assert.equal(release?.extras?.upperBodyAdditive, true);
    assert.equal(release?.extras?.locomotionCompatible, true);
    assert.ok(byName.has("HarthmereBodyRangedDraw_Aligned_30"));
    assert.ok(byName.has("HarthmereBodyRangedReload_Aligned_30"));
    assert.ok(byName.has("HarthmereBodyWeaponBasic_Variation1_24"));
    assert.ok(byName.has("HarthmereBodyWeaponHeavy_Variation4_24"));
    assert.ok(
      glb.animations.filter(({ name }) => name.startsWith("Cinematic"))
        .length >= 70,
      "publishing ranged combat must preserve the expression library"
    );
  });

  it("publishes synchronized ranged timings to every player body variant", () => {
    const variantsRoot = path.join(
      process.cwd(),
      "public/assets/harthmere/gltf/characters/player_body_variants"
    );
    const sample = JSON.parse(
      readFileSync(
        path.join(variantsRoot, "harthmere_player_broad_royal.gltf"),
        "utf8"
      )
    ) as {
      animations: Array<{
        name: string;
        extras?: { durationSeconds?: number; timing?: { impactMs?: number } };
      }>;
    };
    const release = sample.animations.find(
      ({ name }) => name === "HarthmereBodyRangedRelease_Aligned_30"
    );
    assert.equal(release?.extras?.durationSeconds, 0.5);
    assert.equal(release?.extras?.timing?.impactMs, 280);
  });
});
