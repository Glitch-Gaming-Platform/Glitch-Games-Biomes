#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const glbRoot = path.join(root, "public/assets/harthmere/glb/projectiles");
const previewRoot = path.join(
  root,
  "public/assets/harthmere/projectile_previews"
);
const expectedIds = [
  "hunter_bow_shot",
  "quick_shot",
  "aimed_shot",
  "multi_shot",
  "bandit_archer_shot",
  "ranged_shot",
  "spark",
  "fireball",
  "meteor",
  "lightning_bolt",
  "holy_light",
  "smite",
  "judgment",
  "consecrate",
  "life_drain",
  "entangling_roots",
  "indisworm_poison_spit",
  "mocking_verse",
  "curse_of_weakness",
  "hunters_mark",
  "polymorph",
  "fear",
  "charm",
  "hex_bolt",
  "thaedryn_resonance",
  "photon_sidearm_pulse",
  "pulse_carbine_burst",
  "helix_projector_beam",
  "nova_cannon_bolt",
  "singularity_lance_beam",
];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function parseGlb(filePath) {
  const data = fs.readFileSync(filePath);
  assert.equal(data.toString("ascii", 0, 4), "glTF", `${filePath} magic`);
  assert.equal(data.readUInt32LE(4), 2, `${filePath} version`);
  assert.equal(data.readUInt32LE(8), data.length, `${filePath} byte length`);
  const jsonLength = data.readUInt32LE(12);
  assert.equal(data.toString("ascii", 16, 20), "JSON", `${filePath} JSON`);
  return JSON.parse(
    data
      .subarray(20, 20 + jsonLength)
      .toString("utf8")
      .replace(/\u0000/g, "")
  );
}

const manifest = JSON.parse(
  fs.readFileSync(path.join(glbRoot, "manifest.json"), "utf8")
);
assert.equal(manifest.version, "harthmere-premium-projectiles-v2");
assert.equal(manifest.count, expectedIds.length);
assert.deepEqual(
  manifest.projectiles.map(({ id }) => id).sort(),
  [...expectedIds].sort()
);

for (const projectile of manifest.projectiles) {
  const glbPath = path.join(glbRoot, `${projectile.id}.glb`);
  const previewPath = path.join(previewRoot, `${projectile.id}.png`);
  assert.ok(fs.statSync(glbPath).size >= 12000, `${projectile.id} GLB`);
  assert.ok(fs.statSync(previewPath).size >= 8000, `${projectile.id} preview`);
  assert.ok(projectile.triangleCount >= 350, `${projectile.id} geometry`);
  assert.ok(projectile.triangleCount <= 12000, `${projectile.id} game budget`);
  assert.equal(projectile.flightClip, "FlightLoop_24");
  assert.equal(
    projectile.assetUrl,
    `/assets/harthmere/glb/projectiles/${projectile.id}.glb`
  );
  const gltf = parseGlb(glbPath);
  assert.ok(gltf.meshes?.length > 0, `${projectile.id} meshes`);
  assert.ok(gltf.materials?.length >= 2, `${projectile.id} layered materials`);
  assert.ok(
    gltf.animations?.some(({ name }) => name === "FlightLoop_24"),
    `${projectile.id} exact flight animation`
  );
}

assert.ok(
  fs.statSync(path.join(previewRoot, "contact_sheet.png")).size >= 100000,
  "contact sheet rendered"
);
assert.ok(
  fs.statSync(
    path.join(
      root,
      "src/galois/data/projectiles/harthmere_premium_projectiles.blend"
    )
  ).size >= 250000,
  "premium Blender master saved"
);
assert.equal(
  fs.existsSync(
    path.join(root, "src/galois/data/projectiles/harthmere_projectiles.blend")
  ),
  false,
  "rejected Blender master was deleted"
);
assert.equal(
  fs.existsSync(
    path.join(root, "scripts/harthmere/generate_harthmere_projectiles.py")
  ),
  false,
  "rejected generator was deleted"
);

const manifestSource = read(
  "src/shared/harthmere/projectile_visual_manifest.ts"
);
assert.match(manifestSource, /harthmere-premium-projectiles-v2/);
assert.match(
  manifestSource,
  /HARTHMERE_TERRAIN_MUTATING_PROJECTILE_VISUAL_IDS = \[\]/
);
for (const id of expectedIds) {
  assert.ok(manifestSource.includes(`id: "${id}"`), `${id} runtime registry`);
}

const runtimeSource = read(
  "src/client/game/renderers/local_dev/harthmere_projectiles.ts"
);
assert.match(runtimeSource, /premium-clean-room-v4-aaa-magic-impacts/);
assert.match(runtimeSource, /FlightLoop_24/);
assert.match(runtimeSource, /makePremiumImpact/);
assert.match(runtimeSource, /makeAaaMagicImpact/);
assert.match(runtimeSource, /kind: "debris"/);
assert.match(runtimeSource, /kind: "sparks"/);
assert.match(runtimeSource, /kind: "mist"/);
assert.match(runtimeSource, /kind: "dust"/);
assert.match(runtimeSource, /renderer\.magic_impact\.explosion/);
assert.match(runtimeSource, /magicExplosionCount/);
assert.match(runtimeSource, /impactPosition\.copy\(effect\.target\)/);
assert.match(runtimeSource, /projectile\.visualScale/);
assert.match(runtimeSource, /impactRadius: effect\.impactRadius/);

const bossMagicPresentationSource = read(
  "src/shared/harthmere/boss_magic_presentation.ts"
);
assert.match(
  bossMagicPresentationSource,
  /harthmere-boss-magic-presentation-v1/
);
assert.match(bossMagicPresentationSource, /horizontalBodySurfaceDistance/);
assert.match(bossMagicPresentationSource, /chargeVisualScale/);
assert.match(bossMagicPresentationSource, /projectileVisualScale/);

const magicImpactSource = read("src/shared/harthmere/magic_impact.ts");
assert.match(magicImpactSource, /harthmere-aaa-magic-impact-v1/);
assert.match(magicImpactSource, /HARTHMERE_MAGIC_IMPACT_MAX_DEBRIS/);
assert.match(magicImpactSource, /HARTHMERE_MAGIC_IMPACT_MAX_SPARKS/);
assert.match(magicImpactSource, /isHarthmereSuccessfulImpactResult/);

const nativeCombatSource = read(
  "src/shared/harthmere/harthmere_native_combat.ts"
);
assert.match(nativeCombatSource, /projectileVisualId/);
assert.match(nativeCombatSource, /harthmereNativeNpcProjectileVisualId/);

const animaClientSource = read("src/client/game/resources/npcs.ts");
assert.match(animaClientSource, /anima_native_attack_emote/);
assert.match(animaClientSource, /HARTHMERE_PROJECTILE_VISUAL_EVENT/);
assert.match(animaClientSource, /Socket_Mouth/);
assert.match(
  animaClientSource,
  /resources\.get\(\s*"\/ecs\/c\/npc_combat_state"/,
  "Anima projectile presentation must read the client-visible public combat projection"
);
assert.match(
  animaClientSource,
  /ranged_attack_projectile_visual_id/,
  "Anima projectile presentation must consume the sanitized ranged-cast projection rather than requiring server-only npc_state"
);

const nativeContactSource = read("src/client/game/interact/helpers.ts");
assert.match(nativeContactSource, /native_ecs_attack_contact/);
assert.match(nativeContactSource, /getHarthmereProjectileVisual/);

console.log(
  `Validated ${expectedIds.length} clean-room premium projectile GLBs, previews, animations, universal AAA magic impacts, native ECS contact wiring, and Anima attack presentation.`
);
