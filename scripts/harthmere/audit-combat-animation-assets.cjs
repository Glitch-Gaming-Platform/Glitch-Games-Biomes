#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();

const assetRoots = [
  "public/assets/harthmere/gltf/creatures/animal_action_variants",
  "public/assets/harthmere/gltf/characters/player_body_variants",
];

const sourceFiles = [
  "src/client/components/challenges/LocalDevHarthmereCombat.tsx",
  "src/client/components/challenges/HarthmereUnifiedHUD.tsx",
  "src/client/game/renderers/local_dev/harthmere_assets.ts",
];

function readJsonChunkFromGlb(buffer) {
  if (buffer.length < 20 || buffer.toString("utf8", 0, 4) !== "glTF") {
    return undefined;
  }

  const version = buffer.readUInt32LE(4);
  if (version !== 2) {
    throw new Error(`Unsupported GLB version ${version}`);
  }

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    offset += 8;

    if (chunkType === 0x4e4f534a) {
      const jsonText = buffer
        .toString("utf8", offset, offset + chunkLength)
        .replace(/\u0000+$/g, "")
        .trim();
      return JSON.parse(jsonText);
    }

    offset += chunkLength;
  }

  return undefined;
}

function analyzeFile(file) {
  const buffer = fs.readFileSync(file);
  const head = buffer.subarray(0, Math.min(buffer.length, 256)).toString("utf8");

  if (head.startsWith("version https://git-lfs.github.com/spec/v1")) {
    return {
      format: "GIT_LFS_POINTER",
      animations: [],
      error: "This is a Git LFS pointer, not a real GLTF/GLB asset.",
    };
  }

  try {
    let json;
    let format;

    if (buffer.length >= 4 && buffer.toString("utf8", 0, 4) === "glTF") {
      json = readJsonChunkFromGlb(buffer);
      format = "GLB_BINARY";
    } else {
      json = JSON.parse(buffer.toString("utf8"));
      format = "GLTF_JSON";
    }

    const animations = Array.isArray(json?.animations)
      ? json.animations.map((animation, index) =>
          String(animation?.name || `animation_${index}`)
        )
      : [];

    return { format, animations };
  } catch (error) {
    return {
      format: "INVALID",
      animations: [],
      error: error.message,
    };
  }
}

function classifyAnimations(names) {
  const joined = names.join(" | ").toLowerCase();

  return {
    idle: /idle|stand/.test(joined),
    move: /walk|run|move|trot|crawl/.test(joined),
    attack: /attack|slash|swing|punch|bite|claw|cast|spell|shoot|strike/.test(joined),
    hit: /hit|hurt|damage|impact|react|flinch/.test(joined),
    death: /death|die|dead|fall|knock|defeat/.test(joined),
  };
}

function collectFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const out = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      out.push(...collectFiles(full));
    } else if (/\.(gltf|glb)$/i.test(entry.name)) {
      out.push(full);
    }
  }

  return out;
}

function scanSourceFile(rel, checks) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    console.log(`${rel}: MISSING`);
    return false;
  }

  const text = fs.readFileSync(full, "utf8");
  let ok = true;

  console.log(`${rel}: FOUND`);

  for (const check of checks) {
    const found = text.includes(check);
    console.log(`  ${found ? "OK" : "MISSING"} ${check}`);
    if (!found) {
      ok = false;
    }
  }

  return ok;
}

console.log("");
console.log("HARTHMERE COMBAT ANIMATION AUDIT");
console.log("================================");
console.log(`Root: ${root}`);
console.log("");

let total = 0;
let pointerCount = 0;
let invalidCount = 0;
let zeroAnimationCount = 0;
let missingAttack = 0;
let missingHit = 0;
let missingDeath = 0;

