#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { loadTown, makeReporter } = require("./harthmere-town-rule-test-utils-v1.cjs");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const report = makeReporter("Harthmere animation asset / GLTF coverage tests v1", root);
const town = loadTown(root);

const harthmereRoot = path.join(root, "public/assets/harthmere");
const equipmentManifestPath = path.join(root, "src/shared/game/medieval/harthmereEquipmentAnimationManifest.generated.ts");
const actionObjectManifestPath = path.join(root, "src/shared/game/medieval/harthmereActionObjectAnimationManifest.generated.ts");
const animationCsvPath = path.join(root, "harthmere-animation-actions.csv");

function readIfExists(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function findFiles(dir, re, limit = 5000) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const stack = [dir];
  while (stack.length && out.length < limit) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (re.test(full)) out.push(full);
    }
  }
  return out.sort();
}

function isGitLfsPointer(file) {
  if (!fs.existsSync(file) || fs.statSync(file).size > 512) return false;
  const head = fs.readFileSync(file, "utf8").slice(0, 160);
  return head.startsWith("version https://git-lfs.github.com/spec/v1");
}

function readGlbJson(file) {
  const buffer = fs.readFileSync(file);
  if (buffer.length < 20 || buffer.toString("utf8", 0, 4) !== "glTF") {
    throw new Error("not a GLB file");
  }
  const jsonChunkLength = buffer.readUInt32LE(12);
  const jsonChunkType = buffer.toString("utf8", 16, 20);
  if (jsonChunkType !== "JSON") {
    throw new Error(`first GLB chunk is ${jsonChunkType}, not JSON`);
  }
  return JSON.parse(buffer.toString("utf8", 20, 20 + jsonChunkLength).trim());
}

function readAnimationNames(file) {
  if (isGitLfsPointer(file)) {
    return { pointer: true, names: [] };
  }
  const ext = path.extname(file).toLowerCase();
  const json = ext === ".glb" ? readGlbJson(file) : JSON.parse(fs.readFileSync(file, "utf8"));
  return {
    pointer: false,
    names: Array.isArray(json.animations)
      ? json.animations.map((animation, index) => String(animation.name ?? `animation_${index}`))
      : [],
  };
}

function hasFamily(names, family) {
  return names.some((name) => family.test(name));
}

const families = {
  idle: /(^|[_\s-])(idle|stand|idleheld)($|[_\s-])/i,
  walk: /walk|walking/i,
  run: /run|running|flee|trot|canter/i,
  jump: /jump|fall|falling|landing/i,
  attack: /attack|slash|swing|thrust|punch|strike|shoot|bite|claw|pounce|charge|peck|scratch|kick|tailwhip/i,
  block: /block|shieldblock|parry|guard/i,
  hit: /hit|hurt|damage|impact|react|stun|stunned/i,
  death: /death|die|dead|fall|falling|knock|defeat/i,
};

const usedLifeKeys = [...new Set(
  town.placements
    .filter((placement) => /^(townsperson_|animal_)/.test(placement.asset))
    .map((placement) => placement.asset)
)].sort();

report.check("town placements include animated life actors to test", usedLifeKeys.length > 0, "Expected townsperson_* or animal_* placements");

const usedLifeFiles = [];
const missingRegisteredAssets = [];
const missingRegisteredFiles = [];
for (const key of usedLifeKeys) {
  const asset = town.assets.get(key);
  if (!asset) {
    missingRegisteredAssets.push(key);
    continue;
  }
  const rel = String(asset.path).replace(/^\/assets\/harthmere\/?/, "");
  const full = path.join(harthmereRoot, rel);
  if (!fs.existsSync(full)) {
    missingRegisteredFiles.push(`${key} -> ${rel}`);
    continue;
  }
  if (/\.(gltf|glb)$/i.test(full)) {
    usedLifeFiles.push({ key, full });
  }
}

report.check("every used NPC/player life asset key is registered", missingRegisteredAssets.length === 0, missingRegisteredAssets);
report.check("every used NPC/player life GLTF/GLB exists on disk", missingRegisteredFiles.length === 0, missingRegisteredFiles);

const playerVariantFiles = findFiles(path.join(harthmereRoot, "gltf/characters/player_body_variants"), /\.(gltf|glb)$/i);
const animalVariantFiles = findFiles(path.join(harthmereRoot, "gltf/creatures/animal_action_variants"), /\.(gltf|glb)$/i);
const allActorFiles = new Map();
for (const { key, full } of usedLifeFiles) allActorFiles.set(full, `used placement ${key}`);
for (const full of playerVariantFiles) allActorFiles.set(full, "player body variant");
for (const full of animalVariantFiles) allActorFiles.set(full, "animal action variant");

