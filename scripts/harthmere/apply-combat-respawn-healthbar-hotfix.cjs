#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const ROOT = process.cwd();
const LIVE_ENTITY_FIRST_OFFSET = 9451;
const LIVE_ENTITY_LAST_OFFSET = 9574;
const LIVE_ENTITY_BASE = 8810000000010000;

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function write(rel, text) {
  fs.writeFileSync(path.join(ROOT, rel), text, "utf8");
}

function patchLiteral(rel, search, replace, label, expectedCount) {
  const before = read(rel);
  const count = before.split(search).length - 1;
  if (count === 0) {
    if (before.includes(replace) || before.includes(label)) {
      return { rel, label, changed: false, count: 0, alreadyPatched: true };
    }
    throw new Error(`missing patch anchor ${label} in ${rel}`);
  }
  if (expectedCount !== undefined && count !== expectedCount) {
    throw new Error(
      `unexpected patch count ${label} in ${rel}: expected ${expectedCount}, got ${count}`
    );
  }
  write(rel, before.split(search).join(replace));
  return { rel, label, changed: true, count };
}

function walk(dir, out = []) {
  if (!fs.existsSync(path.join(ROOT, dir))) return out;
  for (const entry of fs.readdirSync(path.join(ROOT, dir), {
    withFileTypes: true,
  })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(rel, out);
    } else if (entry.isFile()) {
      out.push(rel);
    }
  }
  return out;
}

function patchLiveEntitySeedHelpers() {
  const rel = "src/shared/harthmere/live_entity_production_seed.ts";
  let text = read(rel);
  const results = [];
  if (!text.includes("HARTHMERE_LIVE_ENTITY_MUCK_HEX_STRENGTH_MULTIPLIER")) {
    text = text.replace(
      `export const HARTHMERE_LIVE_ENTITY_PRODUCTION_SEED_VERSION =\n  "harthmere-live-entity-production-seed" as const;\n`,
      `export const HARTHMERE_LIVE_ENTITY_PRODUCTION_SEED_VERSION =\n  "harthmere-live-entity-production-seed" as const;\nexport const HARTHMERE_LIVE_ENTITY_MUCK_HEX_STRENGTH_MULTIPLIER = 5;\n`
    );
    results.push("strength-constant");
  }
  if (!text.includes("function harthmereCombatHpForLiveEntitySeed")) {
    text = text.replace(
      `// HARTHMERE_LIVE_ENTITY_SIZE:`,
      `export function harthmereCombatHpForLiveEntitySeed(\n  seed: HarthmereLiveEntityProductionSeed\n): number {\n  const defaultHp = seed.kind === "ambient_muck_monster" ? 110 : 40;\n  const baseHp = Math.max(1, Math.trunc(seed.combatHp ?? defaultHp));\n  if (seed.kind === "ambient_muck_monster") {\n    return Math.max(\n      1,\n      Math.trunc(baseHp * HARTHMERE_LIVE_ENTITY_MUCK_HEX_STRENGTH_MULTIPLIER)\n    );\n  }\n  return baseHp;\n}\n\nexport function harthmereCombatAttackDamageForLiveEntitySeed(\n  seed: HarthmereLiveEntityProductionSeed\n): number | undefined {\n  if (seed.kind !== "ambient_muck_monster") {\n    return seed.attackDamage;\n  }\n  const entityKind = seed.combatKind ?? "mux";\n  const level = Math.max(1, Math.trunc(Number(seed.combatLevel ?? 1)));\n  const base =\n    entityKind === "hex" ? (level >= 4 ? 24 : 18) : level >= 3 ? 16 : 14;\n  return Math.max(\n    1,\n    Math.trunc(base * HARTHMERE_LIVE_ENTITY_MUCK_HEX_STRENGTH_MULTIPLIER)\n  );\n}\n\n// HARTHMERE_LIVE_ENTITY_SIZE:`
    );
    results.push("hp-damage-helpers");
  }
  if (results.length) {
    write(rel, text);
  }
  return { rel, changed: results.length > 0, patches: results };
}

