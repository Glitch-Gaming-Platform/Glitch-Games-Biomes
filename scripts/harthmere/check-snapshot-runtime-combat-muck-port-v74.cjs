#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}
function ok(cond, msg) {
  if (!cond) {
    console.error(`FAIL ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`OK ${msg}`);
  }
}

const rules = read("src/shared/harthmere/snapshot_runtime_rules_v74.ts");
const combat = read("src/client/components/challenges/LocalDevSnapshotCombatRuntime.tsx");
const hud = read("src/client/components/challenges/HarthmereUnifiedHUD.tsx");
const bridge = read("src/client/components/challenges/LocalDevSnapshotMissionBridge.tsx");
const shim = read("src/server/shim/main.ts");

ok(rules.includes("SNAPSHOT_RUNTIME_RULES_VERSION_V74"), "shared snapshot runtime rules exist");
ok(rules.includes("SNAPSHOT_HARTHMERE_HOSTILE_SPAWNS_V74"), "shared hostile spawn registry exists");
ok(rules.includes("SNAPSHOT_HARTHMERE_MUCK_ZONES_V74"), "shared muck zone registry exists");
ok(rules.includes("SNAPSHOT_PORT_COVERAGE_V74"), "shared port coverage manifest exists");
ok(rules.includes("SNAPSHOT_COMBAT_PRIMER_STEPS_V74"), "shared combat primer steps exist");
ok(rules.includes("isAuthoredPointInSnapshotSafeZoneV74"), "shared safe-zone helper exists");
ok(combat.includes("SnapshotCombatRuntimeControllerV74"), "combat runtime controller exists");
ok(combat.includes("HARTHMERE_COMBAT_EFFECT_EVENT"), "combat runtime listens to current Harthmere combat system");
ok(combat.includes("/ecs/c/health"), "combat runtime polls real server NPC health");
ok(combat.includes("destroy_muck"), "combat runtime includes muck clearing trigger");
ok(combat.includes("craft_muck_buster"), "combat runtime includes Muck Buster trigger");
ok(combat.includes("__snapshotPortV74"), "developer reset/inspection tools are available outside player dialogue");
ok(hud.includes("SnapshotCombatRuntimeControllerV74"), "HUD installs combat runtime controller");
ok(hud.includes("SnapshotCombatMapHUDV74"), "HUD exposes combat map panel");
ok(hud.includes("SnapshotCombatJournalPanelV74"), "HUD exposes combat journal panel");
ok(shim.includes("SNAPSHOT_HARTHMERE_HOSTILE_SPAWNS_V74"), "server shim imports shared hostile spawns");
ok(shim.includes("makeLocalDevSnapshotCombatNpcChangesV74"), "server shim seeds real snapshot combat NPC entities");
ok(shim.includes("muckwad"), "server terrain knows muckwad material");
ok(shim.includes("isHarthmereSnapshotMuckPatchV74"), "server terrain paints shared muck zones");
ok(!/Current task:/i.test(bridge), "Jackie dialogue has no Current task debug copy");
ok(!/Compatibility bridge/i.test(bridge), "Jackie dialogue has no compatibility/debug copy");
ok(!/\$\{defaultDialog\}/.test(bridge), "Jackie dialogue does not prepend default bark text into mission speech");

if (process.exitCode) {
  console.error("v74 snapshot runtime combat/muck port check failed");
  process.exit(process.exitCode);
}
console.log("v74 snapshot runtime combat/muck port check passed");