for (const relRoot of assetRoots) {
  const fullRoot = path.join(root, relRoot);
  const files = collectFiles(fullRoot).sort();

  console.log("");
  console.log(`ASSET DIRECTORY: ${relRoot}`);
  console.log("--------------------------------");

  if (!files.length) {
    console.log("NO GLTF/GLB FILES FOUND");
    continue;
  }

  for (const file of files) {
    total += 1;

    const rel = path.relative(root, file);
    const result = analyzeFile(file);
    const flags = classifyAnimations(result.animations);

    if (result.format === "GIT_LFS_POINTER") pointerCount += 1;
    if (result.format === "INVALID") invalidCount += 1;
    if (result.animations.length === 0) zeroAnimationCount += 1;
    if (!flags.attack) missingAttack += 1;
    if (!flags.hit) missingHit += 1;
    if (!flags.death) missingDeath += 1;

    const categories =
      Object.entries(flags)
        .filter(([, value]) => value)
        .map(([key]) => key)
        .join(", ") || "none";

    console.log("");
    console.log(rel);
    console.log(`  format: ${result.format}`);
    console.log(`  animationCount: ${result.animations.length}`);
    console.log(`  detectedCategories: ${categories}`);
    console.log(`  clips: ${result.animations.join(" | ") || "none"}`);

    if (result.error) {
      console.log(`  error: ${result.error}`);
    }
  }
}

console.log("");
console.log("SOURCE WIRING CHECK");
console.log("===================");

let sourceOk = true;

sourceOk =
  scanSourceFile("src/client/components/challenges/LocalDevHarthmereCombat.tsx", [
    "HARTHMERE_COMBAT_EFFECT_EVENT",
    "performHarthmereCombatAttack",
    "tickHarthmereRealtimeCombatAI",
    "applyAttack",
  ]) && sourceOk;

sourceOk =
  scanSourceFile("src/client/components/challenges/HarthmereUnifiedHUD.tsx", [
    "useHarthmereRealtimeCombatAI",
    "useHarthmereCombatHotkeys",
  ]) && sourceOk;

sourceOk =
  scanSourceFile("src/client/game/renderers/local_dev/harthmere_assets.ts", [
    "AnimationMixer",
    "registerCombatLife",
    "onCombatEffect",
    "startCombatPulse",
    "bestCombatClip",
  ]) && sourceOk;

console.log("");
console.log("SUMMARY");
console.log("=======");
console.log(`assetFiles: ${total}`);
console.log(`gitLfsPointerFiles: ${pointerCount}`);
console.log(`invalidFiles: ${invalidCount}`);
console.log(`zeroAnimationFiles: ${zeroAnimationCount}`);
console.log(`filesMissingAttackNamedClip: ${missingAttack}`);
console.log(`filesMissingHitNamedClip: ${missingHit}`);
console.log(`filesMissingDeathNamedClip: ${missingDeath}`);
console.log(`sourceWiringLooksComplete: ${sourceOk ? "yes" : "no"}`);

console.log("");

if (pointerCount > 0) {
  console.log("RESULT: FAIL");
  console.log("Some GLTF files are Git LFS pointer files. Real animation playback cannot work until those are replaced with real assets.");
  process.exit(2);
}

if (invalidCount > 0) {
  console.log("RESULT: FAIL");
  console.log("Some GLTF/GLB files are invalid or unreadable.");
  process.exit(2);
}

if (zeroAnimationCount > 0 || missingAttack > 0 || missingHit > 0 || missingDeath > 0) {
  console.log("RESULT: PARTIAL");
  console.log("The files are loadable, but some do not expose clearly named attack/hit/death animations.");
  console.log("This means the code needs either a clip-name mapping table or procedural fallback motion.");
  process.exit(1);
}

if (!sourceOk) {
  console.log("RESULT: PARTIAL");
  console.log("The assets look usable, but source wiring is incomplete.");
  process.exit(1);
}

console.log("RESULT: PASS");
console.log("The assets are real, animated, and the expected combat/rendering hooks are present.");