function patchLiveEntityEcsSeedSource() {
  const rel = "src/server/harthmere/live_entity_ecs_seed.ts";
  const results = [];
  let text = read(rel);
  if (!text.includes("  Health,\n  RobotComponent,")) {
    text = text.replace(
      `  EntityDescription,\n  RobotComponent,`,
      `  EntityDescription,\n  Health,\n  RobotComponent,`
    );
    results.push("health-import");
  }
  if (!text.includes("harthmereCombatHpForLiveEntitySeed")) {
    text = text.replace(
      `  HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS,\n  harthmereActiveLiveEntityProductionSeedIds,\n`,
      `  HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS,\n  harthmereActiveLiveEntityProductionSeedIds,\n  harthmereCombatHpForLiveEntitySeed,\n`
    );
    results.push("hp-helper-import");
  }
  const anchor =
    `    delete (base as { default_dialog?: unknown }).default_dialog;\n` +
    `    const entity = {\n` +
    `      ...base,\n`;
  const replacement =
    `    delete (base as { default_dialog?: unknown }).default_dialog;\n` +
    `    const combatHp = harthmereCombatHpForLiveEntitySeed(seed);\n` +
    `    const entity = {\n` +
    `      ...base,\n` +
    `      health: Health.create({ hp: combatHp, maxHp: combatHp }),\n`;
  const count = text.split(anchor).length - 1;
  if (count > 0) {
    if (count !== 2) {
      throw new Error(`expected two ECS entity anchors, got ${count}`);
    }
    text = text.split(anchor).join(replacement);
    results.push("entity-health");
  } else if (!text.includes("health: Health.create({ hp: combatHp, maxHp: combatHp })")) {
    throw new Error("missing ECS health anchor and health field");
  }
  if (results.length) {
    write(rel, text);
  }
  return { rel, changed: results.length > 0, patches: results };
}

function patchCompiledNpcHealthGuard() {
  const files = ["dist/logic.js", "dist/sync.js"].filter((rel) =>
    fs.existsSync(path.join(ROOT, rel))
  );
  const guard =
    `        if (event.damageSource?.kind === "attack") {\n` +
    `            const hotfixEntityId = Number(event.id);\n` +
    `            const hotfixOffset = hotfixEntityId >= ${LIVE_ENTITY_BASE + LIVE_ENTITY_FIRST_OFFSET} && hotfixEntityId <= ${LIVE_ENTITY_BASE + LIVE_ENTITY_LAST_OFFSET} ? hotfixEntityId - ${LIVE_ENTITY_BASE} : hotfixEntityId;\n` +
    `            if (hotfixOffset >= ${LIVE_ENTITY_FIRST_OFFSET} && hotfixOffset <= ${LIVE_ENTITY_LAST_OFFSET}) {\n` +
    `                return;\n` +
    `            }\n` +
    `        }\n`;
  const anchor =
    `        if (npc.health().hp <= 0) {\n` +
    `            // Health updates have no effect on dead NPCs.\n` +
    `            return;\n` +
    `        }\n`;
  return files.map((rel) => {
    const before = read(rel);
    if (before.includes("hotfixEntityId >= 8810000000019451")) {
      return { rel, changed: false, alreadyPatched: true };
    }
    if (!before.includes(anchor)) {
      throw new Error(`missing NPC health guard anchor in ${rel}`);
    }
    write(rel, before.replace(anchor, `${anchor}${guard}`));
    return { rel, changed: true };
  });
}

