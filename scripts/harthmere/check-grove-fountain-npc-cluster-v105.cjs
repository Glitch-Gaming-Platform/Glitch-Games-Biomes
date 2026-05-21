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

const grove = read("src/shared/harthmere/snapshot_grove_content_v75.ts");
const resolver = read("src/shared/harthmere/snapshot_backend_resolver_v80.ts");
const npcs = read("src/client/game/resources/npcs.ts");
const assets = read("src/client/game/renderers/local_dev/harthmere_assets.ts");
const hud = read("src/client/components/challenges/HarthmereUnifiedHUD.tsx");
const faces = read("src/shared/harthmere/voxel_faces.ts");
const guide = read("src/client/game/README-SNAPSHOT-MAP-LANDSCAPE-GUIDE.md");

ok(guide.includes("Do not fake the world with client-only meshes"), "snapshot map guide rule was checked");
ok(grove.includes("SNAPSHOT_GROVE_FOUNTAIN_CENTER_X_V105 = 496") && grove.includes("SNAPSHOT_GROVE_FOUNTAIN_CENTER_Z_V105 = -126"), "Grove tutorial cast is anchored to the live fountain coordinate from the console output");
ok(grove.includes("authoredPosition: snapshotGroveFountainPositionV105(0, 0)") && grove.includes("authoredPosition: snapshotGroveFountainPositionV105(3, -2)") && grove.includes("authoredPosition: snapshotGroveFountainPositionV105(-5, 2)") && grove.includes("authoredPosition: snapshotGroveFountainPositionV105(6, 3)"), "Jackie/Rosalyn/Taye/Nia are back around the fountain cluster");
ok(grove.includes("SNAPSHOT_GROVE_LIVE_WORLD_GROUND_Y_V83 = 69") && grove.includes("SNAPSHOT_GROVE_LIVE_NPC_FEET_Y_V83"), "Grove live NPC feet stay on the y=70 installed-snapshot fountain band");
ok(resolver.includes("SNAPSHOT_GROVE_LIVE_WORLD_GROUND_Y_V83") && !resolver.includes('mode === "live_v83" ? 69'), "resolver uses the shared live Grove Y constant instead of a duplicated hardcode");
ok(npcs.includes("SNAPSHOT_GROVE_NPC_ASSET_KEY_VERSION_V104") && npcs.includes('jackie: "npcs/jackie"') && npcs.includes('taye: "npcs/taye"'), "seeded Grove NPCs prefer their upstream snapshot GLB avatar assets");
ok(assets.includes("rosalyn|guild[_ ]?clerk[_ ]?nia|nia|nina"), "raw decorative Grove NPC copies include Rosalyn/Nia in the hide filter");
ok(faces.includes("SNAPSHOT_GROVE_FOUNTAIN_APPEARANCE_V104") && faces.includes("snapshot_grove_rosalyn_fountain_steward_v104") && faces.includes("snapshot_grove_nia_guild_clerk_v104"), "Rosalyn and Nia have stable Grove-specific generated appearances");
ok(hud.includes("top-[20.25rem]") && hud.includes("md:top-[20.75rem]"), "right Grove objective card is moved below the minimap");
ok(hud.includes("bg-violet-500/90 text-white") && hud.includes("ring-violet-200/50"), "selected systems tab uses a readable highlighted color instead of black-on-black");

if (process.exitCode) {
  process.exit(process.exitCode);
}
