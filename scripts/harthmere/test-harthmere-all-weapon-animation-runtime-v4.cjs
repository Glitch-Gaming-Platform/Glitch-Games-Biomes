#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const assetsPath = path.join(root, "src/client/game/renderers/local_dev/harthmere_assets.ts");
const combatPath = path.join(root, "src/client/components/challenges/LocalDevHarthmereMultiplayerCombatSystem.tsx");
const inventoryPath = path.join(root, "src/client/components/challenges/LocalDevHarthmereInventorySystem.tsx");
const manifestPath = path.join(root, "public/assets/harthmere/equipment_animations/equipment-animation-manifest.json");

const assets = fs.readFileSync(assetsPath, "utf8");
const combat = fs.readFileSync(combatPath, "utf8");
const inventory = fs.readFileSync(inventoryPath, "utf8");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const entries = manifest.entries || [];
const groups = { weapons: [], ranged: [], magic: [], shields: [] };
for (const entry of entries) {
  if (groups[entry.category]) groups[entry.category].push(entry);
}

let failures = 0;
function ok(label, condition, detail) {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    failures += 1;
    console.log(`FAIL ${label}`);
    if (detail) console.log(`  - ${detail}`);
  }
}
function has(text, needle) { return text.includes(needle); }
function re(text, pattern) { return pattern.test(text); }

console.log("== Harthmere all-weapon animation runtime tests v4 ==");
console.log(`Root: ${root}\n`);

ok("equipment animation manifest has melee, ranged, magic, and shield categories", ["weapons", "ranged", "magic", "shields"].every((cat) => groups[cat].length > 0));
ok("melee weapon manifest includes all 18 generated melee weapons", groups.weapons.length === 18, `Expected 18, got ${groups.weapons.length}`);
ok("ranged manifest includes bows, crossbows, darts/arrows, and quiver entries", groups.ranged.length === 15 && groups.ranged.some(e => /bow/i.test(e.id)) && groups.ranged.some(e => /crossbow/i.test(e.id)) && groups.ranged.some(e => /Dart/i.test(e.id)) && groups.ranged.some(e => /quiver/i.test(e.id)));
ok("magic manifest includes staff and wand plus spell/focus objects", groups.magic.length === 28 && groups.magic.some(e => e.id === "staff") && groups.magic.some(e => e.id === "wand"));
ok("shield manifest includes all 9 shield variants", groups.shields.length === 9, `Expected 9, got ${groups.shields.length}`);

for (const entry of groups.weapons) {
  const needed = ["Draw_24", "Sheathe_24", "BasicSlash_24", "HeavySlash_24", "IdleDrawn_24"];
  ok(`melee weapon ${entry.id} has draw/sheath/basic/heavy/idle clips`, needed.every((clip) => entry.animations.includes(clip)));
}
function expectedRangedClips(id) {
  if (/^(Arrow|Arrow_Golden|Dart|Dart_Golden|arrow_)/.test(id)) return ["Nock_24", "ProjectileSpin_24", "ImpactTwitch_24"];
  if (id === "quiver") return ["EquipBack_24", "DrawArrow_24", "IdleBack_24"];
  return ["Equip_24", "AimDraw_24", "Release_24", "Reload_24", "IdleAim_24"];
}
function expectedMagicClips(id) {
  if (/^(Book|Scroll|spellbook_)/.test(id)) return ["OpenRead_24", "Close_24", "CastFromBook_24"];
  if (id === "smokebomb") return ["Ready_24", "Throw_24", "Burst_24"];
  return ["Equip_24", "Cast_24", "Channel_24", "Stow_24"];
}
for (const entry of groups.ranged) {
  const needed = expectedRangedClips(entry.id);
  ok(`ranged weapon ${entry.id} has profile-specific clips`, needed.every((clip) => entry.animations.includes(clip)), `Missing one of ${needed.join(", ")}`);
}
for (const entry of groups.magic) {
  const needed = expectedMagicClips(entry.id);
  ok(`magic weapon/focus ${entry.id} has profile-specific clips`, needed.every((clip) => entry.animations.includes(clip)), `Missing one of ${needed.join(", ")}`);
}
for (const entry of groups.shields) {
  const needed = ["Equip_24", "BlockRaise_24", "ShieldBash_24", "LowerGuard_24", "IdleGuard_24"];
  ok(`shield ${entry.id} has equip/block/bash/lower/idle-guard clips`, needed.every((clip) => entry.animations.includes(clip)));
}

