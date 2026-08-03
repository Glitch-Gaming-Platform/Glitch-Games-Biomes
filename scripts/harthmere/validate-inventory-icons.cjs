#!/usr/bin/env node

const assert = require("assert");
const crypto = require("crypto");
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
const generatorPath = path.join(
  repo,
  "scripts/harthmere/blender/generate_inventory_icons.py"
);

const NOTEBOOK_SEED_ORIGINAL_ICON_BY_ID = {
  7539420629350027: "seed_bellflower.2d48f20f4c2faa2751a20ecae0fc458e.png",
  4537020877769703: "seed_carrot.ec329b2023d8cd7e4fb7222a40b44bba.png",
  seed_carrot: "seed_carrot.ec329b2023d8cd7e4fb7222a40b44bba.png",
  1760645252542797: "seed_cotton.52b02f76cb25061b0ffd678713e06e23.png",
  7565606351305683: "seed_mysterious.0cd6b1136e45e769e4a337d928600c67.png",
  8772905953047597: "seed_potato.f5e7383e044bc52f0d96e7ee19b9efb9.png",
  4537020877769718: "seed_pumpkin.903e1fd0ba11f0ed7b5fba034a256b0b.png",
  7539420629350033: "seed_raspberry.e212d92111bfdc35135e49114ee2a6b7.png",
  4537020877769691: "seed_strawberry.9379596191ddaa486fa7cc52a79537d3.png",
  1534621126189364: "seed_wheat.834cd68d5620a63bf9b105d274264a0c.png",
  seed_wheat: "seed_wheat.834cd68d5620a63bf9b105d274264a0c.png",
};

function fileHash(file) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex");
}

async function main() {
  const payload = JSON.parse(fs.readFileSync(targetsPath, "utf8"));
  const manifest = fs.readFileSync(manifestPath, "utf8");
  const generator = fs.readFileSync(generatorPath, "utf8");
  const ids = new Set();
  const files = new Set();
  const imageHashes = new Map();

  const notebookSeedBlock = generator.match(
    /NOTEBOOK_SEED_IDS\s*=\s*\{([\s\S]*?)\n\}/
  );
  assert(notebookSeedBlock, "missing NOTEBOOK_SEED_IDS generator scope");
  const generatedNotebookSeedIds = [
    ...notebookSeedBlock[1].matchAll(/"([^"]+)"/g),
  ]
    .map((match) => match[1])
    .sort();
  assert.deepEqual(
    generatedNotebookSeedIds,
    Object.keys(NOTEBOOK_SEED_ORIGINAL_ICON_BY_ID).sort(),
    "only the legacy notebook-style seed icons may use the physical-seed generator"
  );
  assert(
    !generator.includes('"contact shadow"'),
    "inventory icons must not add a synthetic grounding shadow"
  );

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

    const imageHash = fileHash(file);
    const duplicate = imageHashes.get(imageHash);
    assert.equal(
      duplicate,
      undefined,
      `${target.id}: inventory image duplicates ${duplicate}`
    );
    imageHashes.set(imageHash, target.id);
  }

  for (const [itemId, originalFilename] of Object.entries(
    NOTEBOOK_SEED_ORIGINAL_ICON_BY_ID
  )) {
    const target = payload.targets.find((entry) => entry.id === itemId);
    assert(target, `missing notebook-style seed target: ${itemId}`);
    const originalFile = path.join(
      repo,
      "public/buckets/biomes-static/asset_data/icons/items",
      originalFilename
    );
    assert(
      fs.existsSync(originalFile),
      `missing original seed icon: ${itemId}`
    );
    assert.notEqual(
      fileHash(path.join(outputDir, target.file)),
      fileHash(originalFile),
      `${itemId}: notebook artwork was not replaced`
    );
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
        uniqueImages: imageHashes.size,
        notebookSeedsRedesigned: Object.keys(NOTEBOOK_SEED_ORIGINAL_ICON_BY_ID)
          .length,
        addedGroundShadows: false,
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
