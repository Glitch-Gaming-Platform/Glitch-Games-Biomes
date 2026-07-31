#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const assetRoot = path.join(root, "public/assets/harthmere");
const glbRoot = path.join(assetRoot, "glb/weapons");
const previewRoot = path.join(assetRoot, "weapon_previews");
const iconRoot = path.join(assetRoot, "weapon_icons");

const expectedIds = [
  "one_handed_axe",
  "two_handed_axe",
  "double_axe",
  "golden_double_axe",
  "small_axe",
  "golden_small_axe",
  "steel_dagger",
  "golden_dagger",
  "double_headed_hammer",
  "golden_double_headed_hammer",
  "iron_longsword",
  "two_handed_sword",
  "colored_two_handed_sword",
  "standard_sword",
  "golden_sword",
  "great_sword",
  "golden_great_sword",
  "hunter_bow",
  "golden_bow",
  "strung_bow",
  "one_handed_crossbow",
  "two_handed_crossbow",
  "steel_dart",
  "golden_dart",
  "arcane_staff",
  "arcane_wand",
  "arcane_spellbook_closed",
  "arcane_spellbook_open",
  "sealed_scroll",
  "crystal_focus",
  "star_focus",
  "snowflake_focus",
  "smoke_bomb",
  "photon_sidearm",
  "pulse_carbine",
  "helix_projector",
  "nova_cannon",
  "singularity_lance",
  "round_shield",
  "barbarian_round_shield",
  "spiked_shield",
  "square_shield",
  "badge_shield",
  "colored_round_shield",
  "colored_spiked_shield",
  "colored_square_shield",
  "colored_badge_shield",
];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function parseGlb(filePath) {
  const data = fs.readFileSync(filePath);
  assert.equal(data.toString("ascii", 0, 4), "glTF", `${filePath} GLB magic`);
  assert.equal(data.readUInt32LE(4), 2, `${filePath} GLB version`);
  assert.equal(
    data.readUInt32LE(8),
    data.length,
    `${filePath} GLB byte length`
  );
  const jsonLength = data.readUInt32LE(12);
  assert.equal(
    data.toString("ascii", 16, 20),
    "JSON",
    `${filePath} JSON chunk`
  );
  return JSON.parse(
    data
      .subarray(20, 20 + jsonLength)
      .toString("utf8")
      .replace(/\u0000/g, "")
  );
}

