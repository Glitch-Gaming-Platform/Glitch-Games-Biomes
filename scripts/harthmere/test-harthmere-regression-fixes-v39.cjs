#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
let failures = 0;
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}
function check(label, condition) {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL ${label}`);
  }
}

console.log("== Harthmere v39 regression fixes ==");
console.log(`Root: ${root}`);
console.log("");

const assets = read("src/client/game/renderers/local_dev/harthmere_assets.ts");
const spawnMain = read("src/server/spawn/main.ts");
const spawnService = read("src/server/spawn/spawn_service.ts");
const meander = read("src/shared/npc/behavior/meander.ts");
const modifyHealth = read("src/shared/npc/modify_health.ts");
const serde = read("src/shared/npc/serde.ts");

check(
  "decorative banner predicate keeps explicit large-flag exception before solid-fixture helper",
  /name\.includes\("banner"\) && !\/\^obj_flag_large_\/i\.test\(asset\) && !isHarthmereSolidBannerOrFlagFixture\(asset, name\)/.test(assets)
);
check(
  "watch/north gate banners can still be authored solid fixtures",
  /function isHarthmereSolidBannerOrFlagFixture/.test(assets) && /north gate banner/.test(assets) && /watch banner/.test(assets)
);
check(
  "spawn resources explicitly include physics boxes resource paths",
  /PhysicsResourcePaths/.test(spawnMain) && /IndexedEcsResourcePaths &\n  PhysicsResourcePaths/.test(spawnMain)
);
check(
  "spawn-service physics box index uses ShardId instead of any/missing resource path",
  /import type \{ ShardId \} from "@\/shared\/game\/shard";/.test(spawnService) && /const terrainBoxes = \(id: ShardId\) => this\.resources\.get\("\/physics\/boxes", id\);/.test(spawnService)
);
check(
  "meander safe-zone branch returns a strict boolean",
  /Boolean\(\n\s*behavior\.chaseAttack &&\n\s*isSafeZone\(/.test(meander)
);
check(
  "NPC death velocity reset uses generated setRigidBody API",
  /npc\.setRigidBody\(\{ velocity: \[0, 0, 0\] \}\);/.test(modifyHealth) && !/mutableRigidBody\(\)/.test(modifyHealth)
);
check(
  "NPC serde avoids excessive Zod type-depth inference after v37 state additions",
  ((/export const zDeserializedNpcState: z\.ZodTypeAny = z/.test(serde)) || (/const zNpcStateBaseV40: any = z\.object\(\{\}\);/.test(serde) && /as z\.ZodTypeAny/.test(serde))) && /export function serializeNpcCustomState\(decoded: DeserializedNpcState\)/.test(serde)
);

if (failures) {
  console.error(`\nRESULT: FAIL (${failures})`);
  process.exit(1);
}
console.log("\nRESULT: PASS");
