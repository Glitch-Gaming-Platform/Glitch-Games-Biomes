#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || process.cwd());
function read(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) throw new Error(`Missing file: ${rel}`);
  return fs.readFileSync(p, "utf8");
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const death = read(
  "src/client/components/challenges/LocalDevHarthmereDeathSystem.tsx"
);
assert(
  death.includes("HARTHMERE_DEATH_SCREEN_VERSION_V139"),
  "Death screen v139 marker missing."
);
assert(
  death.includes("HarthmereDeathScreenOverlayV139"),
  "Automatic death screen overlay component missing."
);
assert(
  death.includes("downHarthmerePlayerFromSystem"),
  "Death runtime must repair combat HP-zero states into a respawnable death state."
);
assert(
  death.includes("HP reached zero") && death.includes("HP Zero Death Check"),
  "Death runtime must create a Grove-respawnable death record when combat HP reaches zero."
);
assert(
  death.includes("You are gone too soon"),
  "Death screen must show an explicit death message instead of relying on the ESC Return to Game menu."
);
assert(
  death.includes("Resurrect at The Grove Safe Point"),
  "Death screen must expose a Grove respawn button."
);
assert(
  death.includes('data-harthmere-death-respawn-grove-v139="true"'),
  "Grove respawn button must be test-addressable."
);
assert(
  !death.includes("text-white grayscale"),
  "Death screen overlay must not grayscale the purple respawn button."
);
assert(
  death.includes("bg-[#6f3cff]") && death.includes("text-white"),
  "Grove respawn button must use the purple background and white text treatment."
);
assert(
  death.includes("HARTHMERE_GROVE_RESPAWN_TELEPORT_TARGET_V139"),
  "Grove respawn teleport target missing."
);
assert(
  death.includes("x: 496") &&
    death.includes("y: 70") &&
    death.includes("z: -126"),
  "Grove respawn target should land near the Grove fountain, not in the Muck."
);
assert(
  death.includes("__harthmereLivePlayerDebug") &&
    death.includes("teleportTo?.(target)"),
  "Grove respawn must try the live player teleport hook first."
);
assert(
  death.includes("biomes.localDev.harthmere.teleportTarget"),
  "Grove respawn must store a fallback teleport request for reload/publishMove consumption."
);
assert(
  death.includes('respawnHarthmerePlayer("the_grove")'),
  "Grove respawn must update combat/death state through the existing death system."
);
assert(
  death.includes("catch (error)") &&
    death.includes(
      "Keep going. A failed live hook must not block the respawn button."
    ),
  "Respawn teleport failures must be non-fatal."
);
assert(
  death.includes("the_grove: {") && death.includes("Main Grove recovery point"),
  "Death menu should include The Grove as a first-class respawn option."
);
assert(
  death.includes('id === "the_grove"') &&
    death.includes("respawnHarthmerePlayerAtGroveV139()"),
  "Menu Grove respawn must use the Grove teleport wrapper."
);

const hud = read("src/client/components/challenges/HarthmereUnifiedHUD.tsx");
assert(
  hud.includes("HarthmereDeathScreenOverlayV139"),
  "Unified HUD must mount the automatic death screen overlay."
);
const overlayMountCount = (
  hud.match(/<HarthmereDeathScreenOverlayV139 \/>/g) || []
).length;
assert(
  overlayMountCount >= 2,
  "Death overlay must be mounted in both replacement-BiomesUI and legacy-HUD modes."
);

const esc = read("src/client/components/EscGameMenu.tsx");
assert(
  esc.includes("useHarthmereDeathState"),
  "ESC menu must know when the Harthmere death screen is active."
);
assert(
  esc.includes("harthmereDeathScreenActiveV139"),
  "ESC menu death guard missing."
);
assert(
  esc.includes('data-harthmere-esc-hidden-for-death-screen-v139="true"'),
  "ESC Return to Game controls must be hidden behind the real death screen while downed/dead."
);
assert(
  esc.includes('"downed"') &&
    esc.includes('"dead"') &&
    esc.includes('"respawning"'),
  "ESC death guard must cover downed/dead/respawning edge cases."
);

const overlays = read("src/client/game/scripts/overlays.ts");
assert(
  overlays.includes("HARTHMERE_NPC_TALK_INSPECT_RADIUS_V139"),
  "NPC talk inspect radius marker missing."
);
assert(
  overlays.includes("8.5"),
  "NPC talk inspect radius should be expanded beyond the default change radius."
);
assert(
  overlays.includes("entity.npc_metadata") &&
    overlays.includes(
      "Math.max(changeRadius(this.resources), HARTHMERE_NPC_TALK_INSPECT_RADIUS_V139)"
    ),
  "NPC inspection should use the expanded talk radius while preserving normal object reach."
);
assert(
  overlays.includes("if (hit.distance > maxInspectDistance)"),
  "Out-of-range entities must still be rejected."
);

const grove = read("src/shared/harthmere/snapshot_grove_content_v75.ts");
assert(
  grove.includes("SNAPSHOT_GROVE_NPC_ROUTE_SPEED_MULTIPLIER_V139"),
  "Grove route speed multiplier marker missing."
);
assert(
  grove.includes("SNAPSHOT_GROVE_NPC_ROUTE_SPEED_MULTIPLIER_V139 = 1.35"),
  "Grove NPC route speed should be increased by 35%."
);
assert(
  grove.includes(
    "profile.speedMetersPerSecond * SNAPSHOT_GROVE_NPC_ROUTE_SPEED_MULTIPLIER_V139"
  ),
  "Route motion must apply the speed multiplier at runtime."
);
assert(
  grove.includes("speedMetersPerSecond: speed"),
  "Route debug/result must report the effective speed."
);

console.log("PASS death-talk-npc-speed-v139");
