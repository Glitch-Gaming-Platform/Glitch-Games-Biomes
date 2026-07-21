const fs = require("fs");
function ok(cond, msg) {
  if (!cond) {
    console.error("FAIL " + msg);
    process.exit(1);
  }
  console.log("OK " + msg);
}
const shim = fs.readFileSync("src/server/shim/main.ts", "utf8");
const players = fs.readFileSync("src/server/logic/utils/players.ts", "utf8");
const renderer = fs.readFileSync(
  "src/client/game/renderers/local_dev/harthmere_assets.ts",
  "utf8"
);
const docker = fs.readFileSync("Dockerfile.biomes", "utf8");
const prepare = fs.readFileSync(
  "scripts/glitch/prepare-glitch-image.sh",
  "utf8"
);
const runner = fs.readFileSync(
  "scripts/glitch/run-glitch-local-game-stack.sh",
  "utf8"
);
const deploy = fs.readFileSync(
  "scripts/glitch/deploy-production-local-redis-smoke.sh",
  "utf8"
);
ok(
  shim.includes("HARTHMERE_EXTRA_TOWN_OFFSET"),
  "server shim extra-town offset marker is present"
);
ok(
  shim.includes("shouldEnableHarthmereAdditiveWorldExtension(process.env)"),
  "server enables additive town by default with explicit rollback support"
);
ok(
  shim.includes("harthmereExtraTownShardOffsetX()"),
  "terrain shard specs are shifted"
);
ok(
  shim.includes("harthmereAuthoredWorldX(worldX)"),
  "terrain generator maps shifted world X back to authored X"
);
ok(
  shim.includes("harthmereAuthoredWorldZ(worldZ)"),
  "terrain generator maps shifted world Z back to authored Z"
);
ok(
  shim.includes(
    "const obsoleteLocalDevIds = shouldUseHarthmereExtraTownOffset()"
  ),
  "additive fingerprint checks ignore intentionally preserved legacy terrain ids"
);
ok(
  shim.includes("position: harthmereWorldPosition(npc.position)") ||
    shim.includes(
      "position: harthmereGroundedNpcWorldPositionWithClaim(npc, claimed)"
    ),
  "NPC positions are shifted"
);
ok(
  players.includes("HARTHMERE_EXTRA_TOWN_PLAYER_START_OFFSET"),
  "player start offset marker is present"
);
ok(
  players.includes("offsetLocalDevStarterTownSpawn"),
  "explicit Harthmere starts use shifted spawn"
);
ok(
  players.includes("return sample(CONFIG.playerStartPositions)!"),
  "snapshot start remains default"
);
ok(
  renderer.includes("HARTHMERE_RUNTIME_EXTRA_TOWN_OFFSET"),
  "client runtime offset marker is present"
);
ok(
  renderer.includes("NEXT_PUBLIC_BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN"),
  "client reads public extra-town flag"
);
ok(
  renderer.includes("shiftHarthmereRuntimePlacementForExtraTown"),
  "client placements shift"
);
ok(
  renderer.includes("extra-town-offset"),
  "shifted client placements are tagged"
);
ok(
  docker.includes("ENV BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN=1"),
  "production image enables the additive town"
);
ok(
  docker.includes("ENV BIOMES_CREATE_LOCAL_DEV_TERRAIN=1"),
  "production image enables automatic terrain creation"
);
ok(
  docker.includes("ENV BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X=1600"),
  "production image server offset is +1600"
);
ok(
  docker.includes("ENV NEXT_PUBLIC_BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X=1600"),
  "production image client offset is +1600"
);
ok(
  prepare.includes("BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X:-1600"),
  "image preparation defaults the server offset to +1600"
);
ok(
  prepare.includes("NEXT_PUBLIC_BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X"),
  "image preparation mirrors the offset into the client build"
);
ok(
  runner.includes("BIOMES_CREATE_LOCAL_DEV_TERRAIN:-1"),
  "production runner leaves automatic terrain creation enabled"
);
ok(
  runner.includes("BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X:-1600"),
  "production runner defaults the connected offset to +1600"
);
ok(
  deploy.includes("BIOMES_CREATE_LOCAL_DEV_TERRAIN=1"),
  "Azure deployment explicitly enables terrain seeding"
);
ok(
  deploy.includes("BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X=1600"),
  "Azure deployment explicitly uses the +1600 server offset"
);
ok(
  deploy.includes("NEXT_PUBLIC_BIOMES_HARTHMERE_EXTRA_TOWN_OFFSET_X=1600"),
  "Azure build/runtime explicitly use the +1600 client offset"
);
console.log("harthmere extra-town offset current check passed");
