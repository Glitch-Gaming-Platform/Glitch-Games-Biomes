#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}
function ok(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`OK ${message}`);
}

const grove = read("src/shared/harthmere/snapshot_grove_content_v75.ts");
const shim = read("src/server/shim/main.ts");
const sync = read("src/server/sync/subscription/game_observer.ts");

ok(
  /id: "jackie"[\s\S]*?seedServerNpc: true/.test(grove),
  "Jackie is seeded as a real ECS NPC for the first Grove objective"
);
ok(
  grove.includes("SNAPSHOT_GROVE_LIVE_NPC_FEET_Y_V83") &&
    grove.includes("SNAPSHOT_GROVE_LIVE_WORLD_GROUND_Y_V83 = 69") &&
    grove.includes("SNAPSHOT_GROVE_LIVE_MARKER_Y_V83"),
  "Grove NPCs use the live installed-snapshot courtyard Y band (feet y=70, marker y=71)"
);
ok(
  grove.includes("return [position[0], SNAPSHOT_GROVE_LIVE_NPC_FEET_Y_V83, position[2]]"),
  "snapshotGroveGroundedPositionV75 grounds server NPCs at the visible Grove courtyard height"
);
ok(
  shim.includes("snapshotGroveRuntimeGroundedPositionV81") &&
    shim.includes("snapshotGroveGroundedPositionV75(position)"),
  "Grove NPCs stay in authored Grove coordinates used by player spawn, HUD markers, and mission beams"
);
ok(
  shim.includes("position: snapshotGroveRuntimeGroundedPositionV81(npc.authoredPosition)") &&
    shim.includes("position: snapshotGroveRuntimeGroundedPositionV81(spawn.authoredPosition)"),
  "Grove NPCs and snapshot combat spawns both use authored Grove coordinates"
);
ok(
  sync.includes("const LOCAL_DEV_TERRAIN_SHARD_COUNT = 396") &&
    sync.includes("const LOCAL_DEV_NPC_COUNT = 70") &&
    sync.includes("SNAPSHOT_GROVE_NPC_ID_OFFSETS_V81") &&
    sync.includes("SNAPSHOT_COMBAT_NPC_ID_OFFSETS_V81"),
  "sync eager bootstrap covers the full seeded terrain/NPC ID set"
);

if (process.exitCode) {
  process.exit(process.exitCode);
}
