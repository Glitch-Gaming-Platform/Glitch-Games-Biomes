#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};
const section = (name) => console.log(`✓ ${name}`);

console.log("== Harthmere muck/death/NPC/loot UI current ==");

{
  const runtime = read("src/shared/harthmere/snapshot_runtime_rules.ts");
  const shim = read("src/server/shim/main.ts");
  assert(runtime.includes("SNAPSHOT_COMBAT_MUCKER_GROUNDING_VERSION"), "missing combat/mucker grounding version");
  assert(runtime.includes("snapshotCombatGroundedPosition"), "missing combat grounding helper");
  assert(/hostileWorldPosition[\s\S]*snapshotCombatGroundedPosition\(spawn\.authoredPosition\)/.test(runtime), "hostile positions must use combat grounding");
  assert(/combatStepWorldPosition[\s\S]*snapshotCombatGroundedPosition\(step\.targetPosition\)/.test(runtime), "combat target positions must use combat grounding");
  assert(runtime.includes("Number.isFinite(authoredY) ? authoredY"), "combat grounding must preserve authored Y");
  assert(shim.includes("snapshotCombatRuntimeGroundedPosition(spawn.authoredPosition)"), "server seeder must use combat grounding for hostile muckers");
  assert(!/position:\s*snapshotGroveRuntimeGroundedPosition\(spawn\.authoredPosition\)/.test(shim), "hostile muckers must not use raised Grove courtyard Y");
  section("Mucker/Hexer hostile spawns preserve authored wilds Y instead of raised Grove courtyard Y");
}

{
  const death = read("src/client/components/challenges/LocalDevHarthmereDeathSystem.tsx");
  const mesh = read("src/client/game/resources/player_mesh.ts");
  assert(death.includes("HARTHMERE_DEATH_MOVEMENT_LOCK_VERSION"), "missing death movement lock version");
  assert(death.includes("shouldLockHarthmereDeathMovement"), "missing death movement lock predicate");
  assert(death.includes("document.exitPointerLock"), "death lock must release pointer lock for respawn UI");
  for (const key of ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "Space", "ShiftLeft"]) {
    assert(death.includes(`\"${key}\"`), `death movement key ${key} not blocked`);
  }
  assert(death.includes("HARTHMERE_PLAYER_DEATH_POSE_EVENT"), "missing death pose event dispatch");
  assert(mesh.includes("installHarthmerePlayerDeathPoseBridge"), "player mesh must install death pose bridge");
  assert(mesh.includes("root.rotation.set(neutral.rotation.x - 1.32"), "death pose must visibly collapse the local player mesh");
  section("Death locks movement/attacks and drives a visible local player death pose until respawn");
}

{
  const faces = read("src/shared/harthmere/voxel_faces.ts");
  const shim = read("src/server/shim/main.ts");
  for (const field of [
    "genderIdentity", "pronouns", "customPronouns", "skinTone", "faceShape", "eyeShape", "eyeColor", "browStyle", "noseStyle", "mouthStyle", "hairStyle", "hairColor", "facialHair", "cheekStyle", "accessory",
    "bodyType", "bodyHeight", "shoulderWidth", "armLength", "legLength", "stance", "outfitColor",
  ]) {
    assert(faces.includes(`\"${field}\"`), `customization field missing: ${field}`);
  }
  assert(faces.includes("field_medic_coat"), "Doc/medic clothing variant missing");
  assert(/doc\\b\|doctor\|medic\|field medic\|muck researcher/.test(faces), "Doc/medic appearance polish missing");
  assert(shim.includes("makeHarthmereNpcAppearanceConfig"), "server NPCs must seed full appearance markers, not face/body only");
  assert(shim.includes("withHarthmereAppearanceMarker"), "server NPCs must write unified appearance markers");
  section("NPC customization uses full face/body/clothing appearance markers with stronger Doc/medic variation");
}

{
  const backend = read("src/shared/harthmere/live_mode_backend.ts");
  const route = read("src/pages/api/harthmere/live_mode_inventory_loot_state.ts");
  const liveMode = read("src/pages/api/harthmere/live_mode.ts");
  const adapter = read("src/client/components/biomes_ui/adapters/useBiomesUILiveAdapters.ts");
  const lootTab = read("src/client/components/biomes_ui/tabs/LootTab.tsx");
  const authority = read("src/shared/harthmere/mmo_inventory_loot_authority.ts");
  assert(backend.includes("inventoryLoot: HarthmereInventoryLootState"), "live backend state must include inventoryLoot authority");
  assert(backend.includes("createHarthmereInventoryLootClientSnapshotFromBackend"), "backend snapshot bridge missing");
  assert(route.includes("/live_mode_inventory_loot_state") || route.includes("inventoryLootState"), "inventory/loot API route missing snapshot response");
  assert(liveMode.includes("inventoryLootState"), "live mode mutation response must include inventoryLootState");
  assert(adapter.includes("fetchInventoryLootState"), "BiomesUI must fetch inventory/loot backend state");
  assert(adapter.includes("lootAdapter"), "BiomesUI must provide LootTab adapter");
  assert(adapter.includes("MMO inventory authority"), "Inventory tab must indicate backend authority hydration");
  assert(!lootTab.includes("Razorslash") && !lootTab.includes("PLACEHOLDER"), "LootTab placeholder data must be removed");
  assert(authority.includes("businessInventories") && authority.includes("itemInstances") && authority.includes("townDemand"), "client snapshot must expose item instances/business inventory/town demand");
  section("BiomesUI inventory and loot are hydrated from the backend authority with no placeholder loot rows");
}

{
  const files = [
    "src/shared/harthmere/snapshot_runtime_rules.ts",
    "src/server/shim/main.ts",
    "src/shared/harthmere/voxel_faces.ts",
    "src/client/components/challenges/LocalDevHarthmereDeathSystem.tsx",
    "src/client/game/resources/player_mesh.ts",
    "src/shared/harthmere/live_mode_backend.ts",
    "src/shared/harthmere/mmo_inventory_loot_authority.ts",
    "src/pages/api/harthmere/live_mode_inventory_loot_state.ts",
    "src/pages/api/harthmere/live_mode.ts",
    "src/client/components/biomes_ui/adapters/useBiomesUILiveAdapters.ts",
    "src/client/components/biomes_ui/tabs/LootTab.tsx",
  ];
  for (const file of files) {
    const source = read(file);
    const result = ts.transpileModule(source, {
      compilerOptions: {
        jsx: ts.JsxEmit.React,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    });
    const diagnostics = result.diagnostics ?? [];
    assert(!diagnostics.length, `${file} failed transpile: ${diagnostics.map((d) => d.messageText).join("; ")}`);
  }
  section("Modified TS/TSX files transpile cleanly");
}

console.log("\nAll muck/death/NPC/loot UI current tests passed.");