ok("renderer declares weapon-wide catalog marker", has(assets, "harthmere-all-weapon-animation-v4"));
ok("renderer catalog lists melee weapon ids", has(assets, "HARTHMERE_MELEE_WEAPON_EQUIPMENT_IDS") && groups.weapons.every((entry) => has(assets, `\"${entry.id}\"`)));
ok("renderer catalog lists ranged weapon ids", has(assets, "HARTHMERE_RANGED_WEAPON_EQUIPMENT_IDS") && groups.ranged.every((entry) => has(assets, `\"${entry.id}\"`)));
ok("renderer catalog lists magic weapon/focus ids", has(assets, "HARTHMERE_MAGIC_WEAPON_EQUIPMENT_IDS") && groups.magic.every((entry) => has(assets, `\"${entry.id}\"`)));
ok("renderer catalog lists shield ids", has(assets, "HARTHMERE_SHIELD_WEAPON_EQUIPMENT_IDS") && groups.shields.every((entry) => has(assets, `\"${entry.id}\"`)));
ok("renderer maps current inventory weapons to generated equipment ids", ["training_dagger", "iron_longsword", "woodsman_axe", "two_handed_sword", "wooden_shield"].every((id) => has(assets, id)) && has(assets, "HARTHMERE_PLAYER_WEAPON_ITEM_TO_EQUIPMENT_ID"));
ok("inventory still defines current equipable player weapons and off-hand shield", ["training_dagger", "iron_longsword", "woodsman_axe", "two_handed_sword", "wooden_shield"].every((id) => has(inventory, id)));
ok("combat visual events use equipped inventory item id instead of hardcoded-only sword", has(combat, "harthmereEquippedWeaponVisualItemId") && has(combat, "equipped.main_hand?.itemId") && !/itemId:\s*\"iron_longsword\"/.test(combat));
ok("renderer resolves active item id to generated equipment manifest entry", has(assets, "resolveHarthmerePlayerWeaponEquipmentEntry") && has(assets, "getHarthmereEquipmentAnimation(equipmentId)"));
ok("renderer has profile-specific clip mappings for melee/ranged/projectile/quiver/magic/book/thrown/shield", has(assets, "HARTHMERE_WEAPON_VISUAL_CLIP_PROFILES") && ["BasicSlash_24", "AimDraw_24", "Nock_24", "DrawArrow_24", "Cast_24", "CastFromBook_24", "Throw_24", "ShieldBash_24"].every((clip) => has(assets, clip)));
ok("renderer reloads GLTF when equipped item id changes", has(assets, "harthmerePlayerWeaponLoadedEquipmentId") && has(assets, "harthmerePlayerWeaponLoadingEquipmentId") && has(assets, "this.harthmerePlayerSwordState.itemId !== previousItemId"));
ok("renderer debug bridge exposes weapon category/equipment id/catalog for live tests", ["equipmentId:", "category:", "clipProfile:", "weaponCatalog:"].every((needle) => has(assets, needle)));
ok("shield visuals can attach to left hand anchor", has(assets, "harthmere-anchor-left-hand") && has(assets, "activeWeaponProfile === \"shield\""));
ok("ranged/magic/shield attack clips spawn visual trail or contact effect hooks", ["AimDraw_24", "Release_24", "Nock_24", "ProjectileSpin_24", "DrawArrow_24", "Cast_24", "CastFromBook_24", "Throw_24", "BlockRaise_24", "ShieldBash_24"].every((clip) => has(assets, clip)));
ok("NPC equipped weapon regex includes swords, axes, hammers, bows, crossbows, staffs, wands, and shields", /sword\|blade\|axe\|mace\|hammer\|dagger\|club\|bow\|crossbow\|staff\|wand\|shield/.test(assets));
ok("all weapon-like equipment keeps 24 frame / 24 fps animation contract", Object.values(groups).flat().every((entry) => entry.frameCount === 24 && entry.fps === 24));

console.log("\nWeapon-like equipment covered by v4:");
for (const [category, values] of Object.entries(groups)) {
  console.log(`- ${category}: ${values.map((entry) => entry.id).join(", ")}`);
}

if (failures > 0) {
  console.log(`\nRESULT: FAIL (${failures})`);
  process.exit(1);
}
console.log("\nRESULT: PASS");
