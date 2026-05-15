#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}
function ok(condition, label) {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    console.error(`FAIL ${label}`);
    failed = true;
  }
}
let failed = false;

const shared = read("src/shared/harthmere/voxel_faces.ts");
const player = read("src/client/game/resources/player_mesh.ts");
const npcs = read("src/client/game/resources/npcs.ts");
const runtime = read("src/client/game/renderers/local_dev/harthmere_assets.ts");

ok(/HARTHMERE_BODY_VERSION\s*=\s*2/.test(shared), "shared has body schema version v2");
ok(/HARTHMERE_APPEARANCE_VERSION\s*=\s*1/.test(shared), "shared has appearance schema version");
ok(/type HarthmereCharacterAppearance\s*=/.test(shared), "shared exports unified appearance type");
ok(/HarthmereCharacterAttachmentAnchors/.test(shared), "shared defines attachment anchor schema");
ok(/HARTHMERE_DEFAULT_HUMAN_ANCHORS/.test(shared), "shared defines default human anchors");
ok(/playerBody\.v2\.user/.test(shared), "player body storage key uses v2");
ok(/PLAYER_BODY_LEGACY_KEY_PREFIXES[\s\S]*playerBody\.v1\.user/.test(shared), "player body v1 migration remains supported");
ok(/parseHarthmereAppearanceMarker/.test(shared), "shared parses appearance marker");
ok(/withHarthmereAppearanceMarker/.test(shared), "shared writes appearance marker");
ok(/loadHarthmerePlayerAppearanceConfig/.test(shared), "shared loads player appearance object");
ok(/defaultHarthmereEquipmentForRole\("player"/.test(shared), "player appearance includes default equipment");

ok(/loadHarthmerePlayerAppearanceConfig/.test(player), "player mesh imports/uses appearance loader");
ok(/`bs:\$\{face\.browStyle\}`/.test(player), "player mesh cache key includes brow style");
ok(/`apv:\$\{appearance\.version\}`/.test(player), "player mesh cache key includes appearance version");
ok(/userData\.harthmereAppearance/.test(player), "player mesh stores appearance on root userData");
ok(/harthmereVariantHeadAnchor[\s\S]*HARTHMERE_DEFAULT_HUMAN_ANCHORS/.test(player), "player mesh resolves standardized anchors");
ok(/attaching to an invisible Head parent would hide the custom face/.test(player), "player anchor logic has future-dev comment");

ok(/parseHarthmereAppearanceMarker/.test(npcs), "ECS NPC renderer reads appearance marker");
ok(/normalizeHarthmereCharacterAppearance/.test(npcs), "ECS NPC renderer normalizes legacy/new appearance");
ok(/root\.userData\.harthmereAppearance/.test(npcs), "ECS NPC renderer stores appearance on root");
ok(/addLocalDevVoxelNpcAnchors/.test(npcs), "ECS NPC renderer creates attachment anchors");
ok(/Older saved NPC descriptions may only have face\/body markers/.test(npcs), "ECS NPC legacy marker behavior is commented");

ok(/makeHarthmereNpcAppearanceConfig/.test(runtime), "runtime renderer imports appearance generator");
ok(/appearance\?: HarthmereCharacterAppearance/.test(runtime), "runtime placements can carry appearance");
ok(/type HarthmereModelForwardAxis = HarthmereForwardAxis/.test(runtime), "runtime forward axis uses shared type");
ok(/harthmereRuntimeAppearanceForPlacement/.test(runtime), "runtime derives appearance for placements");
ok(/applyHarthmereRuntimeAppearanceToHumanObject/.test(runtime), "runtime applies appearance to GLTF townspeople");
ok(/createHarthmereRuntimeVoxelHead/.test(runtime), "runtime creates unified voxel heads");
ok(/addHarthmereRuntimeHumanAnchors/.test(runtime), "runtime creates standardized human anchors");
ok(/appearanceRole/.test(runtime) && /appearanceSpecies/.test(runtime), "runtime combat snapshot exposes appearance metadata");
ok(/same appearance schema/.test(runtime), "runtime code has explanatory comments");
ok(/isProceduralTownspersonKey\(placement\.asset\)[\s\S]*applyHarthmereRuntimeAppearanceToHumanObject/.test(runtime), "runtime applies appearance during GLTF clone load");

if (failed) {
  console.error("\nRESULT: FAIL");
  process.exit(1);
}
console.log("\nRESULT: PASS");
