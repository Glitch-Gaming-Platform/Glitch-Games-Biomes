#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const combatPath = path.join(
  root,
  "src/client/components/challenges/LocalDevHarthmereCombat.tsx"
);
const overlaysPath = path.join(root, "src/client/game/scripts/overlays.ts");
const combat = fs.readFileSync(combatPath, "utf8");
const overlays = fs.readFileSync(overlaysPath, "utf8");
const failures = [];
function check(condition, message) {
  if (!condition) failures.push(message);
  else console.log(`PASS ${message}`);
}

check(
  overlays.includes("HARTHMERE_ECS_NPC_COMBAT_REGISTRY"),
  "overlay current combat registry version constant exists"
);
check(
  overlays.includes("HARTHMERE_ECS_NPC_COMBAT_REGISTRY_SCAN_RADIUS"),
  "overlay current scan radius constant exists"
);
check(
  overlays.includes("publishHarthmereEcsNpcCombatRegistry"),
  "overlay current publisher exists"
);
check(
  overlays.includes("publishHarthmereEcsNpcCombatRegistry();"),
  "applyAllOverlays publishes registry every frame"
);
check(
  overlays.includes("__harthmereEcsNpcCombatActorPositions"),
  "overlay writes ECS NPC combat actor window registry"
);
check(
  overlays.includes("__harthmereEcsNpcCombatRegistrationAudit"),
  "overlay writes runtime registration audit"
);
check(
  overlays.includes("expectedNpcCount") &&
    overlays.includes("registeredNpcCount") &&
    overlays.includes("missingNpcEntityIds"),
  "overlay audit tracks expected, registered, and missing NPC ids"
);
check(
  /Seedy Muckling|Seedling Mucker|seedling|seedy|muckernot/.test(overlays),
  "overlay classifier explicitly covers Seedy/Seedling Muckling/Mucker names"
);
check(
  /muck\|muckling\|mucker|muckling\|mucker\|muck|mucker\|muckling|hex\|hexer|hexer\|hex/.test(
    overlays
  ),
  "overlay classifier covers muckers and hexers"
);
check(
  /const attackable = alive;/.test(overlays),
  "overlay marks every live nearby NPC as locally attackable"
);

const methodStart = overlays.indexOf("publishHarthmereEcsNpcCombatRegistry()");
const methodEnd = overlays.indexOf("\n  applyNpcNameOverlays", methodStart);
const methodBody =
  methodStart >= 0 && methodEnd > methodStart
    ? overlays.slice(methodStart, methodEnd)
    : "";
const candidateStart = overlays.indexOf("private projectedNpcCandidates(");
const candidateEnd = overlays.indexOf(
  "\n  applyNavigationAidOverlays",
  candidateStart
);
const candidateBody =
  candidateStart >= 0 && candidateEnd > candidateStart
    ? overlays.slice(candidateStart, candidateEnd)
    : "";
check(
  candidateBody.includes("NpcMetadataSelector.query.spatial.inSphere"),
  "registry scans nearby NPC metadata directly"
);
check(
  methodBody.includes("seenNpcEntityIds.push(Number(entity.id))"),
  "registry records every scanned NPC before filtering"
);
check(
  methodBody.includes("actors[String(entity.id)] ="),
  "registry assigns an actor entry for each valid positioned NPC"
);
check(
  !methodBody.includes("screenCoordinateProjection("),
  "registry is not gated by screen projection"
);
check(
  !methodBody.includes("this.isOccluded("),
  "registry is not gated by occlusion"
);
check(
  methodBody.includes("entity.position?.v"),
  "registry falls back to ECS entity position when render state is absent"
);
check(
  methodBody.includes("presentation.position ??") &&
    candidateBody.includes("harthmereProjectedNpcCandidates"),
  "registry prefers current rendered/projected NPC position when available"
);

const applyAllStart = overlays.indexOf("applyAllOverlays(");
const applyAllEnd = overlays.indexOf("\n  tick(", applyAllStart);
const applyAll =
  applyAllStart >= 0 && applyAllEnd > applyAllStart
    ? overlays.slice(applyAllStart, applyAllEnd)
    : "";
const showNpcsIdx = applyAll.indexOf("if (showNpcs)");
const registryCallIdx = applyAll.indexOf(
  "this.publishHarthmereEcsNpcCombatRegistry();"
);
check(
  showNpcsIdx >= 0 && registryCallIdx > showNpcsIdx,
  "registry publish is outside and after the showNpcs-only name overlay block"
);

check(
  combat.includes("__harthmereEcsNpcCombatActorPositions"),
  "combat reads ECS NPC combat actor registry"
);
check(
  combat.includes("Date.now() - at > 3_500") ||
    combat.includes("Date.now() - at > 3500"),
  "combat ignores stale actor registry snapshots"
);
const statsStart = combat.indexOf("function statsForRuntimeCombatActor(");
const actorRead = combat.indexOf(
  "const actor = readHarthmereRuntimeCombatActors()[offset];",
  statsStart
);
check(
  statsStart >= 0 &&
    actorRead > statsStart &&
    !combat.slice(statsStart, actorRead).includes("offset < 10_000"),
  "runtime combat stats support raw ECS NPC ids below 10000"
);

const statsForOffsetStart = combat.indexOf(
  "function statsForOffset(offset: number): HarthmereCombatStats {"
);
const trainingIdx = combat.indexOf(
  "if (offset === HARTHMERE_TRAINING_DUMMY_OFFSET)",
  statsForOffsetStart
);
const runtimeFirst = combat.indexOf(
  "const runtimeActorStats = statsForRuntimeCombatActor(offset);",
  statsForOffsetStart
);
check(
  statsForOffsetStart >= 0 &&
    runtimeFirst > statsForOffsetStart &&
    runtimeFirst < trainingIdx,
  "runtime actor stats are preferred before static fallback offsets"
);
check(
  combat.includes("ecsNpcActorOffsets") || combat.includes("ecsNpcAudit"),
  "forward-arc debug reports ECS NPC registry data"
);

if (failures.length) {
  console.error("\nFAILURES");
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log("\nAll current ECS NPC combat registry checks passed.");
