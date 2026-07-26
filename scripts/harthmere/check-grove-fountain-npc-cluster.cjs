#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
function ok(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`OK ${message}`);
}

const grove = read("src/shared/harthmere/snapshot_grove_content.ts");
const groveIds = read("src/shared/harthmere/snapshot_grove_ids.ts");
const resolver = read("src/shared/harthmere/snapshot_backend_resolver.ts");
const npcs = read("src/client/game/resources/npcs.ts");
const npcMeshRouting = read(
  "src/shared/harthmere/snapshot_grove_npc_mesh_routing.ts",
);
const assets = read("src/client/game/renderers/local_dev/harthmere_assets.ts");
const hud = read("src/client/components/challenges/HarthmereUnifiedHUD.tsx");
const faces = read("src/shared/harthmere/voxel_faces.ts");
const guide = read("docs/harthmere/bibles/README-SNAPSHOT-MAP-LANDSCAPE-GUIDE.md");

ok(guide.includes("Do not fake the world with client-only meshes"), "snapshot map guide rule was checked");
ok(grove.includes("SNAPSHOT_GROVE_FOUNTAIN_CENTER_X = 496") && grove.includes("SNAPSHOT_GROVE_FOUNTAIN_CENTER_Z = -126"), "Grove tutorial cast is anchored to the live fountain coordinate from the console output");
ok(grove.includes("authoredPosition: snapshotGroveFountainPosition(0, 0)") && grove.includes("authoredPosition: snapshotGroveFountainPosition(3, -2)") && grove.includes("authoredPosition: snapshotGroveFountainPosition(-5, 2)") && grove.includes("authoredPosition: snapshotGroveFountainPosition(6, 3)"), "Jackie/Rosalyn/Taye/Nia are back around the fountain cluster");
ok(groveIds.includes("SNAPSHOT_GROVE_LIVE_WORLD_GROUND_Y = 69") && groveIds.includes("SNAPSHOT_GROVE_LIVE_NPC_FEET_Y"), "Grove live NPC feet stay on the y=70 installed-snapshot fountain band");
ok(resolver.includes("SNAPSHOT_GROVE_LIVE_WORLD_GROUND_Y") && !resolver.includes('mode === "live" ? 69'), "resolver uses the shared live Grove Y constant instead of a duplicated hardcode");
ok(npcs.includes("SNAPSHOT_GROVE_NPC_ASSET_KEY_VERSION") && npcMeshRouting.includes('jackie: "npcs/jackie"') && npcMeshRouting.includes('taye: "npcs/taye"'), "seeded Grove NPCs prefer their upstream snapshot GLB avatar assets");
ok(assets.includes("rosalyn|guild[_ ]?clerk[_ ]?nia|nia|nina"), "raw decorative Grove NPC copies include Rosalyn/Nia in the hide filter");
ok(faces.includes("SNAPSHOT_GROVE_FOUNTAIN_APPEARANCE") && faces.includes("snapshot_grove_rosalyn_fountain_steward") && faces.includes("snapshot_grove_nia_guild_clerk"), "Rosalyn and Nia have stable Grove-specific generated appearances");
ok(!hud.includes("top-[20.25rem]") && !hud.includes("md:top-[20.75rem]"), "right Grove objective card is removed from the in-world HUD");
ok(hud.includes("bg-yellow-300/25 text-yellow-50") && hud.includes("border-yellow-200/80"), "selected systems tab uses a readable highlighted color instead of black-on-black");

if (process.exitCode) {
  process.exit(process.exitCode);
}