function patchHealthBarRowCap() {
  const candidates = [
    ...walk(".next/server/chunks"),
    ...walk(".next/server/pages"),
    ...walk(".next/static/chunks"),
  ].filter((rel) => rel.endsWith(".js"));
  const results = [];
  const regex =
    /(\]\.sort\(\(a, b\)=>\{\s*if \(a\.selected\) return -1;\s*if \(b\.selected\) return 1;\s*return a\.depth - b\.depth;\s*\}\))\.slice\(0,\s*24\)/g;
  for (const rel of candidates) {
    const before = read(rel);
    if (
      !before.includes("actorRows") &&
      !before.includes("__harthmereLiveEntityCombatHealth")
    ) {
      continue;
    }
    let count = 0;
    const after = before.replace(regex, (_, sortExpr) => {
      count += 1;
      return sortExpr;
    });
    if (count > 0) {
      write(rel, after);
      results.push({ rel, changed: true, count });
    }
  }
  if (results.length === 0) {
    const alreadyPatched = candidates.some((rel) => {
      const text = read(rel);
      return text.includes("actorRows") && !regex.test(text);
    });
    if (!alreadyPatched) {
      throw new Error("health-bar row cap patch did not find a target");
    }
  }
  return results;
}

function runReconcile() {
  const command =
    "APPLY=1 HARTHMERE_WORLD_SYNC_SEED_UPSERT_MODE=all node scripts/harthmere/reconcile-production-world-sync.cjs";
  const output = cp.execSync(command, {
    cwd: ROOT,
    env: { ...process.env, IS_SERVER: "1" },
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return { command, output };
}

async function probeLiveEntityHealth() {
  require("ts-node/register/transpile-only");
  require("tsconfig-paths/register");
  process.env.IS_SERVER = process.env.IS_SERVER || "1";
  const { Redis } = require("ioredis");
  const {
    harthmereGroundedMuckMonsterSeedsInTerritory,
    harthmereGroundedLivestockSeedsInTerritory,
    harthmereCombatHpForLiveEntitySeed,
  } = require("../../src/shared/harthmere/live_entity_production_seed");
  const {
    deserializeRedisEntityState,
  } = require("../../src/server/shared/world/lua/serde");
  const host =
    process.env.REDIS_HOST ||
    process.env.GLITCH_REDIS_HOST ||
    process.env.LOCAL_REDIS_HOST ||
    "127.0.0.1";
  const port = Number(
    process.env.REDIS_PORT || process.env.GLITCH_REDIS_PORT || "6379"
  );
  const redis = new Redis({ host, port, lazyConnect: true });
  await redis.connect();
  const seeds = [
    ...harthmereGroundedMuckMonsterSeedsInTerritory(),
    ...harthmereGroundedLivestockSeedsInTerritory(),
  ];
  const summary = {
    total: seeds.length,
    present: 0,
    expectedHp: 0,
    badHp: [],
    zeroOrDead: [],
  };
  try {
    for (const seed of seeds) {
      const raw = await redis.getBuffer(`b:${Number(seed.entityId)}`);
      if (!raw) continue;
      summary.present += 1;
      let entity;
      try {
        [, entity] = deserializeRedisEntityState(Number(seed.entityId), raw);
      } catch {
        continue;
      }
      const expected = harthmereCombatHpForLiveEntitySeed(seed);
      const health = entity.health?.();
      const hp = Number(health?.hp ?? 0);
      const maxHp = Number(health?.maxHp ?? 0);
      if (hp === expected && maxHp === expected) {
        summary.expectedHp += 1;
      } else {
        summary.badHp.push({ id: Number(seed.entityId), expected, hp, maxHp });
      }
      if (hp <= 0) {
        summary.zeroOrDead.push({ id: Number(seed.entityId), hp, maxHp });
      }
    }
  } finally {
    redis.disconnect();
  }
  return summary;
}

async function main() {
  const results = {
    seedHelpers: patchLiveEntitySeedHelpers(),
    ecsSeedSource: patchLiveEntityEcsSeedSource(),
    npcHealthGuard: patchCompiledNpcHealthGuard(),
    healthBars: patchHealthBarRowCap(),
  };
  results.reconcile = runReconcile();
  results.healthProbe = await probeLiveEntityHealth();
  console.log(JSON.stringify({ ok: true, results }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
