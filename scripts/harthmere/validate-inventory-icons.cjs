#!/usr/bin/env node

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const repo = path.resolve(__dirname, "../..");
const targetsPath = path.join(
  repo,
  "scripts/harthmere/blender/inventory_icon_targets.json"
);
const outputDir = path.join(
  repo,
  "public/assets/harthmere/inventory_icons/generated"
);
const manifestPath = path.join(
  repo,
  "src/shared/harthmere/generated/harthmere_inventory_icon_manifest.ts"
);

async function main() {
  const payload = JSON.parse(fs.readFileSync(targetsPath, "utf8"));
  const manifest = fs.readFileSync(manifestPath, "utf8");
  const ids = new Set();
  const files = new Set();

  assert.equal(payload.count, payload.targets.length);
  assert.equal(
    payload.targets.filter((x) => x.id.startsWith("quest_objective_item:"))
      .length,
    15
  );

  for (const target of payload.targets) {
    assert(!ids.has(target.id), `duplicate item id: ${target.id}`);
    assert(!files.has(target.file), `duplicate icon filename: ${target.file}`);
    assert(
      !payload.protectedIds.includes(target.id),
      `protected icon replaced: ${target.id}`
    );
    ids.add(target.id);
    files.add(target.file);

    const file = path.join(outputDir, target.file);
    assert(fs.existsSync(file), `missing rendered icon: ${target.file}`);
    assert(
      manifest.includes(
        `/assets/harthmere/inventory_icons/generated/${target.file}`
      ),
      `missing manifest route: ${target.id}`
    );
    const metadata = await sharp(file).metadata();
    assert.equal(metadata.width, 256, `${target.id}: width`);
    assert.equal(metadata.height, 256, `${target.id}: height`);
    assert.equal(metadata.hasAlpha, true, `${target.id}: transparent canvas`);
    const { channels } = await sharp(file).stats();
    const alpha = channels[3];
    assert(
      alpha && alpha.min === 0,
      `${target.id}: square background was not removed`
    );
    assert(alpha.max > 0, `${target.id}: icon is completely transparent`);
  }

  console.log(
    JSON.stringify(
      {
        icons: payload.targets.length,
        protectedIconsUntouched: payload.protectedIds.length,
        grantedObjectiveProofIcons: payload.targets.filter((x) =>
          x.id.startsWith("quest_objective_item:")
        ).length,
        dimensions: "256x256 RGBA",
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