const manifestPath = path.join(glbRoot, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
assert.equal(manifest.version, "harthmere-premium-voxel-weapons-v1");
assert.equal(manifest.count, expectedIds.length);
assert.deepEqual(
  manifest.weapons.map(({ id }) => id).sort(),
  [...expectedIds].sort()
);
assert.equal(new Set(expectedIds).size, expectedIds.length);

for (const weapon of manifest.weapons) {
  const glbPath = path.join(glbRoot, `${weapon.id}.glb`);
  const previewPath = path.join(previewRoot, `${weapon.id}.png`);
  const iconPath = path.join(iconRoot, `${weapon.id}.png`);
  assert.ok(
    fs.statSync(glbPath).size >= 12000,
    `${weapon.id} GLB is substantial`
  );
  assert.ok(
    fs.statSync(previewPath).size >= 8000,
    `${weapon.id} preview is substantial`
  );
  assert.equal(
    fs.readFileSync(previewPath).toString("hex", 0, 8),
    "89504e470d0a1a0a",
    `${weapon.id} preview is PNG`
  );
  assert.ok(fs.statSync(iconPath).size >= 5000, `${weapon.id} icon rendered`);
  assert.equal(
    fs.readFileSync(iconPath).toString("hex", 0, 8),
    "89504e470d0a1a0a",
    `${weapon.id} icon is PNG`
  );
  assert.ok(weapon.triangleCount >= 300, `${weapon.id} has modeled geometry`);
  assert.ok(
    weapon.triangleCount <= (weapon.builder === "energy_weapon" ? 8000 : 5000),
    `${weapon.id} stays game-ready`
  );
  assert.ok(weapon.targetLength >= 0.5 && weapon.targetLength <= 2);
  assert.equal(
    weapon.assetUrl,
    `/assets/harthmere/glb/weapons/${weapon.id}.glb`
  );
  assert.equal(
    weapon.previewUrl,
    `/assets/harthmere/weapon_previews/${weapon.id}.png`
  );
  assert.equal(
    weapon.inventoryIconUrl,
    `/assets/harthmere/weapon_icons/${weapon.id}.png`
  );
  const gltf = parseGlb(glbPath);
  assert.ok(gltf.meshes?.length > 0, `${weapon.id} exports meshes`);
  assert.ok(gltf.materials?.length >= 2, `${weapon.id} uses layered materials`);
  assert.ok(
    gltf.animations?.some(({ name }) => name === weapon.idleClip),
    `${weapon.id} exports ${weapon.idleClip}`
  );
}

const contactSheet = path.join(previewRoot, "contact_sheet.png");
assert.ok(fs.statSync(contactSheet).size >= 100000, "contact sheet rendered");
const iconContactSheet = path.join(iconRoot, "contact_sheet.png");
assert.ok(
  fs.statSync(iconContactSheet).size >= 100000,
  "inventory icon contact sheet rendered"
);
const blend = path.join(
  root,
  "src/galois/data/weapons/harthmere_premium_weapons.blend"
);
assert.ok(fs.statSync(blend).size >= 300000, "master Blender project saved");

const catalogSource = read("src/shared/harthmere/premium_weapon_catalog.ts");
const energyCatalogSource = read(
  "src/shared/harthmere/energy_weapon_catalog.ts"
);
const nativeIdsSource = read(
  "src/shared/harthmere/harthmere_native_id_manifest.ts"
);
const nativeItemManifestSource = nativeIdsSource.slice(
  nativeIdsSource.indexOf("export const HARTHMERE_NATIVE_ITEM_ID_MANIFEST"),
  nativeIdsSource.indexOf("export const HARTHMERE_NATIVE_NPC_ID_MANIFEST")
);
const nativeRecipeManifestSource = nativeIdsSource.slice(
  nativeIdsSource.indexOf("export const HARTHMERE_NATIVE_RECIPE_ID_MANIFEST")
);
for (const id of expectedIds) {
  assert.ok(
    catalogSource.includes(`"${id}"`) ||
      energyCatalogSource.includes(`id: "${id}"`),
    `${id} exists in catalog`
  );
  assert.match(
    nativeItemManifestSource,
    new RegExp(`\\b${id}:\\s*id\\(`),
    `${id} has a stable native ID`
  );
  if (!["iron_longsword", "two_handed_sword", "hunter_bow"].includes(id)) {
    assert.doesNotMatch(
      nativeRecipeManifestSource,
      new RegExp(`\\b${id}:\\s*id\\(`),
      `${id} is not accidentally registered as a recipe`
    );
  }
}

const inventorySource = read(
  "src/client/components/challenges/LocalDevHarthmereInventorySystem.tsx"
);
assert.match(
  inventorySource,
  /for \(const weapon of HARTHMERE_PREMIUM_WEAPONS\)/
);
assert.match(inventorySource, /export function equipHarthmereHotbarItem/);
assert.match(inventorySource, /hotbarEligible: true/);
assert.match(inventorySource, /icon: weapon\.inventoryIconUrl/);

const vendorSource = read("src/shared/harthmere/harthmere_vendor_catalog.ts");
assert.equal(
  vendorSource.match(/\.\.\.HARTHMERE_PREMIUM_WEAPON_VENDOR_STOCK/g)?.length,
  2,
  "both general weapon vendors stock the non-restricted collection"
);
const storefrontSource = read(
  "src/shared/harthmere/harthmere_business_storefront_goods.ts"
);
for (const id of [
  "photon_sidearm",
  "pulse_carbine",
  "helix_projector",
  "nova_cannon",
  "singularity_lance",
]) {
  assert.ok(
    storefrontSource.includes("HARTHMERE_ENERGY_WEAPONS"),
    `${id} is routed through the security storefront energy catalog`
  );
}

const authoritySource = read("src/shared/harthmere/mmo_crafting_catalogue.ts");
assert.match(
  authoritySource,
  /for \(const weapon of HARTHMERE_PREMIUM_WEAPONS\)/
);
assert.match(authoritySource, /equipmentSlots: \[weapon\.slot\]/);

const rendererSource = read(
  "src/client/game/renderers/local_dev/harthmere_assets.ts"
);
assert.match(rendererSource, /getHarthmerePremiumWeapon\(itemId\)/);
assert.match(rendererSource, /assetUrl: premium\.assetUrl/);
assert.match(rendererSource, /targetLength: premium\.targetLength/);

const nativePresentationSource = read(
  "src/shared/harthmere/harthmere_native_bikkie_items.ts"
);
assert.match(
  nativePresentationSource,
  /premiumWeapon\?\.inventoryIconUrl \?\? generatedInventoryIcon/
);
assert.match(nativePresentationSource, /galoisIcon: inventoryIcon/);

const hotbarSource = read(
  "src/client/components/biomes_ui/adapters/useBiomesUILiveAdapters.ts"
);
assert.match(hotbarSource, /equipHarthmereHotbarItem\(localItemId\)/);
assert.match(hotbarSource, /HARTHMERE_HOTBAR_HELD_ITEM_EVENT/);

console.log(
  `Validated ${expectedIds.length} premium Blender weapons, previews, animations, registrations, vendor routes, hotbar wiring, and held-model integration.`
);