report.check("player body animation variant files exist", playerVariantFiles.length > 0, "Expected public/assets/harthmere/gltf/characters/player_body_variants/*.gltf");
report.check("animal action animation variant files exist", animalVariantFiles.length > 0, "Expected public/assets/harthmere/gltf/creatures/animal_action_variants/*.gltf");

const lfsPointers = [];
const unreadable = [];
const missingFamilies = [];
const emptyAnimationFiles = [];
for (const [full, reason] of allActorFiles.entries()) {
  let result;
  try {
    result = readAnimationNames(full);
  } catch (error) {
    unreadable.push(`${path.relative(root, full)} (${reason}) ${error instanceof Error ? error.message : String(error)}`);
    continue;
  }
  if (result.pointer) {
    lfsPointers.push(`${path.relative(root, full)} (${reason})`);
    continue;
  }
  if (result.names.length === 0) {
    emptyAnimationFiles.push(`${path.relative(root, full)} (${reason})`);
    continue;
  }
  const missing = Object.entries(families)
    .filter(([, re]) => !hasFamily(result.names, re))
    .map(([family]) => family);
  if (missing.length > 0) {
    missingFamilies.push(`${path.relative(root, full)} missing ${missing.join(", ")} clips; has ${result.names.slice(0, 24).join(", ")}`);
  }
}

report.check("animated actor GLTF/GLB files are hydrated, not Git LFS pointer stubs", lfsPointers.length === 0, lfsPointers);
report.check("animated actor GLTF/GLB files are parseable", unreadable.length === 0, unreadable);
report.check("animated actor GLTF/GLB files contain animations", emptyAnimationFiles.length === 0, emptyAnimationFiles);
report.check("NPC/player actor files cover idle, walk, run, jump, attack, block, hit, and death clip families", missingFamilies.length === 0, missingFamilies);

const equipmentManifest = readIfExists(equipmentManifestPath);
const actionObjectManifest = readIfExists(actionObjectManifestPath);
const animationCsv = readIfExists(animationCsvPath);

report.check("equipment animation manifest exists", equipmentManifest.length > 0, equipmentManifestPath);
for (const clip of ["Draw_24", "Sheathe_24", "BasicSlash_24", "HeavySlash_24", "IdleDrawn_24"]) {
  report.check(`weapon equipment manifest includes ${clip}`, new RegExp(`\\"${clip}\\"`).test(equipmentManifest), `Missing ${clip}`);
}
for (const id of ["sword_1handed", "Sword", "Sword_Golden"]) {
  report.check(`player sword equipment id ${id} is present`, new RegExp(`\\"id\\":\\s*\\"${id}\\"`).test(equipmentManifest), `Missing equipment id ${id}`);
}
report.check("equipment animation manifest locks generated clips to 24 frames / 24 fps", /frameCount[\s\S]*24/.test(equipmentManifest) && /fps[\s\S]*24/.test(equipmentManifest), "Expected frameCount: 24 and fps: 24 metadata");

report.check("action-object animation manifest exists", actionObjectManifest.length > 0, actionObjectManifestPath);
for (const clip of ["Equip_24", "Use_24", "HeavyUse_24", "IdleHeld_24", "Stow_24"]) {
  report.check(`action-object manifest includes ${clip}`, new RegExp(`\\"${clip}\\"`).test(actionObjectManifest), `Missing ${clip}`);
}
report.check("action-object animation manifest locks generated clips to 24 frames / 24 fps", /frameCount[\s\S]*24/.test(actionObjectManifest) && /fps[\s\S]*24/.test(actionObjectManifest), "Expected frameCount: 24 and fps: 24 metadata");

report.check("animation action CSV exists for generated creature/player animation catalog", animationCsv.length > 0, animationCsvPath);
for (const clip of ["Idle", "Walk", "Walking", "Run", "Running", "Attack", "HeavyAttack", "Block", "ShieldBlock", "HitReact", "Death", "Jump"]) {
  report.check(`animation CSV includes ${clip}`, new RegExp(`(^|,)\\"?${clip}\\"?(\\r?$|,)`, "m").test(animationCsv), `Missing ${clip}`);
}

report.finish();
